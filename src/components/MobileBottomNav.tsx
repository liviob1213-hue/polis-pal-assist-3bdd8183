import { LayoutDashboard, Users, FileText, CheckSquare, MapPin } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Painel", url: "/", icon: LayoutDashboard },
  { title: "Eleitores", url: "/eleitores", icon: Users },
  { title: "Demandas", url: "/demandas", icon: FileText, center: true },
  { title: "Tarefas", url: "/tarefas", icon: CheckSquare },
  { title: "Mapa", url: "/mapa-eleitores", icon: MapPin },
];

export function MobileBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around px-1 h-16 relative">
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/"}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 rounded-lg text-muted-foreground transition-colors min-w-[56px]",
              item.center ? "absolute left-1/2 -translate-x-1/2 -top-5" : "py-1 px-2"
            )}
            activeClassName="text-primary"
          >
            {item.center ? (
              <>
                <div className="flex items-center justify-center h-14 w-14 rounded-full gradient-primary shadow-lg border-4 border-card">
                  <item.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <span className="text-[10px] leading-tight font-semibold mt-0.5">{item.title}</span>
              </>
            ) : (
              <>
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] leading-tight">{item.title}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
