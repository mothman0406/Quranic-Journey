import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, authUserTable, authSessionTable, authAccountTable, authVerificationTable } from "@workspace/db";

const DEV_TRUSTED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://10.*:5173",
  "http://192.168.*:5173",
  ...Array.from({ length: 16 }, (_, index) => `http://172.${index + 16}.*:5173`),
];

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET must be set in .env");
}

if (!process.env.BETTER_AUTH_URL) {
  throw new Error("BETTER_AUTH_URL must be set in .env");
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUserTable,
      session: authSessionTable,
      account: authAccountTable,
      verification: authVerificationTable,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: DEV_TRUSTED_ORIGINS,
});

export type Session = typeof auth.$Infer.Session;
