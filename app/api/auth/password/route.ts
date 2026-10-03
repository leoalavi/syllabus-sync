import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { jsonSuccess, jsonError, ERROR_CODES } from '@/app/api/_lib/response';
import { passwordResetLimiter } from '@/lib/services/rateLimitService';
import { parseJsonBody } from '@/app/api/_lib/middleware';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// SECURITY: Stronger password policy - min 12 chars
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(12, 'New password must be at least 12 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonError('Not authenticated', 401, ERROR_CODES.UNAUTHORIZED);
    }

    // SECURITY: Rate limit by user ID using distributed store (works in serverless)
    const { allowed, remaining, resetIn } = await passwordResetLimiter(user.id);
    if (!allowed) {
      return jsonError(
        `Too many password change attempts. Please try again in ${Math.ceil(resetIn / 60)} minutes.`,
        429,
        ERROR_CODES.RATE_LIMITED,
        { retryAfter: resetIn },
      );
    }

    // Parse and validate body - SECURITY: Parse with size limit protection
    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.success) {
      return jsonError(bodyResult.error, bodyResult.status, ERROR_CODES.VALIDATION_ERROR);
    }
    const parsed = passwordChangeSchema.safeParse(bodyResult.data);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return jsonError(
        firstError?.message || 'Invalid request data',
        400,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    // Verify current password by attempting to sign in
    // This is done server-side to avoid session side effects on the client
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });

    if (verifyError) {
      return jsonError('Current password is incorrect', 400, ERROR_CODES.BAD_REQUEST, {
        remainingAttempts: remaining,
      });
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      // SECURITY: Don't expose internal Supabase error messages to client
      logger.error('Password update failed:', updateError.message);
      return jsonError(
        'Failed to update password. Please try again.',
        400,
        ERROR_CODES.BAD_REQUEST,
      );
    }

    return jsonSuccess({
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Password change error:', error);
    return jsonError('Internal server error', 500, ERROR_CODES.INTERNAL_ERROR);
  }
}
