import { useState, useEffect, createContext, useContext, useMemo, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type UserRole = "politico" | "assessor" | null;

export const PERMISSION_KEYS = [
  "painel",
  "eleitores",
  "mapa-eleitores",
  "aniversarios",
  "demandas",
  "tarefas",
  "agenda",
  "assistente",
  "base-conhecimento",
  "historico-conversas",
  "resumo-mensal",
] as const;

export type PermissionKey = typeof PERMISSION_KEYS[number];
export type Permissions = Record<string, boolean>;

export const ROUTE_TO_PERMISSION: Record<string, PermissionKey> = {
  "/painel": "painel",
  "/eleitores": "eleitores",
  "/mapa-eleitores": "mapa-eleitores",
  "/aniversarios": "aniversarios",
  "/demandas": "demandas",
  "/tarefas": "tarefas",
  "/agenda": "agenda",
  "/assistente": "assistente",
  "/base-conhecimento": "base-conhecimento",
  "/historico-conversas": "historico-conversas",
  "/resumo-mensal": "resumo-mensal",
};

const allTrue = (): Permissions =>
  PERMISSION_KEYS.reduce((acc, k) => ({ ...acc, [k]: true }), {} as Permissions);

const allFalse = (): Permissions =>
  PERMISSION_KEYS.reduce((acc, k) => ({ ...acc, [k]: false }), {} as Permissions);

export type Tier = "lite" | "completo";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole;
  permissions: Permissions;
  permsLoaded: boolean;
  plano: "bronze" | "prata" | "ouro";
  assinaturaStatus: string;
  tier: Tier;
  isLite: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  permissions: allFalse(),
  permsLoaded: false,
  plano: "ouro",
  assinaturaStatus: "ativa",
  tier: "completo",
  isLite: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>(null);
  const [permissions, setPermissions] = useState<Permissions>(allFalse());
  const [permsLoaded, setPermsLoaded] = useState(false);
  const [plano, setPlano] = useState<"bronze" | "prata" | "ouro">("ouro");
  const [assinaturaStatus, setAssinaturaStatus] = useState<string>("ativa");
  const [tier, setTier] = useState<Tier>("completo");

  // Busca o tier (lite/completo). Tolerante a linhas duplicadas de profile:
  // usa a primeira linha encontrada em vez de falhar com maybeSingle().
  const fetchTier = async (ownerUserId: string): Promise<Tier> => {
    try {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("tier, created_at")
        .eq("user_id", ownerUserId)
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) {
        console.warn("[useAuth] fetchTier error:", error.message);
        return "completo";
      }
      const row = Array.isArray(data) ? data[0] : data;
      const t = (row?.tier as Tier) === "lite" ? "lite" : "completo";
      console.log("[useAuth] tier:", t, "(raw:", row?.tier, ")");
      return t;
    } catch (e) {
      console.warn("[useAuth] fetchTier exception:", e);
      return "completo";
    }
  };

  const fetchRoleAndPerms = async (userId: string) => {
    setPermsLoaded(false);
    try {
      const [{ data: profile }, { data: link }] = await Promise.all([
        supabase
          .from("profiles")
          .select("role, plano, assinatura_status")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("politician_assessors")
          .select("permissions, politician_id")
          .eq("assessor_id", userId)
          .maybeSingle(),
      ]);

      const p = ((profile as any)?.plano as "bronze" | "prata" | "ouro") || "ouro";
      setPlano(p);
      setAssinaturaStatus(((profile as any)?.assinatura_status as string) || "ativa");

      // If user is linked as an assessor, they are an assessor — regardless of profile.role
      const isAssessor = !!link;

      // Assessor herda o tier do político responsável
      const tierOwner = (isAssessor && (link as any)?.politician_id) || userId;
      setTier(await fetchTier(tierOwner));
      const r: UserRole = isAssessor
        ? "assessor"
        : (((profile?.role as UserRole) || "politico") as UserRole);
      setRole(r);

      if (r === "politico") {
        setPermissions(allTrue());
      } else if (r === "assessor") {
        const raw = (link as any)?.permissions || {};
        const merged: Permissions = { ...allFalse() };
        for (const k of PERMISSION_KEYS) {
          if (raw[k] === true) merged[k] = true;
        }
        setPermissions(merged);
      } else {
        setPermissions(allFalse());
      }
    } catch (err) {
      console.error("[useAuth] fetchRoleAndPerms error:", err);
      setRole("politico");
      setPermissions(allTrue());
    } finally {
      setPermsLoaded(true);
    }
  };


  useEffect(() => {
    let mounted = true;

    const safety = setTimeout(() => {
      if (mounted) {
        console.warn("[useAuth] Safety timeout — forçando loading=false");
        setLoading(false);
      }
    }, 4000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      void (async () => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          setLoading(true);
          await fetchRoleAndPerms(newSession.user.id);
          if (mounted) setLoading(false);
        } else {
          setRole(null);
          setPermissions(allFalse());
          setPermsLoaded(true);
          setLoading(false);
        }
      })();
    });

    supabase.auth.getSession()
      .then(async ({ data: { session: existing } }) => {
        if (!mounted) return;
        setSession(existing);
        setUser(existing?.user ?? null);
        if (existing?.user) {
          setLoading(true);
          await fetchRoleAndPerms(existing.user.id);
        } else {
          setRole(null);
          setPermissions(allFalse());
          setPermsLoaded(true);
        }
        if (mounted) setLoading(false);
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

  const memoizedPermissions = useMemo(() => permissions, [permissions]);
  const value = useMemo(
    () => ({ user, session, loading, role, permissions: memoizedPermissions, permsLoaded, plano, assinaturaStatus, tier, isLite: tier === "lite", signOut }),
    [user, session, loading, role, memoizedPermissions, permsLoaded, plano, assinaturaStatus, tier]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
