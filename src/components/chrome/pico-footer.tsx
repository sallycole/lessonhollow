import Link from 'next/link'
import { FeedbackButton } from '@/components/feedback-modal'

export function PicoFooter() {
  return (
    <footer className="site-footer container">
      <p>
        <small>&copy; {new Date().getFullYear()} Lesson Hollow</small>
      </p>
      <nav aria-label="Footer navigation">
        <ul>
          <li>
            <Link href="/help">Help</Link>
          </li>
          <li>
            <Link href="/privacy">Privacy</Link>
          </li>
          <li>
            <Link href="/terms">Terms</Link>
          </li>
          <li>
            <FeedbackButton asLink />
          </li>
        </ul>
      </nav>
    </footer>
  )
}
