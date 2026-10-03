import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  jsonError,
  jsonSuccess,
  ERROR_CODES,
  handleValidationError,
} from '@/app/api/_lib/response';
import { requireAuth, parseJsonBody } from '@/app/api/_lib/middleware';
import { withCSRFProtection } from '@/lib/security/csrf';
import { apiLimiter } from '@/lib/services/rateLimitService';
import { getClientIP } from '@/lib/security/ip';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

interface AwardXPResult {
  xpAwarded: number;
  oldXp: number;
  newXp: number;
  oldLevel: number;
  newLevel: number;
  leveledUp: boolean;
}

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const awardXPSchema = z.discriminatedUnion('eventType', [
  z.object({
    eventType: z.literal('event_attended'),
    referenceId: z.string().uuid(),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
  }),
  z.object({
    eventType: z.literal('profile_completed'),
    referenceId: z.string().uuid().optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
  }),
]);

// ============================================================================
// LEVEL CALCULATION (mirrors database function)
// ============================================================================

function calculateLevel(xp: number): number {
  if (xp < 0) return 1;
  return Math.min(100, Math.floor(Math.sqrt(xp / 25)) + 1);
}

function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return (level - 1) * (level - 1) * 25;
}

// ============================================================================
// API HANDLER
// ============================================================================

/**
 * POST /api/gamification/award-xp - Award XP for specific events
 *
 * This endpoint is for awarding XP for events that are triggered from the client:
 * - event_attended: When user clicks "Remind Me" on an event
 * - profile_completed: When user completes their profile
 *
 * Other XP events (deadline_completed, unit_added, etc.) are handled by database triggers.
 *
 * Security:
 * - Requires authentication
 * - Rate limited to prevent abuse
 * - Only allows specific event types (prevents abuse)
 * - Uses database RPC function for atomic XP award
 * - Duplicate prevention for each event type
 */
