// Pico chrome and the main container live in the root layout — this layout
// just passes children through. Kept as a file so the (player) route group
// remains explicit; can be deleted in Phase 6 if no per-player layout work
// shows up.
export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
