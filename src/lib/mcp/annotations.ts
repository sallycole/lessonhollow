import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'

/** Read-only tool that only queries data. */
export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
}

/** Tool that creates or modifies data but is not destructive. */
export const WRITE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
}

/** Tool that creates or modifies data and is idempotent. */
export const WRITE_IDEMPOTENT: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

/** Tool that can permanently delete or irreversibly modify data. */
export const DESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  openWorldHint: false,
}
