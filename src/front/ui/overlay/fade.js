/**
 * fade.js — UI fade-in / fade-out helpers
 *
 * Pure DOM-based transitions used by Overlay.js and Panel.js.
 * No external dependencies — uses CSS transitions and requestAnimationFrame.
 */

/**
 * Fade an element in over `duration` ms.
 * The element must have `opacity: 0` and `transition: opacity Xms` in CSS,
 * or this function sets them programmatically.
 *
 * @param {HTMLElement} el
 * @param {number}      [duration=300]  ms
 * @returns {Promise<void>}  resolves when the transition ends
 */
export function fadeIn(el, duration = 300) {
  return new Promise((resolve) => {
    el.style.transition = `opacity ${duration}ms ease`;
    el.style.opacity    = '0';
    el.style.display    = el.style.display === 'none' ? 'block' : el.style.display;
    el.style.pointerEvents = 'auto';

    // Force reflow so the browser registers the starting opacity
    // eslint-disable-next-line no-unused-expressions
    el.offsetHeight;

    el.style.opacity = '1';

    const onEnd = () => {
      el.removeEventListener('transitionend', onEnd);
      resolve();
    };
    el.addEventListener('transitionend', onEnd);
  });
}

/**
 * Fade an element out over `duration` ms, then set display:none.
 *
 * @param {HTMLElement} el
 * @param {number}      [duration=300] ms
 * @returns {Promise<void>}
 */
export function fadeOut(el, duration = 300) {
  return new Promise((resolve) => {
    el.style.transition = `opacity ${duration}ms ease`;
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';

    const onEnd = () => {
      el.removeEventListener('transitionend', onEnd);
      el.style.display = 'none';
      resolve();
    };
    el.addEventListener('transitionend', onEnd);
  });
}
