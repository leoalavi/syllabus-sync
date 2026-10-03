import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import {
  jsonSuccess,
  jsonError,
  parseJsonBody,
  BODY_SIZE_LIMITS,
  ERROR_CODES,
} from '@/app/api/_lib/response';
import {
  getRpId,
  getOrigin,
  PASSKEY_CHALLENGE_COOKIE,
  PASSKEY_USER_COOKIE,
  clearPasskeyCookies,
  base64UrlToBuffer,
} from '@/app/api/auth/passkey/_lib';
import { passkeyAuthLimiter } from '@/lib/services/rateLimitService';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getClientIP } from '@/lib/security/ip';

const verifySchema = z.object({
  credential: z.record(z.string(), z.unknown()),
});

export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient();
    if (!adminClient) {
      return jsonError('Passkey login is not configured', 503, ERROR_CODES.EXTERNAL_SERVICE_ERROR);
    }

    // SECURITY: Rate limit passkey verification to prevent brute-force
    const ip = getClientIP(request);
    const rateLimitResult = await passkeyAuthLimiter(`ip:${ip}:passkey-verify`);
    if (!rateLimitResult.allowed) {
      return jsonError(
        `Too many attempts. Try again in ${rateLimitResult.resetIn} seconds.`,
        429,
        ERROR_CODES.RATE_LIMITED,
      );
    }

    const { data: body, error: parseError } = await parseJsonBody(request, BODY_SIZE_LIMITS.AUTH);
    if (parseError) return parseError;

    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Invalid passkey payload', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const cookieStore = await cookies();
    const expectedChallenge = cookieStore.get(PASSKEY_CHALLENGE_COOKIE)?.value;
    const userId = cookieStore.get(PASSKEY_USER_COOKIE)?.value;

    if (!expectedChallenge || !userId) {
      return jsonError('Passkey challenge expired', 400, ERROR_CODES.BAD_REQUEST);
    }

    const { data: userRecord, error: userError } = await adminClient.auth.admin.getUserById(userId);
    if (userError || !userRecord?.user) {
      return jsonError('Passkey login unavailable', 404, ERROR_CODES.NOT_FOUND);
    }

    const metadata = (userRecord.user.user_metadata || {}) as Record<string, unknown>;
    const credentialId = metadata.biometric_credential_id as string | undefined;
    const publicKey = metadata.biometric_public_key as string | undefined;
    const counter = (metadata.biometric_counter as number | undefined) ?? 0;

    if (!credentialId || !publicKey) {
      return jsonError('Passkey login unavailable', 404, ERROR_CODES.NOT_FOUND);
    }

    const transports =
      (metadata.biometric_transports as AuthenticatorTransportFuture[] | undefined) ?? undefined;

    const verification = await verifyAuthenticationResponse({
      response: parsed.data.credential as unknown as AuthenticationResponseJSON,
      expectedChallenge,
      expectedOrigin: getOrigin(request),
      expectedRPID: getRpId(request),
      credential: {
        id: credentialId,
        publicKey: base64UrlToBuffer(publicKey),
        counter,
        transports,
      },
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.authenticationInfo) {
      return jsonError('Passkey verification failed', 401, ERROR_CODES.UNAUTHORIZED);
    }

    const newCounter = verification.authenticationInfo.newCounter;
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: {
        biometric_counter: newCounter,
        biometric_updated_at: new Date().toISOString(),
      },
    });

    if (updateError) {
      logger.error('Passkey counter update failed:', updateError.message);
    }

    const serverClient = await createServerClient();
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: userRecord.user.email ?? '',
    });

    if (linkError || !linkData?.properties?.email_otp) {
      return jsonError('Failed to complete sign-in', 500, ERROR_CODES.INTERNAL_ERROR);
    }

    const { data: sessionData, error: verifyError } = await serverClient.auth.verifyOtp({
      email: userRecord.user.email ?? '',
      token: linkData.properties.email_otp,
      type: 'magiclink',
    });

    if (verifyError || !sessionData.session) {
      return jsonError('Failed to complete sign-in', 500, ERROR_CODES.INTERNAL_ERROR);
    }

    const response = jsonSuccess({ signedIn: true });
    clearPasskeyCookies(response);
    return response;
  } catch (error) {
    logger.error('Passkey verify error:', error);
    return jsonError('Failed to verify passkey', 500, ERROR_CODES.INTERNAL_ERROR);
  }
}
