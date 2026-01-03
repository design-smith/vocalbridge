import { apiRequest } from './client'
import type {
  Tenant,
  Agent,
  CreateAgentRequest,
  UpdateAgentRequest,
  Session,
  CreateSessionRequest,
  MessageResponse,
  SendMessageRequest,
  Transcript,
  UsageRollup,
  UsageEvent,
  MonthlyUsage,
  VoiceMessageResponse,
  APIError,
} from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// GET /v1/me - Get current tenant info
export async function getMe(): Promise<{ data?: { tenant: Tenant }; error?: unknown }> {
  // Backend response structure includes tenant + pricing
  interface BackendMeResponse {
    tenant: Tenant
    pricing: unknown
  }

  const response = await apiRequest<BackendMeResponse>('/v1/me')

  // Return the whole response (frontend expects { tenant: Tenant })
  return response
}

// GET /v1/agents - List all agents
export async function getAgents(): Promise<{ data?: Agent[]; error?: unknown }> {
  // Backend response structure
  interface BackendAgentsResponse {
    agents: Agent[]
  }

  const response = await apiRequest<BackendAgentsResponse>('/v1/agents')

  // Transform backend response to frontend Agent[] format
  if (response.data) {
    return { data: response.data.agents }
  }

  return response
}

// POST /v1/agents - Create a new agent
export async function createAgent(
  agent: CreateAgentRequest
): Promise<{ data?: Agent; error?: unknown }> {
  // Backend response structure
  interface BackendAgentResponse {
    agent: Agent
  }

  const response = await apiRequest<BackendAgentResponse>('/v1/agents', {
    method: 'POST',
    body: agent,
  })

  // Transform backend response to frontend Agent format
  if (response.data) {
    return { data: response.data.agent }
  }

  return response
}

// PUT /v1/agents/:agentId - Update an agent
export async function updateAgent(
  agentId: string,
  agent: UpdateAgentRequest
): Promise<{ data?: Agent; error?: unknown }> {
  // Backend response structure
  interface BackendAgentResponse {
    agent: Agent
  }

  const response = await apiRequest<BackendAgentResponse>(`/v1/agents/${agentId}`, {
    method: 'PUT',
    body: agent,
  })

  // Transform backend response to frontend Agent format
  if (response.data) {
    return { data: response.data.agent }
  }

  return response
}

// POST /v1/sessions - Create a new session
export async function createSession(
  session: CreateSessionRequest
): Promise<{ data?: Session; error?: unknown }> {
  // Backend response structure
  interface BackendSessionResponse {
    session: Session
  }

  const response = await apiRequest<BackendSessionResponse>('/v1/sessions', {
    method: 'POST',
    body: session,
  })

  // Transform backend response to frontend Session format
  if (response.data) {
    return { data: response.data.session }
  }

  return response
}

// POST /v1/sessions/:sessionId/messages - Send a message
export async function sendMessage(
  sessionId: string,
  message: SendMessageRequest,
  idempotencyKey?: string
): Promise<{ data?: MessageResponse; error?: unknown }> {
  // Backend response structure
  interface BackendSendMessageResponse {
    message: {
      id: string
      sessionId: string
      role: string
      content: string
      createdAt: string
    }
    metadata: {
      providerUsed: string
      fallbackUsed: boolean
      usage: {
        tokensIn: number
        tokensOut: number
        costUsd: number
      }
      attempts: Array<{
        latencyMs: number
      }>
    }
  }

  const response = await apiRequest<BackendSendMessageResponse>(
    `/v1/sessions/${sessionId}/messages`,
    {
      method: 'POST',
      body: message,
      idempotencyKey,
    }
  )

  // Transform backend response to frontend MessageResponse format
  if (response.data) {
    const backendData = response.data
    const transformedData: MessageResponse = {
      id: backendData.message.id,
      role: backendData.message.role as 'user' | 'assistant',
      content: backendData.message.content,
      createdAt: backendData.message.createdAt,
      providerUsed: backendData.metadata.providerUsed,
      tokensIn: backendData.metadata.usage.tokensIn,
      tokensOut: backendData.metadata.usage.tokensOut,
      costUsd: backendData.metadata.usage.costUsd,
      latencyMs: backendData.metadata.attempts[backendData.metadata.attempts.length - 1]?.latencyMs || 0,
      fallbackUsed: backendData.metadata.fallbackUsed,
    }

    return { data: transformedData }
  }

  return response
}

// GET /v1/sessions/:sessionId/transcript - Get session transcript
export async function getTranscript(
  sessionId: string
): Promise<{ data?: Transcript; error?: unknown }> {
  // Backend response structure
  interface BackendTranscriptResponse {
    session: {
      id: string
      agentId: string
      customerId: string
      status: string
      createdAt: string
      lastActivityAt: string
      metadata: Record<string, unknown>
    }
    messages: Array<{
      id: string
      role: string
      content: string
      createdAt: string
    }>
    events: Array<{
      id: string
      type: string
      provider: string
      status: string
      latencyMs: number | null
      createdAt: string
    }>
  }

  const response = await apiRequest<BackendTranscriptResponse>(
    `/v1/sessions/${sessionId}/transcript`
  )

  // Transform backend response to frontend Transcript format
  if (response.data) {
    const backendData = response.data
    const transformedData: Transcript = {
      sessionId: backendData.session.id,
      messages: backendData.messages.map((msg) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        createdAt: msg.createdAt,
      })),
      createdAt: backendData.session.createdAt,
      updatedAt: backendData.session.lastActivityAt,
    }

    return { data: transformedData }
  }

  return response
}

