/**
 * Tenant authentication middleware
 * Validates X-API-Key header and injects tenant context into request
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { Tenant } from '../generated/prisma';
import { hashApiKey } from '../utils/hash';
import { invalidApiKeyError } from '../utils/errors';
import * as TenantRepo from '../repositories/TenantRepo';

/**
 * Extend Fastify request type to include tenant
 */
declare module 'fastify' {
  interface FastifyRequest {
    tenant: Tenant;
  }
}

/**
 * Authentication middleware
 * Validates API key and attaches tenant to request
 *
 * CRITICAL: This middleware ensures tenant isolation.
 * All subsequent code can trust that request.tenant is valid and scoped.
 */
export async function authTenant(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Extract API key from header
  const apiKey = request.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    throw invalidApiKeyError(request.requestId);
  }

  // Hash the API key (we store hashes, not plaintext)
  const keyHash = hashApiKey(apiKey);

  // Look up tenant by key hash
  const tenant = await TenantRepo.findByApiKeyHash(keyHash);

  if (!tenant) {
    throw invalidApiKeyError(request.requestId);
  }

  // Attach tenant to request for use in route handlers
  request.tenant = tenant;

  // Log successful authentication (helpful for debugging)
  request.log.info(
    {
      tenantId: tenant.id,
      tenantName: tenant.name,
      requestId: request.requestId,
    },
    'Tenant authenticated'
  );
}
