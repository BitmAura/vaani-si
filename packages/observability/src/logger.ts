/**
 * @vanni/observability — Centralized PII Redactor & Structured Logger
 *
 * Provides safe sanitization of sensitive personal, medical, and financial data:
 * - Indian phone numbers (+91, 10-digit mobile)
 * - Email addresses
 * - Credit card / PAN / Aadhaar patterns
 * - API keys, tokens, and authorization headers
 */

export interface LogContext {
  organizationId?: string;
  userId?: string;
  conversationId?: string;
  voiceSessionId?: string;
  agentId?: string;
  provider?: string;
  operation?: string;
  durationMs?: number;
  status?: string;
  correlationId?: string;
  [key: string]: any;
}

export class PiiRedactor {
  // Regexes for common sensitive patterns
  private static readonly PHONE_REGEX = /(\+?91[\-\s]?)?[6-9]\d{9}/g;
  private static readonly EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  private static readonly AADHAAR_REGEX = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
  private static readonly PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g;
  private static readonly TOKEN_REGEX = /(bearer\s+[a-zA-Z0-9_\-\.]+)|(key_[a-zA-Z0-9]+)|(sec_[a-zA-Z0-9]+)/gi;

  /**
   * Redacts sensitive string patterns
   */
  static redactString(text: string): string {
    if (!text || typeof text !== 'string') return text;
    return text
      .replace(this.PHONE_REGEX, '[REDACTED_PHONE]')
      .replace(this.EMAIL_REGEX, '[REDACTED_EMAIL]')
      .replace(this.AADHAAR_REGEX, '[REDACTED_AADHAAR]')
      .replace(this.PAN_REGEX, '[REDACTED_PAN]')
      .replace(this.TOKEN_REGEX, '[REDACTED_SECRET]');
  }

  /**
   * Recursively traverses and redacts an object or array
   */
  static redactObject<T>(input: T): T {
    if (input === null || input === undefined) return input;
    if (typeof input === 'string') return this.redactString(input) as unknown as T;
    if (typeof input !== 'object') return input;

    if (Array.isArray(input)) {
      return input.map(item => this.redactObject(item)) as unknown as T;
    }

    const output: Record<string, any> = {};
    const SENSITIVE_KEYS = new Set([
      'password',
      'secret',
      'authorization',
      'keysecret',
      'razorpay_secret',
      'token',
      'apikey',
      'cardnumber',
      'cvv',
      'otp',
    ]);

    for (const [key, value] of Object.entries(input)) {
      const lower = key.toLowerCase().replace(/[^a-z]/g, '');
      if (SENSITIVE_KEYS.has(lower)) {
        output[key] = '[REDACTED_SECRET]';
      } else if (typeof value === 'string') {
        output[key] = this.redactString(value);
      } else if (typeof value === 'object') {
        output[key] = this.redactObject(value);
      } else {
        output[key] = value;
      }
    }

    return output as T;
  }
}

export class StructuredLogger {
  private serviceName: string;

  constructor(serviceName: string = 'vanni-core') {
    this.serviceName = serviceName;
  }

  private emit(level: 'info' | 'warn' | 'error' | 'security', message: string, context?: LogContext) {
    const sanitizedContext = context ? PiiRedactor.redactObject(context) : {};
    const payload = {
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      level,
      message: PiiRedactor.redactString(message),
      ...sanitizedContext,
    };

    const formatted = JSON.stringify(payload);
    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  info(message: string, context?: LogContext) {
    this.emit('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.emit('warn', message, context);
  }

  error(message: string, context?: LogContext) {
    this.emit('error', message, context);
  }

  security(message: string, context?: LogContext) {
    this.emit('security', message, context);
  }
}

export interface AuditLogEntry {
  organizationId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  correlationId?: string;
  actorType?: string;
  actorId?: string;
  details?: Record<string, any>;
  timestamp?: string;
}

export class AuditLogger {
  private static events: AuditLogEntry[] = [];

  static log(entry: AuditLogEntry) {
    const record: AuditLogEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
      details: entry.details ? PiiRedactor.redactObject(entry.details) : undefined,
    };
    this.events.push(record);
    logger.info(`[AUDIT] ${entry.action} on ${entry.resourceType}:${entry.resourceId || 'N/A'}`, {
      organizationId: entry.organizationId,
      correlationId: entry.correlationId,
      actorType: entry.actorType,
    });
  }

  static getEntries(organizationId?: string): AuditLogEntry[] {
    if (organizationId) {
      return this.events.filter(e => e.organizationId === organizationId);
    }
    return [...this.events];
  }

  static clear() {
    this.events = [];
  }
}

export const logger = new StructuredLogger('vanni-platform');
