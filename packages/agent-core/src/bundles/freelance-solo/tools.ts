/**
 * Lycero Office Desktop
 * Copyright (c) 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright (c) 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 *
 * Phase B.2: freelance_solo bundle -- local tool executors.
 */

import type { AgentToolCall, ToolExecution } from '../../types'

// -- Helpers ----------------------------------------------------------------

export function formatVND(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' dong'
}

export function formatVNDDate(isoDate: string): string {
  // Handle full ISO timestamps like 2026-10-02T08:30:36.916Z
  const datePart = isoDate.split('T')[0] ?? isoDate
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return isoDate
  return d + '/' + m + '/' + y
}

export function formatVNDDateLong(isoDate: string): string {
  // Handle full ISO timestamps
  const datePart = (isoDate.split('T')[0] ?? isoDate)
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return isoDate
  const thang = ['mot', 'hai', 'ba', 'bon', 'nam', 'sau', 'bay', 'tam', 'chin', 'muoi', 'muoi mot', 'muoi hai']
  const thangIdx = parseInt(m, 10) - 1
  return 'ngay ' + parseInt(d, 10) + ' thang ' + (thang[thangIdx] ?? m) + ' nam ' + y
}

// -- Invoice Store -----------------------------------------------------------
// ponytail: in-process persistence, no crash recovery.

interface InvoiceRecord {
  id: string
  client: string
  amount: number
  status: 'pending' | 'paid'
  createdAt: string
  paidAt?: string
}

let invoiceStore: Map<string, InvoiceRecord> = new Map()

function generateId(): string {
  return 'INV-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()
}

/** Exported for test isolation only - do not call in production code. */
export function __resetInvoiceStore(): void {
  invoiceStore.clear()
}

// -- freelance_contract -------------------------------------------------------

