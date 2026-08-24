import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StatusHistory, StatusChangeNotification, QualityRating } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { DailyHistoryGroup } from '@/components/history/DailyHistoryItem';

export function useStatusHistory(phoneNumberId?: string) {
  return useQuery({
    queryKey: ['status-history', phoneNumberId],
    queryFn: async () => {
      if (!phoneNumberId) return [];
      
      const { data, error } = await supabase
        .from('waba_status_history')
        .select('*')
        .eq('phone_number_id', phoneNumberId)
        .order('changed_at', { ascending: false });

      if (error) throw error;
      
      return data.map((sh): StatusHistory => ({
        id: sh.id,
        phoneNumberId: sh.phone_number_id,
        qualityRating: sh.quality_rating as QualityRating,
        messagingLimitTier: sh.messaging_limit_tier,
        previousQuality: sh.previous_quality as QualityRating | undefined,
        changedAt: sh.changed_at,
        expectedRecovery: sh.expected_recovery || undefined,
        observation: sh.observation || undefined,
        isError: sh.is_error || undefined,
        errorMessage: sh.error_message || undefined,
      }));
    },
    enabled: !!phoneNumberId,
  });
}

// Hook que agrupa o histórico por dia para visualização expandível
export function useGroupedStatusHistory(phoneNumberId?: string) {
  const { data: allHistory = [], isLoading, error } = useStatusHistory(phoneNumberId);

  const groupedHistory = useMemo((): DailyHistoryGroup[] => {
    if (!allHistory.length) return [];

    // Agrupa por data
    const groupsByDate = new Map<string, StatusHistory[]>();
    
    allHistory.forEach(entry => {
      const date = format(new Date(entry.changedAt), 'yyyy-MM-dd');
      const existing = groupsByDate.get(date) || [];
      existing.push(entry);
      groupsByDate.set(date, existing);
    });

    // Converte para array de DailyHistoryGroup
    const dates = Array.from(groupsByDate.keys()).sort((a, b) => b.localeCompare(a)); // Mais recente primeiro
    
    const groups: DailyHistoryGroup[] = dates.map((date, index) => {
      const entries = groupsByDate.get(date)!.sort(
        (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
      );
      
      const finalStatus = entries[0].qualityRating; // Mais recente
      const initialStatus = entries[entries.length - 1].qualityRating; // Mais antigo do dia
      
      // Status do dia anterior (próximo na lista já ordenada por data decrescente)
      const previousDayDate = dates[index + 1];
      const previousDayEntries = previousDayDate ? groupsByDate.get(previousDayDate) : undefined;
      const previousDayStatus = previousDayEntries 
        ? previousDayEntries.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())[0].qualityRating
        : undefined;
      
      // Verifica se houve mudança de status dentro do dia
      const hasStatusChange = entries.some(e => e.previousQuality && e.previousQuality !== e.qualityRating);
      
      return {
        date,
        displayDate: format(new Date(date + 'T12:00:00'), 'dd/MM/yyyy'),
        finalStatus,
        initialStatus,
        hasStatusChange,
        previousDayStatus,
        verificationCount: entries.length,
        entries,
      };
    });

    return groups;
  }, [allHistory]);

  return { data: groupedHistory, allHistory, isLoading, error };
}

export function useCreateStatusHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (history: Omit<StatusHistory, 'id'>) => {
      const { data, error } = await supabase
        .from('waba_status_history')
        .insert({
          phone_number_id: history.phoneNumberId,
          quality_rating: history.qualityRating,
          messaging_limit_tier: history.messagingLimitTier,
          previous_quality: history.previousQuality,
          changed_at: history.changedAt,
          expected_recovery: history.expectedRecovery,
          observation: history.observation,
          is_error: history.isError,
          error_message: history.errorMessage,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['status-history', variables.phoneNumberId] });
      queryClient.invalidateQueries({ queryKey: ['number-errors'] });
      console.log('[STATUS_HISTORY] Histórico criado com sucesso');
    },
    onError: (error) => {
      console.error('[STATUS_HISTORY] Erro ao inserir histórico:', error);
      toast.error('Erro ao salvar histórico de status');
    },
  });
}

// Atualiza apenas o timestamp do último registro de histórico (quando não há mudanças)
export function useUpdateLastStatusHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ phoneNumberId, newTimestamp }: { phoneNumberId: string; newTimestamp: string }) => {
      // Busca o último registro do número
      const { data: lastRecord, error: selectError } = await supabase
        .from('waba_status_history')
        .select('id')
        .eq('phone_number_id', phoneNumberId)
        .order('changed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (selectError) throw selectError;
      if (!lastRecord) return null;

      // Atualiza o timestamp
      const { error: updateError } = await supabase
        .from('waba_status_history')
        .update({ changed_at: newTimestamp })
        .eq('id', lastRecord.id);

      if (updateError) throw updateError;
      return lastRecord.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['status-history', variables.phoneNumberId] });
      console.log('[STATUS_HISTORY] Timestamp atualizado com sucesso');
    },
    onError: (error) => {
      console.error('[STATUS_HISTORY] Erro ao atualizar timestamp:', error);
    },
  });
}

