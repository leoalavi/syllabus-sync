// lib/services/notificationService.ts
'use client';

import { STORAGE_KEYS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { apiRequest } from '@/lib/utils/api';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
  url?: string;
  onClick?: () => void;
}

// Storage key for tracking sent notifications
const SENT_NOTIFICATIONS_KEY = 'syllabus-sync-sent-notifications';
const NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown between same notifications

/**
 * NotificationService handles browser push notifications
 * and in-app notification preferences
 */
class NotificationService {
  private static instance: NotificationService;
  private notificationClickHandlers: Map<string, () => void> = new Map();
  private isInitialized = false;
  private sentNotifications: Map<string, number> = new Map(); // tag -> timestamp

  private constructor() {
    // Initialize only once
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Load sent notifications from storage
    this.loadSentNotifications();

    // Set up notification click handler
    if (typeof window !== 'undefined' && 'Notification' in window) {
      // Listen for service worker messages (for notification clicks)
      if ('serviceWorker' in navigator) {
        try {
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.type === 'NOTIFICATION_CLICK') {
              const handler = this.notificationClickHandlers.get(event.data.tag);
              if (handler) {
                handler();
                this.notificationClickHandlers.delete(event.data.tag);
              }
            }
          });
        } catch (error) {
          logger.error('Failed to register service worker message listener:', error);
        }
      }
    }
  }

  /**
   * Load sent notifications from localStorage
   */
  private loadSentNotifications(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(SENT_NOTIFICATIONS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, number>;
        const now = Date.now();
        // Only keep notifications within cooldown period
        Object.entries(parsed).forEach(([tag, timestamp]) => {
          if (now - timestamp < NOTIFICATION_COOLDOWN_MS) {
            this.sentNotifications.set(tag, timestamp);
          }
        });
      }
    } catch {
      // Ignore parse errors
    }
  }

  /**
   * Save sent notifications to localStorage
   */
  private saveSentNotifications(): void {
    if (typeof window === 'undefined') return;
    try {
      const obj: Record<string, number> = {};
      this.sentNotifications.forEach((timestamp, tag) => {
        obj[tag] = timestamp;
      });
      localStorage.setItem(SENT_NOTIFICATIONS_KEY, JSON.stringify(obj));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Check if a notification was recently sent
   */
  private wasRecentlySent(tag: string): boolean {
    const lastSent = this.sentNotifications.get(tag);
    if (!lastSent) return false;
    return Date.now() - lastSent < NOTIFICATION_COOLDOWN_MS;
  }

  /**
   * Mark a notification as sent
   */
  private markAsSent(tag: string): void {
    this.sentNotifications.set(tag, Date.now());
    this.saveSentNotifications();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Check if browser notifications are supported
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  isPushSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
  }

  /**
   * Get current notification permission status
   */
  getPermissionStatus(): NotificationPermissionStatus {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission as NotificationPermissionStatus;
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<NotificationPermissionStatus> {
    if (!this.isSupported()) return 'unsupported';

    try {
      const permission = await Notification.requestPermission();
      return permission as NotificationPermissionStatus;
    } catch (error) {
      logger.error('Failed to request notification permission:', error);
      return 'denied';
    }
  }

  private async ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      return registration.active ? registration : navigator.serviceWorker.ready;
    } catch (error) {
      logger.error('Failed to register notification service worker:', error);
      return null;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const normalized = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(normalized);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i += 1) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  async subscribeToPush(): Promise<boolean> {
    if (!this.isPushSupported()) {
      return false;
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    if (!publicKey) {
      logger.warn('Cannot subscribe to push without NEXT_PUBLIC_VAPID_PUBLIC_KEY');
      return false;
    }

    const registration = await this.ensureServiceWorkerRegistration();
    if (!registration) {
      return false;
    }

    try {
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }

      await apiRequest('/api/push/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
        noRetry: true,
      });

      return true;
    } catch (error) {
      logger.error('Failed to subscribe browser to push notifications:', error);
      return false;
    }
  }

  async unsubscribeFromPush(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return true;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        return true;
      }

      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      await apiRequest('/api/push/subscription', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ endpoint }),
        noRetry: true,
      });

      return true;
    } catch (error) {
      logger.error('Failed to unsubscribe browser from push notifications:', error);
      return false;
    }
  }

  /**
   * Send a browser notification
   */
  async sendNotification(options: NotificationOptions): Promise<boolean> {
    if (!this.isSupported()) {
      console.warn('Notifications not supported in this browser');
      return false;
    }

    const permission = this.getPermissionStatus();
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return false;
    }

    // Check if this notification was recently sent (prevent duplicates)
    if (options.tag && this.wasRecentlySent(options.tag)) {
      // Use warn since info/log are not allowed by lint rules
      console.warn(`Notification "${options.tag}" was recently sent, skipping duplicate`);
      return false;
    }

    try {
      const notificationData = {
        ...(options.data ?? {}),
        url: options.url ?? (options.data?.url as string | undefined) ?? '/',
      };

      // Prefer service worker notifications if available (more resilient when tab is hidden)
      if ('serviceWorker' in navigator) {
        try {
          const registration = await this.ensureServiceWorkerRegistration();
          if (registration?.showNotification) {
            await registration.showNotification(options.title, {
              body: options.body,
              icon: options.icon || '/icons/icon-192.png',
              badge: '/icons/icon-192.png',
              tag: options.tag,
              data: notificationData,
            });
            // Register click handler for service worker notifications
            if (options.tag && options.onClick) {
              this.notificationClickHandlers.set(options.tag, options.onClick);
            }
            // Mark as sent to prevent duplicates
            if (options.tag) {
              this.markAsSent(options.tag);
            }
            return true;
          }
        } catch (swError) {
          console.warn(
            'Service worker notification failed, falling back to standard notification:',
            swError,
          );
        }
      }

      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/icons/icon-192.png',
        tag: options.tag,
        data: notificationData,
      });

      // Mark as sent to prevent duplicates
      if (options.tag) {
        this.markAsSent(options.tag);
      }

      if (options.onClick && options.tag) {
        this.notificationClickHandlers.set(options.tag, options.onClick);
      }

      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.onClick) {
          options.onClick();
        }
      };

      return true;
    } catch (error) {
      logger.error('Failed to send notification:', error);
      return false;
    }
  }

  /**
   * Check if a specific notification type is enabled
   */
  isNotificationTypeEnabled(type: 'deadlines' | 'classes' | 'events'): boolean {
    if (typeof window === 'undefined') return false;

    const storageKey =
      type === 'deadlines'
        ? STORAGE_KEYS.NOTIFICATION_DEADLINES
        : type === 'classes'
          ? STORAGE_KEYS.NOTIFICATION_CLASSES
          : STORAGE_KEYS.NOTIFICATION_EVENTS;

    const value = localStorage.getItem(storageKey);
    return value === null ? true : value === 'true';
  }

  /**
   * Set notification type preference
   */
  setNotificationTypeEnabled(type: 'deadlines' | 'classes' | 'events', enabled: boolean): void {
    if (typeof window === 'undefined') return;

    const storageKey =
      type === 'deadlines'
        ? STORAGE_KEYS.NOTIFICATION_DEADLINES
        : type === 'classes'
          ? STORAGE_KEYS.NOTIFICATION_CLASSES
          : STORAGE_KEYS.NOTIFICATION_EVENTS;

    localStorage.setItem(storageKey, enabled.toString());
  }

  /**
   * Send deadline reminder notification
   */
  async sendDeadlineReminder(
    deadlineTitle: string,
    unitCode: string,
    dueDate: Date,
    deadlineId: string,
  ): Promise<boolean> {
    if (!this.isNotificationTypeEnabled('deadlines')) return false;

    const now = new Date();
    const timeDiff = dueDate.getTime() - now.getTime();
    const minutesUntil = Math.floor(timeDiff / (1000 * 60));
    const hoursUntil = Math.floor(timeDiff / (1000 * 60 * 60));
    const daysUntil = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

    let timeText: string;
    if (minutesUntil < 60) {
      // Less than an hour - show minutes
      timeText = minutesUntil <= 1 ? 'in 1 minute' : `in ${minutesUntil} minutes`;
    } else if (hoursUntil < 24) {
      // Less than a day - show hours
      timeText = hoursUntil === 1 ? 'in 1 hour' : `in ${hoursUntil} hours`;
    } else {
      // Days
      timeText = daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
    }

    return this.sendNotification({
      title: `📅 Deadline Reminder: ${unitCode}`,
      body: `"${deadlineTitle}" is due ${timeText}`,
      tag: `deadline-${deadlineId}`,
      data: { type: 'deadline', id: deadlineId },
      url: '/calendar',
      onClick: () => {
        window.location.href = '/calendar';
      },
    });
  }

  /**
   * Send class reminder notification
   */
  async sendClassReminder(
    unitCode: string,
    unitName: string,
    building: string,
    room: string,
    startTime: string,
    classTimestamp: number,
  ): Promise<boolean> {
    if (!this.isNotificationTypeEnabled('classes')) return false;

    return this.sendNotification({
      title: `📚 Class Starting Soon: ${unitCode}`,
      body: `${unitName} at ${building} ${room} - ${startTime}`,
      tag: `class-${unitCode}-${classTimestamp}`,
      data: { type: 'class', unitCode },
      url: '/home',
      onClick: () => {
        window.location.href = '/home';
      },
    });
  }

  /**
   * Send event reminder notification
   */
  async sendEventReminder(
    eventTitle: string,
    eventLocation: string,
    eventTime: string,
    eventId: string,
  ): Promise<boolean> {
    if (!this.isNotificationTypeEnabled('events')) return false;

    return this.sendNotification({
      title: `🎉 Event Reminder`,
      body: `${eventTitle} at ${eventLocation} - ${eventTime}`,
      tag: `event-${eventId}`,
      data: { type: 'event', id: eventId },
      url: '/feed',
      onClick: () => {
        window.location.href = '/feed';
      },
    });
  }
}

export const notificationService = NotificationService.getInstance();
