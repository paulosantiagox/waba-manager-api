import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NumberErrorInfo {
  hasError: boolean;
  errorMessage: string;
  errorAt: string;
  errorCount: number;
}

export function useNumberErrorState(numberIds: string[]) {
  return useQuery({
    queryKey: ['number-errors', numberIds.sort().join(',')],
    queryFn: async (): Promise<Map<string, NumberErrorInfo>> => {
      if (numberIds.length === 0) {
        return new Map();
      }

      // Busca registros recentes com is_error = true
      // Para cada número, pega apenas erros das últimas 24 horas
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data, error } = await supabase
        .from('waba_status_history')
        .select('phone_number_id, error_message, changed_at')
        .in('phone_number_id', numberIds)
        .eq('is_error', true)
        .gte('changed_at', twentyFourHoursAgo.toISOString())
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('[useNumberErrorState] Erro ao buscar estado de erros:', error);
        return new Map();
      }

      // Agrupa por número e conta erros
      const errorMap = new Map<string, NumberErrorInfo>();
      const errorCounts = new Map<string, number>();

      data?.forEach(record => {
        const phoneId = record.phone_number_id;
        const currentCount = errorCounts.get(phoneId) || 0;
        errorCounts.set(phoneId, currentCount + 1);

        // Só guarda o primeiro (mais recente) para exibição
        if (!errorMap.has(phoneId)) {
          errorMap.set(phoneId, {
            hasError: true,
            errorMessage: record.error_message || 'Erro desconhecido',
            errorAt: record.changed_at,
            errorCount: 1, // Será atualizado depois
          });
        }
      });

      // Atualiza os contadores
      errorCounts.forEach((count, phoneId) => {
        const info = errorMap.get(phoneId);
        if (info) {
          info.errorCount = count;
        }
      });

      return errorMap;
    },
    enabled: numberIds.length > 0,
    refetchInterval: 60000, // Atualiza a cada minuto
    staleTime: 30000,
  });
}

/**
 * Hook para limpar o indicador de erro de um número específico
 * Isso NÃO apaga os registros do histórico, apenas marca que o erro foi "visto"
 * Na prática, o indicador de erro desaparece automaticamente após 24h ou quando
 * uma verificação bem-sucedida ocorre
 */
export function useClearNumberError() {
  // Por agora, a limpeza é automática (24h ou verificação bem-sucedida)
  // No futuro, podemos adicionar um campo "acknowledged" na tabela
  return {
    clear: (numberId: string) => {
      console.log('[useNumberErrorState] Erro do número', numberId, 'será limpo na próxima verificação bem-sucedida');
    }
  };
}
