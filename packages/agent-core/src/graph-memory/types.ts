/**
 * Lycero Office Desktop
 * Copyright 2026 ITAC AI Heavy Industries.
 * All rights reserved.
 */
export type PedagogicalPersona =
  | 'k12_teacher'             // Giáo viên Phổ thông K-12 (GDPT 2018, CV 5512)
  | 'international_teacher'   // Giáo viên Trường Quốc tế (IB, Cambridge, AP, CLIL)
  | 'university_lecturer'     // Giảng viên Đại học & Cao đẳng (Syllabus 15w, CLO/PLO)
  | 'academic_researcher'     // Nghiên cứu sinh & Viện sĩ (Scopus, APA 7th, Thesis)
  | 'exam_specialist'         // Chuyên gia Khảo thí & Luyện thi (9+, ĐGNL, TSA, SAT)
  | 'language_trainer'        // Giáo viên Ngoại ngữ & Khảo thí (IELTS, HSK, TOPIK, CEFR)
  | 'vocational_instructor'   // Giảng viên Dạy nghề & Kỹ thuật Thực hành (VQF, SOP)
  | 'corporate_trainer'       // Chuyên gia Huấn luyện Doanh nghiệp (ADDIE, Kirkpatrick)
  | 'independent_tutor'       // Gia sư Tự do & Giáo viên Dạy kèm 1-on-1
  | 'kindergarten_teacher'    // Giáo viên Mầm non (Montessori, Reggio Emilia, 0-6 tuổi)
  | 'sped_educator';          // Giáo viên Giáo dục Đặc biệt & Hòa nhập (IEP, UDL)

export type CurriculumStandard =
  | 'gdpt_2018'
  | 'aun_qa'
  | 'ib_myp_dp'
  | 'cambridge_cie'
  | 'us_ap'
  | 'cefr'
  | 'vqf'
  | 'custom';

export type BloomLevel =
  | 'remember'     // Nhận biết
  | 'understand'   // Thông hiểu
  | 'apply'        // Vận dụng
  | 'analyze'      // Phân tích
  | 'evaluate'     // Đánh giá
  | 'create';      // Sáng tạo

export type MiniGraphNodeType =
  | 'concept'          // Khái niệm kiến thức cốt lõi
  | 'activity'         // Hoạt động dạy học (Khởi động, Hình thành KT, Luyện tập, Vận dụng)
  | 'question'         // Câu hỏi / Bài tập phân hóa
  | 'skill'            // Kỹ năng / Năng lực cần hình thành
  | 'slide'            // Trang trình chiếu sư phạm
  | 'standard_blooms'  // Chuẩn nhận thức Bloom
  | 'clo_plo';         // Chuẩn đầu ra học phần

export type MiniGraphEdgeRelation =
  | 'develops'    // Phát triển năng lực
  | 'practices'   // Luyện tập / củng cố
  | 'assesses'    // Đánh giá / kiểm tra
  | 'leads_to'    // Dẫn dắt tới khái niệm tiếp theo
  | 'requires';   // Điều kiện tiên quyết

export interface MiniGraphNode {
  id: string;
  label: string;
  type: MiniGraphNodeType;
  bloomLevel?: BloomLevel | undefined;
  meta?: Record<string, any> | undefined;
}

export interface MiniGraphEdge {
  source: string;
  target: string;
  relation: MiniGraphEdgeRelation;
}

export interface DocumentMiniGraph {
  nodes: MiniGraphNode[];
  edges: MiniGraphEdge[];
}

export interface DocumentChangelogEntry {
  id: string;
  timestamp: string;
  actionType: string;
  summary: string;
  actor: 'teacher' | 'mate_ai';
  modifiedSections?: string[] | undefined;
  metadata?: Record<string, any> | undefined;
}

export interface PedagogicalDocumentMemory {
  version: number;
  documentId: string;
  title: string;
  persona: PedagogicalPersona;
  curriculum: CurriculumStandard;
  subject?: string | undefined;
  grade?: string | undefined;
  sessionCount: number;
  miniGraph: DocumentMiniGraph;
  changelog: DocumentChangelogEntry[];
  directives?: string | undefined;
  updatedAt: string;
}

export interface ActionCardData {
  type: string;
  title: string;
  description: string;
  payload?: any;
  applied?: boolean | undefined;
}

export type WorkingMode = 'full_ai' | 'ai_assisted' | 'manual';
