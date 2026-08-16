import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { resolveActor } from "@/lib/roleMap";

// Split out from app/api/auth/[...nextauth]/route.ts: Next.js App Router
// route.ts files may only export recognized route handlers (GET, POST,
// etc.) — exporting authOptions directly from route.ts fails Next's
// build-time route export validation ("does not match the required
// types of a Next.js Route Handler"). Keeping the config here and
// importing it into route.ts (and into the other API routes that need
// getServerSession(authOptions)) avoids that.

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    // Mirrors _requireActor_(): reject sign-in from any account not in
    // the ROLE_MAP allowlist, rather than trusting whatever the client claims.
    async signIn({ user }) {
      const role = resolveActor(user.email);
      return role !== null;
    },
    async session({ session }) {
      if (session.user?.email) {
        (session.user as { role?: string | null }).role = resolveActor(
          session.user.email
        );
      }
      return session;
    },
  },
  pages: {
    // TODO: build a simple sign-in screen — for now NextAuth's default page.
    error: "/api/auth/error",
  },
};
