/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
export type {
  AgentImage,
  AgentMessage,
  AgentPhase,
  AgentPhaseKind,
  AgentStreamCallbacks,
  AgentStreamHandle,
  AgentStreamRequest,
  AgentTokenUsage,
  AgentToolCall,
  AgentToolDef,
  AgentToolResult,
  AgentTransport,
  MindMapTreeNode,
  ToolDisplay,
  ToolExecution,
} from './types'
export { composeSkills } from './skill'
export type { AgentSkill, ExecutedToolCall } from './skill'
export { withAttachedSkills, type AttachedSkill } from './attached-skills'
export { createKnowledgeBaseSkill, formatKbSize } from './knowledge-base-skill'
export type { KnowledgeBaseDeps, KbFileInfo, KbSearchHit, KbReadPage } from './knowledge-base-skill'
export {
  createAttachmentsSkill,
  ATTACHMENT_IMAGE_EXTS,
  ATTACHMENT_READ_CHUNK_CHARS,
  READ_ATTACHMENT_TOOL,
} from './attachments-skill'
export type { AttachmentInfo, AttachmentPage, AttachmentsSkillDeps } from './attachments-skill'
export {
  createDocumentSkill,
  CREATE_DOCUMENT_MAX_CHARS,
  CREATE_DOCUMENT_TOOL,
} from './create-document-skill'
export type {
  CreateDocumentDeps,
  CreateDocumentFormat,
  CreateDocumentRequest,
  CreateDocumentSkill,
} from './create-document-skill'
export { createCliSkill, GUIDE_DOMAINS, LOAD_GUIDE_TOOL, RUN_GENOFFICE_TOOL } from './cli-skill'
export type {
  CliContext,
  CliRunRequest,
  CliRunResult,
  CliSkill,
  CliSkillDeps,
  CliStagedFile,
  GuideDomain,
} from './cli-skill'
export type { SkillFrontmatter, SkillRelevance } from './imported-skill'
export { classifySkill, parseSkillFrontmatter, SKILL_FORMAT_TOKENS } from './imported-skill'
export {
  AgentLoop,
  COMPLETED_VIA_TOOLS_TEXT,
  DEFAULT_MAX_TURNS,
  TOOL_ABORTED_OUTPUT,
  coerceArgumentFields,
  invalidArgumentFields,
  missingRequiredFields,
  runtimePreamble,
  sanitizeAgentPayload,
  applyComposedContext,
  buildBundleContextResolver,
} from './loop'
export type {
  AgentLoopEvents,
  AgentLoopOptions,
  AgentRunResult,
  CompactionOptions,
  ToolExecutedEvent,
  AgentTurnInput,
  ApplyResult,
  BundleContextResolver,
} from './loop'
export { createIpcTransport, IPC_STREAM_SILENCE_TIMEOUT_MS } from './electron-transport'
export { streamText } from './stream-text'
export type { StreamTextOptions, StreamTextOutcome } from './stream-text'
export type { IpcStreamChunk, IpcStreamStart, IpcTransportOptions } from './electron-transport'
// graph-memory types (used by @lycero/ui)
export type {
  ActionCardData,
  BloomLevel,
  CurriculumStandard,
  DocumentChangelogEntry,
  DocumentMiniGraph,
  MiniGraphEdge,
  MiniGraphEdgeRelation,
  MiniGraphNode,
  MiniGraphNodeType,
  PedagogicalDocumentMemory,
  PedagogicalPersona,
  WorkingMode,
} from './graph-memory/types'
export {
  BLOOM_LABELS,
  CURRICULUM_LABELS,
  PERSONA_LABELS,
  getBloomCoverage,
  recordPedagogicalAction,
} from './graph-memory/pedagogical-graph-engine'

// Cloud Capabilities & Reverse Proxy Tool Dispatcher
export {
  CloudCapabilitiesManager,
  DEFAULT_CAPABILITIES_GATEWAY_URL,
  OFFLINE_CAPABILITIES_MESSAGE,
  getFieldKey,
} from './cloud-capabilities'
export type {
  CapabilitiesStorage,
  CloudCapabilitiesResponse,
  CloudCapabilitiesSyncResult,
  CloudMcpEndpoint,
  CloudSkillManifest,
  SkillConfigFieldSchema,
} from './cloud-capabilities'

export {
  CloudToolDispatcher,
  DEFAULT_TOOL_DISPATCHER_URL,
  LOCAL_EDITOR_TOOL_NAMES,
  createCloudProxySkill,
} from './cloud-tool-dispatcher'
export type {
  CloudToolDispatcherOptions,
  CloudToolExecuteRequest,
  CloudToolExecuteResponse,
} from './cloud-tool-dispatcher'

export {
  AiGatewayService,
  DEFAULT_CHAT_GATEWAY_URL,
  DEFAULT_LYCERO_GATEWAY_URL,
  defaultAiGatewayService,
} from './ai-gateway'
export type {
  AiChatChunk,
  AiChatMessage,
  AiChatStreamController,
  AiChatStreamPayload,
  AiGatewayOptions,
} from './ai-gateway'

// Work Bundle Composer (Phase A.3)
export {
  composeBundleTools,
  composeBundleSkills,
  buildSystemPromptAddition,
  composeAgentContext,
} from './composer'
export type {
  ComposedTool,
  ComposedSkill,
  ComposedAgentContext,
} from './composer'

// Range Redaction
export * from './redact-range'
