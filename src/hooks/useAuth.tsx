import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type UserRole = "politico" | "assessor" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>(null);

  const fetchRole = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      setRole((data?.role as UserRole) || "politico");
    } catch (err) {
      console.error("[useAuth] fetchRole error:", err);
      setRole("politico");
    }
  };

  useEffect(() => {
    let mounted = true;

    // Timeout de segurança: nunca deixar a UI travada em loading no Safari
    const safety = setTimeout(() => {
      if (mounted) {
        console.warn("[useAuth] Safety timeout — forçando loading=false");
        setLoading(false);
      }
    }, 4000);

    // 1) Listener PRIMEIRO — apenas updates síncronos de state aqui!
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer para o próximo tick — evita deadlock do supabase no Safari
        setTimeout(() => {
          if (mounted) fetchRole(newSession.user.id);
        }, 0);
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    // 2) Pega sessão existente
    supabase.auth.getSession()
      .then(({ data: { session: existing } }) => {
        if (!mounted) return;
        setSession(existing);
        setUser(existing?.user ?? null);
        if (existing?.user) {
          setTimeout(() => {
            if (mounted) fetchRole(existing.user.id);
          }, 0);
        }
        setLoading(false);
        clearTimeout(safety);
      })
      .catch((err) => {
        console.error("[useAuth] getSession error:", err);
        if (mounted) setLoading(false);
        clearTimeout(safety);
      });

    return () => {
      mounted = false;
      clearTimeout(safety);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