function buildFreelanceContract(input: {
  parties: Array<{ role: 'freelancer' | 'client'; name: string; address: string }>
  scope: string
  fee: number
  deadline: string
}): string {
  const freelancer = input.parties.find((p) => p.role === 'freelancer')
  const client = input.parties.find((p) => p.role === 'client')
  if (!freelancer || !client) {
    return 'Loi: Can co day du thong tin ben thue (client) va ben cung cap dich vu (freelancer).'
  }
  const now = formatVNDDateLong(new Date().toISOString())
  const deadlineText = formatVNDDateLong(input.deadline)

  return 'CONG HOA XA HOI CHU NGHIA VIET NAM\n' +
'Doc lap - Tu do - Hanh phuc\n\n' +
'-------------------------------------------------------\n\n' +
'HOP DONG THUE DICH VU\n\n' +
'So: ' + generateId() + '\n\n' +
'-- Dieu 1. Cac ben tham gia hop dong -------------------------\n\n' +
'BEN A - BEN THUE DICH VU (CLIENT)\n' +
'Ho va ten: ' + client.name + '\n' +
'Dia chi: ' + client.address + '\n\n' +
'BEN B - BEN CUNG CAP DICH VU (FREELANCER)\n' +
'Ho va ten: ' + freelancer.name + '\n' +
'Dia chi: ' + freelancer.address + '\n\n' +
'Hai ben thong nhat ky hop dong thue dich vu voi cac dieu khoan sau day.\n\n' +
'-- Dieu 2. Pham vi cong viec --------------------------------\n\n' +
'(Theo Dieu 601-612 Bo luat Dan su 2015 - Hop dong dich vu)\n\n' +
'Ben B thuc hien cac cong viec sau cho Ben A:\n' + input.scope + '\n\n' +
'-- Dieu 3. Thoi han thuc hien -------------------------------\n\n' +
'Hop dong co hieu luc ke tu ngay ky va ket thuc vao: ' + deadlineText + '.\n\n' +
'-- Dieu 4. Nghia vu cua cac ben ---------------------------\n\n' +
'4.1. Ben A co nghia vu:\n' +
'  a) Thanh toan cho Ben B theo Dieu 5 cua hop dong nay;\n' +
'  b) Cung cap tai lieu, thong tin can thiet de Ben B thuc hien cong viec;\n' +
'  c) Phoi hop, phan hoi kip thoi trong qua trinh thuc hien.\n\n' +
'4.2. Ben B co nghia vu:\n' +
'  a) Thuc hien cong viec dung noi dung, tieu chuan da thoa thuan tai Dieu 2;\n' +
'  b) Bao cao tien do dinh ky cho Ben A;\n' +
'  c) Bao mat thong tin cua Ben A theo quy dinh tai Dieu 6;\n' +
'  d) Hoan thanh va ban giao san pham dung thoi han quy dinh tai Dieu 3.\n\n' +
'-- Dieu 5. Thanh toan ---------------------------------------\n\n' +
'(Theo Dieu 360-365 Bo luat Dan su 2015 - Thanh toan)\n\n' +
'Tong gia tri hop dong: ' + formatVND(input.fee) + '\n\n' +
'Phuong thuc thanh toan: Chuyen khoan ngan hang vao tai khoan cua Ben B.\n\n' +
'-- Dieu 6. Bao mat ------------------------------------------\n\n' +
'6.1. Hai ben cam ket giu bi mat tuyet doi moi thong tin lien quan den:\n' +
'  a) Thong tin khach hang, doi tac cua moi ben;\n' +
'  b) Du lieu, tai lieu, san pham lien quan den cong viec trong hop dong nay;\n' +
'  c) Cac dieu khoan tai chinh va thuong mai cua hop dong.\n\n' +
'6.2. Nghia vu bao mat co hieu luc vo thoi han sau khi hop dong ket thuc.\n\n' +
'-- Dieu 7. So huu tri tue ---------------------------------\n\n' +
'7.1. San pham do Ben B tao ra trong khung kho hop dong nay thuoc quyen so huu cua Ben A ke tu khi Ben A hoan tat thanh toan.\n' +
'7.2. Ben B duoc phep su dung san pham de tham chieu trong danh muc cong viec ca nhan (portfolio) voi su dong y bang van ban cua Ben A.\n\n' +
'-- Dieu 8. Boi thuong thiet hai -----------------------------\n\n' +
'(Theo Dieu 366-377 Bo luat Dan su 2015 - Trach nhiem dan su)\n\n' +
'8.1. Ben nao vi pham nghia vu, gay thiet hai cho Ben kia thi phai boi thuong toan bo thiet hai that tien.\n' +
'8.2. Truong hop Ben B cham giao san pham qua 15 ngay so voi thoi han tai Dieu 3 ma khong co ly do chinh dang, Ben B chiu phat cham 0,05%/ngay cham tren tong gia tri hop dong.\n' +
'8.3. Truong hop Ben A cham thanh toan qua 15 ngay so voi thoi han thanh toan, Ben A chiu phat cham 0,05%/ngay cham tren so tien chua thanh toan.\n\n' +
'-- Dieu 9. Cham dut hop dong ------------------------------\n\n' +
'9.1. Hop dong cham dut trong cac truong hop:\n' +
'  a) Hai ben da hoan thanh nghia vu theo thoa thuan;\n' +
'  b) Mot ben don phuong cham dut hop dong truoc han voi thong bao bang van ban truoc 15 ngay.\n' +
'9.2. Khi cham dut, cac nghia vu da phat sinh van duoc thuc hien day du.\n' +
'9.3. Ben don phuong cham dut truoc han phai boi thuong 30% gia tri phan cong viec con lai cho Ben kia.\n\n' +
'-- Dieu 10. Dieu khoan chung --------------------------------\n\n' +
'10.1. Hop dong nay duoc lap thanh 02 (hai) ban co gia tri phap ly nhu nhau, moi ben giu 01 (mot) ban.\n' +
'10.2. Moi sua doi, bo sung phai duoc lap thanh van ban va ky dong y boi ca hai ben.\n' +
'10.3. Cac tran chap phat sinh tu hop dong nay se duoc giai quyet thong qua thuong luong, hoa giai tren tinh than thien chi. Neu khong the giai quyet bang thuong luong, tran chap se duoc dua ra Toa an nhan dan co tham quyen.\n' +
'10.4. Hop dong nay co hieu luc ke tu ngay ' + now + '.\n\n' +
'---------------------- Het hop dong --------------------------\n\n' +
'DAI DIEN BEN A                           DAI DIEN BEN B\n' +
'(Ky va ghi ro ho ten)                    (Ky va ghi ro ho ten)\n\n' +
'________________________                  ________________________\n' +
client.name + '                           ' + freelancer.name
}

