/**
 * @vanni/handoff-engine — Notification Engine & Provider Abstraction
 */

import {
  NotificationDTO,
  NotificationPreferencesDTO,
  NotificationEventType,
  NotificationPriority,
  NotificationChannel,
} from '@vanni/shared';
import { IDatabaseService } from '@vanni/database';
import { NotificationProvider } from './types.js';

export class InAppNotificationProvider implements NotificationProvider {
  readonly name = 'IN_APP';

  constructor(private db: IDatabaseService) {}

  async send(notification: NotificationDTO): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      await this.db.saveNotification(notification);
      return { success: true, messageId: notification.id };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean }> {
    return { healthy: true };
  }
}

export class MockEmailNotificationProvider implements NotificationProvider {
  readonly name = 'EMAIL';
  public sentEmails: Array<{ to: string; subject: string; body: string; timestamp: string }> = [];

  async send(notification: NotificationDTO): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // In-memory/mock safe dispatch simulation
    const msgId = `email_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.sentEmails.push({
      to: notification.recipientUserId,
      subject: notification.title,
      body: notification.body,
      timestamp: new Date().toISOString(),
    });
    return { success: true, messageId: msgId };
  }

  async healthCheck(): Promise<{ healthy: boolean }> {
    return { healthy: true };
  }
}

export class NotificationDispatcher {
  private providers: Map<NotificationChannel, NotificationProvider> = new Map();

  constructor(
    private db: IDatabaseService,
    emailProvider?: NotificationProvider
  ) {
    this.providers.set('IN_APP', new InAppNotificationProvider(db));
    this.providers.set('EMAIL', emailProvider || new MockEmailNotificationProvider());
  }

  registerProvider(channel: NotificationChannel, provider: NotificationProvider) {
    this.providers.set(channel, provider);
  }

  /**
   * Dispatches a notification across applicable channels respecting user preferences & deduplication
   */
  async dispatch(params: {
    organizationId: string;
    recipientUserId: string;
    type: NotificationEventType;
    priority: NotificationPriority;
    title: string;
    body: string;
    entityType: 'HANDOFF' | 'LEAD' | 'CALL' | 'APPOINTMENT' | 'CAMPAIGN';
    entityId: string;
    eventId?: string;
  }): Promise<{ dispatchedChannels: NotificationChannel[]; skippedChannels: NotificationChannel[] }> {
    const { organizationId, recipientUserId, type, priority, title, body, entityType, entityId, eventId } = params;

    // Fetch user preferences
    const prefs = await this.db.getNotificationPreferences(recipientUserId, organizationId);

    const dispatched: NotificationChannel[] = [];
    const skipped: NotificationChannel[] = [];

    // Idempotency key for deduplication
    const idempotencyKey = eventId
      ? `evt_${organizationId}_${recipientUserId}_${eventId}_${type}`
      : `notif_${organizationId}_${recipientUserId}_${entityType}_${entityId}_${type}_${Math.floor(Date.now() / 60000)}`;

    // 1. In-App Notification (Unless user specifically turned off, or default enabled)
    const inAppEnabled = prefs ? prefs.inAppNotificationsEnabled : true;
    if (inAppEnabled) {
      const inAppNotif: NotificationDTO = {
        id: `notif_inapp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        organizationId,
        recipientUserId,
        type,
        priority,
        title,
        body,
        entityType,
        entityId,
        status: 'UNREAD',
        channel: 'IN_APP',
        idempotencyKey,
        createdAt: new Date().toISOString(),
      };

      const inAppProv = this.providers.get('IN_APP');
      if (inAppProv) {
        await inAppProv.send(inAppNotif);
        dispatched.push('IN_APP');
      }
    } else {
      skipped.push('IN_APP');
    }

    // 2. Email Notification
    // Urgent safety notifications should not be silently disabled where policy requires them
    const isUrgent = priority === 'URGENT' || priority === 'HIGH';
    let emailEnabled = prefs ? prefs.emailNotificationsEnabled : true;
    if (prefs?.urgentOnlyEmail && !isUrgent) {
      emailEnabled = false;
    }

    if (emailEnabled) {
      const emailNotif: NotificationDTO = {
        id: `notif_email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        organizationId,
        recipientUserId,
        type,
        priority,
        title,
        body,
        entityType,
        entityId,
        status: 'UNREAD',
        channel: 'EMAIL',
        idempotencyKey: `${idempotencyKey}_email`,
        createdAt: new Date().toISOString(),
      };

      const emailProv = this.providers.get('EMAIL');
      if (emailProv) {
        await emailProv.send(emailNotif);
        dispatched.push('EMAIL');
      }
    } else {
      skipped.push('EMAIL');
    }

    return { dispatchedChannels: dispatched, skippedChannels: skipped };
  }
}
