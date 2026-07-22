'use client'

import { useCallback, useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'

export function PageActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [text])

  const handleSaveMarkdown = useCallback(() => {
    const blob = new Blob([text], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lesson-hollow-curriculum-format.md'
    a.click()
    URL.revokeObjectURL(url)
  }, [text])

  return (
    <p className="help-page-actions">
      <button type="button" className="outline" onClick={handleCopy}>
        {copied ? <Check size={14} /> : <Copy size={14} />}{' '}
        {copied ? 'Copied' : 'Copy text'}
      </button>
      <button type="button" className="outline" onClick={handleSaveMarkdown}>
        <Download size={14} /> Save as Markdown
      </button>
      <a href="/lesson-hollow-template.csv" download role="button" className="outline">
        <Download size={14} /> Save CSV Template
      </a>
    </p>
  )
}
