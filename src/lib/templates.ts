/** Curriculum template resources for CSV upload */

/** Path to the downloadable CSV template (static file in /public) */
export const CSV_TEMPLATE_PATH = '/lesson-hollow-template.csv'

/**
 * Google Sheets template URL (set via NEXT_PUBLIC_GOOGLE_SHEETS_TEMPLATE_URL).
 * Should be a /copy link so users get their own editable copy:
 * https://docs.google.com/spreadsheets/d/SHEET_ID/copy
 */
export const GOOGLE_SHEETS_TEMPLATE_URL =
  process.env.NEXT_PUBLIC_GOOGLE_SHEETS_TEMPLATE_URL || null
