/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  type Dirent,
} from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path'
import JSZip from 'jszip'
import {
  DEFAULT_CLOUD_SKILL_CATALOG,
  classifySkill,
  parseSkillFrontmatter,
} from '@lycero/agent-core'
import type { FoundSkill, RecommendedSkill } from '../shared/found-skill'

/**
 * The skills a user installed into Lycero Office.
 *
 * Only `<userData>/skills/<name>/SKILL.md` counts. Nothing is scanned from a
 * coding agent's directories: a developer's `.claude` holds git, test and
 * deploy skills, and a word processor offering those as candidates was noise
 * for developers and an empty panel for everyone else. A skill arrives here
 * one way — the user picks a folder or a zip and presses Import.
 */

export type { FoundSkill }

/**
 * Under the app's own userData, not under the save directory: Home lists every
 * `.md` file under the save directory as a document, so a skills folder there
 * put every imported `SKILL.md` into the user's file list.
 */
export function skillsRoot(userDataDir: string): string {
  return join(userDataDir, 'skills')
}

function describe(name: string, path: string, text: string): FoundSkill | null {
  const fm = parseSkillFrontmatter(text)
  if (!fm) return null
  const title = fm.extra.title?.trim()
  const cloudProtected =
    fm.extra.cloudProtected?.trim() === 'true' || fm.body.includes('[LYCERO_CLOUD_SKILL:')
  const tier = fm.extra.tier?.trim()
  const source = fm.extra.source === 'cloud' || cloudProtected ? ('cloud' as const) : undefined
  return {
    name,
    ...(title ? { title } : {}),
    description: fm.description,
    path,
    relevance: classifySkill(fm.name, `${title ?? ''} ${fm.description}`),
    ...(cloudProtected ? { cloudProtected: true } : {}),
    ...(tier ? { tier } : {}),
    ...(source ? { source } : {}),
  }
}

/**
 * A permission error on one skill must not hide the others, so each is read
 * independently and a failure is just an absence. Async because this runs on
 * the main process while windows are open.
 */
export async function usableSkills(userDataDir: string): Promise<FoundSkill[]> {
  const root = skillsRoot(userDataDir)
  let entries: string[]
  try {
    entries = await readdir(root)
  } catch {
    return []
  }
  const out: FoundSkill[] = []
  for (const name of entries.sort()) {
    if (name.startsWith('.')) continue
    const path = join(root, name, 'SKILL.md')
    let text: string
    try {
      text = await readFile(path, 'utf8')
    } catch {
      continue
    }
    const skill = describe(name, path, text)
    if (skill) out.push(skill)
  }
  return out
}

/** the body of a skill, for the turn that runs it */
export function readSkillBody(path: string): string {
  const fm = parseSkillFrontmatter(readFileSync(path, 'utf8'))
  return fm?.body ?? ''
}

const MAX_IMPORT_BYTES = 10 * 1024 * 1024

/**
 * A symlink is refused rather than dereferenced: `cpSync` without
 * `dereference` would carry the link across and the imported skill would keep
 * reaching back into whatever it points at, while dereferencing would copy in
 * arbitrarily much from anywhere on disk. The same walk bounds the copy.
 */
function inspectSkillDir(dir: string): void {
  let rootIsLink: boolean
  try {
    rootIsLink = lstatSync(dir).isSymbolicLink()
  } catch {
    throw new Error('the skill directory could not be read')
  }
  if (rootIsLink) throw new Error('the skill directory is a symlink, and imports refuse those')
  let total = 0
  const stack: string[] = [dir]
  while (stack.length > 0) {
    const cur = stack.pop()!
    let entries: Dirent[]
    try {
      entries = readdirSync(cur, { withFileTypes: true })
    } catch {
      throw new Error('the skill directory could not be read')
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        throw new Error('the skill contains a symlink, and imports refuse those')
      }
      const full = join(cur, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
        continue
      }
      let size: number
      try {
        size = statSync(full).size
      } catch {
        throw new Error('the skill directory could not be read')
      }
      total += size
      if (total > MAX_IMPORT_BYTES) {
        throw new Error('the skill is larger than the 10 MB import cap')
      }
    }
  }
}

