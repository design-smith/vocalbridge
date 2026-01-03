// API Types and Interfaces

export interface APIError {
  message: string
  code?: string
  status?: number
}

export interface Tenant {
  id: string
  name: string
}

export interface Agent {
  id: string
  name: string
  primaryProvider: 'vendorA' | 'vendorB'
  fallbackProvider: 'none' | 'vendorA' | 'vendorB'
  systemPrompt: string
  enabledTools: string[]
  updatedAt: string
  createdAt: string
}

export interface CreateAgentRequest {
  name: string
  primaryProvider: 'vendorA' | 'vendorB'
  fallbackProvider: 'none' | 'vendorA' | 'vendorB'
  systemPrompt: string
  enabledTools: string[]
}

export interface UpdateAgentRequest extends Partial<CreateAgentRequest> {
  name?: string
}

export interface Session {
  id: string
  agentId: string
  customerId: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface CreateSessionRequest {
  agentId: string
  customerId: string
  metadata?: Record<string, unknown>
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  clientMessageId?: string
  createdAt: string
}

export interface SendMessageRequest {
  role: 'user'
  content: string
  clientMessageId?: string
}

export interface MessageResponse extends Message {
  providerUsed?: string
  tokensIn?: number
  tokensOut?: number
  costUsd?: number
  latencyMs?: number
  fallbackUsed?: boolean
}

export interface Transcript {
  sessionId: string
  messages: MessageResponse[]
  createdAt: string
  updatedAt: string
}

export interface UsageRollup {
  from: string
  to: string
  totalSessions: number
  totalTokens: number
  totalCost: number
  providerBreakdown: ProviderBreakdown[]
  topAgents: AgentUsage[]
}

export interface ProviderBreakdown {
  provider: string
  sessions: number
  tokensIn: number
  tokensOut: number
  totalTokens: number
  cost: number
}

export interface AgentUsage {
  agentId: string
  agentName: string
  sessions: number
  tokensTotal: number
  cost: number
}

export interface UsageEvent {
  timestamp: string
  sessionId: string
  agentId: string
  agentName?: string
  provider: string
  tokensIn: number
  tokensOut: number
  cost: number
}

export interface MonthlyUsage {
  month: string // YYYY-MM format
  vendorA: number // cost in USD
  vendorB: number // cost in USD
}

export interface VoiceMessageResponse {
  sessionId: string
  transcriptText: string
  assistant: {
    id: string
    content: string
    createdAt: string
  }
  audio: {
    mimeType: string
    base64: string
    durationMs: number
  }
  metadata: {
    agentId: string
    providerUsed: string
    primaryAttempted: string
    fallbackAttempted: string | null
    fallbackUsed: boolean
    attempts: Array<{
      provider: string
      status: 'success' | 'failed'
      httpStatus: number | null
      latencyMs: number
      retries: number
      errorCode: string | null
    }>
    usage: {
      tokensIn: number
      tokensOut: number
      costUsd: number
      pricing: {
        usdPer1kTokens: number
      }
    }
    idempotency: {
      key: string
      replayed: boolean
    }
    requestId: string
    channel: string
    audioDurationMs?: number
  }
}

export interface APIResponse<T> {
  data?: T
  error?: APIError
}
