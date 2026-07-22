import { ACTION_TYPES, GRADE_LEVELS, type ActionType } from './constants'

/** Metadata extracted from CSV header rows */
export interface CsvCurriculumMeta {
  name?: string
  description?: string
  resource_url?: string
  publisher?: string
  grade_level?: string
}

/** A single task row parsed from the CSV */
export interface CsvTask {
  title: string
  description?: string
  action_type: ActionType
  resource_url?: string
}

/** A validation error with row reference */
export interface CsvError {
  row: number
  field: string
  message: string
}

/** Result of parsing a CSV file */
export interface CsvParseResult {
  curriculum: CsvCurriculumMeta
  tasks: CsvTask[]
  errors: CsvError[]
}

const META_KEYS: Record<string, keyof CsvCurriculumMeta> = {
  name: 'name',
  description: 'description',
  link: 'resource_url',
  'resource url': 'resource_url',
  publisher: 'publisher',
  'grade level': 'grade_level',
}

const TASK_HEADER_KEYS = ['title', 'description', 'action', 'url']

/**
 * Parse a single CSV line respecting RFC 4180 quoting.
 * Fields may be wrapped in double quotes; embedded quotes are doubled ("").
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let i = 0
  while (i <= line.length) {
    if (i === line.length) {
      fields.push('')
      break
    }
    if (line[i] === '"') {
      // Quoted field
      let value = ''
      i++ // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            value += '"'
            i += 2
          } else {
            i++ // skip closing quote
            break
          }
        } else {
          value += line[i]
          i++
        }
      }
      fields.push(value.trim())
      if (i < line.length && line[i] === ',') i++ // skip delimiter
    } else {
      // Unquoted field
      const commaIdx = line.indexOf(',', i)
      if (commaIdx === -1) {
        fields.push(line.slice(i).trim())
        break
      } else {
        fields.push(line.slice(i, commaIdx).trim())
        i = commaIdx + 1
      }
    }
  }
  return fields
}

/**
 * Detect whether a row is the task header row.
 * The task header row has "Title" in the first column (case-insensitive).
 */
function isTaskHeaderRow(fields: string[]): boolean {
  if (fields.length === 0) return false
  const first = fields[0].toLowerCase()
  return first === 'title' && fields.length >= 2
}

/**
 * Check if a row looks like a metadata key-value pair.
 * Metadata rows have a known key in column A and a value in column B.
 */
function getMetaKey(fields: string[]): keyof CsvCurriculumMeta | null {
  if (fields.length < 2) return null
  const key = fields[0].toLowerCase()
  return META_KEYS[key] ?? null
}

/**
 * Normalize an action type string (case-insensitive).
 * Returns the canonical ActionType or null if invalid.
 */
function normalizeActionType(raw: string): ActionType | null {
  const lower = raw.toLowerCase()
  const match = ACTION_TYPES.find((t) => t.toLowerCase() === lower)
  return match ?? null
}

/**
 * Parse CSV content into curriculum metadata and tasks.
 *
 * Expected format:
 *   Header section: key-value rows (Name, Description, Publisher, Grade Level, Link/Resource URL)
 *   Task header: Title, Description, Action, URL
 *   Task rows: one per line after the task header
 *
 * Empty rows are skipped. Action type validation is case-insensitive.
 */
export function parseCsv(content: string): CsvParseResult {
  const curriculum: CsvCurriculumMeta = {}
  const tasks: CsvTask[] = []
  const errors: CsvError[] = []

  // Normalize line endings
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  let inTaskSection = false
  const taskColumnMap: Record<string, number> = {}

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const rowNum = i + 1

    // Skip empty lines
    if (line.trim() === '') continue

    const fields = parseCsvLine(line)

    // Skip rows where all fields are empty
    if (fields.every((f) => f === '')) continue

    if (!inTaskSection) {
      // Check if this is the task header row
      if (isTaskHeaderRow(fields)) {
        inTaskSection = true
        // Map column positions from the header
        fields.forEach((f, idx) => {
          const lower = f.toLowerCase()
          if (TASK_HEADER_KEYS.includes(lower)) {
            taskColumnMap[lower] = idx
          }
        })
        continue
      }

      // Try to parse as metadata
      const metaKey = getMetaKey(fields)
      if (metaKey) {
        const value = fields[1]
        if (metaKey === 'grade_level') {
          // Validate grade level
          const valid = (GRADE_LEVELS as readonly string[]).includes(value)
          if (value && !valid) {
            errors.push({
              row: rowNum,
              field: 'Grade Level',
              message: `"${value}" is not a valid grade level. Expected: ${GRADE_LEVELS.join(', ')}`,
            })
          } else {
            curriculum[metaKey] = value
          }
        } else {
          curriculum[metaKey] = value
        }
      }
      // Unrecognized rows in header section are silently skipped
    } else {
      // Task data row
      const titleIdx = taskColumnMap['title'] ?? 0
      const descIdx = taskColumnMap['description'] ?? 1
      const actionIdx = taskColumnMap['action'] ?? 2
      const urlIdx = taskColumnMap['url'] ?? 3

      const title = fields[titleIdx] ?? ''
      const description = fields[descIdx] ?? ''
      const actionRaw = fields[actionIdx] ?? ''
      const resourceUrl = fields[urlIdx] ?? ''

      // Skip rows with no title
      if (!title) {
        continue
      }

      // Validate action type
      const actionType = normalizeActionType(actionRaw)
      if (!actionType) {
        errors.push({
          row: rowNum,
          field: 'Action',
          message: actionRaw
            ? `"${actionRaw}" is not a valid action type. Expected: ${ACTION_TYPES.join(', ')}`
            : `Action type is required. Expected: ${ACTION_TYPES.join(', ')}`,
        })
        // Still include the task with a default for preview, but mark the error
        tasks.push({
          title,
          description: description || undefined,
          action_type: 'Read', // fallback for preview display
          resource_url: resourceUrl || undefined,
        })
      } else {
        tasks.push({
          title,
          description: description || undefined,
          action_type: actionType,
          resource_url: resourceUrl || undefined,
        })
      }
    }
  }

  // Validate required fields
  if (!curriculum.name) {
    errors.push({
      row: 0,
      field: 'Name',
      message: 'Curriculum name is required. Add a row: Name, <your curriculum name>',
    })
  }

  return { curriculum, tasks, errors }
}
