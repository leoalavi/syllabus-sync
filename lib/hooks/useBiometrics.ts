import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_ROUTES } from '@/lib/constants/config';
import { toastUtils } from '@/lib/utils/toast';
import { errorHandler } from '@/lib/utils/errorHandling';
import type { TranslationKey } from '@/lib/i18n/translations';

// Check if WebAuthn/biometric authentication is available
function isBiometricAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.PublicKeyCredential;
}

// Check if platform authenticator (Touch ID, Face ID, Windows Hello) is available
async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.PublicKeyCredential) return false;

  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

type UseBiometricsProps = {
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

/**
 * Hook for managing biometric authentication methods (WebAuthn/Passkeys).
 * Handles checking availability, registration, and toggling of biometric access.
 *
 * @param props.t - Translation function for localizing error/status messages.
 * @returns Object containing:
 * - biometricEnabled: parameters state of biometric preference.
 * - biometricAvailable: boolean indicating if browser supports WebAuthn.
 * - platformAuthAvailable: boolean indicating if a platform authenticator (FaceID, etc.) is present.
 * - enableBiometric: Function to start the WebAuthn registration ceremony.
 * - disableBiometric: Function to revoke biometric access.
 */
export function useBiometrics({ t }: UseBiometricsProps) {
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [platformAuthAvailable, setPlatformAuthAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const base64UrlToUint8Array = useCallback((value: string) => {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const base64 = padded.padEnd(Math.ceil(padded.length / 4) * 4, '=');
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }, []);

  const bufferToBase64Url = useCallback((buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    const base64 = window.btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }, []);

  // Check biometric availability on mount
  useEffect(() => {
    const checkAvailability = async () => {
      setBiometricAvailable(isBiometricAvailable());
      const platformAuth = await isPlatformAuthenticatorAvailable();
      setPlatformAuthAvailable(platformAuth);
    };
    checkAvailability();
  }, []);

  const { data: biometricStatus, isLoading: isQueryLoading } = useQuery({
    queryKey: ['biometricStatus'],
    queryFn: async () => {
      const response = await fetch(API_ROUTES.AUTH.BIOMETRIC_TOGGLE);
      if (!response.ok) throw new Error('Failed to fetch biometric status');
      return response.json();
    },
    enabled: platformAuthAvailable,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    if (biometricStatus?.data && platformAuthAvailable) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBiometricEnabled(Boolean(biometricStatus.data.enabled));
    }
  }, [biometricStatus, platformAuthAvailable]);

  // derived state for compatibility
  const isStatusLoading = isQueryLoading;

  const enableBiometric = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!platformAuthAvailable || typeof window === 'undefined') {
        toastUtils.error(t('biometricSetupFailed'), t('biometricSetupFailedMsg'));
        return false;
      }

      const optionsResponse = await fetch(API_ROUTES.AUTH.PASSKEY_REGISTER_OPTIONS, {
        method: 'POST',
      });
      const optionsResult = await optionsResponse.json();
      const options = optionsResult?.data?.options;

      if (!optionsResponse.ok || !options) {
        toastUtils.error(t('biometricSetupFailed'), t('biometricSetupFailedMsg'));
        return false;
      }

      const publicKey: PublicKeyCredentialCreationOptions = {
        ...options,
        challenge: base64UrlToUint8Array(options.challenge),
        user: {
          ...options.user,
          id: base64UrlToUint8Array(options.user.id),
        },
        excludeCredentials: (options.excludeCredentials || []).map(
          (credential: { id: string; type: PublicKeyCredentialType }) => ({
            ...credential,
            id: base64UrlToUint8Array(credential.id),
          }),
        ),
      };

      const credential = (await navigator.credentials.create({
        publicKey,
      })) as PublicKeyCredential | null;

      if (!credential) {
        toastUtils.error(t('biometricSetupFailed'), t('biometricSetupFailedMsg'));
        return false;
      }

      const attestation = credential.response as AuthenticatorAttestationResponse;
      const transports = attestation.getTransports?.() ?? [];

      const credentialPayload = {
        id: credential.id,
        rawId: bufferToBase64Url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: bufferToBase64Url(attestation.clientDataJSON),
          attestationObject: bufferToBase64Url(attestation.attestationObject),
          transports,
        },
        clientExtensionResults: credential.getClientExtensionResults(),
      };

      const saveResponse = await fetch(API_ROUTES.AUTH.PASSKEY_REGISTER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: credentialPayload,
        }),
      });

      if (!saveResponse.ok) {
        toastUtils.error(t('biometricSetupFailed'), t('biometricSetupFailedMsg'));
        return false;
      }

      setBiometricEnabled(true);
      toastUtils.success(t('biometricEnabled'), t('biometricEnabledMsg'));
      return true;
    } catch (error) {
      errorHandler.logError(error as Error, 'Enable Biometric', 'medium');
      toastUtils.error(t('biometricSetupFailed'), t('biometricSetupFailedMsg'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [base64UrlToUint8Array, bufferToBase64Url, platformAuthAvailable, t]);

  const disableBiometric = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_ROUTES.AUTH.BIOMETRIC_TOGGLE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });

      if (!response.ok) {
        toastUtils.error(t('error'), t('tryAgainLater'));
        return false;
      }

      if (navigator.credentials?.preventSilentAccess) {
        await navigator.credentials.preventSilentAccess();
      }

      setBiometricEnabled(false);
      toastUtils.success(t('biometricDisabled'), t('biometricDisabledMsg'));
      return true;
    } catch (error) {
      errorHandler.logError(error as Error, 'Disable Biometric', 'medium');
      toastUtils.error(t('error'), t('tryAgainLater'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  return {
    biometricEnabled,
    biometricAvailable,
    platformAuthAvailable,
    isLoading,
    isStatusLoading,
    enableBiometric,
    disableBiometric,
  };
}
