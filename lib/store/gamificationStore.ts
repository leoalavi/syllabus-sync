import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiRequest } from '@/lib/utils/api';
import type { GamificationProfile, XPEvent, GamificationSettings } from '@/lib/types';
import { DEFAULT_GAMIFICATION_SETTINGS } from '@/lib/types';

// ============================================================================
// TYPES (Re-export from centralized types)
// ============================================================================

export type { GamificationProfile, XPEvent } from '@/lib/types';

interface GamificationState {
  profile: GamificationProfile | null;
  recentEvents: XPEvent[];
  isLoading: boolean;
  hasLoaded: boolean;
  isDemo: boolean;
  error: string | null;
  settings: GamificationSettings;

  // Actions
  loadProfile: (includeEvents?: boolean) => Promise<void>;
  recordActivity: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateSettings: (settings: Partial<GamificationSettings>) => void;
  resetSettings: () => void;
  resetProgress: () => void;
  reset: () => void;

  // Computed helpers
  getLevelTitle: () => string;
  getStreakEmoji: () => string;
}

// ============================================================================
// LEVEL TITLES - Fun titles for each level range
// ============================================================================

const LEVEL_TITLES: Record<number, string> = {
  1: 'Freshman',
  2: 'Eager Learner',
  3: 'Rising Star',
  4: 'Dedicated Scholar',
  5: 'Academic Achiever',
  6: 'Knowledge Seeker',
  7: 'Study Champion',
  8: "Dean's Lister",
  9: 'Academic Elite',
  10: 'Scholarly Master',
  // 11+ use formula-based titles
};

function getLevelTitleForLevel(level: number): string {
  if (level <= 10) {
    return LEVEL_TITLES[level] || 'Student';
  }
  if (level <= 20) return 'Academic Veteran';
  if (level <= 30) return 'Knowledge Expert';
  if (level <= 50) return 'Scholarly Legend';
  if (level <= 75) return 'Academic Titan';
  return 'Grand Scholar';
}

// ============================================================================
// STREAK EMOJIS - Visual feedback for streak milestones
// ============================================================================

function getStreakEmojiForDays(days: number): string {
  if (days === 0) return '';
  if (days < 3) return '🔥';
  if (days < 7) return '🔥🔥';
  if (days < 14) return '🔥🔥🔥';
  if (days < 30) return '⚡🔥';
  if (days < 60) return '💎🔥';
  return '👑🔥';
}

// ============================================================================
// DEFAULT STATE
// ============================================================================

const DEFAULT_PROFILE: GamificationProfile = {
  xp: 0,
  level: 1,
  streakDays: 0,
  longestStreak: 0,
  lastActivityDate: null,
  xpToNextLevel: 25,
  xpForCurrentLevel: 0,
  levelProgress: 0,
};

// ============================================================================
// STORE
// ============================================================================

// Several widgets (sidebar badge, XP bar, streak, stats) call loadProfile() in
// the same render pass. Share the in-flight request per includeEvents value so
// they make one GET instead of one each.
const pendingProfileLoads = new Map<boolean, Promise<void>>();

