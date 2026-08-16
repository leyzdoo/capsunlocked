import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { resolveActor } from "@/lib/roleMap";

// Replaces Session.getActiveUser() (migration doc §7.2). Apps Script's
// identity resolution was free because the app ran inside the user's
// Google session; here we need real Google Sign-In via NextAuth, with
// the same ROLE_MAP-style allowlist enforced server-side.

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

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
