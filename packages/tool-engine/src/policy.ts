/**
 * @vanni/tool-engine — Industry Safety & Compliance Guardrails
 * Enforces RBI, Healthcare, IVF, Real Estate, and Dental statutory limits.
 */

import { IndustryType } from '@vanni/shared';

export interface PolicyValidationResult {
  allowed: boolean;
  reason?: string;
}

export class IndustryPolicyGuard {
  /**
   * Validates if a requested tool call complies with vertical industry regulations
   */
  static evaluatePolicy(
    industry: IndustryType,
    toolName: string,
    args: Record<string, any>
  ): PolicyValidationResult {
    const textContext = JSON.stringify(args).toLowerCase();

    // 1. HEALTHCARE & IVF RESTRICTIONS
    if (industry === 'HEALTHCARE_HOSPITAL' || industry === 'IVF_FERTILITY') {
      const forbiddenMedicalTerms = [
        'prescribe',
        'prescription',
        'dosage',
        'antibiotic',
        'steroid',
        'guaranteed pregnancy',
        '100% success',
        'gender selection',
        'sex selection',
        'diagnose',
        'diagnosis',
      ];

      for (const term of forbiddenMedicalTerms) {
        if (textContext.includes(term)) {
          return {
            allowed: false,
            reason: `HEALTHCARE_SAFETY_VIOLATION: AI is strictly prohibited from providing diagnosis, medical prescriptions, or fertility outcome guarantees (matched: "${term}").`,
          };
        }
      }
    }

    // 2. DENTAL RESTRICTIONS
    if (industry === 'DENTAL') {
      const forbiddenDentalTerms = [
        'guaranteed painless',
        'prescribe painkiller',
        'tramadol',
        'amoxicillin',
      ];
      for (const term of forbiddenDentalTerms) {
        if (textContext.includes(term)) {
          return {
            allowed: false,
            reason: `DENTAL_SAFETY_VIOLATION: Prescription medications and absolute medical guarantees are not allowed.`,
          };
        }
      }
    }

    // 3. REAL ESTATE RESTRICTIONS
    if (industry === 'REAL_ESTATE') {
      const forbiddenRealEstateClaims = [
        'guaranteed 100% returns',
        'guaranteed appreciation',
        'unapproved layout',
        'fake rera',
      ];
      for (const term of forbiddenRealEstateClaims) {
        if (textContext.includes(term)) {
          return {
            allowed: false,
            reason: `RERA_COMPLIANCE_VIOLATION: Speculative financial return guarantees and unverified legal claims are strictly prohibited.`,
          };
        }
      }
    }

    // 4. PREVENT ARBITRARY CODE / SQL / SHELL ATTEMPTS IN ARGS
    const dangerousPatterns = [
      'select * from',
      'drop table',
      '--',
      '; drop',
      '<script',
      'exec(',
      'eval(',
      'system(',
      '/bin/sh',
      'powershell',
    ];
    for (const pattern of dangerousPatterns) {
      if (textContext.includes(pattern)) {
        return {
          allowed: false,
          reason: `SECURITY_INJECTION_DETECTED: Suspicious script or SQL injection sequence identified in tool arguments.`,
        };
      }
    }

    return { allowed: true };
  }
}
