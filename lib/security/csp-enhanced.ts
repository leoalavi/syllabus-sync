/**
 * STATUS: not wired into any route as of 17 Nov 2026.
 *
 * Nothing imports this module except the barrel `lib/security/index.ts`, and
 * nothing imports that barrel. It is design work, not a control in force, and
 * must not be listed as implemented. The CSP in force is built by `buildNonceCSP` in `./csp.ts`.
 */

/**
 * Enhanced CSP (Content Security Policy) Configuration
 *
 * SECURITY: This module defines the CSP configuration with hash-based script validation
 * and enhanced reporting capabilities.
 *
 * Features:
 * - Hash-based script validation (no unsafe-inline)
 * - CSP violation reporting with detailed logging
 * - Report-Only mode for testing
 * - Environment-specific policies
 */

import { NextResponse } from 'next/server';

// ============================================================================
// SCRIPT DEFINITIONS (keep in sync with app/layout.tsx)
// ============================================================================

/**
 * Theme initialization script - prevents flash of wrong theme
 * IMPORTANT: If you modify this script, you must regenerate the hash!
 *
 * To regenerate: Run the script content through SHA-256 and base64 encode:
 * echo -n '<script content>' | openssl dgst -sha256 -binary | base64
 */
export const THEME_SCRIPT = `(function(){try{var stored=localStorage.getItem('theme-storage');var theme='system';if(stored){var parsed=JSON.parse(stored);theme=parsed.state?.theme||'system'}var resolved=theme;if(theme==='system'){resolved=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.classList.add(resolved);document.documentElement.style.colorScheme=resolved}catch(e){}})();`;

/**
 * RTL direction script - sets correct text direction based on language
 * IMPORTANT: If you modify this script, you must regenerate the hash!
 */
export const RTL_SCRIPT = `(function(){try{var stored=localStorage.getItem('language-storage');if(stored){var parsed=JSON.parse(stored);var lang=parsed.state?.language||'en';var rtlLanguages=['fa','ar','ur','he'];if(rtlLanguages.includes(lang)){document.documentElement.dir='rtl';document.documentElement.lang=lang}else{document.documentElement.dir='ltr';document.documentElement.lang=lang}}}catch(e){}})();`;

// ============================================================================
// CSP HASHES
// ============================================================================

/**
 * Pre-computed SHA-256 hashes for inline scripts
 * These MUST be updated if the scripts above are modified!
 *
 * Generate with: echo -n '<script>' | openssl dgst -sha256 -binary | base64
 */
export const CSP_SCRIPT_HASHES = {
  theme: 'sha256-euA/nX7OMJt6hghOJ/qTKFU59who5Fhoj7IWVSgwBss=',
  rtl: 'sha256-7IUh1B8MYhdIeSKtKih/ERxZm0rfT5jNWzQqe73/yeY=',
};

// ============================================================================
// CSP BUILDER
// ============================================================================

export interface CSPOptions {
  /** Include upgrade-insecure-requests directive */
  upgradeInsecure?: boolean;
  /** Additional script sources to allow */
  additionalScriptSrc?: string[];
  /** Additional connect sources to allow */
  additionalConnectSrc?: string[];
  /** Additional style sources to allow */
  additionalStyleSrc?: string[];
  /** Additional image sources to allow */
  additionalImgSrc?: string[];
  /** Additional font sources to allow */
  additionalFontSrc?: string[];
  /** Report URI for CSP violations (legacy, use reportTo) */
  reportUri?: string;
  /** Report-To directive for CSP violations (modern browsers) */
  reportTo?: string;
  /** Enable report-only mode (violations logged but not enforced) */
  reportOnly?: boolean;
  /** Enable strict mode (more restrictive) */
  strict?: boolean;
}

/**
 * Build a Content Security Policy header value
 *
 * SECURITY: CSP reporting helps detect and prevent XSS attacks by monitoring
 * policy violations. Configure CSP_REPORT_URI or CSP_REPORT_TO env vars.
 */
