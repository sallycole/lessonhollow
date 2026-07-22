/**
 * Forces a full document load. Use when the previous request mutated an httpOnly
 * cookie the next render must read (auth, masquerade), or when navigating
 * off-origin. router.push() does soft client-side nav that can re-use cached
 * Server Component output rendered with stale cookies — this won't.
 */
export function hardNavigate(href: string): void {
  window.location.href = href
}