// Atualiza ou cria registro de histórico diário (1 registro por dia)
export function useUpdateOrCreateDailyHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      phoneNumberId, 
      qualityRating, 
      messagingLimitTier 
    }: { 
      phoneNumberId: string; 
      qualityRating: string;
      messagingLimitTier: string;
    }) => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Busca o último registro do número
      const { data: lastRecord, error: selectError } = await supabase
        .from('waba_status_history')
        .select('*')
        .eq('phone_number_id', phoneNumberId)
        .order('changed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (selectError) throw selectError;

      // Verifica se o último registro é de hoje
      if (lastRecord) {
        const lastDate = new Date(lastRecord.changed_at);
        const lastDateStart = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
        
        if (lastDateStart.getTime() === todayStart.getTime()) {
          // Mesmo dia - apenas atualiza o timestamp
          const { error: updateError } = await supabase
            .from('waba_status_history')
            .update({ changed_at: now.toISOString() })
            .eq('id', lastRecord.id);

          if (updateError) throw updateError;
          return { action: 'updated' as const, id: lastRecord.id };
        }
      }

      // Dia diferente ou sem registros - cria novo registro
      const { data, error } = await supabase
        .from('waba_status_history')
        .insert({
          phone_number_id: phoneNumberId,
          quality_rating: qualityRating,
          messaging_limit_tier: messagingLimitTier,
          changed_at: now.toISOString(),
          observation: 'Verificação diária',
        })
        .select()
        .single();

      if (error) throw error;
      return { action: 'created' as const, id: data.id };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['status-history', variables.phoneNumberId] });
      console.log(`[STATUS_HISTORY] ${result.action === 'updated' ? 'Timestamp atualizado (mesmo dia)' : 'Novo registro diário criado'}`);
    },
    onError: (error) => {
      console.error('[STATUS_HISTORY] Erro ao atualizar/criar histórico diário:', error);
    },
  });
}

// ===================== STATUS CHANGE NOTIFICATIONS =====================

export function useStatusChangeNotifications(phoneNumberId?: string) {
  return useQuery({
    queryKey: ['status-notifications', phoneNumberId],
    queryFn: async () => {
      if (!phoneNumberId) return [];
      
      const { data, error } = await supabase
        .from('waba_status_change_notifications')
        .select('*')
        .eq('phone_number_id', phoneNumberId)
        .order('changed_at', { ascending: false });

      if (error) throw error;
      
      return data.map((n): StatusChangeNotification => ({
        id: n.id,
        phoneNumberId: n.phone_number_id,
        projectId: n.project_id,
        previousQuality: n.previous_quality as QualityRating,
        newQuality: n.new_quality as QualityRating,
        direction: n.direction as 'up' | 'down',
        changedAt: n.changed_at,
        read: n.read || undefined,
      }));
    },
    enabled: !!phoneNumberId,
  });
}

export function useAllStatusChangeNotifications(projectId?: string) {
  return useQuery({
    queryKey: ['status-notifications-all', projectId],
    queryFn: async () => {
      let query = supabase
        .from('waba_status_change_notifications')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(50);

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      return data.map((n): StatusChangeNotification => ({
        id: n.id,
        phoneNumberId: n.phone_number_id,
        projectId: n.project_id,
        previousQuality: n.previous_quality as QualityRating,
        newQuality: n.new_quality as QualityRating,
        direction: n.direction as 'up' | 'down',
        changedAt: n.changed_at,
        read: n.read || undefined,
      }));
    },
  });
}

export function useCreateStatusChangeNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notification: Omit<StatusChangeNotification, 'id'>) => {
      const { data, error } = await supabase
        .from('waba_status_change_notifications')
        .insert({
          phone_number_id: notification.phoneNumberId,
          project_id: notification.projectId,
          previous_quality: notification.previousQuality,
          new_quality: notification.newQuality,
          direction: notification.direction,
          changed_at: notification.changedAt,
          read: notification.read,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['status-notifications', variables.phoneNumberId] });
      queryClient.invalidateQueries({ queryKey: ['status-notifications-all'] });
    },
  });
}

export function useClearNumberNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (phoneNumberId: string) => {
      const { error } = await supabase
        .from('waba_status_change_notifications')
        .delete()
        .eq('phone_number_id', phoneNumberId);

      if (error) throw error;
    },
    onSuccess: (_, phoneNumberId) => {
      queryClient.invalidateQueries({ queryKey: ['status-notifications', phoneNumberId] });
      queryClient.invalidateQueries({ queryKey: ['status-notifications-all'] });
      toast.success('Notificações limpas!');
    },
  });
}
