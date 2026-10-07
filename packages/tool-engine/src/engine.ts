/**
 * @vanni/tool-engine — Central Tool Execution Engine & Registry
 * 
 * Flow:
 * LLM Decision
 *   -> Tool Request
 *   -> Registry Lookup
 *   -> Authorization & Permissions Check
 *   -> Industry Policy Guard Check
 *   -> Zod Argument Validation & Sanitization
 *   -> Normalization
 *   -> Confirmation State Check
 *   -> Controlled Handler Execution
 *   -> Result Sanitization & Tool Event Emission
 */

import { z } from 'zod';
import {
  ToolDefinition,
  ToolRequest,
  ToolResult,
  ToolSecurityContext,
  ToolLifecycleState,
} from './types.js';
import { createFoundationalTools } from './catalog.js';
import { IndustryPolicyGuard } from './policy.js';
import { defaultBusinessStore, IBusinessDataStore } from './models.js';

export class ToolExecutionEngine {
  private tools: Map<string, ToolDefinition> = new Map();
  private store: IBusinessDataStore;

  constructor(store: IBusinessDataStore = defaultBusinessStore) {
    this.store = store;
    // Register foundational tools
    const catalog = createFoundationalTools(store);
    for (const tool of catalog) {
      this.registerTool(tool);
    }
  }