// -- nda_template -----------------------------------------------------------

function buildNDATemplate(input: {
  partyA: string
  partyB: string
  purpose: string
  duration: number
}): string {
  const now = formatVNDDateLong(new Date().toISOString())
  const expiryDate = new Date(Date.now() + input.duration * 365 * 24 * 60 * 60 * 1000)
  const expiry = formatVNDDateLong(expiryDate.toISOString())
  const durationText = input.duration === 1 ? 'mot (01) nam' : input.duration === 2 ? 'hai (02) nam' : input.duration === 3 ? 'ba (03) nam' : input.duration + ' nam'

  return 'CO NG HOA XA HOI CHU NGHIA VIET NAM\n' +
'Doc lap - Tu do - Hanh phuc\n\n' +
'-------------------------------------------------------\n\n' +
'THOA THUAN BAO MAT HAI CHIEU\n(MUTUAL NON-DISCLOSURE AGREEMENT)\n\n' +
'So: ' + generateId() + '\n\n' +
'-- I. THONG TIN CAC BEN ---------------------------------\n\n' +
'BEN A: ' + input.partyA + '\n' +
'BEN B: ' + input.partyB + '\n\n' +
'Hai Ben (sau day goi la \"Cac Ben\") thong nhat ky ket Thoa thuan Bao Mat Hai Chieu\n(nay goi la \"Thoa thuan\") voi cac dieu khoan va dieu kien nhu sau.\n\n' +
'-- II. PHAM VI BAO MAT ----------------------------------\n\n' +
'(Theo Dieu 4 Luat So huu tri tue 2005 - Bao ve bi mat kinh doanh)\n\n' +
'2.1. \"Thong tin mat\" la moi thong tin, du lieu, tai lieu, kien thuc, ky thuat,\n' +
'quy trinh, cong thuc, thiet ke, san pham, chien luoc kinh doanh, thong tin\n' +
'tai chinh, va bat ky thong tin nao khac duoc tiet lo giua Cac Ben lien quan\n' +
'den: ' + input.purpose + '\n\n' +
'2.2. Pham vi bao mat bao gom nhung khong gioi han o:\n' +
'  a) Thong tin ky thuat: ma nguon, kien truc phan mem, thuat toan, co so du lieu;\n' +
'  b) Thong tin thuong mai: bao cao tai chinh, chien luoc kinh doanh, khach hang, nha cung cap;\n' +
'  c) Thong tin phap ly: hop dong, thoa thuan, van ban noi bo;\n' +
'  d) Moi tai lieu duoc danh dau "BI MAT" hoac "CONFIDENTIAL".\n\n' +
'2.3. Thong tin BEN A tiet lo cho BEN B va nguoc lai deu duoc bao ve theo\n' +
'Thoa thuan nay (nguyen tac hai chieu / mutual).\n\n' +
'-- III. THOI HAN VA CAM KET -------------------------------\n\n' +
'(Theo Dieu 601-612 Bo luat Dan su 2015 - Nghia vu thuc hien dung cam ket)\n\n' +
'3.1. Thoi han bao mat: Thoa thuan nay co hieu luc tu ngay ' + now + '\n' +
'den ngay ' + expiry + ' (tong cong ' + durationText + ').\n\n' +
'3.2. Nghia vu cua Cac Ben trong thoi han bao mat:\n' +
'  a) Khong tiet lo Thong tin mat cho bat ky ben thu ba nao khi chua co su dong y\n' +
'     bang van ban cua Ben kia;\n' +
'  b) Chi su dung Thong tin mat cho muc dich da thoa thuan tai Muc II.1;\n' +
'  c) Ap dung cac bien phap bao mat can thiet va hop ly (ma hoa, han che truy cap,\n' +
'     ky hop dong bao mat voi nhan vien neu can) de bao ve Thong tin mat;\n' +
'  d) Thong bao ngay cho Ben kia (trong vong 24 gio) khi phat hien bat ky\n' +
'     vi pham hoac nguy co vi pham nao doi voi Thoa thuan nay.\n\n' +
'3.3. Nghia vu bao mat tiep tuc co hieu luc sau khi Thoa thuan het han doi\n' +
'voi cac Thong tin mat da duoc tiet lo, trong thoi han 05 (nam) nam ke tu\n' +
'ngay het hieu luc cua Thoa thuan.\n\n' +
'3.4. Dieu khoan mien tru: Cac Ben khong bi rang buoc boi nghia vu bao mat\n' +
'doi voi thong tin:\n' +
'  a) Da duoc cong khai truoc khi duoc tiet lo (khong phai do loi cua Ben nhan);\n' +
'  b) Da duoc Ben nhan phat trien doc lap ma khong su dung Thong tin mat;\n' +
'  c) Duoc tiet lo theo yeu cau cua co quan nha nuoc co tham quyen theo quy\n' +
'     dinh phap luat, voi dieu kien Ben tiet lo phai thong bao ngay cho Ben kia.\n\n' +
'-- IV. CHE TAO VA GIAI QUYET TRANH CHAP ------------------\n\n' +
'(Theo Dieu 366-377 Bo luat Dan su 2015 - Boi thuong thiet hai)\n\n' +
'4.1. Ben nao vi pham Thoa thuan nay, tiet lo hoac su dung trai phep\n' +
'Thong tin mat cua Ben kia, gay thiet hai, thi phai:\n' +
'  a) Boi thuong toan bo thiet hai that tien;\n' +
'  b) Chiu phat vi pham 20% (hai muoi phan tram) tong gia tri thiet hai\n' +
'     (nhung khong thap hon 50.000.000 dong - nam muoi trieu dong);\n' +
'  c) Ngung ngay moi hanh vi vi pham va ap dung bien phap khac phuc.\n\n' +
'4.2. Tranh chap phat sinh tu Thoa thuan nay duoc giai quyet theo thu tu:\n' +
'  Buoc 1: Thuong luong trong vong 30 ngay;\n' +
'  Buoc 2: Hoa giai tai Trung tam Hoa giai thuong mai;\n' +
'  Buoc 3: Khoi kien tai Toa an nhan dan co tham quyen.\n\n' +
'4.3. Luat ap dung: Luat nuoc Cong hoa Xa hoi Chu nghia Viet Nam.\n\n' +
'---------------------- Het Thoa thuan ----------------------\n\n' +
'DAI DIEN BEN A                           DAI DIEN BEN B\n' +
'(Ky va ghi ro ho ten)                    (Ky va ghi ro ho ten)\n\n' +
'________________________                  ________________________\n' + input.partyA + '                          ' + input.partyB + '\n\n' +
'Ngay ky: ' + now
}

