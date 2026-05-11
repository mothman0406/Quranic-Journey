import * as Linking from "expo-linking";

const APP_SCHEME = "noormobile";

export function createAuthRedirect(path = "") {
  return Linking.createURL(path.replace(/^\/+/, ""), { scheme: APP_SCHEME });
}
