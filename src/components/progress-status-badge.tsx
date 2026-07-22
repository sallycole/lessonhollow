import { CheckCircle2, TrendingUp, CircleCheck, AlertTriangle, Clock } from 'lucide-react'
import type { ProgressStatusResult } from '@/lib/progress-status'

const STATUS_CONFIG: Record<
  string,
  { label: string; Icon: React.ComponentType<{ size?: number }> }
> = {
  complete: { label: 'Complete', Icon: CheckCircle2 },
  ahead: { label: 'Ahead', Icon: TrendingUp },
  on_track: { label: 'On track', Icon: CircleCheck },
  behind: { label: 'Behind', Icon: AlertTriangle },
  overdue: { label: 'Overdue', Icon: Clock },
}

export function ProgressStatusBadge({
  progressStatus,
}: {
  progressStatus: ProgressStatusResult
}) {
  const config = STATUS_CONFIG[progressStatus.status]
  if (!config) return null

  const { label, Icon } = config

  return (
    <span className="progress-status-badge" data-status={progressStatus.status}>
      <Icon size={12} />
      {label}
    </span>
  )
}
