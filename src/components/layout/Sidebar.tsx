import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderKanban,
  Megaphone,
  Users,
  Settings,
  LogOut,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  FileText,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BrasiliaClockWidget, ManausClockWidget } from './BrasiliaClockWidget';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
}

const Sidebar = ({ collapsed, onToggle, isMobile = false }: SidebarProps) => {
  const { user, logout, isMaster } = useAuth();
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: LayoutDashboard, label: 'Dashboard V2', href: '/dashboard-v2' },
    { icon: FolderKanban, label: 'Projetos', href: '/projects' },
    { icon: Megaphone, label: 'Campanhas', href: '/campaigns' },
    { icon: FileText, label: 'Templates', href: '/templates' },
    ...(isMaster ? [{ icon: Users, label: 'Usuários', href: '/users' }] : []),
  ];

  const isActive = (href: string) => location.pathname === href;

  const handleNavClick = () => {
    if (isMobile) {
      onToggle();
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside 
        className={cn(
          "fixed left-0 top-0 h-[100dvh] bg-sidebar flex flex-col z-50 transition-all duration-300",
          isMobile
            ? cn("w-64", collapsed ? "-translate-x-full" : "translate-x-0")
            : cn(collapsed ? "w-16" : "w-64")
        )}
      >
        {/* Logo */}
        <div className="p-4 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-3" onClick={handleNavClick}>
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-primary-foreground" />
            </div>
            {(!collapsed || isMobile) && (
              <div className="overflow-hidden">
                <h1 className="font-bold text-sidebar-foreground">WABA Manager</h1>
                <p className="text-xs text-sidebar-foreground/60">API Manager</p>
              </div>
            )}
          </Link>
        </div>

        {/* Toggle Button - apenas no desktop */}
        {!isMobile && (
          <button
            onClick={onToggle}
            className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center shadow-md hover:bg-primary transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const showLabel = !collapsed || isMobile;
            
            const linkContent = (
              <Link
                key={item.href}
                to={item.href}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                  !showLabel && "justify-center px-2"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {showLabel && (
                  <>
                    <span className="font-medium text-sm">{item.label}</span>
                    {active && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </>
                )}
              </Link>
            );

            if (!showLabel) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover text-popover-foreground">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </nav>

        {/* User profile & logout */}
        <div className="p-2 border-t border-sidebar-border">
          {(!collapsed || isMobile) ? (
            <>
              {/* Relógios */}
              <BrasiliaClockWidget collapsed={false} />
              <ManausClockWidget collapsed={false} />
              
              <div className="flex items-center gap-3 mb-3 px-2">
                {user?.photo ? (
                  <img 
                    src={user.photo} 
                    alt={user.name} 
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-sidebar-foreground">
                      {user?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</p>
                  <p className="text-xs text-sidebar-foreground/60 capitalize">{user?.role}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Link
                  to="/settings"
                  onClick={handleNavClick}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors text-sm"
                >
                  <Settings className="w-4 h-4" />
                  <span>Ajustes</span>
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors text-sm"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              {/* Relógios compactos */}
              <BrasiliaClockWidget collapsed={true} />
              <ManausClockWidget collapsed={true} />
              
              <Tooltip>
                <TooltipTrigger asChild>
                  {user?.photo ? (
                    <img 
                      src={user.photo} 
                      alt={user.name} 
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center">
                      <span className="text-sm font-medium text-sidebar-foreground">
                        {user?.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover text-popover-foreground">
                  {user?.name}
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/settings"
                    className="flex items-center justify-center p-2 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover text-popover-foreground">
                  Ajustes
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={logout}
                    className="flex items-center justify-center p-2 rounded-lg text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover text-popover-foreground">
                  Sair
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default Sidebar;