export function buildCSP(options: CSPOptions = {}): string {
  const {
    upgradeInsecure = process.env.NODE_ENV === 'production',
    additionalScriptSrc = [],
    additionalConnectSrc = [],
    additionalStyleSrc = [],
    additionalImgSrc = [],
    additionalFontSrc = [],
    reportUri = process.env.CSP_REPORT_URI || '/api/csp-report',
    reportTo = process.env.CSP_REPORT_TO || 'csp-endpoint',
    strict = process.env.NODE_ENV === 'production',
  } = options;

  // Build script-src with hashes
  const scriptHashes = Object.values(CSP_SCRIPT_HASHES).map((h) => `'${h}'`);
  const scriptSrc = ["'self'", ...scriptHashes, ...additionalScriptSrc].join(' ');

  // Build style-src
  const styleSrc = [
    "'self'",
    "'unsafe-inline'", // Required for Tailwind/CSS-in-JS
    ...additionalStyleSrc,
  ].join(' ');

  // Build img-src
  const imgSrc = ["'self'", 'data:', 'blob:', 'https:', ...additionalImgSrc].join(' ');

  // Build font-src
  const fontSrc = ["'self'", 'data:', ...additionalFontSrc].join(' ');

  // Build connect-src
  const connectSrc = [
    "'self'",
    'https://*.supabase.co',
    'https://*.openrouteservice.org',
    'https://api.heigit.org',
    'https://weather.googleapis.com',
    'wss://*.supabase.co',
    ...additionalConnectSrc,
  ].join(' ');

  const directives = [
    // Default fallback
    "default-src 'self'",

    // Scripts: self + hash-validated inline scripts (NO unsafe-inline!)
    `script-src ${scriptSrc}`,

    // Styles: self + unsafe-inline (required for Tailwind/CSS-in-JS)
    // Note: Styles are less dangerous than scripts for XSS
    `style-src ${styleSrc}`,

    // Images: Allow self, data URIs, blobs, and HTTPS
    `img-src ${imgSrc}`,

    // Fonts: self and data URIs
    `font-src ${fontSrc}`,

    // Connect: API endpoints, Supabase, routing services
    `connect-src ${connectSrc}`,

    // Frame ancestors: Prevent clickjacking
    "frame-ancestors 'self'",

    // Base URI: Restrict base tag
    "base-uri 'self'",

    // Form actions: Where forms can submit
    "form-action 'self'",

    // Object sources: Disable plugins
    "object-src 'none'",

    // Frame sources: Restrict iframes
    strict ? "frame-src 'self'" : "frame-src 'self' https://www.google.com",

    // Worker sources: Restrict web workers
    "worker-src 'self' blob:",

    // Manifest sources: Restrict web app manifests
    "manifest-src 'self'",

    // Upgrade insecure in production
    ...(upgradeInsecure ? ['upgrade-insecure-requests'] : []),

    // Report-To directive (modern browsers, preferred over report-uri)
    ...(reportTo ? [`report-to ${reportTo}`] : []),

    // Report URI if configured (legacy, but still supported)
    ...(reportUri ? [`report-uri ${reportUri}`] : []),
  ];

  return directives.join('; ');
}

/**
 * Build CSP header for development (more permissive)
 * NOTE: Next.js injects many inline scripts for hydration and routing that
 * cannot be pre-hashed. In development, we use unsafe-inline WITHOUT hashes
 * because browsers ignore unsafe-inline when hashes are present.
 */
export function buildDevCSP(): string {
  // In development, skip hash-based validation entirely
  // because unsafe-inline is ignored when hashes are present
  const directives = [
    "default-src 'self'",
    // Scripts: Allow inline and eval for HMR, hydration, Turbopack
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    // Styles: Allow inline for Tailwind/CSS-in-JS
    "style-src 'self' 'unsafe-inline'",
    // Images
    "img-src 'self' data: blob: https:",
    // Fonts
    "font-src 'self' data:",
    // Connect: API endpoints, Supabase, HMR websockets
    "connect-src 'self' https://*.supabase.co https://*.openrouteservice.org https://api.heigit.org https://weather.googleapis.com wss://*.supabase.co ws://localhost:* ws://127.0.0.1:*",
    // Frame ancestors
    "frame-ancestors 'self'",
    // Base URI
    "base-uri 'self'",
    // Form actions
    "form-action 'self'",
    // Object sources
    "object-src 'none'",
    // Frame sources
    "frame-src 'self' https://www.google.com",
    // Worker sources
    "worker-src 'self' blob:",
    // Manifest sources
    "manifest-src 'self'",
  ];

  return directives.join('; ');
}

