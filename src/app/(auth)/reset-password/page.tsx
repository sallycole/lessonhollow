import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ResetPasswordForm } from './reset-password-form'

export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <TokenError message="This password reset link is invalid or has expired." />
  }

  return <ResetPasswordForm />
}

function TokenError({ message }: { message: string }) {
  return (
    <article className="auth-card">
      <hgroup>
        <h1>Unable to reset password</h1>
        <p>{message}</p>
      </hgroup>

      <p>
        <Link href="/forgot-password" role="button" style={{ width: '100%' }}>
          Request a new reset link
        </Link>
      </p>

      <footer>
        <Link href="/login">Back to login</Link>
      </footer>
    </article>
  )
}
