/**
 * Lycero Office Desktop
 * Copyright 2026 ITAC AI Heavy Industries.
 * All rights reserved.
 */
import React, { useState } from 'react';
import type { ActionCardData } from '@lycero/agent-core';

export interface ActionCardProps {
  card: ActionCardData;
  onApply?: (card: ActionCardData) => void | Promise<void>;
  className?: string;
}

export function ActionCard({ card, onApply, className = '' }: ActionCardProps): React.JSX.Element {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(Boolean(card.applied));

  const handleApply = async () => {
    if (applied || applying || !onApply) return;
    setApplying(true);
    try {
      await onApply(card);
      setApplied(true);
    } catch (err) {
      console.error('Failed to apply action card:', err);
    } finally {
      setApplying(false);
    }
  };

  const isPedagogical = card.type?.includes('pedagogical') || card.type?.includes('matrix') || card.type?.includes('bloom');

  return (
    <div
      className={`lycero-action-card ${applied ? 'applied' : ''} ${className}`}
      style={{
        marginTop: 10,
        marginBottom: 10,
        padding: '12px 14px',
        borderRadius: 10,
        border: applied ? '1px solid #10b981' : '1px solid var(--lycero-terracotta-border, #e6cec4)',
        background: applied ? 'rgba(16, 185, 129, 0.05)' : 'var(--lycero-ivory-surface, #F9F8F3)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        fontFamily: "var(--lycero-font-sans, 'Be Vietnam Pro', sans-serif)",
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: applied ? '#10b981' : 'var(--color-ai-action, #8B3A1A)',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {applied ? '✓' : '✦'}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ai-action, #8B3A1A)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {isPedagogical ? 'Hành Động Sư Phạm' : 'Đề Xuất Cập Nhật'}
          </span>
        </div>
        {applied && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#059669',
              background: '#ecfdf5',
              padding: '2px 8px',
              borderRadius: 12,
              border: '1px solid #a7f3d0',
            }}
          >
            Đã áp dụng
          </span>
        )}
      </div>

      {/* Title & Description */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary, #1C1B18)', marginBottom: 4 }}>
        {card.title || 'Đề xuất cập nhật từ Lycero Mate'}
      </div>
      {card.description && (
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #606366)', lineHeight: 1.4, marginBottom: 8 }}>
          {card.description}
        </div>
      )}

      {/* Payload Summary (if present and not applied) */}
      {!applied && card.payload && typeof card.payload === 'object' && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--color-text-dim, #605e5c)',
            background: 'rgba(0, 0, 0, 0.03)',
            padding: '6px 8px',
            borderRadius: 6,
            marginBottom: 8,
            maxHeight: 120,
            overflowY: 'auto',
            fontFamily: 'monospace',
          }}
        >
          {card.payload.summary || card.payload.content || (card.payload.matrix ? `Ma trận: ${JSON.stringify(card.payload.matrix)}` : JSON.stringify(card.payload, null, 2).slice(0, 200))}
        </div>
      )}

      {/* Action Footer */}
      {!applied && onApply && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            type="button"
            onClick={handleApply}
            disabled={applying}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              background: 'var(--color-ai-action, #8B3A1A)',
              color: '#ffffff',
              cursor: applying ? 'not-allowed' : 'pointer',
              opacity: applying ? 0.7 : 1,
              transition: 'background 0.15s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'var(--color-ai-action-hover, #722e14)')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'var(--color-ai-action, #8B3A1A)')}
          >
            {applying ? 'Đang áp dụng...' : 'Áp dụng vào tài liệu ➔'}
          </button>
        </div>
      )}
    </div>
  );
}
