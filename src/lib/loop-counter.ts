/**
 * Pure function to count the number of fully completed loops for a memorization enrollment.
 *
 * A loop N is "complete" when every non-permanently-skipped task has been completed in that loop.
 * Permanently skipped = skipped in ANY loop (once skipped, excluded from all future loops).
 * Loops must be consecutive starting from 1.
 */
export function countCompletedLoops(
  totalTasks: number,
  playerTasks: Array<{ task_id: string; status: string; loop_number: number }>
): number {
  if (totalTasks === 0 || playerTasks.length === 0) return 0

  // Find permanently skipped task IDs (skipped in ANY loop)
  const permanentlySkipped = new Set<string>()
  for (const pt of playerTasks) {
    if (pt.status === 'skipped') {
      permanentlySkipped.add(pt.task_id)
    }
  }

  const effectiveTaskCount = totalTasks - permanentlySkipped.size
  if (effectiveTaskCount <= 0) return 0

  // Count completed (non-skipped) tasks per loop
  const completedPerLoop = new Map<number, number>()
  for (const pt of playerTasks) {
    if (pt.status === 'completed' && !permanentlySkipped.has(pt.task_id)) {
      completedPerLoop.set(pt.loop_number, (completedPerLoop.get(pt.loop_number) ?? 0) + 1)
    }
  }

  // Count consecutive completed loops starting from 1
  const maxLoop = completedPerLoop.size > 0 ? Math.max(...completedPerLoop.keys()) : 0
  let completedLoops = 0
  for (let loop = 1; loop <= maxLoop; loop++) {
    if ((completedPerLoop.get(loop) ?? 0) >= effectiveTaskCount) {
      completedLoops++
    } else {
      break
    }
  }

  return completedLoops
}
