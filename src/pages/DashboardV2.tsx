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
  ChevronRight,
  RefreshCw,
  Clock,
  ListFilter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import QualityBadge from '@/components/dashboard/QualityBadge';
import { Link } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase as lovableSupabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import StatusHistoryModal from '@/components/modals/StatusHistoryModal';

const PulsingDot = () => (
  <span className="relative flex h-2 w-2">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
  </span>
);

const DashboardV2 = () => {
  const { user } = useAuth();
  const { data: projects = [], isLoading: loadingProjects } = useProjects();
  const { data: allNumbers = [], isLoading: loadingNumbers, refetch: refetchNumbers } = useAllWhatsAppNumbers();
  const isMobile = useIsMobile();
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedNumberId, setSelectedNumberId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'none' | 'priority' | 'days'>('none');

  const getQualityValue = (rating: string) => {
    switch (rating) {
      case 'HIGH': return 3;
      case 'MEDIUM': return 2;
      case 'LOW': return 1;
      default: return 0;
    }
  };

  const getDays = (date?: string) => {
    if (!date) return 0;
    return differenceInDays(new Date(), new Date(date));
  };

  const projectIds = projects.map(p => p.id);
  
  // NÚMEROS FILTRADOS E ORDENADOS
  let userNumbers = allNumbers.filter(n => projectIds.includes(n.projectId) && n.isVisible);

  if (sortMode === 'priority') {
    userNumbers = [...userNumbers].sort((a, b) => {
      const qA = getQualityValue(a.qualityRating);
      const qB = getQualityValue(b.qualityRating);
      if (qA !== qB) return qB - qA;
      return getDays(b.lastStatusChange) - getDays(a.lastStatusChange);
    });
  } else if (sortMode === 'days') {
    userNumbers = [...userNumbers].sort((a, b) => {
      const qA = a.qualityRating === 'HIGH' ? 1 : 0;
      const qB = b.qualityRating === 'HIGH' ? 1 : 0;
      if (qA !== qB) return qB - qA;
      return getDays(b.lastStatusChange) - getDays(a.lastStatusChange);
    });
  }

  const { data: recentChanges = [], refetch: refetchChanges } = useRecentStatusChanges(projectIds);

  const handleUpdateAll = async () => {
    setIsUpdating(true);
    try {
      const { data, error } = await lovableSupabase.functions.invoke('auto-update-status', {
        body: { manual: true }
      });

      if (error) throw error;
      if (!data || data.success === false) throw new Error(data?.error || 'Erro ao processar atualização');
      
      toast.success(`${data.numbersUpdated} números atualizados com sucesso!`);
      refetchNumbers();
      refetchChanges();
    } catch (error: any) {
      toast.error(`Erro ao atualizar números: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const getDaysInStatus = (lastChangeDate?: string) => {
    if (!lastChangeDate) return "0d";
    const days = differenceInDays(new Date(), new Date(lastChangeDate));
    return `${days}d`;
  };

  const renderNumberCard = (number: any) => (
    <Card 
      key={number.id} 
      className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
      onClick={() => setSelectedNumberId(number.id)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="bg-primary/10 p-1.5 rounded-lg group-hover:bg-primary/20 transition-colors shrink-0">
              <Phone className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-xs font-bold leading-tight bg-primary/5 text-primary px-1.5 py-0.5 rounded border border-primary/10">
                  {number.customName || number.verifiedName}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                {number.displayPhoneNumber}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <QualityBadge rating={number.qualityRating} size="sm" />
          </div>
        </div>
        <div className="flex items-center justify-between text-[8px] text-muted-foreground mt-2 mb-1">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>
              {getDaysInStatus(number.lastStatusChange)} em {number.qualityRating === 'HIGH' ? 'Alta' : number.qualityRating === 'MEDIUM' ? 'Média' : 'Baixa'}
            </span>
          </div>
          <span className="shrink-0">
            {number.lastChecked ? format(new Date(number.lastChecked), "dd/MM HH:mm") : '--/-- --:--'}
          </span>
        </div>

        <div className="pt-2 border-t border-border/50 flex items-center justify-between">
          <div className="flex flex-wrap gap-x-2 text-[8px] text-muted-foreground uppercase font-medium">
            {number.previousQuality ? (
              <span>
                Antes: {number.previousQuality === 'HIGH' ? 'Alta' : number.previousQuality === 'MEDIUM' ? 'Média' : 'Baixa'}•{number.lastStatusChange ? format(new Date(number.lastStatusChange), "dd/MM/yy") : '--/--/--'}
              </span>
            ) : (
              <span>
                {number.qualityRating === 'HIGH' ? 'Alta' : number.qualityRating === 'MEDIUM' ? 'Média' : 'Baixa'} Desde: {number.lastStatusChange ? format(new Date(number.lastStatusChange), "dd/MM/yy") : '--/--/--'}
              </span>
            )}
          </div>
          <div className="shrink-0 ml-1">
            {number.previousQuality ? (
              getQualityValue(number.qualityRating) >= getQualityValue(number.previousQuality) ? (
                <TrendingUp className="w-5 h-5 text-success" />
              ) : (
                <TrendingDown className="w-5 h-5 text-destructive" />
              )
            ) : (
              <TrendingUp className="w-5 h-5 text-success" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loadingProjects || loadingNumbers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:overflow-hidden">
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
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">Monitoramento Global V2</h1>
              <PulsingDot />
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">Status em tempo real de todas as contas</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mr-2">
            <Button 
              variant={sortMode === 'none' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-7 text-[10px] px-2 font-bold"
              onClick={() => setSortMode('none')}
            >
              Normal
            </Button>
            <Button 
              variant={sortMode === 'priority' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-7 text-[10px] px-2 font-bold"
              onClick={() => setSortMode('priority')}
            >
              Prioridade
            </Button>
            <Button 
              variant={sortMode === 'days' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-7 text-[10px] px-2 font-bold"
              onClick={() => setSortMode('days')}
            >
              Dias em Alta
            </Button>
          </div>

          <Button 
            size="sm" 
            className="hidden sm:flex bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 text-primary-foreground font-bold transition-all gap-2 h-9"
            onClick={handleUpdateAll}
            disabled={isUpdating}
          >
            <RefreshCw className={cn("w-4 h-4", isUpdating && "animate-spin")} />
            {isUpdating ? 'Atualizando...' : 'Atualizar Todos'}
          </Button>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold h-9 px-3 hidden md:flex">
            {userNumbers.length} Ativos
          </Badge>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden min-h-0">
        {/* Main Content Area */}
        <div className="lg:flex-1 lg:overflow-y-auto p-4 lg:p-6 space-y-6">
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
                    {sortMode !== 'none' && (
                      <span className="text-[10px] text-primary/70 ml-auto font-medium lowercase">
                        ordenado por {sortMode === 'priority' ? 'prioridade' : 'dias em alta'}
                      </span>
                    )}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                  {projectNumbers.map(renderNumberCard)}
                </div>
              </section>
            );
          })}
        </div>

        {/* Right Sidebar - Recent History */}
        <aside className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-border bg-white dark:bg-slate-900 flex flex-col shrink-0 min-h-0">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold">Mudanças de Status</h3>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => refetchChanges()}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {recentChanges.length > 0 ? (
              recentChanges.map((change) => (
                <div 
                  key={change.id} 
                  className="relative pl-6 pb-3 border-l border-border last:pb-0 group cursor-pointer"
                  onClick={() => setSelectedNumberId(change.phoneNumberId)}
                >
                  <div className={cn(
                    "absolute left-[-4.5px] top-1.5 w-2 h-2 rounded-full border border-white dark:border-slate-900",
                    change.direction === 'up' ? "bg-success" : "bg-destructive"
                  )} />
                  <div className="space-y-0.5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] font-bold text-primary">
                          {format(new Date(change.changedAt), "dd/MM '•' HH:mm", { locale: ptBR })}
                        </span>
                        <p className="text-[10px] font-bold leading-tight group-hover:text-primary transition-colors truncate pr-1">{change.numberName}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{change.projectName}</p>
                      </div>
                      <div className="shrink-0 -mt-1 ml-1">
                        {change.direction === 'up' 
                          ? <TrendingUp className="w-6 h-6 text-success/20 group-hover:text-success/40 transition-colors" /> 
                          : <TrendingDown className="w-6 h-6 text-destructive/20 group-hover:text-destructive/40 transition-colors" />
                        }
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="opacity-60 grayscale shrink-0">
                        <QualityBadge rating={change.previousQuality} size="sm" />
                      </div>
                      <ChevronRight className="w-2 h-2 text-muted-foreground/50 shrink-0" />
                      <div className="shrink-0">
                        <QualityBadge rating={change.currentQuality} size="sm" />
                      </div>
                    </div>
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

      <StatusHistoryModal 
        number={allNumbers.find(n => n.id === selectedNumberId) || null}
        open={!!selectedNumberId}
        onOpenChange={(open) => !open && setSelectedNumberId(null)}
      />
    </div>
  );
};

export default DashboardV2;