function readBack(dest: string): FoundSkill {
  const skill = describe(
    basename(dest),
    join(dest, 'SKILL.md'),
    readFileSync(join(dest, 'SKILL.md'), 'utf8'),
  )
  if (!skill) throw new Error('the skill could not be read back')
  return skill
}

function requireSkillMd(dir: string): void {
  let text: string
  try {
    text = readFileSync(join(dir, 'SKILL.md'), 'utf8')
  } catch {
    throw new Error('the folder has no SKILL.md')
  }
  if (!parseSkillFrontmatter(text)) {
    throw new Error('SKILL.md needs name and description frontmatter')
  }
}

/**
 * Copy a folder the user picked into our skills folder.
 *
 * The whole directory goes rather than the SKILL.md alone: a skill routinely
 * ships reference tables, templates and helper scripts next to its
 * instructions. Refuses rather than overwrites when the name is taken.
 */
export function importSkillDir(skillDir: string, userDataDir: string): FoundSkill {
  const dest = join(skillsRoot(userDataDir), basename(skillDir))
  if (existsSync(dest)) throw new Error('a skill of that name is already there')
  requireSkillMd(skillDir)
  inspectSkillDir(skillDir)
  cpSync(skillDir, dest, { recursive: true })
  return readBack(dest)
}

/**
 * Import a single markdown file as a skill.
 *
 * The file becomes `<name>/SKILL.md`; the name comes from the frontmatter and
 * falls back to the file stem when `name` cannot be a folder name. Refuses
 * rather than overwrites when the name is taken.
 */
export function importSkillMd(mdPath: string, userDataDir: string): FoundSkill {
  let text: string
  try {
    text = readFileSync(mdPath, 'utf8')
  } catch {
    throw new Error('the file could not be read')
  }
  if (Buffer.byteLength(text) > MAX_IMPORT_BYTES) {
    throw new Error('the skill is larger than the 10 MB import cap')
  }
  const fm = parseSkillFrontmatter(text)
  if (!fm) throw new Error('SKILL.md needs name and description frontmatter')
  const stem = basename(mdPath).replace(/\.md$/i, '')
  const name = [fm.name.trim(), stem].find((n) => isSkillName(n))
  if (!name) throw new Error('the file name cannot be used as a skill name')
  const dest = join(skillsRoot(userDataDir), name)
  if (existsSync(dest)) throw new Error('a skill of that name is already there')
  mkdirSync(skillsRoot(userDataDir), { recursive: true })
  const scratch = mkdtempSync(join(skillsRoot(userDataDir), '.import-'))
  try {
    writeFileSync(join(scratch, 'SKILL.md'), text)
    renameSync(scratch, dest)
  } catch (e) {
    rmSync(scratch, { recursive: true, force: true })
    throw e
  }
  return readBack(dest)
}

function isSkillName(name: string): boolean {
  return /^[^/\\:*?"<>|]+$/.test(name) && isListedName(name)
}

/** What `usableSkills` lists: one readdir entry, not a dot folder, not a path. */
function isListedName(name: string): boolean {
  return name.length > 0 && !/[/\\]/.test(name) && !name.startsWith('.')
}

/**
 * Inflate one entry, giving up the moment it passes `limit`. A tiny archive can
 * declare and inflate to gigabytes, so the cap has to bite during inflation,
 * not after `async('nodebuffer')` has already handed back the whole payload.
 */
function inflateWithin(entry: JSZip.JSZipObject, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const stream = entry.nodeStream('nodebuffer')
    stream
      .on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > limit) {
          stream.pause()
          stream.removeAllListeners('data')
          reject(new Error('the skill is larger than the 10 MB import cap'))
          return
        }
        chunks.push(chunk)
      })
      .on('error', reject)
      .on('end', () => resolve(Buffer.concat(chunks)))
  })
}

const S_IFMT = 0o170000
const S_IFLNK = 0o120000

