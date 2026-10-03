// lib/constants.ts

// Re-export app configuration from config.ts to maintain single source of truth
export { APP_CONFIG, UNIT_COLORS } from '../config';

// Derive APP_NAME and APP_DESCRIPTION from config for backward compatibility
import { APP_CONFIG } from '../config';
import type { DayOfWeek, Deadline, Event } from '../types';
export const APP_NAME = APP_CONFIG.name;
export const APP_DESCRIPTION = APP_CONFIG.description;

// Routes
export const ROUTES = {
  HOME: '/home',
  MAP: '/map',
  CALENDAR: '/calendar',
  FEED: '/feed',
  SETTINGS: '/settings',
} as const;

// Days of the week
export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const DAY_SHORT: Record<DayOfWeek, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

// Priority levels
export const PRIORITY_LEVELS = ['Low', 'Medium', 'High', 'Urgent'] as const;

// Internal stress-level tokens used by deadline scoring and homepage KPI rendering
export const STRESS_LEVELS = {
  LOW: 'Low',
  BUSY: 'Busy',
  HIGH: 'High',
} as const;

// Deadline types
export const DEADLINE_TYPES = ['Assignment', 'Exam', 'Quiz', 'Presentation'] as const;

// Event categories
export const EVENT_CATEGORIES = ['Career', 'Social', 'Academic', 'Free Food'] as const;

// Priority colors for badges - High is orange, Urgent is red for visual distinction
export const PRIORITY_COLORS: Record<Deadline['priority'], string> = {
  Low: 'bg-emerald-500 text-white border border-emerald-600',
  Medium: 'bg-amber-500 text-white border border-amber-600',
  High: 'bg-orange-500 text-white border border-orange-600',
  Urgent: 'bg-red-600 text-white border border-red-700',
};

// Category colors for events
export const CATEGORY_COLORS: Record<Event['category'], string> = {
  Career: 'bg-mq-info/10 text-mq-info border border-mq-info/20',
  Social: 'bg-mq-purple/10 text-mq-purple border border-mq-purple/20',
  Academic: 'bg-mq-success/10 text-mq-success border border-mq-success/20',
  'Free Food': 'bg-mq-warning/10 text-mq-warning border border-mq-warning/20',
};

// Time format options
export const TIME_FORMAT = {
  HOUR_12: 'h:mm a',
  HOUR_24: 'HH:mm',
} as const;

// Date format options
export const DATE_FORMAT = {
  SHORT: 'MMM d',
  MEDIUM: 'MMM d, yyyy',
  LONG: 'MMMM d, yyyy',
  FULL: 'EEEE, MMMM d, yyyy',
} as const;

// LocalStorage keys
export const STORAGE_KEYS = {
  SESSIONS: 'mq-sessions',
  NOTIFICATION_DEADLINES: 'notification-deadlines',
  NOTIFICATION_CLASSES: 'notification-classes',
  NOTIFICATION_EVENTS: 'notification-events',
  THEME: 'theme-storage',
  LANGUAGE: 'language-storage',
  UNITS: 'units-storage',
  DEADLINES: 'deadlines-storage',
} as const;
