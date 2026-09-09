import { LayoutDashboard, Users, FileText, CheckSquare, MapPin, Cake } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";

const leftItems = [
  { title: "Painel", url: "/painel", icon: LayoutDashboard },
  { title: "Eleitores", url: "/eleitores", icon: Users },
];

const centerItem = { title: "Demandas", url: "/demandas", icon: FileText };

function NavItem({ item }: { item: { title: string; url: string; icon: any } }) {
  return (
    <NavLink
      to={item.url}
      end={item.url === "/"}
      className="flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-lg text-muted-foreground transition-colors flex-1 min-h-[44px]"
      activeClassName="text-primary"
    >
      <item.icon className="h-5 w-5" />
      <span className="text-[10px] leading-tight">{item.title}</span>
    </NavLink>
  );
}

export function MobileBottomNav() {
  const { isLite } = useAuth();

  // Na versão Lite, "Tarefas" está travada — mostramos Aniversários no lugar
  const rightItems = isLite
    ? [
        { title: "Aniversários", url: "/aniversarios", icon: Cake },
        { title: "Mapa", url: "/mapa-eleitores", icon: MapPin },
      ]
    : [
        { title: "Tarefas", url: "/tarefas", icon: CheckSquare },
        { title: "Mapa", url: "/mapa-eleitores", icon: MapPin },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center h-16 px-2 relative">
        {/* Left side */}
        <div className="flex items-center flex-1 justify-evenly">
          {leftItems.map((item) => <NavItem key={item.url} item={item} />)}
        </div>

        {/* Center spacer for floating button */}
        <div className="w-20 shrink-0" />

        {/* Right side */}
        <div className="flex items-center flex-1 justify-evenly">
          {rightItems.map((item) => <NavItem key={item.url} item={item} />)}
        </div>

        {/* Floating center button */}
        <NavLink
          to={centerItem.url}
          className="absolute left-1/2 -translate-x-1/2 -top-5 flex flex-col items-center text-muted-foreground"
          activeClassName="text-primary"
        >
          <div className="flex items-center justify-center h-14 w-14 rounded-full gradient-primary shadow-lg border-4 border-card">
            <centerItem.icon className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-[10px] leading-tight font-semibold mt-0.5">{centerItem.title}</span>
        </NavLink>
      </div>
    </nav>
  );
}
