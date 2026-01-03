/**
 * Me Route
 * GET /v1/me - Returns tenant info and pricing
 */

import { FastifyInstance } from 'fastify';
import { getAllPricing } from '../../billing/pricing';

export async function meRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /v1/me
   * Returns authenticated tenant information and pricing
   */
  fastify.get('/v1/me', async (request, reply) => {
    const tenant = request.tenant;

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        createdAt: tenant.createdAt.toISOString(),
      },
      pricing: getAllPricing(),
    };
  });
}
