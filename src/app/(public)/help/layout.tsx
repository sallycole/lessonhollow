import { HelpNav } from './help-nav'

export default function HelpLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="help-shell">
      <aside>
        <HelpNav />
      </aside>
      <article>{children}</article>
    </div>
  )
}
