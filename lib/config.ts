/**
 * University/Organization Configuration
 */
export const UNIVERSITY_CONFIG = {
  name: 'Macquarie University',
  shortName: 'Macquarie University',
  website: 'https://www.mq.edu.au',
} as const;

/**
 * App Configuration
 */
export const APP_CONFIG = {
  name: 'Syllabus Sync',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  description: 'Independent student platform for academic planning and university life',
  fullDescription: `Syllabus Sync is an independent student platform for academic planning and university-life management, currently developed and validated around ${UNIVERSITY_CONFIG.name}. Not officially affiliated with the university.`,
  contactEmail: 'leo@leoalavi.dev',
  version: '1.0.0',
} as const;

/**
 * Default User Configuration
 */
export const DEMO_USER = {
  name: 'Student',
  studentId: '',
  email: '',
} as const;

/**
 * MQ Brand Colors
 */
export const BRAND_COLORS = {
  primary: '#A6192E', // Macquarie Red
  secondary: '#002A45', // Macquarie Blue
  accent: '#FFB81C', // Macquarie Gold
} as const;

/**
 * Unit Color Palette
 */
export const UNIT_COLORS = [
  { name: 'Red', value: '#A6192E', translationKey: 'colorUniversityRed' },
  { name: 'Blue', value: '#1E5AA8', translationKey: 'colorUniversityBlue' },
  { name: 'Gold', value: '#FFB81C', translationKey: 'colorUniversityGold' },
  { name: 'Green', value: '#10b981', translationKey: 'colorGreen' },
  { name: 'Purple', value: '#a855f7', translationKey: 'colorPurple' },
  { name: 'Orange', value: '#f97316', translationKey: 'colorOrange' },
  { name: 'Pink', value: '#ec4899', translationKey: 'colorPink' },
  { name: 'Cyan', value: '#06b6d4', translationKey: 'colorCyan' },
] as const;

export { buildings as CAMPUS_BUILDINGS } from '@/features/map/lib/buildings';

/**
 * Feature Flags
 */
export const FEATURES = {
  showComingSoonBadges: true,
  mapEnabled: true,
  calendarEnabled: true,
  notificationsEnabled: true,
  userSettingsEnabled: true,
} as const;

export const HOME_STYLE_VARIANT = 'solid';

/**
 * Social Links
 */
export const SOCIAL_LINKS = {
  linkedin: 'https://www.linkedin.com/company/syllabuss-sync/',
} as const;

/**
 * External Links
 */
export const EXTERNAL_LINKS = {
  projectInfo: 'https://info.syllabus-sync.app',
  feedback: 'mailto:leo@leoalavi.dev?subject=Syllabus Sync Feedback',
  privacy: '/privacy',
  terms: '/terms',
} as const;
