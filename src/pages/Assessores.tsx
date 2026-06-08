import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Phone, Mail, FileText, CheckSquare, Settings2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, PERMISSION_KEYS, PermissionKey, Permissions } from "@/hooks/useAuth";
import { toast } from "sonner";

interface AssessorProfile {
  user_id: string;
  nome: string;
  email: string;
  telefone: string;
}

interface AssessorStats {
  user_id: string;
  demandasTotal: number;
  demandasResolvidas: number;
  tarefasTotal: number;
  tarefasFinalizadas: number;
}

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  painel: "Painel de Controle",
  eleitores: "Base de Eleitores",
  "mapa-eleitores": "Mapa de Eleitores",
  aniversarios: "Aniversários",
  demandas: "Gestão de Demandas",
  tarefas: "Gestão de Tarefas",
  agenda: "Agenda Oficial",
  assistente: "Assistente Legislativo",
  "base-conhecimento": "Base de Conhecimento",
  "historico-conversas": "Histórico de Conversas",
  "resumo-mensal": "Resumo Mensal",
};

const Assessores = () => {
  const { user, role } = useAuth();
  const [assessores, setAssessores] = useState<AssessorProfile[]>([]);
  const [stats, setStats] = useState<Record<string, AssessorStats>>({});
  const [editing, setEditing] = useState<AssessorProfile | null>(null);
  const [editPerms, setEditPerms] = useState<Permissions>({});
  const [saving, setSaving] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [alterandoSenha, setAlterandoSenha] = useState(false);
  const [avisoSenha, setAvisoSenha] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchAssessores();
  }, [user]);

  const fetchAssessores = async () => {
    const { data: links } = await supabase
      .from("politician_assessors")
      .select("assessor_id")
      .eq("politician_id", user!.id);

    if (!links || links.length === 0) {
      setAssessores([]);
      return;
    }

    const assessorIds = links.map((l: any) => l.assessor_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nome, email, telefone")
      .in("user_id", assessorIds);

    setAssessores(profiles || []);

    const statsMap: Record<string, AssessorStats> = {};
    for (const aid of assessorIds) {
      const [demRes, tarRes] = await Promise.all([
        supabase.from("demandas").select("id, status").eq("assessor_id", aid),
        supabase.from("tarefas").select("id, status").eq("assessor_id", aid),
      ]);
      statsMap[aid] = {
        user_id: aid,
        demandasTotal: demRes.data?.length || 0,
        demandasResolvidas: demRes.data?.filter((d: any) => d.status === "Resolvido").length || 0,
        tarefasTotal: tarRes.data?.length || 0,
        tarefasFinalizadas: tarRes.data?.filter((t: any) => t.status === "Finalizadas").length || 0,
      };
    }
    setStats(statsMap);
  };

  const openEdit = async (a: AssessorProfile) => {
    setEditing(a);
    const { data } = await supabase
      .from("politician_assessors")
      .select("permissions")
      .eq("politician_id", user!.id)
      .eq("assessor_id", a.user_id)
      .maybeSingle();
    const raw = (data as any)?.permissions || {};
    const initial: Permissions = {};
    for (const k of PERMISSION_KEYS) initial[k] = raw[k] === true;
    setEditPerms(initial);
  };

  const savePerms = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("politician_assessors")
      .update({ permissions: editPerms } as any)
      .eq("politician_id", user!.id)
      .eq("assessor_id", editing.user_id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar permissões: " + error.message);
      return;
    }
    toast.success("Permissões atualizadas com sucesso!");
    setEditing(null);
  };

  const isPolitico = role === "politico";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Assessores</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">Gerencie seus assessores e acompanhe suas atividades.</p>
      </div>

      {assessores.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Nenhum assessor cadastrado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Assessores aparecerão aqui quando se cadastrarem no sistema.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {assessores.map((a) => {
            const s = stats[a.user_id];
            const initials = a.nome.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
            return (
              <Card key={a.user_id} className="glass-card hover:shadow-[var(--shadow-md)] transition-shadow">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="gradient-accent text-accent-foreground font-bold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{a.nome}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{a.email}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{a.telefone}</span>
                      </div>
                    </div>
                  </div>

                  {s && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-secondary/50 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <FileText className="h-3 w-3 text-info" />
                          <span className="text-xs text-muted-foreground">Demandas</span>
                        </div>
                        <p className="text-lg font-bold">{s.demandasTotal}</p>
                        <Badge variant="secondary" className="text-[10px]">{s.demandasResolvidas} resolvidas</Badge>
                      </div>
                      <div className="p-2 rounded-lg bg-secondary/50 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <CheckSquare className="h-3 w-3 text-success" />
                          <span className="text-xs text-muted-foreground">Tarefas</span>
                        </div>
                        <p className="text-lg font-bold">{s.tarefasTotal}</p>
                        <Badge variant="secondary" className="text-[10px]">{s.tarefasFinalizadas} finalizadas</Badge>
                      </div>
                    </div>
                  )}

                  {isPolitico && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => openEdit(a)}
                    >
                      <Settings2 className="h-4 w-4" />
                      Editar perfil de acessor
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permissões do assessor</DialogTitle>
            <DialogDescription>
              {editing?.nome} — escolha quais áreas do sistema esse assessor pode acessar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {PERMISSION_KEYS.map((k) => (
              <div key={k} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-secondary/40">
                <Label htmlFor={`perm-${k}`} className="cursor-pointer flex-1">
                  {PERMISSION_LABELS[k]}
                </Label>
                <Switch
                  id={`perm-${k}`}
                  checked={editPerms[k] === true}
                  onCheckedChange={(v) => setEditPerms((p) => ({ ...p, [k]: v }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={savePerms} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Assessores;
