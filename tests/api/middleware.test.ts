/**
 * API Middleware Tests
 *
 * Tests for authentication, rate limiting, and validation middleware
 */

import { describe, it, expect } from 'vitest';
import { parseJsonBody } from '@/app/api/_lib/middleware';

describe('API Middleware', () => {
  describe('parseJsonBody', () => {
    it('should parse valid JSON body', async () => {
      const body = JSON.stringify({ name: 'Test', value: 123 });
      const request = new Request('http://localhost/api/test', {
        method: 'POST',
        body,
        headers: { 'Content-Length': body.length.toString() },
      });

      const result = await parseJsonBody(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: 'Test', value: 123 });
      }
    });

    it('should reject body exceeding size limit', async () => {
      const largeBody = JSON.stringify({ data: 'x'.repeat(200 * 1024) }); // 200KB
      const request = new Request('http://localhost/api/test', {
        method: 'POST',
        body: largeBody,
        headers: { 'Content-Length': largeBody.length.toString() },
      });

      const result = await parseJsonBody(request, 100 * 1024); // 100KB limit
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('too large');
        expect(result.status).toBe(413);
      }
    });

    it('should handle invalid JSON', async () => {
      const request = new Request('http://localhost/api/test', {
        method: 'POST',
        body: 'not valid json {',
      });

      const result = await parseJsonBody(request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid JSON');
        expect(result.status).toBe(400);
      }
    });

    it('should handle empty body', async () => {
      const request = new Request('http://localhost/api/test', {
        method: 'POST',
        body: '',
      });

      const result = await parseJsonBody(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });

    it('should use custom size limit', async () => {
      const body = JSON.stringify({ data: 'x'.repeat(5000) }); // ~5KB
      const request = new Request('http://localhost/api/test', {
        method: 'POST',
        body,
        headers: { 'Content-Length': body.length.toString() },
      });

      // Should fail with 1KB limit
      const result1KB = await parseJsonBody(request.clone(), 1024);
      expect(result1KB.success).toBe(false);
    });
  });
});
