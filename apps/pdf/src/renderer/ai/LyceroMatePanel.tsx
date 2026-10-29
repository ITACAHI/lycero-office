/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { aiPanelWidthAtPointer, AiPanelSideButton, ThinkingBlock } from '@lycero/ui'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import { AgentLoop } from '@lycero/agent-core'
import type { WorkBundle } from '@lycero/ai-auth'
import { imageGenerationAvailable, type AiSettings } from '@lycero/ai-provider/browser'
import { AiComposer, AiScopeQuote, AiTypingIndicator, type AiScopeQuoteData } from '@lycero/ui'
import { aiLangDirective, t as tGlobal, useI18n } from '../i18n/locale'
import { Markdown } from '@lycero/ui'
import sendEnterOn from '../assets/send-enter-on.png'
import sendEnterOff from '../assets/send-enter-off.png'
import sendStop from '../assets/send-stop.png'
import { createPdfSkill } from './pdf-skill'
import { createElectronTransport } from './transport'
import { PDF_NAV_SCHEME, parsePdfNavHref } from './pdf-nav'
import type { FileOpConfirm, PdfAiDeps, PdfAppDeps } from './tools'

// Word-parity count (same as docs/markdown): Asian chars one by one + non-Asian words
const ASIAN_RE =
  /[ᄀ-ᇿ⺀-⿟、-〿぀-ヿ㄀-ㄯ㄰-㆏㇀-ㇿ㐀-䶿一-鿿가-힯豈-﫿！-｠￠-￦]|[\uD840-\uD87F][\uDC00-\uDFFF]/g
