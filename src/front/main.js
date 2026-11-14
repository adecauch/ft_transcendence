/**
 * main.js — Entry point of the front
 *
 * Boots, in order: renderer + lights + assets → the room (table, chairs,
 * lamps, dealer) → the start card → the game pieces (TableCards, TableChips,
 * ActionBar, TableController + PokerBot) → camera, menus, input → render loop.
 *
 * The rules and the AI come from src/shared/ (PokerGame, PokerBot);
 * TableController connects them to the 3D table.
 */

import '@fontsource/rye';
import '@fontsource/lilita-one';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './ui/theme/saloon.css';

import { Engine } from './render/Engine.js';
import { Lighting } from './render/Lighting.js';
import { AssetLoader } from './render/AssetLoader.js';
import { ToonStyle } from './render/ToonStyle.js';

import { Table } from './scene/room/Table.js';
import { Room } from './scene/room/Room.js';
import { Chairs } from './scene/room/Chairs.js';
import { Lamps } from './scene/room/Lamps.js';
import { StartCards } from './scene/start/StartCards.js';
import { Dealer } from './scene/dealer/Dealer.js';
import { Opponents } from './scene/opponents/Opponents.js';
import { DustParticles } from './scene/room/DustParticles.js';
import { TableCards } from './scene/cards/TableCards.js';
import { TableChips } from './scene/chips/TableChips.js';

import { CameraController } from './camera/CameraController.js';
import { TableInput } from './input/TableInput.js';
import { CameraMoves } from './camera/CameraMoves.js';

