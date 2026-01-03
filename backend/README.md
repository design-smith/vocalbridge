# VocalBridge Ops - Agent Gateway Backend

Multi-tenant AI Agent Gateway backend service. This is a production-ready API service where each tenant (business) uses an API key to manage AI agents, create conversation sessions, send messages, and get usage/cost analytics.

## Features

- **Multi-tenant architecture** with strict tenant isolation
- **Idempotent message sending** to prevent double billing
- **Provider abstraction** with retry, timeout, and fallback support
- **Usage metering & billing** with cost tracking per message
- **Structured error responses** (no stack traces in production)
- **Comprehensive logging** with request correlation IDs

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Web Framework:** Fastify
- **Database:** SQLite with Prisma ORM
- **Validation:** Zod
- **Logging:** Pino
- **Testing:** Vitest

## Prerequisites

- Node.js 18+
- npm or yarn

## Installation

1. **Clone and navigate to backend:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Setup database:**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. **Seed database with test data:**
   ```bash
   npm run seed
   ```

   Save the API keys printed by the seed script - you'll need them to authenticate!

## Running the Server

**Development mode (with hot reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

**Run tests:**
```bash
npm test              # Watch mode
npm run test:run      # Run once
```

The server runs on `http://localhost:3000` by default.

## Environment Variables

Create a `.env` file (based on `.env.example`):

```env
DATABASE_URL="file:./dev.db"
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

## API Endpoints

All endpoints (except `/health`) require the `X-API-Key` header.

### Health Check
```bash
GET /health
```

### Authentication & Info
```bash
GET /v1/me
# Returns tenant info and pricing
```

### Agents
```bash
GET /v1/agents                  # List all agents
POST /v1/agents                 # Create agent
GET /v1/agents/:agentId         # Get agent details
PUT /v1/agents/:agentId         # Update agent
```

### Sessions
```bash
POST /v1/sessions                        # Create session
GET /v1/sessions/:sessionId/transcript   # Get transcript
```

### Messages (Idempotent)
```bash
POST /v1/sessions/:sessionId/messages
# Requires: Idempotency-Key header
```

### Usage Analytics
```bash
GET /v1/usage/rollup?from=YYYY-MM-DD&to=YYYY-MM-DD
GET /v1/usage/events?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=200
```

## Sample Usage

### 1. Get Tenant Info
```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  http://localhost:3000/v1/me
```

**Response:**
```json
{
  "tenant": {
    "id": "tnt_...",
    "name": "Acme Corporation",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "pricing": {
    "vendorA": { "usdPer1kTokens": 0.002 },
    "vendorB": { "usdPer1kTokens": 0.003 }
  }
}
```

### 2. List Agents
```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  http://localhost:3000/v1/agents
```

### 3. Create a Session
```bash
curl -X POST \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agt_...",
    "customerId": "customer_123",
    "metadata": {"channel": "chat"}
  }' \
  http://localhost:3000/v1/sessions
```

**Response:**
```json
{
  "session": {
    "id": "ses_...",
    "agentId": "agt_...",
    "customerId": "customer_123",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastActivityAt": "2024-01-01T00:00:00.000Z",
    "metadata": { "channel": "chat" }
  }
}
```

### 4. Send a Message (Idempotent)
```bash
curl -X POST \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Idempotency-Key: unique-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "user",
    "content": "Hello, how can you help me?"
  }' \
  http://localhost:3000/v1/sessions/ses_.../messages
