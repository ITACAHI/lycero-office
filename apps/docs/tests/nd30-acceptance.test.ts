/**
 * Lycero Office Desktop — NĐ 30/2020/NĐ-CP Acceptance Test Suite (v2.0.16)
 * Verifies all 8 QA requirements (1a–1h) for Vietnamese Administrative Documents.
 */
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import {
  BLANK_BULLET_NUM_ID,
  BLANK_ORDERED_NUM_ID,
  buildBlankDocx,
  parseDocx,
  readSectionSettings,
  saveDocx,
  type SectionSettings,
} from '@lycero/docx-engine'
import { blocksToPmDoc, pmDocToSavePlan, type PmNode } from '../src/renderer/editor/convert'
import { executeTool } from '../src/renderer/ai/tools'
import type { AiPageSetupAccess } from '../src/renderer/ai/page-setup'
import { buildDocWriterRequest, type AiDocWriter } from '../src/renderer/ai/doc-writer'

const NUM_IDS = { bullet: BLANK_BULLET_NUM_ID, ordered: BLANK_ORDERED_NUM_ID }

const SAMPLE_ND30_TO_TRINH_45TR_HTML = `
<table style="width: 100%; border: none; border-collapse: collapse;">
  <tr>
    <td style="width: 44%; text-align: center; vertical-align: top; border: none;">
      <p style="text-align: center; font-size: 12pt;">ỦY BAN NHÂN DÂN THÀNH PHỐ HÀ NỘI</p>
      <p style="text-align: center; font-size: 13pt;"><strong><u>SỞ GIÁO DỤC VÀ ĐÀO TẠO</u></strong></p>
      <p style="text-align: center; font-size: 13pt;">Số: 15/2026/TTr-SGDĐT</p>
    </td>
    <td style="width: 56%; text-align: center; vertical-align: top; border: none;">
      <p style="text-align: center; font-size: 12pt;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></p>
      <p style="text-align: center; font-size: 13pt;"><strong><u>Độc lập - Tự do - Hạnh phúc</u></strong></p>
      <p style="text-align: center; font-size: 13pt;"><em>Hà Nội, ngày 30 tháng 10 năm 2026</em></p>
    </td>
  </tr>
</table>
<h1 style="text-align: center;"><strong>TỜ TRÌNH</strong></h1>
<p style="text-align: center;"><strong>Về việc phê duyệt kinh phí tổ chức Hội nghị tập huấn chuyển đổi số ngành Giáo dục năm 2026</strong></p>
<p style="text-align: center;">Kính gửi: Ban Giám đốc Sở Giáo dục và Đào tạo Hà Nội</p>
<p style="text-align: left;"><em>Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020 của Chính phủ về công tác văn thư;</em></p>
<p style="text-align: left;"><em>Căn cứ Quyết định số 18/2026/QĐ-SGDĐT ngày 15 tháng 01 năm 2026 về việc ban hành Quy chế chi tiêu nội bộ và quản lý tài sản công năm 2026;</em></p>
<p style="text-align: left;"><em>Căn cứ Kế hoạch số 42/KH-SGDĐT ngày 10 tháng 10 năm 2026 về việc triển khai tập huấn ứng dụng Trí tuệ nhân tạo và học liệu số cho cán bộ quản lý năm 2026;</em></p>
<p style="text-align: justify;">Thực hiện nhiệm vụ trọng tâm năm học 2026 - 2027, Phòng Công nghệ Thông tin và Chuyển đổi số kính trình Ban Giám đốc Sở xem xét, phê duyệt dự toán kinh phí tổ chức Hội nghị tập huấn chuyển đổi số với tổng kinh phí là 45.000.000 đồng, chi tiết như sau:</p>
<table>
  <tr>
    <th>STT</th>
    <th>Nội dung chi</th>
    <th>ĐVT</th>
    <th>SL</th>
    <th>Đơn giá</th>
    <th>Thành tiền</th>
  </tr>
  <tr>
    <td>1</td>
    <td>Thuê hội trường, hệ thống âm thanh, ánh sáng và màn hình LED phục vụ hội nghị</td>
    <td>Buổi</td>
    <td>2</td>
    <td>7.500.000</td>
    <td>15.000.000</td>
  </tr>
  <tr>
    <td>2</td>
    <td>Chi thù lao báo cáo viên, chuyên gia đào tạo kỹ năng ứng dụng AI trong giảng dạy</td>
    <td>Buổi</td>
    <td>4</td>
    <td>3.000.000</td>
    <td>12.000.000</td>
  </tr>
  <tr>
    <td>3</td>
    <td>In ấn tài liệu cẩm nang thực hành, văn phòng phẩm và thẻ đại biểu tham dự</td>
    <td>Bộ</td>
    <td>150</td>
    <td>80.000</td>
    <td>12.000.000</td>
  </tr>
  <tr>
    <td>4</td>
    <td>Chi nước uống, giải khát giữa giờ (Teabreak) cho đại biểu và học viên</td>
    <td>Suất</td>
    <td>150</td>
    <td>40.000</td>
    <td>6.000.000</td>
  </tr>
  <tr>
    <td></td>
    <td><strong>TỔNG CỘNG</strong></td>
    <td></td>
    <td></td>
    <td></td>
    <td><strong>45.000.000</strong></td>
  </tr>
</table>
<p style="text-align: left;"><em>Số tiền bằng chữ: Bốn mươi lăm triệu đồng chẵn.</em></p>
<p style="text-align: justify;">Phòng Công nghệ Thông tin và Chuyển đổi số kính trình Ban Giám đốc Sở xem xét, phê duyệt để đơn vị triển khai thực hiện đúng tiến độ./.</p>
<table style="width: 100%; border: none; border-collapse: collapse;">
  <tr>
    <td style="width: 45%; text-align: left; vertical-align: top; border: none;">
      <p style="text-align: left; font-size: 12pt;"><strong><em>Nơi nhận:</em></strong></p>
      <p style="text-align: left; font-size: 11pt;">- Như trên;</p>
      <p style="text-align: left; font-size: 11pt;">- Phòng Kế hoạch - Tài chính;</p>
      <p style="text-align: left; font-size: 11pt;">- Lưu: VT, CNTT.</p>
    </td>
    <td style="width: 55%; text-align: center; vertical-align: top; border: none;">
      <p style="text-align: center; font-size: 13pt;"><strong>TRƯỞNG PHÒNG</strong></p>
      <p style="text-align: center; font-size: 12pt;"><em>(Ký, ghi rõ họ tên và đóng dấu)</em></p>
      <p></p>
      <p></p>
      <p></p>
      <p style="text-align: center; font-size: 13pt;"><strong>Nguyễn Văn Minh</strong></p>
    </td>
  </tr>
</table>
`.trim()

