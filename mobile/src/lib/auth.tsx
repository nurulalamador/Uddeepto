import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert } from "react-native";
import { api, ApiError, clearTokens, getRefreshToken, loadTokens, saveTokens, setSignedOutHandler } from "./api";

export type User = {
  id: string;
  uddeepto_id: string;
  name: string;
  username: string;
  email?: string;
  role: "learner" | "hirer" | "admin" | string;
  headline?: string | null;
  bio?: string | null;
  picture_mime_type?: string | null;
  interests?: { id: string; name: string; icon?: string }[];
};

type AuthState = {
  status: "loading" | "signedOut" | "signedIn";
  user: User | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; username: string; password: string; role: "learner" | "hirer" }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);
export const useAuth = () => useContext(AuthContext);

export const ADMIN_MESSAGE = "Admin should must use web version";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<User | null>(null);

  const endSession = useCallback(() => {
    setUser(null);
    setStatus("signedOut");
  }, []);

  useEffect(() => {
    setSignedOutHandler(endSession);
    (async () => {
      try {
        if (!(await loadTokens())) return endSession();
        const me = await api<User>("users/me");
        if (me.role === "admin") {
          await clearTokens();
          return endSession();
        }
        setUser(me);
        setStatus("signedIn");
      } catch (error) {
        // No connection at start-up is not a sign-out; anything else is.
        if (error instanceof ApiError && error.status === 0 && getRefreshToken()) {
          setStatus("signedOut");
        } else {
          await clearTokens();
          endSession();
        }
      }
    })();
  }, [endSession]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const result = await api<{ user: User; accessToken: string; refreshToken: string }>("auth/login", { method: "POST", body: { identifier: identifier.trim(), password }, auth: false });
    if (result.user.role === "admin") {
      // Administrators work on the website. End the session that was just opened and keep nothing.
      await api("auth/logout", { method: "POST", body: { refreshToken: result.refreshToken }, auth: false }).catch(() => {});
      Alert.alert("Admin account", ADMIN_MESSAGE);
      throw new ApiError(403, ADMIN_MESSAGE);
    }
    await saveTokens(result);
    setUser(result.user);
    setStatus("signedIn");
  }, []);

  const register = useCallback(async (input: { name: string; email: string; username: string; password: string; role: "learner" | "hirer" }) => {
    const result = await api<{ user: User; accessToken: string; refreshToken: string }>("auth/register", { method: "POST", body: input, auth: false });
    await saveTokens(result);
    setUser({ ...result.user, interests: [] });
    setStatus("signedIn");
  }, []);

  const signOut = useCallback(async () => {
    const token = getRefreshToken();
    if (token) await api("auth/logout", { method: "POST", body: { refreshToken: token }, auth: false }).catch(() => {});
    await clearTokens();
    endSession();
  }, [endSession]);

  const refreshUser = useCallback(async () => {
    const me = await api<User>("users/me");
    setUser(me);
  }, []);

  const value = useMemo(() => ({ status, user, signIn, register, signOut, refreshUser }), [status, user, signIn, register, signOut, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
