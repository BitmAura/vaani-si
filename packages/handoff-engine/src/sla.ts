/**
 * @vanni/handoff-engine — SLA Monitoring & Breach Detection
 */

import {
  HandoffPriority,
  HandoffSLADTO,
  ConversationHandoffRecordDTO,
} from '@vanni/shared';
import { IDatabaseService } from '@vanni/database';
import { NotificationDispatcher } from './notifications.js';

export class SLAMonitor {
  constructor(
    private db: IDatabaseService,
    private notifications: NotificationDispatcher
  ) {}

  /**
   * Default fallback SLA targets in minutes if not customized
   */
  getDefaultSLAMinutes(priority: HandoffPriority): { responseMinutes: number; resolutionMinutes: number } {
    switch (priority) {
      case 'URGENT':
        return { responseMinutes: 5, resolutionMinutes: 30 };
      case 'HIGH':
        return { responseMinutes: 15, resolutionMinutes: 60 };
      case 'NORMAL':
        return { responseMinutes: 45, resolutionMinutes: 240 };
      case 'LOW':
        return { responseMinutes: 120, resolutionMinutes: 720 };
    }
  }

  /**
   * Calculates response and resolution times and checks for SLA compliance or breach
   */
  async checkSLABreach(
    handoff: ConversationHandoffRecordDTO
  ): Promise<{ isResponseBreached: boolean; isResolutionBreached: boolean; targetResponseMinutes: number }> {
    const slas = await this.db.getHandoffSLAs(handoff.organizationId);
    const orgSla = slas.find(s => s.priority === handoff.priority);

    const defaultMinutes = this.getDefaultSLAMinutes(handoff.priority);
    const targetResponseMinutes = orgSla?.targetResponseMinutes ?? defaultMinutes.responseMinutes;
    const targetResolutionMinutes = orgSla?.targetResolutionMinutes ?? defaultMinutes.resolutionMinutes;

    const requestedTime = new Date(handoff.requestedAt).getTime();
    const nowTime = Date.now();

    // Response time check
    let isResponseBreached = false;
    if (handoff.firstResponseAt) {
      const responseTime = new Date(handoff.firstResponseAt).getTime();
      const elapsedMinutes = (responseTime - requestedTime) / (1000 * 60);
      isResponseBreached = elapsedMinutes > targetResponseMinutes;
    } else if (handoff.status === 'PENDING' || handoff.status === 'ASSIGNED' || handoff.status === 'REQUESTED') {
      const elapsedMinutes = (nowTime - requestedTime) / (1000 * 60);
      isResponseBreached = elapsedMinutes > targetResponseMinutes;
    }

    // Resolution time check
    let isResolutionBreached = false;
    if (handoff.resolvedAt) {
      const resolvedTime = new Date(handoff.resolvedAt).getTime();
      const elapsedMinutes = (resolvedTime - requestedTime) / (1000 * 60);
      isResolutionBreached = elapsedMinutes > targetResolutionMinutes;
    } else if (handoff.status !== 'RESOLVED' && handoff.status !== 'CANCELLED') {
      const elapsedMinutes = (nowTime - requestedTime) / (1000 * 60);
      isResolutionBreached = elapsedMinutes > targetResolutionMinutes;
    }

    if (isResponseBreached && !handoff.slaBreached) {
      handoff.slaBreached = true;
      await this.db.saveHandoffRecord(handoff);

      // Notify manager/team lead of breach
      const teams = await this.db.getTeams(handoff.organizationId);
      const teamId = handoff.assignedTeamId || (teams[0] ? teams[0].id : undefined);
      if (teamId) {
        const members = await this.db.getTeamMembers(teamId, handoff.organizationId);
        const lead = members.find(m => m.role === 'LEAD') || members[0];
        if (lead) {
          await this.notifications.dispatch({
            organizationId: handoff.organizationId,
            recipientUserId: lead.userId,
            type: 'HANDOFF_SLA_BREACHED',
            priority: 'HIGH',
            title: `SLA Breached: ${handoff.priority} Handoff #${handoff.id.substring(0, 8)}`,
            body: `Handoff exceeded target response time of ${targetResponseMinutes}m without acknowledgment.`,
            entityType: 'HANDOFF',
            entityId: handoff.id,
            eventId: `sla_breach_${handoff.id}`,
          });
        }
      }
    }

    return { isResponseBreached, isResolutionBreached, targetResponseMinutes };
  }
}
