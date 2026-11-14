/**
 * TableInput.js — Central event hub
 *
 * Wires together:
 *  - Mouse move  → CardPicker hover detection → hand highlight
 *  - Click       → CardPicker hit → hand selection → camera zoom → overlay open
 *  - Overlay close → camera restore → hand unflip
 *  - In game: drag to look around from the seat (CameraController 'seat'
 *    mode); hover the own (face-down) hand or the board → the player looks
 *    at it (TableCards.peekHand / peekBoard); click the own hand or the board → close-up from
 *    above, the hand face up; click anywhere (or right-click) → back to the seat
 *
 * All DOM events are registered here so they can be cleanly removed if needed.
 */

import * as THREE from 'three';
import { CardPicker }   from './CardPicker.js';
import { CameraMoves }  from '../camera/CameraMoves.js';

export class TableInput {
  /**
   * @param {object} deps
   * @param {import('../render/Engine').Engine}                    deps.engine
   * @param {import('../scene/start/StartCards').StartCards}         deps.startCards
   * @param {import('../scene/cards/TableCards').TableCards}          deps.tableCards
   * @param {import('../camera/CameraController').CameraController}      deps.cameraController
   * @param {import('../ui/overlay/Overlay').Overlay}                    deps.overlay
   */
  constructor({ engine, startCards, tableCards, cameraController, overlay }) {
    this.engine           = engine;
    this.startCards      = startCards;
    this.tableCards       = tableCards;
    this.cameraController = cameraController;
    this.overlay          = overlay;

    this._rayCaster = new CardPicker(
      engine.camera,
      engine.canvas,
      startCards
    );

    this._cameraMoves = new CameraMoves(cameraController);

    // Track whether an overlay is open to suppress further clicks
    this._overlayOpen = false;

    // Once a game starts the camera stays at the player's seat
    this._inGame = false;

    // In game: 'hand' | 'board' while the camera looks at it from above
    this._closeUp = null;
    this._tableRay = new THREE.Raycaster();
    this._pointer  = new THREE.Vector2();
    this._downAt   = null; // where the mouse button went down (tell clicks from drags)
    this._looking  = null; // 'hand' | 'board' while the player looks at it (hover)
    this._lookBox  = new THREE.Box3();

    // Bound references for removeEventListener
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onClick     = this._handleClick.bind(this);
    this._onKeyDown   = this._handleKeyDown.bind(this);
    this._onPointerDown = (e) => { this._downAt = { x: e.clientX, y: e.clientY }; };
    this._onContextMenu = (e) => {
      if (!this._closedUp()) return;
      e.preventDefault();
      this._backToSeat();
    };
    this._onMouseLeave = () => { if (!this._closedUp()) this._look(null); };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Register all DOM event listeners. */
  init() {
    const canvas = this.engine.canvas;
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('click',     this._onClick);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('contextmenu', this._onContextMenu);
    canvas.addEventListener('mouseleave', this._onMouseLeave);
    window.addEventListener('keydown',   this._onKeyDown);

    // Listen for overlay close events dispatched by Overlay.js
    window.addEventListener('overlay:close', () => this._onOverlayClose());
    window.addEventListener('game:start', () => {
      this._inGame = true;
      this._closeUp = null;
      this.cameraController.setMode('seat');
    });
    window.addEventListener('game:quit', () => {
      this._inGame = false;
      this._closeUp = null;
      this._look(null);
      // Quitting goes through the pause menu, which never sends game:resume
      this.cameraController.setPaused(false);
      this._cameraMoves.zoomToDefault();
    });
    window.addEventListener('game:pause',  () => this.cameraController.setPaused(true));
    window.addEventListener('game:resume', () => this.cameraController.setPaused(false));

    // The cards under a close-up changed: refit (new street), or leave (new hand, fold)
    this.tableCards.onChange = (kind) => {
      if (!this._closedUp() || kind !== this._closeUp) return;
      const area = this.tableCards.closeUpArea(kind);
      if (area) this._cameraMoves.closeUp(area);
      else this._backToSeat();
    };

    console.log('[TableInput] Listeners registered.');
  }

  /** Remove all event listeners (call on cleanup / hot-reload). */
  destroy() {
    this.engine.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.engine.canvas.removeEventListener('click',     this._onClick);
    this.engine.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.engine.canvas.removeEventListener('contextmenu', this._onContextMenu);
    this.engine.canvas.removeEventListener('mouseleave', this._onMouseLeave);
    window.removeEventListener('keydown', this._onKeyDown);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _handleMouseMove(event) {
    if (this._overlayOpen) return;
    if (this._inGame) {
      const closedUp = this._closedUp();
      if (!closedUp) this._look(this._lookTarget(event));
      const clickable = closedUp || this._looking || this._tableCardAt(event);
      this.engine.canvas.style.cursor = clickable ? 'pointer' : (event.buttons ? 'grabbing' : 'grab');
      return;
    }

    const hand = this._rayCaster.getHandAtEvent(event);
    this.startCards.setHovered(hand);

    // Change cursor
    this.engine.canvas.style.cursor = hand ? 'pointer' : 'default';
  }

  _handleClick(event) {
    if (this._overlayOpen) return;
    if (this._inGame) return this._handleGameClick(event);

    const hand = this._rayCaster.getHandAtEvent(event);
    if (!hand) return;

    // 1. Select (flip) the hand
    this.startCards.selectHand(hand.index);

    // 2. Animate camera to the player's seat (whichever object was clicked)
    this._cameraMoves.zoomToSeat(0);

    // 3. Show overlay after a short delay (let camera start moving)
    setTimeout(() => {
      this._overlayOpen = true;
      this.overlay.show(hand.section);
      // Disable orbit while overlay is open
      this.cameraController.controls.enabled = false;
    }, 300);
  }

  /** In game: a click (not the end of a drag) on the own hand / the board. */
  _handleGameClick(event) {
    const d = this._downAt;
    if (d && Math.hypot(event.clientX - d.x, event.clientY - d.y) > 6) return; // was a drag
    if (this._closedUp()) return this._backToSeat();

    // While looking at the hand / board, it has left its spot: a click means it
    const looking = this._looking;
    const mesh = looking ? null : this._tableCardAt(event);
    const area = looking ? this.tableCards.closeUpArea(looking) : mesh && this.tableCards.closeUpTarget(mesh);
    if (!area) return;
    this._look(null);
    this._closeUp = area.kind;
    // From above, the hand lies face up where it is; the board is face up already
    this.tableCards.peekHand(area.kind === 'hand' ? 'flat' : null);
    this._cameraMoves.closeUp(area);
  }

  /**
   * What the mouse is over: the player's hand, the board, or null. The one
   * already looked at keeps priority, and its area where the cards lie counts
   * too: the raised cards leave the pointer, and they must not drop back
   * under it and rise again.
   */
  _lookTarget(event) {
    this._aim(event);
    const over = (kind) => {
      const meshes = kind === 'hand' ? this.tableCards.handMeshes() : this.tableCards.boardMeshes();
      if (this._tableRay.intersectObjects(meshes, false).length) return true;
      if (this._looking !== kind) return false;
      const area = this.tableCards.closeUpArea(kind);
      if (!area) return false;
      this._lookBox.setFromCenterAndSize(area.centre, new THREE.Vector3(area.width, 0.05, area.depth));
      return this._tableRay.ray.intersectsBox(this._lookBox);
    };
    if (this._looking && over(this._looking)) return this._looking;
    return ['hand', 'board'].find(over) ?? null;
  }

  /**
   * Raise the hand or the board to look at it, or put everything back down.
   * Always passed on: TableCards ignores a repeat, and new cards start at rest.
   * @param {'hand' | 'board' | null} kind
   */
  _look(kind) {
    this._looking = kind;
    this.tableCards.peekHand(kind === 'hand' ? 'look' : null);
    this.tableCards.peekBoard(kind === 'board');
  }

  /** The player's card or a board card under the mouse, or null. */
  _tableCardAt(event) {
    this._aim(event);
    return this._tableRay.intersectObjects(this.tableCards.closeUpMeshes(), false)[0]?.object ?? null;
  }

  /** Point the table ray at the mouse. */
  _aim(event) {
    const rect = this.engine.canvas.getBoundingClientRect();
    this._pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this._tableRay.setFromCamera(this._pointer, this.engine.camera);
  }

  /** In a close-up — unless something else (the dealer's show) moved the camera since. */
  _closedUp() {
    if (this._closeUp && this.cameraController.mode !== 'fixed') {
      this._closeUp = null;
      this.tableCards.peekHand(null); // the hand was face up for the close-up
    }
    return this._closeUp !== null;
  }

  _backToSeat() {
    this._closeUp = null;
    this.tableCards.peekHand(null);
    this._cameraMoves.backToSeat(0);
  }

  _onOverlayClose() {
    // Unflip cards
    this.startCards.deselectAll();

    if (this._inGame) {
      // Stay seated: the camera is already at the player's seat
      this._overlayOpen = false;
      return;
    }

    // Restore camera to default overview (CameraMoves re-enables orbit on complete)
    this._cameraMoves.zoomToDefault();

    // Mark overlay as closed after the tween finishes
    setTimeout(() => {
      this._overlayOpen = false;
    }, 850);
  }

  _handleKeyDown(event) {
    // Escape closes the overlay
    if (event.key === 'Escape' && this._overlayOpen) {
      this.overlay.hide();
    }
  }
}
