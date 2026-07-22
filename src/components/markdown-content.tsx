'use client'

import { useEffect, useRef } from 'react'
import { marked } from 'marked'

/**
 * Renders markdown as HTML inside a div. Email-obfuscation spans
 * (`<span class="eml" data-u="..." data-d="...">`) get rewritten as
 * proper mailto links on the client.
 *
 * Pass `className` only if you need additional styling — by default no
 * class is applied so Pico's element selectors (h1, h2, p, ul, etc.)
 * style the rendered content directly.
 */
export function MarkdownContent({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  const html = marked.parse(content, { async: false }) as string
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.querySelectorAll<HTMLSpanElement>('.eml').forEach((span) => {
      const u = span.dataset.u
      const d = span.dataset.d
      if (!u || !d) return
      const link = document.createElement('a')
      link.href = `mailto:${u}@${d}`
      link.textContent = `${u}@${d}`
      span.replaceWith(link)
    })
  }, [html])

  return (
    <div
      ref={ref}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
