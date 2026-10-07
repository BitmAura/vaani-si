import { TelephonyCallDirection, TelephonyCallStatus } from '@vanni/provider-sdk';

export interface BusinessPhoneNumberDTO {
  id: string;
  organizationId: string;
  phoneNumber: string;
  countryCode: string;
  provider: 'exotel' | 'mock' | 'twilio';
  providerNumberId?: string;
  assignedAgentId?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PROVISIONING' | 'SUSPENDED';
  capabilities: string[];
  createdAt: string;
  updatedAt: string;
}

export type CallOutcome =
  | 'INFORMATION_PROVIDED'
  | 'LEAD_CAPTURED'
  | 'APPOINTMENT_REQUESTED'
  | 'APPOINTMENT_CONFIRMED'
  | 'CALLBACK_REQUESTED'
  | 'TRANSFERRED_TO_HUMAN'
  | 'CUSTOMER_NOT_INTERESTED'
  | 'CUSTOMER_UNREACHABLE'
  | 'TECHNICAL_FAILURE'
  | 'UNKNOWN';

export type CallEndReason =
  | 'CALLER_HANGUP'
  | 'AI_HANGUP'
  | 'TRANSFERRED'
  | 'TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'UNKNOWN';

export interface TelephonySessionDTO {
  telephonySessionId: string;
  providerCallSid: string;
  organizationId: string;
  phoneNumberId?: string;
  assignedAgentId: string;
  conversationId: string;
  voiceSessionId: string;
  direction: TelephonyCallDirection;
  callerPhoneNumber: string;
  destinationPhoneNumber: string;
  status: TelephonyCallStatus;
  startedAt: string;
  answeredAt?: string;
  endedAt?: string;
  durationSeconds: number;
  endReason?: CallEndReason;
  callOutcome: CallOutcome;
  createdAt: string;
  updatedAt: string;
}

export interface TelephonyEventDTO {
  providerEventId: string;
  telephonySessionId: string;
  organizationId: string;
  eventType: string;
  sequenceNumber: number;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface OrganizationTelephonySettingsDTO {
  organizationId: string;
  defaultAgentId?: string;
  initialSilenceTimeoutSeconds: number;
  conversationSilenceTimeoutSeconds: number;
  maxCallDurationSeconds: number;
  defaultTransferPhoneNumber?: string;
  enableRecording: boolean;
  aiDisclosureEnabled: boolean;
}