import { Overlay } from './ui/overlay/Overlay.js';
import { WelcomeScreen } from './ui/WelcomeScreen.js';
import { AuthScreen } from './ui/auth/AuthScreen.js';
import { UserBadge } from './ui/UserBadge.js';
import { StatsMenu } from './ui/stats/StatsMenu.js';
import { FriendsMenu } from './ui/friends/FriendsMenu.js';
import { WaitingRoom } from './ui/online/WaitingRoom.js';
import { friendsApi } from './net/friendsApi.js';
import { lobbyApi } from './net/lobbyApi.js';
import { watchSocial } from './net/socialLive.js';
import { RangeScreen } from './ui/ranges/RangeScreen.js';
import { AchievementToast } from './ui/AchievementToast.js';
import { GameRecorder } from './game/GameRecorder.js';
import { authApi } from './net/authApi.js';
import { PauseMenu } from './ui/pause/PauseMenu.js';
import { ActionBar } from './ui/actionBar/ActionBar.js';
import { TableController } from './game/TableController.js';

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function init() {
  // npm run debug_ia: AI cards face up + a large panel with every AI decision
  const AI_DEBUG = import.meta.env.MODE === 'aidebug';
  // Logged-in players' games are saved on the server, hand by hand; new
  // achievements are announced during the game
  const toast = new AchievementToast();
  const recorder = new GameRecorder({ onAchievements: (ids) => toast.show(ids) });

  // The start objects on the table are built further down (after the models load);
  // the invitation count may arrive before: kept here until then
  let startCards = null;
  let invites = 0;
  let sharedTableId = null; // the online table the player waits at (friends' invitations go there)
  const showInvites = (n) => { invites = n; startCards?.setInvites(n); };

  if (!AI_DEBUG) {
    // Welcome → already logged in (session cookie)? straight in; otherwise the
    // login / sign-up screen (or "Jouer sans compte")
    const stats = new StatsMenu();
    // Friends online, next to "Amis" in the badge (recounted after each change)
    const countOnline = () => friendsApi.list().then((res) => {
      if (res.ok && badge.user) badge.setOnline(res.data.friends.filter((f) => f.status !== 'offline').length);
    });
    const friends = new FriendsMenu({ onChange: countOnline, getUser: () => badge.user, getTableId: () => sharedTableId });
    // Invitations waiting: a badge on the invitation card of the table
    const countInvites = () => lobbyApi.invitations().then((res) => {
      showInvites(res.ok && badge.user ? res.data.invitations.length : 0);
    });
    window.addEventListener('lobby:changed', countInvites);
    // Logged in: the live stream (it's what makes the player "online" for their
    // friends) tells when friends or invitations change
    let social = null;
    const watch = (user) => {
      social?.close();
      social = user ? watchSocial({
        onFriends: () => { countOnline(); friends.refresh(); },
        onInvitations: () => window.dispatchEvent(new CustomEvent('lobby:changed')),
      }) : null;
    };
    window.addEventListener('friends:open', () => friends.show());
    window.addEventListener('auth:open', () => auth.show('login'));
    const badge = new UserBadge({
      onSignIn: () => auth.show('login'),
      onStats: () => stats.show(),
      onFriends: () => friends.show(),
      onUser: (user) => {
        recorder.user = user;
        watch(user);
        countInvites();
        if (user) countOnline();
        else friends.hide();
      },
    });
    const auth = new AuthScreen({ onDone: (user) => badge.set(user) });
    const session = authApi.me(); // asked now, answered by the time "Entrer" is clicked
    new WelcomeScreen({
      onEnter: async () => {
        const res = await session;
        if (res.ok && res.user) badge.set(res.user);
        else auth.show('login');
      },
    });
  }

  // 1. Core Three.js setup
  const engine = new Engine('#canvas');

  // 2. Lights
  const lighting = new Lighting(engine.scene);
  lighting.setup();

  // 3. Asset loading (textures, models)
  const loader = new AssetLoader();

  // Show loading screen while assets are fetching
  const loadingEl = document.getElementById('loading-screen');

  try {
    await loader.preload();
  } catch (err) {
    console.error('Asset loading failed:', err);
    // Continue anyway — procedural fallbacks are used inside each class
  }

  // 4. Table
  const table = new Table(engine.scene, loader);
  await table.build();

  // 4a. Room
  const room = new Room(engine.scene);
  room.build();

  // 4b. Chairs
  const chairs = new Chairs(engine.scene, loader);
  await chairs.build();

  // 4c. Lamps
  const lamps = new Lamps(engine.scene, loader);
  await lamps.build();

  // 4d. Dealer — the cowboy behind the table
  const dealer = new Dealer(engine.scene, loader);
  await dealer.build();

  // 5. The "Nouvelle partie" card, on the felt in front of the dealer
  startCards = new StartCards(engine.scene, loader);
  startCards.buildAll(table.feltY);
  startCards.setInvites(invites);

  // 5b. The game: cards and chips on the felt, the player's controls, and the
  //     controller that runs PokerGame (back) on this table
  const tableCards  = new TableCards(engine.scene, engine.renderer, table.feltY);
  const tableChips = new TableChips({
    scene: engine.scene, camera: engine.camera, renderer: engine.renderer, feltY: table.feltY,
  });
  const actionBar = new ActionBar();
  const tableController = new TableController({
    cards: tableCards,
    chips: tableChips,
    actionBar,
    remote: !AI_DEBUG,
    onAchievements: (ids) => toast.show(ids),
  });
  tableCards.dealer = dealer; // cards leave the cowboy's hand
  // The raised cards rise under the player's labels (hand) or the pot's (board)
  tableCards.onLook = (kind, on) => (kind === 'hand' ? tableChips.clearLabels(0, on) : tableChips.clearPot(on));
  const opponents = new Opponents(engine.scene, loader); // AI characters on the chairs
  tableController.opponents = opponents;
  tableController.recorder = recorder;

  // The range chart (badge "📖 Ranges", pause menu); the AI's ranges need the bot
  const ranges = new RangeScreen({ getUser: () => recorder.user });
  window.addEventListener('ranges:open', () => ranges.show());
  if (AI_DEBUG) {
    tableCards.revealAll = true;
    const [{ AiDebugPanel }, { PokerBot }] = await Promise.all([
      import('./ui/AiDebugPanel.js'),
      import('../shared/ai/PokerBot.js'),
    ]);
    const panel = new AiDebugPanel(tableController, tableCards);
    tableController.onAiDecision = (seat, action, debug, street) => panel.record(seat, action, debug, street);

    // Debug only: the normal build never loads the bot or its strategy.
    PokerBot.load('/ai/mccfr/')
      .then((bot) => { tableController.bot = bot; })
      .catch((err) => console.warn('[AI] Debug strategy unavailable, fallback only:', err.message));
  }
  // All-in: the camera looks up at the cowboy while he fires at the ceiling
  // (cameraController is created further down, so build the zoom lazily)
  let showZoom = null;
  tableController.onAllIn = async () => {
    showZoom ??= new CameraMoves(cameraController);
    await showZoom.focus(dealer.showView);
    await dealer.celebrate();
    await showZoom.backToSeat(0);
  };
  // A shared (online) table: its waiting room shows over the table until the deal
  const waitingRoom = new WaitingRoom({
    onStart: () => tableController.startShared(),
    onInvite: () => window.dispatchEvent(new CustomEvent('friends:open')),
    onLeave: () => window.dispatchEvent(new CustomEvent('game:quit')),
  });
  tableController.onLobby = (state) => {
    sharedTableId = state.status === 'waiting' ? state.tableId : null;
    waitingRoom.update(state);
  };
  window.addEventListener('game:start', (e) => {
    startCards.setVisible(false);
    tableController.start(e.detail);
  });
  window.addEventListener('game:pause',  () => {
    tableCards.paused = tableChips.paused = dealer.paused = opponents.paused = true;
    tableController.pause();
  });
  window.addEventListener('game:resume', () => {
    tableCards.paused = tableChips.paused = dealer.paused = opponents.paused = false;
    tableController.resume();
  });
  window.addEventListener('game:quit',   () => {
    // Quitting happens from the pause menu: no game:resume follows, unfreeze here
    tableCards.paused = tableChips.paused = dealer.paused = opponents.paused = false;
    tableController.stop();
    waitingRoom.hide();
    sharedTableId = null;
    startCards.setVisible(true);
  });

  // 6. DustParticles
  const particles = new DustParticles(engine.scene);
  particles.init();

  // 7. Camera controls
  const cameraController = new CameraController(engine.camera, engine.renderer);
  cameraController.setup();

  // 8. Overlay / UI
  const overlay = new Overlay();
  new PauseMenu(); // top-left pause / quit, shown during a game

  // 9. Events (raycasting, click → flip → overlay)
  const tableInput = new TableInput({
    engine,
    startCards,
    tableCards,
    cameraController,
    overlay,
  });
  tableInput.init();

  // Hide loading screen
  loadingEl.classList.add('hidden');
  setTimeout(() => loadingEl.remove(), 1000);

  // 10. Render loop — ToonStyle last, so meshes created this frame get the cartoon look
  const toon = new ToonStyle(engine.camera, engine.renderer);
  engine.setUpdateCallback((delta) => {
    startCards.update(delta);
    tableCards.update(delta);
    tableChips.update(delta);
    dealer.update(delta);
    opponents.update(delta);
    particles.update(delta);
    lamps.update(delta);
    cameraController.update();
    toon.update(engine.scene);
  });

  // Dev only: handles for debugging from the console / automated screenshots
  if (import.meta.env.DEV) {
    window.__poker = { toon, opponents, engine, cameraController, tableCards, tableChips, tableController, table, dealer, tableInput, startCards };
  }

  engine.start();
}

init();
