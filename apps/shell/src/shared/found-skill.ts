/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/**
 * The shape of a SKILL.md Lycero Office found on this machine, shared by the main
 * process that reads the files and the renderer that lists them.
 *
 * It lives here rather than beside the reader (`main/imported-skills.ts`) so the
 * renderer never has to name a main-process module: the reader reaches for
 * `node:fs`, and a `import type` across that boundary is erased today but reads
 * like a bundling mistake tomorrow.
 */

import type { SkillRelevance } from '@lycero/agent-core'

/** one SKILL.md we found, with everything the palette needs to show it */
export interface FoundSkill {
  /** the directory name, which is what `skills/<name>/` is keyed on */
  name: string
  /** optional localized display title from frontmatter or Lycero Cloud Registry */
  title?: string
  description: string
  /** absolute path of the SKILL.md, read when the user picks it */
  path: string
  /** whether it talks about a format Lycero Office opens, and on what */
  relevance: SkillRelevance
  /** true when the skill's full system prompt is protected and executed on Lycero Cloud */
  cloudProtected?: boolean
  /** subscription tier required/highlighted for this skill ('free' | 'plus' | 'pro') */
  tier?: string
  /** origin of the skill ('local' | 'cloud') */
  source?: 'local' | 'cloud'
}

/** a skill Lycero Office ships as a suggestion, with where the user stands on it */
export interface RecommendedSkill extends FoundSkill {
  version: string
  /** the frontmatter's `category`; groups the Recommended list (office, finance, ...) */
  category: string
  /** missing: not installed; installed: same version in our folder; outdated: ours is older */
  state: 'missing' | 'installed' | 'outdated'
}
