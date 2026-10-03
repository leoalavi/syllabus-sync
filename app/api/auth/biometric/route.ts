import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  jsonSuccess,
  jsonError,
  jsonUnauthorized,
  parseJsonBody,
  BODY_SIZE_LIMITS,
  ERROR_CODES,
  applyNoStoreHeaders,
} from '@/app/api/_lib/response';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const biometricSchema = z.object({
  enabled: z.boolean(),
  credentialId: z.string().optional(),
  publicKey: z.string().optional(),
  counter: z.number().optional(),
  transports: z.array(z.string()).optional(),
});

type BiometricMetadata = {
  biometric_enabled?: boolean;
  biometric_credential_id?: string | null;
  biometric_public_key?: string | null;
  biometric_counter?: number | null;
  biometric_transports?: string[] | null;
  biometric_updated_at?: string | null;
};

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonUnauthorized('Not authenticated');
    }

    const metadata = (user.user_metadata || {}) as BiometricMetadata;
    const { count: dbCredentialCount, error: credentialsError } = await supabase
      .from('webauthn_credentials')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', user.id);

    if (credentialsError) {
      logger.warn('Biometric GET credential lookup failed:', credentialsError);
    }

    const hasDbCredentials = (dbCredentialCount ?? 0) > 0;

    return applyNoStoreHeaders(
      jsonSuccess({
        enabled: Boolean(metadata.biometric_enabled) || hasDbCredentials,
        credentialId: metadata.biometric_credential_id ?? null,
        publicKey: metadata.biometric_public_key ?? null,
        counter: metadata.biometric_counter ?? null,
        transports: metadata.biometric_transports ?? null,
        updatedAt: metadata.biometric_updated_at ?? null,
        credentialCount: dbCredentialCount ?? 0,
      }),
    );
  } catch (error) {
    logger.error('Biometric GET error:', error);
    return jsonError('Internal server error', 500, ERROR_CODES.INTERNAL_ERROR);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonUnauthorized('Not authenticated');
    }

    const { data: body, error: parseError } = await parseJsonBody(request, BODY_SIZE_LIMITS.AUTH);
    if (parseError) return parseError;

    const parsed = biometricSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Invalid biometric payload', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const { enabled, credentialId, publicKey, counter, transports } = parsed.data;

    if (enabled && (!credentialId || !publicKey)) {
      return jsonError(
        'Credential details are required to enable biometric login',
        400,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    if (!enabled) {
      const { error: deleteCredentialsError } = await supabase
        .from('webauthn_credentials')
        .delete()
        .eq('user_id', user.id);

      if (deleteCredentialsError) {
        logger.error('Biometric disable credential cleanup failed:', deleteCredentialsError);
        return jsonError('Failed to update biometric settings', 400, ERROR_CODES.BAD_REQUEST);
      }
    }

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        biometric_enabled: enabled,
        biometric_credential_id: enabled ? (credentialId ?? null) : null,
        biometric_public_key: enabled ? (publicKey ?? null) : null,
        biometric_counter: enabled ? (counter ?? 0) : null,
        biometric_transports: enabled ? (transports ?? null) : null,
        biometric_updated_at: new Date().toISOString(),
      },
    });

    if (updateError) {
      logger.error('Biometric update failed:', updateError.message);
      return jsonError('Failed to update biometric settings', 400, ERROR_CODES.BAD_REQUEST);
    }

    return applyNoStoreHeaders(
      jsonSuccess({
        enabled,
        credentialId: enabled ? (credentialId ?? null) : null,
        publicKey: enabled ? (publicKey ?? null) : null,
        counter: enabled ? (counter ?? 0) : null,
        transports: enabled ? (transports ?? null) : null,
        credentialCount: enabled ? undefined : 0,
      }),
    );
  } catch (error) {
    logger.error('Biometric POST error:', error);
    return jsonError('Internal server error', 500, ERROR_CODES.INTERNAL_ERROR);
  }
}
