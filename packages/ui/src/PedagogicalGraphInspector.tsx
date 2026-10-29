/**
 * Lycero Office Desktop
 * Copyright 2026 ITAC AI Heavy Industries.
 * All rights reserved.
 */
import React, { useState } from 'react';
import type {
  PedagogicalDocumentMemory,
  BloomLevel,
  MiniGraphNodeType,
  MiniGraphNode,
  DocumentChangelogEntry,
} from '@lycero/agent-core';
import {
  BLOOM_LABELS,
  CURRICULUM_LABELS,
  PERSONA_LABELS,
  getBloomCoverage,
  recordPedagogicalAction,
} from '@lycero/agent-core';

export interface PedagogicalGraphInspectorProps {
  memory: PedagogicalDocumentMemory;
  onUpdateMemory: (updated: PedagogicalDocumentMemory) => void;
  className?: string;
}

export function PedagogicalGraphInspector({
  memory,
  onUpdateMemory,
  className = '',
}: PedagogicalGraphInspectorProps): React.JSX.Element {
  const [newConceptInput, setNewConceptInput] = useState('');
  const [selectedBloom, setSelectedBloom] = useState<BloomLevel>('understand');
  const [directives, setDirectives] = useState(memory.directives || '');
  const [directivesSaved, setDirectivesSaved] = useState(false);

  const coverage = getBloomCoverage(memory.miniGraph);
  const nodes = memory.miniGraph.nodes || [];
  const changelogs = (memory.changelog || []).slice(-10).reverse();

  const handleAddConcept = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newConceptInput.trim();
    if (!label) return;

    const updated = recordPedagogicalAction(memory, {
      actionType: 'add_concept',
      summary: `Thêm khái niệm sư phạm: ${label}`,
      actor: 'teacher',
      newConcepts: [{ label, bloomLevel: selectedBloom, type: 'concept' }],
    });

    onUpdateMemory(updated);
    setNewConceptInput('');
  };

  const handleSaveDirectives = () => {
    const updated = recordPedagogicalAction(memory, {
      actionType: 'update_directives',
      summary: 'Cập nhật chỉ thị sư phạm riêng cho tài liệu',
      actor: 'teacher',
      directives: directives.trim(),
    });
    onUpdateMemory(updated);
    setDirectivesSaved(true);
    setTimeout(() => setDirectivesSaved(false), 2000);
  };

  const bloomColors: Record<BloomLevel, string> = {
    remember: '#3b82f6',
    understand: '#10b981',
    apply: '#f59e0b',
    analyze: '#8b5cf6',
    evaluate: '#ec4899',
    create: 'var(--color-ai-action, #8B3A1A)',
  };

  return (
    <div
      className={`pedagogical-graph-inspector ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '12px 14px',
        fontSize: 13,
        color: 'var(--color-text-primary, #1C1B18)',
        fontFamily: "var(--lycero-font-sans, 'Be Vietnam Pro', sans-serif)",
        overflowY: 'auto',
      }}
    >
      {/* 1. Header Badges */}
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 8,
          background: 'var(--lycero-ivory-surface, #F9F8F3)',
          border: '1px solid var(--lycero-border, #DDD9CE)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-ai-action, #8B3A1A)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Hồ Sơ Sư Phạm & Khung Chuẩn
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary, #606366)' }}>
            v{memory.version} (Phiên {memory.sessionCount})
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span
            style={{
              padding: '3px 8px',
              borderRadius: 6,
              background: '#fbf5f2',
              color: 'var(--color-ai-action, #8B3A1A)',
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid #e6cec4',
            }}
          >
            👨‍🏫 {PERSONA_LABELS[memory.persona] || memory.persona}
          </span>
          <span
            style={{
              padding: '3px 8px',
              borderRadius: 6,
              background: '#f0fdf4',
              color: '#166534',
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid #bbf7d0',
            }}
          >
            📋 {CURRICULUM_LABELS[memory.curriculum] || memory.curriculum}
          </span>
          {memory.subject && (
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 6,
                background: '#eff6ff',
                color: '#1e40af',
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid #bfdbfe',
              }}
            >
              📚 Môn: {memory.subject} {memory.grade ? `- Lớp ${memory.grade}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* 2. Bloom Coverage Matrix */}
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 8,
          background: 'var(--lycero-ivory-surface, #F9F8F3)',
          border: '1px solid var(--lycero-border, #DDD9CE)',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary, #1C1B18)', marginBottom: 8 }}>
          Độ Phủ Nhận Thức Bloom & Năng Lực
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {(Object.keys(BLOOM_LABELS) as BloomLevel[]).map((level) => {
            const count = coverage[level] || 0;
            return (
              <div
                key={level}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: count > 0 ? 'rgba(0, 0, 0, 0.03)' : 'transparent',
                  border: `1px solid ${count > 0 ? bloomColors[level] : 'var(--border, #e3e6ea)'}`,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: count > 0 ? 600 : 400, color: count > 0 ? bloomColors[level] : 'var(--color-text-dim, #605e5c)' }}>
                  {BLOOM_LABELS[level]}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: '50%',
                    width: 18,
                    height: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: count > 0 ? bloomColors[level] : 'transparent',
                    color: count > 0 ? '#ffffff' : 'var(--color-text-dim, #605e5c)',
                  }}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Concept Nodes Graph Flow */}
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 8,
          background: 'var(--lycero-ivory-surface, #F9F8F3)',
          border: '1px solid var(--lycero-border, #DDD9CE)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary, #1C1B18)' }}>
            Mạch Khái Niệm & Tri Thức ({nodes.length} nodes)
          </div>
        </div>

        {nodes.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--color-text-dim, #605e5c)', fontStyle: 'italic', marginBottom: 10 }}>
            Chưa có khái niệm nào. Bạn có thể trò chuyện cùng Lycero Mate hoặc thêm thủ công bên dưới.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {nodes.map((n: MiniGraphNode, idx: number) => (
              <div
                key={n.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: '#ffffff',
                  border: '1px solid var(--border-subtle, #efefef)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--color-text-dim, #605e5c)', fontWeight: 700, width: 18 }}>
                  {idx + 1}.
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{n.label}</span>
                {n.bloomLevel && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: `${bloomColors[n.bloomLevel]}15`,
                      color: bloomColors[n.bloomLevel],
                      border: `1px solid ${bloomColors[n.bloomLevel]}40`,
                    }}
                  >
                    {BLOOM_LABELS[n.bloomLevel]}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Quick Add Concept Form */}
        <form onSubmit={handleAddConcept} style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            placeholder="Thêm khái niệm / bài tập mới..."
            value={newConceptInput}
            onChange={(e) => setNewConceptInput(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid var(--border, #e3e6ea)',
              background: '#ffffff',
              outline: 'none',
            }}
          />
          <select
            value={selectedBloom}
            onChange={(e) => setSelectedBloom(e.target.value as BloomLevel)}
            style={{
              padding: '6px 8px',
              fontSize: 11,
              borderRadius: 6,
              border: '1px solid var(--border, #e3e6ea)',
              background: '#ffffff',
              outline: 'none',
            }}
          >
            {(Object.keys(BLOOM_LABELS) as BloomLevel[]).map((level) => (
              <option key={level} value={level}>
                {BLOOM_LABELS[level]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!newConceptInput.trim()}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              background: 'var(--color-ai-action, #8B3A1A)',
              color: '#ffffff',
              cursor: newConceptInput.trim() ? 'pointer' : 'default',
              opacity: newConceptInput.trim() ? 1 : 0.5,
            }}
          >
            + Thêm
          </button>
        </form>
      </div>

      {/* 4. Teacher Directives */}
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 8,
          background: 'var(--lycero-ivory-surface, #F9F8F3)',
          border: '1px solid var(--lycero-border, #DDD9CE)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary, #1C1B18)' }}>
            Chỉ Đạo Sư Phạm Riêng (Document Directives)
          </span>
          {directivesSaved && (
            <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>✓ Đã lưu</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary, #606366)', marginBottom: 8 }}>
          Chỉ đạo này sẽ được nạp trực tiếp vào bối cảnh của AI Mate cho mọi phiên sửa đổi sau.
        </div>
        <textarea
          rows={3}
          value={directives}
          onChange={(e) => setDirectives(e.target.value)}
          placeholder="Ví dụ: Lớp học gồm nhiều học sinh năng khiếu, cần ra câu hỏi bứt phá 9+; hạn chế lý thuyết suông..."
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: 12,
            borderRadius: 6,
            border: '1px solid var(--border, #e3e6ea)',
            background: '#ffffff',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button
            type="button"
            onClick={handleSaveDirectives}
            style={{
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              background: 'var(--color-ai-action, #8B3A1A)',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Lưu chỉ đạo sư phạm
          </button>
        </div>
      </div>

      {/* 5. Revision Changelog Timeline */}
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 8,
          background: 'var(--lycero-ivory-surface, #F9F8F3)',
          border: '1px solid var(--lycero-border, #DDD9CE)',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary, #1C1B18)', marginBottom: 8 }}>
          Nhật Ký Quyết Định Sư Phạm (Lịch Sử Phiên)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {changelogs.map((log: DocumentChangelogEntry) => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            });
            const isTeacher = log.actor === 'teacher';
            return (
              <div
                key={log.id}
                style={{
                  fontSize: 11,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: isTeacher ? '#f0fdf4' : 'rgba(0, 0, 0, 0.02)',
                  borderLeft: `3px solid ${isTeacher ? '#10b981' : 'var(--color-ai-action, #8B3A1A)'}`,
                  lineHeight: 1.4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-dim, #605e5c)', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, color: isTeacher ? '#166534' : 'var(--color-ai-action, #8B3A1A)' }}>
                    {isTeacher ? '👤 Người dạy' : '🤖 Lycero Mate'}
                  </span>
                  <span>{timeStr}</span>
                </div>
                <div>{log.summary}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
