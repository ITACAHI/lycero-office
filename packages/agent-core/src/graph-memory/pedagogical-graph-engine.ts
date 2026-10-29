/**
 * Lycero Office Desktop
 * Copyright 2026 ITAC AI Heavy Industries.
 * All rights reserved.
 */
import type {
  ActionCardData,
  BloomLevel,
  CurriculumStandard,
  DocumentChangelogEntry,
  DocumentMiniGraph,
  MiniGraphEdge,
  MiniGraphNode,
  MiniGraphNodeType,
  PedagogicalDocumentMemory,
  PedagogicalPersona,
} from './types';

/** Giới hạn ký tự tối đa cho file Markdown ký ức tài liệu (~500 tokens) để bảo toàn context window */
export const MAX_PEDAGOGICAL_MEMORY_CHARS = 2500;

/** Nhãn người dạy tương ứng với Persona */
export const PERSONA_LABELS: Record<PedagogicalPersona, string> = {
  k12_teacher: 'Giáo viên Phổ thông K-12 (GDPT 2018)',
  international_teacher: 'Giáo viên Trường Quốc tế (IB / Cambridge / AP)',
  university_lecturer: 'Giảng viên Đại học & Cao đẳng (CLO / PLO)',
  academic_researcher: 'Nghiên cứu sinh & Viện sĩ (Scopus / APA)',
  exam_specialist: 'Chuyên gia Khảo thí & Luyện thi (ĐGNL / 9+)',
  language_trainer: 'Giáo viên Ngoại ngữ & Khảo thí (CEFR / IELTS)',
  vocational_instructor: 'Giảng viên Dạy nghề & Kỹ thuật (VQF / SOP)',
  corporate_trainer: 'Chuyên gia Huấn luyện Doanh nghiệp (ADDIE)',
  independent_tutor: 'Gia sư Tự do & Dạy kèm Cá nhân hóa',
  kindergarten_teacher: 'Giáo viên Mầm non (Montessori / Reggio)',
  sped_educator: 'Giáo viên Giáo dục Đặc biệt & Hòa nhập (IEP / UDL)',
};

/** Nhãn khung chương trình */
export const CURRICULUM_LABELS: Record<CurriculumStandard, string> = {
  gdpt_2018: 'GDPT 2018 (Việt Nam)',
  aun_qa: 'Chuẩn Kiểm định AUN-QA',
  ib_myp_dp: 'Tú tài Quốc tế (IB MYP/DP)',
  cambridge_cie: 'Cambridge International (CIE)',
  us_ap: 'Advanced Placement (AP Mỹ)',
  cefr: 'Khung Tham chiếu Châu Âu (CEFR)',
  vqf: 'Khung Trình độ Quốc gia (VQF)',
  custom: 'Chương trình Tùy biến',
};

export const BLOOM_LABELS: Record<BloomLevel, string> = {
  remember: 'Nhận biết',
  understand: 'Thông hiểu',
  apply: 'Vận dụng',
  analyze: 'Phân tích',
  evaluate: 'Đánh giá',
  create: 'Sáng tạo',
};

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'doc_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now().toString(36);
}

/**
 * Khởi tạo cấu trúc ký ức tài liệu ban đầu
 */
