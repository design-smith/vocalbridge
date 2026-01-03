import { PrismaClient } from '../generated/prisma';

/**
 * Prisma client singleton
 * Prevents multiple instances in development with hot reloading
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Graceful shutdown handler
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
