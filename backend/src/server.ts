/**
 * VocalBridge Ops Backend Server
 * Multi-tenant AI Agent Gateway
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { requestContext } from './middleware/requestContext';
import { authTenant } from './middleware/authTenant';
import { meRoutes } from './api/routes/me';
import { agentRoutes } from './api/routes/agents';
import { sessionRoutes } from './api/routes/sessions';
import { messageRoutes } from './api/routes/messages';
import { usageRoutes } from './api/routes/usage';
import { voiceRoutes } from './channels/voice/voiceRoutes';
import { disconnectPrisma } from './db/prisma';
import { AppError, isAppError, toAppError } from './utils/errors';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Create and configure Fastify server
 */
async function createServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true, // Allow all origins in development
    credentials: true,
  });

  // Register multipart support for file uploads (voice channel)
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB max file size
      files: 1, // Only one file per request
    },
  });

  // Register request context middleware (runs on all requests)
  fastify.addHook('onRequest', requestContext);

  // Health check endpoint (no auth required)
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register authenticated routes with authTenant middleware
  fastify.register(
    async (authenticatedRoutes) => {
      // Apply auth middleware to all routes in this context
      authenticatedRoutes.addHook('onRequest', authTenant);

      // Register all API routes
      await authenticatedRoutes.register(meRoutes);
      await authenticatedRoutes.register(agentRoutes);
      await authenticatedRoutes.register(sessionRoutes);
      await authenticatedRoutes.register(messageRoutes);
      await authenticatedRoutes.register(usageRoutes);
      await authenticatedRoutes.register(voiceRoutes);
    },
    { prefix: '' }
  );

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    // Convert to AppError if needed
    const appError = isAppError(error) ? error : toAppError(error, request.requestId);

    // Log error
    request.log.error(
      {
        error: {
          code: appError.code,
          message: appError.message,
          statusCode: appError.statusCode,
          details: appError.details,
        },
        requestId: request.requestId,
        url: request.url,
        method: request.method,
      },
      'Request error'
    );

    // Send structured error response (no stack traces)
    reply.code(appError.statusCode).send(appError.toJSON());
  });

  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
        requestId: request.requestId,
      },
    });
  });

  return fastify;
}

/**
 * Start the server
 */
async function start() {
  try {
    const fastify = await createServer();

    // Start listening
    await fastify.listen({ port: PORT, host: HOST });

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║         VocalBridge Ops - Agent Gateway Backend          ║
║                                                           ║
║  Server running on: http://${HOST}:${PORT}${' '.repeat(Math.max(0, 24 - HOST.length - PORT.toString().length))}║
║  Environment: ${process.env.NODE_ENV || 'development'}${' '.repeat(Math.max(0, 45 - (process.env.NODE_ENV || 'development').length))}║
║                                                           ║
║  Endpoints:                                               ║
║    GET  /health                                           ║
║    GET  /v1/me                                            ║
║    GET  /v1/agents                                        ║
║    POST /v1/agents                                        ║
║    GET  /v1/agents/:id                                    ║
║    PUT  /v1/agents/:id                                    ║
║    POST /v1/sessions                                      ║
║    GET  /v1/sessions/:id/transcript                       ║
║    POST /v1/sessions/:id/messages                         ║
║    POST /v1/sessions/:id/voice                            ║
║    GET  /v1/usage/rollup                                  ║
║    GET  /v1/usage/events                                  ║
║    GET  /v1/usage/monthly                                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\n${signal} received, shutting down gracefully...`);

        try {
          await fastify.close();
          await disconnectPrisma();
          console.log('Server closed successfully');
          process.exit(0);
        } catch (error) {
          console.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  start();
}

export { createServer, start };
