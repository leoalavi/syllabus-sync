/**
 * Audit Logs API Endpoint
 *
 * SECURITY: This endpoint provides access to audit logs for the current user.
 * Only authenticated users can access their own audit logs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { jsonError, parseJsonBody, BODY_SIZE_LIMITS, ERROR_CODES } from '@/app/api/_lib/response';
import { requireAuth } from '@/app/api/_lib/middleware';
import { getClientIP } from '@/lib/security/ip';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  action: z
    .enum([
      'CREATE',
      'READ',
      'UPDATE',
      'DELETE',
      'LOGIN',
      'LOGOUT',
      'PASSWORD_CHANGE',
      'PASSWORD_RESET',
      'EMAIL_CHANGE',
      'MFA_ENABLE',
      'MFA_DISABLE',
      'MFA_BACKUP_CODE_USED',
      'API_KEY_CREATE',
      'API_KEY_REVOKE',
      'SETTINGS_CHANGE',
      'EXPORT',
      'IMPORT',
      'SESSION_TERMINATED',
      'SECURITY_EVENT',
      'RATE_LIMIT_EXCEEDED',
      'IP_ANOMALY_DETECTED',
      'DEVICE_FINGERPRINT_CHANGED',
      'SUSPICIOUS_ACTIVITY',
    ])
    .optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  startDate: z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid startDate format')
    .optional(),
  endDate: z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid endDate format')
    .optional(),
});

// ============================================================================
// GET HANDLER - Fetch audit logs
// ============================================================================

export async function GET(request: NextRequest) {
  return requireAuth(request, async (userId: string) => {
    try {
      const supabase = await createServerClient();
      const searchParams = request.nextUrl.searchParams;
      const parsedQuery = auditQuerySchema.safeParse({
        limit: searchParams.get('limit') ?? undefined,
        offset: searchParams.get('offset') ?? undefined,
        action: searchParams.get('action') ?? undefined,
        severity: searchParams.get('severity') ?? undefined,
        startDate: searchParams.get('startDate') ?? undefined,
        endDate: searchParams.get('endDate') ?? undefined,
      });

      if (!parsedQuery.success) {
        return jsonError('Invalid audit query parameters', 400, ERROR_CODES.BAD_REQUEST, {
          issues: parsedQuery.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      const { limit, offset, action, severity, startDate, endDate } = parsedQuery.data;
      const parsedStartDate = startDate ? new Date(startDate) : undefined;
      const parsedEndDate = endDate ? new Date(endDate) : undefined;

      // Fetch audit logs
      const { data: logs, error } = await supabase.rpc('get_my_audit_logs', {
        p_limit: limit,
        p_offset: offset,
        p_action: action || null,
        p_severity: severity || null,
        p_start_date: parsedStartDate?.toISOString() || null,
        p_end_date: parsedEndDate?.toISOString() || null,
      });

      if (error) {
        logger.error('Failed to fetch audit logs:', error);
        return jsonError('Failed to fetch audit logs', 500, ERROR_CODES.INTERNAL_ERROR);
      }

      // Get total count
      const { count, error: countError } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
        logger.error('Failed to count audit logs:', countError);
      }

      return NextResponse.json({
        logs,
        pagination: {
          limit,
          offset,
          total: count || 0,
          hasMore: offset + limit < (count || 0),
        },
      });
    } catch (error) {
      logger.error('Audit logs API error:', error);
      return jsonError('Failed to process request', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}

// ============================================================================
// POST HANDLER - Log custom audit event
// ============================================================================

export async function POST(request: NextRequest) {
  return requireAuth(request, async (userId: string) => {
    try {
      // SECURITY: Use parseJsonBody with size limit instead of raw request.json()
      const { data: body, error: bodyError } = await parseJsonBody(
        request,
        BODY_SIZE_LIMITS.DEFAULT,
      );
      if (bodyError) return bodyError;
      const { action, tableName, recordId, oldData, newData, severity, metadata } = body as Record<
        string,
        unknown
      >;

      // Validate required fields
      if (!action) {
        return jsonError('Action is required', 400, ERROR_CODES.BAD_REQUEST);
      }

      // Validate action
      const validActions = [
        'CREATE',
        'READ',
        'UPDATE',
        'DELETE',
        'LOGIN',
        'LOGOUT',
        'PASSWORD_CHANGE',
        'PASSWORD_RESET',
        'EMAIL_CHANGE',
        'MFA_ENABLE',
        'MFA_DISABLE',
        'MFA_BACKUP_CODE_USED',
        'API_KEY_CREATE',
        'API_KEY_REVOKE',
        'SETTINGS_CHANGE',
        'EXPORT',
        'IMPORT',
        'SESSION_TERMINATED',
        'SECURITY_EVENT',
        'RATE_LIMIT_EXCEEDED',
        'IP_ANOMALY_DETECTED',
        'DEVICE_FINGERPRINT_CHANGED',
        'SUSPICIOUS_ACTIVITY',
      ];

      if (!validActions.includes(action as string)) {
        return jsonError('Invalid action', 400, ERROR_CODES.BAD_REQUEST);
      }

      // Validate severity
      const validSeverities = ['info', 'warning', 'critical'];
      const finalSeverity = (severity as string) || 'info';
      if (!validSeverities.includes(finalSeverity)) {
        return jsonError('Invalid severity', 400, ERROR_CODES.BAD_REQUEST);
      }

      const supabase = await createServerClient();
      const ip = getClientIP(request);
      const userAgent = request.headers.get('user-agent') || undefined;

      // Log audit event
      const { data: logId, error } = await supabase.rpc('log_audit', {
        p_user_id: userId,
        p_action: action,
        p_table_name: tableName || null,
        p_record_id: recordId || null,
        p_old_data: oldData ? JSON.stringify(oldData) : null,
        p_new_data: newData ? JSON.stringify(newData) : null,
        p_severity: finalSeverity,
        p_ip_address: ip,
        p_user_agent: userAgent,
        p_metadata: metadata ? JSON.stringify(metadata) : '{}',
      });

      if (error) {
        logger.error('Failed to log audit event:', error);
        return jsonError('Failed to log audit event', 500, ERROR_CODES.INTERNAL_ERROR);
      }

      return NextResponse.json({
        success: true,
        logId,
      });
    } catch (error) {
      logger.error('Audit log API error:', error);
      return jsonError('Failed to process request', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}
