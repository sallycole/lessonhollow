// Pico chrome lives in the root layout now; /today's layout only adds the
// page-specific CSS rules used by the today body (stat cards, task cards).

export default function TodayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
