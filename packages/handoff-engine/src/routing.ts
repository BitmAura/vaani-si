/**
 * @vanni/handoff-engine — Routing, Destination Resolution & Availability
 */

import {
  DestinationType,
  HumanAvailabilityStatus,
  TeamDTO,
  TeamMemberDTO,
  EscalationPolicyDTO,
} from '@vanni/shared';
import { IDatabaseService } from '@vanni/database';

export interface ResolvedDestination {
  type: DestinationType;
  targetIdOrPhone: string;
  name: string;
  isAvailable: boolean;
  memberUserId?: string;
  fallbackReason?: string;
}

export class DestinationResolver {
  constructor(private db: IDatabaseService) {}

  /**
   * Resolves routing destination based on team availability, individual availability, or phone fallback
   */
  async resolveDestination(
    organizationId: string,
    preference?: {
      targetTeamSlugOrId?: string;
      targetUserId?: string;
      targetPhone?: string;
      policy?: EscalationPolicyDTO | null;
    }
  ): Promise<ResolvedDestination> {
    const policy = preference?.policy;

    // 1. Direct User Preference
    if (preference?.targetUserId) {
      // Check user availability in team if available
      const teams = await this.db.getTeams(organizationId);
      for (const t of teams) {
        const members = await this.db.getTeamMembers(t.id, organizationId);
        const mem = members.find(m => m.userId === preference.targetUserId);
        if (mem) {
          const isAvail = mem.availability === 'AVAILABLE';
          return {
            type: 'USER',
            targetIdOrPhone: mem.userId,
            name: `Staff Member (${mem.userId.substring(0, 8)})`,
            isAvailable: isAvail,
            memberUserId: mem.userId,
            fallbackReason: isAvail ? undefined : `Staff member is ${mem.availability}`,
          };
        }
      }

      // If user not in team table, assume unknown availability -> use configured fallback
      return {
        type: 'USER',
        targetIdOrPhone: preference.targetUserId,
        name: `User ${preference.targetUserId}`,
        isAvailable: true,
        memberUserId: preference.targetUserId,
      };
    }

    // 2. Team Preference
    if (preference?.targetTeamSlugOrId) {
      const teams = await this.db.getTeams(organizationId);
      const team = teams.find(
        t => t.id === preference.targetTeamSlugOrId || t.slug.toLowerCase() === preference.targetTeamSlugOrId?.toLowerCase()
      );

      if (team) {
        const members = await this.db.getTeamMembers(team.id, organizationId);
        const availableMember = members.find(m => m.availability === 'AVAILABLE');

        if (availableMember) {
          return {
            type: 'TEAM',
            targetIdOrPhone: team.contactPhone || availableMember.userId,
            name: team.name,
            isAvailable: true,
            memberUserId: availableMember.userId,
          };
        }

        // Team has no available live members
        if (team.contactPhone) {
          return {
            type: 'PHONE_NUMBER',
            targetIdOrPhone: team.contactPhone,
            name: `${team.name} Direct Line`,
            isAvailable: true,
          };
        }

        return {
          type: 'TEAM',
          targetIdOrPhone: team.id,
          name: team.name,
          isAvailable: false,
          fallbackReason: 'No team members currently available',
        };
      }
    }

    // 3. Organization Policy Default Phone / Team
    if (policy?.defaultLiveTransferDestinationPhone) {
      return {
        type: 'PHONE_NUMBER',
        targetIdOrPhone: policy.defaultLiveTransferDestinationPhone,
        name: 'Clinic / Business Reception Line',
        isAvailable: true,
      };
    }

    // 4. Default Reception Team if exists
    const teams = await this.db.getTeams(organizationId);
    const reception = teams.find(t => t.slug === 'reception' || t.name.toLowerCase().includes('reception') || t.name.toLowerCase().includes('front desk'));
    if (reception) {
      const members = await this.db.getTeamMembers(reception.id, organizationId);
      const availableMember = members.find(m => m.availability === 'AVAILABLE');
      if (availableMember) {
        return {
          type: 'TEAM',
          targetIdOrPhone: reception.contactPhone || availableMember.userId,
          name: reception.name,
          isAvailable: true,
          memberUserId: availableMember.userId,
        };
      }
      if (reception.contactPhone) {
        return {
          type: 'PHONE_NUMBER',
          targetIdOrPhone: reception.contactPhone,
          name: `${reception.name} Line`,
          isAvailable: true,
        };
      }
    }

    // 5. Fallback configured phone or emergency phone
    if (preference?.targetPhone) {
      return {
        type: 'PHONE_NUMBER',
        targetIdOrPhone: preference.targetPhone,
        name: 'Provided Contact Phone',
        isAvailable: true,
      };
    }

    return {
      type: 'QUEUE',
      targetIdOrPhone: 'unassigned_queue',
      name: 'Default Handoff Queue',
      isAvailable: false,
      fallbackReason: 'No live transfer destination configured or available',
    };
  }
}
