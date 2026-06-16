import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import type { Provider } from "next-auth/providers";
import bcrypt from "bcryptjs";
import {
  isGitHubOAuthEnabled,
  isGoogleOAuthEnabled,
} from "@/lib/auth-providers";
import { db } from "@/lib/db";
import { canRegister, canSignInWithCredentials } from "@/lib/self-hosted";

const providers: Provider[] = [];

if (isGoogleOAuthEnabled()) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  );
}

if (isGitHubOAuthEnabled()) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  );
}

providers.push(
  Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase().trim();

        if (!(await canSignInWithCredentials(email))) {
          return null;
        }

        const user = await db.user.findUnique({ where: { email } });
        if (!user?.hashedPassword) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.hashedPassword
        );
        if (!isValid) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
);

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  // Self-hosted Ghostwatch always serves the dashboard and login from its own
  // host, so Auth.js must trust the incoming host. Enabled by default; set
  // AUTH_TRUST_HOST="false" only if you front it with a proxy that rewrites it.
  trustHost: process.env.AUTH_TRUST_HOST !== "false",
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider === "credentials") return true;

      const email = (profile?.email || user.email)?.toLowerCase().trim();
      if (!email) return false;

      let dbUser = await db.user.findUnique({ where: { email } });

      if (!dbUser) {
        // Enforce the instance registration policy for first-time OAuth users.
        const decision = await canRegister(email);
        if (!decision.allowed) {
          console.warn(
            `[auth] OAuth sign-in rejected (${decision.code})`,
          );
          return false;
        }

        const displayName = user.name || email.split("@")[0];
        const teamSlug = `${displayName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40)}-${Date.now().toString(36)}`;

        dbUser = await db.user.create({
          data: {
            name: displayName,
            email,
            emailVerified: new Date(),
            image: user.image,
          },
        });

        const team = await db.team.create({
          data: {
            name: `${displayName}'s Team`,
            slug: teamSlug,
            members: {
              create: { userId: dbUser.id, role: "ADMIN" },
            },
            projects: {
              create: { name: displayName, slug: `${teamSlug}-default` },
            },
          },
        });
        void team;
      } else if (!dbUser.emailVerified) {
        await db.user.update({
          where: { id: dbUser.id },
          data: {
            emailVerified: new Date(),
            image: dbUser.image || user.image,
          },
        });
      }

      const existing = await db.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
      });

      if (!existing) {
        await db.account.create({
          data: {
            userId: dbUser.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state as string | undefined,
          },
        });
      }

      user.id = dbUser.id;
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  session: { strategy: "jwt" },
});
