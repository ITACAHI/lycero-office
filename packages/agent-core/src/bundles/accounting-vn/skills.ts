/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import type { WorkBundleSkill } from '@lycero/ai-auth'

/**
 * accounting_vn cloud skills.
 * Content is embedded as template literals so the module is self-contained without
 * needing a Vite ?raw loader or runtime fs access.
 *
 * These match the skill names registered in work-bundles.ts:
 *   - 'vn-tax-tt200'
 *   - 'vn-mtt-201-balance'
 */

// ─── vn-tax-tt200 ─────────────────────────────────────────────────────────────────

const VN_TAX_TT200_CONTENT = `---
id: vn-tax-tt200
name: Thông tư 200/2014/TT-BTC — Chế độ kế toán doanh nghiệp
description: Hướng dẫn áp dụng chế độ kế toán theo Thông tư 200/2014/TT-BTC (thay thế QĐ 15/2006), bao gồm VAS, chuẩn mực BCTC, phương pháp khấu trừ thuế GTGT, và quy định về hóa đơn chứng từ.
version: "2014"
authority: Thông tư 200/2014/TT-BTC (Bộ Tài Chính, có hiệu lực 01/01/2015)
applies_to:
  - Kế toán doanh nghiệp Việt Nam
  - Báo cáo tài chính năm tài chính từ 01/01/2015
tags:
  - kế toán
  - thuế GTGT
  - VAS
  - BCTC
  - hóa đơn điện tử
instructions: |
  # Thông tư 200/2014/TT-BTC — Hướng dẫn kế toán doanh nghiệp

  ## 1. Phạm vi áp dụng
  Thông tư này hướng dẫn chế độ kế toán áp dụng cho:
  - Doanh nghiệp thành lập theo Luật Doanh nghiệp, Luật Đầu tư
  - Doanh nghiệp nhà nước (trừ đơn vị kế toán hành chính nhượng bộ)
  - Hợp tác xã, liên hiệp hợp tác xã
  - Đơn vị kế toán khác (tổ chức có hoạt động thu chi tài chính)

  Thay thế hoàn toàn Quyết định 15/2006/QĐ-BTC từ năm tài chính 2015.

  ## 2. Các nguyên tắc kế toán cơ bản (Điều 4)

  ### 2.1 Cơ sở dồn tích
  Mọi nghiệp vụ kinh tế, tài chính liên quan đến tài sản, nguồn vốn, doanh thu, chi phí phải được ghi sổ tại thời điểm phát sinh, không căn cứ vào thời điểm thực tế thu hoặc thực tế chi tiền.

  ### 2.2 Hoạt động liên tục
  Khi lập BCTC, doanh nghiệp phải đánh giá khả năng hoạt động liên tục. Nếu có sự kiện/điều kiện gây ra nghi ngờ đáng kể về khả năng hoạt động liên tục, phải trình bày trong Thuyết minh BCTC.

  ### 2.3 Tính nhất quán
  Việc áp dụng các chính sách kế toán phải nhất quán từ kỳ này sang kỳ khác. Thay đổi chính sách phải được trình bày và giải trình trong Thuyết minh BCTC.

  ### 2.4 Đo lường bằng đồng tiền
  Các nghiệp vụ được đo lường bằng đồng tiền Việt Nam (VND). Không điều chỉnh ảnh hưởng của lạm phát.

  ## 3. Thuế Giá Trị Gia Tăng (GTGT)

  ### 3.1 Phương pháp khấu trừ thuế (Điều 9)
  - Áp dụng cho: doanh nghiệp thực hiện đầy đủ hóa đơn, chứng từ theo quy định
  - Công thức: **Thuế GTGT phải nộp = Thuế GTGT đầu ra − Thuế GTGT đầu vào được khấu trừ**

  ### 3.2 Thuế suất (Phụ lục I, Ban hành kèm Thông tư 200)
  | Loại hàng hóa, dịch vụ | Thuế suất |
  |---|---|
  | Hàng hóa, dịch vụ thông thường | 10% |
  | Hàng hóa, dịch vụ xuất khẩu | 0% |
  | Dịch vụ tài chính, bảo hiểm, y tế, giáo dục | Miễn thuế |

  ## 4. Hệ thống tài khoản kế toán (Phần II)

  ### Nhóm TK loại 1 — Tài sản ngắn hạn (100)
  | Mã | Tên tài khoản |
  |---|---|
  | 111 | Tiền mặt |
  | 112 | Tiền gửi ngân hàng |
  | 131 | Phải thu của khách hàng |
  | 133 | Thuế GTGT được khấu trừ |
  | 152 | Nguyên liệu, vật liệu |
  | 156 | Hàng hóa |

  ### Nhóm TK loại 2 — Tài sản dài hạn (200)
  | Mã | Tên tài khoản |
  |---|---|
  | 211 | Tài sản cố định hữu hình |
  | 214 | Hao mòn TSCĐ |
  | 221 | Đầu tư góp vốn dài hạn |

  ### Nhóm TK loại 3 — Nợ phải trả (300)
  | Mã | Tên tài khoản |
  |---|---|
  | 331 | Phải trả cho người bán |
  | 333 | Thuế và các khoản phải nộp Nhà nước |
  | 334 | Phải trả người lao động |
  | 341 | Vay và nợ thuê tài chính |

  ### Nhóm TK loại 4 — Vốn chủ sở hữu (400)
  | Mã | Tên tài khoản |
  |---|---|
  | 411 | Vốn đầu tư của chủ sở hữu |
  | 421 | Lợi nhuận sau thuế chưa phân phối |

  ### Nhóm TK loại 5 — Doanh thu (500)
  | Mã | Tên tài khoản |
  |---|---|
  | 511 | Doanh thu bán hàng và cung cấp dịch vụ |
  | 515 | Doanh thu hoạt động tài chính |

  ### Nhóm TK loại 6 — Chi phí (600)
  | Mã | Tên tài khoản |
  |---|---|
  | 632 | Giá vốn hàng bán |
  | 641 | Chi phí bán hàng |
  | 642 | Chi phí quản lý doanh nghiệp |

  ## 5. Báo cáo tài chính (Điều 23)
  BCTC năm gồm: (1) Bảng cân đối kế toán, (2) Báo cáo kết quả hoạt động kinh doanh, (3) Báo cáo lưu chuyển tiền tệ, (4) Thuyết minh BCTC.

  ## 6. Tài sản cố định (Điều 3)
  TSCĐ hữu hình: thời gian ≥ 1 năm, nguyên giá ≥ 30.000.000 VND. Phương pháp khấu hao: đường thẳng (phổ biến), số dư giảm dần, theo số lượng sản phẩm.

  ## 7. Hướng dẫn cho AI
  Khi soạn tài liệu kế toán, hãy:
  1. Tham chiếu đúng mã TK theo Hệ thống tài khoản Thông tư 200
  2. Áp dụng thuế suất GTGT 10% cho hàng hóa thông thường
  3. Sử dụng mẫu BCTC chuẩn (B01-DN → B09-DN)
  4. Trình bày số liệu: dấu chấm phân cách hàng nghìn, đơn vị VND
  5. Ghi rõ nguồn căn cứ pháp lý cho mỗi công thức/tiêu chí

  ## 8. Các VAS quan trọng
  | VAS | Nội dung |
  |---|---|
  | VAS 01 | Chuẩn mực chung |
  | VAS 02 | Hàng tồn kho |
  | VAS 03 | TSCĐ hữu hình |
  | VAS 04 | TSCĐ vô hình |
  | VAS 06 | Thuế TNDN hoãn lại |
  | VAS 14 | Doanh thu |
  | VAS 21 | Trình bày BCTC`

