import { v4 as uuidv4 } from 'uuid';

/**
 * ID Prefixes for different entity types
 * Makes IDs self-documenting and easier to debug
 */
export const ID_PREFIXES = {
  TENANT: 'tnt_',
  AGENT: 'agt_',
  SESSION: 'ses_',
  MESSAGE: 'msg_',
  EVENT: 'evt_',
  REQUEST: 'req_',
  IDEMPOTENCY: 'idem_',
  API_KEY: 'key_',
} as const;

/**
 * Generate a unique ID with a specific prefix
 */
function generateId(prefix: string): string {
  const uuid = uuidv4().replace(/-/g, '');
  return `${prefix}${uuid}`;
}

/**
 * Generate a tenant ID
 */
export function generateTenantId(): string {
  return generateId(ID_PREFIXES.TENANT);
}

/**
 * Generate an agent ID
 */
export function generateAgentId(): string {
  return generateId(ID_PREFIXES.AGENT);
}

/**
 * Generate a session ID
 */
export function generateSessionId(): string {
  return generateId(ID_PREFIXES.SESSION);
}

/**
 * Generate a message ID
 */
export function generateMessageId(): string {
  return generateId(ID_PREFIXES.MESSAGE);
}

/**
 * Generate an event ID (for ProviderCallEvent, UsageEvent)
 */
export function generateEventId(): string {
  return generateId(ID_PREFIXES.EVENT);
}

/**
 * Generate a request ID (for tracking requests through the system)
 */
export function generateRequestId(): string {
  return generateId(ID_PREFIXES.REQUEST);
}

/**
 * Generate an idempotency record ID
 */
export function generateIdempotencyId(): string {
  return generateId(ID_PREFIXES.IDEMPOTENCY);
}

/**
 * Generate an API key ID
 */
export function generateApiKeyId(): string {
  return generateId(ID_PREFIXES.API_KEY);
}
