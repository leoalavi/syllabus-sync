import { jsonError, jsonSuccess, ERROR_CODES } from '@/app/api/_lib/response';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { sendPushNotificationToUser, isWebPushConfigured } from '@/lib/server/push';
import { matchesBearerToken } from '@/lib/security/constant-time';

const DEFAULT_LOOKAHEAD_MINUTES = 10;

function getLookaheadMinutes(): number {
  const rawValue = process.env.PUSH_REMINDER_LOOKAHEAD_MINUTES;
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN;

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_LOOKAHEAD_MINUTES;
}

type ReminderCandidate = {
  reminderKey: string;
  reminderType: 'deadline' | 'event';
  relatedId: string;
  scheduledFor: string;
  payload: {
    title: string;
    body: string;
    url: string;
    tag: string;
    data: Record<string, unknown>;
  };
};

type UserPreferenceRow = {
  user_id: string;
  notifications_enabled: boolean | null;
  push_notifications: boolean | null;
  deadline_notifications_enabled: boolean | null;
  event_notifications_enabled: boolean | null;
  deadline_reminder_timing_minutes: number | null;
  event_reminder_timing_minutes: number | null;
};

async function collectDeadlineReminders(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  preference: UserPreferenceRow,
  windowStart: Date,
  windowEnd: Date,
): Promise<ReminderCandidate[]> {
  if (!preference.deadline_notifications_enabled) {
    return [];
  }

  const timingMinutes = preference.deadline_reminder_timing_minutes ?? 1440;
  const dueWindowStart = new Date(windowStart.getTime() + timingMinutes * 60 * 1000);
  const dueWindowEnd = new Date(windowEnd.getTime() + timingMinutes * 60 * 1000);

  const { data, error } = await admin
    .from('deadlines')
    .select('id, title, unit_code, due_date')
    .eq('user_id', preference.user_id)
    .eq('completed', false)
    .gte('due_date', dueWindowStart.toISOString())
    .lt('due_date', dueWindowEnd.toISOString());

  if (error) {
    logger.error('Failed to collect deadline reminders', error);
    return [];
  }

  return (data ?? []).map((deadline) => ({
    reminderKey: `deadline:${deadline.id}:${timingMinutes}`,
    reminderType: 'deadline',
    relatedId: deadline.id,
    scheduledFor: deadline.due_date,
    payload: {
      title: `Deadline: ${deadline.title}`,
      body: `${deadline.unit_code} — due ${new Date(deadline.due_date).toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      url: '/calendar',
      tag: `deadline-${deadline.id}`,
      data: {
        type: 'deadline',
        id: deadline.id,
        relatedId: deadline.id,
      },
    },
  }));
}

async function collectEventReminders(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  preference: UserPreferenceRow,
  windowStart: Date,
  windowEnd: Date,
): Promise<ReminderCandidate[]> {
  if (!preference.event_notifications_enabled) {
    return [];
  }

  const timingMinutes = preference.event_reminder_timing_minutes ?? 60;
  const eventWindowStart = new Date(windowStart.getTime() + timingMinutes * 60 * 1000);
  const eventWindowEnd = new Date(windowEnd.getTime() + timingMinutes * 60 * 1000);

  const { data, error } = await admin
    .from('events')
    .select('id, title, start_at, location')
    .eq('user_id', preference.user_id)
    .gte('start_at', eventWindowStart.toISOString())
    .lt('start_at', eventWindowEnd.toISOString());

  if (error) {
    logger.error('Failed to collect event reminders', error);
    return [];
  }

  return (data ?? []).map((event) => ({
    reminderKey: `event:${event.id}:${timingMinutes}`,
    reminderType: 'event',
    relatedId: event.id,
    scheduledFor: event.start_at,
    payload: {
      title: event.title,
      body: event.location
        ? `Starting soon at ${event.location} — ${new Date(event.start_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`
        : `Starting soon — ${new Date(event.start_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`,
      url: '/feed',
      tag: `event-${event.id}`,
      data: {
        type: 'event',
        id: event.id,
        relatedId: event.id,
      },
    },
  }));
}

async function handlePushReminderCron() {
  const admin = createAdminClient();
  const lookaheadMinutes = getLookaheadMinutes();

  if (!admin) {
    return jsonError(
      'Supabase admin client is not configured',
      503,
      ERROR_CODES.SERVICE_UNAVAILABLE,
    );
  }

  if (!isWebPushConfigured()) {
    return jsonError('Web push is not configured', 503, ERROR_CODES.SERVICE_UNAVAILABLE);
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + lookaheadMinutes * 60 * 1000);

  const { data: preferences, error } = await admin
    .from('user_preferences')
    .select(
      'user_id, notifications_enabled, push_notifications, deadline_notifications_enabled, event_notifications_enabled, deadline_reminder_timing_minutes, event_reminder_timing_minutes',
    )
    .eq('notifications_enabled', true)
    .eq('push_notifications', true);

  if (error) {
    logger.error('Failed to load push reminder preferences', error);
    return jsonError('Failed to load reminder preferences', 500, ERROR_CODES.DATABASE_ERROR);
  }

  let reminderCount = 0;
  let deliveredReminderCount = 0;
  let sentPushCount = 0;
  let removedInvalidSubscriptionCount = 0;

  for (const preference of (preferences ?? []) as UserPreferenceRow[]) {
    const reminders = [
      ...(await collectDeadlineReminders(admin, preference, now, windowEnd)),
      ...(await collectEventReminders(admin, preference, now, windowEnd)),
    ];

    reminderCount += reminders.length;

    for (const reminder of reminders) {
      const { data: existingDelivery } = await admin
        .from('push_reminder_deliveries')
        .select('id')
        .eq('reminder_key', reminder.reminderKey)
        .maybeSingle();

      if (existingDelivery) {
        continue;
      }

      const result = await sendPushNotificationToUser(preference.user_id, reminder.payload);
      sentPushCount += result.sentCount;
      removedInvalidSubscriptionCount += result.invalidSubscriptionsRemoved;

      if (result.sentCount === 0) {
        continue;
      }

      const { error: deliveryError } = await admin.from('push_reminder_deliveries').insert({
        user_id: preference.user_id,
        reminder_key: reminder.reminderKey,
        reminder_type: reminder.reminderType,
        related_id: reminder.relatedId,
        scheduled_for: reminder.scheduledFor,
        metadata: reminder.payload.data,
      });

      if (deliveryError) {
        logger.error('Failed to record push reminder delivery', deliveryError);
        continue;
      }

      deliveredReminderCount += 1;
    }
  }

  return jsonSuccess({
    lookaheadMinutes,
    scannedUsers: preferences?.length ?? 0,
    matchedReminders: reminderCount,
    deliveredReminders: deliveredReminderCount,
    sentPushCount,
    removedInvalidSubscriptionCount,
  });
}

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  return matchesBearerToken(authHeader, cronSecret);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonError('Unauthorized cron request', 401, ERROR_CODES.UNAUTHORIZED);
  }

  return handlePushReminderCron();
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return jsonError('Unauthorized cron request', 401, ERROR_CODES.UNAUTHORIZED);
  }

  return handlePushReminderCron();
}
