import {
  LayoutDashboard,
  Users,
  MapPin,
  FileText,
  CheckSquare,
  CalendarDays,
  Bot,
  Settings,
  LogOut,
  UserCheck,
  MessageSquare,
  Cake,
  FileBarChart,
  BookOpen,
  Lock,
} from "lucide-react";
import { LOCKED_ON_LITE, LockableFeature } from "@/config/planFeatures";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import logoDemocrat from "@/assets/logo-democrat-icon.png";

const politicoMenuItems = [
  { title: "Painel de Controle", url: "/painel", icon: LayoutDashboard, perm: "painel" },
  { title: "Base de Eleitores", url: "/eleitores", icon: Users, perm: "eleitores" },
  { title: "Mapa de Eleitores", url: "/mapa-eleitores", icon: MapPin, perm: "mapa-eleitores" },
  { title: "Aniversários", url: "/aniversarios", icon: Cake, perm: "aniversarios" },
  { title: "Gestão de Demandas", url: "/demandas", icon: FileText, perm: "demandas" },
  { title: "Gestão de Tarefas", url: "/tarefas", icon: CheckSquare, perm: "tarefas" },
  { title: "Agenda Oficial", url: "/agenda", icon: CalendarDays, perm: "agenda" },
  { title: "Assistente Legislativo", url: "/assistente", icon: Bot, perm: "assistente" },
  { title: "Base de Conhecimento", url: "/base-conhecimento", icon: BookOpen, perm: "base-conhecimento" },
  { title: "Resumo Mensal", url: "/resumo-mensal", icon: FileBarChart, perm: "resumo-mensal" },
  { title: "Tutoriais", url: "/tutoriais", icon: GraduationCap, perm: "tutoriais" },
];

const politicoOnlyItems = [
  { title: "Assessores", url: "/assessores", icon: UserCheck },
];

const commonFooterItems = [
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut, role, permissions, plano, isLite } = useAuth();
  const userName = user?.user_metadata?.nome || "Usuário";
  const initials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const itemsForRole = role === "assessor"
    ? politicoMenuItems.filter((i) => permissions[i.perm] === true)
    : [...politicoMenuItems, ...politicoOnlyItems];

  const menuItems = [...itemsForRole, ...commonFooterItems];

  const isLocked = (item: any) => {
    if (!isLite) return false;
    const key = (item.perm || (item.url === "/assessores" ? "assessores" : "")) as LockableFeature;
    return LOCKED_ON_LITE.includes(key);
  };

  const roleLabel = role === "assessor" ? "Assessor" : "Político";

  return (
    <Sidebar collapsible="icon" className="gradient-sidebar border-r-0">
      <div className="flex items-center justify-center px-4 py-4 border-b border-sidebar-border">
        <img
          src={logoDemocrat}
          alt="Democrat.IA"
          className={`shrink-0 object-contain transition-all duration-200 ${collapsed ? 'h-12 w-12' : 'h-20 w-auto max-w-[220px]'}`}
        />
      </div>

      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size="lg">
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span className="flex-1">{item.title}</span>}
                      {!collapsed && isLocked(item) && (
                        <Lock className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border-2 border-sidebar-primary">
            <AvatarFallback className="gradient-accent text-accent-foreground text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-semibold text-sidebar-accent-foreground truncate">
                {userName}
              </span>
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{roleLabel}</Badge>
              </div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={signOut}
              className="text-sidebar-foreground/50 hover:text-destructive transition-colors"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
