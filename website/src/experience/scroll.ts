/** Scroll/focus helper shared by the journey HUD and captions. Lives in
 * its own module (not captions.tsx) so Vite Fast Refresh can hot-swap the
 * caption components — mixed component/function exports disable it. */

export function scrollToModules(): void {
  const el = document.getElementById("modules");
  if (!el) return;
  // land the module grid below the sticky header (measured live so it stays
  // right when the nav wraps to two rows on narrow widths), not tucked under
  // it — plus a little breathing room above the first card
  const header = document.querySelector(".site-header");
  const offset = (header?.getBoundingClientRect().height ?? 0) + 24;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  // keyboard users must land where they scrolled — otherwise the next Tab
  // snaps them back up to wherever focus was left behind
  el.focus({ preventScroll: true });
}
