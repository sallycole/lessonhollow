'use client'

import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'

interface CreationMethodTabsProps {
  manualForm: ReactNode
  csvUpload: ReactNode
}

export function CreationMethodTabs({
  manualForm,
  csvUpload,
}: CreationMethodTabsProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [method, setMethod] = useState<'manual' | 'csv'>(
    tabParam === 'csv' ? 'csv' : 'manual'
  )

  return (
    <div className="creation-method">
      <nav className="creation-method-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={method === 'manual'}
          className={method === 'manual' ? '' : 'secondary'}
          onClick={() => setMethod('manual')}
        >
          Manual Entry
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={method === 'csv'}
          className={method === 'csv' ? '' : 'secondary'}
          onClick={() => setMethod('csv')}
        >
          Upload CSV
        </button>
      </nav>

      <div className="creation-method-panels">
        <div
          role="tabpanel"
          aria-hidden={method !== 'manual'}
          inert={method !== 'manual'}
          hidden={method !== 'manual'}
        >
          {manualForm}
        </div>
        <div
          role="tabpanel"
          aria-hidden={method !== 'csv'}
          inert={method !== 'csv'}
          hidden={method !== 'csv'}
        >
          {csvUpload}
        </div>
      </div>
    </div>
  )
}
