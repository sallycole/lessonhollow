'use client'

import { useState, useTransition } from 'react'
import {
  toggleShowRewards,
  updateTasksBetweenRewards,
} from '@/app/(player)/rewards/actions'
import { updateFalApiKey, deleteFalApiKey } from './actions'
import { toast } from 'sonner'

interface RewardsCardProps {
  initialEnabled: boolean
  initialTasksBetweenRewards: number
  hasFalKey: boolean
}

export function RewardsToggleCard({
  initialEnabled,
  initialTasksBetweenRewards,
  hasFalKey,
}: RewardsCardProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [tasksValue, setTasksValue] = useState(String(initialTasksBetweenRewards))
  const [savedValue, setSavedValue] = useState(initialTasksBetweenRewards)
  const [isPending, startTransition] = useTransition()
  const [isSavingTasks, startSavingTasks] = useTransition()
  const [hasKey, setHasKey] = useState(hasFalKey)
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [keyValue, setKeyValue] = useState('')
  const [isKeyPending, startKeyTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleShowRewards()
      if (result.error) {
        toast.error(result.error)
        return
      }
      setEnabled(result.enabled ?? !enabled)
      toast.success(result.enabled ? 'Rewards tab enabled.' : 'Rewards tab hidden.')
    })
  }

  function saveTasksValue() {
    const num = parseInt(tasksValue, 10)
    if (isNaN(num) || num < 1 || num > 100) {
      toast.error('Must be a number between 1 and 100.')
      setTasksValue(String(savedValue))
      return
    }
    if (num === savedValue) return
    startSavingTasks(async () => {
      const result = await updateTasksBetweenRewards(num)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setSavedValue(result.value ?? num)
      toast.success('Tasks between rewards updated.')
    })
  }

  function handleSaveKey() {
    if (!keyValue.trim()) {
      toast.error('API key is required.')
      return
    }
    startKeyTransition(async () => {
      const result = await updateFalApiKey(keyValue)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setHasKey(true)
      setShowKeyInput(false)
      setKeyValue('')
      toast.success('fal.ai API key saved.')
    })
  }

  function handleRemoveKey() {
    startKeyTransition(async () => {
      const result = await deleteFalApiKey()
      if (result.error) {
        toast.error(result.error)
        return
      }
      setHasKey(false)
      toast.success('fal.ai API key removed.')
    })
  }

  return (
    <article className="account-card">
      <header>
        <hgroup>
          <h2>Rewards</h2>
          <p>AI-generated rewards for completing tasks.</p>
        </hgroup>
      </header>

      <div className="account-grid">
        <div className="label-cell">
          <strong>Show Rewards tab:</strong>
        </div>
        <div className="control-cell switch-row">
          <label>
            <input
              type="checkbox"
              role="switch"
              checked={enabled}
              onChange={handleToggle}
              disabled={isPending}
            />
            {enabled ? 'Yes' : 'No'}
          </label>
        </div>

        <div className="label-cell">
          <strong>Tasks between rewards:</strong>
          <small>Choose a number between 1 and 100.</small>
        </div>
        <div className="control-cell">
          <input
            type="text"
            inputMode="numeric"
            value={tasksValue}
            onChange={(e) => setTasksValue(e.target.value)}
            onBlur={saveTasksValue}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTasksValue()
            }}
            disabled={isSavingTasks}
            aria-label="Tasks between rewards"
          />
        </div>
      </div>

      <div className="section-divider">
        <p>
          <strong>fal.ai API key:</strong> Get a key from{' '}
          <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noopener noreferrer">
            fal.ai
          </a>
          . Without a key, digital rewards cannot be generated.
        </p>

        {showKeyInput ? (
          <div className="inline-row">
            <input
              type="password"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder="Enter fal.ai API key"
              disabled={isKeyPending}
            />
            <button
              type="button"
              onClick={handleSaveKey}
              disabled={isKeyPending}
              aria-busy={isKeyPending}
            >
              {isKeyPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setShowKeyInput(false)
                setKeyValue('')
              }}
              disabled={isKeyPending}
            >
              Cancel
            </button>
          </div>
        ) : hasKey ? (
          <div className="inline-row">
            <button
              type="button"
              className="outline"
              onClick={() => setShowKeyInput(true)}
              disabled={isKeyPending}
            >
              Replace
            </button>
            <button
              type="button"
              className="outline contrast"
              onClick={handleRemoveKey}
              disabled={isKeyPending}
            >
              Remove
            </button>
          </div>
        ) : (
          <button type="button" className="outline" onClick={() => setShowKeyInput(true)}>
            Add Key
          </button>
        )}
      </div>
    </article>
  )
}
