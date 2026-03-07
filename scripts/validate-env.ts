#!/usr/bin/env tsx
/**
 * Environment Variable Validation Script
 *
 * This script validates that required environment variables are set before
 * starting the development server. It prevents runtime errors due to missing
 * configuration and catches potential security issues (e.g., placeholder values).
 *
 * Usage:
 *   npm run validate-env
 *   Or add to dev.sh to run before starting servers
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
  pattern?: RegExp;
  forbiddenPatterns?: RegExp[];
}

const REQUIRED_ENV_VARS: EnvVar[] = [
  {
    name: 'JWT_SECRET',
    required: true,
    description: 'JWT signing secret (must be at least 32 bytes)',
    pattern: /^.{32,}$/,
    forbiddenPatterns: [
      /your-jwt-secret-here/i,
      /example/i,
      /placeholder/i,
    ],
  },
  {
    name: 'ENVIRONMENT',
    required: true,
    description: 'Environment name (development, production)',
  },
  {
    name: 'ALLOWED_ORIGINS',
    required: true,
    description: 'CORS allowed origins (comma-separated)',
    forbiddenPatterns: [/your-allowed-origins-here/i],
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    required: true,
    description: 'Google OAuth client ID',
    pattern: /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/,
    forbiddenPatterns: [/your-google-client-id-here/i],
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    required: true,
    description: 'Google OAuth client secret',
    pattern: /^GOCSPX-[a-zA-Z0-9_-]+$/,
    forbiddenPatterns: [/your-google-client-secret-here/i],
  },
  {
    name: 'GOOGLE_REDIRECT_URI',
    required: true,
    description: 'Google OAuth redirect URI',
    forbiddenPatterns: [/your-google-redirect-uri-here/i],
  },
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function loadEnvVars(): Record<string, string> {
  // In Cloudflare Workers, env vars are loaded differently
  // This script reads from .dev.vars for local development
  const envPath = path.join(process.cwd(), '.dev.vars');

  if (!fs.existsSync(envPath)) {
    console.error('❌ .dev.vars file not found!');
    console.error('📝 Copy .dev.vars.example to .dev.vars and fill in your values:');
    console.error('   cp .dev.vars.example .dev.vars');
    process.exit(1);
  }

  const envFile = fs.readFileSync(envPath, 'utf-8');
  const envVars: Record<string, string> = {};

  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  }

  return envVars;
}

function validateEnvVar(envVar: EnvVar, value: string | undefined): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  // Check if required variable is missing
  if (envVar.required && !value) {
    result.valid = false;
    result.errors.push(`❌ ${envVar.name}: Missing (required)`);
    result.errors.push(`   Description: ${envVar.description}`);
    return result;
  }

  // Skip further validation if value is missing (and not required)
  if (!value) {
    return result;
  }

  // Check format pattern
  if (envVar.pattern && !envVar.pattern.test(value)) {
    result.valid = false;
    result.errors.push(`❌ ${envVar.name}: Invalid format`);
    result.errors.push(`   Description: ${envVar.description}`);
    result.errors.push(`   Expected pattern: ${envVar.pattern}`);
  }

  // Check for forbidden patterns (placeholder values)
  if (envVar.forbiddenPatterns) {
    for (const pattern of envVar.forbiddenPatterns) {
      if (pattern.test(value)) {
        result.valid = false;
        result.errors.push(`❌ ${envVar.name}: Contains placeholder value`);
        result.errors.push(`   Description: ${envVar.description}`);
        result.errors.push(`   Current value appears to be a placeholder. Please replace with actual value.`);
        break;
      }
    }
  }

  // Security warnings
  if (envVar.name === 'JWT_SECRET' && value.length < 32) {
    result.warnings.push(`⚠️  ${envVar.name}: Less than 32 bytes (recommended: 32+)`);
  }

  return result;
}

function main() {
  console.log('🔍 Validating environment variables...\n');

  const envVars = loadEnvVars();
  const allResults: ValidationResult = { valid: true, errors: [], warnings: [] };

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = envVars[envVar.name];
    const result = validateEnvVar(envVar, value);

    allResults.valid = allResults.valid && result.valid;
    allResults.errors.push(...result.errors);
    allResults.warnings.push(...result.warnings);
  }

  // Print results
  if (allResults.errors.length > 0) {
    console.error('Environment validation failed:\n');
    for (const error of allResults.errors) {
      console.error(error);
    }
    console.error('\n❌ Validation failed. Please fix the errors above.');
    process.exit(1);
  }

  if (allResults.warnings.length > 0) {
    console.warn('Warnings:\n');
    for (const warning of allResults.warnings) {
      console.warn(warning);
    }
    console.warn();
  }

  console.log('✅ All environment variables are valid!\n');
  console.log('Loaded variables:');
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = envVars[envVar.name];
    if (value) {
      // Mask sensitive values
      const isSecret = envVar.name.indexOf('SECRET') >= 0 || envVar.name.indexOf('TOKEN') >= 0;
      const masked = isSecret
        ? `${value.substring(0, 8)}...${value.substring(value.length - 4)}`
        : value;
      console.log(`  ✓ ${envVar.name}: ${masked}`);
    }
  }
  console.log();

  process.exit(allResults.valid ? 0 : 1);
}

// Run if executed directly
main();

export { loadEnvVars, validateEnvVar };