  /**
   * Registers a new tool into the registry
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Fetches a tool by name
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Lists tools available for a specific agent and context
   */
  listAvailableTools(secCtx: ToolSecurityContext): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(tool => {
      if (!tool.enabled) return false;

      // Industry check
      const industryMatch =
        tool.supportedIndustries.includes('*') ||
        tool.supportedIndustries.includes(secCtx.industry);
      if (!industryMatch) return false;

      // Capability checks
      for (const perm of tool.requiredPermissions) {
        if (secCtx.capabilities[perm] === false) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Executes a tool request through the controlled execution boundary
   */
  async executeTool(
    request: ToolRequest,
    securityContext: ToolSecurityContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const correlationId = request.correlationId || `corr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Tool Registry Check
    const tool = this.tools.get(request.toolName);
    if (!tool) {
      return this.recordAndReturnFailure({
        request,
        securityContext,
        correlationId,
        status: 'NOT_FOUND',
        userMessage: 'The requested action is not recognized by the system.',
        errorCode: 'TOOL_NOT_FOUND',
        retryable: false,
        startTime,
      });
    }

    if (!tool.enabled) {
      return this.recordAndReturnFailure({
        request,
        securityContext,
        correlationId,
        status: 'NOT_AVAILABLE',
        userMessage: 'This feature is currently unavailable.',
        errorCode: 'TOOL_DISABLED',
        retryable: false,
        startTime,
      });
    }

    // 2. Authorization & Tenant Security Check
    // Prevent client/LLM-supplied organizationId tampering
    if (request.organizationId !== securityContext.organizationId) {
      return this.recordAndReturnFailure({
        request,
        securityContext,
        correlationId,
        status: 'UNAUTHORIZED',
        userMessage: 'Unauthorized action request.',
        errorCode: 'TENANT_MISMATCH_ATTEMPT',
        retryable: false,
        startTime,
      });
    }

    // Permission check
    for (const perm of tool.requiredPermissions) {
      if (securityContext.capabilities[perm] === false) {
        return this.recordAndReturnFailure({
          request,
          securityContext,
          correlationId,
          status: 'UNAUTHORIZED',
          userMessage: `Action is restricted for this assistant.`,
          errorCode: `PERMISSION_DENIED_${perm.toUpperCase()}`,
          retryable: false,
          startTime,
        });
      }
    }

    // 3. Industry Policy & Prompt Injection Guard
    const policyResult = IndustryPolicyGuard.evaluatePolicy(
      securityContext.industry,
      tool.name,
      request.arguments || {}
    );
    if (!policyResult.allowed) {
      return this.recordAndReturnFailure({
        request,
        securityContext,
        correlationId,
        status: 'POLICY_BLOCKED',
        userMessage: 'This request cannot be processed due to regulatory or safety guidelines.',
        errorCode: 'POLICY_BLOCKED',
        retryable: false,
        startTime,
      });
    }

    // 4. Schema Validation (Zod)
    let validatedArgs: any;
    try {
      validatedArgs = tool.inputSchema.parse(request.arguments || {});
    } catch (err: any) {
      return this.recordAndReturnFailure({
        request,
        securityContext,
        correlationId,
        status: 'INVALID_ARGUMENTS',
        userMessage: 'Some required information is missing or formatted incorrectly.',
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        retryable: false,
        startTime,
      });
    }

    // 5. Confirmation Check
    if (tool.confirmationRequired && !request.isConfirmed) {
      return this.recordAndReturnFailure({
        request,
        securityContext,
        correlationId,
        status: 'WAITING_CONFIRMATION',
        userMessage: `Please confirm if you would like me to proceed with ${tool.name}.`,
        errorCode: 'CONFIRMATION_REQUIRED',
        retryable: false,
        startTime,
      });
    }

    // 6. Safe Execution with Timeout
    try {
      const executionPromise = tool.handler(validatedArgs, {
        securityContext,
        correlationId,
        idempotencyKey: request.idempotencyKey,
        isConfirmed: !!request.isConfirmed,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), tool.timeoutMs)
      );

      const resultData = await Promise.race([executionPromise, timeoutPromise]);
      const durationMs = Date.now() - startTime;

      // Record successful tool event
      await this.store.recordToolEvent({
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        organizationId: securityContext.organizationId,
        conversationId: securityContext.conversationId,
        agentId: securityContext.agentId,
        agentVersion: securityContext.agentVersionId || 1,
        toolName: tool.name,
        toolVersion: tool.version,
        requestedBy: request.requestedBy,
        correlationId,
        lifecycleState: 'SUCCEEDED',
        riskLevel: tool.riskLevel,
        status: 'SUCCEEDED',
        argumentsSanitized: this.sanitizeArgs(validatedArgs),
        resultSanitized: resultData,
        executionDurationMs: durationMs,
        createdAt: new Date().toISOString(),
      });

      return {
        success: true,
        status: 'SUCCEEDED',
        toolName: tool.name,
        toolVersion: tool.version,
        data: resultData,
        userSafeMessage: 'Action executed successfully.',
        retryable: false,
        correlationId,
        executionDurationMs: durationMs,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const isTimeout = err.message === 'TIMEOUT';
      const isConflict = err.message && err.message.includes('SLOT_CONFLICT');
      const isConfirmationReq = err.message && err.message.includes('CONFIRMATION_REQUIRED');

      let status: ToolLifecycleState = 'FAILED';
      let userSafeMsg = 'We encountered an error processing your request. Please try again.';
      let errCode = 'EXECUTION_EXCEPTION';

      if (isTimeout) {
        status = 'TIMEOUT';
        userSafeMsg = 'The request took too long to complete. Please try again shortly.';
        errCode = 'EXECUTION_TIMEOUT';
      } else if (isConflict) {
        status = 'CONFLICT';
        userSafeMsg = 'The selected appointment slot was just booked by another customer. Let me check the next available time for you.';
        errCode = 'SLOT_CONFLICT';
      } else if (isConfirmationReq) {
        status = 'WAITING_CONFIRMATION';
        userSafeMsg = 'This action requires your confirmation before proceeding.';
        errCode = 'CONFIRMATION_REQUIRED';
      }

      await this.store.recordToolEvent({
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        organizationId: securityContext.organizationId,
        conversationId: securityContext.conversationId,
        agentId: securityContext.agentId,
        agentVersion: securityContext.agentVersionId || 1,
        toolName: tool.name,
        toolVersion: tool.version,
        requestedBy: request.requestedBy,
        correlationId,
        lifecycleState: status,
        riskLevel: tool.riskLevel,
        status,
        argumentsSanitized: this.sanitizeArgs(validatedArgs || request.arguments),
        errorCode: errCode,
        userSafeMessage: userSafeMsg,
        executionDurationMs: durationMs,
        createdAt: new Date().toISOString(),
      });

      return {
        success: false,
        status,
        toolName: tool.name,
        toolVersion: tool.version,
        userSafeMessage: userSafeMsg,
        errorCode: errCode,
        retryable: isTimeout || status === 'CONFLICT',
        correlationId,
        executionDurationMs: durationMs,
      };
    }
  }

  private sanitizeArgs(args: any): Record<string, any> {
    if (!args || typeof args !== 'object') return {};
    const sanitized = { ...args };
    // Redact password or secret fields if any
    for (const key of Object.keys(sanitized)) {
      if (key.toLowerCase().includes('password') || key.toLowerCase().includes('secret')) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return sanitized;
  }

  private async recordAndReturnFailure(opts: {
    request: ToolRequest;
    securityContext: ToolSecurityContext;
    correlationId: string;
    status: ToolLifecycleState;
    userMessage: string;
    errorCode: string;
    retryable: boolean;
    startTime: number;
  }): Promise<ToolResult> {
    const durationMs = Date.now() - opts.startTime;
    await this.store.recordToolEvent({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organizationId: opts.securityContext.organizationId,
      conversationId: opts.securityContext.conversationId,
      agentId: opts.securityContext.agentId,
      agentVersion: opts.securityContext.agentVersionId || 1,
      toolName: opts.request.toolName,
      toolVersion: '1.0.0',
      requestedBy: opts.request.requestedBy,
      correlationId: opts.correlationId,
      lifecycleState: opts.status,
      riskLevel: 'LOW',
      status: opts.status,
      argumentsSanitized: this.sanitizeArgs(opts.request.arguments),
      errorCode: opts.errorCode,
      userSafeMessage: opts.userMessage,
      executionDurationMs: durationMs,
      createdAt: new Date().toISOString(),
    });

    return {
      success: false,
      status: opts.status,
      toolName: opts.request.toolName,
      toolVersion: '1.0.0',
      userSafeMessage: opts.userMessage,
      errorCode: opts.errorCode,
      retryable: opts.retryable,
      correlationId: opts.correlationId,
      executionDurationMs: durationMs,
    };
  }
}
