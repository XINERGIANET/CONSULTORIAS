import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { authLogin, authLogout, authMe } from "../auth/api";
import type { AuthUser } from "../auth/types";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSuperadmin: boolean;
  hasPermission: (code: string) => boolean;
  refreshUser: () => Promise<void>;
  login: (payload: { email: string; password: string; remember?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(window.__AUTH__ ?? null);
  const [loading, setLoading] = useState(false);

  const refreshUser = async () => {
    setLoading(true);
    try {
      const me = await authMe();
      setUser(me);
    } finally {
      setLoading(false);
    }
  };

  const login = async (payload: { email: string; password: string; remember?: boolean }) => {
    setLoading(true);
    try {
      await authLogin(payload);
    } catch (e) {
      setLoading(false);
      throw e;
    }
    // Recarga completa para que Laravel embeba en window.__APEX__ los indicadores
    // reales del usuario recien autenticado (con sesion vacia se calculan en 0/vacio
    // y el dashboard se queda mostrando el contenido de relleno hasta que se refresque).
    window.location.href = "/";
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authLogout();
    } catch {
      // Si el servidor falla (ej. CSRF expirado), igual cerramos la sesión local.
    } finally {
      // Recarga completa para que Laravel emita una nueva cookie XSRF-TOKEN limpia.
      // Sin esto, la SPA reutiliza el token viejo y el siguiente login falla con 419.
      window.location.href = "/login";
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: user !== null,
      isSuperadmin: Boolean(user?.is_superadmin),
      hasPermission: (code: string) => {
        if (!user) return false;
        if (user.is_superadmin) return true;
        return Array.isArray(user.permissions) && user.permissions.includes(code);
      },
      refreshUser,
      login,
      logout,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}

