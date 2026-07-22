/**
 * Generate CSV content from curriculum data in the same format as the import.
 *
 * Format:
 *   Name,<value>
 *   Description,<value>
 *   Publisher,<value>
 *   Grade Level,<value>
 *   Link,<value>
 *
 *   Title,Description,Action,URL
 *   <task rows...>
 *
 * Fields are quoted per RFC 4180 when they contain commas, quotes, or newlines.
 * Output is UTF-8 with BOM for Excel compatibility.
 */

export interface ExportCurriculum {
  name: string
  description?: string | null
  resource_url?: string | null
  publisher?: string | null
  grade_level?: string | null
}

export interface ExportTask {
  title: string
  description?: string | null
  action_type: string
  resource_url?: string | null
}

/** UTF-8 BOM for Excel compatibility */
export const UTF8_BOM = '\uFEFF'

/**
 * Quote a CSV field per RFC 4180.
 * Wraps in double quotes if the value contains commas, double quotes, or newlines.
 */
function quoteField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

/**
 * Generate CSV content from a curriculum and its tasks.
 * Returns the CSV string (without BOM — caller adds BOM if needed).
 */
export function generateCsv(curriculum: ExportCurriculum, tasks: ExportTask[]): string {
  const lines: string[] = []

  // Metadata section
  lines.push(`Name,${quoteField(curriculum.name)}`)
  lines.push(`Description,${quoteField(curriculum.description ?? '')}`)
  lines.push(`Publisher,${quoteField(curriculum.publisher ?? '')}`)
  lines.push(`Grade Level,${quoteField(curriculum.grade_level ?? '')}`)
  lines.push(`Link,${quoteField(curriculum.resource_url ?? '')}`)

  // Blank separator
  lines.push('')

  // Task header
  lines.push('Title,Description,Action,URL')

  // Task rows in sort order (caller provides them pre-sorted)
  for (const task of tasks) {
    const row = [
      quoteField(task.title),
      quoteField(task.description ?? ''),
      quoteField(task.action_type),
      quoteField(task.resource_url ?? ''),
    ]
    lines.push(row.join(','))
  }

  return lines.join('\r\n') + '\r\n'
}

/**
 * Sanitize a curriculum name for use as a filename.
 * Removes special characters, limits length, and replaces spaces with hyphens.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .toLowerCase() || 'curriculum'
}