/**
 * Unpack a zip the user picked into our skills folder.
 *
 * Accepts `SKILL.md` at the archive root (the skill is then named after the
 * file) or under exactly one top-level folder (named after the folder). Entry
 * names are checked before any byte is written: an absolute or `..` name, a
 * symlink entry, or more than the import cap of unpacked bytes refuses the
 * whole archive. Everything lands in a scratch dir first and is renamed into
 * place at the end, so a refusal half-way leaves nothing behind.
 */
export async function importSkillZip(zipPath: string, userDataDir: string): Promise<FoundSkill> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(readFileSync(zipPath))
  } catch {
    throw new Error('the file is not a zip archive')
  }
  const files = Object.values(zip.files).filter((f) => !f.dir && !f.name.startsWith('__MACOSX/'))
  for (const f of files) {
    const parts = f.name.split('/')
    if (isAbsolute(f.name) || f.name.includes('\\') || parts.some((p) => p === '..' || p === '')) {
      throw new Error(`the archive has an unsafe entry name: ${f.name}`)
    }
    if (f.unixPermissions != null && (Number(f.unixPermissions) & S_IFMT) === S_IFLNK) {
      throw new Error('the archive contains a symlink, and imports refuse those')
    }
  }
  const atRoot = files.find((f) => f.name === 'SKILL.md')
  const tops = new Set(files.map((f) => f.name.split('/')[0]))
  let prefix = ''
  let name: string
  if (atRoot) {
    name = basename(zipPath).replace(/\.zip$/i, '')
  } else if (tops.size === 1 && files.some((f) => f.name === `${[...tops][0]}/SKILL.md`)) {
    prefix = `${[...tops][0]}/`
    name = [...tops][0]
  } else {
    throw new Error('the archive has no SKILL.md at its root or under one folder')
  }
  if (!isSkillName(name)) {
    throw new Error('the archive name cannot be used as a skill name')
  }
  const dest = join(skillsRoot(userDataDir), name)
  if (existsSync(dest)) throw new Error('a skill of that name is already there')

  mkdirSync(skillsRoot(userDataDir), { recursive: true })
  const scratch = mkdtempSync(join(skillsRoot(userDataDir), '.import-'))
  try {
    let total = 0
    for (const f of files) {
      const bytes = await inflateWithin(f, MAX_IMPORT_BYTES - total)
      total += bytes.length
      const rel = f.name.slice(prefix.length).split('/').join(sep)
      const target = join(scratch, rel)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, bytes)
    }
    requireSkillMd(scratch)
    renameSync(scratch, dest)
  } catch (e) {
    rmSync(scratch, { recursive: true, force: true })
    throw e
  }
  return readBack(dest)
}

/**
 * Delete one of our skills. `name` must be a plain folder name that holds a
 * SKILL.md under the skills root, so the renderer can only remove what the
 * listing showed it.
 */
export function removeSkill(name: string, userDataDir: string): void {
  if (typeof name !== 'string' || !isListedName(name)) throw new Error('unknown skill')
  const dir = join(skillsRoot(userDataDir), name)
  if (!existsSync(join(dir, 'SKILL.md'))) throw new Error('unknown skill')
  rmSync(dir, { recursive: true, force: true })
}

/**
 * Whether a path is one of the SKILL.md files the listing can hand out.
 *
 * `readSkillBody` takes a path from the renderer, so on its own it reads any
 * file on disk. The name must be SKILL.md and its directory's directory must
 * be the skills root — the exact shape `usableSkills` builds, so what can be
 * read and what was listed are the same set. `dirname` never collapses `..`,
 * so an escaping path keeps its `..` and cannot match the resolved root.
 */
export function isKnownSkillPath(path: unknown, root: string): path is string {
  if (typeof path !== 'string' || path === '' || !isAbsolute(path)) return false
  const file = resolve(path)
  if (basename(file) !== 'SKILL.md') return false
  return resolve(root) === dirname(dirname(file))
}

