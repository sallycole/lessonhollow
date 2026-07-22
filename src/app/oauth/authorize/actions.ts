'use server'

import { redirect } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { generateAuthorizationCode } from '@/lib/oauth/provider'

type ActionState = { error?: string }

export async function approveAuthorization(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const clientId = formData.get('client_id') as string
  const redirectUri = formData.get('redirect_uri') as string
  const codeChallenge = formData.get('code_challenge') as string
  const userId = formData.get('user_id') as string
  const state = formData.get('state') as string | null
  const scope = formData.get('scope') as string | null

  if (!clientId || !redirectUri || !codeChallenge || !userId) {
    return { error: 'Missing required parameters.' }
  }

  try {
    const code = await generateAuthorizationCode({
      clientId,
      userId,
      redirectUri,
      codeChallenge,
      scopes: scope ? scope.split(' ') : ['mcp'],
      state: state ?? undefined,
    })

    const url = new URL(redirectUri)
    url.searchParams.set('code', code)
    if (state) url.searchParams.set('state', state)

    redirect(url.toString())
  } catch (err) {
    if (isRedirectError(err)) throw err
    return { error: err instanceof Error ? err.message : 'Failed to generate authorization code.' }
  }
}

export async function denyAuthorization(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const redirectUri = formData.get('redirect_uri') as string
  const state = formData.get('state') as string | null

  if (!redirectUri) {
    return { error: 'Missing redirect_uri.' }
  }

  const url = new URL(redirectUri)
  url.searchParams.set('error', 'access_denied')
  if (state) url.searchParams.set('state', state)

  redirect(url.toString())
}
