# Architecture Documentation

## Table of Contents
1. [High-Level Design (HLD)](#high-level-design-hld)
2. [Low-Level Design (LLD)](#low-level-design-lld)
3. [Module List](#module-list)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Idempotency Flow](#idempotency-flow)

---

## High-Level Design (HLD)

### System Overview

VocalBridge Ops is a **multi-tenant AI agent gateway** that sits between client applications and multiple LLM providers. It provides reliability, observability, and cost management for AI-powered conversational experiences.

```
┌─────────────┐
│   Clients   │
│  (Frontend) │
└──────┬──────┘
       │ HTTPS + API Key
       │
┌──────▼───────────────────────────────────────────────────┐
│             VocalBridge Ops Gateway                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Auth      │  │   Sessions   │  │   Usage      │    │
│  │ Middleware  │  │   & Agents   │  │   Tracking   │    │
│  └─────────────┘  └──────────────┘  └──────────────┘    │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │         Reliability Layer                          │  │
│  │  - Retry with exponential backoff                 │  │
│  │  - Automatic fallback to secondary provider       │  │
│  │  - Circuit breaker (planned)                      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │         Provider Adapters                          │  │
│  │  - Vendor A (mock)     - Vendor B (mock)          │  │
│  │  - Normalize responses  - Calculate costs         │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
       │                          │
       ▼                          ▼
┌──────────────┐          ┌──────────────┐
│   Vendor A   │          │   Vendor B   │
│     API      │          │     API      │
│   (Mocked)   │          │   (Mocked)   │
└──────────────┘          └──────────────┘
```

### Core Components

#### 1. Authentication & Multi-Tenancy
- **API Key-based auth**: Each tenant has one or more API keys (hashed in DB)
- **Tenant isolation**: All data (agents, sessions, messages, usage) is scoped to tenantId
- **Middleware enforcement**: `authTenant` middleware validates API key on every request
- **Request context**: Tenant info attached to request object for downstream use

#### 2. Agent Management
- **Agents**: Configurable AI assistants with custom system prompts and tool access
- **Provider selection**: Each agent specifies primary + optional fallback provider
- **Configuration**: System prompt, enabled tools, provider preferences stored per-tenant
- **CRUD operations**: Create, read, update agents via REST API

#### 3. Session & Message Management
- **Sessions**: Conversation containers linking agent + customer
- **Messages**: User and assistant messages stored in session context
- **Metadata**: Custom metadata (e.g., channel, source) attached to sessions
- **Transcript**: Full conversation history retrievable per session

#### 4. Reliability (Retry, Fallback, Backoff)
- **Retry logic**: Up to 3 attempts per provider with exponential backoff (base: 1s, max: 10s)
- **Fallback**: If primary provider fails after retries, automatically try fallback provider
- **Attempt tracking**: Each attempt logged with provider, status, HTTP code, latency, retries
- **Error handling**: Graceful degradation with detailed error messages

#### 5. Usage Tracking & Billing
- **Per-message tracking**: Every message call creates a `UsageEvent` with:
  - Tokens (in/out)
  - Cost (calculated from pricing table)
  - Provider used
  - Timestamp
- **Rollup analytics**: Aggregate usage by date range, provider, agent
- **Monthly trends**: Pre-aggregated monthly cost data for charting
- **Idempotency protection**: Prevents duplicate billing on retried requests

### How Tenants Are Isolated

1. **Database level**: All tables have `tenantId` foreign key with ON DELETE CASCADE
2. **API level**: Middleware extracts tenantId from API key and attaches to request
3. **Query level**: All repository queries filter by `WHERE tenantId = ?`
4. **Validation**: Cannot access or modify resources belonging to other tenants

### How Agents, Sessions, and Messages Relate

```
Tenant (1) ─────────> (N) Agent
                            │
                            │ (1)
                            │
                            ▼
                        (N) Session ─────────> (N) Message
                            │
                            │ (1)
                            │
                            ▼
                        (N) UsageEvent
```

- **Tenant** owns multiple **Agents**
- **Agent** used in multiple **Sessions** (one agent per session)
- **Session** contains multiple **Messages** (conversation history)
- **Session** generates multiple **UsageEvents** (one per message sent)

### How Reliability Works

#### Timeout Strategy
- **Connection timeout**: 30 seconds (prevent hanging connections)
- **Request timeout**: 60 seconds (allow slow LLM responses)
- **Retry window**: 3 attempts × 60s = up to 3 minutes max per provider

#### Retry Logic
```typescript
attempt 1: immediate
attempt 2: wait 1s (exponential backoff: 2^0 = 1s)
attempt 3: wait 2s (exponential backoff: 2^1 = 2s)
→ If all fail, try fallback provider (if configured)
```

#### Fallback Flow
1. Try primary provider (up to 3 attempts)
2. If all attempts fail → try fallback provider (up to 3 attempts)
3. If fallback also fails → return error to client
4. Track which provider succeeded in metadata

#### Circuit Breaker (Planned)
- After N consecutive failures to a provider, temporarily disable it
- Prevents cascading failures and wasted retry attempts

### How Usage & Billing Are Computed

#### Cost Calculation
```typescript
totalTokens = tokensIn + tokensOut
cost = (totalTokens / 1000) * provider.usdPer1kTokens

// Example:
vendorA: $0.002 per 1K tokens
vendorB: $0.003 per 1K tokens

Message with 500 in + 500 out = 1000 total tokens
vendorA cost: (1000 / 1000) * 0.002 = $0.002
vendorB cost: (1000 / 1000) * 0.003 = $0.003
```

#### Event Creation
Every successful message call creates a `UsageEvent`:
```typescript
{
  tenantId: 'tnt_xxx',
  sessionId: 'ses_xxx',
  agentId: 'agt_xxx',
  provider: 'vendorA',
  tokensIn: 500,
  tokensOut: 500,
  tokensTotal: 1000,
  costUsd: 0.002,
  createdAt: timestamp
}
```

#### Idempotency Protection
- Same `Idempotency-Key` → returns cached response without creating new UsageEvent
- Prevents double-billing on retried requests
- Idempotency records stored for 24 hours

---

## Low-Level Design (LLD)

### Database Schema Overview

#### Tenants & Authentication
```sql
TABLE Tenant {
  id: String (PK)          -- tnt_xxxxxxxxxxxxx
  name: String             -- "Acme Corporation"
  createdAt: DateTime
}

TABLE ApiKey {
  id: String (PK)          -- key_xxxxxxxxxxxxx
  tenantId: String (FK)    -- References Tenant.id
  keyHash: String          -- SHA-256 hash of API key
  createdAt: DateTime
}
```

#### Agents
```sql
TABLE Agent {
  id: String (PK)           -- agt_xxxxxxxxxxxxx
  tenantId: String (FK)     -- References Tenant.id
  name: String              -- "Customer Support Agent"
  primaryProvider: String   -- "vendorA" | "vendorB"
  fallbackProvider: String? -- "vendorA" | "vendorB" | null
  systemPrompt: String      -- Custom instructions
  enabledToolsJson: String  -- JSON array: ["Tool1", "Tool2"]
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### Sessions & Messages
```sql
TABLE Session {
  id: String (PK)           -- ses_xxxxxxxxxxxxx
  tenantId: String (FK)     -- References Tenant.id
  agentId: String (FK)      -- References Agent.id
  customerId: String        -- "customer_123"
  metadataJson: String?     -- JSON: {"channel": "chat"}
  createdAt: DateTime
}

TABLE Message {
  id: String (PK)           -- msg_xxxxxxxxxxxxx
  sessionId: String (FK)    -- References Session.id
  tenantId: String (FK)     -- References Tenant.id
  role: String              -- "user" | "assistant"
  content: String           -- Message text
  clientMessageId: String?  -- Optional client-provided ID
  createdAt: DateTime
}
```

#### Usage & Billing
```sql
TABLE UsageEvent {
  id: String (PK)            -- evt_xxxxxxxxxxxxx
  tenantId: String (FK)      -- References Tenant.id
  sessionId: String (FK)     -- References Session.id
  agentId: String (FK)       -- References Agent.id
  provider: String           -- "vendorA" | "vendorB"
  tokensIn: Int              -- Input tokens
  tokensOut: Int             -- Output tokens
  tokensTotal: Int           -- tokensIn + tokensOut
  costUsd: Decimal           -- Calculated cost
  createdAt: DateTime        -- Billing timestamp
}

INDEX idx_usage_tenant_created ON UsageEvent(tenantId, createdAt)
```

#### Idempotency
```sql
TABLE IdempotencyRecord {
  id: String (PK)            -- Generated UUID
  tenantId: String (FK)      -- References Tenant.id
  idempotencyKey: String     -- Client-provided unique key
  sessionId: String          -- Session context
  requestPath: String        -- "/v1/sessions/:id/messages"
  responseJson: String       -- Cached response body
  statusCode: Int            -- HTTP status code (200, 400, etc.)
  createdAt: DateTime        -- First request timestamp
  expiresAt: DateTime        -- Auto-delete after 24h
}

UNIQUE INDEX idx_idempotency_key ON IdempotencyRecord(tenantId, idempotencyKey)
```

### Provider Adapter Interface

All provider adapters implement this interface:

```typescript
interface ProviderAdapter {
  /**
   * Send a chat completion request
   * @returns Normalized response with tokens, content, metadata
   * @throws ProviderError on failure
   */
  sendMessage(params: SendMessageParams): Promise<ProviderResponse>
}

interface SendMessageParams {
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens?: number
  temperature?: number
}

interface ProviderResponse {
  content: string           // Assistant response text
  tokensIn: number          // Input tokens consumed
  tokensOut: number         // Output tokens generated
  finishReason: string      // "stop" | "length" | "error"
  model: string             // Model used (e.g., "gpt-4")
  rawResponse?: unknown     // Original provider response
}
```

### Retry/Backoff Logic

```typescript
async function sendWithRetry(
  provider: ProviderAdapter,
  params: SendMessageParams,
  maxAttempts: number = 3
): Promise<AttemptResult> {
  let lastError: Error | null = null
  const attempts: AttemptLog[] = []

  for (let i = 0; i < maxAttempts; i++) {
    const attemptStartTime = Date.now()

    try {
      const response = await provider.sendMessage(params)
      const latency = Date.now() - attemptStartTime

      attempts.push({
        provider: provider.name,
        attempt: i + 1,
        status: 'success',
        latencyMs: latency,
      })

      return { response, attempts, success: true }
    } catch (error) {
      lastError = error
      const latency = Date.now() - attemptStartTime

      attempts.push({
        provider: provider.name,
        attempt: i + 1,
        status: 'failed',
        latencyMs: latency,
        errorCode: error.code,
      })

      // Don't retry on non-retryable errors (4xx)
      if (isNonRetryableError(error)) {
        break
      }

      // Exponential backoff: 2^attempt seconds (1s, 2s, 4s, ...)
      if (i < maxAttempts - 1) {
        const backoffMs = Math.min(
          Math.pow(2, i) * 1000, // Exponential
          10000                   // Max 10s
        )
        await sleep(backoffMs)
      }
    }
  }

  return { error: lastError, attempts, success: false }
}
```

### Fallback Logic

```typescript
async function sendMessageWithFallback(
  primaryProvider: ProviderAdapter,
  fallbackProvider: ProviderAdapter | null,
  params: SendMessageParams
): Promise<MessageResult> {
  // Try primary provider
  const primaryResult = await sendWithRetry(primaryProvider, params)

  if (primaryResult.success) {
    return {
      response: primaryResult.response,
      metadata: {
        primaryAttempted: primaryProvider.name,
        fallbackAttempted: null,
        fallbackUsed: false,
        providerUsed: primaryProvider.name,
        attempts: primaryResult.attempts,
      },
    }
  }

  // If primary failed and fallback exists, try fallback
  if (fallbackProvider) {
    const fallbackResult = await sendWithRetry(fallbackProvider, params)

    if (fallbackResult.success) {
      return {
        response: fallbackResult.response,
        metadata: {
          primaryAttempted: primaryProvider.name,
          fallbackAttempted: fallbackProvider.name,
          fallbackUsed: true,
          providerUsed: fallbackProvider.name,
          attempts: [
            ...primaryResult.attempts,
            ...fallbackResult.attempts,
          ],
        },
      }
    }

    // Both failed
    throw new Error('Both primary and fallback providers failed')
  }

  // Primary failed, no fallback
  throw new Error('Primary provider failed and no fallback configured')
}
```

### Error Handling Strategy

#### Error Types
1. **ValidationError** (400): Bad request data (missing fields, invalid format)
2. **AuthenticationError** (401): Invalid or missing API key
3. **NotFoundError** (404): Resource not found (agent, session, etc.)
4. **ProviderError** (500/502/503): LLM provider failure
5. **InternalError** (500): Unexpected server error

#### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Agent name is required",
    "details": { "field": "name" },
    "requestId": "req_xxxxxxxxxxxxx"
  }
}
```

#### Global Error Handler
```typescript
fastify.setErrorHandler((error, request, reply) => {
  const appError = isAppError(error)
    ? error
    : toAppError(error, request.requestId)

  // Log error
  request.log.error({
    error: {
      code: appError.code,
      message: appError.message,
      statusCode: appError.statusCode,
    },
    requestId: request.requestId,
  })

  // Send sanitized error (no stack traces)
  reply.code(appError.statusCode).send(appError.toJSON())
})
```

---

## Module List

### Backend Modules

#### API Layer (`src/api/routes/`)
- **`me.ts`**: GET /v1/me - Tenant info
- **`agents.ts`**: CRUD operations for agents
- **`sessions.ts`**: Create sessions, get transcripts
- **`messages.ts`**: Send messages, retrieve history
- **`usage.ts`**: Usage rollups, events, monthly data

#### Billing (`src/billing/`)
- **`pricing.ts`**: Pricing table, cost calculation logic

#### Voice Channel (`src/channels/voice/`)
- **`voiceRoutes.ts`**: POST /v1/sessions/:id/voice endpoint
- **`VoiceService.ts`**: Orchestrates STT → message → TTS flow
- **`mockStt.ts`**: Mock speech-to-text (deterministic)
- **`mockTts.ts`**: Mock text-to-speech (generates WAV files)

#### Database (`src/db/`)
- **`prisma.ts`**: Prisma client singleton
- **`repositories/`**: Data access layer for each entity
  - `TenantRepo.ts`
  - `AgentRepo.ts`
  - `SessionRepo.ts`
  - `MessageRepo.ts`
  - `UsageEventRepo.ts`
  - `IdempotencyRepo.ts`

#### Middleware (`src/middleware/`)
- **`requestContext.ts`**: Attach requestId, logger to every request
- **`authTenant.ts`**: Validate API key, attach tenant to request

#### Providers (`src/providers/`)
- **`ProviderAdapter.ts`**: Interface definition
- **`vendorA.ts`**: Mock Vendor A implementation
- **`vendorB.ts`**: Mock Vendor B implementation
- **`factory.ts`**: Create provider instances by name

#### Reliability (`src/reliability/`)
- **`retry.ts`**: Retry with exponential backoff
- **`fallback.ts`**: Fallback provider logic
- **`timeout.ts`**: Timeout wrappers (planned)

#### Services (`src/services/`)
- **`ConversationService.ts`**: Core message sending logic (retry + fallback + billing)
- **`UsageService.ts`**: Usage analytics, rollups, monthly aggregation

#### Utils (`src/utils/`)
- **`errors.ts`**: AppError class, error factories
- **`hash.ts`**: API key generation + SHA-256 hashing
- **`ids.ts`**: Generate prefixed IDs (tnt_, agt_, ses_, etc.)

### Frontend Modules

#### API Client (`src/api/`)
- **`client.ts`**: Base HTTP client with auth, error handling
- **`endpoints.ts`**: All API endpoints as typed functions
- **`types.ts`**: TypeScript interfaces for API responses

#### Authentication (`src/auth/`)
- **`context.tsx`**: Auth context provider, login/logout logic

#### Components (`src/components/`)
- **`AppShell.tsx`**: App layout with navigation
- **`Button.tsx`**: Reusable button component
- **`Card.tsx`**: Card container component
- **`LoadingSpinner.tsx`**: Loading indicator
- **`ToastContext.tsx`**: Toast notification system
- **`VoiceRecorder.tsx`**: Voice recording UI with MediaRecorder API
- **Charts**: `UsageByMonthChart.tsx`, `ProviderBreakdownChart.tsx`

#### Pages (`src/pages/`)
- **`Login.tsx`**: API key authentication
- **`Agents.tsx`**: Agent CRUD interface
- **`TryIt.tsx`**: Chat interface with session management
- **`Usage.tsx`**: Analytics dashboard

---

## Data Flow Diagrams

### 1. Login Flow

```
┌─────────┐
│ User    │
└────┬────┘
     │ Enter API Key
     │
     ▼
┌─────────────────┐
│ Frontend:       │
│ Login.tsx       │
└────┬────────────┘
     │ POST /v1/me
     │ Header: X-API-Key
     │
     ▼
┌─────────────────────────────┐
│ Backend:                    │
│ 1. authTenant middleware    │
│    - Extract API key        │
│    - Hash key              │
│    - Query DB for key hash │
│    - Load tenant           │
│    - Attach to request     │
└────┬────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│ 2. GET /v1/me route         │
│    - Return request.tenant  │
└────┬────────────────────────┘
     │
     ▼
┌─────────────────┐
│ Frontend:       │
│ - Store tenant  │
│ - Store API key │
│ - Redirect to   │
│   Agents page   │
└─────────────────┘
```

### 2. Agent CRUD Flow

```
┌─────────┐
│ User    │
└────┬────┘
     │ Create Agent
     │
     ▼
┌─────────────────┐
│ Frontend:       │
│ Agents.tsx      │
└────┬────────────┘
     │ POST /v1/agents
     │ { name, primaryProvider, fallbackProvider, ... }
     │
     ▼
┌──────────────────────────────┐
│ Backend:                     │
│ 1. authTenant middleware     │
│    - Validate API key        │
│    - Load tenant             │
└────┬─────────────────────────┘
     │
     ▼
┌──────────────────────────────┐
│ 2. POST /v1/agents route     │
│    - Validate request body   │
│    - Generate agent ID       │
│    - Create agent record     │
│    - Link to tenant          │
└────┬─────────────────────────┘
     │
     ▼
┌──────────────────────────────┐
│ 3. AgentRepo.create()        │
│    - INSERT INTO Agent       │
│    - WHERE tenantId = ?      │
└────┬─────────────────────────┘
     │
     ▼
┌─────────────────┐
│ Frontend:       │
│ - Refresh list  │
│ - Show success  │
└─────────────────┘
```

### 3. Create Session Flow

```
┌─────────┐
│ User    │
└────┬────┘
     │ Select Agent
     │ Enter Customer ID
     │
     ▼
┌─────────────────┐
│ Frontend:       │
│ TryIt.tsx       │
└────┬────────────┘
     │ POST /v1/sessions
     │ { agentId, customerId, metadata }
     │
     ▼
┌──────────────────────────────┐
│ Backend:                     │
│ 1. authTenant middleware     │
└────┬─────────────────────────┘
     │
     ▼
┌──────────────────────────────┐
│ 2. POST /v1/sessions route   │
│    - Validate agentId exists │
│    - Verify agent owned by   │
│      current tenant          │
│    - Generate session ID     │
│    - Create session record   │
└────┬─────────────────────────┘
     │
     ▼
┌──────────────────────────────┐
│ 3. SessionRepo.create()      │
│    - INSERT INTO Session     │
│    - Link to agent + tenant  │
└────┬─────────────────────────┘
     │
     ▼
┌─────────────────┐
│ Frontend:       │
│ - Store session │
│ - Enable chat   │
└─────────────────┘
```

### 4. Send Message Flow (Complete)

```
┌─────────┐
│ User    │
└────┬────┘
     │ Type message
     │ Press Send
     │
     ▼
┌─────────────────────────────┐
│ Frontend: TryIt.tsx         │
│ 1. Generate idempotency key │
│    (if enabled)             │
│ 2. Add optimistic message   │
│    to UI                    │
└────┬────────────────────────┘
     │ POST /v1/sessions/:id/messages
     │ Header: Idempotency-Key
     │ Body: { role: "user", content: "..." }
     │
     ▼
┌────────────────────────────────────────┐
│ Backend: authTenant middleware         │
│ - Validate API key                     │
│ - Load tenant                          │
└────┬───────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│ Backend: POST /v1/sessions/:id/messages│
│ 1. Check idempotency                   │
└────┬───────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│ IdempotencyRepo.findByKey()            │
│ - Query IdempotencyRecord table        │
│ - If exists: return cached response    │
│ - If not: continue                     │
└────┬───────────────────────────────────┘
     │ (new request)
     │
     ▼
┌────────────────────────────────────────┐
│ ConversationService.sendMessage()      │
│ 1. Validate session exists             │
│ 2. Load agent config                   │
│ 3. Save user message to DB             │
│ 4. Build conversation context          │
└────┬───────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│ Reliability Layer                      │
│ 1. Get primary provider adapter        │
│ 2. sendWithRetry(primary, 3 attempts)  │
└────┬───────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│ Provider Adapter (vendorA)             │
│ Attempt 1: Call vendorA.sendMessage()  │
│   ├─ Success? → Return response        │
│   └─ Failure? → Retry                  │
│ Attempt 2: Wait 1s → Call again        │
│   ├─ Success? → Return response        │
│   └─ Failure? → Retry                  │
│ Attempt 3: Wait 2s → Call again        │
│   ├─ Success? → Return response        │
│   └─ Failure? → Try fallback           │
└────┬───────────────────────────────────┘
     │ (if primary failed)
     │
     ▼
┌────────────────────────────────────────┐
│ Fallback Provider (vendorB)            │
│ Attempt 1: Call vendorB.sendMessage()  │
│   ├─ Success? → Return response        │
│   └─ Failure? → Retry                  │
│ Attempt 2: Wait 1s → Call again        │
│   ├─ Success? → Return response        │
│   └─ Failure? → Retry                  │
│ Attempt 3: Wait 2s → Call again        │
│   ├─ Success? → Return response        │
│   └─ Failure? → Throw error            │
└────┬───────────────────────────────────┘
     │ (success)
     │
     ▼
┌────────────────────────────────────────┐
│ ConversationService (continued)        │
│ 5. Normalize provider response         │
│ 6. Save assistant message to DB        │
│ 7. Calculate cost                      │
│ 8. Create UsageEvent                   │
│ 9. Cache response in IdempotencyRecord │
└────┬───────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│ Response to Frontend                   │
│ {                                      │
│   message: { id, role, content, ... }, │
│   metadata: {                          │
│     providerUsed: "vendorA",           │
│     fallbackUsed: false,               │
│     usage: { tokensIn, tokensOut, ... }│
│     attempts: [...]                    │
│   }                                    │
│ }                                      │
└────┬───────────────────────────────────┘
     │
     ▼
┌─────────────────┐
│ Frontend:       │
│ - Update UI     │
│ - Show metadata │
└─────────────────┘
```

### 5. Usage Rollup Flow

```
┌─────────┐
│ User    │
└────┬────┘
     │ Select date range
     │
     ▼
┌─────────────────────────────┐
│ Frontend: Usage.tsx         │
└────┬────────────────────────┘
     │ GET /v1/usage/rollup?from=2024-01-01&to=2024-01-31
     │
     ▼
┌────────────────────────────────────────┐
│ Backend: UsageService.getRollup()      │
│ 1. Query UsageEvent table              │
│    WHERE tenantId = ? AND              │
│          createdAt BETWEEN ? AND ?     │
│ 2. Aggregate by provider:              │
│    - SUM(tokensTotal)                  │
│    - SUM(costUsd)                      │
│    - COUNT(DISTINCT sessionId)         │
│ 3. Group by agent for top agents       │
│ 4. Return structured data              │
└────┬───────────────────────────────────┘
     │
     ▼
┌─────────────────┐
│ Frontend:       │
│ - Render charts │
│ - Show totals   │
└─────────────────┘
```

### 6. Voice Flow

```
┌─────────┐
│ User    │
└────┬────┘
     │ Click microphone
     │ Speak
     │ Click stop
     │
     ▼
┌─────────────────────────────┐
│ Frontend: VoiceRecorder.tsx │
│ 1. MediaRecorder.start()    │
│ 2. Collect audio chunks     │
│ 3. MediaRecorder.stop()     │
│ 4. Create Blob (audio/webm) │
│ 5. Calculate duration       │
└────┬────────────────────────┘
     │ POST /v1/sessions/:id/voice
     │ Content-Type: multipart/form-data
     │ - audio: Blob
     │ - audioDurationMs: number
     │ Header: Idempotency-Key
     │
     ▼
┌────────────────────────────────────────┐
│ Backend: voiceRoutes.ts                │
│ 1. Parse multipart data                │
│ 2. Check idempotency                   │
└────┬───────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│ VoiceService.processVoiceMessage()     │
│ 1. Validate session exists             │
│ 2. Mock STT: transcribeAudio()         │
│    → "Hello, I need help." (mock)      │
└────┬───────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│ ConversationService.sendMessage()      │
│ (Same flow as text message)            │
│ - Save user message (transcript)       │
│ - Call provider with retry/fallback    │
│ - Save assistant response              │
│ - Create usage event                   │
└────┬───────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│ VoiceService (continued)               │
│ 3. Mock TTS: synthesizeSpeech()        │
│    - Estimate duration from text       │
│    - Generate silent WAV file          │
│    - Encode as base64                  │
│ 4. Build VoiceMessageResponse          │
└────┬───────────────────────────────────┘
     │
     ▼
┌─────────────────┐
│ Frontend:       │
│ - Display       │
│   transcript    │
│ - Play audio    │
│   response      │
└─────────────────┘
```

---

## Idempotency Flow

### Purpose
Prevent duplicate message processing and billing when clients retry failed requests due to network errors, timeouts, or other transient failures.

### When Idempotency-Key is Required
- **POST /v1/sessions/:id/messages**: Always required
- **POST /v1/sessions/:id/voice**: Always required
- **Other endpoints**: Not required (GET operations are naturally idempotent, agent CRUD is not critical)

### How Idempotency Records Are Created

```typescript
// 1. Client sends request with Idempotency-Key header
POST /v1/sessions/ses_123/messages
Header: Idempotency-Key: msg_abc123
Body: { role: "user", content: "Hello" }

// 2. Backend checks for existing record
const existing = await IdempotencyRepo.findByKey(
  tenantId,
  'msg_abc123'
)

// 3a. If exists: return cached response immediately
if (existing) {
  return reply.code(existing.statusCode).send(
    JSON.parse(existing.responseJson)
  )
}

// 3b. If not exists: process request normally
const response = await ConversationService.sendMessage(...)

// 4. Cache response in idempotency record
await IdempotencyRepo.create({
  tenantId,
  idempotencyKey: 'msg_abc123',
  sessionId: 'ses_123',
  requestPath: '/v1/sessions/ses_123/messages',
  responseJson: JSON.stringify(response),
  statusCode: 200,
  expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24h
})

// 5. Return response to client
return response
```

### How Concurrent Duplicates Are Handled

**Problem**: Two requests with same Idempotency-Key arrive simultaneously

```
Request A ──┐
            ├──> Backend
Request B ──┘
```

**Solution**: Database-level UNIQUE constraint on `(tenantId, idempotencyKey)`

```typescript
// Request A: Check idempotency → not found → proceed
// Request B: Check idempotency → not found → proceed

// Request A: Create idempotency record → SUCCESS
// Request B: Create idempotency record → UNIQUE CONSTRAINT VIOLATION

// Request B catches constraint error:
try {
  await IdempotencyRepo.create(...)
} catch (error) {
  if (error.code === 'P2002') { // Prisma unique constraint error
    // Another request created the record, fetch it
    const existing = await IdempotencyRepo.findByKey(...)
    return reply.code(existing.statusCode).send(
      JSON.parse(existing.responseJson)
    )
  }
  throw error
}
```

**Result**:
- Only one request processes the message
- Only one usage event created (no double-billing)
- Both requests receive identical response

### How Replay Avoids Double Billing and Double Writes

#### Scenario: Network failure after successful processing

```
1. Client sends: POST /v1/sessions/ses_123/messages
                 Idempotency-Key: msg_abc123
2. Backend processes successfully:
   - Creates user message in DB
   - Calls LLM provider
   - Creates assistant message in DB
   - Creates usage event (tokensIn: 100, tokensOut: 200, cost: $0.0006)
   - Creates idempotency record
3. Response sent: { message: {...}, metadata: {...} }
4. Network failure: Client doesn't receive response
5. Client retries: POST /v1/sessions/ses_123/messages
                    Idempotency-Key: msg_abc123 (same key)
6. Backend checks idempotency → FOUND
7. Backend returns cached response (no processing)
```

**Prevents**:
- ❌ Duplicate message in database
- ❌ Second LLM provider call
- ❌ Second usage event (double-billing)

**Guarantees**:
- ✅ Exactly-once message processing
- ✅ Exactly-once billing
- ✅ Consistent response

### Idempotency TTL

- **Duration**: 24 hours
- **Rationale**: Balance between safety and storage
  - Long enough for legitimate retries
  - Short enough to prevent unbounded growth
- **Cleanup**: Automatic via database TTL or scheduled job (can add `expiresAt < NOW()` query)

### Edge Cases

#### 1. Different session, same idempotency key
```
Request 1: POST /sessions/ses_123/messages
           Idempotency-Key: key_abc

Request 2: POST /sessions/ses_456/messages
           Idempotency-Key: key_abc

Result: Both succeed (idempotency is per-tenant, not global)
Reason: Idempotency record stores sessionId for validation
```

#### 2. Same key, different content
```
Request 1: POST /sessions/ses_123/messages
           Idempotency-Key: key_abc
           Content: "Hello"

Request 2: POST /sessions/ses_123/messages
           Idempotency-Key: key_abc
           Content: "Goodbye"

Result: Request 2 returns cached response from Request 1
Reason: Idempotency key determines uniqueness, not content
```

**Client responsibility**: Generate unique keys per unique request

#### 3. Idempotency for voice messages
Same mechanism applies:
```
POST /sessions/ses_123/voice
Idempotency-Key: voice_abc123
Body: multipart/form-data (audio file)

→ Prevents duplicate transcription, LLM call, TTS, and billing
```

---

## Summary

This architecture provides:

1. **Multi-tenancy**: Complete isolation with API key auth
2. **Reliability**: 3x retry + fallback + exponential backoff
3. **Billing accuracy**: Idempotency prevents double-billing
4. **Observability**: Detailed usage tracking and analytics
5. **Extensibility**: Clean adapter pattern for new providers
6. **Scalability**: Database-first design, stateless services

**Trade-offs made**:
- SQLite for simplicity (swap to PostgreSQL for production)
- Mocked providers for demo (real adapters easily added)
- In-memory idempotency cache (use Redis for distributed systems)
- No rate limiting yet (add as needed)

**Production readiness path**:
1. PostgreSQL database
2. Real provider adapters (OpenAI, Anthropic)
3. Redis for caching + idempotency
4. Rate limiting per tenant
5. Monitoring (Datadog, New Relic)
6. Horizontal scaling with load balancer