export async function POST(request: NextRequest) {
  return withCSRFProtection(async (req: NextRequest) => {
    // SECURITY: Apply strict rate limiting for XP mutations (10 requests per minute)
    const clientIP = getClientIP(req);
    const { allowed, resetIn } = await apiLimiter(`award-xp:${clientIP}`);
    if (!allowed) {
      return jsonError(
        'Rate limit exceeded. Please try again later.',
        429,
        ERROR_CODES.RATE_LIMITED,
        { retryAfter: resetIn },
      );
    }

    return requireAuth(req, async (userId) => {
      // Parse and validate request body - SECURITY: Parse with size limit protection
      const bodyResult = await parseJsonBody(req);
      if (!bodyResult.success) {
        return jsonError(bodyResult.error, bodyResult.status, ERROR_CODES.VALIDATION_ERROR);
      }
      const parseResult = awardXPSchema.safeParse(bodyResult.data);

      if (!parseResult.success) {
        return handleValidationError(parseResult.error);
      }

      const { eventType, referenceId, metadata } = parseResult.data;

      // Additional security: Check for duplicate awards (prevent spam clicking)
      const supabase = await createServerClient();

      // For event_attended, verify the event exists and XP wasn't already awarded
      if (eventType === 'event_attended') {
        const { data: eventExists, error: eventCheckError } = await supabase
          .from('events')
          .select('id')
          .eq('id', referenceId)
          .maybeSingle();

        if (eventCheckError) {
          logger.error('Failed to validate event before XP award:', eventCheckError);
          return jsonError('Failed to validate event', 500, ERROR_CODES.INTERNAL_ERROR);
        }

        if (!eventExists) {
          return jsonError('Event not found', 404, ERROR_CODES.NOT_FOUND);
        }

        const { data: existingEvent, error: duplicateCheckError } = await supabase
          .from('xp_events')
          .select('id')
          .eq('user_id', userId)
          .eq('event_type', 'event_attended')
          .eq('reference_id', referenceId)
          .maybeSingle();

        if (duplicateCheckError) {
          logger.error('Failed duplicate check for event_attended XP award:', duplicateCheckError);
          return jsonError('Failed to validate XP award', 500, ERROR_CODES.INTERNAL_ERROR);
        }

        if (existingEvent) {
          return jsonError('XP already awarded for this event', 409, ERROR_CODES.CONFLICT, {
            eventType,
            referenceId,
          });
        }
      }

      // For profile_completed, check if already awarded (one-time bonus)
      if (eventType === 'profile_completed') {
        const { data: existingProfileXP, error: duplicateCheckError } = await supabase
          .from('xp_events')
          .select('id')
          .eq('user_id', userId)
          .eq('event_type', 'profile_completed')
          .maybeSingle();

        if (duplicateCheckError) {
          logger.error(
            'Failed duplicate check for profile_completed XP award:',
            duplicateCheckError,
          );
          return jsonError('Failed to validate XP award', 500, ERROR_CODES.INTERNAL_ERROR);
        }

        if (existingProfileXP) {
          return jsonError('Profile completion XP already awarded', 409, ERROR_CODES.CONFLICT, {
            eventType,
          });
        }
      }

      // Call the database function to award XP
      const { data: result, error } = await supabase.rpc('award_xp', {
        p_user_id: userId,
        p_event_type: eventType,
        p_reference_id: referenceId ?? null,
        p_metadata: metadata,
      });

      if (error) {
        logger.error('Failed to award XP:', error);
        return jsonError('Failed to award XP', 500, ERROR_CODES.INTERNAL_ERROR);
      }

      const rawResult = result as Record<string, unknown> | null;
      if (!rawResult) {
        logger.error('award_xp returned empty result', { userId, eventType });
        return jsonError('Failed to award XP', 500, ERROR_CODES.INTERNAL_ERROR);
      }

      const awardResult = parseAwardXPResult(rawResult);
      if (!awardResult) {
        logger.error('award_xp returned invalid payload', {
          userId,
          eventType,
          rawResult,
        });
        return jsonError('Failed to award XP', 500, ERROR_CODES.INTERNAL_ERROR);
      }

      // Fetch updated profile to return complete state
      const { data: profileData, error: profileError } = await supabase
        .from('gamification_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError) {
        // XP was awarded but failed to fetch profile - still return success
        logger.error('Failed to fetch updated profile:', profileError);
        return jsonSuccess({
          message: `Earned ${awardResult.xpAwarded} XP for ${eventType}!`,
          result: awardResult,
        });
      }

      const xp = profileData?.xp ?? awardResult.newXp;
      const level = calculateLevel(xp);
      const currentLevelXp = xpForLevel(level);
      const nextLevelXp = xpForLevel(level + 1);
      const xpInCurrentLevel = xp - currentLevelXp;
      const xpNeededForLevel = nextLevelXp - currentLevelXp;

      return jsonSuccess({
        message: `Earned ${awardResult.xpAwarded} XP for ${formatEventType(eventType)}!`,
        result: awardResult,
        profile: {
          xp,
          level,
          streakDays: profileData?.streak_days ?? 0,
          longestStreak: profileData?.longest_streak ?? 0,
          lastActivityDate: profileData?.last_activity_date ?? null,
          xpToNextLevel: nextLevelXp - xp,
          xpForCurrentLevel: currentLevelXp,
          levelProgress:
            xpNeededForLevel > 0 ? Math.round((xpInCurrentLevel / xpNeededForLevel) * 100) : 100,
        },
      });
    });
  })(request);
}

// ============================================================================
// HELPERS
// ============================================================================

function formatEventType(eventType: string): string {
  const eventTypeMap: Record<string, string> = {
    event_attended: 'attending an event',
    profile_completed: 'completing your profile',
  };
  return eventTypeMap[eventType] || eventType.replace(/_/g, ' ');
}

function parseAwardXPResult(rawResult: Record<string, unknown>): AwardXPResult | null {
  const xpAwarded = Number(rawResult.xp_awarded);
  const oldXp = Number(rawResult.old_xp);
  const newXp = Number(rawResult.new_xp);
  const oldLevel = Number(rawResult.old_level);
  const newLevel = Number(rawResult.new_level);
  const leveledUp =
    typeof rawResult.leveled_up === 'boolean'
      ? rawResult.leveled_up
      : Number(rawResult.leveled_up) > 0;

  if (
    !Number.isFinite(xpAwarded) ||
    !Number.isFinite(oldXp) ||
    !Number.isFinite(newXp) ||
    !Number.isFinite(oldLevel) ||
    !Number.isFinite(newLevel)
  ) {
    return null;
  }

  return {
    xpAwarded,
    oldXp,
    newXp,
    oldLevel,
    newLevel,
    leveledUp,
  };
}
