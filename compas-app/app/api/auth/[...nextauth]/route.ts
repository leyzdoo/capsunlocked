import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// This file must only export recognized Next.js route handlers — see
// lib/auth.ts for why authOptions lives there instead of here.
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
