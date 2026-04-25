/**
 * Password Strength Indicator Component
 *
 * SECURITY: This component provides real-time password strength feedback
 * to help users create strong, secure passwords.
 *
 * Features:
 * - Real-time strength assessment
 * - Visual strength meter
 * - Strength requirements checklist
 * - Breach checking integration
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Shield, AlertCircle, Check, X } from "lucide-react";
import { logger } from "@/lib/logger";
import { useTypedTranslation } from "@/lib/hooks/useTypedTranslation";
import type { TranslationKey } from "@/lib/i18n/translations";

// ============================================================================
// TYPES
// ============================================================================

export interface PasswordStrengthResult {
  score: number; // 0-4
  strength: "very weak" | "weak" | "fair" | "strong" | "very strong";
  breachResult?: {
    isBreached: boolean;
    breachCount: number;
    riskLevel: "low" | "medium" | "high" | "critical";
  };
  suggestions: string[];
}

export interface PasswordStrengthIndicatorProps {
  /** The password to analyze */
  password: string;
  /** Whether to check for breaches (requires API call) */
  checkBreaches?: boolean;
  /** Whether to show suggestions */
  showSuggestions?: boolean;
  /** Whether to show requirements checklist */
  showRequirements?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when strength changes */
  onStrengthChange?: (result: PasswordStrengthResult) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_PASSWORD_LENGTH = 12;
const STRENGTH_COLORS = {
  "very weak": "bg-red-500",
  weak: "bg-orange-500",
  fair: "bg-yellow-500",
  strong: "bg-green-500",
  "very strong": "bg-emerald-500",
};

const STRENGTH_TEXT_COLORS = {
  "very weak": "text-red-500",
  weak: "text-orange-500",
  fair: "text-yellow-500",
  strong: "text-green-500",
  "very strong": "text-emerald-500",
};

// ============================================================================
// COMPONENT
// ============================================================================

export function PasswordStrengthIndicator({
  password,
  checkBreaches = false,
  showSuggestions = true,
  showRequirements = true,
  className = "",
  onStrengthChange,
}: PasswordStrengthIndicatorProps) {
  const { t } = useTypedTranslation();
  const [strength, setStrength] = useState<PasswordStrengthResult>({
    score: 0,
    strength: "very weak",
    suggestions: [],
  });
  const [isCheckingBreaches, setIsCheckingBreaches] = useState(false);

  // Calculate password strength
  const calculateStrength = useCallback(
    (pwd: string): PasswordStrengthResult => {
      let score = 0;
      const suggestions: string[] = [];

      // Length check
      if (pwd.length >= MIN_PASSWORD_LENGTH) {
        score += 1;
      } else {
        suggestions.push(
          t("minLengthRequirement", { count: MIN_PASSWORD_LENGTH }),
        );
      }

      if (pwd.length >= 16) {
        score += 1;
      }

      // Complexity checks
      const hasLower = /[a-z]/.test(pwd);
      const hasUpper = /[A-Z]/.test(pwd);
      const hasNumber = /[0-9]/.test(pwd);
      const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);

      if (hasLower) score += 1;
      else suggestions.push(t("lowercaseRequirement"));

      if (hasUpper) score += 1;
      else suggestions.push(t("uppercaseRequirement"));

      if (hasNumber) score += 1;
      else suggestions.push(t("numberRequirement"));

      if (hasSpecial) score += 1;
      else suggestions.push(t("specialCharRequirement"));

      // Variety bonus
      const varietyCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(
        Boolean,
      ).length;
      if (varietyCount >= 3) {
        score += 1;
      }

      // Normalize to 0-4
      const normalizedScore = Math.min(4, Math.floor(score / 2));

      // Get strength label
      const strengthLabels: (
        | "very weak"
        | "weak"
        | "fair"
        | "strong"
        | "very strong"
      )[] = ["very weak", "weak", "fair", "strong", "very strong"];

      return {
        score: normalizedScore,
        strength: strengthLabels[Math.max(0, Math.min(4, normalizedScore))],
        suggestions,
      };
    },
    [t],
  );

  // Check for password breaches
  const performBreachCheck = useCallback(
    async (pwd: string) => {
      if (!checkBreaches || pwd.length < 8) {
        return;
      }

      setIsCheckingBreaches(true);
      try {
        const response = await fetch("/api/security/check-password-breach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pwd }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.result?.isBreached) {
            setStrength((prev) => ({
              ...prev,
              breachResult: data.result,
              suggestions: [t("passwordBreached"), ...prev.suggestions],
            }));
          }
        }
      } catch (error) {
        logger.error("Breach check error:", error);
      } finally {
        setIsCheckingBreaches(false);
      }
    },
    [checkBreaches, t],
  );

  // Update strength when password changes
  useEffect(() => {
    if (!password) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStrength({
        score: 0,
        strength: "very weak",
        suggestions: [],
      });
      return;
    }

    const result = calculateStrength(password);
    setStrength(result);

    // Notify parent component
    if (onStrengthChange) {
      onStrengthChange(result);
    }

    // Check for breaches (debounced)
    const timer = setTimeout(() => {
      performBreachCheck(password);
    }, 500);

    return () => clearTimeout(timer);
  }, [password, calculateStrength, performBreachCheck, onStrengthChange]);

  // Get requirements status
  const requirements = [
    {
      label: t("minLengthRequirement", { count: MIN_PASSWORD_LENGTH }),
      met: password.length >= MIN_PASSWORD_LENGTH,
    },
    { label: t("lowercaseLabel"), met: /[a-z]/.test(password) },
    { label: t("uppercaseLabel"), met: /[A-Z]/.test(password) },
    { label: t("numberLabel"), met: /[0-9]/.test(password) },
    { label: t("specialCharLabel"), met: /[^a-zA-Z0-9]/.test(password) },
  ];

  const metRequirements = requirements.filter((r) => r.met).length;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Strength Meter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("passwordStrength")}
          </span>
          <span
            className={`text-sm font-semibold ${STRENGTH_TEXT_COLORS[strength.strength]}`}
          >
            {t(
              `strength_${strength.strength.replace(" ", "")}` as TranslationKey,
            )}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${STRENGTH_COLORS[strength.strength]}`}
            style={{ width: `${(strength.score / 4) * 100}%` }}
          />
        </div>

        {/* Strength Icon */}
        <div className="flex items-center gap-2">
          {strength.score >= 3 ? (
            <Shield className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-orange-500" />
          )}
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {strength.score >= 3
              ? t("strongPassword")
              : t("makePasswordStronger")}
          </span>
        </div>
      </div>

      {/* Breach Warning */}
      {strength.breachResult?.isBreached && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {t("passwordBreached")}
            </p>
            <p className="text-xs text-red-600 dark:text-red-300 mt-1">
              {t("passwordBreachCount", {
                count: strength.breachResult.breachCount,
              })}
            </p>
          </div>
        </div>
      )}

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("requirements")}
          </p>
          <div className="space-y-1">
            {requirements.map((req, index) => (
              <div key={index} className="flex items-center gap-2">
                {req.met ? (
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : (
                  <X className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    req.met
                      ? "text-green-700 dark:text-green-300"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {req.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("requirementsMet", {
              met: metRequirements,
              total: requirements.length,
            })}
          </p>
        </div>
      )}

      {/* Suggestions */}
      {showSuggestions && strength.suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("suggestions")}
          </p>
          <ul className="space-y-1">
            {strength.suggestions.map((suggestion, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
              >
                <span className="text-blue-500 mt-0.5">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Loading State */}
      {isCheckingBreaches && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>{t("checkingDataBreaches")}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default PasswordStrengthIndicator;
