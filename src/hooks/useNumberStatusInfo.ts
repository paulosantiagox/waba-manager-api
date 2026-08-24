import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WhatsAppNumber, QualityRating } from '@/types';
import { differenceInDays } from 'date-fns';

export interface NumberStatusInfo {
  numberId: string;
  currentQuality: QualityRating;
  previousQuality?: QualityRating;
  statusStartDate: Date;
  daysInStatus: number;
}

interface StatusHistoryRecord {
  id: string;
  phone_number_id: string;
  quality_rating: string;
  changed_at: string;
  previous_quality?: string;
}

/**
 * Hook que calcula informações de status baseado no histórico da tabela waba_status_history.
 * - Busca o histórico de todos os números do projeto de uma vez (query em batch)
 * - Calcula há quantos dias cada número está no status atual
 * - Identifica o status anterior de cada número
 */
export function useNumberStatusInfo(numbers: WhatsAppNumber[]) {
  const numberIds = useMemo(() => numbers.map(n => n.id), [numbers]);

  const { data: historyData = [], isLoading } = useQuery({
    queryKey: ['status-history-batch', numberIds],
    queryFn: async () => {
      if (numberIds.length === 0) return [];

      // Busca o histórico de todos os números em batch
      const allHistory: StatusHistoryRecord[] = [];
      const chunkSize = 100;

      for (let i = 0; i < numberIds.length; i += chunkSize) {
        const chunk = numberIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('waba_status_history')
          .select('id, phone_number_id, quality_rating, changed_at, previous_quality')
          .in('phone_number_id', chunk)
          .order('changed_at', { ascending: false });

        if (error) {
          console.error('[STATUS_INFO] Erro ao buscar histórico:', error);
          continue;
        }

        allHistory.push(...(data || []));
      }

      return allHistory;
    },
    enabled: numberIds.length > 0,
    staleTime: 30000, // Cache por 30 segundos
  });

  // Processa o histórico para calcular as informações de cada número
  const statusInfoMap = useMemo(() => {
    const map = new Map<string, NumberStatusInfo>();

    if (!historyData.length) return map;

    // Agrupa histórico por número
    const historyByNumber = new Map<string, StatusHistoryRecord[]>();
    historyData.forEach(record => {
      const existing = historyByNumber.get(record.phone_number_id) || [];
      existing.push(record);
      historyByNumber.set(record.phone_number_id, existing);
    });

    // Para cada número, calcula as informações
    numbers.forEach(number => {
      const history = historyByNumber.get(number.id) || [];
      
      if (history.length === 0) {
        // Sem histórico - usa data de criação do número
        map.set(number.id, {
          numberId: number.id,
          currentQuality: number.qualityRating,
          statusStartDate: new Date(number.createdAt),
          daysInStatus: differenceInDays(new Date(), new Date(number.createdAt)),
        });
        return;
      }

      // Histórico já está ordenado do mais recente ao mais antigo
      // Encontra quando o status atual começou (percorre até achar um status diferente)
      const currentQuality = number.qualityRating;
      let statusStartDate: Date | null = null;
      let previousQuality: QualityRating | undefined;

      for (let i = 0; i < history.length; i++) {
        const record = history[i];
        const recordQuality = record.quality_rating as QualityRating;

        if (recordQuality !== currentQuality) {
          // Encontrou um registro com status diferente
          // O status atual começou no registro anterior (ou no mais recente se i=0)
          previousQuality = recordQuality;
          
          if (i > 0) {
            statusStartDate = new Date(history[i - 1].changed_at);
          } else {
            // O registro mais recente já tem status diferente - status mudou agora
            // Usa a data do registro atual do número
            statusStartDate = new Date(number.lastChecked);
          }
          break;
        }
      }

      // Se não encontrou status diferente, significa que sempre esteve neste status
      // Usa a data do registro mais antigo
      if (!statusStartDate) {
        const oldestRecord = history[history.length - 1];
        statusStartDate = new Date(oldestRecord.changed_at);
        
        // Verifica se o registro mais antigo tem previous_quality
        if (oldestRecord.previous_quality) {
          previousQuality = oldestRecord.previous_quality as QualityRating;
        }
      }

      map.set(number.id, {
        numberId: number.id,
        currentQuality,
        previousQuality,
        statusStartDate,
        daysInStatus: differenceInDays(new Date(), statusStartDate),
      });
    });

    return map;
  }, [historyData, numbers]);

  return { statusInfoMap, isLoading };
}
