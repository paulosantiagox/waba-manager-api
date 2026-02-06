import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // No desktop, sidebar começa expandido; no mobile, começa recolhido
  useEffect(() => {
    setSidebarCollapsed(isMobile);
  }, [isMobile]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        isMobile={isMobile}
      />

      {/* Overlay escuro no mobile quando sidebar aberto */}
      {isMobile && !sidebarCollapsed && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 transition-opacity"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {/* Botão hamburger no mobile */}
      {isMobile && sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="fixed top-4 left-4 z-30 w-10 h-10 rounded-lg bg-sidebar flex items-center justify-center shadow-md text-sidebar-foreground"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      <main 
        className={cn(
          "min-h-screen transition-all duration-300",
          isMobile ? "ml-0" : (sidebarCollapsed ? "ml-16" : "ml-64")
        )}
      >
        <div className={cn(isMobile ? "p-4 pt-16" : "p-8")}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