export const useGamificationStore = create<GamificationState>()(
  persist(
    (set, get) => ({
      profile: null,
      recentEvents: [],
      isLoading: false,
      hasLoaded: false,
      isDemo: false,
      error: null,
      settings: DEFAULT_GAMIFICATION_SETTINGS,

      loadProfile: (includeEvents = true) => {
        // Don't reload if already loaded (unless forced via refreshProfile)
        if (get().hasLoaded && get().profile) return Promise.resolve();
        const pending = pendingProfileLoads.get(includeEvents);
        if (pending) return pending;
        const request = (async () => {
          set({ isLoading: true, error: null });

          try {
            const params = new URLSearchParams();
            if (includeEvents) {
              params.set('events', 'true');
              params.set('limit', '10');
            }

            const response = await apiRequest<{
              profile: GamificationProfile;
              events?: XPEvent[];
              isDemo: boolean;
            }>(`/api/gamification?${params.toString()}`);

            set({
              profile: response.profile,
              recentEvents: response.events ?? [],
              isDemo: response.isDemo,
              hasLoaded: true,
              isLoading: false,
            });
          } catch (error) {
            console.warn('Failed to load gamification profile:', error);
            // Fall back to default profile
            set({
              profile: DEFAULT_PROFILE,
              recentEvents: [],
              isDemo: true,
              hasLoaded: true,
              isLoading: false,
              error: error instanceof Error ? error.message : 'Failed to load profile',
            });
          }
        })().finally(() => {
          pendingProfileLoads.delete(includeEvents);
        });
        pendingProfileLoads.set(includeEvents, request);
        return request;
      },

      recordActivity: async () => {
        // Only record activity for authenticated users
        if (get().isDemo) return;

        try {
          const response = await apiRequest<{
            message: string;
            profile: GamificationProfile;
          }>('/api/gamification', {
            method: 'POST',
          });

          set({
            profile: response.profile,
          });
        } catch (error) {
          // Silently fail - streak tracking is not critical
          console.warn('Failed to record activity:', error);
        }
      },

      refreshProfile: async () => {
        // Force reload by resetting hasLoaded
        set({ hasLoaded: false });
        await get().loadProfile(true);
      },

      updateSettings: (newSettings: Partial<GamificationSettings>) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      resetSettings: () => {
        set({ settings: DEFAULT_GAMIFICATION_SETTINGS });
      },

      resetProgress: () => {
        set({
          profile: {
            xp: 0,
            level: 1,
            streakDays: 0,
            longestStreak: 0,
            lastActivityDate: null,
            xpToNextLevel: 25,
            xpForCurrentLevel: 0,
            levelProgress: 0,
          },
          recentEvents: [],
        });
      },

      reset: () => {
        set({
          profile: null,
          recentEvents: [],
          hasLoaded: false,
          isLoading: false,
          isDemo: false,
          error: null,
          settings: DEFAULT_GAMIFICATION_SETTINGS,
        });
      },

      getLevelTitle: () => {
        const profile = get().profile;
        if (!profile) return 'Student';
        return getLevelTitleForLevel(profile.level);
      },

      getStreakEmoji: () => {
        const profile = get().profile;
        if (!profile) return '';
        return getStreakEmojiForDays(profile.streakDays);
      },
    }),
    {
      name: 'syllabus-sync-gamification',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist profile and events, not loading/error state
        profile: state.profile,
        recentEvents: state.recentEvents,
        isDemo: state.isDemo,
        settings: state.settings,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<GamificationState>),
        // Always force a fresh profile fetch on app boot
        hasLoaded: false,
        isLoading: false,
        error: null,
      }),
    },
  ),
);

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Get computed XP progress for display
 */
export function useXPProgress() {
  const profile = useGamificationStore((state) => state.profile);

  if (!profile) {
    return {
      currentXP: 0,
      level: 1,
      progress: 0,
      xpToNext: 25,
      xpInLevel: 0,
      xpNeededForLevel: 25,
    };
  }

  const xpInLevel = Math.max(0, profile.xp - profile.xpForCurrentLevel);
  const xpNeededForLevel = Math.max(0, xpInLevel + profile.xpToNextLevel);

  return {
    currentXP: profile.xp,
    level: profile.level,
    progress: profile.levelProgress,
    xpToNext: profile.xpToNextLevel,
    xpInLevel,
    xpNeededForLevel,
  };
}

/**
 * Get streak info for display
 */
export function useStreak() {
  const profile = useGamificationStore((state) => state.profile);
  const getStreakEmoji = useGamificationStore((state) => state.getStreakEmoji);

  if (!profile) {
    return {
      days: 0,
      longest: 0,
      emoji: '',
      isActive: false,
    };
  }

  // Streak is considered "active" if user has any streak days
  // The actual streak validation happens server-side when recording activity
  // Here we just display the current state from the database
  const isActive = profile.streakDays > 0;

  return {
    days: profile.streakDays,
    longest: profile.longestStreak,
    emoji: getStreakEmoji(),
    isActive,
  };
}
