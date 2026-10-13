import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  jsonSuccess,
  jsonError,
  ERROR_CODES,
  parseJsonBody,
  BODY_SIZE_LIMITS,
} from '@/app/api/_lib/response';
import { loginLimiter } from '@/lib/services/rateLimitService';
import { getClientIP } from '@/lib/security/ip';
import { emailKeyPrefix } from '@/lib/security/identifiers';
import { checkSignInProvider, buildMismatchMessage } from '@/lib/auth/providerGuard';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Developer emails that can bypass email confirmation in development
// SECURITY: Load from environment variable to avoid exposing emails in source code
const DEV_EMAILS = process.env.DEV_BYPASS_EMAILS
  ? process.env.DEV_BYPASS_EMAILS.split(',').map((e) => e.trim().toLowerCase())
  : [];

// SECURITY: Stricter production detection
// - VERCEL_ENV is set by Vercel and cannot be spoofed
// - NODE_ENV alone can be manipulated in local environments
// This ensures dev features are NEVER enabled on Vercel production
const isRealProduction =
  process.env.VERCEL_ENV === 'production' ||
  (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV);
const isDevelopment = process.env.NODE_ENV === 'development' && !isRealProduction;

function isDevEmail(email: string): boolean {
  return DEV_EMAILS.some((devEmail) => email.toLowerCase() === devEmail);
}

// Generic error message to prevent account enumeration
const GENERIC_AUTH_ERROR = 'Invalid email or password';

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);

  try {
    // SECURITY: Enforce body size limit for auth endpoints (10KB max)
    const { data: body, error: bodyError } = await parseJsonBody(request, BODY_SIZE_LIMITS.AUTH);
    if (bodyError) return bodyError;

    const parsed = signinSchema.safeParse(body);

    if (!parsed.success) {
      // SECURITY: Don't reveal validation details, use generic error
      return jsonError(GENERIC_AUTH_ERROR, 400, ERROR_CODES.BAD_REQUEST);
    }

    const supabase = await createServerClient();
    const { email, password } = parsed.data;

    // SECURITY: Rate limit by IP+email (hashed) to avoid collapsing all traffic to "unknown" IPs
    // while still providing brute-force protection for a given email on a given source.
    const loginRateKey = `ip:${clientIP}:em:${emailKeyPrefix(email)}`;
    const { allowed, remaining, resetIn } = await loginLimiter(loginRateKey);

    if (!allowed) {
      return jsonError(
        `Too many login attempts. Please try again in ${Math.ceil(resetIn / 60)} minutes.`,
        429,
        ERROR_CODES.RATE_LIMITED,
        { retryAfter: resetIn, remaining },
      );
    }

    // Try password signin first
    let { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Auto-confirm ONLY in development AND only for developer emails
    // Requires SUPABASE_SERVICE_ROLE_KEY to be configured
    if (
      error &&
      error.message.includes('Email not confirmed') &&
      isDevelopment &&
      isDevEmail(email)
    ) {
      const adminClient = createAdminClient();

      if (adminClient) {
        console.warn(`🔧 Development mode: auto-confirming developer email...`);

        // SECURITY: Query auth.users directly using service role to get user by email
        // This is more efficient than listUsers() which fetches ALL users
        // The service role key bypasses RLS and can query auth.users
        const { data: authUsers, error: queryError } = await adminClient
          .from('auth.users')
          .select('id')
          .eq('email', email)
          .limit(1)
          .single();

        // Fallback: If direct query fails (some Supabase versions), use listUsers with filter
        let userId: string | null = null;

        if (!queryError && authUsers?.id) {
          userId = authUsers.id;
        } else {
          // Fallback to listUsers but with pagination (perPage: 1) if email filter supported
          // Note: listUsers() doesn't support email filter, so we need to search
          // This is a known limitation - for development only, acceptable tradeoff
          const { data: users, error: listError } = await adminClient.auth.admin.listUsers({
            perPage: 100, // Limit to reduce memory usage
          });

          if (!listError && users) {
            const user = users.users.find(
              (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase(),
            );
            if (user) {
              userId = user.id;
            }
          }
        }

        if (userId) {
          // Confirm the email using admin client
          const { error: confirmError } = await adminClient.auth.admin.updateUserById(userId, {
            email_confirm: true,
          });

          if (!confirmError) {
            // Try signin again with regular client
            const retryResult = await supabase.auth.signInWithPassword({
              email,
              password,
            });

            if (!retryResult.error) {
              data = retryResult.data;
              error = null;
            }
          } else {
            console.warn('Auto-confirmation failed:', confirmError.message);
          }
        }
      } else {
        console.warn(
          'Dev email auto-confirm skipped: SUPABASE_SERVICE_ROLE_KEY not configured.\n' +
            'Add the service role key to .env.local for auto-confirmation to work.',
        );
      }
    }

    if (error) {
      // Provider-guard upgrade: when password sign-in fails with "Invalid login
      // credentials", one cause is that the user signed up with Google and has
      // no password identity. In that case we want to show the specific
      // provider-mismatch message instead of the generic error — the user has
      // already opted for UX clarity over enumeration resistance for signup
      // (see MEMORY.md), and the same trade-off applies here.
      try {
        const adminClient = createAdminClient();
        if (adminClient) {
          const { data: lookup } = await adminClient.rpc('lookup_user_by_email', {
            lookup_email: email,
          });
          const row = Array.isArray(lookup) ? lookup[0] : lookup;
          if (row?.user_id) {
            const { data: full } = await adminClient.auth.admin.getUserById(row.user_id);
            const guard = checkSignInProvider(full?.user ?? null, 'email');
            if (!guard.allowed) {
              const response = jsonError(
                buildMismatchMessage(guard.signupProvider),
                401,
                ERROR_CODES.UNAUTHORIZED,
                { signupProvider: guard.signupProvider },
              );
              response.headers.set('X-RateLimit-Remaining', remaining.toString());
              return response;
            }
          }
        }
      } catch (guardError) {
        // Non-fatal: fall through to the generic error below.
        logger.warn('Provider-guard lookup failed on signin error path', guardError);
      }

      // SECURITY: Return generic error to prevent account enumeration
      // Log the actual error server-side for debugging
      console.warn('Signin failed:', {
        email: `${email.substring(0, 3)}***`,
        error: error.message,
      });
      const response = jsonError(GENERIC_AUTH_ERROR, 401, ERROR_CODES.UNAUTHORIZED);
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      return response;
    }

    // Provider-guard on successful sign-in: handles the edge case where a user
    // has both email+google identities linked (e.g. Supabase auto-linking after
    // a prior OAuth attempt). Rule: "signup provider wins." If the earliest
    // identity is not 'email', reject this password sign-in and signOut the
    // session we just minted.
    const guard = checkSignInProvider(data.user, 'email');
    if (!guard.allowed) {
      try {
        // Only the session just minted; leave other devices signed in.
        await supabase.auth.signOut({ scope: 'local' });
      } catch (signOutError) {
        logger.warn('Provider-guard signOut failed (non-fatal)', signOutError);
      }
      const response = jsonError(
        buildMismatchMessage(guard.signupProvider),
        401,
        ERROR_CODES.UNAUTHORIZED,
        { signupProvider: guard.signupProvider },
      );
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      return response;
    }

    const response = jsonSuccess({
      user: data.user,
      session: data.session,
      message: 'Signin successful',
    });
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    return response;
  } catch (error) {
    logger.error('Signin error:', error);
    return jsonError('Internal server error', 500, ERROR_CODES.INTERNAL_ERROR);
  }
}
