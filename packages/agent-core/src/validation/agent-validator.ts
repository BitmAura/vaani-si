/**
 * @vanni/agent-core — AI Employee Validator
 *
 * Enforces pre-activation and pre-publishing validation rules, preventing invalid
 * or dangerous configurations from reaching production voice or conversation sessions.
 */

import { AIEmployeeDTO, AgentCapability } from '@vanni/shared';

export interface AgentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateAgent(agent: AIEmployeeDTO): AgentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Mandatory Identity & Structure
  if (!agent.name || agent.name.trim().length < 2) {
    errors.push('AI Employee name is required (minimum 2 characters).');
  }
  if (!agent.displayName || agent.displayName.trim().length < 2) {
    errors.push('AI Employee display name is required.');
  }
  if (!agent.role) {
    errors.push('AI Employee role must be specified.');
  }
  if (!agent.industry) {
    errors.push('Business industry must be specified.');
  }

  // Non-deceptive AI Identity rule (Prompt 08 Section 7 & 45)
  if (agent.identity && agent.identity.identifyAsAI === false) {
    errors.push('Deceptive configuration rejected: AI employees must identify as an AI assistant per platform policy.');
  }

  // 2. Objective Configuration
  if (!agent.objective || !agent.objective.primaryObjective || agent.objective.primaryObjective.trim().length < 5) {
    errors.push('Primary objective is required (minimum 5 characters).');
  }

  // 3. Language Configuration
  if (!agent.language || !agent.language.primaryLanguage) {
    errors.push('Primary language configuration is required.');
  }

  // 4. Industry-Specific Safety Guardrails (Prompt 08 Sections 23 & 24)
  const normIndustry = (agent.industry || '').toUpperCase().replace(/\s+/g, '_');
  const isHealthcare =
    normIndustry.includes('HEALTH') ||
    normIndustry.includes('CLINIC') ||
    normIndustry.includes('DENTAL') ||
    normIndustry.includes('IVF') ||
    normIndustry.includes('HOSPITAL');
  const isRealEstate =
    normIndustry.includes('REAL_ESTATE') ||
    normIndustry.includes('BUILDER') ||
    normIndustry.includes('PROPERTY') ||
    normIndustry.includes('LAYOUT');

  if (isHealthcare) {
    if (!agent.policies?.enforceHealthcareGuardrails) {
      errors.push('Healthcare and clinic AI employees MUST enforce healthcare guardrails (zero diagnosis, zero prescription).');
    }

    // Check emergency trigger in escalation
    const hasEmergencyTrigger = agent.escalation?.triggers?.some(
      t => t.triggerType === 'EMERGENCY' && t.enabled
    );
    if (!hasEmergencyTrigger) {
      errors.push('Healthcare AI employees must have an active EMERGENCY escalation trigger configured.');
    }
  }

  if (isRealEstate) {
    if (!agent.policies?.enforceRealEstateGuardrails) {
      errors.push('Real Estate AI employees MUST enforce real estate guardrails to prevent unauthorized price or inventory fabrication.');
    }
  }

  // 5. Capability & Tool Alignment
  const enabledCaps = new Set<AgentCapability>(
    (agent.capabilities || []).filter(c => c.enabled).map(c => c.capability)
  );

  // Check appointment booking tool requirement
  if (enabledCaps.has('BOOK_APPOINTMENT') || enabledCaps.has('RESCHEDULE_APPOINTMENT')) {
    const hasCalendarTool = agent.tools?.some(
      t => t.category === 'CALENDAR' && t.enabled
    );
    if (!hasCalendarTool) {
      warnings.push(
        'Agent has appointment booking capability enabled, but no Calendar/Scheduler tool is enabled.'
      );
    }
  }

  // Check tool execution permissions
  if (agent.tools) {
    for (const tool of agent.tools) {
      if (!tool.isImplemented && tool.permissions?.canExecute) {
        errors.push(
          `Tool '${tool.displayName}' is not yet implemented in the runtime and cannot have execution permission enabled.`
        );
      }
    }
  }

  // 6. Escalation Configuration
  if (!agent.escalation?.defaultDestinationTarget || agent.escalation.defaultDestinationTarget.trim().length === 0) {
    errors.push('Default escalation destination target must be specified.');
  }

  // 7. Knowledge Access Configuration
  if (
    agent.knowledgeAccess?.accessLevel === 'SELECTED_SOURCES' &&
    (!agent.knowledgeAccess.allowedSourceIds || agent.knowledgeAccess.allowedSourceIds.length === 0)
  ) {
    warnings.push(
      'Knowledge access is set to SELECTED_SOURCES but no sources are selected. Agent will have limited knowledge.'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
