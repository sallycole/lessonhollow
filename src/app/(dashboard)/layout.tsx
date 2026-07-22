// Pico chrome and the main container live in the root layout — this layout
// just passes children through.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
