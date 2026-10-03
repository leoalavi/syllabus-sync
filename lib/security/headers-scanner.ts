/**
 * Security Headers Scanner
 *
 * SECURITY: This module provides security header scanning and validation capabilities.
 * It helps ensure that all endpoints have proper security headers configured.
 *
 * Implementation:
 * - Header validation
 * - Security scoring
 * - Recommendations for improvements
 * - Automated scanning
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { validateHeaderScanTarget } from '@/lib/security/scan-target';

// ============================================================================
// TYPES
// ============================================================================

export interface SecurityHeaderConfig {
  /** Header name */
  name: string;
  /** Expected value or pattern */
  expected: string | RegExp;
  /** Is this header critical? */
  critical: boolean;
  /** Description of what this header does */
  description: string;
  /** Recommendation if header is missing or invalid */
  recommendation: string;
}

export interface HeaderCheckResult {
  /** Header name */
  name: string;
  /** Is header present? */
  present: boolean;
  /** Is header value valid? */
  valid: boolean;
  /** Actual value (if present) */
  value?: string;
  /** Expected value */
  expected: string | RegExp;
  /** Is this header critical? */
  critical: boolean;
  /** Recommendation */
  recommendation: string;
}

export interface SecurityScanResult {
  /** Overall security score (0-100) */
  score: number;
  /** Security grade (A-F) */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Header check results */
  headers: HeaderCheckResult[];
  /** Critical issues found */
  criticalIssues: string[];
  /** Recommendations */
  recommendations: string[];
}

// ============================================================================
// SECURITY HEADER CONFIGURATIONS
// ============================================================================

const SECURITY_HEADERS: SecurityHeaderConfig[] = [
  {
    name: 'Content-Security-Policy',
    expected: /^default-src/,
    critical: true,
    description: 'Controls which resources the user agent is allowed to load',
    recommendation: 'Implement a strict Content Security Policy to prevent XSS attacks',
  },
  {
    name: 'X-Content-Type-Options',
    expected: 'nosniff',
    critical: true,
    description: 'Prevents MIME type sniffing',
    recommendation: 'Set X-Content-Type-Options to nosniff',
  },
  {
    name: 'X-Frame-Options',
    expected: /^(DENY|SAMEORIGIN)$/,
    critical: true,
    description: 'Prevents clickjacking attacks',
    recommendation: 'Set X-Frame-Options to DENY or SAMEORIGIN',
  },
  {
    name: 'X-XSS-Protection',
    expected: /^1; mode=block$/,
    critical: false,
    description: 'Enables XSS filtering in browsers',
    recommendation: 'Set X-XSS-Protection to 1; mode=block',
  },
  {
    name: 'Strict-Transport-Security',
    expected: /^max-age=\d+/,
    critical: true,
    description: 'Enforces HTTPS connections',
    recommendation: 'Set Strict-Transport-Security with max-age of at least 31536000 (1 year)',
  },
  {
    name: 'Referrer-Policy',
    expected: /^strict-origin-when-cross-origin$/,
    critical: false,
    description: 'Controls how much referrer information is sent',
    recommendation: 'Set Referrer-Policy to strict-origin-when-cross-origin',
  },
  {
    name: 'Permissions-Policy',
    expected: /^.+/,
    critical: false,
    description: 'Controls which browser features can be used',
    recommendation: 'Set Permissions-Policy to restrict sensitive features',
  },
  {
    name: 'Cross-Origin-Opener-Policy',
    expected: /^same-origin$/,
    critical: false,
    description: 'Controls cross-origin opener behavior',
    recommendation: 'Set Cross-Origin-Opener-Policy to same-origin',
  },
  {
    name: 'Cross-Origin-Resource-Policy',
    expected: /^same-origin$/,
    critical: false,
    description: 'Controls cross-origin resource loading',
    recommendation: 'Set Cross-Origin-Resource-Policy to same-origin',
  },
  {
    name: 'Cache-Control',
    expected: /^.+/,
    critical: false,
    description: 'Controls caching behavior',
    recommendation: 'Set appropriate Cache-Control headers for sensitive resources',
  },
  {
    name: 'X-DNS-Prefetch-Control',
    expected: /^off$/,
    critical: false,
    description: 'Controls DNS prefetching',
    recommendation: 'Set X-DNS-Prefetch-Control to off for privacy',
  },
  {
    name: 'X-Download-Options',
    expected: /^noopen$/,
    critical: false,
    description: 'Prevents automatic file opening in IE',
    recommendation: 'Set X-Download-Options to noopen',
  },
  {
    name: 'X-Permitted-Cross-Domain-Policies',
    expected: /^none$/,
    critical: false,
    description: 'Restricts cross-domain policy files',
    recommendation: 'Set X-Permitted-Cross-Domain-Policies to none',
  },
];

