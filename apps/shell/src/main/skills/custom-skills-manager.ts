/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { app, dialog, shell } from 'electron'
import JSZip from 'jszip'
import type { CustomSkill, SkillCategory } from '../../shared/home-api'

const PRESET_SKILLS: CustomSkill[] = [
  {
    id: 'tham-dinh-hop-dong',
    name: 'Thẩm Định Hợp Đồng Kinh Tế & Rủi Ro Pháp Lý',
    title: 'Thẩm Định Hợp Đồng Kinh Tế',
    description: 'Tự động rà soát điều khoản phạt vi phạm, bồi thường thiệt hại, cam kết bảo mật và bẫy pháp lý theo Luật Thương mại 2005 & Bộ luật Dân sự 2015.',
    category: 'corporate',
    path: '',
    author: 'Lycero Enterprise Lab',
    version: '1.2.0',
    enabled: true,
    builtIn: true,
    triggers: ['hợp đồng', 'pháp lý', 'điều khoản', 'bồi thường', 'phạt cọc', 'nda', 'thanh toán'],
    systemPrompt: `## HƯỚNG DẪN NGHIỆP VỤ: THẨM ĐỊNH HỢP ĐỒNG KINH TẾ & THƯƠNG MẠI
Bạn là Chuyên gia Cố vấn Pháp chế Hợp đồng Doanh nghiệp cấp cao. Khi người dùng yêu cầu soạn thảo, chỉnh sửa hoặc thẩm định hợp đồng:
1. Luôn rà soát 5 yếu tố trọng yếu:
   - Chủ thể và thẩm quyền ký kết (người đại diện pháp luật hoặc ủy quyền hợp lệ).
   - Đối tượng hợp đồng và phạm vi công việc/hàng hóa rõ ràng, định lượng được.
   - Cơ chế thanh toán, nghiệm thu, hóa đơn VAT và điều kiện giải ngân từng đợt.
   - Điều khoản Phạt vi phạm (tối đa 8% theo Luật Thương mại 2005 đối với vi phạm nghĩa vụ hợp đồng) và Bồi thường thiệt hại thực tế.
   - Bất khả kháng (Force Majeure), Giải quyết tranh chấp (Trọng tài Thương mại VIAC hoặc Tòa án có thẩm quyền) và Bảo mật thông tin (NDA).
2. Khi phát hiện điều khoản bất lợi hoặc mơ hồ, hãy chỉ rõ điều khoản, trích dẫn rủi ro tiềm ẩn và cung cấp ngay phương án sửa đổi bằng câu chữ pháp lý chuẩn xác.`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'khbd-gdpt-2018',
    name: 'Soạn Kế Hoạch Bài Dạy Chuẩn GDPT 2018 & CV 5512',
    title: 'Kế Hoạch Bài Dạy 5512',
    description: 'Thiết kế tiến trình dạy học 4 bước (Mở đầu, Hình thành kiến thức, Luyện tập, Vận dụng) đáp ứng chuẩn Yêu cầu cần đạt và thang tư duy Bloom.',
    category: 'edtech',
    path: '',
    author: 'Lycero Pedagogical Board',
    version: '2.0.0',
    enabled: true,
    builtIn: true,
    triggers: ['giáo án', 'kế hoạch bài dạy', 'khbd', '5512', 'gdpt 2018', 'tiết dạy', 'bài soạn'],
    systemPrompt: `## HƯỚNG DẪN SƯ PHẠM: KẾ HOẠCH BÀI DẠY CHUẨN CÔNG VĂN 5512/BGDĐT
Bạn là Chuyên gia Phương pháp Giảng dạy & Phát triển Chương trình GDPT 2018.
Mọi bài soạn KHBD phải tuân thủ nghiêm ngặt cấu trúc:
1. MỤC TIÊU DẠY HỌC:
   - Năng lực đặc thù & Năng lực chung (mục tiêu hành vi cụ thể, đo lường được bằng động từ Bloom).
   - Phẩm chất chủ yếu (Yêu nước, Nhân ái, Chăm chỉ, Trung thực, Trách nhiệm).
2. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU: Phân định rõ của Giáo viên và của Học sinh.
3. TIẾN TRÌNH DẠY HỌC GỒM 4 HOẠT ĐỘNG:
   - Hoạt động 1: Xác định vấn đề / Nhiệm vụ học tập / Mở đầu (Khơi gợi tư duy).
   - Hoạt động 2: Hình thành kiến thức mới (Khám phá, tiếp nhận).
   - Hoạt động 3: Luyện tập (Thực hành, củng cố, xử lý bài tập mẫu).
   - Hoạt động 4: Vận dụng (Gắn kiến thức với tình huống thực tiễn đời sống).
Mỗi hoạt động phải trình bày rõ 4 bước: a) Mục tiêu, b) Nội dung, c) Sản phẩm, d) Tổ chức thực hiện (Giao nhiệm vụ -> Thực hiện -> Báo cáo/Thảo luận -> Kết luận/Nhận định).`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'de-cuong-nckh-scopus',
    name: 'Xây Dựng Đề Cương Nghiên Cứu Khoa Học Chuẩn Scopus/ISI',
    title: 'Đề Cương Nghiên Cứu Khoa Học',
    description: 'Thiết kế Research Proposal chuẩn học thuật quốc tế: Problem Statement, Research Questions, Literature Review, Methodology và Data Analysis.',
    category: 'academic',
    path: '',
    author: 'Lycero Academic Council',
    version: '1.1.0',
    enabled: true,
    builtIn: true,
    triggers: ['nghiên cứu khoa học', 'đề cương', 'nckh', 'scopus', 'isi', 'luận án', 'luận văn', 'proposal'],
    systemPrompt: `## HƯỚNG DẪN HỌC THUẬT: ĐỀ CƯƠNG NGHIÊN CỨU KHOA HỌC (RESEARCH PROPOSAL)
Bạn là Cố vấn Khoa học và Phản biện Nghiên cứu Quốc tế (ISI/Scopus).
Khi hỗ trợ xây dựng đề tài hoặc đề cương nghiên cứu:
1. Đảm bảo tính mới (Novelty) và Đóng góp học thuật (Theoretical & Practical Contributions).
2. Cấu trúc chuẩn mực gồm:
   - Tính cấp thiết & Lý do chọn đề tài (Background & Motivation).
   - Câu hỏi nghiên cứu (Research Questions) và Mục tiêu nghiên cứu (Research Objectives).
   - Tổng quan tài liệu có hệ thống (Systematic Literature Review) & Khung lý thuyết (Theoretical Framework).
   - Giả thuyết nghiên cứu (Research Hypotheses) nếu là nghiên cứu định lượng.
   - Phương pháp nghiên cứu: Thiết kế nghiên cứu, Phương pháp chọn mẫu, Thu thập dữ liệu và Kỹ thuật phân tích dữ liệu (SPSS/AMOS/SmartPLS/R/Python).
   - Kế hoạch thực hiện (Gantt chart) và Dự toán kinh phí.
   - Liêm chính học thuật: Trích dẫn chuẩn APA 7th Edition, không đạo văn.`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'du-toan-tai-chinh',
    name: 'Lập Dự Toán Tài Chính & Phân Tích Dòng Tiền Doanh Nghiệp',
    title: 'Dự Toán Tài Chính & Dòng Tiền',
    description: 'Mô hình hóa tài chính: Dự báo doanh thu, chi phí cố định/biến đổi, EBITDA, điểm hòa vốn và dòng tiền hoạt động cho doanh nghiệp.',
    category: 'corporate',
    path: '',
    author: 'Lycero Financial Modeling Group',
    version: '1.0.0',
    enabled: true,
    builtIn: true,
    triggers: ['tài chính', 'dự toán', 'doanh thu', 'chi phí', 'ebitda', 'dòng tiền', 'p&l', 'ngân sách'],
    systemPrompt: `## HƯỚNG DẪN TÀI CHÍNH: DỰ TOÁN NGÂN SÁCH & PHÂN TÍCH DÒNG TIỀN (FINANCIAL MODELING)
Bạn là Giám đốc Tài chính (CFO) & Chuyên gia Phân tích Dữ liệu Doanh nghiệp.
Khi hỗ trợ lập kế hoạch tài chính hoặc bảng tính Excel (.xlsx):
1. Phân loại chi phí chuẩn mực: CAPEX (Chi phí vốn đầu tư) vs OPEX (Chi phí vận hành thường xuyên).
2. Xác định chi phí cố định (Fixed Costs) và chi phí biến đổi (Variable Costs) để tính Điểm hòa vốn (Break-even Point).
3. Luôn xây dựng 3 kịch bản: Cơ sở (Base Case), Lạc quan (Optimistic) và Thận trọng (Pessimistic).
4. Thiết lập công thức bảng tính chuyên nghiệp: SUM, AVERAGE, VLOOKUP/XLOOKUP, NPV, IRR, EBITDA, Working Capital.
5. Cảnh báo rủi ro đứt gãy dòng tiền (Cash Flow Crunch) và đề xuất các biện pháp kiểm soát công nợ phải thu.`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

export class CustomSkillsManager {
  private skillsDir: string
  private indexPath: string

  constructor(baseDir?: string) {
    let userData = baseDir
    if (!userData) {
      try {
        if (typeof app !== 'undefined' && typeof app.getPath === 'function') {
          userData = app.getPath('userData')
        }
      } catch {}
    }
    if (!userData) {
      userData = join(process.env.APPDATA || process.env.HOME || process.cwd(), '.lycero-skills-data')
    }
    this.skillsDir = join(userData, 'custom_skills')
    this.indexPath = join(this.skillsDir, 'lycero_custom_skills.json')
    this.ensureDirectory()
  }

  private ensureDirectory(): void {
    if (!existsSync(this.skillsDir)) {
      mkdirSync(this.skillsDir, { recursive: true })
    }
  }

  getSkillsDir(): string {
    return this.skillsDir
  }

  listSkills(): CustomSkill[] {
    this.ensureDirectory()
    let saved: CustomSkill[] = []
    if (existsSync(this.indexPath)) {
      try {
        const raw = readFileSync(this.indexPath, 'utf-8')
        saved = JSON.parse(raw) as CustomSkill[]
      } catch (err) {
        console.warn('[CustomSkills] Failed to parse custom skills index:', err)
      }
    }

    // Merge presets with saved skills
    const map = new Map<string, CustomSkill>()
    for (const preset of PRESET_SKILLS) {
      map.set(preset.id, preset)
    }
    for (const skill of saved) {
      map.set(skill.id, skill)
    }

    return Array.from(map.values())
  }

  saveSkill(data: Partial<CustomSkill> & { name: string; systemPrompt: string }): CustomSkill {
    this.ensureDirectory()
    const all = this.listSkills()
    const id = data.id || `skill-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const now = Date.now()

    const existingIndex = all.findIndex((s) => s.id === id)
    const existing = existingIndex >= 0 ? all[existingIndex] : null

    const skill: CustomSkill = {
      id,
      name: data.name.trim(),
      title: data.title?.trim() || data.name.trim(),
      description: data.description?.trim() || 'Kỹ năng tùy biến của người dùng',
      category: data.category || 'general',
      path: data.path ?? '',
      author: data.author?.trim() || 'Người dùng',
      version: data.version?.trim() || '1.0.0',
      enabled: data.enabled !== undefined ? data.enabled : true,
      systemPrompt: data.systemPrompt.trim(),
      triggers: data.triggers || [],
      builtIn: existing?.builtIn || false,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    }

    if (existingIndex >= 0) {
      all[existingIndex] = skill
    } else {
      all.push(skill)
    }

    // Save index
    writeFileSync(this.indexPath, JSON.stringify(all, null, 2), 'utf-8')

    // Also write a standalone SKILL.md file for portability
    const skillFolder = join(this.skillsDir, id)
    if (!existsSync(skillFolder)) {
      mkdirSync(skillFolder, { recursive: true })
    }
    const skillMdContent = this.formatSkillMd(skill)
    writeFileSync(join(skillFolder, 'SKILL.md'), skillMdContent, 'utf-8')

    return skill
  }

  toggleSkill(id: string, enabled: boolean): boolean {
    const all = this.listSkills()
    const skill = all.find((s) => s.id === id)
    if (!skill) return false

    skill.enabled = enabled
    skill.updatedAt = Date.now()
    writeFileSync(this.indexPath, JSON.stringify(all, null, 2), 'utf-8')
    return true
  }

  deleteSkill(id: string): boolean {
    const all = this.listSkills()
    const skill = all.find((s) => s.id === id)
    if (!skill) return false

    if (skill.builtIn) {
      // If builtIn, just reset to original preset state
      const preset = PRESET_SKILLS.find((p) => p.id === id)
      if (preset) {
        const next = all.map((s) => (s.id === id ? { ...preset } : s))
        writeFileSync(this.indexPath, JSON.stringify(next, null, 2), 'utf-8')
      }
      return true
    }

    const filtered = all.filter((s) => s.id !== id)
    writeFileSync(this.indexPath, JSON.stringify(filtered, null, 2), 'utf-8')

    const skillFolder = join(this.skillsDir, id)
    if (existsSync(skillFolder)) {
      try {
        rmSync(skillFolder, { recursive: true, force: true })
      } catch (err) {
        console.warn('[CustomSkills] Failed to delete folder:', err)
      }
    }
    return true
  }

  async importSkillFromFile(filePath: string): Promise<{ ok: boolean; skill?: CustomSkill; error?: string }> {
    try {
      if (!existsSync(filePath)) {
        return { ok: false, error: 'Tệp không tồn tại.' }
      }

      const ext = extname(filePath).toLowerCase()

      if (ext === '.zip') {
        const buffer = readFileSync(filePath)
        const zip = await JSZip.loadAsync(buffer)
        // Find SKILL.md
        let skillMdFile: JSZip.JSZipObject | null = null
        for (const [filename, fileObj] of Object.entries(zip.files)) {
          if (filename.endsWith('SKILL.md') && !fileObj.dir) {
            skillMdFile = fileObj
            break
          }
        }

        if (!skillMdFile) {
          return { ok: false, error: 'Không tìm thấy tệp SKILL.md trong gói ZIP.' }
        }

        const content = await skillMdFile.async('text')
        const parsed = this.parseSkillMd(content, basename(filePath, '.zip'))
        const saved = this.saveSkill(parsed)
        return { ok: true, skill: saved }
      }

      if (ext === '.md') {
        const content = readFileSync(filePath, 'utf-8')
        const parsed = this.parseSkillMd(content, basename(filePath, '.md'))
        const saved = this.saveSkill(parsed)
        return { ok: true, skill: saved }
      }

      if (ext === '.json') {
        const content = readFileSync(filePath, 'utf-8')
        const json = JSON.parse(content)
        const saved = this.saveSkill({
          name: json.name || json.title || 'Kỹ năng nhập',
          title: json.title || json.name,
          description: json.description,
          category: json.category,
          author: json.author,
          version: json.version,
          systemPrompt: json.systemPrompt || json.prompt || '',
          triggers: Array.isArray(json.triggers) ? json.triggers : [],
        })
        return { ok: true, skill: saved }
      }

      return { ok: false, error: `Định dạng tệp không được hỗ trợ: ${ext}. Vui lòng sử dụng .zip, .md hoặc .json.` }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async pickImportSkillDialog(): Promise<{ ok: boolean; skill?: CustomSkill; error?: string }> {
    const result = await dialog.showOpenDialog({
      title: 'Tải lên gói Kỹ năng AI (Custom Skill)',
      filters: [
        { name: 'Gói Kỹ Năng (.zip, .md, .json)', extensions: ['zip', 'md', 'json'] },
        { name: 'Tất cả các tệp', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, error: 'Đã hủy chọn tệp.' }
    }

    return this.importSkillFromFile(result.filePaths[0])
  }

  async exportSkillZip(id: string): Promise<{ ok: boolean; path?: string; error?: string }> {
    const all = this.listSkills()
    const skill = all.find((s) => s.id === id)
    if (!skill) return { ok: false, error: 'Không tìm thấy kỹ năng.' }

    const saveResult = await dialog.showSaveDialog({
      title: 'Xuất gói Kỹ năng AI (.zip)',
      defaultPath: `lycero-skill-${skill.id}.zip`,
      filters: [{ name: 'Gói Kỹ Năng (.zip)', extensions: ['zip'] }],
    })

    if (saveResult.canceled || !saveResult.filePath) {
      return { ok: false, error: 'Đã hủy lưu tệp.' }
    }

    try {
      const zip = new JSZip()
      zip.file('SKILL.md', this.formatSkillMd(skill))
      zip.file('skill.json', JSON.stringify(skill, null, 2))
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
      writeFileSync(saveResult.filePath, zipBuffer)
      return { ok: true, path: saveResult.filePath }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  openFolder(): void {
    this.ensureDirectory()
    try {
      if (typeof shell !== 'undefined' && shell?.openPath) {
        shell.openPath(this.skillsDir)
      }
    } catch {}
  }

  getActiveSkillsContext(): string {
    const active = this.listSkills().filter((s) => s.enabled)
    if (active.length === 0) return ''

    const blocks = active.map((skill) => {
      const triggersText = skill.triggers && skill.triggers.length > 0 ? ` [Từ khóa kích hoạt: ${skill.triggers.join(', ')}]` : ''
      return `### KỸ NĂNG: ${skill.name} (${skill.category.toUpperCase()})${triggersText}\n${skill.systemPrompt}`
    })

    return `\n\n## CÁC BỘ KỸ NĂNG CHUYÊN MÔN NGƯỜI DÙNG ĐÃ KÍCH HOẠT (CUSTOM SKILLS):\n${blocks.join('\n\n')}`
  }

  private formatSkillMd(skill: CustomSkill): string {
    const yaml = [
      '---',
      `name: "${skill.name.replace(/"/g, '\\"')}"`,
      `title: "${(skill.title ?? skill.name).replace(/"/g, '\\"')}"`,
      `description: "${skill.description.replace(/"/g, '\\"')}"`,
      `category: "${skill.category}"`,
      `author: "${(skill.author || '').replace(/"/g, '\\"')}"`,
      `version: "${skill.version || '1.0.0'}"`,
      skill.triggers && skill.triggers.length > 0
        ? `triggers:\n${skill.triggers.map((t) => `  - "${t.replace(/"/g, '\\"')}"`).join('\n')}`
        : 'triggers: []',
      '---',
      '',
      skill.systemPrompt,
    ].join('\n')
    return yaml
  }

  private parseSkillMd(raw: string, fallbackName: string): Partial<CustomSkill> & { name: string; systemPrompt: string } {
    let name = fallbackName
    let title = fallbackName
    let description = 'Kỹ năng tải lên'
    let category: SkillCategory = 'general'
    let author = 'Người dùng'
    let version = '1.0.0'
    const triggers: string[] = []
    let prompt = raw

    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
    if (match) {
      const yamlBlock = match[1]
      prompt = match[2].trim()

      const getVal = (key: string) => {
        const m = yamlBlock.match(new RegExp(`^${key}:\\s*["']?(.*?)["']?$`, 'm'))
        return m ? m[1].trim() : null
      }

      name = getVal('name') || name
      title = getVal('title') || title || name
      description = getVal('description') || description
      const cat = getVal('category') as SkillCategory
      if (cat && ['corporate', 'edtech', 'academic', 'creative', 'general'].includes(cat)) {
        category = cat
      }
      author = getVal('author') || author
      version = getVal('version') || version

      const triggerMatch = yamlBlock.match(/triggers:\s*\n((?:\s*-\s*.*?\n)+)/)
      if (triggerMatch) {
        const lines = triggerMatch[1].split('\n')
        for (const line of lines) {
          const m = line.match(/^\s*-\s*["']?(.*?)["']?$/)
          if (m && m[1]) triggers.push(m[1].trim())
        }
      }
    }

    return {
      name,
      title,
      description,
      category,
      author,
      version,
      triggers,
      systemPrompt: prompt,
    }
  }
}

export const customSkillsManager = new CustomSkillsManager()
