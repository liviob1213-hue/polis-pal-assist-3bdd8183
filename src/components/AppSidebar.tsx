import {
  LayoutDashboard,
  Users,
  FileText,
  CheckSquare,
  CalendarDays,
  Bot,
  Send,
  Settings,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
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

const menuItems = [
  { title: "Painel de Controle", url: "/", icon: LayoutDashboard },
  { title: "Base de Eleitores", url: "/eleitores", icon: Users },
  { title: "Gestão de Demandas", url: "/demandas", icon: FileText },
  { title: "Gestão de Tarefas", url: "/tarefas", icon: CheckSquare },
  { title: "Agenda Oficial", url: "/agenda", icon: CalendarDays },
  { title: "Assistente Legislativo", url: "/assistente", icon: Bot },
  { title: "Disparo em Massa", url: "/disparo-massa", icon: Send },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="gradient-sidebar border-r-0">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg gradient-accent">
          <span className="text-sm font-bold text-accent-foreground">D</span>
        </div>
        {!collapsed && (
          <div>
            <h2 className="text-base font-bold text-sidebar-accent-foreground tracking-tight">
              DEMOCRAT.AI
            </h2>
          </div>
        )}
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
                      {!collapsed && <span>{item.title}</span>}
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
              CM
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-accent-foreground">
                Carlos Mendes
              </span>
              <span className="text-xs text-sidebar-foreground/50">Vereador</span>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
