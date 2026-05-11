import { useEffect, useState } from "react";
import { authBaseURL } from "@/src/lib/auth-client";

export type AuthPublicConfig = {
  socialProviders: {
    apple: boolean;
    google: boolean;
  };
  passwordReset: {
    enabled: boolean;
    emailDeliveryConfigured: boolean;
  };
};

export const DISABLED_SOCIAL_PROVIDERS = {
  apple: false,
  google: false,
} as const;

type AuthPublicConfigState = {
  config: AuthPublicConfig | null;
  isLoading: boolean;
  isUnavailable: boolean;
};

export function useAuthPublicConfig() {
  const [state, setState] = useState<AuthPublicConfigState>({
    config: null,
    isLoading: true,
    isUnavailable: false,
  });

  useEffect(() => {
    let active = true;

    fetch(`${authBaseURL}/api/auth/config`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Auth config unavailable");
        return (await response.json()) as AuthPublicConfig;
      })
      .then((nextConfig) => {
        if (active) {
          setState({ config: nextConfig, isLoading: false, isUnavailable: false });
        }
      })
      .catch(() => {
        if (active) {
          setState({ config: null, isLoading: false, isUnavailable: true });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
