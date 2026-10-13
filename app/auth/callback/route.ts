import { createServerClient } from '@/lib/supabase/server';
import { isValidRedirect } from '@/lib/utils/security';
import { checkSignInProvider } from '@/lib/auth/providerGuard';
import { NextResponse } from 'next/server';

/**
 * Auth Callback Handler
 *
 * This route handles OAuth/email verification/password recovery callbacks from Supabase.
 * When a user clicks a link in their email, Supabase redirects them here with
 * a temporary `code` parameter. We exchange this code for a session.
 *
 * For password recovery, we redirect to /reset-password with the code.
 * For other flows (signup verification, OAuth), we redirect to the target page.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const type = requestUrl.searchParams.get('type'); // Supabase sends type=recovery for password reset
  // `flow` is set by our own client code (SignupClient / LoginClient) before kicking off
  // an OAuth sign-in. It is the *authoritative* signal that this callback hit is a real
  // OAuth round-trip rather than an email verification link. We cannot rely on
  // `redirectTo === '/home'` alone because Supabase sometimes normalizes or strips query
  // params during the OAuth hop, causing legitimate OAuth flows to fall into the
  // "email prefetch" branch and show a confusing "may already be verified" banner.
  const flow = requestUrl.searchParams.get('flow'); // 'oauth' | null
  const isOAuthFlow = flow === 'oauth';
  const rawRedirect =
    requestUrl.searchParams.get('redirectTo') ?? requestUrl.searchParams.get('next');
  const redirectTo = isValidRedirect(rawRedirect) ? rawRedirect! : '/home';

  // OAuth providers can redirect back with error query params.
  if (error || errorDescription) {
    console.error('OAuth callback error:', {
      error,
      errorDescription,
    });
    const loginUrl = new URL('/login', requestUrl.origin);
    loginUrl.searchParams.set('error', 'oauth_failed');
    if (isValidRedirect(rawRedirect)) {
      loginUrl.searchParams.set('redirectTo', rawRedirect!);
    }
    return NextResponse.redirect(loginUrl);
  }

  // If no code is present, there is nothing to exchange. Send the user back to login.
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', requestUrl.origin));
  }

  // Always exchange the code for a session first (PKCE handshake).
  // This sets the session cookie so downstream pages have auth context.
  const supabase = await createServerClient();
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error('Auth callback code exchange error:', {
      message: exchangeError.message,
      status: (exchangeError as Record<string, unknown>).status,
      code: (exchangeError as Record<string, unknown>).code,
    });
    // For recovery, redirect back to reset-password with error
    if (type === 'recovery') {
      const resetUrl = new URL('/reset-password', requestUrl.origin);
      resetUrl.searchParams.set('error', 'verification_failed');
      resetUrl.searchParams.set(
        'error_description',
        'Invalid or expired reset link. Please request a new one.',
      );
      return NextResponse.redirect(resetUrl);
    }

    // Hybrid-A: PKCE code exchange failure on a non-recovery, non-OAuth flow is
    // almost always an email-link prefetch (Gmail/Outlook/corporate proxy scanner
    // consumed the one-time code) — the server-side effect (email marked verified)
    // already happened on the bot's hit. Default to optimistic soft-success. We
    // only show the scary error path when `flow=oauth` explicitly marks this as a
    // real OAuth attempt (set by SignupClient/LoginClient before signInWithOAuth).
    if (!isOAuthFlow) {
      const loginUrl = new URL('/login', requestUrl.origin);
      loginUrl.searchParams.set('verified', '1');
      loginUrl.searchParams.set('from', 'email_link');
      return NextResponse.redirect(loginUrl);
    }

    const loginUrl = new URL('/login', requestUrl.origin);
    loginUrl.searchParams.set('error', 'oauth_failed');
    if (isValidRedirect(rawRedirect)) {
      loginUrl.searchParams.set('redirectTo', rawRedirect!);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Detect password recovery flow:
  // 1. Explicit type=recovery param (set by our resetPasswordForEmail redirectTo)
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/reset-password?recovery=1', requestUrl.origin));
  }

  // 2. Fallback: check if recovery was recently requested (handles case where
  //    Supabase stripped our query params from redirect_to)
  if (data?.user?.recovery_sent_at) {
    const recoveryTime = new Date(data.user.recovery_sent_at).getTime();
    if (Date.now() - recoveryTime < 10 * 60 * 1000) {
      return NextResponse.redirect(new URL('/reset-password?recovery=1', requestUrl.origin));
    }
  }

  // 3. Honor explicit redirectTo pointing to reset-password
  if (rawRedirect === '/reset-password' || redirectTo === '/reset-password') {
    return NextResponse.redirect(new URL('/reset-password?recovery=1', requestUrl.origin));
  }

  // Decide the post-exchange destination.
  //
  // There are two ways we reach a successful exchange here:
  //   (a) OAuth sign-in (Google) — `flow=oauth` is set. The user explicitly wants to
  //       be signed in. If their profile is incomplete (new user), route them through
  //       /onboarding to collect faculty/course/year before /home.
  //   (b) Email verification link (signup confirmation) — no `flow` param. The exchange
  //       succeeds and the side-effect we wanted (email_confirmed_at set on auth.users)
  //       has already occurred. BUT the user asked that clicking the verify link should
  //       NOT auto-log them in — they want to land on the login page with a green
  //       "email verified" banner and sign in manually. So we explicitly sign out the
  //       session we just created before redirecting to /login?verified=1.
  const provider = data?.user?.app_metadata?.provider;
  const isOAuthSignIn = isOAuthFlow || (provider && provider !== 'email');

  if (isOAuthSignIn && data?.user) {
    // Provider guard: enforce "signup provider wins" rule. If this user originally
    // signed up with email/password, block the Google sign-in attempt — even if
    // Supabase auto-linked the identities. See lib/auth/providerGuard.ts.
    const guard = checkSignInProvider(data.user, 'google');
    if (!guard.allowed) {
      try {
        // Revoke only the session minted by this attempt, not the user's
        // legitimate sessions on other devices.
        await supabase.auth.signOut({ scope: 'local' });
      } catch (signOutError) {
        console.warn('Provider-guard signOut failed (non-fatal):', signOutError);
      }
      const loginUrl = new URL('/login', requestUrl.origin);
      loginUrl.searchParams.set('error', 'provider_mismatch');
      loginUrl.searchParams.set('signup_provider', guard.signupProvider);
      return NextResponse.redirect(loginUrl);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('faculty, course, year')
      .eq('id', data.user.id)
      .maybeSingle();

    const isIncomplete = !profile?.faculty || !profile?.course || !profile?.year;
    if (isIncomplete) {
      const onboardingUrl = new URL('/onboarding', requestUrl.origin);
      onboardingUrl.searchParams.set('next', redirectTo);
      return NextResponse.redirect(onboardingUrl);
    }
    // OAuth sign-in with complete profile — let them through to /home.
    return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
  }

  // Email verification path: the email is now confirmed server-side. Drop the
  // session cookie we just minted and bounce the user back to /login so they sign
  // in explicitly. The `verified=1` flag triggers the green success banner in
  // LoginClient.
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (signOutError) {
    console.warn('Post-verification signOut failed (non-fatal):', signOutError);
  }

  // If we have a validated redirectTo that isn't just bouncing back to login,
  // honor it. This allows signup-confirmation emails to land the user on
  // their intended destination (e.g., /map or /home) after they sign in.
  if (redirectTo && redirectTo !== '/login') {
    return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
  }

  const verifiedLoginUrl = new URL('/login', requestUrl.origin);
  verifiedLoginUrl.searchParams.set('verified', '1');
  return NextResponse.redirect(verifiedLoginUrl);
}
