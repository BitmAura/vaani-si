/**
 * @vanni/agent-core — AI Employee Lifecycle & Versioning Service
 *
 * Manages the full lifecycle state machine:
 * DRAFT -> TESTING -> ACTIVE <-> PAUSED -> ARCHIVED
 *
 * Implements atomic versioning, immutable snapshot publishing, and safe rollbacks.
 */

import {
  AIEmployeeDTO,
  AIEmployeeVersionDTO,
  AIEmployeeStatus,
  AgentRuntimeConfig,
  AuditLogDTO,
} from '@vanni/shared';
import { IDatabaseService } from '@vanni/database';
import { validateAgent } from '../validation/agent-validator';
import { compileAgentConfiguration } from '../compiler/runtime-compiler';

export class AgentLifecycleService {
  constructor(private db: IDatabaseService) {}

  private async audit(
    organizationId: string,
    userId: string,
    action: string,
    targetId: string,
    details: Record<string, any>
  ): Promise<void> {
    const log: AuditLogDTO = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      organizationId,
      actorUserId: userId,
      action,
      resourceType: 'AI_EMPLOYEE',
      resourceId: targetId,
      metadata: details,
      createdAt: new Date().toISOString(),
    };
    await this.db.saveAuditLog(log);
  }

  async getAgent(organizationId: string, agentId: string): Promise<AIEmployeeDTO | null> {
    const agent = await this.db.getAIEmployeeById(agentId, organizationId);
    return agent;
  }

  async listAgents(organizationId: string): Promise<AIEmployeeDTO[]> {
    return this.db.getAIEmployees(organizationId);
  }

  async createAgent(
    organizationId: string,
    userId: string,
    agentData: Partial<AIEmployeeDTO> & { name: string; role: any; industry: string }
  ): Promise<AIEmployeeDTO> {
    const now = new Date().toISOString();
    const id = `emp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const agent: AIEmployeeDTO = {
      id,
      organizationId,
      name: agentData.name,
      displayName: agentData.displayName || `${agentData.name} — AI Employee`,
      description: agentData.description || 'Enterprise AI Employee',
      role: agentData.role,
      industry: agentData.industry,
      status: 'DRAFT',
      activeVersion: 0,
      identity: agentData.identity || {
        name: agentData.name,
        displayName: agentData.displayName || agentData.name,
        role: agentData.role,
        description: agentData.description || '',
        businessIntroduction: `Hello, I am ${agentData.name}, your AI assistant.`,
        identifyAsAI: true,
      },
      objective: agentData.objective || {
        primaryObjective: 'Assist customers professionally and resolve inquiries accurately.',
        secondaryObjectives: [],
        successCriteria: [],
      },
      personality: agentData.personality || {
        preset: 'PROFESSIONAL_RECEPTIONIST',
        tone: 'PROFESSIONAL',
        conversationStyle: 'BALANCED',
        energy: 'NEUTRAL',
        customInstructions: '',
      },
      language: agentData.language || {
        primaryLanguage: 'en',
        secondaryLanguages: ['kn'],
        conversationalMode: 'CUSTOMER_DETECTED',
        allowSwitching: true,
      },
      capabilities: agentData.capabilities || [
        { capability: 'ANSWER_QUESTIONS', enabled: true, requiresPermission: false },
        { capability: 'COLLECT_CONTACT_DETAILS', enabled: true, requiresPermission: false },
        { capability: 'TRANSFER_TO_HUMAN', enabled: true, requiresPermission: false },
      ],
      knowledgeAccess: agentData.knowledgeAccess || {
        accessLevel: 'ALL_BUSINESS_KNOWLEDGE',
        allowedSourceIds: [],
        restrictedCategories: [],
      },
      tools: agentData.tools || [],
      escalation: agentData.escalation || {
        defaultDestinationType: 'RECEPTION',
        defaultDestinationTarget: 'Front Desk',
        triggers: [],
      },
      policies: agentData.policies || {
        enforceHealthcareGuardrails: false,
        enforceRealEstateGuardrails: false,
        enforceSalesGuardrails: false,
        noHallucinationEnforced: true,
        customPolicyIds: [],
      },
      conversationRules: agentData.conversationRules || {
        greetingStyle: 'WARM',
        questionStrategy: 'NATURAL_FLOW',
        responseLength: 'BALANCED',
        uncertaintyBehavior: 'STATE_UNCERTAINTY',
        silenceHandling: 'GENTLE_PROMPT',
      },
      createdBy: userId,
      updatedBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.saveAIEmployee(agent);
    await this.audit(organizationId, userId, 'agent_created', agent.id, {
      name: agent.name,
      role: agent.role,
      status: agent.status,
    });

    return agent;
  }

  async updateAgentDraft(
    organizationId: string,
    userId: string,
    agentId: string,
    updates: Partial<AIEmployeeDTO>
  ): Promise<AIEmployeeDTO> {
    const existing = await this.db.getAIEmployeeById(agentId, organizationId);
    if (!existing) {
      throw new Error(`AI Employee not found or access denied [${agentId}]`);
    }

    const updated: AIEmployeeDTO = {
      ...existing,
      ...updates,
      id: existing.id,
      organizationId: existing.organizationId,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
    };

    await this.db.saveAIEmployee(updated);
    await this.audit(organizationId, userId, 'agent_updated', existing.id, {
      updatedFields: Object.keys(updates),
    });

    return updated;
  }

  async publishAgentVersion(
    organizationId: string,
    userId: string,
    agentId: string,
    changelog: string = 'Published updated AI Employee version'
  ): Promise<{ agent: AIEmployeeDTO; version: AIEmployeeVersionDTO }> {
    const agent = await this.db.getAIEmployeeById(agentId, organizationId);
    if (!agent) {
      throw new Error(`AI Employee not found or access denied [${agentId}]`);
    }

    // Strict pre-publish validation
    const validation = validateAgent(agent);
    if (!validation.isValid) {
      throw new Error(`Cannot publish invalid AI Employee: ${validation.errors.join('; ')}`);
    }

    const brainSnapshot = await this.db.getLatestSnapshot(organizationId);
    const existingVersions = await this.db.getAIEmployeeVersions(organizationId, agent.id);
    const newVersionNumber = existingVersions.length === 0 ? 1 : Math.max(...existingVersions.map(v => v.version)) + 1;

    // Compile immutable runtime snapshot
    const runtimeConfig = compileAgentConfiguration(
      { ...agent, activeVersion: newVersionNumber },
      brainSnapshot
    );

    const now = new Date().toISOString();
    const versionRecord: AIEmployeeVersionDTO = {
      id: `ver-${agent.id}-v${newVersionNumber}`,
      organizationId,
      agentId: agent.id,
      version: newVersionNumber,
      status: 'ACTIVE',
      changelog,
      snapshot: runtimeConfig,
      publishedAt: now,
      createdBy: userId,
      createdAt: now,
    };

    // Save version
    await this.db.saveAIEmployeeVersion(versionRecord);

    // Update active agent record
    agent.activeVersion = newVersionNumber;
    agent.activeVersionId = versionRecord.id;
    agent.status = 'ACTIVE';
    agent.updatedBy = userId;
    agent.updatedAt = now;

    await this.db.saveAIEmployee(agent);

    await this.audit(organizationId, userId, 'agent_published', agent.id, {
      version: newVersionNumber,
      changelog,
    });

    return { agent, version: versionRecord };
  }

  async activateAgent(
    organizationId: string,
    userId: string,
    agentId: string,
    versionNumber?: number
  ): Promise<AIEmployeeDTO> {
    const agent = await this.db.getAIEmployeeById(agentId, organizationId);
    if (!agent) {
      throw new Error(`AI Employee not found or access denied [${agentId}]`);
    }

    const targetVersion = versionNumber ?? agent.activeVersion;
    const versionRecord = await this.db.getAIEmployeeVersionByNumber(agent.id, targetVersion, organizationId);
    if (!versionRecord) {
      throw new Error(`Cannot activate non-existent version ${targetVersion} for agent ${agentId}`);
    }

    agent.status = 'ACTIVE';
    agent.activeVersion = targetVersion;
    agent.activeVersionId = versionRecord.id;
    agent.updatedBy = userId;
    agent.updatedAt = new Date().toISOString();

    await this.db.saveAIEmployee(agent);
    await this.audit(organizationId, userId, 'agent_activated', agent.id, {
      activeVersion: targetVersion,
    });

    return agent;
  }

  async pauseAgent(organizationId: string, userId: string, agentId: string): Promise<AIEmployeeDTO> {
    const agent = await this.db.getAIEmployeeById(agentId, organizationId);
    if (!agent) {
      throw new Error(`AI Employee not found or access denied [${agentId}]`);
    }

    agent.status = 'PAUSED';
    agent.updatedBy = userId;
    agent.updatedAt = new Date().toISOString();

    await this.db.saveAIEmployee(agent);
    await this.audit(organizationId, userId, 'agent_paused', agent.id, {});

    return agent;
  }

  async rollbackAgent(
    organizationId: string,
    userId: string,
    agentId: string,
    targetVersionNumber: number
  ): Promise<{ agent: AIEmployeeDTO; restoredVersion: AIEmployeeVersionDTO }> {
    const agent = await this.db.getAIEmployeeById(agentId, organizationId);
    if (!agent) {
      throw new Error(`AI Employee not found or access denied [${agentId}]`);
    }

    const targetVersion = await this.db.getAIEmployeeVersionByNumber(
      agent.id,
      targetVersionNumber,
      organizationId
    );
    if (!targetVersion) {
      throw new Error(
        `Cannot rollback to version ${targetVersionNumber}: version record not found.`
      );
    }

    const snapshot = targetVersion.snapshot;

    // Restore configuration from immutable snapshot
    agent.identity = snapshot.identity;
    agent.objective = snapshot.objective;
    agent.personality = snapshot.personality;
    agent.language = snapshot.language;
    agent.capabilities = snapshot.capabilities;
    agent.knowledgeAccess = snapshot.knowledgeAccess;
    agent.tools = snapshot.tools;
    agent.escalation = snapshot.escalation;
    agent.policies = snapshot.policies;
    agent.conversationRules = snapshot.conversationRules;
    agent.activeVersion = targetVersionNumber;
    agent.activeVersionId = targetVersion.id;
    agent.status = 'ACTIVE';
    agent.updatedBy = userId;
    agent.updatedAt = new Date().toISOString();

    await this.db.saveAIEmployee(agent);

    await this.audit(organizationId, userId, 'agent_rollback', agent.id, {
      restoredVersion: targetVersionNumber,
      fromVersion: agent.activeVersion,
    });

    return { agent, restoredVersion: targetVersion };
  }

  async archiveAgent(organizationId: string, userId: string, agentId: string): Promise<AIEmployeeDTO> {
    const agent = await this.db.getAIEmployeeById(agentId, organizationId);
    if (!agent) {
      throw new Error(`AI Employee not found or access denied [${agentId}]`);
    }

    agent.status = 'ARCHIVED';
    agent.updatedBy = userId;
    agent.updatedAt = new Date().toISOString();

    await this.db.saveAIEmployee(agent);
    await this.audit(organizationId, userId, 'agent_archived', agent.id, {});

    return agent;
  }

  async getPublishedAgentRuntimeConfig(
    agentId: string,
    organizationId?: string
  ): Promise<AgentRuntimeConfig> {
    const agent = await this.db.getAIEmployeeById(agentId, organizationId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    if (agent.status !== 'ACTIVE' && agent.status !== 'TESTING') {
      throw new Error(
        `Agent ${agentId} is currently ${agent.status} and cannot be loaded into runtime session.`
      );
    }

    const versionRecord = await this.db.getAIEmployeeVersionByNumber(
      agent.id,
      agent.activeVersion,
      agent.organizationId
    );
    if (versionRecord && versionRecord.snapshot) {
      return versionRecord.snapshot;
    }

    // Fallback: compile fresh if no snapshot stored yet
    return compileAgentConfiguration(agent);
  }
}
