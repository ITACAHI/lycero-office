/**
 * Lycero Office Desktop
 * Copyright 2026 ITAC AI Heavy Industries.
 * All rights reserved.
 */
import JSZip from 'jszip';
import type { PedagogicalDocumentMemory } from '../graph-memory/types';

export const CUSTOM_PROPERTIES_PATH = 'docProps/custom.xml';
export const CUSTOM_PROPERTIES_REL_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties';
export const CUSTOM_PROPERTIES_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.custom-properties+xml';

export const LYCERO_CUSTOM_XML_NS = 'urn:lycero:office:provenance:v1';
export const CUSTOM_XML_REL_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml';
export const CUSTOM_XML_PROPS_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.customXmlProperties+xml';

function getPropertyTagRegex(): RegExp {
  return /<(?:[A-Za-z_][\w.-]*:)?property\b[^>]*>[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?property\s*>/gi;
}
const LYCERO_PROP_PREFIX = 'LYCERO_PROV_';
const CHUNK_SIZE = 250;

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function getAttrValue(xml: string, attrName: string): string | null {
  const match = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(xml);
  return match ? decodeXmlText(match[1] ?? match[2] ?? '') : null;
}

function getLpwstrContent(xml: string): string {
  const match =
    /<(?:[A-Za-z_][\w.-]*:)?lpwstr\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?lpwstr\s*>/i.exec(
      xml
    );
  return decodeXmlText(match?.[1] ?? '');
}

/**
 * Kiểm tra xem tệp có phải là gói nén ZIP / OOXML hợp lệ không (PK\x03\x04)
 */
export function isZipArchive(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

/**
 * Trích xuất PedagogicalDocumentMemory từ docProps/custom.xml
 */
export function parseProvenanceFromCustomPropsXml(xml: string): PedagogicalDocumentMemory | null {
  const chunks: Array<{ index: number; value: string }> = [];
  const props: Record<string, string> = {};

  const matches = xml.match(getPropertyTagRegex()) || [];
  for (const property of matches) {
    const name = getAttrValue(property, 'name');
    if (!name) continue;

    const value = getLpwstrContent(property);
    props[name] = value;

    if (name.startsWith(LYCERO_PROP_PREFIX + 'CHUNK_')) {
      const idxStr = name.replace(LYCERO_PROP_PREFIX + 'CHUNK_', '');
      const idx = parseInt(idxStr, 10);
      if (!isNaN(idx)) {
        chunks.push({ index: idx, value });
      }
    }
  }

  if (chunks.length > 0) {
    chunks.sort((a, b) => a.index - b.index);
    const assembledJson = chunks.map((c) => c.value).join('');
    try {
      const parsed = JSON.parse(assembledJson);
      if (parsed && parsed.documentId && parsed.miniGraph) {
        return parsed as PedagogicalDocumentMemory;
      }
    } catch {
      // Fallback nếu JSON parse lỗi
    }
  }

  // Fallback: Thử tái tạo nếu có các trường đơn lẻ
  if (props[LYCERO_PROP_PREFIX + 'DOC_ID']) {
    try {
      return {
        version: parseInt(props[LYCERO_PROP_PREFIX + 'VERSION'] || '1', 10),
        documentId: props[LYCERO_PROP_PREFIX + 'DOC_ID']!,
        title: props[LYCERO_PROP_PREFIX + 'TITLE'] || 'Tài liệu',
        persona: (props[LYCERO_PROP_PREFIX + 'PERSONA'] as any) || 'k12_teacher',
        curriculum: (props[LYCERO_PROP_PREFIX + 'CURRICULUM'] as any) || 'gdpt_2018',
        subject: props[LYCERO_PROP_PREFIX + 'SUBJECT'],
        grade: props[LYCERO_PROP_PREFIX + 'GRADE'],
        sessionCount: parseInt(props[LYCERO_PROP_PREFIX + 'SESSION_COUNT'] || '1', 10),
        miniGraph: { nodes: [], edges: [] },
        changelog: [],
        directives: props[LYCERO_PROP_PREFIX + 'DIRECTIVES'] || '',
        updatedAt: new Date().toISOString(),
      };
    } catch {}
  }

  return null;
}

/**
 * Sinh nội dung XML cập nhật cho docProps/custom.xml chứa PedagogicalDocumentMemory
 */
export function patchCustomPropertiesXml(
  originalXml: string | null,
  memory: PedagogicalDocumentMemory
): string {
  const baseXml =
    originalXml ??
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" ' +
      'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"></Properties>';

  // Tìm pid lớn nhất hiện có
  let maxPid = 1;
  const existingMatches = baseXml.match(getPropertyTagRegex()) || [];
  for (const property of existingMatches) {
    const pidVal = getAttrValue(property, 'pid');
    const pid = Number(pidVal);
    if (Number.isSafeInteger(pid)) {
      maxPid = Math.max(maxPid, pid);
    }
  }

  // Loại bỏ các property LYCERO_ cũ
  const withoutOldLycero = baseXml.replace(getPropertyTagRegex(), (prop) => {
    const name = getAttrValue(prop, 'name');
    return name && name.startsWith(LYCERO_PROP_PREFIX) ? '' : prop;
  });

  // Chuyển toàn bộ memory thành JSON và cắt nhỏ thành các chunk
  const jsonPayload = JSON.stringify(memory);
  const chunks: string[] = [];
  for (let offset = 0; offset < jsonPayload.length; ) {
    let end = Math.min(offset + CHUNK_SIZE, jsonPayload.length);
    // Tránh cắt đứt UTF-16 surrogate pairs
    if (end < jsonPayload.length && /[\ud800-\udbff]/.test(jsonPayload[end - 1]!)) {
      end--;
    }
    chunks.push(jsonPayload.slice(offset, end));
    offset = end;
  }

  const generatedProperties: string[] = [
    `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${++maxPid}" name="${LYCERO_PROP_PREFIX}DOC_ID"><vt:lpwstr>${escapeXmlText(memory.documentId)}</vt:lpwstr></property>`,
    `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${++maxPid}" name="${LYCERO_PROP_PREFIX}VERSION"><vt:lpwstr>${memory.version}</vt:lpwstr></property>`,
    `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${++maxPid}" name="${LYCERO_PROP_PREFIX}PERSONA"><vt:lpwstr>${escapeXmlText(memory.persona)}</vt:lpwstr></property>`,
    `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${++maxPid}" name="${LYCERO_PROP_PREFIX}CURRICULUM"><vt:lpwstr>${escapeXmlText(memory.curriculum)}</vt:lpwstr></property>`,
    `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${++maxPid}" name="${LYCERO_PROP_PREFIX}SESSION_COUNT"><vt:lpwstr>${memory.sessionCount}</vt:lpwstr></property>`,
  ];

  chunks.forEach((val, idx) => {
    generatedProperties.push(
      `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${++maxPid}" name="${LYCERO_PROP_PREFIX}CHUNK_${idx + 1}"><vt:lpwstr>${escapeXmlText(val)}</vt:lpwstr></property>`
    );
  });

  const propXmlString = generatedProperties.join('');

  // Chèn vào thẻ <Properties>
  const selfClosingRe = /<((?:[A-Za-z_][\w.-]*:)?Properties)\b([^>]*?)\/>/i;
  const selfClosingMatch = selfClosingRe.exec(withoutOldLycero);
  if (selfClosingMatch) {
    return withoutOldLycero.replace(
      selfClosingRe,
      () => `<${selfClosingMatch[1]}${selfClosingMatch[2]}>${propXmlString}</${selfClosingMatch[1]}>`
    );
  }

  return withoutOldLycero.replace(
    /<\/(?:[A-Za-z_][\w.-]*:)?Properties\s*>/i,
    (close) => `${propXmlString}${close}`
  );
}

/**
 * Trích xuất Ký ức Sư phạm ẩn từ tệp OOXML (.docx, .pptx, .xlsx)
 */
export async function extractDocumentProvenance(
  bytes: Uint8Array
): Promise<PedagogicalDocumentMemory | null> {
  if (!isZipArchive(bytes)) {
    return null;
  }

  try {
    const zip = await JSZip.loadAsync(bytes);

    // 1. Kiểm tra docProps/custom.xml
    const customPropsFile = zip.file(CUSTOM_PROPERTIES_PATH);
    if (customPropsFile) {
      const xml = await customPropsFile.async('string');
      const memory = parseProvenanceFromCustomPropsXml(xml);
      if (memory) {
        return memory;
      }
    }

    // 2. Kiểm tra customXml (quét các item*.xml tìm namespace urn:lycero:office:provenance:v1)
    const customXmlFiles = Object.keys(zip.files).filter((f) => /^customXml\/item\d+\.xml$/i.test(f));
    for (const path of customXmlFiles) {
      const file = zip.file(path);
      if (!file) continue;
      const xml = await file.async('string');
      if (xml.includes(LYCERO_CUSTOM_XML_NS)) {
        const payloadMatch = /<lycero:payload\b[^>]*>([\s\S]*?)<\/lycero:payload>/i.exec(xml);
        if (payloadMatch && payloadMatch[1]) {
          try {
            const parsed = JSON.parse(decodeXmlText(payloadMatch[1]));
            if (parsed && parsed.documentId) {
              return parsed as PedagogicalDocumentMemory;
            }
          } catch {}
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Nhúng hoặc cập nhật Ký ức Sư phạm ẩn vào tệp OOXML (.docx, .pptx, .xlsx)
 * Đảm bảo 100% byte-preserving cho tất cả các phần nội dung khác.
 */
export async function embedDocumentProvenance(
  bytes: Uint8Array,
  memory: PedagogicalDocumentMemory
): Promise<Uint8Array> {
  if (!isZipArchive(bytes)) {
    throw new Error('Target is not a valid OOXML ZIP package');
  }

  const zip = await JSZip.loadAsync(bytes);

  // 1. Cập nhật docProps/custom.xml
  const customPropsEntry = zip.file(CUSTOM_PROPERTIES_PATH);
  const originalCustomXml = customPropsEntry ? await customPropsEntry.async('string') : null;
  const newCustomXml = patchCustomPropertiesXml(originalCustomXml, memory);
  zip.file(CUSTOM_PROPERTIES_PATH, newCustomXml);

  // 2. Nếu custom.xml vừa được tạo mới: Đăng ký trong _rels/.rels và [Content_Types].xml
  if (!customPropsEntry) {
    // 2a. Đăng ký trong _rels/.rels
    const rootRelsPath = '_rels/.rels';
    const rootRelsEntry = zip.file(rootRelsPath);
    let rootRelsXml = rootRelsEntry
      ? await rootRelsEntry.async('string')
      : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

    if (!rootRelsXml.includes(CUSTOM_PROPERTIES_REL_TYPE)) {
      // Tìm max rId trong _rels
      let maxRid = 1;
      for (const m of rootRelsXml.matchAll(/Id="rId(\d+)"/g)) {
        maxRid = Math.max(maxRid, parseInt(m[1]!, 10));
      }
      const newRid = `rId${maxRid + 1}`;
      rootRelsXml = rootRelsXml.replace(
        '</Relationships>',
        `<Relationship Id="${newRid}" Type="${CUSTOM_PROPERTIES_REL_TYPE}" Target="${CUSTOM_PROPERTIES_PATH}"/></Relationships>`
      );
      zip.file(rootRelsPath, rootRelsXml);
    }

    // 2b. Đăng ký trong [Content_Types].xml
    const ctPath = '[Content_Types].xml';
    const ctEntry = zip.file(ctPath);
    if (ctEntry) {
      let ctXml = await ctEntry.async('string');
      if (!ctXml.includes(CUSTOM_PROPERTIES_CONTENT_TYPE)) {
        const override = `<Override PartName="/${CUSTOM_PROPERTIES_PATH}" ContentType="${CUSTOM_PROPERTIES_CONTENT_TYPE}"/>`;
        ctXml = ctXml.replace('</Types>', `${override}</Types>`);
        zip.file(ctPath, ctXml);
      }
    }
  }

  // 3. Đóng gói lại và xuất Uint8Array
  return await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
