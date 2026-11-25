import type { PasswordStrength } from '@/lib/types';
import zxcvbn from 'zxcvbn';

export { SAFE_REDIRECT_PATHS, isValidRedirect } from './redirect';

// Password strength calculation
// Hybrid approach: zxcvbn for logic, mapped to UI needs + backward compatibility
export function calculatePasswordStrength(password: string) {
  if (!password) {
    return {
      score: 0,
      label: 'Empty',
      color: 'bg-gray-200',
      strength: 'weak' as PasswordStrength,
      feedback: [] as string[],
    };
  }

  const result = zxcvbn(password);
  const score = result.score;

  // Map zxcvbn score (0-4) to UI colors/labels
  const styles = [
    { label: 'Risky', color: 'bg-red-500' }, // 0
    { label: 'Weak', color: 'bg-orange-500' }, // 1
    { label: 'Fair', color: 'bg-yellow-500' }, // 2
    { label: 'Good', color: 'bg-blue-500' }, // 3
    { label: 'Strong', color: 'bg-green-500' }, // 4
  ];

  // Backward compatibility for existing components
  let strength: PasswordStrength = 'weak';
  if (score === 2) strength = 'fair';
  if (score === 3) strength = 'good';
  if (score >= 4) strength = 'strong';

  return {
    score,
    ...styles[score],
    strength,
    feedback: result.feedback.warning ? [result.feedback.warning] : [],
  };
}
