/**
 * @vanni/observability — Startup Production Environment Validator
 *
 * Verifies:
 * - REQUIRED vs OPTIONAL environment variables
 * - Secret leak prevention (ensuring dummy/placeholder detection)
 * - Safe server boot
 */

export interface EnvValidationResult {
  valid: boolean;
  environment: string;
  missingRequired: string[];
  warnings: string[];
}

export function validateProductionEnvironment(): EnvValidationResult {
  const env = process.env.NODE_ENV || 'development';
  const missingRequired: string[] = [];
  const warnings: string[] = [];

  // Variables strictly required for all environments
  const BASE_REQUIRED = ['API_PORT', 'HOST'];
  for (const k of BASE_REQUIRED) {
    if (!process.env[k]) {
      // In dev we provide defaults, but warn if missing
      warnings.push(`Environment variable '${k}' is not explicitly defined (defaulting safely).`);
    }
  }

  // Variables strictly required for PRODUCTION deployments
  if (env === 'production') {
    const PROD_REQUIRED = [
      'DATABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'RAZORPAY_WEBHOOK_SECRET',
    ];

    for (const k of PROD_REQUIRED) {
      if (!process.env[k] || process.env[k]?.includes('placeholder')) {
        missingRequired.push(k);
      }
    }

    if (!process.env.SARVAM_API_KEY && !process.env.GEMINI_API_KEY) {
      missingRequired.push('SARVAM_API_KEY or GEMINI_API_KEY (Speech/LLM providers required in production)');
    }
  } else {
    // In development/test, warn about mock fallbacks
    if (!process.env.SARVAM_API_KEY) {
      warnings.push('SARVAM_API_KEY not found; falling back to Mock STT/TTS Provider for development.');
    }
    if (!process.env.GEMINI_API_KEY) {
      warnings.push('GEMINI_API_KEY not found; falling back to Mock LLM Provider for development.');
    }
    if (!process.env.RAZORPAY_KEY_SECRET) {
      warnings.push('RAZORPAY_KEY_SECRET not found; falling back to Mock Billing Provider.');
    }
  }

  return {
    valid: missingRequired.length === 0,
    environment: env,
    missingRequired,
    warnings,
  };
}