/**
 * WorkBundleSkill for vn-tax-tt200.
 * Source: Thông tư 200/2014/TT-BTC — Chế độ kế toán doanh nghiệp Việt Nam.
 */
export const SKILL_VN_TAX_TT200: WorkBundleSkill = {
  name: 'vn-tax-tt200',
  description:
    'Thông tư 200/2014/TT-BTC: chế độ kế toán doanh nghiệp, VAS, thuế GTGT 10%, hệ thống tài khoản, BCTC chuẩn (B01–B09).',
  content: VN_TAX_TT200_CONTENT,
}

// ─── vn-mtt-201-balance ─────────────────────────────────────────────────────────

const VN_MTT_201_BALANCE_CONTENT = `---
id: vn-mtt-201-balance
name: Mẫu B 02–2016/QĐ-BTC — Bảng cân đối kế toán
description: Hướng dẫn chi tiết cách lập Bảng cân đối kế toán theo Mẫu B 02–2016/QĐ-BTC (ban hành kèm Quyết định số 48/2006/QĐ-BTC của Bộ trưởng Bộ Tài Chính, được sửa đổi bổ sung bởi Thông tư 200/2014/TT-BTC và Thông tư 53/2016/TT-BTC).
version: "2016"
authority: Quyết định 48/2006/QĐ-BTC, Thông tư 200/2014/TT-BTC, Thông tư 53/2016/TT-BTC
applies_to:
  - Kế toán doanh nghiệp Việt Nam
  - Báo cáo tài chính năm
tags:
  - bảng cân đối kế toán
  - BCTC
  - mẫu B 02
  - tài sản
  - nguồn vốn
instructions: |
  # Mẫu B 02–2016/QĐ-BTC — Bảng cân đối kế toán

  ## 1. Giới thiệu
  Bảng cân đối kế toán (BCĐKT) là một trong bốn Báo cáo tài chính bắt buộc theo Thông tư 200/2014/TT-BTC. Mẫu B 02–DN là mẫu tiêu chuẩn cho doanh nghiệp không phải tổ chức tín dụng, doanh nghiệp bảo hiểm, công ty chứng khoán.
  BCĐKT gồm ba cột: Mã số, Số đầu năm, Số cuối kỳ.

  ## 2. Cấu trúc BCĐKT
  BCĐKT chia thành hai phần: **TÀI SẢN** (bên trái) và **NGUỒN VỐN** (bên phải).
  **Quan hệ bắt buộc:** Tổng Tài Sản = Tổng Nguồn Vốn

  ## 3. Phần A — Tài sản

  ### A.I — Tiền và tương đương tiền (Mã 110)
  | Mã | Chỉ tiêu |
  |---|---|
  | 111 | Tiền mặt |
  | 112 | Tiền gửi ngân hàng |
  | 120 | Tổng cộng tiền (111 + 112 + 113) |

  ### A.II — Đầu tư tài chính ngắn hạn (Mã 120)
  | Mã | Chỉ tiêu |
  |---|---|
  | 121 | Chứng khoán kinh doanh |
  | 122 | Dự phòng giảm giá CK (*) |
  | 123 | Đầu tư nắm giữ đến ngày đáo hạn |

  ### A.III — Các khoản phải thu ngắn hạn (Mã 130)
  | Mã | Chỉ tiêu |
  |---|---|
  | 131 | Phải thu của khách hàng |
  | 133 | Thuế GTGT được khấu trừ |
  | 135 | Dự phòng phải thu ngắn hạn khó đòi (*) |

  ### A.IV — Hàng tồn kho (Mã 140)
  | Mã | Chỉ tiêu |
  |---|---|
  | 141 | Hàng tồn kho |
  | 142 | Dự phòng giảm giá hàng tồn kho (*) |

  **Tổng tài sản ngắn hạn (Mã 100)** = 110 + 120 + 130 + 140 + 150

  ### B — Tài sản dài hạn (Mã 200)

  ### B.I — Các khoản phải thu dài hạn (Mã 210)
  | Mã | Chỉ tiêu |
  |---|---|
  | 211 | Phải thu dài hạn của khách hàng |
  | 215 | Dự phòng phải thu dài hạn khó đòi (*) |

  ### B.II — Tài sản cố định (Mã 220)
  | Mã | Chỉ tiêu |
  |---|---|
  | 221 | TSCĐ hữu hình |
  | 222 | Hao mòn TSCĐ hữu hình (*) |
  | 225 | TSCĐ vô hình |
  | 226 | Hao mòn TSCĐ vô hình (*) |
  | 227 | Chi phí XDCB dở dang |

  ### B.III — Bất động sản đầu tư (Mã 230)
  | Mã | Chỉ tiêu |
  |---|---|
  | 231 | Bất động sản đầu tư |
  | 232 | Hao mòn BĐS đầu tư (*) |

  ### B.IV — Đầu tư tài chính dài hạn (Mã 240)
  | Mã | Chỉ tiêu |
  |---|---|
  | 241 | Đầu tư vào công ty con |
  | 244 | Dự phòng giảm giá đầu tư tài chính dài hạn (*) |

  ### B.V — Tài sản dài hạn khác (Mã 250)
  | Mã | Chỉ tiêu |
  |---|---|
  | 251 | Chi phí trả trước dài hạn |
  | 252 | Tài sản thuế thu nhập hoãn lại |

  **Tổng tài sản dài hạn (Mã 260)** = 210 + 220 + 230 + 240 + 250

  ## **TỔNG CỘNG TÀI SẢN (Mã 270)** = Mã 100 + Mã 260

  ## 4. Phần B — Nguồn vốn

  ### A — Nợ phải trả (Mã 300)

  ### A.I — Nợ ngắn hạn (Mã 310)
  | Mã | Chỉ tiêu |
  |---|---|
  | 311 | Phải trả người bán ngắn hạn |
  | 313 | Thuế và các khoản phải nộp Nhà nước |
  | 314 | Phải trả người lao động |
  | 320 | Vay và nợ thuê tài chính ngắn hạn |

  ### A.II — Nợ dài hạn (Mã 330)
  | Mã | Chỉ tiêu |
  |---|---|
  | 331 | Phải trả người bán dài hạn |
  | 339 | Vay và nợ thuê tài chính dài hạn |
  | 342 | Thuế thu nhập hoãn lại phải trả |

  **Tổng nợ phải trả (Mã 300)** = 310 + 330

  ### B — Vốn chủ sở hữu (Mã 400)

  ### B.I — Vốn chủ sở hữu (Mã 410)
  | Mã | Chỉ tiêu |
  |---|---|
  | 411 | Vốn đầu tư của chủ sở hữu |
  | 412 | Thặng dư vốn cổ phần |
  | 414 | Cổ phiếu quỹ (*) |
  | 415 | Chênh lệch đánh giá lại tài sản |
  | 416 | Chênh lệch tỷ giá hối đoái |
  | 417 | Quỹ khác thuộc vốn chủ sở hữu |
  | 418 | Quỹ khen thưởng, phúc lợi |
  | 421 | Lợi nhuận sau thuế chưa phân phối |

  **Tổng vốn chủ sở hữu (Mã 430)** = 410 + 411a

  ## **TỔNG CỘNG NGUỒN VỐN (Mã 440)** = Mã 300 + Mã 430

  ## 5. Kiểm tra cân đối
  **Số cuối kỳ:** Mã 270 = Mã 440 (bắt buộc bằng nhau)
  **Số dư đầu năm:** Tổng Tài Sản = Tổng Nguồn Vốn

  ## 6. Nguyên tắc lập BCĐKT
  1. Đơn vị tiền tệ: VND (giữ nguyên chữ số)
  2. Đối tượng: toàn doanh nghiệp
  3. Kỳ báo cáo: Năm tài chính (01/01 → 31/12)
  4. Số đầu năm = Số dư cuối kỳ trước
  5. Số âm: trình bày trong ngoặc đơn ()
  6. Hàng tồn kho: giá trị thuần có thể thực hiện được

  ## 7. Các tài khoản sử dụng khi lập BCĐKT
  | Mã | Tài khoản |
  |---|---|
  | 111, 112, 113 | Tiền mặt, tiền gửi NH, tiền đang chuyển |
  | 121, 129 | Chứng khoán kinh doanh, dự phòng |
  | 131, 138, 331, 338 | Phải thu, phải trả khách hàng |
  | 133, 143 | Thuế GTGT |
  | 151–158 | Hàng tồn kho |
  | 211–217 | TSCĐ và hao mòn |
  | 411, 421, 412, 414, 415, 416 | Vốn chủ sở hữu |
  | 334, 338 | Phải trả người lao động, khác |
  | 341, 343 | Vay và nợ dài hạn |
  | 333 | Thuế phải nộp Nhà nước |

  ## 8. Hướng dẫn cho AI khi tạo BCĐKT
  Khi tạo Bảng cân đối kế toán hoặc bảng tính Excel, hãy:
  1. Đảm bảo Tổng Tài Sản = Tổng Nguồn Vốn
  2. Ghi rõ mã số (100, 110, 111, ...) đúng vị trí
  3. Cột "Số đầu năm" = số dư cuối kỳ trước
  4. Cột "Số cuối kỳ" = số dư tại thời điểm báo cáo
  5. Số âm hiển thị trong ngoặc đơn
  6. Tính tổng số theo công thức cộng dồn
  7. Định dạng số theo phong cách Việt Nam: dấu chấm phân cách hàng nghìn
  8. Thêm dòng "Đã kiểm tra cân đối" ở cuối Bảng`

/**
 * WorkBundleSkill for vn-mtt-201-balance.
 * Source: Mẫu B 02–2016/QĐ-BTC — Bảng cân đối kế toán.
 */
export const SKILL_VN_MTT_201_BALANCE: WorkBundleSkill = {
  name: 'vn-mtt-201-balance',
  description:
    'Mẫu B 02–2016/QĐ-BTC: cấu trúc Bảng cân đối kế toán, mã số 110–440, tài sản ngắn hạn/dài hạn, nguồn vốn, kiểm tra cân đối.',
  content: VN_MTT_201_BALANCE_CONTENT,
}

/** All accounting_vn cloud skills as an array — convenient for registry. */
export const ACCOUNTING_VN_SKILLS: WorkBundleSkill[] = [
  SKILL_VN_TAX_TT200,
  SKILL_VN_MTT_201_BALANCE,
]
