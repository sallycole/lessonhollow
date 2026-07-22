import { Eye } from 'lucide-react'
import { getMasqueradeContext } from '@/lib/masquerade'
import { PicoMasqueradeExit } from './pico-masquerade-exit'

export async function PicoMasquerade() {
  const masquerade = await getMasqueradeContext()
  if (!masquerade) return null

  return (
    <aside className="masquerade-banner" role="status">
      <span>
        <Eye size={16} aria-hidden="true" /> Viewing as {masquerade.playerName}
      </span>
      <PicoMasqueradeExit />
    </aside>
  )
}
