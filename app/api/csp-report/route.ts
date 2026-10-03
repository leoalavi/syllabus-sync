/**
 * CSP (Content Security Policy) Report Endpoint
 *
 * SECURITY: This endpoint receives CSP violation reports from browsers.
 * It logs violations for monitoring without exposing sensitive information.
 *
 * Configure via environment variables:
 * - CSP_REPORT_URI=/api/csp-report (this endpoint)
 * - CSP_REPORT_TO=csp-endpoint (Reporting API group name)
 *
 * Reports are sent by browsers when a CSP violation occurs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, ERROR_CODES, parseJsonBody } from '@/app/api/_lib/response';
import { getClientIP } from '@/lib/security/ip';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

interface CSPReport {
  'document-uri'?: string;
  referrer?: string;
  'blocked-uri': string;
  'violated-directive': string;
  'original-policy'?: string;
  disposition: 'enforce' | 'report';
  'effective-directive'?: string;
  'line-number'?: number;
  'column-number'?: number;
  'source-file'?: string;
  'script-sample'?: string;
  'status-code'?: number;
}

interface CSPReportBody {
  'csp-report': CSPReport;
}

const CspReportSchema = z.object({
  'csp-report': z.object({
    'blocked-uri': z.string().max(2048),
    'violated-directive': z.string().max(2048),
    'effective-directive': z.string().max(2048).optional(),
    disposition: z.enum(['enforce', 'report']),
    'line-number': z.number().int().nonnegative().optional(),
    'column-number': z.number().int().nonnegative().optional(),
  }),
});

// ============================================================================
// RATE LIMITING
// ============================================================================

// Simple in-memory rate limiting (use Redis in production)
const reportCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // Max 10 reports per IP per minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (reportCounts.size >= 2000) {
    for (const [key, value] of reportCounts) {
      if (value.resetTime < now) reportCounts.delete(key);
    }
    if (reportCounts.size >= 2000 && !reportCounts.has(ip)) return true;
  }
  const entry = reportCounts.get(ip);

  if (!entry || entry.resetTime < now) {
    reportCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count++;
  return false;
}

// ============================================================================
// REPORT PROCESSING
// ============================================================================

/**
 * Sanitize CSP report to remove sensitive information
 */
function sanitizeReport(report: CSPReport): Partial<CSPReport> {
  return {
    'blocked-uri': sanitizeUri(report['blocked-uri']),
    'violated-directive': report['violated-directive'],
    'effective-directive': report['effective-directive'],
    disposition: report.disposition,
    'line-number': report['line-number'],
    'column-number': report['column-number'],
    // Don't include document-uri or referrer to avoid logging sensitive URLs
    // Don't include original-policy to avoid cluttering logs
  };
}

/**
 * Sanitize URI to prevent log injection
 */
function sanitizeUri(uri: string): string {
  if (!uri) return 'empty';

  // Truncate long URIs
  const maxLength = 200;
  let sanitized = uri.length > maxLength ? `${uri.substring(0, maxLength)}...` : uri;

  // Remove newlines and control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  return sanitized;
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);

  // Rate limiting
  if (isRateLimited(clientIP)) {
    return jsonError('Rate limit exceeded', 429, ERROR_CODES.RATE_LIMITED);
  }

  try {
    const { data, error } = await parseJsonBody<CSPReportBody>(request, 8 * 1024);
    if (error) return error;
    const parsed = CspReportSchema.safeParse(data);
    if (!parsed.success) {
      return jsonError('Invalid CSP report format', 400, ERROR_CODES.BAD_REQUEST);
    }
    const report = parsed.data['csp-report'] as CSPReport;

    // Sanitize and log the report
    const sanitizedReport = sanitizeReport(report);

    // Log based on severity
    const isEnforced = report.disposition === 'enforce';

    if (isEnforced) {
      logger.error('CSP Violation Report:', {
        ...sanitizedReport,
        timestamp: new Date().toISOString(),
        ip: `${clientIP.substring(0, 7)}***`, // Partial IP for privacy
      });
    } else {
      console.warn('CSP Violation Report:', {
        ...sanitizedReport,
        timestamp: new Date().toISOString(),
        ip: `${clientIP.substring(0, 7)}***`, // Partial IP for privacy
      });
    }

    // Send to external monitoring service if configured
    if (process.env.CSP_REPORT_WEBHOOK) {
      try {
        await fetch(process.env.CSP_REPORT_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'csp-violation',
            severity: isEnforced ? 'high' : 'low',
            ...sanitizedReport,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (webhookError) {
        logger.error('Failed to send CSP report to webhook:', webhookError);
      }
    }

    // Return 204 No Content (browsers don't need a response body)
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error('CSP report processing error:', error);
    return jsonError('Failed to process report', 400, ERROR_CODES.BAD_REQUEST);
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
