import { z } from 'zod';

/**
 * Runtime validation of required environment variables.
 * Import this module early (e.g. in layout.tsx or middleware) to fail fast
 * with clear error messages instead of cryptic runtime crashes.
 */
const envSchema = z.object({
    // Database
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // NextAuth
    NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),
    NEXTAUTH_URL: z.string().url().optional(),

    // OAuth providers (optional — app works without them)
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_ID: z.string().optional(),
    GITHUB_SECRET: z.string().optional(),

    // OpenAI (optional — falls back to demo mode)
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().optional(),

    // Resend (optional — password reset emails logged to console if not set)
    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM_EMAIL: z.string().email().optional(),

    // Stripe (optional — payment features disabled if not set)
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRO_MONTHLY_PRICE_ID: z.string().optional(),
    STRIPE_PRO_ANNUAL_PRICE_ID: z.string().optional(),
    STRIPE_TEAM_MONTHLY_PRICE_ID: z.string().optional(),
    STRIPE_TEAM_ANNUAL_PRICE_ID: z.string().optional(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const formatted = result.error.issues
            .map((i) => `  ✗ ${i.path.join('.')}: ${i.message}`)
            .join('\n');

        console.error(
            `\n❌ Invalid environment variables:\n${formatted}\n\nPlease check your .env / .env.local file.\n`
        );

        throw new Error('Invalid environment configuration');
    }

    return result.data;
}

export const env = validateEnv();