// GET /v1/usage/rollup - Get usage rollup data
export async function getUsageRollup(
  from: string,
  to: string
): Promise<{ data?: UsageRollup; error?: unknown }> {
  // Backend response structure
  interface BackendUsageRollupResponse {
    range: {
      from: string
      to: string
    }
    totals: {
      sessions: number
      messages: number
      tokensIn: number
      tokensOut: number
      tokensTotal: number
      costUsd: number
    }
    byProvider: Array<{
      provider: string
      sessions: number
      tokensIn: number
      tokensOut: number
      tokensTotal: number
      costUsd: number
    }>
    topAgentsByCost: Array<{
      agentId: string
      agentName: string
      sessions: number
      tokensTotal: number
      costUsd: number
    }>
  }

  const params = new URLSearchParams({ from, to })
  const response = await apiRequest<BackendUsageRollupResponse>(
    `/v1/usage/rollup?${params.toString()}`
  )

  // Transform backend response to frontend UsageRollup format
  if (response.data) {
    const backendData = response.data
    const transformedData: UsageRollup = {
      from: backendData.range.from,
      to: backendData.range.to,
      totalSessions: backendData.totals.sessions,
      totalTokens: backendData.totals.tokensTotal,
      totalCost: backendData.totals.costUsd,
      providerBreakdown: backendData.byProvider.map((provider) => ({
        provider: provider.provider,
        sessions: provider.sessions,
        tokensIn: provider.tokensIn,
        tokensOut: provider.tokensOut,
        totalTokens: provider.tokensTotal,
        cost: provider.costUsd,
      })),
      topAgents: backendData.topAgentsByCost.map((agent) => ({
        agentId: agent.agentId,
        agentName: agent.agentName,
        sessions: agent.sessions,
        tokensTotal: agent.tokensTotal,
        cost: agent.costUsd,
      })),
    }

    return { data: transformedData }
  }

  return response
}

// GET /v1/usage/events - Get usage events
export async function getUsageEvents(
  from: string,
  to: string,
  limit: number = 200
): Promise<{ data?: UsageEvent[]; error?: unknown }> {
  // Backend response structure
  interface BackendUsageEventsResponse {
    events: Array<{
      id: string
      sessionId: string
      agentId: string
      provider: string
      tokensIn: number
      tokensOut: number
      costUsd: number
      createdAt: string
      requestId: string
    }>
    count: number
    limit: number
  }

  const params = new URLSearchParams({
    from,
    to,
    limit: limit.toString(),
  })

  const response = await apiRequest<BackendUsageEventsResponse>(
    `/v1/usage/events?${params.toString()}`
  )

  // Transform backend response to frontend UsageEvent[] format
  if (response.data) {
    const backendData = response.data
    const transformedData: UsageEvent[] = backendData.events.map((event) => ({
      timestamp: event.createdAt,
      sessionId: event.sessionId,
      agentId: event.agentId,
      provider: event.provider,
      tokensIn: event.tokensIn,
      tokensOut: event.tokensOut,
      cost: event.costUsd,
    }))

    return { data: transformedData }
  }

  return response
}

// GET /v1/usage/monthly - Get monthly usage data for last 12 months
export async function getMonthlyUsage(): Promise<{ data?: MonthlyUsage[]; error?: unknown }> {
  // Backend response structure
  interface BackendMonthlyUsageResponse {
    monthly: MonthlyUsage[]
  }

  const response = await apiRequest<BackendMonthlyUsageResponse>('/v1/usage/monthly')

  // Transform backend response to frontend MonthlyUsage[] format
  if (response.data) {
    return { data: response.data.monthly }
  }

  return response
}

/**
 * Generate a unique idempotency key for voice messages
 */
function generateIdempotencyKey(): string {
  return `voice_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

// POST /v1/sessions/:sessionId/voice - Send voice message
export async function sendVoiceMessage(
  sessionId: string,
  audioBlob: Blob,
  audioDurationMs?: number
): Promise<{ data?: VoiceMessageResponse; error?: unknown }> {
  // Get API key from localStorage
  const apiKey = localStorage.getItem('apiKey')
  if (!apiKey) {
    return {
      error: {
        message: 'API key not found. Please log in.',
        code: 'NO_API_KEY',
      },
    }
  }

  // Generate idempotency key for this voice message
  const idempotencyKey = generateIdempotencyKey()

  // Create FormData for multipart upload
  const formData = new FormData()
  formData.append('audio', audioBlob, 'voice-message.webm')
  if (audioDurationMs) {
    formData.append('audioDurationMs', audioDurationMs.toString())
  }

  try {
    const response = await fetch(`${API_BASE_URL}/v1/sessions/${sessionId}/voice`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Idempotency-Key': idempotencyKey,
        // Note: Don't set Content-Type for FormData - browser will set it with boundary
      },
      body: formData,
    })

    // Parse JSON response
    let data: VoiceMessageResponse | { error: APIError }
    try {
      data = await response.json()
    } catch (parseError) {
      return {
        error: {
          message: response.statusText || 'Invalid response format',
          code: 'INVALID_RESPONSE',
          status: response.status,
        },
      }
    }

    // Handle error responses
    if (!response.ok) {
      // Handle 401 Unauthorized
      if (response.status === 401) {
        localStorage.removeItem('apiKey')
        localStorage.removeItem('tenant')
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }

      const errorData = data as { error: APIError }
      const error: APIError = {
        message: errorData.error?.message || response.statusText || 'Voice message failed',
        code: errorData.error?.code || `HTTP_${response.status}`,
        status: response.status,
      }
      return { error }
    }

    // Success response
    return { data: data as VoiceMessageResponse }
  } catch (error) {
    // Network or other errors
    const apiError: APIError = {
      message: error instanceof Error ? error.message : 'Network error occurred',
      code: 'NETWORK_ERROR',
    }
    return { error: apiError }
  }
}
