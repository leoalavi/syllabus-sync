/**
 * Provider Guard — enforces single-provider-per-account at sign-in.
 *
 * Rule: "Signup provider wins, always."
 * ----------------------------------------
 * The signup provider is the identity with the earliest `created_at` timestamp in
 * `user.identities`. Only the signup provider may be used to sign in. Any identity
 * linked later (via explicit `linkIdentity` or Supabase auto-link) is ignored for
 * the purposes of sign-in routing.
 *
 * Why this rule:
 *  - Predictable: users always sign in with whatever they first used to create the account.
 *  - Safe: an attacker who compromises one credential cannot pivot to another provider.
 *  - Matches product intent: cross-provider login is deliberately prevented.
 *
 * If you need to relax this (allow both when both linked), flip the
 * `ALLOW_LINKED_PROVIDERS` constant below. Do NOT sprinkle per-caller overrides —
 * the rule must stay consistent across every auth route.
 */
import type { User, UserIdentity } from '@supabase/supabase-js';

/**
 * If true, any linked identity allows sign-in with that provider.
 * Default false = only the earliest identity is allowed.
 */
const ALLOW_LINKED_PROVIDERS = false;

export type SignupProvider = 'email' | 'google' | 'other';

export interface ProviderGuardResult {
  allowed: boolean;
  signupProvider: SignupProvider;
  /** Human-readable error message when `allowed === false`. Null otherwise. */
  message: string | null;
}

/** Normalize a Supabase identity `provider` field to our SignupProvider union. */
function normalizeProvider(provider: string | undefined | null): SignupProvider {
  if (provider === 'email') return 'email';
  if (provider === 'google') return 'google';
  return 'other';
}

/**
 * Returns the signup provider for a user — the identity with the earliest
 * `created_at`. Ties are broken by `id` (deterministic, stable across calls).
 *
 * Returns 'other' if the user has no identities or the earliest is neither
 * email nor google (future providers: github, apple, etc.).
 */
export function getSignupProvider(
  user: Pick<User, 'identities'> | null | undefined,
): SignupProvider {
  const identities = user?.identities ?? [];
  if (identities.length === 0) return 'other';

  const sorted = [...identities].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : Number.POSITIVE_INFINITY;
    const tb = b.created_at ? new Date(b.created_at).getTime() : Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    return (a.id ?? '').localeCompare(b.id ?? '');
  });

  return normalizeProvider(sorted[0]?.provider);
}

/** True when the user has at least one identity with the given provider. */
function hasIdentity(
  user: Pick<User, 'identities'> | null | undefined,
  provider: SignupProvider,
): boolean {
  const identities = (user?.identities ?? []) as UserIdentity[];
  return identities.some((i) => normalizeProvider(i.provider) === provider);
}

/**
 * Check whether a sign-in attempt via `attemptedProvider` is allowed for `user`.
 *
 * - If the user has no identities (impossible in practice after a successful
 *   sign-in, but we guard anyway), allow.
 * - If ALLOW_LINKED_PROVIDERS is true, allow whenever any identity matches the
 *   attempted provider.
 * - Otherwise enforce: attemptedProvider must equal getSignupProvider(user).
 */
export function checkSignInProvider(
  user: Pick<User, 'identities'> | null | undefined,
  attemptedProvider: Exclude<SignupProvider, 'other'>,
): ProviderGuardResult {
  const signupProvider = getSignupProvider(user);

  if (signupProvider === 'other') {
    // Unknown provider (shouldn't happen in current app, but don't break sign-in
    // for future providers — let it through and log upstream if needed).
    return { allowed: true, signupProvider, message: null };
  }

  const allowed = ALLOW_LINKED_PROVIDERS
    ? hasIdentity(user, attemptedProvider)
    : signupProvider === attemptedProvider;

  if (allowed) {
    return { allowed: true, signupProvider, message: null };
  }

  return {
    allowed: false,
    signupProvider,
    message: buildMismatchMessage(signupProvider),
  };
}

/**
 * The exact copy the user requested, keyed by the signup provider.
 * Keep these strings stable — they're referenced by tests and by the login
 * banner's translation fallbacks.
 */
export function buildMismatchMessage(signupProvider: SignupProvider): string {
  if (signupProvider === 'email') {
    return 'You already signed up with email. Please log in with your email and password.';
  }
  if (signupProvider === 'google') {
    return 'You already signed up with Google. Please continue with your Google account.';
  }
  // Fallback — shouldn't be reachable with the current provider set, but keeps
  // the return type non-nullable for callers.
  return 'You already signed up with a different method. Please use your original sign-in option.';
}
