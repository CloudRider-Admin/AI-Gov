import { PrismaAdapter } from '@auth/prisma-adapter';
import { NextAuthOptions } from 'next-auth';
import type { Provider } from 'next-auth/providers/index';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts } from '@/lib/rate-limit';

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
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      // Check if this email is locked out before touching the DB for the user
      const rateCheck = await checkLoginRateLimit(credentials.email);
      if (!rateCheck.allowed) {
        const minutes = Math.ceil((rateCheck.retryAfter ?? 900) / 60);
        throw new Error(`RateLimited:${minutes}`);
      }

      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
      });

      if (!user || !user.hashedPassword) {
        // Record failure even for unknown emails (prevents user enumeration via timing)
        await recordFailedLogin(credentials.email);
        return null;
      }

      const isValid = await bcrypt.compare(credentials.password, user.hashedPassword);
      if (!isValid) {
        await recordFailedLogin(credentials.email);
        return null;
      }

      if (!user.emailVerified) {
        throw new Error('EmailNotVerified');
      }

      // Successful login — clear the failure counter
      await clearLoginAttempts(credentials.email);

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

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
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
};
