/** Phones and tablets: a coarse pointer and touch. `?touch=1` forces the touch UI on a desktop. */
export const isTouch =
  new URLSearchParams(location.search).has('touch') ||
  (matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0);

if (isTouch) document.documentElement.classList.add('touch');

/** Go fullscreen and landscape where the browser allows it (Android; iOS ignores it). */
export function goFullscreen() {
  if (!isTouch || document.fullscreenElement) return;
  const el = document.documentElement;
  el.requestFullscreen?.({ navigationUI: 'hide' })
    .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
    .catch(() => {});
}
