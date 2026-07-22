'use server'

import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encryptPassword } from '@/lib/crypto'
import { generateApiKey } from '@/lib/mcp-auth'
import { clearMasquerade } from '@/lib/masquerade'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function getGuideUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  if (user.user_metadata?.role === 'player') return null
  return user.id
}

export async function updateProfile(data: {
  first_name: string
  last_name: string
  timezone: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role === 'player') {
    return { error: 'Not authenticated as a guide.' }
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      timezone: data.timezone,
    },
  })

  if (error) return { error: 'Failed to update profile.' }

  revalidatePath('/account')
  return {}
}

export async function changePassword(data: {
  currentPassword: string
  newPassword: string
}): Promise<{ error?: string }> {
  if (data.newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role === 'player') {
    return { error: 'Not authenticated as a guide.' }
  }

  // Verify current password by attempting sign-in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: data.currentPassword,
  })
  if (signInError) return { error: 'Current password is incorrect.' }

  const { error } = await supabase.auth.updateUser({
    password: data.newPassword,
  })

  if (error) return { error: 'Failed to update password.' }

  return {}
}

export async function updateFalApiKey(
  key: string
): Promise<{ error?: string }> {
  const guideId = await getGuideUserId()
  if (!guideId) return { error: 'Not authenticated as a guide.' }

  const trimmed = key.trim()
  if (!trimmed) return { error: 'API key is required.' }

  const { error } = await db.upsertUserApiKey({
    user_id: guideId,
    service: 'fal_ai',
    encrypted_key: encryptPassword(trimmed),
  })

  if (error) return { error: 'Failed to save API key.' }

  revalidatePath('/account')
  return {}
}

export async function deleteFalApiKey(): Promise<{ error?: string }> {
  const guideId = await getGuideUserId()
  if (!guideId) return { error: 'Not authenticated as a guide.' }

  const { error } = await db.deleteUserApiKey(guideId, 'fal_ai')
  if (error) return { error: 'Failed to remove API key.' }

  revalidatePath('/account')
  return {}
}

export async function generateMcpApiKey(): Promise<{
  fullKey?: string
  error?: string
}> {
  const guideId = await getGuideUserId()
  if (!guideId) return { error: 'Not authenticated as a guide.' }

  // Revoke any existing active keys (only one active key at a time)
  await db.revokeAllMcpApiKeys(guideId)

  const { fullKey, keyHash, keyPrefix } = generateApiKey()

  const { error } = await db.createMcpApiKey({
    key_hash: keyHash,
    key_prefix: keyPrefix,
    owner_type: 'guide',
    guide_id: guideId,
  })

  if (error) return { error: 'Failed to generate API key.' }

  revalidatePath('/account')
  return { fullKey }
}

export async function revokeMcpApiKey(
  keyId: string
): Promise<{ error?: string }> {
  const guideId = await getGuideUserId()
  if (!guideId) return { error: 'Not authenticated as a guide.' }

  const { error } = await db.revokeMcpApiKey(keyId, guideId)
  if (error) return { error: 'Failed to revoke API key.' }

  revalidatePath('/account')
  return {}
}

export async function getActiveApiKey(): Promise<{
  key?: {
    id: string
    key_prefix: string
    created_at: string
    last_used_at: string | null
  }
  error?: string
}> {
  const guideId = await getGuideUserId()
  if (!guideId) return { error: 'Not authenticated as a guide.' }

  const { data: keys } = await db.getActiveKeysByGuide(guideId)
  if (!keys?.length) return {}

  const key = keys[0]
  return {
    key: {
      id: key.id,
      key_prefix: key.key_prefix,
      created_at: key.created_at,
      last_used_at: key.last_used_at,
    },
  }
}

/**
 * Revoke parental consent: deletes all player sub-accounts and their data,
 * clears consent metadata on the guide account. Guide account remains active.
 */
export async function revokeConsent(
  confirmation: string
): Promise<{ error?: string }> {
  if (confirmation !== 'REVOKE') {
    return { error: 'Please type REVOKE to confirm.' }
  }

  const guideId = await getGuideUserId()
  if (!guideId) return { error: 'Not authenticated as a guide.' }

  // Clear masquerade if active (may be masquerading as a player about to be deleted)
  await clearMasquerade()

  // Delete all players, their data, and storage files
  const { authUserIds, error: deleteErr } =
    await db.deleteAllPlayersForGuide(guideId)
  if (deleteErr) return { error: 'Failed to delete player data. Please try again.' }

  // Delete each player's auth user
  const admin = createAdminClient()
  for (const authUserId of authUserIds) {
    await admin.auth.admin.deleteUser(authUserId)
  }

  // Clear parental consent metadata on the guide account
  await admin.auth.admin.updateUserById(guideId, {
    user_metadata: { parental_consent: false, parental_consent_at: null },
  })

  console.log(
    `[consent:revoke] guideId=${guideId} playersDeleted=${authUserIds.length} timestamp=${new Date().toISOString()}`
  )

  revalidatePath('/account')
  return {}
}

/**
 * Delete the guide's entire account: deletes all player data first,
 * then deletes the guide's own auth account. Redirects to homepage.
 */
export async function deleteAccount(
  confirmation: string
): Promise<{ error?: string }> {
  if (confirmation !== 'DELETE') {
    return { error: 'Please type DELETE to confirm.' }
  }

  const guideId = await getGuideUserId()
  if (!guideId) return { error: 'Not authenticated as a guide.' }

  // Clear masquerade if active
  await clearMasquerade()

  // Delete all players, their data, and storage files
  const { authUserIds, error: deleteErr } =
    await db.deleteAllPlayersForGuide(guideId)
  if (deleteErr) return { error: 'Failed to delete account data. Please try again.' }

  // Delete each player's auth user
  const admin = createAdminClient()
  for (const authUserId of authUserIds) {
    await admin.auth.admin.deleteUser(authUserId)
  }

  console.log(
    `[account:delete] guideId=${guideId} playersDeleted=${authUserIds.length} timestamp=${new Date().toISOString()}`
  )

  // Sign out the guide (clear session) before deleting their auth user
  const supabase = await createClient()
  await supabase.auth.signOut()

  // Delete the guide's auth user (cascades to guide-level DB records)
  await admin.auth.admin.deleteUser(guideId)

  redirect('/')
}
