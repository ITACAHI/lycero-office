/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { authorName } from '../author-name'

/** AI edits are attributed to the Settings user name, as Word does for add-in edits */
export function aiRevisionAuthor(): string {
  return authorName()
}
