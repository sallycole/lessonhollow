'use client'

import { useEffect, useState, useTransition } from 'react'
import { generateMcpApiKey, revokeMcpApiKey, getActiveApiKey } from './actions'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'

type ActiveKey = {
  id: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
}

export function McpApiKeyCard() {
  const [activeKey, setActiveKey] = useState<ActiveKey | null>(null)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getActiveApiKey().then((result) => {
      if (result.key) setActiveKey(result.key)
      setLoading(false)
    })
  }, [])

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateMcpApiKey()
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.fullKey) {
        setNewKey(result.fullKey)
        const refreshed = await getActiveApiKey()
        if (refreshed.key) setActiveKey(refreshed.key)
        toast.success('API key generated.')
      }
    })
  }

  function handleRevoke() {
    if (!activeKey) return
    startTransition(async () => {
      const result = await revokeMcpApiKey(activeKey.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setActiveKey(null)
      setNewKey(null)
      toast.success('API key revoked.')
    })
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard.')
    })
  }

  const setupCommand = newKey
    ? `claude mcp add lessonhollow --transport http ${typeof window !== 'undefined' ? window.location.origin : 'https://lessonhollow.com'}/api/mcp -H "Authorization: Bearer ${newKey}"`
    : null

  if (loading) {
    return (
      <article className="account-card">
        <header>
          <hgroup>
            <h2>MCP API Key</h2>
            <p>Connect an MCP-compatible client such as Claude Code to Lesson Hollow.</p>
          </hgroup>
        </header>
        <p>
          <small>Loading…</small>
        </p>
      </article>
    )
  }

  if (!activeKey && !newKey) {
    return (
      <article className="account-card">
        <header>
          <hgroup>
            <h2>MCP API Key</h2>
            <p>Connect an MCP-compatible client such as Claude Code to Lesson Hollow.</p>
          </hgroup>
          <button
            type="button"
            className="outline"
            onClick={handleGenerate}
            disabled={isPending}
          >
            Generate
          </button>
        </header>
      </article>
    )
  }

  return (
    <article className="account-card">
      <header>
        <hgroup>
          <h2>MCP API Key</h2>
          <p>Connect an MCP-compatible client such as Claude Code to Lesson Hollow.</p>
        </hgroup>
      </header>

      {newKey && (
        <div className="key-callout">
          <strong>Save this key — you won&apos;t be able to see it again.</strong>
          <div className="code-row">
            <code>{newKey}</code>
            <button
              type="button"
              className="outline"
              onClick={() => copyToClipboard(newKey)}
              aria-label="Copy key"
            >
              <Copy size={14} />
            </button>
          </div>
          {setupCommand && (
            <>
              <small>Setup command:</small>
              <div className="code-row">
                <code>{setupCommand}</code>
                <button
                  type="button"
                  className="outline"
                  onClick={() => copyToClipboard(setupCommand)}
                  aria-label="Copy setup command"
                >
                  <Copy size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeKey && !newKey && (
        <>
          <div className="field-readonly">
            <div>
              <small>Key</small>
              <p>
                <code>{activeKey.key_prefix}…</code>
              </p>
            </div>
            <div>
              <small>Created</small>
              <p>
                {new Date(activeKey.created_at).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            {activeKey.last_used_at && (
              <div>
                <small>Last used</small>
                <p>
                  {new Date(activeKey.last_used_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>
          <div className="inline-row" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="outline"
              onClick={handleGenerate}
              disabled={isPending}
            >
              Regenerate
            </button>
            <button
              type="button"
              className="outline contrast"
              onClick={handleRevoke}
              disabled={isPending}
            >
              Revoke
            </button>
          </div>
        </>
      )}
    </article>
  )
}
