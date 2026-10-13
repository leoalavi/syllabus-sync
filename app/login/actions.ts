'use server';

import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loginSchema, LoginFormData } from './schemas/loginSchema';
import { headers } from 'next/headers';
import { loginLimiter } from '@/lib/services/rateLimitService';
import { getClientIPFromHeaders } from '@/lib/security/ip';
import { emailKeyPrefix } from '@/lib/security/identifiers';
import { checkSignInProvider, type SignupProvider } from '@/lib/auth/providerGuard';
import { logger } from '@/lib/logger';

export interface MFAFactorInfo {
  id: string;
  type: 'totp' | 'phone';
  name?: string;
  phone?: string;
}

export interface LoginResult {
  success?: boolean;
  error?: string;
  retryAfter?: number;
  mfaRequired?: boolean;
  availableFactors?: MFAFactorInfo[];
  /** Set when error === 'provider_mismatch' — tells the client which provider the user actually signed up with. */
  signupProvider?: SignupProvider;
}

function maskEmailForLogs(email: string): string {
  const [localPart, domain] = email.toLowerCase().split('@');
  if (!localPart || !domain) return 'invalid-email';
  if (localPart.length <= 2) return `${localPart[0] ?? '*'}***@${domain}`;
  return `${localPart.slice(0, 2)}***@${domain}`;
}

export async function loginAction(data: LoginFormData): Promise<LoginResult> {
  // 1. Validate Input (Zod)
  const result = loginSchema.safeParse(data);
  if (!result.success) {
    return { error: 'validation_error' };
  }

  const headersList = await headers();
  const clientIp = getClientIPFromHeaders(headersList);
  const emailHint = maskEmailForLogs(result.data.email);
  const loginRateKey = `ip:${clientIp}:em:${emailKeyPrefix(result.data.email)}`;

  // Log the attempt (Security)
  logger.info('Login attempt', { email_hint: emailHint });

  // 2. Security: Rate Limiting (5 attempts per min)
  const limit = await loginLimiter(loginRateKey);
  if (!limit.allowed) {
    logger.warn('Login rate limit exceeded', {
      email_hint: emailHint,
      ip: clientIp,
    });
    return { error: 'rate_limit_exceeded', retryAfter: limit.resetIn };
  }

  // 3. Auth: Supabase Login
  const supabase = await createServerClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  });

  if (error) {
    const message = error.message ?? '';
    logger.error('Login failed', { error: message, email_hint: emailHint });

    // Email-not-confirmed is only returned after correct credentials, so this
    // does not leak account existence. It enables a resend-verification UX.
    if (message.toLowerCase().includes('email not confirmed')) {
      return { error: 'email_not_confirmed' };
    }

    // Provider-guard upgrade: if the user signed up with Google, there is no
    // password identity, so signInWithPassword fails with "Invalid login
    // credentials". Detect that case via admin lookup and return the specific
    // provider-mismatch error instead of the generic "invalid credentials".
    try {
      const adminClient = createAdminClient();
      if (adminClient) {
        const { data: lookup } = await adminClient.rpc('lookup_user_by_email', {
          lookup_email: result.data.email,
        });
        const row = Array.isArray(lookup) ? lookup[0] : lookup;
        if (row?.user_id) {
          const { data: full } = await adminClient.auth.admin.getUserById(row.user_id);
          const guard = checkSignInProvider(full?.user ?? null, 'email');
          if (!guard.allowed) {
            logger.info('Login blocked: provider mismatch', {
              email_hint: emailHint,
              signup_provider: guard.signupProvider,
            });
            return {
              error: 'provider_mismatch',
              signupProvider: guard.signupProvider,
            };
          }
        }
      }
    } catch (guardError) {
      // Non-fatal: fall through to generic error. Do NOT leak guard failures
      // to the client.
      logger.warn('Provider-guard lookup failed on loginAction error path', guardError);
    }

    return { error: 'invalid_credentials' };
  }

  // Explicit email verification check — don't rely solely on Supabase error string parsing
  if (signInData?.user && !signInData.user.email_confirmed_at) {
    logger.warn('Login blocked: email not verified', { email_hint: emailHint });
    return { error: 'email_not_confirmed' };
  }

  // Provider-guard on successful password sign-in: catches the edge case
  // where a user has both email+google identities linked (e.g. Supabase
  // auto-linking after an OAuth attempt). If the earliest identity is NOT
  // email, reject and signOut. See lib/auth/providerGuard.ts for the rule.
  const guard = checkSignInProvider(signInData?.user ?? null, 'email');
  if (!guard.allowed) {
    try {
      // Only the session just minted; leave other devices signed in.
      await supabase.auth.signOut({ scope: 'local' });
    } catch (signOutError) {
      logger.warn('Provider-guard signOut failed (non-fatal)', signOutError);
    }
    logger.info('Login blocked after success: provider mismatch', {
      email_hint: emailHint,
      signup_provider: guard.signupProvider,
    });
    return {
      error: 'provider_mismatch',
      signupProvider: guard.signupProvider,
    };
  }

  // 4. Check MFA status — if user has enrolled MFA factors, require aal2
  try {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel === 'aal1') {
      // User has MFA enabled — get factor list
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const allFactors = factorsData?.all ?? [];
      const verifiedFactors = allFactors.filter((f: { status: string }) => f.status === 'verified');

      if (verifiedFactors.length > 0) {
        logger.info('MFA challenge required', { email_hint: emailHint });
        return {
          mfaRequired: true,
          availableFactors: verifiedFactors.map(
            (f: {
              id: string;
              factor_type: string;
              friendly_name?: string | null;
              phone?: string;
            }) => ({
              id: f.id,
              type: f.factor_type as 'totp' | 'phone',
              name: f.friendly_name ?? undefined,
              phone: f.phone ?? undefined,
            }),
          ),
        };
      }
    }
  } catch (mfaError) {
    // SECURITY: MFA check failed — fail-closed to prevent MFA bypass.
    // If we can't verify MFA status, deny login rather than allowing
    // an attacker to bypass MFA via a service/network error.
    logger.error('MFA status check failed — blocking login (fail-closed)', {
      email_hint: emailHint,
      error: mfaError,
    });
    return { error: 'mfa_check_failed' };
  }

  logger.info('Login success', { email_hint: emailHint });
  return { success: true };
}
