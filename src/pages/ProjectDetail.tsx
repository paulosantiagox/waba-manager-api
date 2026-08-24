import { useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import EditNumberModal from '@/components/modals/EditNumberModal';
import StatusHistoryModal from '@/components/modals/StatusHistoryModal';
import BMModal from '@/components/modals/BMModal';
import AddNumberFromMetaModal from '@/components/modals/AddNumberFromMetaModal';
import UpdateScheduleModal from '@/components/modals/UpdateScheduleModal';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import QualityBadge from '@/components/dashboard/QualityBadge';
import { useProject } from '@/hooks/useProjects';
import { useWhatsAppNumbers, useUpdateWhatsAppNumber, useCreateWhatsAppNumber, useDeleteWhatsAppNumber } from '@/hooks/useWhatsAppNumbers';
import { useBusinessManagers, useCreateBusinessManager, useUpdateBusinessManager, useDeleteBusinessManager } from '@/hooks/useBusinessManagers';
import { useCreateStatusHistory, useClearNumberNotifications, useCreateStatusChangeNotification, useAllStatusChangeNotifications } from '@/hooks/useStatusHistory';
import { useAutoUpdateNotifications } from '@/hooks/useAutoUpdateNotifications';
import { useNumberStatusInfo } from '@/hooks/useNumberStatusInfo';
import { useNumberErrorState } from '@/hooks/useNumberErrorState';
import { WhatsAppNumber, BusinessManager, QualityRating } from '@/types';
import { fetchPhoneNumberDetail, mapMetaQuality, mapMessagingLimit } from '@/services/metaApi';
import { playNotificationSound } from '@/lib/sounds';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Search, Phone, Activity, MessageCircle, RefreshCw, EyeOff, Loader2, History, Edit2, Trash2, ArrowUpDown, Building2, MoreVertical, TrendingUp, TrendingDown, Bell, Clock, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type SortOption = 'quality-asc' | 'quality-desc' | 'date-asc' | 'date-desc';
const qualityOrder = { HIGH: 1, MEDIUM: 2, LOW: 3 };

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bmFilter, setBmFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('quality-asc');
  const [isAddNumberModalOpen, setIsAddNumberModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isBMListOpen, setIsBMListOpen] = useState(false);
  const [editNumber, setEditNumber] = useState<WhatsAppNumber | null>(null);
  const [historyNumber, setHistoryNumber] = useState<WhatsAppNumber | null>(null);
  const [deleteNumber, setDeleteNumber] = useState<WhatsAppNumber | null>(null);
  const [editBM, setEditBM] = useState<BusinessManager | null>(null);
  const [isNewBMOpen, setIsNewBMOpen] = useState(false);
  const [deleteBM, setDeleteBM] = useState<BusinessManager | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const { data: project, isLoading: projectLoading } = useProject(id || '');
  const { data: numbers = [], isLoading: numbersLoading } = useWhatsAppNumbers(id);
  const { data: projectBMs = [] } = useBusinessManagers(id);
  const { data: statusNotifications = [] } = useAllStatusChangeNotifications(id);
  const { statusInfoMap } = useNumberStatusInfo(numbers);
  
  // Hook para buscar erros recentes de cada número
  const numberIds = useMemo(() => numbers.map(n => n.id), [numbers]);
  const { data: errorStateMap = new Map() } = useNumberErrorState(numberIds);
  
  const updateNumber = useUpdateWhatsAppNumber();
  const createNumber = useCreateWhatsAppNumber();
  const deleteNumberMutation = useDeleteWhatsAppNumber();
  const createBM = useCreateBusinessManager();
  const updateBM = useUpdateBusinessManager();
  const deleteBMMutation = useDeleteBusinessManager();
  const createStatusHistory = useCreateStatusHistory();
  const createNotification = useCreateStatusChangeNotification();
  const clearNotifications = useClearNumberNotifications();

  // Mapa de notificações por número para acesso rápido
  const notificationsByNumber = useMemo(() => {
    const map = new Map<string, typeof statusNotifications>();
    statusNotifications.forEach(n => {
      const existing = map.get(n.phoneNumberId) || [];
      existing.push(n);
      map.set(n.phoneNumberId, existing);
    });
    return map;
  }, [statusNotifications]);

  // Hook para receber notificações de atualizações automáticas em tempo real
  useAutoUpdateNotifications(id);

  const { activeNumbers, inactiveNumbers } = useMemo(() => {
    const filtered = numbers.filter(n => {
      const matchesSearch = n.displayPhoneNumber.includes(searchQuery) || n.verifiedName.toLowerCase().includes(searchQuery.toLowerCase()) || (n.customName?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || n.qualityRating === statusFilter;
      const matchesBM = bmFilter === 'all' || n.businessManagerId === bmFilter;
      return matchesSearch && matchesStatus && matchesBM;
    });

    const sortFn = (a: WhatsAppNumber, b: WhatsAppNumber) => {
      switch (sortBy) {
        case 'quality-asc': return qualityOrder[a.qualityRating] - qualityOrder[b.qualityRating];
        case 'quality-desc': return qualityOrder[b.qualityRating] - qualityOrder[a.qualityRating];
        case 'date-asc': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'date-desc': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default: return 0;
      }
    };

    return {
      activeNumbers: filtered.filter(n => n.isVisible).sort(sortFn),
      inactiveNumbers: filtered.filter(n => !n.isVisible).sort(sortFn),
    };
  }, [numbers, searchQuery, statusFilter, bmFilter, sortBy]);

  const statusCounts = {
    high: numbers.filter(n => n.qualityRating === 'HIGH').length,
    medium: numbers.filter(n => n.qualityRating === 'MEDIUM').length,
    low: numbers.filter(n => n.qualityRating === 'LOW').length,
  };

  const totalLimit = numbers.reduce((acc, n) => acc + (parseInt(n.messagingLimitTier) || 0), 0);

  const handleUpdateAllStatus = useCallback(async () => {
    if (numbers.length === 0) return;

    setIsUpdating(true);
    let successCount = 0;
    let errorCount = 0;

    // Cache: quais números já possuem histórico (para registrar a primeira verificação mesmo sem mudança)
    const existingHistory = new Set<string>();
    try {
      const ids = numbers.map(n => n.id);
      const chunkSize = 100;

      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('waba_status_history')
          .select('phone_number_id')
          .in('phone_number_id', chunk);

        if (error) {
          console.error('[STATUS_HISTORY] Erro ao carregar histórico existente:', error);
          break;
        }

        (data || []).forEach((r: any) => {
          if (r?.phone_number_id) existingHistory.add(r.phone_number_id);
        });
      }
    } catch (e) {
      console.error('[STATUS_HISTORY] Falha ao preparar cache de histórico:', e);
    }

    for (const number of numbers) {
      const bm = projectBMs.find(b => b.id === number.businessManagerId);
      if (!bm || !number.phoneNumberId) continue;

      try {
        const detail = await fetchPhoneNumberDetail(number.phoneNumberId, bm.accessToken);
        
        // mapMetaQuality agora pode lançar erro se o valor for inválido
        let newQuality: QualityRating;
        try {
          newQuality = mapMetaQuality(detail.quality_rating) as QualityRating;
        } catch (mappingError) {
          // Erro de mapeamento - registra no histórico mas MANTÉM o status atual
          console.error(`[MANUAL_UPDATE] Erro de mapeamento para ${number.displayPhoneNumber}:`, mappingError);
          
          const errorMsg = mappingError instanceof Error ? mappingError.message : 'Erro de mapeamento de qualidade';
          
          // Registra erro no histórico
          createStatusHistory.mutate({
            phoneNumberId: number.id,
            qualityRating: number.qualityRating, // MANTÉM o status atual
            messagingLimitTier: number.messagingLimitTier,
            changedAt: new Date().toISOString(),
            isError: true,
            errorMessage: errorMsg,
            observation: `Erro na verificação: ${errorMsg}`,
          });
          
          // Atualiza apenas lastChecked
          updateNumber.mutate({
            id: number.id,
            updates: { lastChecked: new Date().toISOString() }
          });
          
          errorCount++;
          continue;
        }
        
        const newLimit = mapMessagingLimit(detail.messaging_limit_tier);
        const hasQualityChanged = number.qualityRating !== newQuality;

        // Regra: SEMPRE cria registro para cada verificação (permite ver histórico completo por dia)
        if (hasQualityChanged) {
          const qualityValue = { HIGH: 3, MEDIUM: 2, LOW: 1 };
          const direction = qualityValue[newQuality] > qualityValue[number.qualityRating] ? 'up' : 'down';

          createNotification.mutate({
            phoneNumberId: number.id,
            projectId: id || '',
            previousQuality: number.qualityRating,
            newQuality: newQuality,
            direction: direction as 'up' | 'down',
            changedAt: new Date().toISOString(),
          });

          createStatusHistory.mutate({
            phoneNumberId: number.id,
            qualityRating: newQuality,
            messagingLimitTier: newLimit,
            previousQuality: number.qualityRating,
            changedAt: new Date().toISOString(),
            observation: `Status alterado de ${number.qualityRating} para ${newQuality}`,
          });
        } else {
          // Sem mudança - cria registro de verificação (sem previous_quality pois não mudou)
          createStatusHistory.mutate({
            phoneNumberId: number.id,
            qualityRating: newQuality,
            messagingLimitTier: newLimit,
            changedAt: new Date().toISOString(),
            observation: existingHistory.has(number.id) ? 'Verificação manual' : 'Primeira verificação',
          });
        }

        existingHistory.add(number.id);

        // Monta os updates - só atualiza previous_quality e last_status_change se a qualidade mudou
        const updates: Record<string, unknown> = {
          qualityRating: newQuality,
          messagingLimitTier: newLimit,
          verifiedName: detail.verified_name,
          displayPhoneNumber: detail.display_phone_number,
          lastChecked: new Date().toISOString(),
        };

        if (hasQualityChanged) {
          (updates as any).previousQuality = number.qualityRating;
          (updates as any).lastStatusChange = new Date().toISOString();
        }

        updateNumber.mutate({
          id: number.id,
          updates: updates as any
        });

        successCount++;
      } catch (error) {
        // Erro de conexão/API - registra no histórico mas MANTÉM o status atual
        console.error(`[MANUAL_UPDATE] Erro ao atualizar ${number.displayPhoneNumber}:`, error);
        
        const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido na API';
        
        // Registra erro no histórico
        createStatusHistory.mutate({
          phoneNumberId: number.id,
          qualityRating: number.qualityRating, // MANTÉM o status atual
          messagingLimitTier: number.messagingLimitTier,
          changedAt: new Date().toISOString(),
          isError: true,
          errorMessage: errorMsg,
          observation: `Erro na verificação manual: ${errorMsg}`,
        });
        
        // Atualiza apenas lastChecked para indicar que tentou verificar
        updateNumber.mutate({
          id: number.id,
          updates: { lastChecked: new Date().toISOString() }
        });
        
        errorCount++;
      }
    }

    setIsUpdating(false);
    if (errorCount > 0) {
      toast.error(`${successCount} números atualizados, ${errorCount} com erro. Verifique o ícone ⚠️ na linha de cada número.`);
      playNotificationSound('error');
    } else {
      toast.success(`✅ ${successCount} números verificados com sucesso!`);
      playNotificationSound('success');
    }
  }, [numbers, projectBMs, id, updateNumber, createStatusHistory, createNotification]);

  const handleSaveNumber = (numberId: string, data: Partial<WhatsAppNumber>) => {
    // Não passa lastChecked aqui - edição manual não altera "última verificação"
    updateNumber.mutate({ 
      id: numberId, 
      updates: {
        displayPhoneNumber: data.displayPhoneNumber,
        qualityRating: data.qualityRating,
        messagingLimitTier: data.messagingLimitTier,
        verifiedName: data.verifiedName,
        wabaId: data.wabaId,
        isVisible: data.isVisible,
        customName: data.customName,
        observation: data.observation,
      }
    });
    toast.success('Número atualizado!');
  };

  const handleToggleVisibility = (num: WhatsAppNumber, visible: boolean) => {
    // Não passa lastChecked aqui - toggle de visibilidade não altera "última verificação"
    updateNumber.mutate({ id: num.id, updates: { isVisible: visible } });
    toast.success(visible ? 'Número ativado' : 'Número desativado');
  };

  const handleDeleteNumber = () => {
    if (deleteNumber) {
      deleteNumberMutation.mutate({ id: deleteNumber.id, projectId: deleteNumber.projectId });
      setDeleteNumber(null);
    }
  };

  const handleSaveBM = (bm: BusinessManager) => {
    if (editBM) {
      updateBM.mutate({ id: bm.id, projectId: bm.projectId, ...bm });
    } else {
      createBM.mutate(bm);
    }
    setEditBM(null);
  };

  const handleDeleteBM = () => {
    if (deleteBM) {
      deleteBMMutation.mutate({ id: deleteBM.id, projectId: deleteBM.projectId });
      setDeleteBM(null);
    }
  };

  const handleAddNumber = (numberData: Omit<WhatsAppNumber, 'id' | 'createdAt' | 'lastChecked'>) => {
    createNumber.mutate(numberData);
  };

  const handleClearNumberNotifications = (numberId: string) => {
    clearNotifications.mutate(numberId);
  };

  const renderNumberRow = (number: WhatsAppNumber, isInactive = false) => {
    const bm = projectBMs.find(b => b.id === number.businessManagerId);
    const numberNotifications = notificationsByNumber.get(number.id) || [];
    const hasNotifications = numberNotifications.length > 0;
    const latestNotification = hasNotifications ? numberNotifications[0] : null;
    
    // Usa o hook de status info baseado no histórico
    const statusInfo = statusInfoMap.get(number.id);
    const daysInCurrentStatus = statusInfo?.daysInStatus ?? null;
    const previousQualityFromHistory = statusInfo?.previousQuality;
    const statusStartDate = statusInfo?.statusStartDate;
    
    // Estado de erro do número (últimas 24h)
    const errorInfo = errorStateMap.get(number.id);
    
    return (
      <TooltipProvider key={number.id}>
        <TableRow className={isInactive ? 'opacity-60' : ''}>
          <TableCell>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {number.photo ? <img src={number.photo} alt="" className="w-full h-full object-cover" /> : <Phone className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div className="whitespace-nowrap">
                {number.customName && <p className="font-medium text-sm">{number.customName}</p>}
                <p className={`${number.customName ? 'text-xs text-muted-foreground' : 'font-medium text-sm'}`}>{number.verifiedName}</p>
                <p className="text-xs text-muted-foreground">{number.displayPhoneNumber}</p>
              </div>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <QualityBadge rating={number.qualityRating} />
              {/* Indicador de erro na consulta da API - últimas 24h */}
              {errorInfo?.hasError && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="relative flex items-center">
                      <AlertCircle className="w-4 h-4 text-destructive animate-pulse" />
                      {errorInfo.errorCount > 1 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
                          {errorInfo.errorCount > 9 ? '9+' : errorInfo.errorCount}
                        </span>
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-semibold text-destructive">Erro na verificação</p>
                      <p className="text-xs">{errorInfo.errorMessage}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(errorInfo.errorAt), "dd/MM HH:mm", { locale: ptBR })}
                        {errorInfo.errorCount > 1 && ` (${errorInfo.errorCount} tentativas)`}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
              {/* Indicador de mudança de status - baseado no histórico (permanente) */}
              {previousQualityFromHistory && statusStartDate && (() => {
                const qualityOrder = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 };
                const currentOrder = qualityOrder[number.qualityRating as keyof typeof qualityOrder] || 0;
                const previousOrder = qualityOrder[previousQualityFromHistory as keyof typeof qualityOrder] || 0;
                const direction = currentOrder > previousOrder ? 'up' : 'down';
                const previousLabel = previousQualityFromHistory === 'HIGH' ? 'Alta' : previousQualityFromHistory === 'MEDIUM' ? 'Média' : 'Baixa';
                const currentLabel = number.qualityRating === 'HIGH' ? 'Alta' : number.qualityRating === 'MEDIUM' ? 'Média' : 'Baixa';
                
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`flex items-center gap-0.5 text-[10px] font-medium ${
                        direction === 'up' ? 'text-emerald-500' : 'text-red-500'
                      }`}>
                        {direction === 'up' 
                          ? <TrendingUp className="w-3 h-3" /> 
                          : <TrendingDown className="w-3 h-3" />
                        }
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {direction === 'up' ? 'Subiu' : 'Desceu'}: {previousLabel} → {currentLabel}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {format(statusStartDate, "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })()}
            </div>
            
            {/* Indicador de dias no status atual com ícone de relógio */}
            {daysInCurrentStatus !== null && daysInCurrentStatus >= 0 && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                <Clock className="w-3 h-3" />
                <span>+{daysInCurrentStatus} dias em {number.qualityRating === 'HIGH' ? 'Alta' : number.qualityRating === 'MEDIUM' ? 'Média' : 'Baixa'}</span>
              </div>
            )}

            {/* Status anterior e data - calculado do histórico */}
            {statusStartDate && (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {previousQualityFromHistory ? (
                  <>
                    <span className="opacity-70">
                      Antes: {previousQualityFromHistory === 'HIGH' ? 'Alta' : previousQualityFromHistory === 'MEDIUM' ? 'Média' : 'Baixa'}
                    </span>
                    <span className="mx-1 opacity-50">•</span>
                    <span className="opacity-60">
                      {format(statusStartDate, "dd/MM/yy", { locale: ptBR })}
                    </span>
                  </>
                ) : (
                  <span className="opacity-60">
                    Desde: {format(statusStartDate, "dd/MM/yy", { locale: ptBR })}
                  </span>
                )}
              </div>
            )}
          </TableCell>
          <TableCell>
            <span className="text-sm">
              {(!number.messagingLimitTier || number.messagingLimitTier === 'Não definido')
                ? (daysInCurrentStatus !== null ? `Há ${daysInCurrentStatus}d` : '-')
                : `${number.messagingLimitTier}/dia`
              }
            </span>
          </TableCell>
          <TableCell>
            {bm ? (
              <div className="text-xs space-y-1">
                <div>
                  <p className="font-medium text-foreground">{bm.mainBmName}</p>
                  <p className="text-muted-foreground">ID: {bm.mainBmId}</p>
                </div>
                {bm.subBmName && (
                  <div className="pt-1 border-t border-border">
                    <p className="text-muted-foreground">WABA: {bm.subBmName}</p>
                    <p className="text-muted-foreground">ID: {bm.subBmId}</p>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">-</span>
            )}
          </TableCell>
          <TableCell>{number.observation ? <span className="text-xs text-muted-foreground line-clamp-2 max-w-[200px]">{number.observation}</span> : <span className="text-xs text-muted-foreground">-</span>}</TableCell>
          <TableCell><span className="text-xs text-muted-foreground">{format(new Date(number.lastChecked), "dd/MM/yy HH:mm", { locale: ptBR })}</span></TableCell>
          <TableCell><Switch checked={number.isVisible} onCheckedChange={(checked) => handleToggleVisibility(number, checked)} /></TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHistoryNumber(number)}><History className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditNumber(number)}><Edit2 className="w-4 h-4" /></Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover">
                  <DropdownMenuItem onClick={() => handleClearNumberNotifications(number.id)}><Bell className="w-4 h-4 mr-2" />Limpar notificações</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteNumber(number)}><Trash2 className="w-4 h-4 mr-2" />Excluir número</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TableCell>
        </TableRow>
      </TooltipProvider>
    );
  };

  if (projectLoading || numbersLoading) {
    return <DashboardLayout><div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  if (!project) {
    return (
      <DashboardLayout>
        <Card className="p-12 text-center">
          <h2 className="text-xl font-semibold mb-2">Projeto não encontrado</h2>
          <p className="text-muted-foreground mb-4">O projeto solicitado não existe ou foi removido.</p>
          <Link to="/projects"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Voltar aos Projetos</Button></Link>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"><ArrowLeft className="w-4 h-4" />Voltar aos Projetos</Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            {project.description && <p className="text-muted-foreground mt-1">{project.description}</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setIsScheduleModalOpen(true)}>
              <Clock className="w-4 h-4 mr-2" />
              Horários
            </Button>
            <Button variant="outline" onClick={handleUpdateAllStatus} disabled={isUpdating || numbers.length === 0}>
              {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {isUpdating ? 'Atualizando...' : 'Atualizar Status'}
            </Button>
            <Dialog open={isBMListOpen} onOpenChange={setIsBMListOpen}>
              <DialogTrigger asChild><Button variant="outline"><Building2 className="w-4 h-4 mr-2" />Cadastrar BM</Button></DialogTrigger>
              <DialogContent className="max-w-xl flex flex-col max-h-[80vh]">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Business Managers
                    <span className="ml-auto text-sm font-normal text-muted-foreground">{projectBMs.length} cadastrada(s)</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="flex justify-between items-center flex-shrink-0 pt-2">
                  <p className="text-xs text-muted-foreground">Gerencie as BMs vinculadas a este projeto</p>
                  <Button size="sm" onClick={() => { setEditBM(null); setIsNewBMOpen(true); setIsBMListOpen(false); }}>
                    <Plus className="w-4 h-4 mr-1" />Nova BM
                  </Button>
                </div>
                <div className="overflow-y-auto flex-1 mt-2 pr-1 space-y-2">
                  {projectBMs.length > 0 ? projectBMs.map((bm) => (
                    <div key={bm.id} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">BM Principal</p>
                            <p className="font-medium text-sm">{bm.mainBmName}</p>
                            <p className="text-xs text-muted-foreground font-mono">ID: {bm.mainBmId}</p>
                          </div>
                          {bm.subBmName && (
                            <div className="pt-2 border-t border-border">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sub BM (WABA)</p>
                              <p className="font-medium text-sm">{bm.subBmName}</p>
                              <p className="text-xs text-muted-foreground font-mono">ID: {bm.subBmId}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditBM(bm); setIsNewBMOpen(true); setIsBMListOpen(false); }}><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeleteBM(bm); setIsBMListOpen(false); }}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-10">
                      <Building2 className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma BM cadastrada ainda</p>
                      <p className="text-xs text-muted-foreground mt-1">Clique em "Nova BM" para adicionar</p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Button className="gradient-primary" onClick={() => setIsAddNumberModalOpen(true)}><Plus className="w-4 h-4 mr-2" />Adicionar Número</Button>
          </div>
        </div>
      </div>

      <Card className="mb-8 overflow-hidden">
        <div className="gradient-primary p-6">
          <h2 className="text-lg font-semibold text-primary-foreground mb-4">Resumo do Projeto</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <div><div className="flex items-center gap-2 text-primary-foreground/80 text-sm mb-1"><Phone className="w-4 h-4" />Total</div><p className="text-3xl font-bold text-primary-foreground">{numbers.length}</p></div>
            <div><div className="flex items-center gap-2 text-primary-foreground/80 text-sm mb-1"><TrendingUp className="w-4 h-4 text-success-foreground" />Alta</div><p className="text-3xl font-bold text-primary-foreground">{statusCounts.high}</p></div>
            <div><div className="flex items-center gap-2 text-primary-foreground/80 text-sm mb-1"><Activity className="w-4 h-4 text-warning-foreground" />Média</div><p className="text-3xl font-bold text-primary-foreground">{statusCounts.medium}</p></div>
            <div><div className="flex items-center gap-2 text-primary-foreground/80 text-sm mb-1"><TrendingDown className="w-4 h-4 text-destructive-foreground" />Baixa</div><p className="text-3xl font-bold text-primary-foreground">{statusCounts.low}</p></div>
            <div><div className="flex items-center gap-2 text-primary-foreground/80 text-sm mb-1"><Building2 className="w-4 h-4" />BMs</div><p className="text-3xl font-bold text-primary-foreground">{projectBMs.length}</p></div>
          </div>
        </div>
      </Card>

      <div className="flex flex-col sm:flex-row gap-4 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar números..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar status" /></SelectTrigger><SelectContent className="bg-popover"><SelectItem value="all">Todos os Status</SelectItem><SelectItem value="HIGH">🟢 Alta Qualidade</SelectItem><SelectItem value="MEDIUM">🟡 Média Qualidade</SelectItem><SelectItem value="LOW">🔴 Baixa Qualidade</SelectItem></SelectContent></Select>
        <Select value={bmFilter} onValueChange={setBmFilter}><SelectTrigger className="w-[180px]"><Building2 className="w-4 h-4 mr-2" /><SelectValue placeholder="Filtrar por BM" /></SelectTrigger><SelectContent className="bg-popover"><SelectItem value="all">Todas as BMs</SelectItem>{projectBMs.map(bm => <SelectItem key={bm.id} value={bm.id}>{bm.mainBmName}</SelectItem>)}</SelectContent></Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}><SelectTrigger className="w-[200px]"><ArrowUpDown className="w-4 h-4 mr-2" /><SelectValue placeholder="Ordenar por" /></SelectTrigger><SelectContent className="bg-popover"><SelectItem value="quality-asc">Qualidade: Alta → Baixa</SelectItem><SelectItem value="quality-desc">Qualidade: Baixa → Alta</SelectItem><SelectItem value="date-desc">Data: Mais Recente</SelectItem><SelectItem value="date-asc">Data: Mais Antigo</SelectItem></SelectContent></Select>
      </div>

      {activeNumbers.length > 0 ? (
        <Card className="mb-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Qualidade</TableHead><TableHead>Limite</TableHead><TableHead>BM</TableHead><TableHead>Observação</TableHead><TableHead>Última Verificação</TableHead><TableHead>Ativo</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
              <TableBody>{activeNumbers.map((number) => renderNumberRow(number))}</TableBody>
            </Table>
          </div>
        </Card>
      ) : numbers.length === 0 ? (
        <Card className="p-12 text-center animate-fade-in">
          <Phone className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-lg mb-2">Nenhum número cadastrado</h3>
          <p className="text-muted-foreground mb-4">Adicione seus números WhatsApp Business para começar o monitoramento.</p>
          <Button className="gradient-primary" onClick={() => setIsAddNumberModalOpen(true)}><Plus className="w-4 h-4 mr-2" />Adicionar Primeiro Número</Button>
        </Card>
      ) : activeNumbers.length === 0 && inactiveNumbers.length === 0 ? (
        <Card className="p-8 text-center"><p className="text-muted-foreground">Nenhum número encontrado com os filtros selecionados</p></Card>
      ) : null}

      {inactiveNumbers.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4"><EyeOff className="w-5 h-5 text-muted-foreground" /><h3 className="text-lg font-semibold text-muted-foreground">Desativados ({inactiveNumbers.length})</h3></div>
          <Card className="border-dashed">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Qualidade</TableHead><TableHead>Limite</TableHead><TableHead>BM</TableHead><TableHead>Observação</TableHead><TableHead>Última Verificação</TableHead><TableHead>Ativo</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
                <TableBody>{inactiveNumbers.map((number) => renderNumberRow(number, true))}</TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      <EditNumberModal number={editNumber} open={!!editNumber} onOpenChange={(open) => !open && setEditNumber(null)} onSave={handleSaveNumber} />
      <StatusHistoryModal number={historyNumber} open={!!historyNumber} onOpenChange={(open) => !open && setHistoryNumber(null)} />
      <BMModal bm={editBM} projectId={id || ''} open={isNewBMOpen} onOpenChange={setIsNewBMOpen} onSave={handleSaveBM} existingBMs={projectBMs} />
      <AddNumberFromMetaModal open={isAddNumberModalOpen} onOpenChange={setIsAddNumberModalOpen} projectId={id || ''} businessManagers={projectBMs} onAddNumber={handleAddNumber} />
      <UpdateScheduleModal projectId={id || ''} open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen} />
      <ConfirmDialog open={!!deleteNumber} onOpenChange={(open) => !open && setDeleteNumber(null)} title="Remover Número" description={`Tem certeza que deseja remover o número ${deleteNumber?.displayPhoneNumber}?`} confirmText="Remover" onConfirm={handleDeleteNumber} variant="destructive" />
      <ConfirmDialog open={!!deleteBM} onOpenChange={(open) => !open && setDeleteBM(null)} title="Remover BM" description={`Tem certeza que deseja remover a BM "${deleteBM?.mainBmName}"?`} confirmText="Remover" onConfirm={handleDeleteBM} variant="destructive" />
    </DashboardLayout>
  );
};

export default ProjectDetail;
