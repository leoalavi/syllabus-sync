import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonSuccess, jsonError, ERROR_CODES } from '@/app/api/_lib/response';
import { logger } from '@/lib/logger';
import { matchesBearerToken } from '@/lib/security/constant-time';

/**
 * Cron endpoint: deletes expired/used verification tokens.
 *
 * Supports:
 * - GET (Vercel Cron — sends GET with Authorization: Bearer <CRON_SECRET>)
 * - POST (manual/external cron services)
 *
 * Protected by CRON_SECRET environment variable.
 */
async function handleCleanup(request: NextRequest) {
  // 1. Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!matchesBearerToken(authHeader, cronSecret)) {
    return jsonError('Unauthorized', 401, ERROR_CODES.UNAUTHORIZED);
  }

  try {
    const adminClient = createAdminClient();
    if (!adminClient) {
      return jsonError('Not configured', 503, ERROR_CODES.EXTERNAL_SERVICE_ERROR);
    }

    // 2. Call the SQL cleanup function
    const { data, error } = await adminClient.rpc('cleanup_expired_email_verifications');

    if (error) {
      logger.error('Email verification cleanup failed', {
        error: error.message,
      });
      return jsonError('Cleanup failed', 500, ERROR_CODES.INTERNAL_ERROR);
    }

    const deletedCount = typeof data === 'number' ? data : 0;
    logger.info('Email verification cleanup completed', { deletedCount });

    return jsonSuccess({ deletedCount });
  } catch (error) {
    logger.error('Cleanup error:', error);
    return jsonError('Cleanup failed', 500, ERROR_CODES.INTERNAL_ERROR);
  }
}

export const GET = handleCleanup;
export const POST = handleCleanup;
