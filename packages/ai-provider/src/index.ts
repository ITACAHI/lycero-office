/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
export type {
  AiCustomCompat,
  AiCustomEndpoint,
  AiCustomModelProfile,
  AiCustomProfile,
  AiCustomProtocol,
  AiChatRequest,
  AiChatResponse,
  AiMediaProviderConfig,
  AiMediaProviderId,
  AiMediaProviderMeta,
  AiMediaSettings,
  AiAnalysisProtocol,
  AiImageProtocol,
  AiSearchProviderId,
  AiSearchProviderMeta,
  AiSearchSettings,
  CodexModelCatalog,
  AiProviderConfig,
  AiProviderId,
  AiProviderMeta,
  AiSettings,
  AiStreamChunk,
  AiStreamRequest,
  AiTokenUsage,
  LyceroAccountStatus,
  LyceroEditorModule,
  LyceroPipelineStage,
  GenSparkAccountStatus,
  LegacyAiSettings,
} from './types'
export {
  AI_PROVIDERS,
  DEFAULT_LYCERO_MODEL_LABELS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  LYCERO_GATEWAY_URL,
  LYCERO_LLM_BASE_URLS,
  GENSPARK_LLM_BASE_URLS,
  lyceroAttributionHeaders,
  lyceroModelLabel,
  gensparkAttributionHeaders,
  MAX_MAX_OUTPUT_TOKENS,
  MIN_MAX_OUTPUT_TOKENS,
  activeProvider,
  clampMaxOutputTokens,
  cloudToolsEnabled,
  defaultAiSettings,
  maxOutputTokensOf,
  resolveAiSettings,
} from './providers'
export {
  activeCustomEndpoint,
  customEndpointLabel,
  newCustomEndpointId,
  removeCustomEndpoint,
  resolveCustomEndpoints,
  selectCustomEndpoint,
  upsertCustomEndpoint,
} from './custom-endpoints'
export {
  AI_CUSTOM_PROTOCOLS,
  declaredModelProfile,
  normalizeCustomProfile,
  resolveCustomProfile,
} from './custom-profile'
export type { ResolvedCustomProfile } from './custom-profile'
export { resolveProfileCredential } from './credential-env'
export type { EnvLookup } from './credential-env'
export {
  AI_MEDIA_PROVIDERS,
  GEMINI_MEDIA_BASE_URL,
  OPENAI_IMAGES_BASE_URL,
  activeMediaConfig,
  activeMediaProvider,
  buildLyceroImageArtDirectorPayload,
  defaultAiMediaSettings,
  getMediaProviderMeta,
  imageGenerationAvailable,
  mediaAnalysisAvailable,
  mediaConfigUsable,
  providerHasCapability,
  resolveAiMediaSettings,
  videoAnalysisAvailable,
} from './media'
export type {
  LyceroImageArtDirectorPayload,
  LyceroImageContextType,
  MediaCapability,
} from './media'
export {
  AI_SEARCH_PROVIDERS,
  activeSearchProvider,
  defaultAiSearchSettings,
  resolveAiSearchSettings,
} from './search-settings'
export {
  analyzeMediaWithProvider,
  generateImageWithProvider,
  sniffImageMime,
  testMediaProvider,
} from './media-protocols'
export type {
  AnalyzeMediaInput,
  ByokMediaProviderId,
  GenerateImageInput,
  MediaBlob,
} from './media-protocols'
export {
  AI_PROVIDER_ADAPTERS,
  getProviderAdapter,
  modelLacksVision,
  normalizeBaseUrl,
} from './registry'
export type {
  AiProtocol,
  ProviderAdapter,
  ProviderCapabilities,
  ResolvedEndpoint,
} from './registry'
export { sanitizeAiSettings, sanitizeCliPath, validCliPath } from './ai-settings-guard'
export { chatForProvider } from './chat'
export { setAiUserAgent, setRescueFetch } from './fetch'
export { isAiNetworkError } from './network-error'
export { isAiOverloadedError } from './overload-error'
export { isAiRegionBlockedError } from './region-error'
export { parseOutputCapRejection } from './output-cap'
export {
  AiCreditsError,
  MAX_STREAM_RECONNECT_ATTEMPTS,
  sseLines,
  streamForProvider,
} from './stream'
export type { StreamCallbacks } from './stream'
export {
  AI_CHAT_RESPONSE_TIMEOUT_MS,
  AI_CONNECT_TIMEOUT_MS,
  AI_IDLE_TIMEOUT_MS,
  AiTimeoutError,
  createStreamWatchdog,
} from './watchdog'
export type { StreamWatchdog } from './watchdog'

export { AiQuotaExhaustedError, isAiQuotaExhaustedError } from './quota-error'
export { PiiTokenizer } from './pii-tokenizer'
export type { PiiTokenizeResult } from './pii-tokenizer'
export { MAX_HUB_RECONNECT_ATTEMPTS, streamHubChat } from './protocols/hub-lycero'
export type { StreamHubChatParams } from './protocols/hub-lycero'
export { fetchRemoteModels } from './fetch-models'
export {
  applyRemoteTokenOptimizerPolicy,
  compactOutboundAgentTurn,
  getClientTokenOptimizerPolicy,
  resetClientTokenOptimizerPolicy,
} from './token-compactor'
export type {
  ClientCompactionTelemetry,
  ClientTokenOptimizerPolicy,
} from './token-compactor'