describe('NĐ 30/2020/NĐ-CP Administrative Document Acceptance Suite (v2.0.16)', () => {
  it('1h) buildDocWriterRequest includes strict NĐ30 rules, 6-col budget ratios, keep-with-next, and forbids {{PLACEHOLDER}}', () => {
    const { system } = buildDocWriterRequest(
      {
        plan: 'Tờ trình xin kinh phí 45.000.000đ',
        title: 'Tờ trình xin kinh phí',
        instruction: 'Soạn tờ trình xin kinh phí 45.000.000đ',
      },
      '',
    )
    expect(system).toContain('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')
    expect(system).toContain('Độc lập - Tự do - Hạnh phúc')
    expect(system).toContain('width: 44%')
    expect(system).toContain('width: 56%')
    expect(system).toContain('{{PLACEHOLDER}}')
    expect(system).toContain('TỔNG CỘNG')
  })

  it('1a–1g) write_document produces compliant NĐ30 .docx with 2-col header, A4 20/20/30/15mm margins, left-aligned Căn cứ, 6-col proportional budget table, keepNext closing, and zero aiChanged highlights', async () => {
    const { editorExtensions } = await import('../src/renderer/editor/extensions')
    const parsed = await parseDocx(await buildBlankDocx())
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: editorExtensions,
    })
    editor.commands.setContent(blocksToPmDoc(parsed.blocks) as never)

    let currentSection: SectionSettings = readSectionSettings(parsed) ?? {
      pageWidth: 11906,
      pageHeight: 16838,
      marginTop: 1440,
      marginBottom: 1440,
      marginLeft: 1800,
      marginRight: 1800,
      headerDist: 720,
      footerDist: 720,
      orientation: 'portrait',
      pageBorder: false,
      columns: 1,
    }

    const pageSetup: AiPageSetupAccess = {
      list: () => [
        {
          index: 0,
          firstBlock: 0,
          lastBlock: 0,
          paper: 'Letter',
          width: currentSection.pageWidth,
          height: currentSection.pageHeight,
          orientation: currentSection.orientation,
          margins: {
            top: currentSection.marginTop,
            right: currentSection.marginRight,
            bottom: currentSection.marginBottom,
            left: currentSection.marginLeft,
            header: currentSection.headerDist ?? 720,
            footer: currentSection.footerDist ?? 720,
            gutter: currentSection.gutter ?? 0,
          },
          columns: { count: 1, spacing: 720 },
          titlePg: false,
          startType: 'nextPage',
        },
      ],
      current: () => ({
        settings: currentSection,
        firstBlockIndex: 0,
        lastBlockIndex: 0,
        startType: 'nextPage',
        titlePg: false,
        sectPrXml: '',
        headerRefs: {},
        footerRefs: {},
      }),
      set: (_idx, next) => {
        currentSection = next.settings
        return null
      },
      insertBreak: () => 'not needed',
    }

    const writer: AiDocWriter = {
      write: async (_spec, onProgress) => {
        onProgress(SAMPLE_ND30_TO_TRINH_45TR_HTML)
        return { ok: true, html: SAMPLE_ND30_TO_TRINH_45TR_HTML }
      },
    }

    const res = await executeTool(
      editor,
      {
        id: 'call_nd30_1',
        name: 'write_document',
        input: {
          title: 'Tờ trình phê duyệt kinh phí 45.000.000đ',
          plan: 'Quốc hiệu Tiêu ngữ 2 cột, Căn cứ, Bảng dự toán 45.000.000đ, Nơi nhận và Chữ ký',
        },
      },
      NUM_IDS,
      undefined,
      undefined,
      null,
      undefined,
      undefined,
      writer,
      pageSetup,
    )

    expect(res.isError).toBeUndefined()
    expect(res.mutated).toBe(true)

    // 1b) Check A4 page setup and NĐ30 margins (top 20mm=1134, bottom 20mm=1134, left 30mm=1701, right 15mm=851)
    expect(currentSection.pageWidth).toBe(11906)
    expect(currentSection.pageHeight).toBe(16838)
    expect(currentSection.marginTop).toBe(1134)
    expect(currentSection.marginBottom).toBe(1134)
    expect(currentSection.marginLeft).toBe(1701)
    expect(currentSection.marginRight).toBe(851)

    const pmJson = editor.getJSON() as PmNode
    const plan = pmDocToSavePlan(pmJson, parsed.blocks)

    // 1g) Verify ALL nodes in the editor have aiChanged === false (clean state, no highlight bar)
    const walkAiChanged = (node: PmNode): boolean[] => {
      const flags: boolean[] = []
      if (node.attrs && 'aiChanged' in node.attrs) {
        flags.push(Boolean(node.attrs.aiChanged))
      }
      for (const child of node.content ?? []) {
        flags.push(...walkAiChanged(child))
      }
      return flags
    }
    const aiFlags = walkAiChanged(pmJson)
    expect(aiFlags.every((f) => f === false)).toBe(true)

    // Serialize to real .docx bytes (without explicit options to prove saveDocx auto-enforces NĐ30 styles.xml + pgMar)
    const docxBytes = await saveDocx(parsed, plan.saveBlocks)

    // Directly inspect raw word/document.xml and word/styles.xml inside the .docx zip (matching QA's exact XML inspection)
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(docxBytes)
    const rawDocXml = await zip.file('word/document.xml')!.async('string')
    const rawStylesXml = await zip.file('word/styles.xml')!.async('string')

    // QA Item 1: styles.xml default font is Times New Roman (ascii/hAnsi/cs/eastAsia), zero Calibri in styles.xml or document.xml
    expect(rawStylesXml).not.toContain('Calibri')
    expect(rawDocXml).not.toContain('Calibri')
    expect(rawStylesXml).toContain('w:ascii="Times New Roman"')
    expect(rawStylesXml).toContain('w:hAnsi="Times New Roman"')
    expect(rawStylesXml).toContain('w:cs="Times New Roman"')
    expect(rawStylesXml).toContain('w:eastAsia="Times New Roman"')

    // QA Item 2: pgMar in document.xml is top=1134, bottom=1134, left=1701, right=851 (20/20/30/15 mm)
    expect(rawDocXml).toMatch(/<w:pgMar[^>]*\bw:top="1134"/)
    expect(rawDocXml).toMatch(/<w:pgMar[^>]*\bw:bottom="1134"/)
    expect(rawDocXml).toMatch(/<w:pgMar[^>]*\bw:left="1701"/)
    expect(rawDocXml).toMatch(/<w:pgMar[^>]*\bw:right="85[01]"/)

    // QA Item 3: Budget table gridCol in document.xml has proportional widths [560, 3900, 900, 700, 1400, 1600] (NOT 6 × 1560) and tblLayout fixed
    expect(rawDocXml).not.toContain('<w:gridCol w:w="1560"/>')
    expect(rawDocXml).toContain('<w:tblLayout w:type="fixed"/>')
    expect(rawDocXml).toContain('<w:tcW w:w="560" w:type="dxa"/>')
    expect(rawDocXml).toContain('<w:tcW w:w="3900" w:type="dxa"/>')
    expect(rawDocXml).toContain(
      '<w:tblGrid>' +
        '<w:gridCol w:w="560"/>' +
        '<w:gridCol w:w="3900"/>' +
        '<w:gridCol w:w="900"/>' +
        '<w:gridCol w:w="700"/>' +
        '<w:gridCol w:w="1400"/>' +
        '<w:gridCol w:w="1600"/>' +
        '</w:tblGrid>',
    )

    // QA Item 4: Closing paragraph has <w:keepNext/> and <w:keepLines/>, and Nơi nhận + signature table has <w:cantSplit/>
    expect(rawDocXml).toContain('<w:keepNext/>')
    expect(rawDocXml).toContain('<w:keepLines/>')
    expect(rawDocXml).toContain('<w:cantSplit/>')

    // QA Item 5: Nơi nhận has line="240" (1.0), after="0", "Nơi nhận:" bold + italic size 22 (11pt), items size 22 (11pt)
    expect(rawDocXml).toContain(
      '<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>' +
        '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>' +
        '<w:b/><w:bCs/><w:i/><w:iCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>' +
        '<w:t xml:space="preserve">Nơi nhận:</w:t></w:r></w:p>',
    )
    expect(rawDocXml).toContain(
      '<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>' +
        '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>' +
        '<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>' +
        '<w:t xml:space="preserve">- Như trên;</w:t></w:r></w:p>',
    )
    const reparsed = await parseDocx(docxBytes)
    const blocks = reparsed.blocks

    // 1h) Verify no {{PLACEHOLDER}} anywhere in the document
    const fullText = JSON.stringify(blocks)
    expect(fullText).not.toContain('{{')
    expect(fullText).not.toContain('PLACEHOLDER')

    // 1a) First block is the 2-column borderless Header Table
    const headerBlock = blocks[0]
    expect(headerBlock?.type).toBe('table')
    if (headerBlock?.type === 'table' && headerBlock.table) {
      const tm = headerBlock.table
      expect(tm.rows.length).toBe(1)
      expect(tm.rows[0]?.length).toBe(2)
      // Proportional widths ~44% and ~56%
      expect(tm.colWidthsPct?.[0]).toBeCloseTo(44, 0)
      expect(tm.colWidthsPct?.[1]).toBeCloseTo(56, 0)
      const leftCell = tm.rows[0]![0]!
      const rightCell = tm.rows[0]![1]!
      // In OOXML, 'top' is the default cell vertical alignment when w:vAlign is omitted
      expect(leftCell.vAlign ?? 'top').toBe('top')
      expect(rightCell.vAlign ?? 'top').toBe('top')
      const leftParas = leftCell.richParas ?? []
      const rightParas = rightCell.richParas ?? []
      // Left cell: governing body not bold, issuing body bold + underline, Số/ký hiệu present
      expect(leftParas[0]?.runs[0]?.text).toContain('ỦY BAN NHÂN DÂN')
      expect(leftParas[0]?.runs[0]?.bold).toBeFalsy()
      expect(leftParas[1]?.runs[0]?.text).toContain('SỞ GIÁO DỤC VÀ ĐÀO TẠO')
      expect(leftParas[1]?.runs[0]?.bold).toBe(true)
      expect(leftParas[1]?.runs[0]?.underline).toBe(true)
      expect(leftParas[2]?.runs.map((r) => r.text).join('')).toContain('Số: 15/2026/TTr-SGDĐT')
      // Right cell: Quốc hiệu bold uppercase, Tiêu ngữ bold underline, date italic
      expect(rightParas[0]?.runs[0]?.text).toBe('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')
      expect(rightParas[0]?.runs[0]?.bold).toBe(true)
      expect(rightParas[1]?.runs[0]?.text).toBe('Độc lập - Tự do - Hạnh phúc')
      expect(rightParas[1]?.runs[0]?.bold).toBe(true)
      expect(rightParas[1]?.runs[0]?.underline).toBe(true)
      expect(rightParas[2]?.runs[0]?.italic).toBe(true)
    }

    // 1c) Căn cứ paragraphs are italic and left-aligned (NOT justified)
    const canCuBlocks = blocks.filter(
      (b) =>
        b.type === 'paragraph' &&
        (b.runs ?? []).map((r) => r.text).join('').trim().startsWith('Căn cứ '),
    )
    expect(canCuBlocks.length).toBeGreaterThanOrEqual(3)
    for (const b of canCuBlocks) {
      if (b.type === 'paragraph') {
        expect(b.format?.align).toBe('left')
        expect((b.runs ?? []).every((r) => !r.text.trim() || r.italic)).toBe(true)
      }
    }

    // 1d & 1f) Budget table (6 columns) has proportional widths (6%, 44%, 10%, 8%, 15%, 17%), right-aligned amounts, bold TỔNG CỘNG, and no pageBreakBefore
    const tableBlocks = blocks.filter((b) => b.type === 'table')
    expect(tableBlocks.length).toBe(3) // Header table, Budget table, Signature table
    const budgetBlock = tableBlocks[1]!
    if (budgetBlock.type === 'table' && budgetBlock.table) {
      const bm = budgetBlock.table
      expect(bm.colWidthsPct?.length).toBe(6)
      expect(bm.colWidthsTwips).toEqual([560, 3900, 900, 700, 1400, 1600])
      expect(bm.colWidthsPct?.[0]).toBeCloseTo(6.18, 1)
      expect(bm.colWidthsPct?.[1]).toBeCloseTo(43.05, 1)
      expect(bm.colWidthsPct?.[2]).toBeCloseTo(9.93, 1)
      expect(bm.colWidthsPct?.[3]).toBeCloseTo(7.73, 1)
      expect(bm.colWidthsPct?.[4]).toBeCloseTo(15.45, 1)
      expect(bm.colWidthsPct?.[5]).toBeCloseTo(17.66, 1)
      // Verify header row is bold and centered
      for (const hCell of bm.rows[0]!) {
        expect(hCell.richParas?.[0]?.align).toBe('center')
        expect(hCell.richParas?.[0]?.runs[0]?.bold).toBe(true)
      }
      // Verify numeric columns (Unit price col 4, Amount col 5) are right-aligned with dot separators
      expect(bm.rows[1]?.[4]?.richParas?.[0]?.align).toBe('right')
      expect(bm.rows[1]?.[5]?.richParas?.[0]?.align).toBe('right')
      expect(bm.rows[1]?.[5]?.richParas?.[0]?.runs[0]?.text).toBe('15.000.000')
      // Verify TỔNG CỘNG row is bold with Vietnamese diacritics and 45.000.000
      const totalRow = bm.rows[bm.rows.length - 1]!
      const totalLabel = totalRow[1]?.richParas?.[0]?.runs.map((r) => r.text).join('')
      const totalAmount = totalRow[5]?.richParas?.[0]?.runs.map((r) => r.text).join('')
      expect(totalLabel).toBe('TỔNG CỘNG')
      expect(totalRow[1]?.richParas?.[0]?.runs[0]?.bold).toBe(true)
      expect(totalAmount).toBe('45.000.000')
      expect(totalRow[5]?.richParas?.[0]?.runs[0]?.bold).toBe(true)
    }

    // 1e) Closing paragraph before signature table has keepNext: true, and signature block has 3–4 blank lines for signature/stamp
    const sigTableIdx = blocks.findIndex((b, idx) => idx > 0 && b.type === 'table' && b !== budgetBlock)
    expect(sigTableIdx).toBeGreaterThan(1)
    const closingPara = blocks[sigTableIdx - 1]
    expect(closingPara?.type).toBe('paragraph')
    if (closingPara?.type === 'paragraph') {
      expect(closingPara.format?.keepNext).toBe(true)
    }
    const sigBlock = blocks[sigTableIdx]
    if (sigBlock?.type === 'table' && sigBlock.table) {
      const rightSigCell = sigBlock.table.rows[0]![1]!
      const sigParas = rightSigCell.richParas ?? []
      expect(sigParas.length).toBeGreaterThanOrEqual(5)
      const signerName = sigParas[sigParas.length - 1]?.runs
        .map((r) => r.text)
        .join('')
      expect(signerName).toBe('Nguyễn Văn Minh')
    }

    // Write verified .docx artifact to Template Office bundle for immediate QA inspection in Word/LibreOffice
    const fs = await import('node:fs')
    const path = await import('node:path')
    const outDir = 'd:/Template Office/Lycero-Cloud-Skills-And-Templates-Bundle/03-exported-templates-60/docs/admin_nd30'
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(
      path.join(outDir, 'to-trinh-xin-kinh-phi-45tr-nd30-verified.docx'),
      Buffer.from(docxBytes),
    )

    editor.destroy()
  })

  it('4 & 5) auto-packs standalone Nơi nhận + signature paragraphs AND collapses multi-row signature tables into a 1-row × 2-cell table with cantSplit and 11pt spacing', async () => {
    const { parseHtmlFragment } = await import('../src/renderer/ai/protocol')
    const nodes = parseHtmlFragment(
      `<h1>TỜ TRÌNH</h1>
       <p>Kính trình Ban Giám hiệu xem xét phê duyệt./.</p>
       <p>Nơi nhận:</p>
       <p>- Như trên;</p>
       <p>- Lưu: VT.</p>
       <p>HIỆU TRƯỞNG</p>
       <p>Trần Văn B</p>`,
      NUM_IDS,
    )
    const lastNode = nodes[nodes.length - 1]
    expect(lastNode?.type).toBe('docTable')
    expect(lastNode?.content?.[0]?.attrs?.cantSplit).toBe(true)
    const prevNode = nodes[nodes.length - 2]
    expect(prevNode?.attrs?.keepNext).toBe(true)
    expect(prevNode?.attrs?.keepLines).toBe(true)

    // Multi-row signature table (like TỜ TRÌNH-6.docx with 5 rows and empty rows) -> collapsed into 1 row × 2 cells
    const multiRowNodes = parseHtmlFragment(
      `<h1>TỜ TRÌNH</h1>
       <p>Trường THPT chuyên kính trình Sở Giáo dục và Đào tạo xem xét, phê duyệt./.</p>
       <table>
         <tr><td><b><i>Nơi nhận:</i></b></td><td><b>HIỆU TRƯỞNG</b></td></tr>
         <tr><td>- Như trên;</td><td><i>(Ký, ghi rõ họ tên và đóng dấu)</i></td></tr>
         <tr><td>- Ban Giám hiệu;</td><td></td></tr>
         <tr><td>- Lưu: VT, KT.</td><td></td></tr>
         <tr><td></td><td></td></tr>
         <tr><td></td><td><b>Nguyễn Văn An</b></td></tr>
       </table>`,
      NUM_IDS,
    )
    const sigTbl = multiRowNodes[multiRowNodes.length - 1]
    expect(sigTbl?.type).toBe('docTable')
    expect(sigTbl?.content?.length).toBe(1) // Collapsed into 1 single row!
    expect(sigTbl?.content?.[0]?.attrs?.cantSplit).toBe(true)
    expect(sigTbl?.attrs?.colWidthsPct).toEqual([45, 55])
    const leftCellParas = sigTbl?.content?.[0]?.content?.[0]?.content ?? []
    expect(leftCellParas.length).toBe(4) // Nơi nhận: + 3 items in 1 cell
    const rightCellParas = sigTbl?.content?.[0]?.content?.[1]?.content ?? []
    expect(rightCellParas.length).toBe(6) // HIỆU TRƯỞNG + (Ký...) + 3 blank lines + Nguyễn Văn An in 1 cell
    const closingNode = multiRowNodes[multiRowNodes.length - 2]
    expect(closingNode?.attrs?.keepNext).toBe(true)
  })

  it('6) exports all 12 new statutory Vietnamese forms (CT01, 04/ĐK, 11/ĐK, 01/LPTB, 01/ĐNHT, NĐ96, CV2345, CV7991, 05-TT, HR, NCR) as verified .docx files with Times New Roman and A4 NĐ30 margins', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const JSZip = (await import('jszip')).default
    const { editorExtensions } = await import('../src/renderer/editor/extensions')

    const docsRoot = 'd:/Template Office/Lycero-Cloud-Skills-And-Templates-Bundle/03-exported-templates-60/docs'
    const newFormSlugs: Array<{ slug: string; category: string }> = [
      { slug: 'to-khai-tam-tru-ct01-tt66', category: 'admin_nd30' },
      { slug: 'don-xin-xac-nhan-tam-tru-nhan-than', category: 'admin_nd30' },
      { slug: 'don-cap-so-do-lan-dau-mau04dk', category: 'admin_nd30' },
      { slug: 'don-dang-ky-bien-dong-dat-dai-mau11dk', category: 'admin_nd30' },
      { slug: 'to-khai-thue-le-phi-truoc-ba-nha-dat-01lptb', category: 'finance_accounting' },
      { slug: 'don-de-nghi-hoan-thue-gia-han-nop-thue-tt80', category: 'finance_accounting' },
      { slug: 'hop-dong-chuyen-nhuong-nha-dat-nd96', category: 'legal_contract' },
      { slug: 'ke-hoach-bai-day-tieu-hoc-cv2345', category: 'edtech_5512' },
      { slug: 'de-kiem-tra-dinh-ky-cv7991-gdpt2018', category: 'edtech_5512' },
      { slug: 'giay-de-nghi-thanh-toan-tam-ung-tt200', category: 'finance_accounting' },
      { slug: 'bien-ban-ban-giao-cong-viec-tai-san-hr', category: 'hr_form' },
      { slug: 'bao-cao-su-co-khong-phu-hop-ncr-capa-iso9001', category: 'admin_nd30' },
    ]

    for (const item of newFormSlugs) {
      const htmlPath = path.join(docsRoot, item.category, `${item.slug}.html`)
      if (!fs.existsSync(htmlPath)) continue
      const html = fs.readFileSync(htmlPath, 'utf8')

      const parsed = await parseDocx(await buildBlankDocx())
      const editor = new Editor({
        element: document.createElement('div'),
        extensions: editorExtensions,
      })
      editor.commands.setContent(blocksToPmDoc(parsed.blocks) as never)

      const writer: AiDocWriter = {
        write: async (_spec, onProgress) => {
          onProgress(html)
          return { ok: true, html }
        },
      }

      const res = await executeTool(
        editor,
        {
          id: `call_${item.slug}`,
          name: 'write_document',
          input: { title: item.slug, plan: item.slug },
        },
        NUM_IDS,
        undefined,
        undefined,
        null,
        undefined,
        undefined,
        writer,
      )
      expect(res.isError).toBeUndefined()

      const pmJson = editor.getJSON() as PmNode
      const plan = pmDocToSavePlan(pmJson, parsed.blocks)
      const docxBytes = await saveDocx(parsed, plan.saveBlocks)

      const zip = await JSZip.loadAsync(docxBytes)
      const rawDocXml = await zip.file('word/document.xml')!.async('string')
      const rawStylesXml = await zip.file('word/styles.xml')!.async('string')

      expect(rawStylesXml).toContain('w:ascii="Times New Roman"')
      expect(rawStylesXml).not.toContain('Calibri')
      expect(rawDocXml).not.toContain('Calibri')
      expect(rawDocXml).toMatch(/<w:pgMar[^>]*\bw:left="1701"/)
      expect(rawDocXml).toMatch(/<w:pgMar[^>]*\bw:right="85[01]"/)

      const outDocxPath = path.join(docsRoot, item.category, `${item.slug}.docx`)
      fs.writeFileSync(outDocxPath, Buffer.from(docxBytes))
      editor.destroy()
    }
  })
})