// ============================================================================
// HEADER VALIDATION
// ============================================================================

/**
 * Check a single security header
 *
 * @param headerName - The header name to check
 * @param headers - The headers object
 * @returns Header check result
 */
export function checkSecurityHeader(headerName: string, headers: Headers): HeaderCheckResult {
  const config = SECURITY_HEADERS.find((h) => h.name === headerName);

  if (!config) {
    throw new Error(`Unknown security header: ${headerName}`);
  }

  const value = headers.get(headerName);
  const present = value !== null;

  let valid = false;
  if (present) {
    if (config.expected instanceof RegExp) {
      valid = config.expected.test(value!);
    } else {
      valid = value === config.expected;
    }
  }

  return {
    name: headerName,
    present,
    valid,
    value: value || undefined,
    expected: config.expected,
    critical: config.critical,
    recommendation: config.recommendation,
  };
}

/**
 * Check all security headers
 *
 * @param headers - The headers object
 * @returns Array of header check results
 */
export function checkAllSecurityHeaders(headers: Headers): HeaderCheckResult[] {
  return SECURITY_HEADERS.map((config) => {
    const value = headers.get(config.name);
    const present = value !== null;

    let valid = false;
    if (present) {
      if (config.expected instanceof RegExp) {
        valid = config.expected.test(value!);
      } else {
        valid = value === config.expected;
      }
    }

    return {
      name: config.name,
      present,
      valid,
      value: value || undefined,
      expected: config.expected,
      critical: config.critical,
      recommendation: config.recommendation,
    };
  });
}

// ============================================================================
// SECURITY SCORING
// ============================================================================

/**
 * Calculate security score from header check results
 *
 * @param results - Array of header check results
 * @returns Security scan result
 */
export function calculateSecurityScore(results: HeaderCheckResult[]): SecurityScanResult {
  let score = 0;
  const criticalIssues: string[] = [];
  const recommendations: string[] = [];

  // Calculate score
  for (const result of results) {
    if (result.present && result.valid) {
      // Full points for present and valid
      score += result.critical ? 10 : 5;
    } else if (result.present && !result.valid) {
      // Partial points for present but invalid
      score += result.critical ? 3 : 2;
      recommendations.push(`${result.name}: ${result.recommendation}`);
    } else {
      // No points for missing
      recommendations.push(`${result.name}: ${result.recommendation}`);
    }

    // Track critical issues
    if (result.critical && (!result.present || !result.valid)) {
      criticalIssues.push(result.name);
    }
  }

  // Normalize score to 0-100
  const maxScore = SECURITY_HEADERS.reduce((sum, h) => sum + (h.critical ? 10 : 5), 0);
  const normalizedScore = Math.round((score / maxScore) * 100);

  // Determine grade
  const grade = getSecurityGrade(normalizedScore);

  return {
    score: normalizedScore,
    grade,
    headers: results,
    criticalIssues,
    recommendations,
  };
}

/**
 * Get security grade from score
 */
function getSecurityGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

// ============================================================================
// REQUEST/RESPONSE SCANNING
// ============================================================================

/**
 * Scan a Next.js response for security headers
 *
 * @param response - The Next.js response to scan
 * @returns Security scan result
 */
export function scanResponseHeaders(response: NextResponse): SecurityScanResult {
  const results = checkAllSecurityHeaders(response.headers);
  return calculateSecurityScore(results);
}

/**
 * Scan a Next.js request for security headers
 *
 * @param request - The Next.js request to scan
 * @returns Security scan result
 */
export function scanRequestHeaders(request: NextRequest): SecurityScanResult {
  const results = checkAllSecurityHeaders(request.headers);
  return calculateSecurityScore(results);
}

// ============================================================================
// URL SCANNING
// ============================================================================

/**
 * Scan a URL for security headers
 *
 * @param url - The URL to scan
 * @returns Promise resolving to security scan result
 */
