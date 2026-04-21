import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "http://10.100.148.251:3099",
});

export const { signIn, signUp, signOut, useSession } = authClient;
