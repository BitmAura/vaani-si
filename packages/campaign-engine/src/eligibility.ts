/**
 * @vanni/campaign-engine — Compliance-First Eligibility Engine
 * Performs 16-point deterministic compliance & eligibility evaluation before placing any call.
 */

import {
  CampaignDTO,
  CampaignTargetDTO,
  ContactDTO,
  IneligibilityReason,
} from '@vanni/shared';
import { ArgumentNormalizer } from '@vanni/tool-engine';
import { OutboundEligibilityResult } from './models.js';
import { CallingScheduleValidator } from './schedule.js';

export interface EligibilityEvaluationContext {
  campaign: CampaignDTO;
  target: CampaignTargetDTO;
  contact: ContactDTO;
  isAgentActive: boolean;
  hasActiveCall: boolean;
  activeCampaignCallsCount: number;
  currentTime?: Date;
}

export class OutboundEligibilityEngine {
  /**
   * Deterministically evaluates if an outbound follow-up call is legally, commercially,
   * and operationally permitted.
   */
  static evaluate(ctx: EligibilityEvaluationContext): OutboundEligibilityResult {
    const checks: { checkName: string; passed: boolean; details?: string }[] = [];
    const now = ctx.currentTime || new Date();

    // 1. Contact Record Check
    const hasContact = !!ctx.contact;
    checks.push({ checkName: 'Contact Exists', passed: hasContact });
    if (!hasContact) {
      return { eligible: false, reason: 'NO_PHONE', checks };
    }

    // 2. Phone Number & Validity Check
    const hasPhone = !!ctx.contact.phone;
    const normPhone = ArgumentNormalizer.normalizePhoneNumber(ctx.contact.phone || '');
    const isPhoneValid = hasPhone && normPhone.length >= 10;
    checks.push({ checkName: 'Phone Number Valid', passed: isPhoneValid, details: normPhone });
    if (!isPhoneValid) {
      return { eligible: false, reason: 'INVALID_PHONE', checks };
    }

    // 3. Do-Not-Contact (DNC) Suppression Check
    const isDNC = ctx.contact.status === 'DO_NOT_CONTACT';
    checks.push({ checkName: 'Suppression Guard (Not DNC)', passed: !isDNC, details: ctx.contact.doNotContactReason });
    if (isDNC) {
      return { eligible: false, reason: 'DO_NOT_CONTACT', checks };
    }

    // 4. Contact Status Not Archived
    const isArchived = ctx.contact.status === 'ARCHIVED';
    checks.push({ checkName: 'Contact Not Archived', passed: !isArchived });
    if (isArchived) {
      return { eligible: false, reason: 'POLICY_BLOCKED', checks };
    }

    // 5. Campaign Active Status Check
    const isCampaignActive = ctx.campaign.status === 'ACTIVE' || ctx.campaign.status === 'READY';
    checks.push({ checkName: 'Campaign Active', passed: isCampaignActive, details: ctx.campaign.status });
    if (!isCampaignActive) {
      return { eligible: false, reason: 'CAMPAIGN_PAUSED', checks };
    }

    // 6. AI Agent Published & Active Check
    const isAgentActive = ctx.isAgentActive;
    checks.push({ checkName: 'AI Employee Active', passed: isAgentActive, details: `Agent ID: ${ctx.campaign.agentId} v${ctx.campaign.agentVersion}` });
    if (!isAgentActive) {
      return { eligible: false, reason: 'AGENT_UNAVAILABLE', checks };
    }

    // 7. Calling Window & Blackout Schedule Check
    const windowResult = CallingScheduleValidator.isInsideCallingWindow(now, {
      windowStart: ctx.campaign.callingWindowStart,
      windowEnd: ctx.campaign.callingWindowEnd,
      allowedDays: ctx.campaign.allowedDaysOfWeek,
      blackoutDates: ctx.campaign.blackoutDates,
      timezone: ctx.campaign.timezone,
    });
    checks.push({ checkName: 'Inside Calling Window', passed: windowResult.allowed, details: windowResult.reason });
    if (!windowResult.allowed) {
      return { eligible: false, reason: 'OUTSIDE_CALLING_WINDOW', checks };
    }

    // 8. Max Retries & Attempt Limit Check
    const attemptsUnderLimit = ctx.target.attemptCount < ctx.campaign.maxAttemptsPerTarget;
    checks.push({ checkName: 'Under Max Attempts Limit', passed: attemptsUnderLimit, details: `${ctx.target.attemptCount} / ${ctx.campaign.maxAttemptsPerTarget}` });
    if (!attemptsUnderLimit) {
      return { eligible: false, reason: 'RETRY_LIMIT_REACHED', checks };
    }

    // 9. Target Not Already Completed / Converted
    const notCompleted = ctx.target.status !== 'COMPLETED' && ctx.target.status !== 'OPTED_OUT';
    checks.push({ checkName: 'Target Incomplete', passed: notCompleted, details: ctx.target.status });
    if (!notCompleted) {
      return { eligible: false, reason: 'ALREADY_COMPLETED', checks };
    }

    // 10. Active Call Concurrency Collision Check
    const noActiveCall = !ctx.hasActiveCall;
    checks.push({ checkName: 'No Concurrent Call On Target', passed: noActiveCall });
    if (!noActiveCall) {
      return { eligible: false, reason: 'ACTIVE_CALL_EXISTS', checks };
    }

    // 11. Concurrency Capacity Available
    const underConcurrencyCap = ctx.activeCampaignCallsCount < ctx.campaign.maxConcurrentCalls;
    checks.push({ checkName: 'Campaign Concurrency Capacity', passed: underConcurrencyCap, details: `${ctx.activeCampaignCallsCount} active / max ${ctx.campaign.maxConcurrentCalls}` });
    if (!underConcurrencyCap) {
      return { eligible: false, reason: 'RATE_LIMITED', checks };
    }

    return {
      eligible: true,
      checks,
    };
  }
}
