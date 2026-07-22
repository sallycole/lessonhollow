import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { clientsStore } from '@/lib/oauth/clients-store'
import { ConsentForm } from './consent-form'

type Props = {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function OAuthAuthorizePage({ searchParams }: Props) {
  const params = await searchParams
  const {
    client_id,
    redirect_uri,
    response_type,
    code_challenge,
    code_challenge_method,
    state,
    scope,
  } = params

  if (!client_id || !redirect_uri || !code_challenge) {
    return (
      <ErrorPage message="Missing required parameters: client_id, redirect_uri, and code_challenge are required." />
    )
  }
  if (response_type !== 'code') {
    return <ErrorPage message="Unsupported response_type. Only 'code' is supported." />
  }
  if (code_challenge_method && code_challenge_method !== 'S256') {
    return <ErrorPage message="Unsupported code_challenge_method. Only S256 is supported." />
  }

  const client = await clientsStore.getClient(client_id)
  if (!client) {
    return <ErrorPage message="Unknown client_id." />
  }

  const registeredUris = (client.redirect_uris ?? []).map((u) => String(u))
  if (!registeredUris.includes(redirect_uri)) {
    return <ErrorPage message="redirect_uri does not match any registered URIs for this client." />
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const currentUrl = new URL(
      '/oauth/authorize',
      process.env.NEXT_PUBLIC_SITE_URL || 'https://lessonhollow.com',
    )
    for (const [key, value] of Object.entries(params)) {
      if (value) currentUrl.searchParams.set(key, value)
    }
    redirect(`/login?redirectTo=${encodeURIComponent(currentUrl.pathname + currentUrl.search)}`)
  }

  const clientName = client.client_name || client_id

  return (
    <ConsentForm
      clientName={clientName}
      clientId={client_id}
      redirectUri={redirect_uri}
      codeChallenge={code_challenge}
      state={state}
      scope={scope}
      userId={user.id}
    />
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <article className="oauth-card">
      <hgroup>
        <h1>Authorization Error</h1>
        <p>{message}</p>
      </hgroup>
    </article>
  )
}