// -- Tool Executor ---------------------------------------------------------

export async function executeFreelanceTool(call: AgentToolCall): Promise<ToolExecution> {
  const { name, input } = call

  try {
    if (name === 'docs.freelance_contract') {
      const partiesRaw = (input as Record<string, unknown>).parties as Array<{ role: string; name: string; address: string }> | undefined
      const parties = partiesRaw?.map((p) => ({ role: p.role as 'freelancer' | 'client', name: p.name, address: p.address }))
      if (!parties || parties.length < 2) {
        return { output: 'Loi: Can truyen du thong tin 2 ben (freelancer va client).', isError: true, summary: 'freelance_contract' }
      }
      const scope = String((input as Record<string, unknown>).scope ?? '')
      const fee = Number((input as Record<string, unknown>).fee ?? 0)
      const deadline = String((input as Record<string, unknown>).deadline ?? '')

      const text = buildFreelanceContract({ parties, scope, fee, deadline })
      return {
        output: text,
        summary: 'freelance_contract',
        display: { kind: 'text', text: '[Hop dong Freelance]\n\nBan co the sao chep noi dung tren, dan vao Docs va dien thong tin bo sung truoc khi ky.' },
      }
    }

    if (name === 'docs.nda_template') {
      const partyA = String((input as Record<string, unknown>).partyA ?? '')
      const partyB = String((input as Record<string, unknown>).partyB ?? '')
      const purpose = String((input as Record<string, unknown>).purpose ?? '')
      const duration = Number((input as Record<string, unknown>).duration ?? 2)
      if (!partyA || !partyB || !purpose) {
        return { output: 'Loi: Can truyen du partyA, partyB va purpose.', isError: true, summary: 'nda_template' }
      }
      const text = buildNDATemplate({ partyA, partyB, purpose, duration })
      return {
        output: text,
        summary: 'nda_template',
        display: { kind: 'text', text: '[Thoa thuan Bao mat (NDA)]\n\nBan co the sao chep noi dung tren, dan vao Docs va dien thong tin bo sung truoc khi ky.' },
      }
    }

    if (name === 'sheets.invoice_tracker') {
      const action = String((input as Record<string, unknown>).action ?? '')
      const invoiceId = String((input as Record<string, unknown>).invoiceId ?? '')
      const amount = Number((input as Record<string, unknown>).amount ?? 0)
      const client = String((input as Record<string, unknown>).client ?? '')

      if (action === 'create') {
        if (!client || isNaN(amount) || amount <= 0) {
          return { output: 'Loi: Can truyen client (ten khach hang) va amount (so tien > 0).', isError: true, summary: 'invoice_tracker' }
        }
        const id = generateId()
        const record: InvoiceRecord = { id, client, amount, status: 'pending', createdAt: new Date().toISOString() }
        invoiceStore.set(id, record)
        return {
          output: 'Da tao hoa don moi.\nMa hoa don: ' + id + '\nKhach hang: ' + client + '\nSo tien: ' + formatVND(amount) + '\nTrang thai: Chua thanh toan\nNgay tao: ' + formatVNDDate(record.createdAt),
          summary: 'invoice_tracker',
          display: { kind: 'text', text: 'Da tao hoa don **' + id + '** cho **' + client + '** tri gia **' + formatVND(amount) + '** (chua thanh toan).' },
        }
      }

      if (action === 'list') {
        const all = [...invoiceStore.values()]
        if (all.length === 0) {
          return { output: 'Chua co hoa don nao. Su dung action=create de tao hoa don moi.', summary: 'invoice_tracker' }
        }
        const lines = all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((inv) => {
          const tt = inv.status === 'paid' ? 'Da thanh toan' : 'Chua thanh toan'
          const paidLine = inv.paidAt ? ' | Thanh toan luc: ' + formatVNDDate(inv.paidAt) : ''
          return inv.id + ' | ' + inv.client + ' | ' + formatVND(inv.amount) + ' | ' + tt + paidLine
        })
        return { output: 'Danh sach hoa don (' + all.length + '):\n\n' + lines.join('\n'), summary: 'invoice_tracker' }
      }

      if (action === 'mark_paid') {
        if (!invoiceId) {
          return { output: 'Loi: Can truyen invoiceId de danh dau thanh toan.', isError: true, summary: 'invoice_tracker' }
        }
        const existing = invoiceStore.get(invoiceId)
        if (!existing) {
          return { output: 'Khong tim thay hoa don voi ma: ' + invoiceId, isError: true, summary: 'invoice_tracker' }
        }
        existing.status = 'paid'
        existing.paidAt = new Date().toISOString()
        invoiceStore.set(invoiceId, existing)
        return {
          output: 'Da danh dau thanh toan cho hoa don ' + invoiceId + '.\nKhach hang: ' + existing.client + '\nSo tien: ' + formatVND(existing.amount) + '\nNgay thanh toan: ' + formatVNDDate(existing.paidAt!),
          summary: 'invoice_tracker',
          display: { kind: 'text', text: 'Hoa don **' + invoiceId + '** da duoc danh dau **Da thanh toan**.' },
        }
      }

      return { output: 'Hanh dong khong hop le: "' + action + '". Cac action hop le: create, list, mark_paid.', isError: true, summary: 'invoice_tracker' }
    }

    return { output: 'Unknown tool: ' + name, isError: true, summary: name }
  } catch (err) {
    return { output: err instanceof Error ? err.message : String(err), isError: true, summary: name }
  }
}