/**
 * Lycero Office Desktop
 * Copyright 2026 ITAC AI Heavy Industries.
 * All rights reserved.
 */
import type { PedagogicalDocumentMemory } from './types';

let currentMemory: PedagogicalDocumentMemory | null = null;
const listeners = new Set<(memory: PedagogicalDocumentMemory | null) => void>();

export function getActivePedagogicalMemory(): PedagogicalDocumentMemory | null {
  return currentMemory;
}

export function setActivePedagogicalMemory(memory: PedagogicalDocumentMemory | null): void {
  currentMemory = memory;
  listeners.forEach((listener) => {
    try {
      listener(currentMemory);
    } catch (err) {
      console.error('Error in pedagogical memory listener:', err);
    }
  });

  const win = (globalThis as { window?: { dispatchEvent?: (e: unknown) => void; CustomEvent?: new (type: string, init?: { detail?: unknown }) => unknown } }).window;
  if (win && typeof win.dispatchEvent === 'function' && typeof win.CustomEvent === 'function') {
    win.dispatchEvent(
      new win.CustomEvent('lycero-memory-updated', {
        detail: currentMemory,
      })
    );
  }
}

export function onActivePedagogicalMemoryChange(
  listener: (memory: PedagogicalDocumentMemory | null) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
