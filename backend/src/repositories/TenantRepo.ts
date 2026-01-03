import { prisma } from '../db/prisma';
import { Tenant } from '../generated/prisma';

/**
 * Find tenant by hashed API key
 * Also updates the lastUsedAt timestamp for the API key
 *
 * @param keyHash - The hashed API key
 * @returns Tenant if found, null otherwise
 */
export async function findByApiKeyHash(keyHash: string): Promise<Tenant | null> {
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { tenant: true },
  });

  if (!apiKey) {
    return null;
  }

  // Update lastUsedAt timestamp asynchronously (fire and forget)
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch((error) => {
      console.error('Failed to update API key lastUsedAt:', error);
    });

  return apiKey.tenant;
}

/**
 * Find tenant by ID
 *
 * @param tenantId - The tenant ID
 * @returns Tenant if found, null otherwise
 */
export async function findById(tenantId: string): Promise<Tenant | null> {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
  });
}

/**
 * Create a new tenant
 *
 * @param id - The tenant ID (pre-generated)
 * @param name - The tenant name
 * @returns Created tenant
 */
export async function create(id: string, name: string): Promise<Tenant> {
  return prisma.tenant.create({
    data: { id, name },
  });
}
