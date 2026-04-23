import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "http://10.0.0.223:3099",
});

export const { signIn, signUp, signOut, useSession } = authClient;
