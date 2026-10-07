/**
 * @vanni/auth — Security & Authorization Errors
 */

export class AuthError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 400, code = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AuthError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class OrganizationAccessDeniedError extends ForbiddenError {
  constructor(organizationId?: string) {
    const msg = organizationId
      ? `You do not have access to organization ${organizationId}.`
      : "You don't have access to this organization.";
    super(msg);
    this.code = 'ORG_ACCESS_DENIED';
    this.name = 'OrganizationAccessDeniedError';
  }
}

export class InactiveMembershipError extends ForbiddenError {
  constructor() {
    super('Your membership in this organization is inactive or suspended.');
    this.code = 'MEMBERSHIP_INACTIVE';
    this.name = 'InactiveMembershipError';
  }
}

export class NotFoundError extends AuthError {
  constructor(resource = 'Resource') {
    super(`${resource} not found.`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AuthError {
  public errors?: Record<string, string[]>;

  constructor(message: string, errors?: Record<string, string[]>) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}
