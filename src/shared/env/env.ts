import { z } from 'zod';

export const envSchema = z.object({
  // App
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis / BullMQ
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  // Auth
  JWT_SECRET: z.string().min(16),
  SECURITY_TOKEN: z.string().optional(),

  // OpenRouter
  OPEN_ROUTER_KEY: z.string(),
  OPEN_ROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  DEFAULT_IMAGE_MODEL: z.string().default('google/gemini-2.5-flash-image'),

  // Storage
  STORAGE_DRIVER: z.enum(['r2', 'local']).default('local'),
  LOCAL_STORAGE_PATH: z.string().default('./uploads'),
  LOCAL_STORAGE_BASE_URL: z.string().default('http://localhost:3333/uploads'),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_AWS_ACCESS_KEY_ID: z.string().optional(),
  CLOUDFLARE_AWS_SECRET_ACCESS_KEY_ID: z.string().optional(),
  AWS_BUCKET_NAME: z.string().optional(),
  CLOUDFLARE_PUBLIC_URL: z.string().optional(),

  // Seed admin
  SEED_ADMIN_EMAIL: z.string().email().default('admin@seoblog.local'),
  SEED_ADMIN_PASSWORD: z.string().default('123456'),
  SEED_ADMIN_NAME: z.string().default('Admin'),

  // Tracking hub (ver docs/tracking/) — salt para pseudonimizar IP. IP cru nunca é persistido.
  TRACKING_IP_SALT: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;
