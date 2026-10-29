/**
 * Lycero Office Desktop
 * Copyright 2026 ITAC AI Heavy Industries.
 * All rights reserved.
 */
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  embedDocumentProvenance,
  extractDocumentProvenance,
  isZipArchive,
  patchCustomPropertiesXml,
  parseProvenanceFromCustomPropsXml,
} from '../src/provenance';
import {
  createInitialDocumentMemory,
  recordPedagogicalAction,
} from '../src/graph-memory';

describe('Office Document Hidden Provenance Service', () => {
  it('correctly detects ZIP / OOXML archives', () => {
    const validZipMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    const invalidData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);

    expect(isZipArchive(validZipMagic)).toBe(true);
    expect(isZipArchive(invalidData)).toBe(false);
  });

  it('embeds and extracts PedagogicalDocumentMemory into OOXML zip', async () => {
    // Tạo một khung tệp OOXML mẫu (như DOCX / PPTX / XLSX)
    const initialZip = new JSZip();
    initialZip.file(
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>'
    );
    initialZip.file(
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    );
    initialZip.file(
      'word/document.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Nội dung bài học Toán 12</w:t></w:r></w:p></w:body></w:document>'
    );

    const zipBytes = await initialZip.generateAsync({ type: 'uint8array' });

    // Tạo Ký ức Sư phạm
    const memory = createInitialDocumentMemory({
      documentId: 'doc_khbd_2026_001',
      title: 'Kế hoạch bài dạy Khảo sát hàm số GDPT 2018',
      persona: 'k12_teacher',
      curriculum: 'gdpt_2018',
      subject: 'Toán học',
      grade: '12',
      initialConcepts: [
        { label: 'Tính đơn điệu của hàm số', bloomLevel: 'remember' },
        { label: 'Cực trị của hàm số', bloomLevel: 'understand' },
        { label: 'Ứng dụng đạo hàm giải bài toán thực tế', bloomLevel: 'apply' },
      ],
      directives: 'Thời lượng 2 tiết, kết hợp phương pháp dạy học nêu vấn đề.',
    });

    // 1. Nhúng ký ức sư phạm vào tệp
    const enrichedBytes = await embedDocumentProvenance(zipBytes, memory);
    expect(isZipArchive(enrichedBytes)).toBe(true);

    // 2. Trích xuất lại từ byte của tệp (mô phỏng thiết bị khác hoặc phiên sau mở file)
    const extractedMemory = await extractDocumentProvenance(enrichedBytes);
    expect(extractedMemory).not.toBeNull();
    expect(extractedMemory?.documentId).toBe('doc_khbd_2026_001');
    expect(extractedMemory?.title).toBe('Kế hoạch bài dạy Khảo sát hàm số GDPT 2018');
    expect(extractedMemory?.persona).toBe('k12_teacher');
    expect(extractedMemory?.curriculum).toBe('gdpt_2018');
    expect(extractedMemory?.subject).toBe('Toán học');
    expect(extractedMemory?.grade).toBe('12');
    expect(extractedMemory?.directives).toContain('Thời lượng 2 tiết');
    expect(extractedMemory?.miniGraph.nodes).toHaveLength(3);
    expect(extractedMemory?.miniGraph.nodes[0]?.label).toBe('Tính đơn điệu của hàm số');
    expect(extractedMemory?.miniGraph.nodes[0]?.bloomLevel).toBe('remember');
    expect(extractedMemory?.miniGraph.edges).toHaveLength(2);

    // 3. Kiểm tra tính toàn vẹn của nội dung gốc trong tệp Word
    const checkZip = await JSZip.loadAsync(enrichedBytes);
    const docXml = await checkZip.file('word/document.xml')?.async('string');
    expect(docXml).toContain('Nội dung bài học Toán 12');

    // 4. Kiểm tra sự tồn tại của docProps/custom.xml và các relationship
    expect(checkZip.file('docProps/custom.xml')).not.toBeNull();
    const relsXml = await checkZip.file('_rels/.rels')?.async('string');
    expect(relsXml).toContain('custom-properties');
    const ctXml = await checkZip.file('[Content_Types].xml')?.async('string');
    expect(ctXml).toContain('custom-properties+xml');
  });

  it('updates provenance across multiple sessions preserving changelog', async () => {
    let memory = createInitialDocumentMemory({
      documentId: 'doc_exam_002',
      title: 'Đề thi thử THPT Quốc gia',
      persona: 'exam_specialist',
    });

    const initialXml = patchCustomPropertiesXml(null, memory);
    expect(initialXml).toContain('LYCERO_PROV_DOC_ID');
    expect(initialXml).toContain('doc_exam_002');

    // Phiên 2: Thêm hành động và sửa đổi
    memory = recordPedagogicalAction(memory, {
      actionType: 'refine_questions',
      summary: 'Điều chỉnh 4 câu vận dụng cao về xác suất có điều kiện',
      actor: 'teacher',
      newConcepts: [
        { label: 'Xác suất có điều kiện', bloomLevel: 'analyze' },
      ],
    });

    const updatedXml = patchCustomPropertiesXml(initialXml, memory);
    const reParsed = parseProvenanceFromCustomPropsXml(updatedXml);

    expect(reParsed).not.toBeNull();
    expect(reParsed?.version).toBe(2);
    expect(reParsed?.changelog).toHaveLength(2);
    expect(reParsed?.changelog[1]?.summary).toContain('xác suất có điều kiện');
    expect(reParsed?.miniGraph.nodes).toHaveLength(1);
    expect(reParsed?.miniGraph.nodes[0]?.label).toBe('Xác suất có điều kiện');
    expect(reParsed?.miniGraph.nodes[0]?.bloomLevel).toBe('analyze');
  });
});
