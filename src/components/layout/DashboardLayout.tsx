import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu } from 'lucide-react';

const SIDEBAR_KEY = 'waba:sidebar-recolhido';

interface DashboardLayoutProps {
  children: React.ReactNode;
  fullHeight?: boolean;
}

const DashboardLayout = ({ children, fullHeight = false }: DashboardLayoutProps) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  // Cada página monta seu próprio DashboardLayout, então ao trocar de rota este
  // componente remonta. O estado precisa nascer JÁ correto: se começasse
  // recolhido e um efeito reabrisse depois, o sidebar animava "fecha e abre" a
  // cada navegação. Por isso lê a preferência de forma síncrona no 1º render.
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const salvo = localStorage.getItem(SIDEBAR_KEY);
      if (salvo !== null) return salvo === '1';
    } catch {
      /* storage bloqueado: cai no padrão por largura */
    }
    return typeof window !== 'undefined' && window.innerWidth < 768;
  });

  // Guarda a escolha do usuário para a próxima navegação/recarregamento.
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignora */
    }
  }, [sidebarCollapsed]);

  // Só reage a uma MUDANÇA real de breakpoint (girar o aparelho, redimensionar),
  // nunca na montagem — senão volta o efeito de fecha-e-abre.
  const mobileAnterior = useRef<boolean | null>(null);
  useEffect(() => {
    if (mobileAnterior.current !== null && mobileAnterior.current !== isMobile) {
      setSidebarCollapsed(isMobile);
    }
    mobileAnterior.current = isMobile;
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
          "transition-all duration-300",
          fullHeight ? "h-screen flex flex-col overflow-hidden" : "min-h-screen",
          isMobile ? "ml-0" : (sidebarCollapsed ? "ml-16" : "ml-64")
        )}
      >
        {fullHeight ? (
          <div className={cn("flex-1 overflow-hidden", isMobile && "pt-16")}>
            {children}
          </div>
        ) : (
          <div className={cn(isMobile ? "p-4 pt-16" : "p-8")}>
            {children}
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardLayout;
