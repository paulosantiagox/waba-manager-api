import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useProjects';
import { useAllWhatsAppNumbers } from '@/hooks/useWhatsAppNumbers';
import { useRecentStatusChanges } from '@/hooks/useRecentStatusChanges';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  ArrowLeft, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Phone, 
  Loader2,
  Maximize2,
  ChevronRight,
  RefreshCw,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import QualityBadge from '@/components/dashboard/QualityBadge';
import { Link } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import StatusHistoryModal from '@/components/modals/StatusHistoryModal';

const DashboardV2 = () => {
  const { user } = useAuth();
  const { data: projects = [], isLoading: loadingProjects } = useProjects();
  const { data: allNumbers = [], isLoading: loadingNumbers, refetch: refetchNumbers } = useAllWhatsAppNumbers();
  const isMobile = useIsMobile();
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedNumberId, setSelectedNumberId] = useState<string | null>(null);

  const projectIds = projects.map(p => p.id);
  // MOSTRAR APENAS NÚMEROS ATIVOS (isVisible)
  const userNumbers = allNumbers.filter(n => projectIds.includes(n.projectId) && n.isVisible);
  const { data: recentChanges = [], refetch: refetchChanges } = useRecentStatusChanges(projectIds);

  const handleUpdateAll = async () => {
    setIsUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-update-status');
      if (error) throw error;
      
      toast.success(`${data.numbersUpdated} números atualizados com sucesso!`);
      refetchNumbers();
      refetchChanges();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar números');
    } finally {
      setIsUpdating(false);
    }
  };

  const getDaysInStatus = (lastChangeDate?: string) => {
    if (!lastChangeDate) return null;
    const days = differenceInDays(new Date(), new Date(lastChangeDate));
    return days > 0 ? `+${days}d` : 'Hoje';
  };

  if (loadingProjects || loadingNumbers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              {!isMobile && "Voltar ao Sistema"}
            </Button>
          </Link>
          <div className="h-4 w-[1px] bg-border" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">Monitoramento Global V2</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Status em tempo real de todas as contas</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            size="sm" 
            className="hidden sm:flex bg-indigo-500 hover:bg-indigo-600 shadow-lg shadow-indigo-200 text-white font-bold transition-all gap-2 h-9"
            onClick={handleUpdateAll}
            disabled={isUpdating}
          >
            <RefreshCw className={cn("w-4 h-4", isUpdating && "animate-spin")} />
            {isUpdating ? 'Atualizando...' : 'Atualizar Tudo'}
          </Button>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold h-9 px-3">
            {userNumbers.length} Ativos
          </Badge>
          <Badge variant="outline" className="bg-secondary/5 text-secondary border-secondary/20 font-bold h-9 px-3">
            {projects.length} Projetos
          </Badge>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
          {projects.map((project) => {
            const projectNumbers = userNumbers.filter(n => n.projectId === project.id);
            if (projectNumbers.length === 0) return null;

            return (
              <section key={project.id} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-primary" />
                    {project.name}
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded ml-2 normal-case font-medium">
                      {projectNumbers.length}
                    </span>
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                  {projectNumbers.map((number) => (
                    <Card key={number.id} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow group">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="bg-primary/10 p-1.5 rounded-lg group-hover:bg-primary/20 transition-colors shrink-0">
                              <Phone className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <div className="truncate">
                              <p className="text-xs font-bold truncate leading-tight">
                                {number.customName || number.verifiedName}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {number.displayPhoneNumber}
                              </p>
                            </div>
                          </div>
                          <QualityBadge rating={number.qualityRating} size="sm" />
                        </div>
                        
                        <div className="flex items-center justify-between text-[10px] pt-2 border-t border-border/50">
                          <span className="text-muted-foreground">Tier {number.messagingLimitTier?.replace('TIER_', '')}</span>
                          <span className="text-muted-foreground">
                            {number.lastChecked ? format(new Date(number.lastChecked), "HH:mm") : '--:--'}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Right Sidebar - Recent History */}
        <aside className="w-full lg:w-80 border-l border-border bg-white dark:bg-slate-900 flex flex-col shrink-0">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold">Histórico de Mudanças</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {recentChanges.length > 0 ? (
              recentChanges.map((change) => (
                <div key={change.id} className="relative pl-6 pb-4 border-l border-border last:pb-0">
                  <div className={cn(
                    "absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900",
                    change.direction === 'up' ? "bg-success" : "bg-destructive"
                  )} />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">
                        {format(new Date(change.changedAt), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                      {change.direction === 'up' 
                        ? <TrendingUp className="w-3 h-3 text-success" /> 
                        : <TrendingDown className="w-3 h-3 text-destructive" />
                      }
                    </div>
                    <p className="text-xs font-semibold leading-tight">{change.numberName}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">{change.previousQuality}</span>
                      <ChevronRight className="w-2 h-2 text-muted-foreground" />
                      <QualityBadge rating={change.currentQuality} size="sm" />
                    </div>
                    <p className="text-[10px] text-muted-foreground italic truncate">{change.projectName}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                <Activity className="w-8 h-8 mb-2" />
                <p className="text-xs">Sem mudanças recentes</p>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
};

export default DashboardV2;
