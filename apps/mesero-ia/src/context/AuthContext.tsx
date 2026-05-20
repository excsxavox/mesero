import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearStoredSession,
  getPersistedSession,
  getStoredSession,
  loginRequest,
  refreshSession,
  type AuthProfile,
  type AuthSession,
} from "../lib/authSession";

type AuthContextValue = {
  session: AuthSession | null;
  profile: AuthProfile | null;
  booting: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  displayName: string;
  companyName: string;
  roleName: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const persisted = getPersistedSession();
      if (!persisted?.accessToken) {
        if (!cancelled) {
          setSession(null);
          setBooting(false);
        }
        return;
      }
      const next = await refreshSession();
      if (cancelled) return;
      if (next) setSession(next);
      else {
        clearStoredSession();
        setSession(null);
      }
      setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session?.accessToken) return;

    const sync = () => {
      void refreshSession().then((next) => {
        if (next) setSession(next);
        else if (!getStoredSession()) {
          clearStoredSession();
          setSession(null);
        }
      });
    };

    const intervalId = window.setInterval(sync, 60_000);
    const onFocus = () => sync();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [session?.accessToken, session?.refreshToken]);

  const login = useCallback(async (email: string, password: string) => {
    const next = await loginRequest(email, password);
    setSession(next);
    setBooting(false);
  }, []);

  const logout = useCallback(() => {
    clearStoredSession();
    setSession(null);
  }, []);

  const profile = session?.profile ?? null;

  const value = useMemo(
    () => ({
      session,
      profile,
      booting,
      login,
      logout,
      displayName: profile?.displayName?.trim() || session?.email?.trim() || "Usuario",
      companyName: profile?.companyName?.trim() || "Mi restaurante",
      roleName: profile?.roleName?.trim() || null,
    }),
    [session, profile, booting, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
