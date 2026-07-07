import webpush from 'web-push';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

export type PushNotificationPayload = {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  ttlSeconds?: number;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
};

type StoredPushSubscription = {
  id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
};

type PushSendSummary = {
  subscriptionCount: number;
  sentCount: number;
  invalidSubscriptionsRemoved: number;
};

let vapidConfigured = false;

function getPushConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? '';
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? '';
  const subject = process.env.VAPID_SUBJECT?.trim() ?? '';

  return {
    publicKey,
    privateKey,
    subject,
    configured: Boolean(publicKey && privateKey && subject),
  };
}

function ensurePushConfigured(): boolean {
  if (vapidConfigured) {
    return true;
  }

  const config = getPushConfig();
  if (!config.configured) {
    return false;
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  vapidConfigured = true;
  return true;
}

export function isWebPushConfigured(): boolean {
  return getPushConfig().configured;
}

export async function sendPushNotificationToUser(
  userId: string,
  payload: PushNotificationPayload,
): Promise<PushSendSummary> {
  const admin = createAdminClient();
  if (!admin || !ensurePushConfigured()) {
    return {
      subscriptionCount: 0,
      sentCount: 0,
      invalidSubscriptionsRemoved: 0,
    };
  }

  const { data: subscriptions, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh_key, auth_key')
    .eq('user_id', userId);

  if (error) {
    logger.error('Failed to load push subscriptions', error);
    return {
      subscriptionCount: 0,
      sentCount: 0,
      invalidSubscriptionsRemoved: 0,
    };
  }

  const activeSubscriptions = (subscriptions ?? []) as StoredPushSubscription[];
  if (activeSubscriptions.length === 0) {
    return {
      subscriptionCount: 0,
      sentCount: 0,
      invalidSubscriptionsRemoved: 0,
    };
  }

  const serializedPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon ?? '/icons/icon-192.png',
    badge: payload.badge ?? '/icons/icon-192.png',
    tag: payload.tag,
    data: {
      ...(payload.data ?? {}),
      url: payload.url ?? '/',
    },
  });

  let sentCount = 0;
  let invalidSubscriptionsRemoved = 0;

  await Promise.all(
    activeSubscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh_key,
              auth: subscription.auth_key,
            },
          },
          serializedPayload,
          {
            TTL: payload.ttlSeconds ?? 3600,
            urgency: payload.urgency ?? 'high',
            contentEncoding: 'aes128gcm',
          },
        );

        sentCount += 1;

        const now = new Date().toISOString();
        await admin
          .from('push_subscriptions')
          .update({
            updated_at: now,
            last_success_at: now,
            failure_count: 0,
          })
          .eq('id', subscription.id);
      } catch (error) {
        const pushError = error as { statusCode?: number };
        const now = new Date().toISOString();

        if (pushError.statusCode === 404 || pushError.statusCode === 410) {
          invalidSubscriptionsRemoved += 1;
          await admin.from('push_subscriptions').delete().eq('id', subscription.id);
          return;
        }

        await admin
          .from('push_subscriptions')
          .update({
            updated_at: now,
            last_failure_at: now,
            failure_count: 1,
          })
          .eq('id', subscription.id);

        logger.error('Failed to send push notification', error);
      }
    }),
  );

  return {
    subscriptionCount: activeSubscriptions.length,
    sentCount,
    invalidSubscriptionsRemoved,
  };
}