export function createInitialDocumentMemory(params: {
  documentId?: string;
  title?: string;
  persona?: PedagogicalPersona;
  curriculum?: CurriculumStandard;
  subject?: string;
  grade?: string;
  directives?: string;
  initialConcepts?: Array<{ label: string; bloomLevel?: BloomLevel }>;
}): PedagogicalDocumentMemory {
  const documentId = params.documentId || generateUUID();
  const title = params.title || 'Tài liệu chưa đặt tên';
  const persona = params.persona || 'k12_teacher';
  const curriculum = params.curriculum || 'gdpt_2018';

  const initialNodes: MiniGraphNode[] = (params.initialConcepts || []).map((c, idx) => ({
    id: `node_${idx + 1}`,
    label: c.label,
    type: 'concept',
    bloomLevel: c.bloomLevel || 'remember',
  }));

  const initialEdges: MiniGraphEdge[] = [];
  for (let i = 0; i < initialNodes.length - 1; i++) {
    initialEdges.push({
      source: initialNodes[i]!.id,
      target: initialNodes[i + 1]!.id,
      relation: 'leads_to',
    });
  }

  const initialChangelog: DocumentChangelogEntry = {
    id: generateUUID(),
    timestamp: new Date().toISOString(),
    actionType: 'init_document',
    summary: 'Khởi tạo tài liệu và thiết lập đồ thị sư phạm ban đầu',
    actor: 'teacher',
  };

  return {
    version: 1,
    documentId,
    title,
    persona,
    curriculum,
    subject: params.subject,
    grade: params.grade,
    sessionCount: 1,
    miniGraph: {
      nodes: initialNodes,
      edges: initialEdges,
    },
    changelog: [initialChangelog],
    directives: params.directives || '',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Ghi nhận một hành động sư phạm vào Mini Graph và cập nhật Changelog
 */
export function recordPedagogicalAction(
  memory: PedagogicalDocumentMemory,
  params: {
    actionType: string;
    summary: string;
    actor?: 'teacher' | 'mate_ai';
    modifiedSections?: string[];
    newConcepts?: Array<{ label: string; bloomLevel?: BloomLevel; type?: MiniGraphNodeType }>;
    newEdges?: MiniGraphEdge[];
    directives?: string;
    metadata?: Record<string, any>;
  }
): PedagogicalDocumentMemory {
  const currentNodes = [...memory.miniGraph.nodes];
  const currentEdges = [...memory.miniGraph.edges];
  const existingLabels = new Set(currentNodes.map((n) => n.label.toLowerCase().trim()));

  // Thêm các node khái niệm mới (giới hạn tối đa 20 nodes để tránh phình đồ thị)
  if (params.newConcepts && params.newConcepts.length > 0) {
    for (const c of params.newConcepts) {
      const normalized = c.label.toLowerCase().trim();
      if (!existingLabels.has(normalized) && currentNodes.length < 20) {
        const nodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        currentNodes.push({
          id: nodeId,
          label: c.label.trim(),
          type: c.type || 'concept',
          bloomLevel: c.bloomLevel || 'understand',
        });
        existingLabels.add(normalized);

        // Nối tự động với node gần nhất nếu chưa có edge
        if (currentNodes.length > 1) {
          const prevNode = currentNodes[currentNodes.length - 2]!;
          currentEdges.push({
            source: prevNode.id,
            target: nodeId,
            relation: 'leads_to',
          });
        }
      }
    }
  }

  // Thêm các edges tùy biến nếu có
  if (params.newEdges) {
    for (const e of params.newEdges) {
      const exists = currentEdges.some(
        (ce) => ce.source === e.source && ce.target === e.target && ce.relation === e.relation
      );
      if (!exists && currentEdges.length < 30) {
        currentEdges.push(e);
      }
    }
  }

  // Cập nhật Changelog (lưu giữ tối đa 25 entries gần nhất)
  const newEntry: DocumentChangelogEntry = {
    id: generateUUID(),
    timestamp: new Date().toISOString(),
    actionType: params.actionType,
    summary: params.summary,
    actor: params.actor || 'mate_ai',
    modifiedSections: params.modifiedSections,
    metadata: params.metadata,
  };

  const updatedChangelog = [...memory.changelog, newEntry].slice(-25);

  return {
    ...memory,
    version: memory.version + 1,
    miniGraph: {
      nodes: currentNodes,
      edges: currentEdges,
    },
    changelog: updatedChangelog,
    directives: params.directives !== undefined ? params.directives : memory.directives,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Tăng số phiên làm việc (Session Counter) khi người dùng mở lại tài liệu
 */
export function incrementSessionCount(memory: PedagogicalDocumentMemory): PedagogicalDocumentMemory {
  return {
    ...memory,
    sessionCount: memory.sessionCount + 1,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Render Markdown Ký ức Sư phạm (~2500 ký tự / ~500 tokens)
 * Dùng để tiêm vào System Prompt / Context cho AI Agent ở các phiên làm việc tiếp theo.
 */
export function renderPedagogicalMemoryMd(memory: PedagogicalDocumentMemory): string {
  const personaLabel = PERSONA_LABELS[memory.persona] || memory.persona;
  const curriculumLabel = CURRICULUM_LABELS[memory.curriculum] || memory.curriculum;
  const updatedDate = new Date(memory.updatedAt).toLocaleString('vi-VN');

  // 1. Render Mini Graph Nodes & Flow
  let graphSection = '(Chưa có đồ thị khái niệm)';
  const nodes = memory.miniGraph.nodes || [];
  if (nodes.length > 0) {
    const nodeFlow = nodes
      .slice(0, 12)
      .map((n) => `\`[${n.label}${n.bloomLevel ? ` (${BLOOM_LABELS[n.bloomLevel]})` : ''}]\``)
      .join(' ➔ ');

    const edges = (memory.miniGraph.edges || []).slice(0, 6);
    const edgeList = edges
      .map((e) => {
        const srcNode = nodes.find((n) => n.id === e.source)?.label || e.source;
        const tgtNode = nodes.find((n) => n.id === e.target)?.label || e.target;
        return `- \`[${srcNode}]\` ──(${e.relation})──> \`[${tgtNode}]\``;
      })
      .join('\n');

    graphSection = `${nodeFlow}${edgeList ? `\n${edgeList}` : ''}`;
  }

  // 2. Render Changelog (Lấy tối đa 6 sự kiện gần nhất)
  let changelogSection = '- Khởi tạo tài liệu lần đầu.';
  const logs = memory.changelog || [];
  if (logs.length > 0) {
    changelogSection = logs
      .slice(-6)
      .reverse()
      .map((entry) => {
        const time = new Date(entry.timestamp).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const actorTag = entry.actor === 'teacher' ? '[Người dạy]' : '[Lycero Mate]';
        return `- [${time}] ${actorTag} ${entry.summary}`;
      })
      .join('\n');
  }

  // 3. Render Directives
  const directivesSection =
    memory.directives?.trim() || '(Không có chỉ đạo riêng, bám sát chuẩn kiến thức & kỹ năng)';

  const rawMd = `# KÝ ỨC SƯ PHẠM TÀI LIỆU (${memory.documentId})
- **Tài liệu:** ${memory.title}
- **Chuyên môn:** ${personaLabel} | **Khung chuẩn:** ${curriculumLabel}
- **Môn:** ${memory.subject || 'Chung'} | **Lớp:** ${memory.grade || 'Chung'}
- **Phiên bản:** v${memory.version} (Phiên làm việc thứ ${memory.sessionCount}) | **Cập nhật:** ${updatedDate}

## 1. Đồ thị Khái niệm & Mạch Tri thức (Mini Graph)
${graphSection}

## 2. Lịch sử Xây dựng & Quyết định Sư phạm (Changelog)
${changelogSection}

## 3. Chỉ thị Sư phạm Của Người Dạy (Teacher Directives)
${directivesSection}
`;

  // Bounded clamp: Khống chế tối đa 2500 ký tự
  if (rawMd.length > MAX_PEDAGOGICAL_MEMORY_CHARS) {
    return rawMd.slice(0, MAX_PEDAGOGICAL_MEMORY_CHARS - 35) + '\n...[Ký ức sư phạm đã rút gọn]';
  }

  return rawMd;
}

/**
 * Trích xuất Thẻ hành động sư phạm (ActionCardData) từ phản hồi của AI
 * Hỗ trợ thẻ cú pháp <action_card> và code block ```action_card
 */
export function extractActionCardFromText(rawText: string): {
  cleanText: string;
  actionCard?: ActionCardData | undefined;
} {
  // 1. Match <action_card type="..." title="..." description="...">JSON</action_card>
  const cardTagRegex =
    /<action_card(?:\s+type="([^"]+)")?(?:\s+title="([^"]+)")?(?:\s+description="([^"]*)")?>([\s\S]*?)<\/action_card>/i;
  const match = rawText.match(cardTagRegex);
  if (match) {
    const cardType = match[1] || 'pedagogical_update';
    const cardTitle = match[2] || 'Đề xuất cập nhật từ Lycero Mate';
    const cardDesc = match[3] || 'Áp dụng đề xuất này trực tiếp vào tài liệu';
    const rawPayload = match[4]?.trim() || '';
    let payload: any = undefined;
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      payload = { content: rawPayload };
    }
    const cleanText = rawText.replace(cardTagRegex, '').trim();
    return {
      cleanText,
      actionCard: {
        type: cardType,
        title: cardTitle,
        description: cardDesc,
        payload,
      },
    };
  }

  // 2. Match code block ```action_card ... ```
  const codeBlockRegex = /```(?:action_card|json:action_card)\s*([\s\S]*?)```/i;
  const cbMatch = rawText.match(codeBlockRegex);
  if (cbMatch && cbMatch[1]) {
    try {
      const parsed = JSON.parse(cbMatch[1].trim());
      if (parsed && (parsed.type || parsed.title)) {
        const cleanText = rawText.replace(codeBlockRegex, '').trim();
        return {
          cleanText,
          actionCard: {
            type: parsed.type || 'pedagogical_update',
            title: parsed.title || 'Đề xuất cập nhật từ Lycero Mate',
            description: parsed.description || 'Áp dụng nội dung này vào tài liệu',
            payload: parsed.payload || parsed,
          },
        };
      }
    } catch {}
  }

  return { cleanText: rawText, actionCard: undefined };
}

/**
 * Thống kê mức độ phủ Bloom trong Mini Graph
 */
export function getBloomCoverage(graph: DocumentMiniGraph): Record<BloomLevel, number> {
  const coverage: Record<BloomLevel, number> = {
    remember: 0,
    understand: 0,
    apply: 0,
    analyze: 0,
    evaluate: 0,
    create: 0,
  };

  for (const node of graph.nodes) {
    if (node.bloomLevel && coverage[node.bloomLevel] !== undefined) {
      coverage[node.bloomLevel]++;
    }
  }

  return coverage;
}
