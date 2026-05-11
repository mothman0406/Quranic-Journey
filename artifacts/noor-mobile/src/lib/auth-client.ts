import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

export const authBaseURL =
  process.env.EXPO_PUBLIC_API_URL ??
  "https://workspaceapi-server-production-cc25.up.railway.app";

export const authClient = createAuthClient({
  baseURL: authBaseURL,
  plugins: [
    expoClient({
      scheme: "noormobile",
      storagePrefix: "noor-mobile",
      storage: SecureStore,
    }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
