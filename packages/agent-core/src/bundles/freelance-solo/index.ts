/**
 * Lycero Office Desktop
 * Copyright (c) 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright (c) 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 *
 * Phase B.2: freelance_solo bundle -- skill assembly.
 * Exports the AgentSkill for the freelance_solo bundle.
 */

import type { AgentSkill } from '../../skill'
import { executeFreelanceTool } from './tools'

/**
 * The freelance_solo AgentSkill.
 *
 * Tools:
 *   docs.freelance_contract  -- Hop dong freelance chuan Viet Nam
 *   docs.nda_template       -- Thoa thuan bao mat hai chieu
 *   sheets.invoice_tracker   -- Theo doi hoa don (create / list / mark_paid)
 *
 * Skills:
 *   freelance-invoice-vn     -- Huong dan xuat hoa don dich vu tu xuat theo ND 123/2020
 */
export const freelanceSoloSkill: AgentSkill = {
  id: 'freelance_solo',
  slug: 'freelance-invoice-vn',
  systemPrompt: '## freelance_solo -- Cong cu Freelance & Ca nhan\n\n' +
'Ban la tro ly AI Lycero Mate cho nguoi dung Freelance va ca nhan tu do.\n\n' +
'### Cong cu san sang\n\n' +
'**docs.freelance_contract**\n' +
'Tao hop dong thue dich vu freelance chuan Viet Nam.\n' +
'Can cu: Dieu 601-612 Bo luat Dan su 2015 (hop dong dich vu), Dieu 360-365 (thanh toan),\n' +
'Dieu 366-377 (boi thuong thiet hai), Dieu 117 (dieu cam).\n' +
'Cac ben truyen: parties = [{role: freelancer|client, name, address}], scope, fee, deadline.\n\n' +
'**docs.nda_template**\n' +
'Tao thoa thuan bao mat hai chieu (Mutual NDA) chuan Viet Nam.\n' +
'Can cu: Dieu 39-44 Bo luat Dan su 2015, Dieu 4 Luat So huu tri tue 2005 (bao ve bi mat kinh doanh).\n' +
'Cac ben truyen: partyA, partyB, purpose, duration (nam).\n\n' +
'**sheets.invoice_tracker**\n' +
'Theo doi cong no va hoa don cho freelancer.\n' +
'Hanh dong:\n' +
'  - create: tao hoa don moi (client, amount)\n' +
'  - list: liet ke tat ca hoa don\n' +
'  - mark_paid: danh dau hoa don da thanh toan (invoiceId)\n\n' +
'### Nguyen tac su dung\n' +
'- Luon hoi day du thong tin truoc khi tao hop dong/NDA.\n' +
'- Kiem tra thong tin cac ben truoc khi xuat template.\n' +
'- Huong dan nguoi dung dien thong tin bo sung vao template truoc khi ky.\n' +
'- Theo doi hoa don dinh ky, nhac thanh toan khi den han.\n',
  tools: [
    {
      name: 'docs.freelance_contract',
      description: 'Tao hop dong freelance chuan Viet Nam (Bo luat Dan su 2015)',
      inputSchema: {
        type: 'object',
        properties: {
          parties: {
            type: 'array',
            description: 'Danh sach cac ben: freelancer va client',
            items: {
              type: 'object',
              properties: {
                role: { type: 'string', enum: ['freelancer', 'client'] },
                name: { type: 'string' },
                address: { type: 'string' },
              },
              required: ['role', 'name', 'address'],
            },
            minItems: 2,
          },
          scope: { type: 'string', description: 'Pham vi cong viec / mo ta dich vu' },
          fee: { type: 'number', description: 'Tong gia tri hop dong (VND)' },
          deadline: {
            type: 'string',
            description: 'Thoi han hoan thanh (ISO date, vi du: 2026-12-31)',
          },
        },
        required: ['parties', 'scope', 'fee', 'deadline'],
      },
    },
    {
      name: 'docs.nda_template',
      description: 'Mau thoa thuan bao mat hai chieu (NDA) chuan Viet Nam',
      inputSchema: {
        type: 'object',
        properties: {
          partyA: { type: 'string', description: 'Ten ben A' },
          partyB: { type: 'string', description: 'Ten ben B' },
          purpose: { type: 'string', description: 'Muc dich tiet lo thong tin mat' },
          duration: {
            type: 'number',
            description: 'Thoi han bao mat (nam, mac dinh 2)',
            default: 2,
          },
        },
        required: ['partyA', 'partyB', 'purpose'],
      },
    },
    {
      name: 'sheets.invoice_tracker',
      description: 'Theo doi cong no va hoa don cho freelancer (create / list / mark_paid)',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'list', 'mark_paid'],
            description: 'Hanh dong: create | list | mark_paid',
          },
          invoiceId: {
            type: 'string',
            description: 'Ma hoa don (can khi action=mark_paid)',
          },
          client: {
            type: 'string',
            description: 'Ten khach hang (can khi action=create)',
          },
          amount: {
            type: 'number',
            description: 'So tien VND (can khi action=create, > 0)',
          },
        },
        required: ['action'],
      },
    },
  ],
  executeTool: executeFreelanceTool,
}