export async function scanURLHeaders(url: string): Promise<SecurityScanResult> {
  const target = validateHeaderScanTarget(url);
  if (!target.valid) {
    return {
      score: 0,
      grade: 'F',
      headers: [],
      criticalIssues: [target.message],
      recommendations: ['Use an approved Syllabus Sync site origin'],
    };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(target.url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
    });

    const results = checkAllSecurityHeaders(response.headers);
    return calculateSecurityScore(results);
  } catch (error) {
    logger.error('URL scan error:', error);
    return {
      score: 0,
      grade: 'F',
      headers: [],
      criticalIssues: ['Failed to scan URL'],
      recommendations: ['Check if URL is accessible'],
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// AUTOMATED SCANNING
// ============================================================================

/**
 * Scan multiple URLs for security headers
 *
 * @param urls - Array of URLs to scan
 * @returns Promise resolving to array of scan results
 */
export async function scanMultipleURLs(
  urls: string[],
): Promise<{ url: string; result: SecurityScanResult }[]> {
  const results = await Promise.all(
    urls.map(async (url) => ({
      url,
      result: await scanURLHeaders(url),
    })),
  );

  return results;
}

/**
 * Generate a security report from scan results
 *
 * @param result - Security scan result
 * @param url - Optional URL that was scanned
 * @returns Formatted security report
 */
export function generateSecurityReport(result: SecurityScanResult, url?: string): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('SECURITY HEADERS SCAN REPORT');
  lines.push('='.repeat(60));
  lines.push('');

  if (url) {
    lines.push(`URL: ${url}`);
    lines.push('');
  }

  lines.push(`Overall Score: ${result.score}/100`);
  lines.push(`Security Grade: ${result.grade}`);
  lines.push('');

  lines.push('-'.repeat(60));
  lines.push('HEADER CHECKS');
  lines.push('-'.repeat(60));
  lines.push('');

  for (const header of result.headers) {
    const status = header.valid ? '✓' : '✗';
    const critical = header.critical ? ' [CRITICAL]' : '';
    lines.push(`${status} ${header.name}${critical}`);

    if (header.value) {
      lines.push(`  Value: ${header.value}`);
    } else {
      lines.push(`  Status: MISSING`);
    }

    if (!header.valid) {
      lines.push(`  Recommendation: ${header.recommendation}`);
    }

    lines.push('');
  }

  if (result.criticalIssues.length > 0) {
    lines.push('-'.repeat(60));
    lines.push('CRITICAL ISSUES');
    lines.push('-'.repeat(60));
    lines.push('');

    for (const issue of result.criticalIssues) {
      lines.push(`✗ ${issue}`);
    }

    lines.push('');
  }

  if (result.recommendations.length > 0) {
    lines.push('-'.repeat(60));
    lines.push('RECOMMENDATIONS');
    lines.push('-'.repeat(60));
    lines.push('');

    for (const rec of result.recommendations) {
      lines.push(`• ${rec}`);
    }

    lines.push('');
  }

  lines.push('='.repeat(60));

  return lines.join('\n');
}

// ============================================================================
// API INTEGRATION
// ============================================================================

/**
 * API route handler for security header scanning
 * Use this in /api/security/scan-headers
 */
export async function handleHeaderScan(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return Response.json(
        { error: { code: 'MISSING_URL', message: 'URL is required' } },
        { status: 400 },
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return Response.json(
        { error: { code: 'INVALID_URL', message: 'Invalid URL format' } },
        { status: 400 },
      );
    }

    // Scan URL
    const result = await scanURLHeaders(url);

    return Response.json({
      result,
      report: generateSecurityReport(result, url),
    });
  } catch (error) {
    logger.error('Header scan error:', error);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to scan headers' } },
      { status: 500 },
    );
  }
}

/**
 * API route handler for scanning current application
 * Use this in /api/security/scan-self
 */
export async function handleSelfScan(request: Request): Promise<Response> {
  try {
    // Get base URL from request
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    // Scan base URL
    const result = await scanURLHeaders(baseUrl);

    return Response.json({
      result,
      report: generateSecurityReport(result, baseUrl),
    });
  } catch (error) {
    logger.error('Self scan error:', error);
    return Response.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to scan application',
        },
      },
      { status: 500 },
    );
  }
}