/** `metadata:\n  version: x` in the frontmatter, the same shape skills/lycero-office uses */
export function skillVersion(path: string): string {
  try {
    const fm = parseSkillFrontmatter(readFileSync(path, 'utf8'))
    return /^\s*version:\s*['"]?([^'"\n]+)/m.exec(fm?.extra.metadata ?? '')?.[1]?.trim() ?? ''
  } catch {
    return ''
  }
}

/**
 * The skills we ship as suggestions, with whether the user already has each.
 *
 * Shipping them is not installing them: a recommended skill only runs after
 * the user presses Install, which copies it into our folder like any import.
 * Installed copies are the user's — they may edit them — so an update is
 * offered, never applied on its own.
 */
export async function recommendedSkills(
  recommendedDir: string,
  userDataDir: string,
): Promise<RecommendedSkill[]> {
  let entries: string[]
  try {
    entries = await readdir(recommendedDir)
  } catch {
    return []
  }
  const out: RecommendedSkill[] = []
  for (const name of entries.sort()) {
    const path = join(recommendedDir, name, 'SKILL.md')
    let text: string
    try {
      text = await readFile(path, 'utf8')
    } catch {
      continue
    }
    const skill = describe(name, path, text)
    if (!skill) continue
    const category = parseSkillFrontmatter(text)?.extra.category?.trim() || 'other'
    const version = skillVersion(path)
    const installedAt = join(skillsRoot(userDataDir), name, 'SKILL.md')
    let state: RecommendedSkill['state'] = 'missing'
    if (existsSync(installedAt)) {
      state = skillVersion(installedAt) === version ? 'installed' : 'outdated'
    }
    out.push({ ...skill, category, version, state })
  }
  return out
}

/**
 * Copy one recommended skill into our folder. `name` is matched against the
 * recommended directory's own listing, so the renderer cannot name a path.
 * An existing copy is replaced only here, because the user asked for exactly
 * that by pressing Update.
 */
export function installRecommendedSkill(
  name: string,
  recommendedDir: string,
  userDataDir: string,
): FoundSkill {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) throw new Error('unknown skill')
  const src = join(recommendedDir, name)
  if (!existsSync(join(src, 'SKILL.md'))) throw new Error('unknown skill')
  const dest = join(skillsRoot(userDataDir), name)
  requireSkillMd(src)
  inspectSkillDir(src)
  mkdirSync(skillsRoot(userDataDir), { recursive: true })
  const scratch = mkdtempSync(join(skillsRoot(userDataDir), '.install-'))
  // the user's copy steps aside rather than being deleted, so a failed swap puts it back
  const parked = `${scratch}.previous`
  let moved = false
  try {
    cpSync(src, scratch, { recursive: true })
    if (existsSync(dest)) {
      renameSync(dest, parked)
      moved = true
    }
    renameSync(scratch, dest)
  } catch (e) {
    if (moved && !existsSync(dest)) renameSync(parked, dest)
    tryRm(scratch)
    throw e
  }
  // the swap is done; a locked leftover must not turn a finished install into a failure
  if (moved) tryRm(parked)
  return readBack(dest)
}

function tryRm(path: string): void {
  try {
    rmSync(path, { recursive: true, force: true })
  } catch {
    /* EPERM/EBUSY under antivirus or a file lock; dot folders are skipped by usableSkills */
  }
}

function hasFullLocalSkillBody(filePath: string): boolean {
  try {
    if (!existsSync(filePath)) return false
    const raw = readFileSync(filePath, 'utf8')
    const fm = parseSkillFrontmatter(raw)
    if (!fm || !fm.body) return false
    const bodyWithoutCloudTag = fm.body.replace(/\[LYCERO_CLOUD_SKILL:[^\]]+\]/g, '').trim()
    return bodyWithoutCloudTag.length >= 200
  } catch {
    return false
  }
}

