'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/mq/button';
import { Input } from '@/components/ui/mq/input';
import {
  Fingerprint,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Smartphone,
  Info,
  Shield,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { TranslationKey } from '@/lib/i18n/translations';
import { toastUtils } from '@/lib/utils/toast';
import { API_ROUTES } from '@/lib/constants/config';
import { useBiometrics } from '@/lib/hooks/useBiometrics';
import { ToggleControl } from '../ToggleControl';

interface PasskeyCredential {
  id: string;
  credentialId: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface PasskeySecuritySectionProps {
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

export function PasskeySecuritySection({ t }: PasskeySecuritySectionProps) {
  // --- Biometric Toggle Logic (from BiometricToggle.tsx) ---
  const {
    biometricEnabled,
    biometricAvailable,
    platformAuthAvailable,
    isLoading: isBiometricLoading,
    isStatusLoading: isBiometricStatusLoading,
    enableBiometric,
    disableBiometric,
  } = useBiometrics({ t });

  const [showEnableBioDialog, setShowEnableBioDialog] = useState(false);
  const [showDisableBioDialog, setShowDisableBioDialog] = useState(false);

  const handleEnableBio = async () => {
    const success = await enableBiometric();
    if (success) {
      setShowEnableBioDialog(false);
    }
  };

  const handleDisableBio = async () => {
    const success = await disableBiometric();
    if (success) {
      setShowDisableBioDialog(false);
    }
  };

  const canToggleBio =
    biometricAvailable && platformAuthAvailable && !isBiometricLoading && !isBiometricStatusLoading;

  const getBioStatusText = () => {
    if (!biometricAvailable) return t('notSupported');
    if (!platformAuthAvailable) return t('noDeviceFound');
    return biometricEnabled ? t('enabled') : t('disabled');
  };

  // --- Passkey Management Logic (from PasskeyManager.tsx) ---
  const [credentials, setCredentials] = useState<PasskeyCredential[]>([]);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [isFetchingPasskeys, setIsFetchingPasskeys] = useState(true);
  const [showAddPasskeyDialog, setShowAddPasskeyDialog] = useState(false);
  const [showDeletePasskeyDialog, setShowDeletePasskeyDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PasskeyCredential | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [addPasskeyError, setAddPasskeyError] = useState<string | null>(null);

  const fetchCredentials = useCallback(async () => {
    setIsFetchingPasskeys(true);
    try {
      const res = await fetch(API_ROUTES.AUTH.WEBAUTHN_CREDENTIALS);
      if (res.ok) {
        const result = await res.json();
        setCredentials(result?.data?.credentials ?? []);
      }
    } catch {
      // Silent fail — just show empty state
    } finally {
      setIsFetchingPasskeys(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCredentials();
  }, [fetchCredentials]);

  const handleAddPasskey = useCallback(async () => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      setAddPasskeyError(t('passkeysNotSupported'));
      return;
    }

    setIsPasskeyLoading(true);
    setAddPasskeyError(null);
    try {
      const optionsRes = await fetch(API_ROUTES.AUTH.WEBAUTHN_REGISTER_OPTIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceName: deviceName || t('passkeyDefaultName') }),
      });
      const optionsResult = await optionsRes.json();

      if (!optionsRes.ok || !optionsResult?.data?.options) {
        setAddPasskeyError(optionsResult?.error?.message || t('passkeySetupFailed'));
        return;
      }

      const options = optionsResult.data.options;

      const publicKey: PublicKeyCredentialCreationOptions = {
        ...options,
        challenge: base64UrlToUint8Array(options.challenge),
        user: {
          ...options.user,
          id: base64UrlToUint8Array(options.user.id),
        },
        excludeCredentials: (options.excludeCredentials || []).map(
          (c: { id: string; type: PublicKeyCredentialType }) => ({
            ...c,
            id: base64UrlToUint8Array(c.id),
          }),
        ),
      };

      const credential = (await navigator.credentials.create({
        publicKey,
      })) as PublicKeyCredential | null;

      if (!credential) {
        setAddPasskeyError(t('passkeyCreationCancelled'));
        return;
      }

      const attestation = credential.response as AuthenticatorAttestationResponse;
      const transports = attestation.getTransports?.() ?? [];

      const verifyRes = await fetch(API_ROUTES.AUTH.WEBAUTHN_REGISTER_VERIFY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: {
            id: credential.id,
            rawId: bufferToBase64Url(credential.rawId),
            type: credential.type,
            response: {
              clientDataJSON: bufferToBase64Url(attestation.clientDataJSON),
              attestationObject: bufferToBase64Url(attestation.attestationObject),
              transports,
            },
            clientExtensionResults: credential.getClientExtensionResults(),
          },
          deviceName: deviceName || t('passkeyDefaultName'),
        }),
      });

      if (!verifyRes.ok) {
        const result = await verifyRes.json();
        setAddPasskeyError(result?.error?.message || t('passkeyRegisterFailed'));
        return;
      }

      setShowAddPasskeyDialog(false);
      setDeviceName('');
      toastUtils.success(t('security'), t('passkeyAddedSuccess'));
      fetchCredentials();
    } catch (err) {
      setAddPasskeyError(err instanceof Error ? err.message : t('passkeyRegisterFailed'));
    } finally {
      setIsPasskeyLoading(false);
    }
  }, [deviceName, fetchCredentials, t]);

  const handleDeletePasskey = useCallback(async () => {
    if (!deleteTarget) return;

    setIsPasskeyLoading(true);
    try {
      const res = await fetch(API_ROUTES.AUTH.WEBAUTHN_CREDENTIALS, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialDbId: deleteTarget.id }),
      });

      if (!res.ok) {
        toastUtils.error(t('error'), t('failedToRemovePasskey'));
        return;
      }

      setShowDeletePasskeyDialog(false);
      setDeleteTarget(null);
      toastUtils.success(t('security'), t('passkeyRemoved'));
      fetchCredentials();
    } catch {
      toastUtils.error(t('error'), t('tryAgainLater'));
    } finally {
      setIsPasskeyLoading(false);
    }
  }, [deleteTarget, fetchCredentials, t]);

  return (
    <>
      <div className="p-4 bg-mq-card-background rounded-mq-lg border border-mq-border hover:shadow-[0_0_20px_rgba(166,25,46,0.08)] transition-all duration-300 space-y-6">
        {/* Section Header */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-mq-primary/10 rounded-lg text-mq-primary">
            <Fingerprint className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-mq-content">{t('passkeysBiometricLogin')}</h3>
            <p className="text-mq-xs text-mq-content-secondary mt-0.5">{t('passkeySigninDesc')}</p>
          </div>
        </div>

        {/* Master Biometric Toggle */}
        <div
          className="bg-mq-background/50 rounded-xl p-3 border border-mq-border/50 hover:bg-mq-background/70 hover:border-mq-primary/40 cursor-pointer transition-colors"
          role="button"
          tabIndex={0}
          onClick={(e) => {
            if (e && 'stopPropagation' in e) e.stopPropagation();
            if (canToggleBio) {
              if (biometricEnabled) setShowDisableBioDialog(true);
              else setShowEnableBioDialog(true);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (canToggleBio) {
                if (biometricEnabled) setShowDisableBioDialog(true);
                else setShowEnableBioDialog(true);
              }
            }
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pointer-events-none">
            <div className="min-w-0">
              <p className="text-mq-sm font-semibold text-mq-content">{t('biometricLogin')}</p>
              <p className="text-mq-xs text-mq-content-secondary mt-0.5">
                {t('biometricLoginDesc')}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:flex-shrink-0 pointer-events-auto">
              <ToggleControl
                checked={biometricEnabled}
                onToggle={(e?: React.MouseEvent | React.KeyboardEvent) => {
                  if (e && 'stopPropagation' in e) e.stopPropagation();
                  if (canToggleBio) {
                    if (biometricEnabled) setShowDisableBioDialog(true);
                    else setShowEnableBioDialog(true);
                  }
                }}
                label={t('biometricLogin')}
                testId="toggle-biometric"
              />
              <span className="text-mq-xs font-medium text-mq-content-secondary min-w-[60px] text-right">
                {getBioStatusText()}
              </span>
            </div>
          </div>

          {platformAuthAvailable && (
            <div className="mt-3 flex items-center gap-2 text-mq-xs text-mq-success bg-mq-success/5 px-2 py-1 rounded-md border border-mq-success/10 w-fit">
              <CheckCircle className="h-3 w-3" aria-hidden="true" />
              <span>{t('biometricDeviceReady')}</span>
            </div>
          )}

          {!platformAuthAvailable && biometricAvailable && (
            <div className="mt-3 flex items-start gap-2 text-mq-xs text-mq-warning bg-mq-warning/5 px-2 py-1 rounded-md border border-mq-warning/10">
              <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{t('biometricNotConfigured')}</span>
            </div>
          )}
        </div>

        {/* Registered Passkeys List - Only show if there are credentials OR biometric is not enabled */}
        {(credentials.length > 0 || !biometricEnabled) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-mq-content-tertiary flex items-center gap-2">
                <Shield className="h-3 w-3" />
                {t('registeredDevicesAndKeys')}
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs bg-mq-button-secondary hover:bg-mq-hover-background text-mq-content"
                onClick={() => {
                  setAddPasskeyError(null);
                  setDeviceName('');
                  setShowAddPasskeyDialog(true);
                }}
                disabled={isPasskeyLoading || isFetchingPasskeys}
                data-testid="add-passkey"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {t('addKey')}
              </Button>
            </div>

            {isFetchingPasskeys ? (
              <div className="py-4 text-center">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-mq-content-tertiary" />
              </div>
            ) : credentials.length === 0 ? (
              <div className="py-6 text-center bg-mq-background/30 rounded-xl border border-dashed border-mq-border">
                <p className="text-mq-xs text-mq-content-tertiary">{t('noSecurityKeys')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {credentials.map((cred) => (
                  <div
                    key={cred.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-mq-card-background border border-mq-border hover:border-mq-primary/20 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 bg-mq-background rounded-lg border border-mq-border group-hover:bg-mq-primary/5 transition-colors text-mq-content-secondary">
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-mq-content truncate">
                          {cred.deviceName}
                        </p>
                        <p className="text-[10px] text-mq-content-tertiary">
                          {t('addedOn', {
                            date: new Date(cred.createdAt).toLocaleDateString(),
                          })}
                          {cred.lastUsedAt &&
                            ` · ${t('lastUsedOn', { date: new Date(cred.lastUsedAt).toLocaleDateString() })}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeleteTarget(cred);
                        setShowDeletePasskeyDialog(true);
                      }}
                      className="h-8 w-8 p-0 text-mq-content-tertiary dark:text-white/60 hover:text-red-500 hover:bg-red-500/10 rounded-full"
                      aria-label={`${t('delete')} ${cred.deviceName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- Dialogs --- */}

      {/* Enable Biometric Dialog */}
      <Dialog open={showEnableBioDialog} onOpenChange={setShowEnableBioDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5" />
              {t('enableBiometric')}
            </DialogTitle>
            <DialogHeader>
              <DialogDescription>{t('enableBiometricDesc')}</DialogDescription>
            </DialogHeader>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start gap-3 p-3 bg-mq-info/10 rounded-mq-lg border border-mq-info/20">
              <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p className="text-mq-sm text-mq-content-secondary">{t('biometricPrivacyNote')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowEnableBioDialog(false)}
              disabled={isBiometricLoading}
            >
              {t('cancel')}
            </Button>
            <Button onClick={handleEnableBio} disabled={isBiometricLoading}>
              {isBiometricLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('settingUp')}
                </>
              ) : (
                t('enable')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable Biometric Dialog */}
      <Dialog open={showDisableBioDialog} onOpenChange={setShowDisableBioDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-mq-warning" />
              {t('disableBiometric')}
            </DialogTitle>
            <DialogDescription>{t('disableBiometricDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowDisableBioDialog(false)}
              disabled={isBiometricLoading}
            >
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDisableBio} disabled={isBiometricLoading}>
              {isBiometricLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('processing')}
                </>
              ) : (
                t('disable')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Passkey Dialog */}
      <Dialog open={showAddPasskeyDialog} onOpenChange={setShowAddPasskeyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-mq-primary" />
              {t('addSecurityKey')}
            </DialogTitle>
            <DialogDescription>{t('addSecurityKeyDesc')}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-mq-content">{t('deviceKeyName')}</p>
              <Input
                placeholder={t('passkeyNamePlaceholder')}
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                maxLength={100}
                className="h-12"
                autoFocus
              />
            </div>
            {addPasskeyError && (
              <div className="flex items-center gap-2 text-red-500 text-xs p-2 bg-red-500/5 rounded-lg border border-red-500/10">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{addPasskeyError}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowAddPasskeyDialog(false)}
              disabled={isPasskeyLoading}
            >
              {t('cancel')}
            </Button>
            <Button onClick={handleAddPasskey} disabled={isPasskeyLoading}>
              {isPasskeyLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('registering')}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t('registerKey')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeletePasskeyDialog} onOpenChange={setShowDeletePasskeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <Trash2 className="h-5 w-5" />
              {t('removeSecurityKey')}
            </DialogTitle>
            <DialogDescription>
              {t('removeSecurityKeyDesc', {
                name: deleteTarget?.deviceName || '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowDeletePasskeyDialog(false)}
              disabled={isPasskeyLoading}
            >
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeletePasskey} disabled={isPasskeyLoading}>
              {isPasskeyLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('removing')}
                </>
              ) : (
                t('removeKey')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// --- Helpers (copied from original PasskeyManager) ---

function base64UrlToUint8Array(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const base64 = padded.padEnd(Math.ceil(padded.length / 4) * 4, '=');
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const base64 = window.btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
