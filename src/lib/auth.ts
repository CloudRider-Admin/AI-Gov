import { PrismaAdapter } from '@auth/prisma-adapter';
import { NextAuthOptions } from 'next-auth';
import type { Provider } from 'next-auth/providers/index';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts } from '@/lib/rate-limit';
import { authRequestContext, recordAuthEvent } from '@/lib/authAudit';

/** True only when both halves of an OAuth app credential are present. */
export const googleAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);
export const githubAuthEnabled = Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET);

// Build the provider list dynamically so a missing OAuth credential simply
// omits that provider instead of registering a broken one (clientId=undefined).
const providers: Provider[] = [
  CredentialsProvider({
    name: 'credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials, req) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const context = authRequestContext(req?.headers);
      const email = credentials.email;

      // Check if this email is locked out before touching the DB for the user
      const rateCheck = await checkLoginRateLimit(email);
      if (!rateCheck.allowed) {
        const minutes = Math.ceil((rateCheck.retryAfter ?? 900) / 60);
        await recordAuthEvent({
          action: 'auth.login_blocked',
          email,
          summary: `Sign-in blocked for ${email}: too many failed attempts, locked out for ${minutes} more minute(s).`,
          context,
          metadata: { retryAfterSeconds: rateCheck.retryAfter ?? null },
        });
        throw new Error(`RateLimited:${minutes}`);
      }

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.hashedPassword) {
        // Record failure even for unknown emails (prevents user enumeration via timing)
        await recordFailedLogin(email);
        await recordAuthEvent({
          action: 'auth.login_failed',
          email,
          summary: `Failed sign-in for ${email}: no account with a password credential.`,
          context,
          metadata: { reason: 'unknown-account' },
        });
        return null;
      }

      const isValid = await bcrypt.compare(credentials.password, user.hashedPassword);
      if (!isValid) {
        await recordFailedLogin(email);
        await recordAuthEvent({
          action: 'auth.login_failed',
          userId: user.id,
          email,
          summary: `Failed sign-in for ${email}: incorrect password.`,
          context,
          metadata: { reason: 'bad-password' },
        });
        return null;
      }

      if (!user.emailVerified) {
        await recordAuthEvent({
          action: 'auth.email_unverified',
          userId: user.id,
          email,
          summary: `Sign-in refused for ${email}: the email address has not been verified.`,
          context,
        });
        throw new Error('EmailNotVerified');
      }

      // Successful login — clear the failure counter
      await clearLoginAttempts(email);

      await recordAuthEvent({
        action: 'auth.signed_in',
        userId: user.id,
        email,
        summary: `${email} signed in with a password credential.`,
        context,
        metadata: { provider: 'credentials' },
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      };
    },
  }),
];

if (googleAuthEnabled) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Google verifies email ownership, so linking to an existing (already
      // email-verified) account is safe and avoids duplicate accounts.
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

if (githubAuthEnabled) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

// Session lifetime. NextAuth's default is 30 days with no idle timeout, which
// is well outside what a governance workload should carry: NIST 800-53 AC-11
// wants an inactivity lock and AC-12 an absolute termination. `maxAge` is the
// absolute cap; `updateAge` is how often an active session is re-issued, which
// is also how often the role is re-read from the database.
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;   // 8 hours — one working day
const SESSION_UPDATE_AGE_SECONDS = 15 * 60;    // re-issue at most every 15 minutes

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Fetch role from DB on first sign-in (user object only present then)
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        token.role = dbUser?.role ?? 'FREE';
        token.roleCheckedAt = Date.now();
        return token;
      }

      // Re-read the role periodically so plan upgrades/downgrades (e.g. a Stripe
      // webhook flipping the user to FREE) and admin demotions take effect
      // without the user having to sign out and back in.
      //
      // This runs on every authenticated request, so it MUST fail safe: a DB
      // hiccup here must never throw out of the jwt callback, or getServerSession
      // rejects and every authenticated route 500s. On error we keep the role
      // already on the token and retry on the next interval.
      const ROLE_TTL_MS = 5 * 60 * 1000;
      const lastChecked = typeof token.roleCheckedAt === 'number' ? token.roleCheckedAt : 0;
      if (token.id && Date.now() - lastChecked > ROLE_TTL_MS) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true },
          });
          if (dbUser) {
            // A role change is a privilege change, so it belongs on the trail
            // whether an admin made it or a Stripe webhook did.
            if (dbUser.role !== token.role) {
              await recordAuthEvent({
                action: 'auth.role_changed',
                userId: token.id as string,
                email: typeof token.email === 'string' ? token.email : null,
                summary: `Role changed ${token.role ?? 'unknown'} → ${dbUser.role} and took effect on an active session.`,
                metadata: { from: token.role ?? null, to: dbUser.role },
              });
            }
            token.role = dbUser.role;
          }
          token.roleCheckedAt = Date.now();
        } catch (err) {
          // Don't advance roleCheckedAt — retry the refresh on the next request.
          console.error('[auth] role refresh failed; keeping cached role:', err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  events: {
    /**
     * Fires for every provider. The credentials path already writes its own
     * entry inside `authorize` (where the failure cases live), so this records
     * the OAuth providers and avoids double-logging password sign-ins.
     */
    async signIn({ user, account, isNewUser }) {
      if (account?.provider === 'credentials') return;
      await recordAuthEvent({
        action: 'auth.signed_in',
        userId: user.id,
        email: user.email ?? null,
        summary: `${user.email ?? user.id} signed in with ${account?.provider ?? 'an external provider'}${
          isNewUser ? ' for the first time' : ''
        }.`,
        metadata: { provider: account?.provider ?? null, isNewUser: Boolean(isNewUser) },
      });
    },

    async signOut({ token }) {
      if (!token?.id) return;
      await recordAuthEvent({
        action: 'auth.signed_out',
        userId: token.id as string,
        email: typeof token.email === 'string' ? token.email : null,
        summary: `${token.email ?? token.id} signed out.`,
      });
    },
  },
};