function findBundledFullSkillMd(slug: string): string | null {
  const resPath =
    typeof (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath === 'string'
      ? (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath!
      : ''
  const candidates = [
    ...(resPath
      ? [
          join(resPath, 'cli', 'skills', 'recommended', slug, 'SKILL.md'),
          join(resPath, 'cli', 'skills', slug, 'SKILL.md'),
          join(resPath, 'skills', 'recommended', slug, 'SKILL.md'),
          join(resPath, 'skills', slug, 'SKILL.md'),
        ]
      : []),
    resolve(process.cwd(), 'skills', slug, 'SKILL.md'),
    resolve(process.cwd(), 'skills', 'recommended', slug, 'SKILL.md'),
    resolve(__dirname, '../../../../skills', slug, 'SKILL.md'),
    resolve(__dirname, '../../../../skills/recommended', slug, 'SKILL.md'),
    resolve(__dirname, '../../../skills', slug, 'SKILL.md'),
    resolve(__dirname, '../../../skills/recommended', slug, 'SKILL.md'),
  ]
  for (const c of candidates) {
    if (hasFullLocalSkillBody(c)) {
      try {
        return readFileSync(c, 'utf8')
      } catch {
        // continue
      }
    }
  }
  return null
}

function writeCloudProxySkillMd(
  userDataDir: string,
  item: {
    slug: string
    name: string
    title?: string
    description: string
    category?: string
    version?: string
    tier?: string
  },
): string {
  const destDir = join(skillsRoot(userDataDir), item.slug)
  const destFile = join(destDir, 'SKILL.md')
  if (hasFullLocalSkillBody(destFile)) {
    return destFile
  }
  const bundled = findBundledFullSkillMd(item.slug)
  if (bundled) {
    try {
      mkdirSync(destDir, { recursive: true })
      writeFileSync(destFile, bundled, 'utf8')
      return destFile
    } catch {
      /* ignore write errors on read-only disks */
    }
  }
  const version = item.version || '3.3.0'
  const displayTitle = (item.title || item.name || item.slug).replace(/\r?\n/g, ' ').trim()
  const desc = item.description.replace(/\r?\n/g, ' ').trim()
  const category = (item.category || 'other').replace(/\r?\n/g, ' ').trim()
  const tier = (item.tier || 'pro').replace(/\r?\n/g, ' ').trim()
  const content = [
    '---',
    `name: ${item.slug}`,
    `title: ${displayTitle}`,
    `description: ${desc}`,
    `category: ${category}`,
    'source: cloud',
    'cloudProtected: true',
    `tier: ${tier}`,
    'metadata:',
    `  version: ${version}`,
    '---',
    '',
    `# ${displayTitle}`,
    '',
    desc,
    '',
    '## Quy tắc Thực thi & Pháp chế Bắt buộc (2025–2026)',
    '1. Không bịa: SĐT, email, địa chỉ, số CCCD, số GCN, số hợp đồng/hóa đơn/văn bản, nhà cung cấp, định mức, người phụ trách, căn cứ nội bộ, ý kiến hay nhiệm vụ không có trong đề. Thiếu thông tin thì để "[cần bổ sung: ...]".',
    '2. Câu trả lời trong chat chỉ được nêu số liệu và tính năng đã đọc lại từ file sau khi lưu (read-back). Thao tác lỗi (sheet apply/docs apply báo error) thì phải nói rõ là chưa làm được. Không dán HTML thô, LaTeX thô hay lời gọi công cụ vào chat.',
    '3. Địa giới 2 cấp từ 01/07/2025: không dùng quận/huyện/thị xã/TP thuộc tỉnh. Tòa án: TAND khu vực (Nghị quyết 81/2025/UBTVQH15). Thuế: Thuế cơ sở N tỉnh/TP.',
    '4. Thể thức: Times New Roman 13–14pt; lề trên/dưới 20–25mm, trái 30–35mm, phải 15–20mm; 100% nhãn tiếng Việt; số có dấu chấm phân cách nghìn; ngày dd/mm/yyyy.',
    '5. Lưu file duy nhất tại thư mục tài liệu "/home/box/Lycero Office/" (hoặc <Documents>/Lycero Office/), không tạo bản trùng. Không ghi file thử (test.html, test.docx, "Hello test") vào thư mục hay tên file của người dùng.',
    '6. Không đưa ID phiên (kb-...) hay timestamp nội bộ vào nội dung văn bản.',
    '7. Cập nhật pháp lý 2025–2026: Kế toán theo Thông tư 99/2025/TT-BTC (hiệu lực 01/01/2026); Thuế TNCN giảm trừ 15,5 triệu/tháng và 6,2 triệu/tháng (Nghị quyết 110/2025/UBTVQH15), biểu 5 bậc (Luật Thuế TNCN số 109/2025/QH15); Bảo vệ dữ liệu cá nhân theo Luật số 91/2025/QH15 + Nghị định 356/2025/NĐ-CP; Hóa đơn điện tử theo Nghị định 123/2020/NĐ-CP sửa đổi bởi Nghị định 70/2025/NĐ-CP; BHXH theo Luật số 41/2024/QH15 và Việc làm theo Luật số 74/2025/QH15; Thuế TNDN theo Luật số 67/2025/QH15; Ma trận đề kiểm tra theo Công văn 7991/BGDĐT-GDTrH (3 mức độ Nhận biết – Thông hiểu – Vận dụng, 4 phần); Giáo án CV 5512 đúng Phụ lục IV (không gắn Quốc hiệu - Tiêu ngữ).',
    '',
    `[LYCERO_CLOUD_SKILL:${item.slug}]`,
    '',
  ].join('\n')
  try {
    mkdirSync(destDir, { recursive: true })
    writeFileSync(destFile, content, 'utf8')
  } catch {
    /* ignore write errors on read-only disks */
  }
  return destFile
}

/**
 * Automatically seeds built-in Cloud Skills and syncs all skills from Lycero Cloud Server
 * (`/api/v1/office/skills` and `/api/v1/office/desktop/capabilities`) into `<userData>/skills`.
 */
export async function syncAllCloudSkillsToUserData(
  userDataDir: string,
  apiKey?: string,
): Promise<FoundSkill[]> {
  for (const item of DEFAULT_CLOUD_SKILL_CATALOG) {
    const installedAt = join(skillsRoot(userDataDir), item.slug, 'SKILL.md')
    if (!hasFullLocalSkillBody(installedAt)) {
      writeCloudProxySkillMd(userDataDir, {
        slug: item.slug,
        name: item.name,
        title: item.name,
        description: item.description,
        category: item.category,
        version: item.version,
      })
    }
  }
  await fetchCloudRecommendedSkills(userDataDir, apiKey).catch(() => [])
  return usableSkills(userDataDir)
}

/**
 * Fetch recommended skills from Lycero Cloud Skills Registry (`/api/v1/office/skills`
 * and `/api/v1/office/desktop/capabilities`). Automatically installs cloud proxy manifests
 * so all Cloud Skills are immediately loaded and ready without manual installation.
 */
export async function fetchCloudRecommendedSkills(
  userDataDir: string,
  apiKey?: string,
): Promise<RecommendedSkill[]> {
  if (process.env.VITEST) return []
  const baseUrl = (
    process.env.LYCERO_GATEWAY_URL ||
    process.env.LYCERO_BASE_URL ||
    'https://lycero.com'
  ).replace(/\/$/, '')
  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    const [skillsResp, capsResp] = await Promise.allSettled([
      fetch(`${baseUrl}/api/v1/office/skills`, { headers }),
      fetch(`${baseUrl}/api/v1/office/desktop/capabilities`, { headers }),
    ])

    type RawCloudSkill = {
      slug: string
      name: string
      title?: string
      description: string
      category?: string
      version?: string
      cloudProtected?: boolean
      tier?: string
      relevance?: FoundSkill['relevance']
    }

    const combined = new Map<string, RawCloudSkill>()
    for (const item of DEFAULT_CLOUD_SKILL_CATALOG) {
      combined.set(item.slug, {
        slug: item.slug,
        name: item.name,
        title: item.name,
        description: item.description,
        category: item.category,
        version: item.version,
        cloudProtected: true,
        tier: 'pro',
      })
    }

    if (skillsResp.status === 'fulfilled' && skillsResp.value.ok) {
      const json = (await skillsResp.value.json().catch(() => ({}))) as {
        skills?: RawCloudSkill[]
      }
      if (Array.isArray(json.skills)) {
        for (const s of json.skills) {
          if (s?.slug && s?.name && s?.description) combined.set(s.slug, s)
        }
      }
    }

    if (capsResp.status === 'fulfilled' && capsResp.value.ok) {
      const json = (await capsResp.value.json().catch(() => ({}))) as {
        skills?: RawCloudSkill[]
      }
      if (Array.isArray(json.skills)) {
        for (const s of json.skills) {
          if (s?.slug && s?.name && s?.description) combined.set(s.slug, s)
        }
      }
    }

    const out: RecommendedSkill[] = []
    for (const item of combined.values()) {
      if (!item.slug || !item.name || !item.description) continue
      const installedAt = join(skillsRoot(userDataDir), item.slug, 'SKILL.md')
      const version = item.version || '3.3.0'
      if (!hasFullLocalSkillBody(installedAt)) {
        writeCloudProxySkillMd(userDataDir, item)
      }
      const state: RecommendedSkill['state'] = existsSync(installedAt) ? 'installed' : 'missing'
      const displayTitle = item.title || (item.name !== item.slug ? item.name : undefined)
      out.push({
        name: item.slug,
        ...(displayTitle ? { title: displayTitle } : {}),
        description: item.description,
        path: installedAt,
        relevance:
          item.relevance ?? classifySkill(item.slug, `${displayTitle ?? ''} ${item.description}`),
        category: item.category || 'other',
        version,
        state,
        cloudProtected: item.cloudProtected ?? true,
        tier: item.tier || 'pro',
        source: 'cloud',
      })
    }
    return out
  } catch {
    return []
  }
}

/**
 * Merge local bundled recommended skills with Cloud Skills Registry entries.
 * Cloud entries with matching slugs override/update local entries; new Cloud
 * entries are placed at the front of their category so advanced Cloud Pro skills
 * are immediately visible.
 */
export function mergeRecommendedSkills(
  localSkills: RecommendedSkill[],
  cloudSkills: RecommendedSkill[],
): RecommendedSkill[] {
  if (cloudSkills.length === 0) return localSkills
  const bySlug = new Map<string, RecommendedSkill>()
  for (const c of cloudSkills) {
    bySlug.set(c.name, c)
  }
  const mergedLocal = localSkills.map((loc) => {
    const cloud = bySlug.get(loc.name)
    if (!cloud) return loc
    bySlug.delete(loc.name)
    return {
      ...loc,
      ...cloud,
      // preserve local path if not yet installed and not exclusively cloud-protected
      path: cloud.cloudProtected ? cloud.path : loc.path,
    }
  })
  return [...bySlug.values(), ...mergedLocal]
}

/**
 * Download and install one skill from Lycero Cloud Skills Registry (`/api/v1/office/skills/[slug]?format=skillmd`).
 */
export async function installCloudSkill(
  slug: string,
  userDataDir: string,
  apiKey?: string,
): Promise<FoundSkill> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(slug)) throw new Error('unknown skill')
  const baseUrl = (
    process.env.LYCERO_GATEWAY_URL ||
    process.env.LYCERO_BASE_URL ||
    'https://lycero.com'
  ).replace(/\/$/, '')
  const headers: Record<string, string> = {}
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  const resp = await fetch(
    `${baseUrl}/api/v1/office/skills/${encodeURIComponent(slug)}?format=skillmd`,
    { headers },
  )
  if (!resp.ok) throw new Error(`cloud skill fetch failed: HTTP ${resp.status}`)
  const text = await resp.text()
  if (!parseSkillFrontmatter(text)) {
    throw new Error('SKILL.md needs name and description frontmatter')
  }
  const dest = join(skillsRoot(userDataDir), slug)
  mkdirSync(skillsRoot(userDataDir), { recursive: true })
  const scratch = mkdtempSync(join(skillsRoot(userDataDir), '.cloud-'))
  try {
    writeFileSync(join(scratch, 'SKILL.md'), text, 'utf8')
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
    renameSync(scratch, dest)
  } catch (e) {
    tryRm(scratch)
    throw e
  }
  return readBack(dest)
}
