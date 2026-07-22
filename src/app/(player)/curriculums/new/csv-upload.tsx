'use client'

import { useCallback, useRef, useState, useActionState } from 'react'
import { parseCsv, type CsvParseResult } from '@/lib/csv-parser'
import { CSV_TEMPLATE_PATH, GOOGLE_SHEETS_TEMPLATE_URL } from '@/lib/templates'
import { createCurriculumFromCsvAction, type CsvActionState } from './csv-actions'
import { BookOpen, Download, ExternalLink, Sparkles, Upload } from 'lucide-react'

const MAX_FILE_SIZE = 1024 * 1024 // 1 MB
const PREVIEW_TASK_LIMIT = 10

type UploadState =
  | { stage: 'idle' }
  | { stage: 'error'; message: string }
  | { stage: 'preview'; result: CsvParseResult; fileName: string }

const initialActionState: CsvActionState = {}

export function CsvUpload() {
  const [uploadState, setUploadState] = useState<UploadState>({ stage: 'idle' })
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [actionState, formAction, pending] = useActionState(
    createCurriculumFromCsvAction,
    initialActionState
  )

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadState({ stage: 'error', message: 'Please select a .csv file.' })
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadState({
        stage: 'error',
        message: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 1 MB.`,
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      if (!content || content.trim() === '') {
        setUploadState({ stage: 'error', message: 'The file is empty.' })
        return
      }
      const result = parseCsv(content)
      setUploadState({ stage: 'preview', result, fileName: file.name })
    }
    reader.onerror = () => {
      setUploadState({ stage: 'error', message: 'Failed to read the file. Please try again.' })
    }
    reader.readAsText(file)
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const reset = useCallback(() => {
    setUploadState({ stage: 'idle' })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const hasBlockingErrors =
    uploadState.stage === 'preview' && uploadState.result.errors.length > 0

  return (
    <article className="csv-upload-card">
      {uploadState.stage !== 'preview' ? (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            className="csv-dropzone"
            data-dragover={isDragOver || undefined}
          >
            <Upload size={40} />
            <p><strong>Drop a CSV file here</strong></p>
            <button
              type="button"
              className="secondary"
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              Browse files
            </button>
            <p>.csv files up to 1 MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="csv-file-input"
            aria-label="Upload CSV file"
          />

          <div className="csv-template-links">
            <a
              href={CSV_TEMPLATE_PATH}
              download="lesson-hollow-template.csv"
            >
              <Download size={16} /> Download CSV Template
            </a>
            {GOOGLE_SHEETS_TEMPLATE_URL && (
              <a
                href={GOOGLE_SHEETS_TEMPLATE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={16} /> Open Google Sheets template
              </a>
            )}
            <a href="/help/tips/building-a-curriculum-file">
              <BookOpen size={16} /> Help Building CSV Myself
            </a>
            <a href="/help/llm/building-a-curriculum-file">
              <Sparkles size={16} /> Help Building CSV with an LLM
            </a>
          </div>

          {uploadState.stage === 'error' && (
            <p className="form-error" role="alert">{uploadState.message}</p>
          )}
        </>
      ) : (
        <>
          <header className="preview-header">
            <h3>Preview: {uploadState.fileName}</h3>
            <button type="button" className="secondary" onClick={reset}>
              Choose different file
            </button>
          </header>

          <section className="preview-section">
            <h4>Curriculum Details</h4>
            <dl>
              <div className="preview-row">
                <dt>Name:</dt>
                <dd>
                  {uploadState.result.curriculum.name || <span className="field-error">Missing</span>}
                </dd>
              </div>
              {uploadState.result.curriculum.description && (
                <div className="preview-row">
                  <dt>Description:</dt>
                  <dd className="line-clamp-2">{uploadState.result.curriculum.description}</dd>
                </div>
              )}
              {uploadState.result.curriculum.publisher && (
                <div className="preview-row">
                  <dt>Publisher:</dt>
                  <dd>{uploadState.result.curriculum.publisher}</dd>
                </div>
              )}
              {uploadState.result.curriculum.grade_level && (
                <div className="preview-row">
                  <dt>Grade Level:</dt>
                  <dd>{uploadState.result.curriculum.grade_level}</dd>
                </div>
              )}
              {uploadState.result.curriculum.resource_url && (
                <div className="preview-row">
                  <dt>URL:</dt>
                  <dd className="truncate">{uploadState.result.curriculum.resource_url}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="preview-section">
            <h4>Tasks ({uploadState.result.tasks.length})</h4>
            {uploadState.result.tasks.length === 0 ? (
              <p className="muted-text">No tasks found in the CSV.</p>
            ) : (
              <ol className="preview-task-list">
                {uploadState.result.tasks.slice(0, PREVIEW_TASK_LIMIT).map((task, idx) => (
                  <li key={idx}>
                    <span className="task-index">{idx + 1}.</span>
                    <span className="action-badge">{task.action_type}</span>
                    <span className="task-text">{task.title}</span>
                  </li>
                ))}
                {uploadState.result.tasks.length > PREVIEW_TASK_LIMIT && (
                  <li className="preview-task-more">
                    and {uploadState.result.tasks.length - PREVIEW_TASK_LIMIT} more tasks
                  </li>
                )}
              </ol>
            )}
          </section>

          {uploadState.result.errors.length > 0 && (
            <section className="preview-errors">
              <h4>Errors ({uploadState.result.errors.length})</h4>
              <ul>
                {uploadState.result.errors.map((err, idx) => (
                  <li key={idx}>
                    {err.row > 0 ? `Row ${err.row}: ` : ''}{err.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {actionState.error && (
            <p className="form-error" role="alert">{actionState.error}</p>
          )}

          <footer>
            <button type="button" className="outline" onClick={reset}>
              Cancel
            </button>
            <form action={formAction}>
              <input
                type="hidden"
                name="csv_data"
                value={JSON.stringify({
                  curriculum: uploadState.result.curriculum,
                  tasks: uploadState.result.tasks,
                })}
              />
              <button
                type="submit"
                disabled={pending || hasBlockingErrors || uploadState.result.tasks.length === 0}
                aria-busy={pending}
              >
                {pending
                  ? 'Creating…'
                  : `Create Curriculum with ${uploadState.result.tasks.length} Tasks`}
              </button>
            </form>
          </footer>
        </>
      )}
    </article>
  )
}
