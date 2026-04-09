import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { authClient } from "@/lib/auth-client";
import App from "./App";
import "./index.css";

// Apply dark mode before React renders to avoid flash of wrong theme
try {
  if (localStorage.getItem("noor-dark-mode") === "true") {
    document.documentElement.classList.add("dark");
  }
} catch { /* ignore */ }

// Supply the Better Auth session token to every API request
setAuthTokenGetter(async () => {
  const session = await authClient.getSession();
  return session.data?.session?.token ?? null;
});

createRoot(document.getElementById("root")!).render(<App />);
