import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { authClient } from "@/lib/auth-client";
import App from "./App";
import "./index.css";

// Supply the Better Auth session token to every API request
setAuthTokenGetter(async () => {
  const session = await authClient.getSession();
  return session.data?.session?.token ?? null;
});

createRoot(document.getElementById("root")!).render(<App />);
