import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { expo } from "@better-auth/expo";
import type { SocialProviders } from "better-auth/social-providers";
import { db, authUserTable, authSessionTable, authAccountTable, authVerificationTable } from "@workspace/db";
import { isEmailDeliveryConfigured, sendPasswordResetEmail } from "./lib/email.js";
import { logger } from "./lib/logger.js";

const DEV_TRUSTED_ORIGINS = [
  process.env.DEV_FRONTEND_ORIGIN,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://10.*:5173",
  "http://192.168.*:5173",
  ...Array.from({ length: 16 }, (_, index) => `http://172.${index + 16}.*:5173`),
].filter((origin): origin is string => !!origin);

const PROD_TRUSTED_ORIGINS = (process.env.PROD_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MOBILE_TRUSTED_ORIGINS = [
  "noormobile:/",
  "noormobile://",
  "noormobile:///",
  "exp:/",
  "exp://",
  "exps:/",
  "exps://",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
];

function buildSocialProviders(): SocialProviders | undefined {
  const socialProviders: SocialProviders = {};
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appleClientId = process.env.APPLE_CLIENT_ID;
  const appleClientSecret = process.env.APPLE_CLIENT_SECRET;

  if (googleClientId && googleClientSecret) {
    socialProviders.google = {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    };
  } else {
    logger.warn("Google sign-in is disabled because GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing");
  }

  if (appleClientId && appleClientSecret) {
    socialProviders.apple = {
      clientId: appleClientId,
      clientSecret: appleClientSecret,
      appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER,
    };
  } else {
    logger.warn("Apple sign-in is disabled because APPLE_CLIENT_ID or APPLE_CLIENT_SECRET is missing");
  }

  return Object.keys(socialProviders).length > 0 ? socialProviders : undefined;
}

function isGoogleSignInConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function isAppleSignInConfigured() {
  return !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET);
}

export function getAuthPublicConfig() {
  return {
    socialProviders: {
      apple: isAppleSignInConfigured(),
      google: isGoogleSignInConfigured(),
    },
    passwordReset: {
      enabled: true,
      emailDeliveryConfigured: process.env.NODE_ENV !== "production" || isEmailDeliveryConfigured(),
    },
  };
}

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET must be set in .env");
}

if (!process.env.BETTER_AUTH_URL) {
  throw new Error("BETTER_AUTH_URL must be set in .env");
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  plugins: [expo()],
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
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      try {
        await sendPasswordResetEmail({ to: user.email, url });
      } catch (err) {
        logger.error({ err, userId: user.id }, "Password reset email failed");
        throw err;
      }
    },
  },
  socialProviders: buildSocialProviders(),
  trustedOrigins: [...DEV_TRUSTED_ORIGINS, ...PROD_TRUSTED_ORIGINS, ...MOBILE_TRUSTED_ORIGINS],
});

export type Session = typeof auth.$Infer.Session;
