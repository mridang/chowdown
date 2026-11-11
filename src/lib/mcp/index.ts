/**
 * @packageDocumentation
 *
 * Public surface of the lib/mcp package.
 */
export {
  ANNOTATION_KEYWORDS,
  CHECKED_KEYWORDS,
  type JsonSchema,
  type JsonType,
  isJsonObject,
  NOT_BLANK,
  PROBLEMS_SHOWN,
  unsupportedKeywords,
  validateJson,
} from './json-schema';
export {
  ERROR_HEADER_MISMATCH,
  ERROR_INTERNAL,
  ERROR_INVALID_PARAMS,
  ERROR_INVALID_REQUEST,
  ERROR_METHOD_NOT_FOUND,
  ERROR_PARSE,
  ERROR_UNSUPPORTED_VERSION,
  LEGACY_VERSIONS,
  MODERN_VERSION,
  type ParsedMessage,
  type ProtocolMessage,
  type ProtocolRefusal,
  type RefusalSpec,
  type ReplyId,
  RpcError,
  SUPPORTED_VERSIONS,
  checkBatch,
  checkRequestHeaders,
  declaredVersion,
  decodeHeaderValue,
  errorBody,
  headerVersion,
  isAllowedOrigin,
  isModernRequest,
  isNotification,
  isPlainObject,
  negotiateLegacyVersion,
  parseAllowedOrigins,
  parseMessage,
  protocolRefusal,
  replyIdOf,
  withoutId,
} from './protocol';
export {
  type CacheHint,
  type JsonRpcErrorBody,
  type JsonRpcMessage,
  type JsonRpcResponse,
  type McpMethod,
  McpServer,
  type McpServerOptions,
} from './server';
export {
  canonicalArguments,
  limitArg,
  numberArg,
  offsetArg,
  stringArg,
  stringListArg,
  textArg,
} from './tool-args';
export {
  BackendFailure,
  InvalidToolArguments,
  UnknownTool,
} from './tool-errors';