/**
 * Build CSP header for production (strict)
 */
export function buildProdCSP(): string {
  return buildCSP({
    upgradeInsecure: true,
    strict: true,
  });
}

/**
 * Build CSP header for report-only mode (testing)
 */
export function buildReportOnlyCSP(): string {
  return buildCSP({
    reportOnly: true,
  });
}

/**
 * Get appropriate CSP based on environment
 */
export function getCSP(options?: CSPOptions): string {
  if (options?.reportOnly) {
    return buildReportOnlyCSP();
  }
  return process.env.NODE_ENV === 'production' ? buildProdCSP() : buildDevCSP();
}

// ============================================================================
// CSP MIDDLEWARE
// ============================================================================

/**
 * Apply CSP headers to response
 * Use this in middleware or API routes
 */
export function applyCSPHeaders(response: NextResponse, options?: CSPOptions): NextResponse {
  const csp = getCSP(options);
  response.headers.set('Content-Security-Policy', csp);

  // Add Reporting-Endpoints header for modern browsers
  if (options?.reportTo) {
    response.headers.set('Reporting-Endpoints', `csp-endpoint="${options.reportTo}"`);
  }

  return response;
}

/**
 * Apply CSP headers with report-only mode
 * Use this for testing new CSP policies without blocking resources
 */
export function applyCSPReportOnlyHeaders(
  response: NextResponse,
  options?: CSPOptions,
): NextResponse {
  const csp = buildReportOnlyCSP();
  response.headers.set('Content-Security-Policy-Report-Only', csp);

  // Add Reporting-Endpoints header for modern browsers
  if (options?.reportTo) {
    response.headers.set('Reporting-Endpoints', `csp-endpoint="${options.reportTo}"`);
  }

  return response;
}

// ============================================================================
// CSP REPORTING CONFIGURATION
// ============================================================================

/**
 * CSP violation report interface
 */
export interface CSPViolationReport {
  'csp-report': {
    'document-uri': string;
    referrer: string;
    'blocked-uri': string;
    'violated-directive': string;
    'effective-directive': string;
    'original-policy': string;
    disposition: 'enforce' | 'report';
    'line-number'?: number;
    'column-number'?: number;
    'source-file'?: string;
    'status-code'?: number;
  };
}

/**
 * Severity levels for CSP violations
 */
export type CSPSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Determine severity of CSP violation
 */
export function getCSPViolationSeverity(report: CSPViolationReport['csp-report']): CSPSeverity {
  const { 'violated-directive': violatedDirective, disposition } = report;

  // Critical: Script violations in enforce mode
  if (
    disposition === 'enforce' &&
    (violatedDirective === 'script-src' ||
      violatedDirective === 'script-src-elem' ||
      violatedDirective === 'script-src-attr')
  ) {
    return 'critical';
  }

  // High: Object-src, frame-src violations in enforce mode
  if (
    disposition === 'enforce' &&
    (violatedDirective === 'object-src' ||
      violatedDirective === 'frame-src' ||
      violatedDirective === 'worker-src')
  ) {
    return 'high';
  }

  // Medium: Other violations in enforce mode
  if (disposition === 'enforce') {
    return 'medium';
  }

  // Low: Report-only mode violations
  return 'low';
}

/**
 * Sanitize CSP report for logging
 * Removes sensitive information like full URLs
 */
export function sanitizeCSPReport(
  report: CSPViolationReport['csp-report'],
): Partial<CSPViolationReport['csp-report']> {
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
