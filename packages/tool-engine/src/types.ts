/**
 * @vanni/tool-engine — Universal Tool System Types & Lifecycle Definitions
 */

import { z } from 'zod';
import { IndustryType } from '@vanni/shared';

export type ToolCategory =
  | 'INFORMATION'
  | 'CUSTOMER'
  | 'LEAD'
  | 'APPOINTMENT'
  | 'COMMUNICATION'
  | 'TRANSFER'
  | 'FOLLOW_UP'
  | 'REAL_ESTATE'
  | 'HEALTHCARE'
  | 'ADMINISTRATIVE';

export type ToolRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type ToolConfirmationMode = 'NONE' | 'IMPLICIT' | 'EXPLICIT';

export type ToolLifecycleState =
  | 'REQUESTED'
  | 'VALIDATING'
  | 'AUTHORIZED'
  | 'WAITING_CONFIRMATION'
  | 'EXECUTING'
  | 'SUCCEEDED'
  | 'INVALID_ARGUMENTS'
  | 'UNAUTHORIZED'
  | 'POLICY_BLOCKED'
  | 'CONFIRMATION_REQUIRED'
  | 'NOT_AVAILABLE'
  | 'TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'DUPLICATE'
  | 'FAILED';

export type ToolCallerType = 'AI_AGENT' | 'HUMAN' | 'SYSTEM';

export interface ToolSecurityContext {
  organizationId: string;
  conversationId: string;
  agentId: string;
  agentVersionId?: number;
  callerPhone?: string;
  callerName?: string;
  industry: IndustryType;
  businessTimezone: string;
  capabilities: {
    canCaptureLeads?: boolean;
    canBookAppointments?: boolean;
    canTransferCalls?: boolean;
    canAccessKnowledge?: boolean;
    [key: string]: boolean | undefined;
  };
}

export interface ToolRequest<TArgs = Record<string, any>> {
  toolName: string;
  toolVersion?: string;
  conversationId: string;
  organizationId: string;
  agentId: string;
  agentVersionId?: number;
  requestedBy: ToolCallerType;
  arguments: TArgs;
  requestedAt: string;
  correlationId: string;
  idempotencyKey?: string;
  isConfirmed?: boolean;
}

export interface ToolResult<TData = any> {
  success: boolean;
  status: ToolLifecycleState;
  toolName: string;
  toolVersion: string;
  data?: TData;
  userSafeMessage: string;
  errorCode?: string;
  retryable: boolean;
  correlationId: string;
  executionDurationMs?: number;
}

export interface ToolExecutionEventDTO {
  id: string;
  organizationId: string;
  conversationId: string;
  agentId: string;
  agentVersion: number;
  toolName: string;
  toolVersion: string;
  requestedBy: ToolCallerType;
  correlationId: string;
  lifecycleState: ToolLifecycleState;
  riskLevel: ToolRiskLevel;
  status: string;
  argumentsSanitized: Record<string, any>;
  resultSanitized?: Record<string, any>;
  errorCode?: string;
  userSafeMessage?: string;
  executionDurationMs: number;
  createdAt: string;
}

export interface ToolHandlerContext {
  securityContext: ToolSecurityContext;
  correlationId: string;
  idempotencyKey?: string;
  isConfirmed: boolean;
}

export type ToolHandler<TArgs = any, TOutput = any> = (
  args: TArgs,
  context: ToolHandlerContext
) => Promise<TOutput>;

export interface ToolDefinition<TArgs = any, TOutput = any> {
  toolId: string;
  name: string;
  description: string;
  version: string;
  category: ToolCategory;
  inputSchema: z.ZodType<TArgs>;
  outputSchema?: z.ZodType<TOutput>;
  requiredPermissions: string[];
  riskLevel: ToolRiskLevel;
  confirmationRequired: boolean;
  confirmationMode: ToolConfirmationMode;
  supportedIndustries: (IndustryType | '*')[];
  enabled: boolean;
  timeoutMs: number;
  idempotent: boolean;
  handler: ToolHandler<TArgs, TOutput>;
}