```

**Response:**
```json
{
  "message": {
    "id": "msg_...",
    "sessionId": "ses_...",
    "role": "assistant",
    "content": "Hello! I'm here to help...",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "metadata": {
    "agentId": "agt_...",
    "providerUsed": "vendorA",
    "primaryAttempted": "vendorA",
    "fallbackAttempted": "vendorB",
    "fallbackUsed": false,
    "attempts": [
      {
        "provider": "vendorA",
        "status": "success",
        "httpStatus": 200,
        "latencyMs": 234,
        "retries": 0,
        "errorCode": null
      }
    ],
    "usage": {
      "tokensIn": 45,
      "tokensOut": 67,
      "costUsd": 0.000224,
      "pricing": { "usdPer1kTokens": 0.002 }
    },
    "idempotency": {
      "key": "unique-key-123",
      "replayed": false
    },
    "requestId": "req_..."
  }
}
```

**Retry with same Idempotency-Key:**
- Returns HTTP 200 (instead of 201)
- Sets `idempotency.replayed: true`
- Does NOT create duplicate usage events

### 5. Get Session Transcript
```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  http://localhost:3000/v1/sessions/ses_.../transcript
```

### 6. Get Usage Rollup
```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  "http://localhost:3000/v1/usage/rollup?from=2024-01-01&to=2024-01-31"
```

**Response:**
```json
{
  "range": {
    "from": "2024-01-01",
    "to": "2024-01-31"
  },
  "totals": {
    "sessions": 15,
    "messages": 42,
    "tokensIn": 1234,
    "tokensOut": 5678,
    "tokensTotal": 6912,
    "costUsd": 0.013824
  },
  "byProvider": [
    {
      "provider": "vendorA",
      "sessions": 10,
      "tokensIn": 800,
      "tokensOut": 3200,
      "tokensTotal": 4000,
      "costUsd": 0.008
    },
    {
      "provider": "vendorB",
      "sessions": 5,
      "tokensIn": 434,
      "tokensOut": 2478,
      "tokensTotal": 2912,
      "costUsd": 0.008736
    }
  ],
  "topAgentsByCost": [
    {
      "agentId": "agt_...",
      "agentName": "Customer Support Agent",
      "sessions": 10,
      "tokensTotal": 4500,
      "costUsd": 0.009
    }
  ]
}
```

## Database Schema

- **Tenant** - Tenant/organization
- **ApiKey** - API keys (hashed with SHA-256)
- **Agent** - AI agent configurations
- **Session** - Conversation sessions
- **Message** - Message history (user and assistant)
- **ProviderCallEvent** - Provider call attempts and outcomes
- **UsageEvent** - Usage/billing events (one per assistant message)
- **IdempotencyRecord** - Idempotency enforcement

## Idempotency

The `POST /v1/sessions/:sessionId/messages` endpoint is **idempotent**:

1. Requires `Idempotency-Key` header
2. First request processes normally and stores the response
3. Subsequent requests with same key return the cached response
4. Prevents duplicate messages and usage events
5. Unique constraint on `(tenantId, scope, idempotencyKey)` prevents concurrency issues

## Provider Configuration

Agents can be configured with:
- **Primary provider:** `vendorA` or `vendorB`
- **Fallback provider:** Optional fallback if primary fails

**Reliability features:**
- Timeout: 2 seconds per attempt
- Retries: Up to 2 retries with exponential backoff (200ms, 400ms, 800ms)
- Fallback: Automatic fallback to secondary provider if primary fails
- Rate limiting: Respects vendor `retryAfterMs` for 429 errors

## Pricing

- **VendorA:** $0.002 per 1,000 tokens
- **VendorB:** $0.003 per 1,000 tokens

Cost is calculated as: `(tokensIn + tokensOut) / 1000 * pricePerK`

## Error Handling

All errors return structured JSON (no stack traces):

```json
{
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent with id 'agt_123' not found or does not belong to this tenant",
    "details": { "agentId": "agt_123" },
    "requestId": "req_..."
  }
}
```

**Common error codes:**
- `UNAUTHORIZED` (401) - Missing or invalid API key
- `VALIDATION_ERROR` (400) - Invalid request data
- `RESOURCE_NOT_FOUND` (404) - Resource not found
- `IDEMPOTENCY_KEY_REQUIRED` (400) - Missing idempotency key
- `ALL_PROVIDERS_FAILED` (503) - All providers failed
- `INTERNAL_ERROR` (500) - Unexpected error

## Development Commands

```bash
npm run dev           # Start development server
npm run build         # Build for production
npm run start         # Start production server
npm test              # Run tests in watch mode
npm run test:run      # Run tests once
npm run test:ui       # Open Vitest UI
npm run seed          # Seed database
npm run db:migrate    # Run database migrations
npm run db:studio     # Open Prisma Studio
npm run lint          # Type check
```

## Project Structure

```
backend/
├── src/
│   ├── api/routes/        # HTTP route handlers
│   ├── middleware/        # Request middleware
│   ├── services/          # Business logic
│   ├── repositories/      # Data access layer
│   ├── providers/         # AI provider adapters
│   ├── reliability/       # Retry/timeout/fallback logic
│   ├── billing/           # Pricing and cost calculation
│   ├── utils/             # Utilities (IDs, hashing, errors)
│   ├── db/                # Database client
│   ├── seed/              # Database seeding
│   └── server.ts          # Server entry point
├── tests/
│   ├── unit/              # Unit tests
│   └── integration/       # Integration tests
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Migration history
└── package.json
```

## License

ISC

## Support

For issues or questions, please open an issue in the repository.
