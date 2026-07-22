'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

export function StaleDeployHandler() {
  const reloadedRef = useRef(false)

  useEffect(() => {
    function handleError(event: ErrorEvent) {
      const msg = event.message || event.error?.message || ''
      if (
        !reloadedRef.current &&
        (msg.includes('Failed to find Server Action') ||
          msg.includes('failed to find server action'))
      ) {
        reloadedRef.current = true
        toast.info('Updating to the latest version...')
        setTimeout(() => window.location.reload(), 1500)
      }
    }

    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  return null
}
