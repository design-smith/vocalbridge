import { prisma } from '../db/prisma';
import { IdempotencyRecord } from '../generated/prisma';
import { Prisma } from '../generated/prisma';

export interface CreateIdempotencyRecordData {
  id: string;
  tenantId: string;
  scope: string;
  idempotencyKey: string;
  sessionId: string | null;
  requestHash: string;
}

/**
 * Lookup an existing idempotency record
 *
 * @param tenantId - The tenant ID
 * @param scope - The operation scope (e.g., "send_message")
 * @param idempotencyKey - The idempotency key from request header
 * @returns Existing record if found, null otherwise
 */
export async function lookup(
  tenantId: string,
  scope: string,
  idempotencyKey: string
): Promise<IdempotencyRecord | null> {
  return prisma.idempotencyRecord.findUnique({
    where: {
      tenantId_scope_idempotencyKey: {
        tenantId,
        scope,
        idempotencyKey,
      },
    },
  });
}

/**
 * Create a new idempotency record (placeholder)
 * This uses the unique constraint to prevent concurrent duplicate operations
 *
 * @param data - Record data
 * @returns Created record
 * @throws Error if unique constraint is violated (concurrent request with same key)
 */
export async function create(
  data: CreateIdempotencyRecordData
): Promise<IdempotencyRecord> {
  try {
    return await prisma.idempotencyRecord.create({
      data: {
        id: data.id,
        tenantId: data.tenantId,
        scope: data.scope,
        idempotencyKey: data.idempotencyKey,
        sessionId: data.sessionId,
        requestHash: data.requestHash,
        responseJson: null, // Will be updated later
      },
    });
  } catch (error) {
    // Check if it's a unique constraint violation
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      // Unique constraint violation - another request is processing or completed
      // Retry lookup to get the existing record
      const existing = await lookup(
        data.tenantId,
        data.scope,
        data.idempotencyKey
      );

      if (existing) {
        // Return existing record (caller should check if responseJson is populated)
        return existing;
      }
    }

    // Re-throw if not a unique constraint error or lookup failed
    throw error;
  }
}

/**
 * Update an idempotency record with the response JSON
 * This completes the idempotency record after successful processing
 *
 * @param tenantId - The tenant ID
 * @param scope - The operation scope
 * @param idempotencyKey - The idempotency key
 * @param responseJson - The response to store
 * @returns Updated record
 */
export async function updateResponse(
  tenantId: string,
  scope: string,
  idempotencyKey: string,
  responseJson: string
): Promise<IdempotencyRecord> {
  return prisma.idempotencyRecord.update({
    where: {
      tenantId_scope_idempotencyKey: {
        tenantId,
        scope,
        idempotencyKey,
      },
    },
    data: {
      responseJson,
    },
  });
}

/**
 * Delete old idempotency records (for cleanup)
 * Optional: can be run as a background job
 *
 * @param olderThan - Delete records older than this date
 * @returns Number of deleted records
 */
export async function deleteOld(olderThan: Date): Promise<number> {
  const result = await prisma.idempotencyRecord.deleteMany({
    where: {
      createdAt: {
        lt: olderThan,
      },
    },
  });

  return result.count;
}
