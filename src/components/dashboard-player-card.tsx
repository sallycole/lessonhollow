'use client'

import Link from 'next/link'
import { AlertTriangle, Clock, Compass } from 'lucide-react'
import { DotPlot } from '@/components/dot-plot'
import { hardNavigate } from '@/lib/hard-navigate'
import type { PacingStatus } from '@/lib/daily-goal'

export interface EnrollmentRow {
  enrollmentId: string
  curriculumName: string
  completionPercent: number
  status: PacingStatus
  tasksDelta: number
  completionDates: string[]
  completionStatuses: string[]
  startDate: string
}

export interface DashboardPlayerData {
  playerId: string
  playerName: string
  timeZone: string
  activeEnrollments: EnrollmentRow[]
  rollupStatus: PacingStatus
  totalBehind: number
  curriculumCount?: number
  enrollmentCount?: number
  isGuidePlayer?: boolean
}

function StatusText({ status, tasksDelta }: { status: PacingStatus; tasksDelta: number }) {
  switch (status) {
    case 'behind':
    case 'overdue':
      return (
        <span className="status-behind">
          {Math.abs(tasksDelta)} task{Math.abs(tasksDelta) !== 1 ? 's' : ''} behind
        </span>
      )
    case 'on-track':
      return <span className="status-on-track">On track</span>
    case 'ahead':
      return <span className="status-ahead">Ahead</span>
    case 'ongoing':
      return <span className="status-ongoing">Ongoing</span>
  }
}

export function DashboardPlayerCard({
  player,
  isFirstTimeGuide,
}: {
  player: DashboardPlayerData
  isFirstTimeGuide?: boolean
}) {
  const hasEnrollments = player.activeEnrollments.length > 0
  const isBehind = player.rollupStatus === 'behind' || player.rollupStatus === 'overdue'

  async function handleMasquerade() {
    await fetch(`/api/auth/masquerade?player=${player.playerId}`, { method: 'POST' })
    hardNavigate('/today')
  }

  // First-time Guide's own card: prominent with full explanation
  if (!hasEnrollments && isFirstTimeGuide && player.isGuidePlayer) {
    return (
      <article className="player-card first-time-guide">
        <div className="icon-row">
          <span className="player-icon" aria-hidden="true">
            <Compass size={20} />
          </span>
          <hgroup>
            <h2>Set up your first curriculum</h2>
            <p>
              {player.curriculumCount ?? 0} curriculum
              {(player.curriculumCount ?? 0) !== 1 ? 's' : ''} and{' '}
              {player.enrollmentCount ?? 0} enrollment
              {(player.enrollmentCount ?? 0) !== 1 ? 's' : ''} so far.
            </p>
          </hgroup>
        </div>
        <div className="player-body">
          <p>
            You have a Guide view and a Player view, which are always accessible
            from the view switcher in the top-right corner of this site. To set up
            curriculums and enrollments for yourself, enter your own Player view.
            To set up curriculums and enrollments for someone else, set them up as
            a Player and enter their view.
          </p>
        </div>
        <div className="player-actions">
          <Link href="/players" role="button" className="outline">
            Manage Players
          </Link>
          <button type="button" className="outline" onClick={handleMasquerade}>
            {player.playerName.length > 20
              ? 'Open your Player view'
              : `Open ${player.playerName}'s view`}
          </button>
        </div>
      </article>
    )
  }

  // Past first-time empty player: simple card
  if (!hasEnrollments) {
    return (
      <article className="player-card standard">
        <header>
          <div className="player-id">
            <h2>
              <button type="button" className="player-name" onClick={handleMasquerade}>
                {player.playerName}
              </button>
            </h2>
          </div>
        </header>
        <div className="player-body">
          <p className="player-meta">
            {player.curriculumCount ?? 0} curriculum
            {(player.curriculumCount ?? 0) !== 1 ? 's' : ''} and{' '}
            {player.enrollmentCount ?? 0} enrollment
            {(player.enrollmentCount ?? 0) !== 1 ? 's' : ''}.
          </p>
        </div>
        <div className="player-actions">
          <button type="button" className="outline" onClick={handleMasquerade}>
            {player.playerName.length > 20
              ? 'Open Player view'
              : `Open ${player.playerName}'s view`}
          </button>
        </div>
      </article>
    )
  }

  // Standard card with enrollments
  return (
    <article className="player-card standard">
      <header>
        <div className="player-id">
          <h2>
            <button type="button" className="player-name" onClick={handleMasquerade}>
              {player.playerName}
            </button>
          </h2>
        </div>
        {isBehind && (
          <span className="behind-badge">
            {player.rollupStatus === 'overdue' ? <Clock size={14} /> : <AlertTriangle size={14} />}
            {player.totalBehind} task{player.totalBehind !== 1 ? 's' : ''} behind
          </span>
        )}
      </header>
      <p className="player-meta">
        {player.activeEnrollments.length} active enrollment
        {player.activeEnrollments.length !== 1 ? 's' : ''}
      </p>
      <div className="enrollment-list">
        {player.activeEnrollments.map((enrollment) => (
          <div key={enrollment.enrollmentId} className="enrollment-row">
            <span className="curriculum-name">{enrollment.curriculumName}</span>
            <div className="enrollment-meta">
              <span className="enrollment-meta-item">
                <span>Completion:</span>
                <span>{enrollment.completionPercent}%</span>
              </span>
              <span className="enrollment-meta-item">
                <span>Status:</span>
                <StatusText status={enrollment.status} tasksDelta={enrollment.tasksDelta} />
              </span>
            </div>
            <DotPlot
              completionDates={enrollment.completionDates}
              completionStatuses={enrollment.completionStatuses}
              startDate={enrollment.startDate}
              enrollmentId={enrollment.enrollmentId}
              timeZone={player.timeZone}
            />
          </div>
        ))}
      </div>
    </article>
  )
}

export function DashboardWelcomeCard() {
  return (
    <article className="player-card welcome">
      <div className="icon-row">
        <span className="player-icon" aria-hidden="true">
          <Compass size={20} />
        </span>
        <hgroup>
          <h2>Welcome to Lesson Hollow</h2>
          <p>Add your first Player to start building a learning path.</p>
        </hgroup>
      </div>
      <div className="player-actions">
        <Link href="/players" role="button">
          Manage Players
        </Link>
      </div>
    </article>
  )
}
