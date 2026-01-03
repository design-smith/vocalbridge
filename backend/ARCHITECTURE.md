# VocalBridge Ops - Backend Architecture

## Table of Contents
1. [Module List](#module-list)
2. [Data Flow Diagrams](#data-flow-diagrams)
3. [Idempotency Flow](#idempotency-flow)
4. [High-Level Design](#high-level-design)
5. [Low-Level Design](#low-level-design)
6. [Scaling Plan](#scaling-plan)
7. [Security Considerations](#security-considerations)

---

## Module List

### Core Server
- **src/server.ts**: Bootstrap Fastify server, register routes, middleware, error handler, logging

### API Routes
- **src/api/routes/me.ts**: GET /v1/me (tenant info, pricing)
- **src/api/routes/agents.ts**: CRUD for agents (GET, POST, PUT)
- **src/api/routes/sessions.ts**: POST /v1/sessions, GET /v1/sessions/:id/transcript
- **src/api/routes/messages.ts**: POST /v1/sessions/:id/messages (idempotent)
- **src/api/routes/usage.ts**: GET /v1/usage/rollup, GET /v1/usage/events

### Middleware
- **src/middleware/requestContext.ts**: Generate requestId, correlationId, attach to request
- **src/middleware/authTenant.ts**: Validate X-API-Key, hash lookup, inject tenant context

### Database
- **src/db/prisma.ts**: Prisma client singleton, connection management

### Repositories (Data Access)
- **src/repositories/TenantRepo.ts**: findByApiKeyHash, updateApiKeyLastUsed
- **src/repositories/AgentRepo.ts**: create, findById, findAll, update (tenant-scoped)
- **src/repositories/SessionRepo.ts**: create, findById, updateLastActivity (tenant-scoped)
- **src/repositories/MessageRepo.ts**: create, listBySession (tenant-scoped)
- **src/repositories/ProviderCallEventRepo.ts**: create, listBySession
- **src/repositories/UsageEventRepo.ts**: create, getRollup, listEvents (tenant-scoped)
- **src/repositories/IdempotencyRepo.ts**: lookup, create, updateResponse

### Services (Business Logic)
- **src/services/AgentService.ts**: CRUD operations with tenant scoping, validation
- **src/services/SessionService.ts**: create session, get session with tenant validation
- **src/services/ConversationService.ts**: sendMessage pipeline (idempotency → persist user msg → provider call → persist assistant msg → usage event)
- **src/services/UsageService.ts**: rollup calculations, event listing with date filters

### Provider Adapters
- **src/providers/types.ts**: ProviderAdapter interface, NormalizedResponse, ProviderRequest types
- **src/providers/vendorA/adapter.ts**: VendorA adapter implementing ProviderAdapter
- **src/providers/vendorA/mock.ts**: Mock implementation with 10% failure rate, latency
- **src/providers/vendorB/adapter.ts**: VendorB adapter implementing ProviderAdapter
- **src/providers/vendorB/mock.ts**: Mock implementation with 429 errors, retryAfterMs

### Reliability
- **src/reliability/retryPolicy.ts**: Retry conditions, exponential backoff, timeout wrapper
- **src/reliability/providerCaller.ts**: Unified provider call wrapper with retry/fallback logic

### Billing
- **src/billing/pricing.ts**: Pricing table constants, calculateCost function

### Utilities
- **src/utils/ids.ts**: Generate prefixed IDs (tnt_, agt_, ses_, msg_, evt_, req_)
- **src/utils/hash.ts**: SHA-256 hashing for API keys and request fingerprints
- **src/utils/errors.ts**: Structured error helpers (AppError class, error formatters)

### Seeding
- **src/seed/seed.ts**: Seed script creating 2 tenants + API keys + 3 agents

### Tests
- **tests/unit/**: Unit tests for utils, billing, retry logic, adapters
- **tests/integration/**: Integration tests for API flows, idempotency, fallback

---

## Data Flow Diagrams

### 1. Login Validation Flow
```
Client
  ↓ GET /v1/me with X-API-Key header
Fastify Server
  ↓ middleware/requestContext → generate requestId
  ↓ middleware/authTenant → hash API key → TenantRepo.findByApiKeyHash
  ↓ (if invalid) → 401 error
  ↓ (if valid) → inject tenant context into request
API Route /v1/me
  ↓ return tenant info + pricing table
Client ← response
```

### 2. Agents CRUD Flow
```
Client
  ↓ POST /v1/agents with X-API-Key + body
Fastify Server
  ↓ requestContext middleware
  ↓ authTenant middleware → validate tenant
API Route /v1/agents
  ↓ Zod validate request body
  ↓ AgentService.create(tenantId, agentData)
    ↓ AgentRepo.create → INSERT into Agent table (with tenantId)
    ↓ DB commit
  ↓ return agent object
Client ← response

Similar flows for GET, PUT with tenant-scoped queries
```

### 3. Create Session Flow
```
Client
  ↓ POST /v1/sessions with X-API-Key + { agentId, customerId, metadata }
Fastify Server
  ↓ requestContext + authTenant middlewares
API Route /v1/sessions
  ↓ Zod validate body
  ↓ SessionService.create(tenantId, agentId, customerId, metadata)
    ↓ AgentRepo.findById(tenantId, agentId) → verify agent exists for tenant
    ↓ SessionRepo.create → INSERT into Session table
    ↓ DB commit
  ↓ return session object
Client ← response
```

### 4. Send Message Flow (CORE - Most Complex)
```
Client
  ↓ POST /v1/sessions/:sessionId/messages
  ↓ Headers: X-API-Key, Idempotency-Key
  ↓ Body: { role: "user", content: "..." }
Fastify Server
  ↓ requestContext middleware → generate requestId
  ↓ authTenant middleware → validate tenant → inject tenantId
API Route /v1/sessions/:sessionId/messages
  ↓ Zod validate body + headers
  ↓ ConversationService.sendMessage(tenantId, sessionId, idempotencyKey, userMessage)

    ↓ 1. IDEMPOTENCY CHECK
    ↓ IdempotencyRepo.lookup(tenantId, "send_message", idempotencyKey)
    ↓ → if exists: return stored responseJson with replayed=true (EXIT)

    ↓ 2. CREATE IDEMPOTENCY PLACEHOLDER
    ↓ compute requestHash(tenantId, sessionId, content)
    ↓ IdempotencyRepo.create(unique constraint on tenantId+scope+key)
    ↓ → if unique violation: fetch existing → return with replayed=true (EXIT)

    ↓ 3. VALIDATE SESSION & AGENT
    ↓ SessionRepo.findById(tenantId, sessionId) → get session
    ↓ AgentRepo.findById(tenantId, session.agentId) → get agent config

    ↓ 4. PERSIST USER MESSAGE
    ↓ MessageRepo.create(tenantId, sessionId, "user", content)
    ↓ DB commit → user message saved

    ↓ 5. CALL PRIMARY PROVIDER WITH RELIABILITY
    ↓ reliability/providerCaller.callWithRetry(primaryProvider, request)
      ↓ attempt 1: vendorA/adapter.call → timeout wrapper
        ↓ vendorA/mock.generate → simulate latency, maybe fail
        ↓ ProviderCallEventRepo.create(attempt 1 details)
      ↓ if transient error (500/timeout): retry with backoff
      ↓ attempt 2, 3... (up to max retries)
      ↓ if all fail → check fallback

      ↓ 6. FALLBACK (if primary failed & fallback configured)
      ↓ reliability/providerCaller.callWithRetry(fallbackProvider, request)
        ↓ vendorB/adapter.call → timeout wrapper
        ↓ vendorB/mock.generate → maybe 429 with retryAfterMs
        ↓ ProviderCallEventRepo.create(fallback attempt details)
      ↓ return normalized response: { text, tokensIn, tokensOut, provider }

    ↓ 7. PERSIST ASSISTANT MESSAGE
    ↓ MessageRepo.create(tenantId, sessionId, "assistant", response.text)
    ↓ DB commit → assistant message saved

    ↓ 8. CALCULATE COST & CREATE USAGE EVENT
    ↓ billing/pricing.calculateCost(provider, tokensIn, tokensOut)
    ↓ UsageEventRepo.create(tenantId, sessionId, agentId, provider, tokens, cost)
    ↓ DB commit → usage event saved

    ↓ 9. UPDATE IDEMPOTENCY RECORD
    ↓ IdempotencyRepo.updateResponse(idempotencyKey, responseJson)
    ↓ DB commit

    ↓ return { message, metadata }

Client ← response with message + metadata (attempts, usage, idempotency)

Tables Written:
- IdempotencyRecord (step 2, 9)
- Message (steps 4, 7)
- ProviderCallEvent (step 5, 6 - each attempt)
- UsageEvent (step 8)
- Session.lastActivityAt (updated)
```

### 5. Usage Rollup Flow
```
Client
  ↓ GET /v1/usage/rollup?from=2024-01-01&to=2024-01-31
Fastify Server
  ↓ requestContext + authTenant middlewares
API Route /v1/usage/rollup
  ↓ Zod validate query params
  ↓ UsageService.getRollup(tenantId, from, to)
    ↓ UsageEventRepo.getRollup(tenantId, from, to)
      ↓ SQL: SELECT SUM(tokensIn), SUM(tokensOut), SUM(costUsd), COUNT(DISTINCT sessionId)
      ↓      WHERE tenantId = ? AND createdAt BETWEEN ? AND ?
      ↓      GROUP BY provider
      ↓ SQL: SELECT agentId, SUM(costUsd), SUM(tokensIn+tokensOut)
      ↓      GROUP BY agentId ORDER BY cost DESC LIMIT 10
    ↓ compute totals, byProvider, topAgents
  ↓ return { range, totals, byProvider, topAgentsByCost }
Client ← response

Tables Read:
- UsageEvent (aggregated queries)
- Agent (join for agent names)
```

---

## Idempotency Flow

### Requirements
- **Idempotency-Key header is REQUIRED** for POST /v1/sessions/:sessionId/messages
- If missing → return 400 error

### Scope Definition
- Idempotency is scoped to: **(tenantId + scope + idempotencyKey)**
  - scope = "send_message" (allows different scopes for future operations)
  - This ensures keys are isolated per tenant and operation type
  - sessionId is stored in the record but not part of unique constraint (allows same key across different sessions)

### Flow Steps

1. **Lookup Existing Record**
   - Query: `IdempotencyRecord.findUnique({ tenantId, scope: "send_message", idempotencyKey })`
   - If found:
     - Parse stored `responseJson`
     - Set `metadata.idempotency.replayed = true`
     - Return stored response immediately (no DB writes, no provider call)
     - **Result**: No duplicate messages, no duplicate usage events

2. **Create Placeholder Record**
   - Compute `requestHash = SHA256(tenantId + sessionId + content + timestamp)`
   - Attempt INSERT with unique constraint on `(tenantId, scope, idempotencyKey)`
   - If INSERT succeeds → proceed to step 3
   - If unique constraint violation (concurrent request with same key):
     - Another request is processing or completed
     - Retry lookup (step 1) → should find existing record
     - Return replayed response

3. **Process Request**
   - Persist user message
   - Call provider (with retries/fallback)
   - Persist assistant message
   - Create usage event
   - Build response object

4. **Update Idempotency Record**
   - UPDATE `IdempotencyRecord` SET `responseJson = <full response>`
   - WHERE `(tenantId, scope, idempotencyKey)` matches
   - This makes the response available for future replays

### Concurrency Handling
- **Database unique constraint** on `(tenantId, scope, idempotencyKey)` is the enforcement mechanism
- If two requests arrive simultaneously with same key:
  - First INSERT wins → proceeds
  - Second INSERT fails → retries lookup → gets replayed response
- No application-level locks needed

### Double Billing Prevention
- Usage events are only created in step 3 (after idempotency check)
- Replayed requests (step 1) bypass all writes
- `requestHash` provides additional verification that request content matches (optional defense against key reuse with different payloads)

### Edge Cases
- **Client retries after timeout**: If first request is still processing, second request waits at unique constraint, then replays when first completes
- **Different content with same key**: `requestHash` can detect this (optional: return 409 conflict if hash differs)
- **Expired keys**: Optional TTL on idempotency records (not required for MVP)

---

## High-Level Design

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                         Client                              │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS + X-API-Key
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    Fastify Server                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Middleware Layer                                    │   │
│  │  - Request Context (requestId, correlationId)        │   │
│  │  - Auth Tenant (API key validation, tenant inject)   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  API Routes (Zod validation)                         │   │
│  │  /v1/me, /v1/agents, /v1/sessions, /v1/messages      │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Services Layer (Business Logic)                     │   │
│  │  - AgentService                                      │   │
│  │  - SessionService                                    │   │
│  │  - ConversationService (idempotency + providers)     │   │
│  │  - UsageService                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Repository Layer (Data Access)                      │   │
│  │  All queries scoped by tenantId                      │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┴─────────────────┐
        │                                  │
        ↓                                  ↓
┌───────────────────┐            ┌─────────────────────┐
│  SQLite Database  │            │  Provider Adapters  │
│  (Prisma ORM)     │            │  - VendorA          │
│                   │            │  - VendorB          │
│  Tenant isolation │            │  + Reliability      │
│  via tenantId     │            │    (retry/fallback) │
└───────────────────┘            └─────────────────────┘
```

### Request Flow

1. **Authentication**: Every request validates API key → tenant context
2. **Tenant Isolation**: All DB queries include tenantId filter
3. **Idempotency**: Message sends are idempotent via database constraint
4. **Provider Abstraction**: Adapters normalize different vendor APIs
5. **Reliability**: Retry + timeout + fallback on provider calls
6. **Billing**: Every assistant message generates exactly one usage event

### Tenancy Isolation Strategy

**Hard Multi-tenancy at Application Level:**
- API key → tenant mapping enforced at authentication layer
- All database queries include `WHERE tenantId = ?`
- No cross-tenant data access possible
- Repository layer enforces tenant scoping on all operations

**Security:**
- API keys hashed with SHA-256 before storage
- No plaintext API keys in database
- Tenant context injected by middleware, never trusted from client

---

## Low-Level Design

### Database Schema

**Key Tables:**
- `tenants` - Organizations
- `api_keys` - Hashed API keys with tenantId FK
- `agents` - AI agent configurations (tenantId scoped)
- `sessions` - Conversation sessions (tenantId + agentId scoped)
- `messages` - Message history (tenantId scoped)
- `provider_call_events` - Provider attempt logs
- `usage_events` - Billing/usage records
- `idempotency_records` - Idempotency enforcement (unique on tenantId + scope + key)

**Critical Indexes:**
- `api_keys.keyHash` (unique) - Fast API key lookup
- `idempotency_records(tenantId, scope, idempotencyKey)` (unique) - Idempotency enforcement
- All tables have `tenantId` index for scoped queries
- `usage_events` indexed on `createdAt` for rollup queries

### Provider Adapter Interface

```typescript
interface ProviderAdapter {
  name: string;
  call(request: ProviderRequest): Promise<NormalizedResponse>;
}

interface NormalizedResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}
```

**Why this design:**
- Vendor-agnostic: New providers can be added without changing core logic
- Normalized response: All providers return same structure
- Testable: Easy to mock for testing

### Retry/Fallback Logic

**Retry Policy:**
- Max 2 retries (3 total attempts)
- Exponential backoff: 200ms, 400ms, 800ms (with jitter)
- Timeout: 2 seconds per attempt
- Retryable errors: 5xx, 429, timeout

**Fallback:**
- If primary provider fails after retries, try fallback
- Fallback uses same retry policy
- All attempts logged in `provider_call_events`

**VendorB 429 Handling:**
- Respects `retryAfterMs` from vendor
- Uses vendor's suggested delay instead of exponential backoff

---

## Scaling Plan

### Vertical Scaling (Current Architecture)
- Single server handles all requests
- SQLite suitable for low-to-medium traffic
- In-memory caching for frequently accessed data

### Horizontal Scaling (Future)

**Phase 1: Stateless API Servers**
- Deploy multiple API server instances behind load balancer
- All state in database
- No sticky sessions required

**Phase 2: Database Scaling**
- Migrate from SQLite to PostgreSQL
- Add read replicas for analytics queries
- Connection pooling (PgBouncer)

**Phase 3: Caching Layer**
- Redis for:
  - API key → tenant mapping (reduce DB lookups)
  - Agent configurations (reduce DB reads)
  - Idempotency records (TTL-based expiration)

**Phase 4: Background Jobs**
- Async provider calls via message queue (RabbitMQ/SQS)
- Separate workers for provider calls
- Better isolation and failure handling

**Phase 5: Multi-region**
- Database replication across regions
- Regional API servers
- CDN for static assets

### Performance Targets
- p50 latency: < 500ms for message sends
- p99 latency: < 2s for message sends
- Throughput: 100+ requests/second per server instance

---

## Security Considerations

### Authentication
- **API Key Hashing**: SHA-256, never stored plaintext
- **No JWT/sessions**: Stateless auth via API key
- **Rate limiting**: Future enhancement (per tenant)

### Authorization
- **Tenant Isolation**: All queries scoped by tenantId
- **No trust of client input**: TenantId derived from API key only
- **Resource ownership**: Agents/sessions verified to belong to tenant

### Data Protection
- **No PII logging**: Avoid logging message content
- **Structured errors**: No stack traces in production
- **HTTPS required**: TLS for all client connections (production)

### Input Validation
- **Zod schemas**: All inputs validated
- **SQL injection**: Prevented by Prisma (parameterized queries)
- **XSS**: Not applicable (API-only, no HTML rendering)

### Secrets Management
- **Environment variables**: API keys, DB credentials
- **No hardcoded secrets**: All config from env
- **Key rotation**: API keys can be regenerated

### Audit Trail
- **Request logs**: Every request logged with requestId
- **Provider call events**: All provider attempts tracked
- **Usage events**: Complete billing audit trail

### Future Enhancements
- **API key expiration**: TTL on API keys
- **IP allowlisting**: Restrict API keys to specific IPs
- **Webhook signatures**: HMAC for webhooks
- **Encryption at rest**: Database encryption
