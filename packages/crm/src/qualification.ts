/**
 * @vanni/crm — Lead Qualification & Deterministic Scoring Engine
 * Industry-aware qualification rules for Dental, Healthcare, IVF, Real Estate, and Generic businesses.
 */

import { IndustryType, LeadQualificationStatus } from '@vanni/shared';

export interface QualificationInput {
  requirement: string;
  location?: string;
  budget?: string;
  timeline?: string;
  appointmentOrVisitRequested?: boolean;
  contactablePhone: boolean;
  emailProvided?: boolean;
  industryData?: Record<string, any>;
}

export interface QualificationResult {
  status: LeadQualificationStatus;
  score: number;
  breakdown: Record<string, number>;
  structuredData: Record<string, any>;
}

export class LeadQualificationEngine {
  /**
   * Deterministically evaluates lead qualification and calculates operational score (0 - 100).
   * Rules are transparent and based on concrete signals rather than opaque AI guesses:
   * - Requirement clearly stated: +20
   * - Location known: +15
   * - Budget / Fee scope known: +15
   * - Timeline / Urgency known: +15
   * - Appointment / Site visit requested: +20
   * - Phone verified: +10
   * - Email provided: +5
   */
  static evaluate(
    industry: IndustryType | 'GENERIC',
    input: QualificationInput
  ): QualificationResult {
    const breakdown: Record<string, number> = {};
    let score = 0;

    // 1. Requirement signal (+20)
    if (input.requirement && input.requirement.trim().length >= 3) {
      breakdown.requirementStated = 20;
      score += 20;
    }

    // 2. Location signal (+15)
    if (input.location && input.location.trim().length >= 2) {
      breakdown.locationIdentified = 15;
      score += 15;
    }

    // 3. Budget signal (+15)
    if (input.budget && input.budget.trim().length >= 1) {
      breakdown.budgetIdentified = 15;
      score += 15;
    }

    // 4. Timeline / Urgency (+15)
    if (input.timeline && input.timeline.trim().length >= 2) {
      breakdown.timelineIdentified = 15;
      score += 15;
    }

    // 5. High-Intent Action: Appointment / Site Visit (+20)
    if (input.appointmentOrVisitRequested) {
      breakdown.appointmentRequested = 20;
      score += 20;
    }

    // 6. Direct Contactability (+10 phone, +5 email)
    if (input.contactablePhone) {
      breakdown.phoneVerified = 10;
      score += 10;
    }
    if (input.emailProvided) {
      breakdown.emailProvided = 5;
      score += 5;
    }

    // Industry-specific structured data formatting
    const structuredData: Record<string, any> = {
      industry,
      requirement: input.requirement,
      location: input.location,
      budget: input.budget,
      timeline: input.timeline,
      appointmentOrVisitRequested: !!input.appointmentOrVisitRequested,
      evaluatedAt: new Date().toISOString(),
    };

    if (industry === 'DENTAL' || industry === 'HEALTHCARE_HOSPITAL' || industry === 'IVF_FERTILITY') {
      structuredData.serviceType = input.requirement;
      structuredData.urgency = input.timeline || 'ROUTINE';
      if (input.industryData?.preferredDoctor) {
        structuredData.preferredDoctor = input.industryData.preferredDoctor;
      }
    } else if (industry === 'REAL_ESTATE') {
      structuredData.projectInterest = input.industryData?.project || input.requirement;
      structuredData.propertyType = input.industryData?.propertyType || 'Residential';
      structuredData.siteVisitRequested = !!input.appointmentOrVisitRequested;
    }

    // Qualification threshold
    let status: LeadQualificationStatus = 'NOT_STARTED';
    if (score >= 60) {
      status = 'QUALIFIED';
    } else if (score >= 30) {
      status = 'PARTIALLY_QUALIFIED';
    } else if (score > 0) {
      status = 'PARTIALLY_QUALIFIED';
    }

    return {
      status,
      score,
      breakdown,
      structuredData,
    };
  }
}
