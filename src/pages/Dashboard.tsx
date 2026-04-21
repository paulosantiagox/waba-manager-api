import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatsCard from '@/components/dashboard/StatsCard';
import ProjectCard from '@/components/dashboard/ProjectCard';
import { useProjects, useCreateProject } from '@/hooks/useProjects';
import { useAllWhatsAppNumbers } from '@/hooks/useWhatsAppNumbers';
import { useUsers } from '@/hooks/useUsers';
import { useRecentStatusChanges } from '@/hooks/useRecentStatusChanges';
import { Users, FolderKanban, Phone, Megaphone, Activity, TrendingUp, TrendingDown, ArrowRight, Loader2, Plus, Maximize2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import QualityBadge from '@/components/dashboard/QualityBadge';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MasterDashboard = () => {
  const { data: users = [] } = useUsers();
  const { data: projects = [] } = useProjects();
  const { data: numbers = [] } = useAllWhatsAppNumbers();

  const activeUsers = users.filter(u => u.status === 'active' && u.role !== 'master').length;
  const pendingUsers = users.filter(u => u.status === 'pending').length;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard title="Usuários Ativos" value={activeUsers} subtitle={`${pendingUsers} aguardando aprovação`} icon={Users} variant="primary" />
        <StatsCard title="Total de Projetos" value={projects.length} icon={FolderKanban} />
        <StatsCard title="Números Monitorados" value={numbers.length} icon={Phone} />
        <StatsCard title="Disparos Realizados" value={0} icon={Megaphone} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Activity className="w-5 h-5 text-primary" />
              Visão Geral do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bem-vindo ao painel de administração. Aqui você pode gerenciar todos os usuários, 
              projetos e monitorar a saúde global do sistema.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-muted/50 p-4 rounded-xl border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Taxa de Aprovação</p>
                <p className="text-xl font-bold">{(activeUsers / (users.length || 1) * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-xl border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Média Projetos/User</p>
                <p className="text-xl font-bold">{(projects.length / (activeUsers || 1)).toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up [animation-delay:0.1s]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Status do Servidor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  API Gateway
                </div>
                <Badge variant="outline" className="text-[10px] uppercase font-bold text-success border-success/20 bg-success/5">Online</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  Database
                </div>
                <Badge variant="outline" className="text-[10px] uppercase font-bold text-success border-success/20 bg-success/5">Online</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  WhatsApp Scraper
                </div>
                <Badge variant="outline" className="text-[10px] uppercase font-bold text-success border-success/20 bg-success/5">Online</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

const getQualityLabel = (quality: string) => {
  switch (quality) {
    case 'HIGH': return 'Alta';
    case 'MEDIUM': return 'Média';
    case 'LOW': return 'Baixa';
    default: return quality;
  }
};

const getQualityColor = (quality: string) => {
  switch (quality) {
    case 'HIGH': return 'text-success';
    case 'MEDIUM': return 'text-warning';
    case 'LOW': return 'text-destructive';
    default: return 'text-muted-foreground';
  }
};

const UserDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: projects = [], isLoading } = useProjects();
  const { data: allNumbers = [] } = useAllWhatsAppNumbers();
  const createProject = useCreateProject();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const projectIds = projects.map(p => p.id);
  const { data: recentChanges = [], refetch: refetchChanges } = useRecentStatusChanges(projectIds);

  const handleUpdateAll = async () => {
    setIsUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-update-status');
      if (error) throw error;
      
      toast.success(`${data.numbersUpdated} números atualizados com sucesso!`);
      refetchChanges();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar números');
    } finally {
      setIsUpdating(false);
    }
  };

  const userNumbers = allNumbers.filter(n => projects.some(p => p.id === n.projectId));

  const statusCounts = {
    high: userNumbers.filter(n => n.qualityRating === 'HIGH').length,
    medium: userNumbers.filter(n => n.qualityRating === 'MEDIUM').length,
    low: userNumbers.filter(n => n.qualityRating === 'LOW').length,
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    const result = await createProject.mutateAsync({
      name: projectName.trim(),
      description: projectDescription.trim() || undefined,
    });

    setProjectName('');
    setProjectDescription('');
    setIsDialogOpen(false);
    navigate(`/projects/${result.id}`);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard title="Meus Projetos" value={projects.length} icon={FolderKanban} variant="primary" />
        <StatsCard title="Números Monitorados" value={userNumbers.length} icon={Phone} />
        <StatsCard title="Campanhas Ativas" value={0} icon={Megaphone} />
        <StatsCard title="Status dos Números" value={`${statusCounts.high}/${statusCounts.medium}/${statusCounts.low}`} subtitle="Alta / Média / Baixa" icon={Activity} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Mudanças de Status Recentes */}
        <div className="lg:col-span-2">
          <Card className="h-full animate-slide-up">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Activity className="w-5 h-5 text-primary" />
                Atividade Recente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentChanges.length > 0 ? (
                <div className="space-y-1">
                  {recentChanges.map((change) => (
                    <Link
                      key={change.id}
                      to={`/projects/${change.projectId}`}
                      className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-muted/50 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          change.direction === 'up' 
                            ? 'bg-success/10 text-success' 
                            : 'bg-destructive/10 text-destructive'
                        }`}>
                          {change.direction === 'up' 
                            ? <TrendingUp className="w-5 h-5" /> 
                            : <TrendingDown className="w-5 h-5" />
                          }
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm">{change.numberName}</p>
                            <QualityBadge rating={change.currentQuality} size="sm" />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {change.projectName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                          {format(new Date(change.changedAt), "dd MMM", { locale: ptBR })}
                        </span>
                        <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Activity className="w-12 h-12 text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma mudança de status recente.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions / Info */}
        <Card className="animate-slide-up [animation-delay:0.1s]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full bg-indigo-500 hover:bg-indigo-600 shadow-lg shadow-indigo-200 text-white font-bold transition-all gap-2"
              onClick={handleUpdateAll}
              disabled={isUpdating}
            >
              <RefreshCw className={cn("w-4 h-4", isUpdating && "animate-spin")} />
              {isUpdating ? 'Atualizando...' : 'Atualizar Todos'}
            </Button>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full gradient-primary shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Projeto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Projeto</DialogTitle>
                </DialogHeader>
                <form className="space-y-4 mt-4" onSubmit={handleCreateProject}>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Projeto</Label>
                    <Input id="name" placeholder="Ex: E-commerce Principal" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição (opcional)</Label>
                    <Textarea id="description" placeholder="Descreva o propósito deste projeto..." value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit" className="gradient-primary" disabled={createProject.isPending}>
                      {createProject.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Criar Projeto
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            
            <Link to="/projects">
              <Button variant="outline" className="w-full mt-2">
                <FolderKanban className="w-4 h-4 mr-2" />
                Ver Todos Projetos
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Meus Projetos</h2>
          <Badge variant="secondary" className="px-3 py-1">{projects.length} projetos</Badge>
        </div>

        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, index) => (
              <div key={project.id} style={{ animationDelay: `${index * 0.1}s` }}>
                <ProjectCard project={project} numbers={allNumbers.filter(n => n.projectId === project.id)} />
              </div>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center border-dashed">
            <FolderKanban className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg mb-2">Nenhum projeto ainda</h3>
            <p className="text-muted-foreground mb-6">Crie seu primeiro projeto para começar a monitorar seus números WhatsApp.</p>
            <Button className="gradient-primary" onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Começar Agora
            </Button>
          </Card>
        )}
      </div>
    </>
  );
};

const Dashboard = () => {
  const { user, isMaster } = useAuth();

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Olá, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-muted-foreground mt-1">
            {isMaster ? 'Visão geral do sistema e gestão de usuários' : 'Monitore seus projetos e números WhatsApp'}
          </p>
        </div>
        <Link to="/dashboard-v2" target="_blank">
          <Button variant="outline" className="gap-2 group border-primary/20 hover:border-primary/50 transition-all">
            <Maximize2 className="w-4 h-4 text-primary" />
            <span>Abrir Dashboard V2</span>
            <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
          </Button>
        </Link>
      </div>
      {isMaster ? <MasterDashboard /> : <UserDashboard />}
    </DashboardLayout>
  );
};

export default Dashboard;
