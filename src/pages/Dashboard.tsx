import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { temNivel } from '@/lib/roles';
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
import { supabase as lovableSupabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useVerificarSaude, useWabaHealth, numeroBloqueado, rotuloStatusNumero } from '@/hooks/useAccountHealth';
import { useWabaAccounts as useAccounts } from '@/hooks/useWabaTemplates';
import { Ban } from 'lucide-react';

const MasterDashboard = () => {
  const { data: users = [] } = useUsers();
  const { data: projects = [] } = useProjects();
  const { data: numbers = [] } = useAllWhatsAppNumbers();

  // useUsers() já retorna só quem tem acesso ativo ao app 'waba'.
  // O antigo estado 'pending' deixou de existir: ou tem acesso, ou não aparece.
  const activeUsers = users.filter(u => u.ativo && !temNivel(u.role, 'admin')).length;
  const adminUsers = users.filter(u => temNivel(u.role, 'admin')).length;

  const statusCounts = {
    high: numbers.filter(n => n.qualityRating === 'HIGH').length,
    medium: numbers.filter(n => n.qualityRating === 'MEDIUM').length,
    low: numbers.filter(n => n.qualityRating === 'LOW').length,
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 mb-8">
        <StatsCard title="Usuários Ativos" value={activeUsers} subtitle={`${adminUsers} administradores`} icon={Users} variant="primary" />
        <StatsCard title="Projetos" value={projects.length} icon={FolderKanban} />
        <StatsCard title="Números" value={numbers.length} icon={Phone} />
        <StatsCard title="Disparos" value={0} icon={Megaphone} />
        <StatsCard title="Alta" value={statusCounts.high} icon={TrendingUp} variant="success" />
        <StatsCard title="Média" value={statusCounts.medium} icon={Activity} variant="warning" />
        <StatsCard title="Baixa" value={statusCounts.low} icon={TrendingDown} variant="destructive" />
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
  const { data: allNumbers = [], refetch: refetchNumbers } = useAllWhatsAppNumbers();
  const createProject = useCreateProject();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const projectIds = projects.map(p => p.id);
  const { data: recentChanges = [], refetch: refetchChanges } = useRecentStatusChanges(projectIds);

  // Contas WABA (trazem o token da BM) para a verificação de bloqueios.
  const { data: wabaAccounts = [] } = useAccounts();
  const { mutateAsync: verificarSaude } = useVerificarSaude();

  const tokenPorWaba = useMemo(
    () => Object.fromEntries(wabaAccounts.map(a => [a.wabaId, a.accessToken])),
    [wabaAccounts]
  );

  const numerosParaChecar = useMemo(
    () =>
      allNumbers
        .filter(n => n.isVisible && n.phoneNumberId && tokenPorWaba[n.wabaId])
        .map(n => ({ id: n.id, phoneNumberId: n.phoneNumberId, accessToken: tokenPorWaba[n.wabaId] })),
    [allNumbers, tokenPorWaba]
  );

  const contasParaChecar = useMemo(
    () => wabaAccounts.map(a => ({ wabaId: a.wabaId, accessToken: a.accessToken })),
    [wabaAccounts]
  );

  // Avisos já verificados (lidos do banco)
  const { data: saudeWabas = {} } = useWabaHealth();
  const numerosBloqueados = useMemo(
    () => allNumbers.filter(n => n.isVisible && numeroBloqueado(n.metaStatus)),
    [allNumbers]
  );
  const contasBloqueadas = useMemo(
    () => Object.values(saudeWabas).filter(c => c.canSendMessage === 'BLOCKED'),
    [saudeWabas]
  );

  const handleUpdateAll = async () => {
    setIsUpdating(true);
    try {
      const { data, error } = await lovableSupabase.functions.invoke('auto-update-status', {
        body: { manual: true }
      });

      if (error) {
        console.error('Functions error:', error);
        throw error;
      }
      
      if (!data || data.success === false) {
        throw new Error(data?.error || 'Erro ao processar atualização');
      }
      
      toast.success(`${data.numbersUpdated} números atualizados com sucesso!`);
      refetchNumbers();
      refetchChanges();

      // Verifica bloqueios na Meta (banido/restrito/pagamento). A edge function
      // só traz qualidade, que segue GREEN mesmo com o número banido.
      try {
        const r = await verificarSaude({ numeros: numerosParaChecar, contas: contasParaChecar });
        if (r.numerosBloqueados > 0 || r.wabasBloqueadas > 0) {
          toast.warning(
            `Atenção: ${r.numerosBloqueados} número(s) bloqueado(s) e ${r.wabasBloqueadas} conta(s) sem envio.`,
            { duration: 8000 }
          );
        }
      } catch (e) {
        console.error('[saude] falha ao verificar bloqueios:', e);
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error(`Erro ao atualizar números: ${error.message || 'Erro desconhecido'}`);
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
      {/* Avisos da Meta: números bloqueados e contas sem envio */}
      {(numerosBloqueados.length > 0 || contasBloqueadas.length > 0) && (
        <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Ban className="w-4 h-4 text-destructive" />
            <h3 className="font-semibold text-destructive text-sm">Restrições detectadas na Meta</h3>
          </div>

          {numerosBloqueados.length > 0 && (
            <p className="text-sm text-foreground/80 mb-1">
              <strong>{numerosBloqueados.length} número(s) bloqueado(s):</strong>{' '}
              {numerosBloqueados
                .map(n => `${n.customName || n.verifiedName} (${rotuloStatusNumero(n.metaStatus)})`)
                .join(', ')}
            </p>
          )}

          {contasBloqueadas.map(c => (
            <p key={c.wabaId} className="text-sm text-foreground/80">
              <strong>{c.wabaName ?? c.wabaId}:</strong>{' '}
              {c.errors.length > 0
                ? c.errors.map(e => e.error_description).join(' · ')
                : 'conta sem permissão de envio'}
            </p>
          ))}

          <p className="text-xs text-muted-foreground mt-2">
            Verifique em business.facebook.com/accountquality. Erro de pagamento se resolve
            atualizando o meio de pagamento da conta.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatsCard title="Meus Projetos" value={projects.length} icon={FolderKanban} variant="primary" />
        <StatsCard title="Números Ativos" value={userNumbers.length} icon={Phone} />
        <StatsCard title="Disparos" value={0} icon={Megaphone} />
        <StatsCard title="Alta Qualidade" value={statusCounts.high} icon={TrendingUp} variant="success" />
        <StatsCard title="Média Qualidade" value={statusCounts.medium} icon={Activity} variant="warning" />
        <StatsCard title="Baixa Qualidade" value={statusCounts.low} icon={TrendingDown} variant="destructive" />
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
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${
                          change.direction === 'up' 
                            ? 'bg-success/10 text-success' 
                            : 'bg-destructive/10 text-destructive'
                        }`}>
                          {change.direction === 'up' 
                            ? <TrendingUp className="w-8 h-8" /> 
                            : <TrendingDown className="w-8 h-8" />
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
                          {format(new Date(change.changedAt), "dd/MM HH:mm", { locale: ptBR })}
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
              className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 text-primary-foreground font-bold transition-all gap-2"
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
  const { user, can } = useAuth();

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Olá, {user?.name?.split(' ')[0]} 👋</h1>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-muted-foreground mt-1">
            {can('admin') ? 'Visão geral do sistema e gestão de usuários' : 'Monitore seus projetos e números WhatsApp'}
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
      {can('admin') ? <MasterDashboard /> : <UserDashboard />}
    </DashboardLayout>
  );
};

export default Dashboard;
