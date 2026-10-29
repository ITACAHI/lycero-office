/**
 * Lycero Office Desktop
 * Copyright 2026 ITAC AI Heavy Industries.
 * All rights reserved.
 */
import { describe, expect, it } from 'vitest';
import {
  createInitialDocumentMemory,
  recordPedagogicalAction,
  renderPedagogicalMemoryMd,
  extractActionCardFromText,
  getBloomCoverage,
  MAX_PEDAGOGICAL_MEMORY_CHARS,
} from '../src/graph-memory';

describe('Pedagogical Mini Graph Engine', () => {
  it('creates initial pedagogical document memory with seeded concepts and edges', () => {
    const memory = createInitialDocumentMemory({
      title: 'KHBD Bài 15: Phép biến hình trong không gian',
      persona: 'k12_teacher',
      curriculum: 'gdpt_2018',
      subject: 'Toán học',
      grade: '11',
      initialConcepts: [
        { label: 'Phép tịnh tiến', bloomLevel: 'remember' },
        { label: 'Phép đối xứng tâm', bloomLevel: 'understand' },
        { label: 'Ứng dụng giải toán thực tế', bloomLevel: 'apply' },
      ],
      directives: 'Bám sát công văn 5512, tích hợp hoạt động nhóm 4 người.',
    });

    expect(memory.version).toBe(1);
    expect(memory.sessionCount).toBe(1);
    expect(memory.persona).toBe('k12_teacher');
    expect(memory.curriculum).toBe('gdpt_2018');
    expect(memory.miniGraph.nodes).toHaveLength(3);
    expect(memory.miniGraph.edges).toHaveLength(2);
    expect(memory.miniGraph.edges[0]?.relation).toBe('leads_to');
    expect(memory.changelog).toHaveLength(1);
  });

  it('records pedagogical actions and expands concepts without duplicate labels', () => {
    let memory = createInitialDocumentMemory({
      title: 'Đề kiểm tra học kỳ 1 Toán 10',
      persona: 'exam_specialist',
    });

    memory = recordPedagogicalAction(memory, {
      actionType: 'add_bloom_matrix',
      summary: 'Thiết kế ma trận đề kiểm tra 4 mức độ Bloom',
      actor: 'mate_ai',
      newConcepts: [
        { label: 'Hàm số bậc hai', bloomLevel: 'remember' },
        { label: 'Bất phương trình', bloomLevel: 'understand' },
      ],
    });

    expect(memory.version).toBe(2);
    expect(memory.changelog).toHaveLength(2);
    expect(memory.miniGraph.nodes).toHaveLength(2);

    // Thêm concept trùng lặp (không phân biệt chữ hoa/thường)
    memory = recordPedagogicalAction(memory, {
      actionType: 'review',
      summary: 'Rà soát chuẩn đầu ra',
      newConcepts: [
        { label: 'hàm số bậc hai', bloomLevel: 'apply' },
        { label: 'Véc-tơ trong mặt phẳng', bloomLevel: 'apply' },
      ],
    });

    expect(memory.miniGraph.nodes).toHaveLength(3); // Chỉ tăng 1, không nhân bản
  });

  it('calculates Bloom coverage statistics correctly', () => {
    const memory = createInitialDocumentMemory({
      initialConcepts: [
        { label: 'A', bloomLevel: 'remember' },
        { label: 'B', bloomLevel: 'remember' },
        { label: 'C', bloomLevel: 'understand' },
        { label: 'D', bloomLevel: 'apply' },
        { label: 'E', bloomLevel: 'create' },
      ],
    });

    const coverage = getBloomCoverage(memory.miniGraph);
    expect(coverage.remember).toBe(2);
    expect(coverage.understand).toBe(1);
    expect(coverage.apply).toBe(1);
    expect(coverage.analyze).toBe(0);
    expect(coverage.evaluate).toBe(0);
    expect(coverage.create).toBe(1);
  });

  it('renders bounded pedagogical memory Markdown within character limits', () => {
    const memory = createInitialDocumentMemory({
      title: 'Đề cương chi tiết học phần Trí tuệ Nhân tạo',
      persona: 'university_lecturer',
      curriculum: 'aun_qa',
      subject: 'Khoa học Máy tính',
      grade: 'Năm 3',
      initialConcepts: [
        { label: 'Thuật toán A*', bloomLevel: 'understand' },
        { label: 'Học có giám sát', bloomLevel: 'apply' },
      ],
      directives: 'Đạt chuẩn đầu ra CLO1 và CLO2, kiểm định theo AUN-QA.',
    });

    const md = renderPedagogicalMemoryMd(memory);
    expect(md).toContain('# KÝ ỨC SƯ PHẠM TÀI LIỆU');
    expect(md).toContain('Giảng viên Đại học');
    expect(md).toContain('Thuật toán A*');
    expect(md).toContain('CLO1');
    expect(md.length).toBeLessThanOrEqual(MAX_PEDAGOGICAL_MEMORY_CHARS);
  });

  it('extracts ActionCardData from <action_card> XML tags', () => {
    const aiOutput = `Chào Thầy, em đã thiết kế xong mục tiêu bài học theo chuẩn Bloom:

<action_card type="insert_pedagogical_matrix" title="Chèn ma trận đề kiểm tra" description="Áp dụng ma trận 40 câu hỏi trắc nghiệm vào tài liệu">
{
  "totalQuestions": 40,
  "matrix": {
    "remember": 16,
    "understand": 12,
    "apply": 8,
    "advanced": 4
  }
}
</action_card>

Thầy bấm nút áp dụng để đưa ma trận vào bảng nhé.`;

    const extracted = extractActionCardFromText(aiOutput);
    expect(extracted.cleanText).not.toContain('<action_card>');
    expect(extracted.cleanText).toContain('Chào Thầy');
    expect(extracted.cleanText).toContain('Thầy bấm nút');
    expect(extracted.actionCard).toBeDefined();
    expect(extracted.actionCard?.type).toBe('insert_pedagogical_matrix');
    expect(extracted.actionCard?.title).toBe('Chèn ma trận đề kiểm tra');
    expect(extracted.actionCard?.payload.totalQuestions).toBe(40);
  });

  it('extracts ActionCardData from ```action_card code blocks', () => {
    const aiOutput = `Đã phân tích xong đề cương:
\`\`\`action_card
{
  "type": "update_syllabus_week",
  "title": "Cập nhật Tuần 5: Mạng nơ-ron tích chập",
  "description": "Bổ sung bài tập thực hành nhận diện ảnh",
  "payload": { "week": 5, "labHours": 3 }
}
\`\`\`
Mời Thầy xem xét.`;

    const extracted = extractActionCardFromText(aiOutput);
    expect(extracted.cleanText).not.toContain('```action_card');
    expect(extracted.actionCard?.type).toBe('update_syllabus_week');
    expect(extracted.actionCard?.payload.week).toBe(5);
  });
});
