import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ScheduleExecution {
  id: string;
  projectId: string;
  scheduleTime: string;
  executionDate: string;
  executedAt: string;
  brasiliaTime: string | null;
  numbersChecked: number;
  numbersUpdated: number;
  errors: number;
}

// Busca execuções de hoje para um projeto
export function useProjectScheduleExecutions(projectId?: string) {
  const queryClient = useQueryClient();

  // Subscription realtime integrada
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`executions-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'waba_project_schedule_executions',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          queryClient.invalidateQueries({ 
            queryKey: ['project-schedule-executions', projectId] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['last-project-execution', projectId] 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);

  return useQuery({
    queryKey: ['project-schedule-executions', projectId],
    queryFn: async (): Promise<ScheduleExecution[]> => {
      if (!projectId) return [];
      
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('waba_project_schedule_executions')
        .select('*')
        .eq('project_id', projectId)
        .eq('execution_date', todayStr)
        .order('executed_at', { ascending: false });

      if (error) {
        console.log('[EXECUTIONS] Erro ao buscar execuções:', error.message);
        return [];
      }
      
      return (data || []).map((e): ScheduleExecution => ({
        id: e.id,
        projectId: e.project_id,
        scheduleTime: e.schedule_time,
        executionDate: e.execution_date,
        executedAt: e.executed_at,
        brasiliaTime: e.brasilia_time,
        numbersChecked: e.numbers_checked || 0,
        numbersUpdated: e.numbers_updated || 0,
        errors: e.errors || 0,
      }));
    },
    enabled: !!projectId,
    staleTime: 30000,
  });
}

// Busca a última execução do projeto
export function useLastProjectExecution(projectId?: string) {
  return useQuery({
    queryKey: ['last-project-execution', projectId],
    queryFn: async (): Promise<ScheduleExecution | null> => {
      if (!projectId) return null;
      
      const { data, error } = await supabase
        .from('waba_project_schedule_executions')
        .select('*')
        .eq('project_id', projectId)
        .order('executed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.log('[EXECUTIONS] Erro ao buscar última execução:', error.message);
        return null;
      }
      
      if (!data) return null;

      return {
        id: data.id,
        projectId: data.project_id,
        scheduleTime: data.schedule_time,
        executionDate: data.execution_date,
        executedAt: data.executed_at,
        brasiliaTime: data.brasilia_time,
        numbersChecked: data.numbers_checked || 0,
        numbersUpdated: data.numbers_updated || 0,
        errors: data.errors || 0,
      };
    },
    enabled: !!projectId,
    staleTime: 30000,
  });
}
