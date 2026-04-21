import { useMemo, useState } from 'react';
import { WhatsAppNumber } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Download, TrendingUp, TrendingDown, Clock, Calendar, Phone, Loader2 } from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useGroupedStatusHistory } from '@/hooks/useStatusHistory';
import DailyHistoryItem from '@/components/history/DailyHistoryItem';

interface StatusHistoryModalProps {
  number: WhatsAppNumber | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const StatusHistoryModal = ({ number, open, onOpenChange }: StatusHistoryModalProps) => {
  const [periodFilter, setPeriodFilter] = useState('30');
  const { data: groupedHistory = [], allHistory = [], isLoading } = useGroupedStatusHistory(number?.id);

  // Filtra os grupos por período
  const filteredGroups = useMemo(() => {
    if (!groupedHistory.length) return [];
    
    const filterDate = subDays(new Date(), parseInt(periodFilter));
    
    return groupedHistory.filter(group => 
      isAfter(new Date(group.date + 'T23:59:59'), filterDate)
    );
  }, [groupedHistory, periodFilter]);

  // Estatísticas gerais
  const stats = useMemo(() => {
    if (!number || !allHistory.length) return null;
    
    const highCount = allHistory.filter(h => h.qualityRating === 'HIGH').length;
    const mediumCount = allHistory.filter(h => h.qualityRating === 'MEDIUM').length;
    const lowCount = allHistory.filter(h => h.qualityRating === 'LOW').length;
    
    const lastDrop = allHistory.find(h => h.previousQuality === 'HIGH' && h.qualityRating !== 'HIGH');
    
    const oldest = allHistory[allHistory.length - 1];
    const newest = allHistory[0];
    const ratingValues = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const trend = oldest && newest 
      ? ratingValues[newest.qualityRating] - ratingValues[oldest.qualityRating]
      : 0;

    return { 
      highCount, 
      mediumCount, 
      lowCount, 
      lastDrop: lastDrop ? new Date(lastDrop.changedAt) : null, 
      trend,
      totalDays: groupedHistory.length,
      totalVerifications: allHistory.length
    };
  }, [number, allHistory, groupedHistory]);

  const exportToCSV = () => {
    if (!number || !allHistory.length) return;

    const headers = ['Data/Hora', 'Status Anterior', 'Status Atual', 'Limite', 'Observação'];
    const rows = allHistory.map(h => [
      format(new Date(h.changedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      h.previousQuality || '-',
      h.qualityRating,
      h.messagingLimitTier,
      h.observation || '-'
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historico_${number.displayPhoneNumber.replace(/\s/g, '_')}.csv`;
    link.click();
  };

  const getStatusBadge = (rating: string) => {
    switch (rating) {
      case 'HIGH':
        return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-success/20 text-success">🟢 Alta</span>;
      case 'MEDIUM':
        return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-warning/20 text-warning">🟡 Média</span>;
      case 'LOW':
        return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-destructive/20 text-destructive">🔴 Baixa</span>;
      default:
        return <span className="text-muted-foreground">-</span>;
    }
  };

  if (!number) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico de Status
          </DialogTitle>
        </DialogHeader>

        {/* Info do Número */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Phone className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            {number.customName && <p className="text-sm font-semibold">{number.customName}</p>}
            <p className="text-sm text-muted-foreground">{number.verifiedName} • {number.displayPhoneNumber}</p>
          </div>
          <div>{getStatusBadge(number.qualityRating)}</div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden space-y-4 mt-4 min-h-0">
          {/* Cards de Estatísticas */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-3">
                <div className="text-xs text-muted-foreground mb-1">Tendência</div>
                <div className="flex items-center gap-2">
                  {stats.trend > 0 ? (
                    <><TrendingUp className="w-5 h-5 text-success" /><span className="font-semibold text-success">Melhorando</span></>
                  ) : stats.trend < 0 ? (
                    <><TrendingDown className="w-5 h-5 text-destructive" /><span className="font-semibold text-destructive">Piorando</span></>
                  ) : (
                    <><Clock className="w-5 h-5 text-muted-foreground" /><span className="font-semibold">Estável</span></>
                  )}
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground mb-1">Dias Monitorados</div>
                <div className="font-semibold">{stats.totalDays} dias</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground mb-1">Total Verificações</div>
                <div className="font-semibold">{stats.totalVerifications}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground mb-1">Última Queda</div>
                <div className="font-semibold">{stats.lastDrop ? format(stats.lastDrop, "dd/MM/yyyy", { locale: ptBR }) : 'Nenhuma'}</div>
              </Card>
            </div>
          )}

          {/* Filtros e Export */}
          <div className="flex items-center justify-between gap-4">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>

          {/* Lista de Dias (Expandível) */}
          <ScrollArea className="rounded-lg border h-[calc(85vh-350px)] min-h-[200px]">
            <div className="p-4 space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : filteredGroups.length > 0 ? (
                filteredGroups.map((dayGroup) => (
                  <DailyHistoryItem key={dayGroup.date} dayGroup={dayGroup} />
                ))
              ) : (
                <div className="p-8 text-center">
                  <History className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-muted-foreground">Nenhum histórico encontrado para o período selecionado</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StatusHistoryModal;
