'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/mq/button';
import { Input } from '@/components/ui/mq/input';
import { Shield, Loader2, AlertTriangle, Smartphone, ArrowLeft } from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n/translations';
import { toastUtils } from '@/lib/utils/toast';
import { API_ROUTES } from '@/lib/constants/config';
import { apiRequest } from '@/lib/utils/api';

export interface MFAFactorInfo {
  id: string;
  type: 'totp' | 'phone';
  name?: string;
  phone?: string;
}

interface MFAChallengeProps {
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  factors: MFAFactorInfo[];
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * MFA Challenge component shown during login flow.
 * Handles both TOTP and SMS verification via Supabase MFA API.
 */
export function MFAChallenge({ t, factors, onSuccess, onCancel }: MFAChallengeProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFactor, setSelectedFactor] = useState<MFAFactorInfo | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-select the first TOTP factor, or fall back to phone
  useEffect(() => {
    const totpFactor = factors.find((f) => f.type === 'totp');
    const phoneFactor = factors.find((f) => f.type === 'phone');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedFactor(totpFactor || phoneFactor || null);
  }, [factors]);

  const createChallenge = useCallback(async () => {
    if (!selectedFactor) return;
    if (selectedFactor.type !== 'phone') return;

    setError(null);
    try {
      const data = await apiRequest<{ challengeId: string }>(API_ROUTES.AUTH.MFA_CHALLENGE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId: selectedFactor.id }),
        noRetry: true,
      });
      setChallengeId(data.challengeId);
    } catch {
      setError(t('failedToSendCode' as TranslationKey));
    }
  }, [selectedFactor, t]);

  // When switching to SMS factor, create a challenge (triggers SMS send).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChallengeId(null);
    setCode('');
    setError(null);
    if (selectedFactor?.type === 'phone') {
      void createChallenge();
    }
  }, [selectedFactor, createChallenge]);

  const handleVerify = useCallback(async () => {
    if (!selectedFactor || code.length !== 6) return;

    if (attemptsLeft <= 0) {
      setError(t('tooManyAttempts' as TranslationKey));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // SECURITY: Route through server-side API to enforce server-side rate
      // limiting (5 attempts / 15 min) instead of calling Supabase MFA API
      // directly from the browser which bypasses our rate limiter.
      const result = await apiRequest<{ verified: boolean }>(API_ROUTES.AUTH.MFA_CHALLENGE_VERIFY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factorId: selectedFactor.id,
          challengeId: selectedFactor.type === 'phone' ? challengeId : undefined,
          code: code.trim(),
        }),
        noRetry: true,
      });

      if (!result?.verified) {
        setAttemptsLeft((prev) => prev - 1);
        if (attemptsLeft <= 1) {
          setError(t('tooManyFailedAttempts' as TranslationKey));
          setTimeout(onCancel, 2000);
        } else {
          setError(
            t('invalidCodeAttempts' as TranslationKey, {
              count: attemptsLeft - 1,
            }),
          );
        }
        return;
      }

      // Success — session upgraded to aal2 via server-side cookies
      toastUtils.success(t('welcomeBack'), t('identityVerified' as TranslationKey));
      onSuccess();
    } catch {
      setError(t('mfaVerificationFailed' as TranslationKey));
    } finally {
      setIsLoading(false);
    }
  }, [selectedFactor, code, attemptsLeft, t, onSuccess, onCancel, challengeId]);

  const switchFactor = useCallback(
    (type: 'totp' | 'phone') => {
      const factor = factors.find((f) => f.type === type);
      if (factor) {
        setSelectedFactor(factor);
        setCode('');
        setError(null);
      }
    },
    [factors],
  );

  // Cleanup cooldown interval on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    };
  }, []);

  const handleResendSMS = useCallback(async () => {
    if (!selectedFactor || selectedFactor.type !== 'phone' || resendCooldown > 0) return;

    try {
      await createChallenge();
      toastUtils.success(t('security'), t('newCodeSent' as TranslationKey));

      // Start cooldown
      setResendCooldown(60);
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setError(t('failedToResendCode' as TranslationKey));
    }
  }, [selectedFactor, resendCooldown, t, createChallenge]);

  const hasMultipleFactorTypes =
    factors.some((f) => f.type === 'totp') && factors.some((f) => f.type === 'phone');

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-sm mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-2.5 sm:p-3 bg-mq-primary/10 rounded-full">
            <Shield className="h-7 w-7 sm:h-8 sm:w-8 text-mq-primary" />
          </div>
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-mq-content">
          {t('twoStepVerification' as TranslationKey)}
        </h2>
        <p className="text-xs sm:text-sm text-mq-content-secondary">
          {selectedFactor?.type === 'totp'
            ? t('mfaTotpPrompt' as TranslationKey)
            : t('mfaSmsPrompt' as TranslationKey, {
                last4: selectedFactor?.phone?.slice(-4) ?? '',
              })}
        </p>
      </div>

      {/* Code Input */}
      <div className="space-y-3">
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
            setCode(val);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && code.length === 6) handleVerify();
          }}
          className="text-center text-2xl sm:text-3xl tracking-[0.35em] sm:tracking-[0.5em] font-mono h-14 sm:h-16"
          autoFocus
          autoComplete="one-time-code"
          disabled={isLoading || attemptsLeft <= 0}
          aria-label={t('twoStepVerification' as TranslationKey)}
          aria-describedby={error ? 'mfa-error' : undefined}
          aria-invalid={!!error}
        />

        {error && (
          <div
            id="mfa-error"
            role="alert"
            className="flex items-center gap-2 text-mq-error text-xs sm:text-sm justify-center text-center"
          >
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span className="break-words">{error}</span>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <Button
        type="button"
        onClick={handleVerify}
        disabled={isLoading || code.length !== 6 || attemptsLeft <= 0}
        className="w-full h-12 font-bold"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            {t('verifying' as TranslationKey)}
          </>
        ) : (
          t('verify' as TranslationKey)
        )}
      </Button>

      {/* SMS Resend */}
      {selectedFactor?.type === 'phone' && (
        <div className="text-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResendSMS}
            disabled={resendCooldown > 0}
            className="text-xs"
          >
            {resendCooldown > 0
              ? t('resendIn' as TranslationKey, { seconds: resendCooldown })
              : t('resendCode' as TranslationKey)}
          </Button>
        </div>
      )}

      {/* Factor Switcher */}
      {hasMultipleFactorTypes && (
        <div className="border-t border-mq-border pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-xs text-mq-content-secondary"
            onClick={() => switchFactor(selectedFactor?.type === 'totp' ? 'phone' : 'totp')}
          >
            <Smartphone className="h-3 w-3 mr-1" />
            {selectedFactor?.type === 'totp'
              ? t('useSmsInstead' as TranslationKey)
              : t('useTotpInstead' as TranslationKey)}
          </Button>
        </div>
      )}

      {/* Back Button */}
      <div className="text-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-xs text-mq-content-secondary"
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          {t('backToLogin')}
        </Button>
      </div>
    </div>
  );
}
