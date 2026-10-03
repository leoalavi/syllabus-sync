'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/mq/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toastUtils } from '@/lib/utils/toast';
import { errorHandler } from '@/lib/utils/errorHandling';
import { calculatePasswordStrength } from '@/lib/utils/security';
import { API_ROUTES, SECURITY_CONFIG } from '@/lib/constants/config';
import type { TranslationKey } from '@/lib/i18n/translations';
import type { PasswordStrength } from '@/lib/types';

type ChangePasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

export function ChangePasswordDialog({ open, onOpenChange, t }: ChangePasswordDialogProps) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const schema = z
    .object({
      currentPassword: z.string().min(1, t('allFieldsRequired')),
      newPassword: z.string().min(SECURITY_CONFIG.MIN_PASSWORD_LENGTH, t('passwordTooShort')),
      confirmPassword: z.string().min(1, t('allFieldsRequired')),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('passwordsDoNotMatch'),
      path: ['confirmPassword'],
    });

  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const newPassword = watch('newPassword');

  const onSubmit = async (data: FormData) => {
    try {
      const response = await fetch(API_ROUTES.AUTH.PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toastUtils.error(t('settingsError'), t('tooManyAttempts'));
        } else if (result.error?.message) {
          toastUtils.error(t('settingsError'), result.error.message);
        } else {
          toastUtils.error(t('settingsError'), t('preferenceError'));
        }
        return;
      }

      toastUtils.success(t('changePassword'), t('passwordChangedSuccess'));
      onOpenChange(false);
      reset();
    } catch (error) {
      errorHandler.logError(error as Error, 'Change Password', 'medium');
      toastUtils.error(t('settingsError'), t('preferenceError'));
    }
  };

  const passwordStrength = newPassword ? calculatePasswordStrength(newPassword) : null;

  const strengthColors: Record<PasswordStrength, string> = {
    weak: 'bg-mq-error',
    fair: 'bg-mq-warning',
    good: 'bg-mq-info',
    strong: 'bg-mq-success',
  };

  const strengthLabels: Record<PasswordStrength, TranslationKey> = {
    weak: 'passwordWeak',
    fair: 'passwordFair',
    good: 'passwordGood',
    strong: 'passwordStrong',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="password-dialog">
        <DialogHeader>
          <DialogTitle>{t('changePasswordTitle')}</DialogTitle>
          <DialogDescription>{t('changePasswordDialogDesc')}</DialogDescription>
        </DialogHeader>

        <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          {/* Current Password */}
          <div className="space-y-2">
            <label htmlFor="current-password" className="text-sm font-medium text-mq-content">
              {t('currentPassword')}
            </label>
            <div className="relative">
              <input
                id="current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                className={`w-full px-3 py-2 pr-10 rounded-mq border bg-mq-background text-mq-content focus:outline-none focus:ring-2 focus:ring-mq-primary ${
                  errors.currentPassword ? 'border-mq-error' : 'border-mq-border'
                }`}
                placeholder={t('passwordPlaceholder')}
                autoComplete="current-password"
                data-testid="current-password-input"
                {...register('currentPassword')}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-mq-content-tertiary hover:text-mq-content"
                aria-label={showCurrentPassword ? t('hidePassword') : t('showPassword')}
                data-testid="toggle-current-password"
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-mq-xs text-mq-error">{errors.currentPassword.message}</p>
            )}
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm font-medium text-mq-content">
              {t('newPassword')}
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                className={`w-full px-3 py-2 pr-10 rounded-mq border bg-mq-background text-mq-content focus:outline-none focus:ring-2 focus:ring-mq-primary ${
                  errors.newPassword ? 'border-mq-error' : 'border-mq-border'
                }`}
                placeholder={t('passwordPlaceholder')}
                autoComplete="new-password"
                data-testid="new-password-input"
                {...register('newPassword')}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-mq-content-tertiary hover:text-mq-content"
                aria-label={showNewPassword ? t('hidePassword') : t('showPassword')}
                data-testid="toggle-new-password"
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-mq-xs text-mq-error">{errors.newPassword.message}</p>
            )}

            {/* Password Strength Indicator */}
            {passwordStrength && (
              <div className="space-y-1" data-testid="password-strength">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((index) => (
                    <div
                      key={index}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        index < passwordStrength.score
                          ? strengthColors[passwordStrength.strength]
                          : 'bg-mq-border'
                      }`}
                    />
                  ))}
                </div>
                <p
                  className={`text-mq-xs ${
                    passwordStrength.strength === 'weak'
                      ? 'text-mq-error'
                      : passwordStrength.strength === 'fair'
                        ? 'text-mq-warning'
                        : passwordStrength.strength === 'good'
                          ? 'text-mq-info'
                          : 'text-mq-success'
                  }`}
                >
                  {t(strengthLabels[passwordStrength.strength])}
                </p>
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm font-medium text-mq-content">
              {t('confirmNewPassword')}
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                className={`w-full px-3 py-2 pr-10 rounded-mq border bg-mq-background text-mq-content focus:outline-none focus:ring-2 focus:ring-mq-primary ${
                  errors.confirmPassword ? 'border-mq-error' : 'border-mq-border'
                }`}
                placeholder={t('passwordPlaceholder')}
                autoComplete="new-password"
                data-testid="confirm-password-input"
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-mq-content-tertiary hover:text-mq-content"
                aria-label={showConfirmPassword ? t('hidePassword') : t('showPassword')}
                data-testid="toggle-confirm-password"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-mq-xs text-mq-error">{errors.confirmPassword.message}</p>
            )}
          </div>

          <DialogFooter className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="submit-password-change">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  {t('loading')}
                </>
              ) : (
                t('changePassword')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
