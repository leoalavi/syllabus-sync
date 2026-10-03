import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  jsonSuccess,
  jsonError,
  jsonUnauthorized,
  ERROR_CODES,
  applyNoStoreHeaders,
} from '@/app/api/_lib/response';
import { mapSupabaseFactor, type MFAFactor, type MFAStatus } from '@/lib/security/mfa';
import { logger } from '@/lib/logger';

/**
 * GET /api/auth/mfa/status
 * Returns the current MFA enrollment status for the authenticated user.
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonUnauthorized('Authentication required');
    }

    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError) {
      logger.error('MFA AAL check error:', {
        userId: user.id,
        error: aalError.message,
      });
      return jsonError('Failed to check MFA status', 500, ERROR_CODES.INTERNAL_ERROR);
    }

    const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();

    if (factorsError) {
      logger.error('MFA list factors error:', {
        userId: user.id,
        error: factorsError.message,
      });
      return jsonError('Failed to list MFA factors', 500, ERROR_CODES.INTERNAL_ERROR);
    }

    const allFactors: MFAFactor[] = (factorsData?.all ?? []).map(mapSupabaseFactor);
    const verifiedFactors = allFactors.filter((f: MFAFactor) => f.status === 'verified');
    const totpFactors = verifiedFactors.filter((f: MFAFactor) => f.type === 'totp');
    const phoneFactors = verifiedFactors.filter((f: MFAFactor) => f.type === 'phone');

    const status: MFAStatus = {
      enabled: verifiedFactors.length > 0,
      currentLevel: aal?.currentLevel ?? 'aal1',
      nextLevel: aal?.nextLevel ?? 'aal1',
      factors: allFactors,
      totpEnabled: totpFactors.length > 0,
      phoneEnabled: phoneFactors.length > 0,
    };

    return applyNoStoreHeaders(jsonSuccess(status));
  } catch (error) {
    logger.error('MFA status error:', error);
    return jsonError('Failed to check MFA status', 500, ERROR_CODES.INTERNAL_ERROR);
  }
}
