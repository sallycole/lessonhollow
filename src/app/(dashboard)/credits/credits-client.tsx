'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { formatCentsUSD, TOPUP_OPTIONS } from '@/lib/pricing'
import { Loader2 } from 'lucide-react'
import { hardNavigate } from '@/lib/hard-navigate'
import type { CreditAccount } from '@/lib/credits'

interface Transaction {
  id: string
  type: 'deposit' | 'spend' | 'refund'
  amount_cents: number
  description: string
  created_at: string
}

const ROWS_PER_PAGE = 20

function getStatusLevel(enrollmentsRemaining: number): 'healthy' | 'low' | 'empty' {
  if (enrollmentsRemaining > 10) return 'healthy'
  if (enrollmentsRemaining >= 1) return 'low'
  return 'empty'
}

function isFreeEnrollmentTx(tx: Transaction): boolean {
  return tx.type === 'spend' && tx.amount_cents === 0
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

const TEST_TOPUP_OPTIONS = [{ amount_cents: 100, label: '$1 - 2 enrollments' }] as const

export function CreditsPageClient({
  account,
  transactions,
  enrollmentCostCents,
  showSuccess,
  freeEnrollmentsRemaining = 0,
  testMode = false,
}: {
  account: CreditAccount
  transactions: Transaction[]
  enrollmentCostCents: number
  showSuccess: boolean
  freeEnrollmentsRemaining?: number
  testMode?: boolean
}) {
  const [loading, setLoading] = useState<number | null>(null)
  const [highlight, setHighlight] = useState(false)
  const [visibleCount, setVisibleCount] = useState(ROWS_PER_PAGE)
  const enrollmentsRemaining = Math.floor(account.balance_cents / enrollmentCostCents)
  const totalEnrollmentsAvailable = enrollmentsRemaining + freeEnrollmentsRemaining
  const status = getStatusLevel(totalEnrollmentsAvailable)

  useEffect(() => {
    if (showSuccess) {
      toast.success(
        `Credits added! Your balance is now ${formatCentsUSD(account.balance_cents)}.`,
      )
      setHighlight(true)
      const timer = setTimeout(() => setHighlight(false), 2000)
      window.history.replaceState({}, '', '/credits')
      return () => clearTimeout(timer)
    }
  }, [showSuccess, account.balance_cents])

  async function handleTopup(amountCents: number) {
    setLoading(amountCents)
    try {
      const res = await fetch('/api/payments/create-topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: amountCents }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to start checkout')
        return
      }
      if (data.checkoutUrl) {
        hardNavigate(data.checkoutUrl)
      }
    } catch {
      toast.error('Failed to start checkout. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const visibleTx = transactions.slice(0, visibleCount)
  const hasMore = visibleCount < transactions.length
  const topupOptions = testMode ? TEST_TOPUP_OPTIONS : TOPUP_OPTIONS

  return (
    <>
      <hgroup>
        <h1>Manage Credits</h1>
        <p>Top up your balance and review enrollment activity.</p>
      </hgroup>
      <div className="credits-shell">
        <article
          className={`credits-balance ${highlight ? 'is-highlight' : ''} ${status === 'low' || status === 'empty' ? 'is-low' : ''}`.trim()}
        >
          <header>
            <h2>Credit Balance</h2>
          </header>
          <p className="balance-amount">{formatCentsUSD(account.balance_cents)}</p>
          <p className="balance-sub">
            {enrollmentsRemaining} enrollment{enrollmentsRemaining !== 1 ? 's' : ''} left
          </p>
          {freeEnrollmentsRemaining > 0 && (
            <p className="balance-free">
              {freeEnrollmentsRemaining === 1
                ? '✨ 1 free enrollment remaining (one per Player)'
                : `✨ ${freeEnrollmentsRemaining} free enrollments remaining (one per Player)`}
            </p>
          )}
        </article>

        <article className={`credits-topup ${status === 'empty' ? 'is-low' : ''}`.trim()}>
          <header>
            <h2>Add Credits</h2>
          </header>
          <div className="topup-grid">
            {topupOptions.map((opt) => (
              <button
                key={opt.amount_cents}
                type="button"
                className="outline"
                disabled={loading !== null}
                onClick={() => handleTopup(opt.amount_cents)}
                aria-busy={loading === opt.amount_cents}
              >
                <strong>
                  {loading === opt.amount_cents && <Loader2 size={14} />}
                  {formatCentsUSD(opt.amount_cents)}
                </strong>
                <small>
                  {Math.floor(opt.amount_cents / enrollmentCostCents)} enrollments
                </small>
              </button>
            ))}
          </div>
          <p className="topup-note">
            <small>Pay with a card, Google Pay, Cash App, or Lightning</small>
          </p>
        </article>

        <article className="credits-history">
          <header>
            <h2>Transaction History</h2>
          </header>
          {transactions.length === 0 ? (
            <div className="history-empty">
              <p style={{ fontSize: '2rem', margin: 0 }}>📋</p>
              <p>
                <small>No transactions yet. Your first enrollment is free!</small>
              </p>
            </div>
          ) : (
            <>
              <figure>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTx.map((tx) => (
                      <tr key={tx.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {formatDate(tx.created_at)}
                        </td>
                        <td>
                          {tx.type === 'deposit' && (
                            <span className="tx-badge tx-deposit">Deposit</span>
                          )}
                          {tx.type === 'spend' && isFreeEnrollmentTx(tx) && (
                            <span className="tx-badge tx-free">Free ✨</span>
                          )}
                          {tx.type === 'spend' && !isFreeEnrollmentTx(tx) && (
                            <span className="tx-badge tx-enrollment">Enrollment</span>
                          )}
                          {tx.type === 'refund' && (
                            <span className="tx-badge tx-refund">Refund</span>
                          )}
                        </td>
                        <td className="tx-desc">{tx.description}</td>
                        <td
                          className={`tx-amount${
                            tx.type === 'deposit' || tx.type === 'refund'
                              ? ' positive'
                              : ''
                          }${isFreeEnrollmentTx(tx) ? ' free' : ''}`}
                          style={{ textAlign: 'right', whiteSpace: 'nowrap' }}
                        >
                          {isFreeEnrollmentTx(tx)
                            ? formatCentsUSD(0)
                            : `${tx.type === 'deposit' || tx.type === 'refund' ? '+' : '−'}${formatCentsUSD(Math.abs(tx.amount_cents))}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </figure>
              {hasMore && (
                <p className="history-more">
                  <button
                    type="button"
                    className="outline"
                    onClick={() => setVisibleCount((c) => c + ROWS_PER_PAGE)}
                  >
                    Load more
                  </button>
                </p>
              )}
            </>
          )}
        </article>
      </div>
    </>
  )
}