const NON_ASIAN_WORD_RE = /[A-Za-z0-9À-ɏ]+(?:['-][A-Za-z0-9À-ɏ]+)*/g

function countWords(text: string): number {
  return (text.match(ASIAN_RE) ?? []).length + (text.match(NON_ASIAN_WORD_RE) ?? []).length
}

const PANEL_WIDTH_KEY = 'pdf-ai-panel-width'
const PANEL_WIDTH_DEFAULT = 360
const PANEL_WIDTH_MIN = 280

function clampPanelWidth(w: number): number {
  // The viewport can be transiently tiny (a WebContentsView is 0×0 until the
  // shell lays it out), so never let the ceiling drop below the minimum
  const max = Math.max(PANEL_WIDTH_MIN, Math.min(720, Math.round(window.innerWidth * 0.6)))
  return Math.min(Math.max(w, PANEL_WIDTH_MIN), max)
}

function loadPanelWidth(): number {
  const saved = Number(localStorage.getItem(PANEL_WIDTH_KEY))
  // static bounds only — clamping against the window here would bake a
  // transiently small viewport into the restored preference
  return Number.isFinite(saved) && saved > 0
    ? Math.min(Math.max(saved, PANEL_WIDTH_MIN), 720)
    : PANEL_WIDTH_DEFAULT
}

interface ToolActivity {
  name: string
  summary: string
  isError?: boolean
  output?: string
}

interface ChatEntry {
  role: 'user' | 'assistant'
  text: string
  streaming?: boolean
  isError?: boolean
  /** raw model reasoning delta (thinking); rendered as an expandable ThinkingBlock */
  reasoning?: string
  /** true while the model is in the 'thinking' phase (streaming reasoning, no text yet) */
  thinkingPhase?: boolean
  /** the run failed and this user message was rolled back out of the model context */
  undelivered?: boolean
  tools?: ToolActivity[]
  /** the passage this user message targeted, frozen at send */
  scope?: AiScopeQuoteData
}

/** longest selection excerpt echoed on a user bubble */
const SCOPE_TEXT_MAX = 200

type Phase = 'thinking' | 'replying' | 'working'

interface PendingConfirm {
  req: FileOpConfirm
  settle: (ok: boolean) => void
}

export function LyceroMate({
  api,
  filePath,
  onCollapse,
  preset,
  onRunDone,
  onClearSelection,
}: {
  api: PdfAppDeps
  /** Absolute path of the open PDF (chat history is keyed to it) */
  filePath?: string
  onCollapse: () => void
  /** Ribbon AI buttons push a one-shot prompt; a new nonce triggers an auto-run */
  preset?: { text: string; nonce: number } | null
  /** Fired when a run that mutated the document finishes (drives the untitled-blank auto-save) */
  onRunDone?: () => void
  /** The × on the scope chip: drop the cached selection so runs target the whole document */
  onClearSelection?: () => void
}): ReactElement {
  const { lang, t } = useI18n()
  const [chat, setChat] = useState<ChatEntry[]>([])
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<Phase>('thinking')
  /** the scope chip's expandable preview of the selected text */
  const [scopePreviewOpen, setScopePreviewOpen] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  // ── Chat-history persistence (r142): same shared store Docs/Sheets use ──
  const chatIdsRef = useRef<{ projectId: string; chatId: string } | null>(null)
  /** current turn's streamed text; completed turns collect into runTextsRef */
  const segTextRef = useRef('')
  /** whole-run accumulation: one stored assistant message per run (consecutive
      assistant rows would break restore() on strict-alternation providers) */
  const runTextsRef = useRef<string[]>([])
  const runToolsRef = useRef<ToolActivity[]>([])
  const chatStore = () =>
    (
      window as Window & {
        projectApi?: {
          resolveChat(args: {
            filePath: string | null
            tempChatId?: string
          }): Promise<{ projectId: string; chatId: string }>
          appendChat(args: {
            projectId: string
            chatId: string
            role: 'user' | 'assistant'
            text: string
            tools?: Array<{ name: string; summary: string; isError?: boolean; output?: string }>
            scope?: AiScopeQuoteData
          }): Promise<void>
          loadChat(args: { projectId: string; chatId: string; limit?: number }): Promise<
            Array<{
              role: 'user' | 'assistant'
              text: string
              tools?: Array<{ name: string; summary: string; isError?: boolean; output?: string }>
              scope?: AiScopeQuoteData
            }>
          >
          rebindChat(args: {
            projectId: string
            tempChatId: string
            newFilePath: string
          }): Promise<{ projectId: string; chatId: string } | null>
        }
      }
    ).projectApi
  const persistMessage = (
    role: 'user' | 'assistant',
    text: string,
    tools?: ToolActivity[],
    scope?: AiScopeQuoteData,
  ): void => {
    const ids = chatIdsRef.current
    const store = chatStore()
    if (!ids || !store || (!text && !tools?.length)) return
    void store
      .appendChat({
        projectId: ids.projectId,
        chatId: ids.chatId,
        role,
        text,
        ...(tools && tools.length > 0
          ? {
              tools: tools.map((tool) => ({
                name: tool.name,
                summary: tool.summary,
                isError: tool.isError,
                output: tool.output,
              })),
            }
          : {}),
        ...(scope ? { scope } : {}),
      })
      .catch(() => {
        /* silent */
      })
  }
  /** persist the whole run as ONE assistant message (docs parity: restore()
      feeds these back verbatim, and providers require user/assistant
      alternation; cancelled runs persist nothing — the unanswered user
      message is filtered out by restore()) */
  const persistRun = (): void => {
    const texts = [...runTextsRef.current, segTextRef.current].filter(Boolean)
    const tools = runToolsRef.current
    segTextRef.current = ''
    runTextsRef.current = []
    runToolsRef.current = []
    if (texts.length > 0 || tools.length > 0) {
      persistMessage('assistant', texts.join('\n\n'), tools)
    }
  }
  useEffect(() => {
    const store = chatStore()
    if (!store) return
    const tempChatId = `unsaved-${Date.now()}`
    void store
      .resolveChat({ filePath: filePath || null, tempChatId })
      .then((ids) => {
        chatIdsRef.current = ids
        return store.loadChat({ projectId: ids.projectId, chatId: ids.chatId, limit: 200 })
      })
      .then((msgs) => {
        if (msgs.length === 0) return
        setChat((prev) => [
          ...msgs.map((m) => ({
            role: m.role,
            text: m.text,
            tools: m.tools?.map((tool) => ({
              name: tool.name,
              summary: tool.summary,
              isError: tool.isError,
              output: tool.output,
            })),
            ...(m.scope ? { scope: m.scope } : {}),
          })),
          ...prev,
        ])
        // follow-ups after reopening continue the previous conversation
        loopRef.current?.restore(msgs.map((m) => ({ role: m.role, text: m.text })))
      })
      .catch(() => {
        /* history load failures are silent */
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only, like Docs
  }, [])
  /** blank/generated PDFs get a path on first save: bind the unsaved-* history to it */
  useEffect(() => {
    const ids = chatIdsRef.current
    const store = chatStore()
    if (!store || !ids || !filePath || !ids.chatId.startsWith('unsaved-')) return
    void store
      .rebindChat({ projectId: ids.projectId, tempChatId: ids.chatId, newFilePath: filePath })
      .then((rebound) => {
        if (rebound?.chatId) chatIdsRef.current = rebound
      })
      .catch(() => {
        /* silent */
      })
  }, [filePath])
  // preferred = the user's chosen width (the only value persisted); panelWidth =
  // what fits the current window. Deriving the display width from the preference
  // means a transiently small window never permanently shrinks the panel.
  const preferredWidthRef = useRef(loadPanelWidth())
  const [panelWidth, setPanelWidth] = useState(() => clampPanelWidth(preferredWidthRef.current))
  const [resizing, setResizing] = useState(false)
  const asideRef = useRef<HTMLElement>(null)

  // The .ai-dock wrapper owns the animated width (docs-style 180ms slide);
  // it tracks the resizable panel width through this variable
  useEffect(() => {
    const dock = asideRef.current?.closest('.ai-dock') as HTMLElement | null
    dock?.style.setProperty('--ai-panel-width', `${panelWidth}px`)
  }, [panelWidth])
  const settingsRef = useRef<AiSettings | null>(null)

  /** gsk login state for the cloud-tools gate (refreshed on mount and window focus) */
  const gskLoggedInRef = useRef(false)
  useEffect(() => {
    let alive = true
    const refresh = () => {
      void window.pdfApi
        ?.gskStatus()
        .then((s) => {
          if (alive) gskLoggedInRef.current = !!s?.loggedIn
        })
        .catch(() => {})
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => {
      alive = false
      window.removeEventListener('focus', refresh)
    }
  }, [])
  const langRef = useRef(lang)
  langRef.current = lang
  const apiRef = useRef(api)
  apiRef.current = api
  const onRunDoneRef = useRef(onRunDone)
  onRunDoneRef.current = onRunDone
  /** Any tool in the current run reported mutated: true */
  const runMutatedRef = useRef(false)

  /** Confirmation card for irreversible file operations; one at a time, a second request is refused */
  const [fileOpConfirm, setFileOpConfirm] = useState<FileOpConfirm | null>(null)
  const confirmRef = useRef<PendingConfirm | null>(null)
  const requestFileOpConfirm = (req: FileOpConfirm, signal?: AbortSignal): Promise<boolean> =>
    new Promise((resolve) => {
      if (confirmRef.current || signal?.aborted) {
        resolve(false)
        return
      }
      const pending: PendingConfirm = {
        req,
        settle: (ok) => {
          if (confirmRef.current !== pending) return
          confirmRef.current = null
          setFileOpConfirm(null)
          resolve(ok)
        },
      }
      confirmRef.current = pending
      setFileOpConfirm(req)
      signal?.addEventListener('abort', () => pending.settle(false), { once: true })
    })
  // another document or the panel going away answers a pending card with "no"
  useEffect(() => () => confirmRef.current?.settle(false), [filePath])

  const patchLast = (patch: Partial<ChatEntry> | ((last: ChatEntry) => Partial<ChatEntry>)) => {
    setChat((prev) => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (!last || last.role !== 'assistant') return prev
      next[next.length - 1] = { ...last, ...(typeof patch === 'function' ? patch(last) : patch) }
      return next
    })
  }

  // Phase A.6: cache enabled work bundles from BundleStore (main process)
  const bundlesRef = useRef<WorkBundle[]>([])
  useEffect(() => {
    const loadBundles = () =>
      window.aiOffice?.bundles
        ?.getEnabled()
        .then((bundles: WorkBundle[]) => {
          bundlesRef.current = bundles ?? []
        })
        .catch(() => {})
    loadBundles()
    const unsub = window.aiOffice?.bundles?.onEnabledChanged(() => {
      void loadBundles()
    })
    return unsub
  }, [])

  // The loop is built once; every mutable value goes through a ref getter
  const loopRef = useRef<AgentLoop | null>(null)
  if (!loopRef.current) {
    const deps: PdfAiDeps = {
      doc: () => apiRef.current.doc(),
      fileName: () => apiRef.current.fileName(),
      pageCount: () => apiRef.current.pageCount(),
      currentPage: () => apiRef.current.currentPage(),
      readOnly: () => apiRef.current.readOnly(),
      ocrText: (idx) => apiRef.current.ocrText(idx),
      selection: () => apiRef.current.selection(),
      pendingSummary: () => apiRef.current.pendingSummary(),
      outline: () => apiRef.current.outline(),
      searchIndex: () => apiRef.current.searchIndex(),
      isDeleted: (i) => apiRef.current.isDeleted(i),
      gotoPage: (p) => apiRef.current.gotoPage(p),
      addMarkup: (type, idx, rects, color) => apiRef.current.addMarkup(type, idx, rects, color),
      annotationSummary: () => apiRef.current.annotationSummary(),
      createDocument: (request) => apiRef.current.createDocument(request),
      confirmFileOp: requestFileOpConfirm,
      insertBlankPage: (afterVis) => apiRef.current.insertBlankPage(afterVis),
      setPageSize: (w, h) => apiRef.current.setPageSize(w, h),
      cropPages: (vis, rect) => apiRef.current.cropPages(vis, rect),
      replacePages: (vis) => apiRef.current.replacePages(vis),
      extractPages: (vis) => apiRef.current.extractPages(vis),
      splitPdf: (n) => apiRef.current.splitPdf(n),
      splitPages: (n) => apiRef.current.splitPages(n),
      mergePages: (n, direction, separator) => apiRef.current.mergePages(n, direction, separator),
      stamps: () => apiRef.current.stamps(),
      setStamps: (cfg) => apiRef.current.setStamps(cfg),
      annotationsOn: (idx) => apiRef.current.annotationsOn(idx),
      addNote: (idx, at, contents, color) => apiRef.current.addNote(idx, at, contents, color),
      findNoteRoot: (idx, key) => apiRef.current.findNoteRoot(idx, key),
      replyToThread: (idx, root, contents) => apiRef.current.replyToThread(idx, root, contents),
      editNote: (idx, item, contents) => apiRef.current.editNote(idx, item, contents),
      deleteMarkups: (idx, keys) => apiRef.current.deleteMarkups(idx, keys),
      deleteNoteThread: (idx, root) => apiRef.current.deleteNoteThread(idx, root),
      editText: (input) => apiRef.current.editText(input),
      moveTextBlock: (idx, block, d) => apiRef.current.moveTextBlock(idx, block, d),
      insertText: (input) => apiRef.current.insertText(input),
      addFormMark: (idx, kind, rect) => apiRef.current.addFormMark(idx, kind, rect),
      textInserts: () => apiRef.current.textInserts(),
      updateTextInsert: (id, edit) => apiRef.current.updateTextInsert(id, edit),
      moveTextInsert: (id, origin) => apiRef.current.moveTextInsert(id, origin),
      deleteTextInsert: (id) => apiRef.current.deleteTextInsert(id),
      editFonts: () => apiRef.current.editFonts(),
      formEdits: () => apiRef.current.formEdits(),
      applyOps: (ops, opts) => apiRef.current.applyOps(ops, opts),
      metadata: () => apiRef.current.metadata(),
      pageOrder: () => apiRef.current.pageOrder(),
      pageGeom: (idx) => apiRef.current.pageGeom(idx),
      listImages: () => apiRef.current.listImages(),
      isImageClaimed: (ref) => apiRef.current.isImageClaimed(ref),
      insertImage: (idx, png, rect, layer) => apiRef.current.insertImage(idx, png, rect, layer),
      transformImage: (ref, rect, layer, quarterTurns) =>
        apiRef.current.transformImage(ref, rect, layer, quarterTurns),
      replaceImage: (ref, png) => apiRef.current.replaceImage(ref, png),
      bakeImage: (ref, op, signal) => apiRef.current.bakeImage(ref, op, signal),
      deleteImage: (ref) => apiRef.current.deleteImage(ref),
      searchImages: (query, max) => apiRef.current.searchImages(query, max),
      generateImage: (op) => apiRef.current.generateImage(op),
      imageGenAvailable: () =>
        imageGenerationAvailable(settingsRef.current, gskLoggedInRef.current),
      fetchImage: (url) => apiRef.current.fetchImage(url),
    }
    loopRef.current = new AgentLoop({
      transport: createElectronTransport(() => settingsRef.current!),
      skill: createPdfSkill(deps),
      bundlesRef,
      systemSuffix: () => aiLangDirective(langRef.current),
      events: {
        onText: (text) => {
          setPhase('replying')
          segTextRef.current = text
          patchLast({ text })
        },
        onReasoning: (text) => {
          setPhase('thinking')
          patchLast((last) => ({ reasoning: (last.reasoning ?? '') + text, thinkingPhase: true }))
        },
        onPhase: (phase) => patchLast({ thinkingPhase: phase.kind === 'thinking' }),
        onToolExecuted: ({ call, execution }) => {
          setPhase('working')
          if (execution.mutated) runMutatedRef.current = true
          runToolsRef.current.push({
            name: call.name,
            summary: execution.summary,
            isError: execution.isError,
            output: execution.output?.slice(0, 2000),
          })
          patchLast((last) => ({
            tools: [
              ...(last.tools ?? []),
              {
                name: call.name,
                summary: execution.summary,
                isError: execution.isError,
                output: execution.output?.slice(0, 2000),
              },
            ],
          }))
        },
        onTurnEnd: () => {
          setPhase('thinking')
          runTextsRef.current.push(segTextRef.current)
          segTextRef.current = ''
          patchLast({ streaming: false })
          setChat((prev) => [...prev, { role: 'assistant', text: '', streaming: true }])
        },
        onDone: ({ text, cancelled, turnLimit, truncated }) => {
          const base = turnLimit
            ? [text, tGlobal('aiTurnLimit')].filter(Boolean).join('\n\n')
            : text || (cancelled ? tGlobal('aiStopped') : '')
          // finish_reason=length with no prose (a reasoning model that spent the whole
          // output budget thinking) must say so instead of showing the bare "(no reply)",
          // which reads like the assistant ignored the user — same handling as docs
          const final = truncated
            ? [base, tGlobal('aiTruncatedNote')].filter(Boolean).join('\n\n')
            : base
          if (cancelled) {
            segTextRef.current = ''
            runTextsRef.current = []
            runToolsRef.current = []
          } else {
            segTextRef.current = final || segTextRef.current
            persistRun()
          }
          patchLast((last) => ({
            streaming: false,
            text: final || (last.tools?.length ? last.text : tGlobal('aiNoReply')),
          }))
          setBusy(false)
          if (runMutatedRef.current) {
            runMutatedRef.current = false
            onRunDoneRef.current?.()
          }
        },
        onError: (error) => {
          setChat((prev) => {
            const next = [...prev]
            // the loop rolled this run's user message out of the model context — surface that
            for (let i = next.length - 1; i >= 0; i--) {
              const entry = next[i]!
              if (entry.role === 'user') {
                next[i] = { ...entry, undelivered: true }
                break
              }
            }
            const last = next.at(-1)
            if (last?.role === 'assistant') {
              next[next.length - 1] = { ...last, streaming: false, text: error, isError: true }
            }
            return next
          })
          setBusy(false)
        },
      },
    })
  }

  useEffect(() => {
    if (stickToBottomRef.current) {
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight })
    }
  }, [chat, busy, fileOpConfirm])

  const onChatScroll = (): void => {
    const el = chatRef.current
    if (!el) return
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }

  /** retryScope: null = a retry that had no scope; undefined = capture the live selection */
  const send = (text: string, retryScope?: AiScopeQuoteData | null): void => {
    const instruction = text.trim()
    const loop = loopRef.current
    if (!instruction || !loop || loop.busy) return
    stickToBottomRef.current = true
    const scope = retryScope !== undefined ? (retryScope ?? undefined) : selectionScopeQuote()
    persistMessage('user', instruction, undefined, scope)
    segTextRef.current = ''
    runTextsRef.current = []
    runToolsRef.current = []
    setChat((prev) => [
      ...prev,
      { role: 'user', text: instruction, ...(scope ? { scope } : {}) },
      { role: 'assistant', text: '', streaming: true },
    ])
    setPrompt('')
    setBusy(true)
    setPhase('thinking')
    runMutatedRef.current = false
    void (async () => {
      try {
        settingsRef.current = await window.pdfApi.getAiSettings()
        await loop.run(instruction)
      } catch (err) {
        patchLast({
          streaming: false,
          text: err instanceof Error ? err.message : String(err),
          isError: true,
        })
        setBusy(false)
      }
    })()
  }

  const stop = (): void => loopRef.current?.cancel()

  // One-click AI actions from the ribbon / Ask popover; while a run is active the
  // preset lands in the composer instead of being dropped silently (markdown parity)
  useEffect(() => {
    if (!preset) return
    if (loopRef.current?.busy) setPrompt(preset.text)
    else send(preset.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per nonce
  }, [preset?.nonce])

  // Re-derive the display width on window resize (max is 60% of the window);
  // growing the window back restores the preferred width
  useEffect(() => {
    const onResize = (): void => setPanelWidth(clampPanelWidth(preferredWidthRef.current))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const resizeCleanupRef = useRef<(() => void) | null>(null)
  useEffect(() => () => resizeCleanupRef.current?.(), [])

  /** Drag the inner panel edge to resize from the selected window side. */
  const startResize = (e: ReactPointerEvent<HTMLDivElement>): void => {
    e.preventDefault()
    const resizer = e.currentTarget
    setResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev: PointerEvent): void => {
      const w = clampPanelWidth(aiPanelWidthAtPointer(ev.clientX))
      preferredWidthRef.current = w
      setPanelWidth(w)
    }
    let done = false
    const cleanup = (): void => {
      if (done) return
      done = true
      resizeCleanupRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', cleanup)
      window.removeEventListener('pointercancel', cleanup)
      resizer.removeEventListener('lostpointercapture', cleanup)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setResizing(false)
      localStorage.setItem(PANEL_WIDTH_KEY, String(Math.round(preferredWidthRef.current)))
    }
    resizeCleanupRef.current = cleanup
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', cleanup)
    window.addEventListener('pointercancel', cleanup)
    // lostpointercapture also fires if the resizer is unmounted mid-drag (panel collapse)
    resizer.addEventListener('lostpointercapture', cleanup)
    resizer.setPointerCapture(e.pointerId)
  }

  const typingLabel =
    phase === 'replying' ? t('aiReplying') : phase === 'working' ? t('aiWorking') : t('aiThinking')

  // scope chip data, read per render (App re-renders on every selection change)
  const scopeSel = api.selection()
  const hasScopeSelection = !!scopeSel && scopeSel.text.trim().length > 0

  const selectionScopeQuote = (): AiScopeQuoteData | undefined => {
    const sel = api.selection()
    const text = sel?.text.replace(/\s+/g, ' ').trim() ?? ''
    if (!sel || !text) return undefined
    return {
      label: t('aiScopeSelection', {
        page: sel.lastPage > sel.page ? `${sel.page}-${sel.lastPage}` : sel.page,
        words: countWords(text),
      }),
      text: text.length > SCOPE_TEXT_MAX ? `${text.slice(0, SCOPE_TEXT_MAX)}…` : text,
    }
  }

  // the selection can vanish without the × (click-away, another file): close the preview too
  useEffect(() => {
    if (!hasScopeSelection) setScopePreviewOpen(false)
  }, [hasScopeSelection])

  /** [p.N](pdfnav://page/N) links in replies scroll the reading view to that page */
  const pdfNav = {
    scheme: PDF_NAV_SCHEME,
    onNavigate: (href: string) => {
      const page = parsePdfNavHref(href)
      if (page !== null) apiRef.current.gotoPage(page)
    },
  }

  return (
    <aside
      ref={asideRef}
      className={`copilot${resizing ? ' ai-panel-resizing' : ''}`}
      style={{ width: '100%' }}
      dir={lang === 'ar' || lang === 'he' ? 'rtl' : undefined}
    >
      <div
        className="ai-panel-resizer"
        onPointerDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label={t('ribbonAiAssistant')}
      />
      <header className="ai-panel-header">
        <span className="ai-panel-title">
          <LyceroMark size={22} />
          Lycero
        </span>
        <div className="ai-panel-header-actions">
          <AiPanelSideButton
            lang={lang}
            onMove={(side) => window.pdfApi.setAiPanelPrefs({ side })}
          />
          {chat.length > 0 && (
            <button
              className="ai-header-btn"
              onClick={() => {
                stop()
                loopRef.current?.reset()
                setBusy(false)
                setChat([])
              }}
              data-tip={t('aiNewChat')}
              aria-label={t('aiNewChat')}
            >
              <IconNewChat />
            </button>
          )}
          <button
            className="ai-header-btn ai-panel-collapse"
            onClick={onCollapse}
            data-tip={t('aiCollapsePanel')}
            aria-label={t('aiCollapsePanel')}
          >
            <IconCollapse />
          </button>
        </div>
      </header>

      <div className="ai-chat" ref={chatRef} onScroll={onChatScroll}>
        {chat.length === 0 && (
          <div className="ai-chat-empty">
            <div className="ai-chat-empty-title">{t('aiEmptyTitle')}</div>
            <div className="ai-chat-empty-body">{t('aiEmptyBody')}</div>
            <div className="ai-quick-actions">
              <button
                className="ai-quick-btn"
                onClick={() =>
                  send(t(hasScopeSelection ? 'aiQuickSummarySelPrompt' : 'aiQuickSummaryPrompt'))
                }
              >
                {t('aiQuickSummary')}
              </button>
              <button
                className="ai-quick-btn"
                onClick={() =>
                  send(
                    t(hasScopeSelection ? 'aiQuickKeyPointsSelPrompt' : 'aiQuickKeyPointsPrompt'),
                  )
                }
              >
                {t('aiQuickKeyPoints')}
              </button>
            </div>
          </div>
        )}
        {chat.map((entry, i) => {
          if (entry.role === 'user') {
            return (
              <div key={i} className="ai-msg ai-msg-user">
                {entry.scope && <AiScopeQuote scope={entry.scope} />}
                <span dir="auto">{entry.text}</span>
                {entry.undelivered && (
                  <div className="ai-msg-undelivered">
                    {t('aiUndelivered')}
                    {!busy && (
                      <button
                        className="ai-retry-btn"
                        onClick={() => send(entry.text, entry.scope ?? null)}
                      >
                        {t('aiRetry')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          }
          const hasTools = (entry.tools?.length ?? 0) > 0
          if (!entry.text && !hasTools && !entry.reasoning) return null
          return (
            <div
              key={i}
              className={`ai-msg ai-msg-assistant${entry.isError ? ' ai-msg-error' : ''}`}
            >
              {hasTools && <ToolChipList tools={entry.tools!} />}
              {entry.reasoning && (
                <ThinkingBlock reasoning={entry.reasoning} isThinking={entry.thinkingPhase ?? false} />
              )}
              {entry.text && (
                <div dir="auto">
                  <Markdown text={entry.text} nav={pdfNav} />
                </div>
              )}
            </div>
          )
        })}
        {fileOpConfirm && (
          <div className="ai-confirm-card" role="group" aria-label={t('aiFileOpConfirmTitle')}>
            <div className="ai-confirm-title">{t('aiFileOpConfirmTitle')}</div>
            <div className="ai-confirm-summary">{fileOpConfirm.summary}</div>
            {fileOpConfirm.detail && (
              <div className="ai-confirm-detail">{fileOpConfirm.detail}</div>
            )}
            <div className="ai-confirm-warning">{t('aiFileOpConfirmWarning')}</div>
            <div className="ai-confirm-actions">
              <button
                type="button"
                className="pdf-modal-btn"
                onClick={() => confirmRef.current?.settle(false)}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="pdf-modal-btn primary"
                onClick={() => confirmRef.current?.settle(true)}
              >
                {t('aiFileOpConfirm')}
              </button>
            </div>
          </div>
        )}
        {/* In-progress state: a standalone three-dot row at the end of the stream, kept until done */}
        {busy && <AiTypingIndicator label={typingLabel} />}
      </div>

      <div className="ai-composer">
        <AiComposer
          value={prompt}
          busy={busy}
          header={
            hasScopeSelection && (
              <div className="ai-scope-row">
                <span className="ai-scope-hint">
                  <button
                    className="ai-scope-label"
                    onClick={() => setScopePreviewOpen((v) => !v)}
                    aria-expanded={scopePreviewOpen}
                    data-tip={t('aiScopeSelectionTip')}
                  >
                    {t('aiScopeSelection', {
                      page:
                        scopeSel!.lastPage > scopeSel!.page
                          ? `${scopeSel!.page}-${scopeSel!.lastPage}`
                          : scopeSel!.page,
                      words: countWords(scopeSel!.text),
                    })}
                  </button>
                  <button
                    className="ai-scope-clear"
                    onClick={() => {
                      setScopePreviewOpen(false)
                      onClearSelection?.()
                    }}
                    data-tip={t('aiScopeClearTitle')}
                    aria-label={t('aiScopeClearTitle')}
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden>
                      <path
                        d="M4 4l8 8M12 4l-8 8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </span>
                {scopePreviewOpen && (
                  <div className="ai-scope-preview">
                    {scopeSel!.text.length > 400
                      ? `${scopeSel!.text.slice(0, 400)}…`
                      : scopeSel!.text}
                  </div>
                )}
              </div>
            )
          }
          placeholder={t('aiComposerPlaceholder')}
          hintIdle={t('aiHintIdle')}
          hintBusy={t('aiHintBusy')}
          sendLabel={t('aiSend')}
          stopLabel={t('aiStop')}
          iconOnly
          sendIconEnabled={<img src={sendEnterOn} alt="" aria-hidden />}
          sendIconDisabled={<img src={sendEnterOff} alt="" aria-hidden />}
          stopIcon={<img src={sendStop} alt="" aria-hidden />}
          onChange={setPrompt}
          onSend={() => send(prompt)}
          onStop={stop}
        />
      </div>
    </aside>
  )
}

/** Tool row list (unified with docs/slides/sheets): dot + summary, expandable details when there's output */
/** Step-row status icons (timeline glyphs: 14px in a 20px slot, 1.6 stroke) */
function StepIcon({ status }: { status: 'running' | 'done' | 'error' }) {
  if (status === 'running') {
    return (
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6.5 3.5h11M6.5 20.5h11M8 3.5v3.2c0 2.6 4 4.2 4 5.3 0 1.1 4 2.7 4 5.3v3.2M16 3.5v3.2c0 2.6-4 4.2-4 5.3 0 1.1-4 2.7-4 5.3v3.2" />
      </svg>
    )
  }
  if (status === 'error') {
    return (
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.4 2.4 2.4 4.6-5" />
    </svg>
  )
}

/** Tool activity group: a single quiet summary row
 *  that auto-opens while tools run, auto-collapses into "Worked · N steps" when they finish,
 *  and a manual toggle that always wins. Rows inside are step rows with 1px connectors. */
function ToolChipList({ tools }: { tools: ToolActivity[] }) {
  const { t: tr } = useI18n()
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [userOpen, setUserOpen] = useState<boolean | null>(null)

  const toggle = (j: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(j)) next.delete(j)
      else next.add(j)
      return next
    })
  }

  const open = userOpen ?? false
  const label = tr('aiWorkedSteps', { n: tools.length })

  return (
    <div className="ai-work-group">
      <button
        type="button"
        className={`ai-work-group-summary`}
        aria-expanded={open}
        onClick={() => setUserOpen(!open)}
      >
        <span className="ai-work-group-label">{label}</span>
        <span className={`ai-tool-chip-caret${open ? ' open' : ''}`} aria-hidden>
          ›
        </span>
      </button>
      <div className={`ai-work-group-body${open ? ' open' : ''}`}>
        <div className="ai-work-group-body-inner">
          {tools.map((tool, j) => {
            const hasOutput = !!tool.output
            const isOpen = expanded.has(j)
            const stepStatus = tool.isError ? 'error' : 'done'
            return (
              <div key={j} className="ai-step-row">
                <span className={`ai-step-icon ${stepStatus}`} aria-hidden>
                  <StepIcon status={stepStatus} />
                </span>
                <div className="ai-step-content">
                  {hasOutput ? (
                    <button
                      type="button"
                      className="ai-step-title clickable"
                      data-tip={tool.name}
                      aria-expanded={isOpen}
                      onClick={() => toggle(j)}
                    >
                      {tool.summary}
                    </button>
                  ) : (
                    <span className="ai-step-title" data-tip={tool.name}>
                      {tool.summary}
                    </span>
                  )}
                  {hasOutput && isOpen && (
                    <div className="ai-step-detail">
                      <div className="ai-tool-output">
                        <div className="ai-tool-output-pre">{tool.output}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Svg({ children }: { children: React.ReactNode }): ReactElement {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

function IconNewChat(): ReactElement {
  return (
    <Svg>
      <path
        d="M13.5 7.2v-3A1.7 1.7 0 0 0 11.8 2.5H4.2a1.7 1.7 0 0 0-1.7 1.7v6.1a1.7 1.7 0 0 0 1.7 1.7h1.1v2l2.6-2h1.3"
        strokeLinejoin="round"
      />
      <path d="M12.2 9.4v4M10.2 11.4h4" />
    </Svg>
  )
}

/* Same glyph as the sheets IconCollapse (16×16 viewBox, 1.2/1.3 stroke), rendered at 15px */
function IconCollapse(): ReactElement {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      aria-hidden
    >
      {/* Mirrored: the AI panel docks on the LEFT, so the divider and arrow point left */}
      <rect x="1.5" y="2.5" width="13" height="11" rx="1" />
      <path d="M5.5 2.5v11" />
      <path d="M12.5 8H8.1M9.8 5.9 7.7 8l2.1 2.1" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

/** Lycero brand mark: official coral loop symbol */
export function LyceroMark({ size = 18, className }: { size?: number; className?: string }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M 76 363 L 51 390 L 48 396 L 37 411 L 27 430 L 25 437 L 21 443 L 17 457 L 15 459 L 9 486 L 7 489 L 2 522 L 2 536 L 0 542 L 3 584 L 7 610 L 9 612 L 15 639 L 17 641 L 20 653 L 24 660 L 30 677 L 34 683 L 36 689 L 40 694 L 45 704 L 48 707 L 51 714 L 64 730 L 65 733 L 96 765 L 99 766 L 117 781 L 122 783 L 123 785 L 128 787 L 138 794 L 146 797 L 154 802 L 175 809 L 194 808 L 196 806 L 199 806 L 207 802 L 217 792 L 222 782 L 224 771 L 222 753 L 214 739 L 211 736 L 208 735 L 206 732 L 198 728 L 173 721 L 147 706 L 120 680 L 110 667 L 96 643 L 90 626 L 87 621 L 83 603 L 81 601 L 75 554 L 76 523 L 81 494 L 89 469 L 92 465 L 96 454 L 111 432 L 122 421 L 131 414 L 149 404 L 157 402 L 159 400 L 184 396 L 206 398 L 228 407 L 231 410 L 237 413 L 251 427 L 260 441 L 263 449 L 265 450 L 270 466 L 271 474 L 273 476 L 275 491 L 276 515 L 273 556 L 271 558 L 266 622 L 267 665 L 271 702 L 273 704 L 276 726 L 278 734 L 280 736 L 279 738 L 281 740 L 285 757 L 289 764 L 292 775 L 295 779 L 298 788 L 307 805 L 310 808 L 322 828 L 330 837 L 330 839 L 335 843 L 336 846 L 342 851 L 346 857 L 356 867 L 363 872 L 367 877 L 371 879 L 384 890 L 396 897 L 397 899 L 429 916 L 439 919 L 443 922 L 459 926 L 461 928 L 463 927 L 464 929 L 468 929 L 472 931 L 493 934 L 495 936 L 503 937 L 555 937 L 563 936 L 565 934 L 578 932 L 604 922 L 608 918 L 615 915 L 635 899 L 655 873 L 661 858 L 663 857 L 667 844 L 668 836 L 670 835 L 669 832 L 671 829 L 672 824 L 674 794 L 673 778 L 674 724 L 676 712 L 678 710 L 683 690 L 696 667 L 718 645 L 726 639 L 733 636 L 742 630 L 749 628 L 755 624 L 769 620 L 771 618 L 780 615 L 792 606 L 796 601 L 803 588 L 806 577 L 806 568 L 803 555 L 799 547 L 789 535 L 778 528 L 768 525 L 749 525 L 736 528 L 729 532 L 721 534 L 702 544 L 694 550 L 692 550 L 660 574 L 659 576 L 649 580 L 641 581 L 639 583 L 625 583 L 623 581 L 618 581 L 607 577 L 582 557 L 576 554 L 574 551 L 572 551 L 563 544 L 542 533 L 538 532 L 534 529 L 528 527 L 509 524 L 499 525 L 486 529 L 485 531 L 483 531 L 473 539 L 467 547 L 463 555 L 461 566 L 459 570 L 459 578 L 461 581 L 461 586 L 466 598 L 471 605 L 481 614 L 492 618 L 496 621 L 510 625 L 518 630 L 526 633 L 534 639 L 539 641 L 541 644 L 544 645 L 560 660 L 567 668 L 576 682 L 579 690 L 581 691 L 585 702 L 587 714 L 589 716 L 591 730 L 591 806 L 589 817 L 587 819 L 586 824 L 577 838 L 565 848 L 550 854 L 548 853 L 546 855 L 523 856 L 512 855 L 510 853 L 494 851 L 479 847 L 477 845 L 460 839 L 451 833 L 447 832 L 422 814 L 409 802 L 401 793 L 399 789 L 395 786 L 395 784 L 382 767 L 372 748 L 369 739 L 366 735 L 362 720 L 360 718 L 361 717 L 359 715 L 355 698 L 354 687 L 352 684 L 349 657 L 349 608 L 352 573 L 354 569 L 358 520 L 357 486 L 354 463 L 352 460 L 351 450 L 348 438 L 339 413 L 337 412 L 337 410 L 332 400 L 328 395 L 328 393 L 312 371 L 294 353 L 292 353 L 287 348 L 272 338 L 242 325 L 225 321 L 211 320 L 209 318 L 176 318 L 173 320 L 159 321 L 139 326 L 137 328 L 128 330 L 109 339 L 98 347 L 96 347 L 94 350 L 93 349 Z" />
      <path d="M 523 99 L 518 102 L 504 105 L 491 111 L 488 111 L 477 115 L 473 118 L 466 120 L 460 124 L 436 135 L 404 155 L 393 164 L 391 164 L 353 196 L 345 204 L 331 223 L 327 233 L 326 242 L 324 245 L 324 255 L 326 256 L 326 261 L 328 268 L 331 274 L 336 280 L 348 290 L 355 293 L 362 294 L 365 296 L 383 296 L 386 294 L 396 292 L 407 286 L 438 255 L 455 241 L 464 236 L 477 226 L 486 222 L 491 218 L 504 211 L 513 208 L 526 201 L 529 201 L 536 197 L 549 193 L 561 191 L 563 189 L 599 183 L 609 183 L 614 181 L 651 181 L 655 183 L 674 184 L 703 189 L 704 191 L 723 195 L 728 198 L 729 197 L 731 199 L 744 203 L 750 207 L 761 211 L 789 227 L 803 238 L 809 241 L 813 246 L 816 247 L 847 277 L 862 295 L 863 298 L 873 311 L 873 313 L 876 315 L 879 322 L 886 332 L 887 336 L 900 360 L 903 370 L 906 374 L 910 389 L 913 393 L 917 410 L 920 416 L 919 417 L 921 420 L 926 448 L 928 451 L 933 493 L 933 510 L 935 523 L 935 541 L 933 549 L 932 579 L 928 608 L 926 611 L 920 643 L 918 645 L 915 659 L 913 662 L 913 665 L 910 669 L 909 675 L 900 696 L 882 729 L 880 730 L 878 735 L 863 754 L 862 757 L 857 761 L 856 764 L 840 781 L 826 794 L 819 798 L 817 801 L 814 802 L 798 814 L 793 816 L 792 818 L 790 818 L 781 824 L 766 830 L 762 833 L 745 838 L 740 841 L 725 845 L 720 848 L 709 857 L 701 868 L 697 878 L 696 893 L 698 904 L 705 916 L 710 921 L 723 928 L 725 927 L 727 929 L 733 930 L 749 929 L 754 926 L 770 922 L 774 919 L 790 914 L 794 911 L 799 910 L 808 906 L 811 903 L 821 899 L 854 879 L 884 856 L 915 826 L 929 810 L 930 807 L 934 804 L 938 797 L 950 782 L 954 774 L 957 772 L 957 770 L 964 760 L 982 725 L 984 718 L 988 712 L 988 709 L 992 698 L 994 696 L 999 681 L 1000 674 L 1003 669 L 1007 650 L 1009 648 L 1013 629 L 1015 612 L 1017 610 L 1021 576 L 1023 537 L 1022 483 L 1017 434 L 1015 431 L 1009 394 L 1007 392 L 1002 369 L 1000 367 L 995 347 L 993 346 L 994 345 L 992 343 L 988 329 L 983 320 L 979 308 L 976 305 L 972 294 L 969 291 L 968 287 L 962 278 L 958 269 L 953 263 L 942 245 L 929 229 L 928 226 L 924 223 L 923 220 L 891 187 L 882 179 L 878 177 L 875 173 L 872 172 L 855 158 L 837 147 L 834 144 L 825 140 L 823 137 L 813 133 L 810 130 L 795 124 L 791 121 L 784 118 L 781 118 L 772 113 L 761 110 L 759 108 L 758 109 L 756 107 L 740 103 L 735 100 L 709 95 L 707 93 L 703 94 L 702 92 L 663 87 L 648 87 L 647 85 L 605 85 L 603 87 L 590 87 L 552 92 L 550 94 Z" />
    </svg>
  )
}
