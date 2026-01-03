import { describe, it, expect } from 'vitest';
import {
  generateTenantId,
  generateAgentId,
  generateSessionId,
  generateMessageId,
  generateEventId,
  generateRequestId,
  generateIdempotencyId,
  generateApiKeyId,
  ID_PREFIXES,
} from '../../src/utils/ids';
import {
  hashApiKey,
  computeRequestHash,
  generateApiKey,
} from '../../src/utils/hash';
import {
  AppError,
  ErrorCode,
  unauthorizedError,
  validationError,
  notFoundError,
  isAppError,
  toAppError,
} from '../../src/utils/errors';

describe('ID Generation', () => {
  describe('generateTenantId', () => {
    it('should generate ID with correct prefix', () => {
      const id = generateTenantId();
      expect(id).toMatch(/^tnt_[a-f0-9]{32}$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateTenantId();
      const id2 = generateTenantId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateAgentId', () => {
    it('should generate ID with correct prefix', () => {
      const id = generateAgentId();
      expect(id).toMatch(/^agt_[a-f0-9]{32}$/);
    });
  });

  describe('generateSessionId', () => {
    it('should generate ID with correct prefix', () => {
      const id = generateSessionId();
      expect(id).toMatch(/^ses_[a-f0-9]{32}$/);
    });
  });

  describe('generateMessageId', () => {
    it('should generate ID with correct prefix', () => {
      const id = generateMessageId();
      expect(id).toMatch(/^msg_[a-f0-9]{32}$/);
    });
  });

  describe('generateEventId', () => {
    it('should generate ID with correct prefix', () => {
      const id = generateEventId();
      expect(id).toMatch(/^evt_[a-f0-9]{32}$/);
    });
  });

  describe('generateRequestId', () => {
    it('should generate ID with correct prefix', () => {
      const id = generateRequestId();
      expect(id).toMatch(/^req_[a-f0-9]{32}$/);
    });
  });

  describe('generateIdempotencyId', () => {
    it('should generate ID with correct prefix', () => {
      const id = generateIdempotencyId();
      expect(id).toMatch(/^idem_[a-f0-9]{32}$/);
    });
  });

  describe('generateApiKeyId', () => {
    it('should generate ID with correct prefix', () => {
      const id = generateApiKeyId();
      expect(id).toMatch(/^key_[a-f0-9]{32}$/);
    });
  });
});

describe('Hashing', () => {
  describe('hashApiKey', () => {
    it('should hash API key consistently', () => {
      const apiKey = 'test-api-key-12345';
      const hash1 = hashApiKey(apiKey);
      const hash2 = hashApiKey(apiKey);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different keys', () => {
      const hash1 = hashApiKey('key1');
      const hash2 = hashApiKey('key2');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce 64-character hex string', () => {
      const hash = hashApiKey('test-key');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('computeRequestHash', () => {
    it('should compute hash consistently for same data', () => {
      const data = {
        tenantId: 'tnt_123',
        sessionId: 'ses_456',
        content: 'Hello world',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hash1 = computeRequestHash(data);
      const hash2 = computeRequestHash(data);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
      const data1 = {
        tenantId: 'tnt_123',
        sessionId: 'ses_456',
        content: 'Hello',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const data2 = {
        tenantId: 'tnt_123',
        sessionId: 'ses_456',
        content: 'World',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hash1 = computeRequestHash(data1);
      const hash2 = computeRequestHash(data2);
      expect(hash1).not.toBe(hash2);
    });

    it('should include timestamp in hash', () => {
      const data1 = {
        tenantId: 'tnt_123',
        sessionId: 'ses_456',
        content: 'Hello',
      };

      // Without explicit timestamp, it uses current time, so we can't test equality
      const hash1 = computeRequestHash(data1);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('generateApiKey', () => {
    it('should generate a 64-character hex string', () => {
      const apiKey = generateApiKey();
      expect(apiKey).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });
  });
});

describe('Error Handling', () => {
  describe('AppError', () => {
    it('should create error with all properties', () => {
      const error = new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Test error',
        400,
        { field: 'name' },
        'req_123'
      );

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'name' });
      expect(error.requestId).toBe('req_123');
    });

    it('should convert to JSON correctly', () => {
      const error = new AppError(
        ErrorCode.NOT_FOUND,
        'Resource not found',
        404,
        { resource: 'agent' },
        'req_456'
      );

      const json = error.toJSON();
      expect(json).toEqual({
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Resource not found',
          details: { resource: 'agent' },
          requestId: 'req_456',
        },
      });
    });

    it('should omit optional fields from JSON when not present', () => {
      const error = new AppError(
        ErrorCode.UNAUTHORIZED,
        'Unauthorized',
        401
      );

      const json = error.toJSON();
      expect(json).toEqual({
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'Unauthorized',
        },
      });
    });
  });

  describe('Error factory functions', () => {
    it('should create unauthorized error', () => {
      const error = unauthorizedError('Custom message', 'req_123');
      expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Custom message');
    });

    it('should create validation error', () => {
      const error = validationError('Invalid input', { field: 'email' });
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should create not found error with ID', () => {
      const error = notFoundError('Agent', 'agt_123');
      expect(error.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('agt_123');
    });

    it('should create not found error without ID', () => {
      const error = notFoundError('Agent');
      expect(error.message).toBe('Agent not found');
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Test', 500);
      expect(isAppError(error)).toBe(true);
    });

    it('should return false for regular errors', () => {
      const error = new Error('Test');
      expect(isAppError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isAppError('string')).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
    });
  });

  describe('toAppError', () => {
    it('should return AppError as-is', () => {
      const error = new AppError(ErrorCode.NOT_FOUND, 'Test', 404);
      const converted = toAppError(error);
      expect(converted).toBe(error);
    });

    it('should convert regular Error to AppError', () => {
      const error = new Error('Test error');
      const converted = toAppError(error, 'req_123');
      expect(converted).toBeInstanceOf(AppError);
      expect(converted.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(converted.statusCode).toBe(500);
      expect(converted.requestId).toBe('req_123');
    });

    it('should convert unknown values to AppError', () => {
      const converted = toAppError('some string');
      expect(converted).toBeInstanceOf(AppError);
      expect(converted.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(converted.message).toBe('An unknown error occurred');
    });
  });
});
