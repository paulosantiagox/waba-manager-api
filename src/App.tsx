import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { nivelDaRota } from "@/lib/permissoes";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Campaigns from "./pages/Campaigns";
import UsersPage from "./pages/Users";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import DashboardV2 from "./pages/DashboardV2";
import Templates from "./pages/Templates";
import Broadcasts from "./pages/Broadcasts";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const Carregando = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

// Rota protegida genérica por NÍVEL MÍNIMO (padrão do grupo 3SMAX).
// Serve para qualquer nível — substitui o antigo MasterRoute/booleano isMaster.
const RotaProtegida = ({
  nivelMinimo = "consultor",
  children,
}: {
  nivelMinimo?: string;
  children: React.ReactNode;
}) => {
  const { isAuthenticated, isLoading, can } = useAuth();

  if (isLoading) return <Carregando />;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (!can(nivelMinimo)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

const AppRoutes = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <Carregando />;

  return (
    <Routes>
      <Route path="/auth" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Auth />} />
      <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/auth"} replace />} />
      <Route path="/dashboard" element={<RotaProtegida nivelMinimo={nivelDaRota("/dashboard")}><Dashboard /></RotaProtegida>} />
      <Route path="/dashboard-v2" element={<RotaProtegida nivelMinimo={nivelDaRota("/dashboard-v2")}><DashboardV2 /></RotaProtegida>} />
      <Route path="/projects" element={<RotaProtegida nivelMinimo={nivelDaRota("/projects")}><Projects /></RotaProtegida>} />
      <Route path="/projects/:id" element={<RotaProtegida nivelMinimo={nivelDaRota("/projects")}><ProjectDetail /></RotaProtegida>} />
      <Route path="/campaigns" element={<RotaProtegida nivelMinimo={nivelDaRota("/campaigns")}><Campaigns /></RotaProtegida>} />
      <Route path="/broadcasts" element={<RotaProtegida nivelMinimo={nivelDaRota("/broadcasts")}><Broadcasts /></RotaProtegida>} />
      <Route path="/templates" element={<RotaProtegida nivelMinimo={nivelDaRota("/templates")}><Templates /></RotaProtegida>} />
      <Route path="/users" element={<RotaProtegida nivelMinimo={nivelDaRota("/users")}><UsersPage /></RotaProtegida>} />
      <Route path="/settings" element={<RotaProtegida nivelMinimo={nivelDaRota("/settings")}><Settings /></RotaProtegida>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
