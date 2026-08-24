import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProjectSchedule {
  id: string;
  projectId: string;
  time: string; // HH:mm format
  order: number;
  createdAt: string;
}

export interface AutoUpdateLog {
  id: string;
  executedAt: string;
  brasiliaTime: string;
  schedulesFound: number;
  projectsChecked: number;
  numbersUpdated: number;
  errors: number;
}

export function useProjectSchedules(projectId?: string) {
  return useQuery({
    queryKey: ['project-schedules', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('waba_project_update_schedules')
        .select('*')
        .eq('project_id', projectId)
        .order('order', { ascending: true });

      if (error) throw error;
      
      return (data || []).map((s): ProjectSchedule => ({
        id: s.id,
        projectId: s.project_id,
        time: s.time,
        order: s.order,
        createdAt: s.created_at,
      }));
    },
    enabled: !!projectId,
  });
}

// Hook removido - substituído por useLastProjectExecution em useProjectScheduleExecutions.ts

export function useCreateProjectSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, time, order }: { projectId: string; time: string; order: number }) => {
      const { data, error } = await supabase
        .from('waba_project_update_schedules')
        .insert({
          project_id: projectId,
          time,
          order,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-schedules', variables.projectId] });
    },
    onError: (error) => {
      console.error('[SCHEDULE] Erro ao criar horário:', error);
      toast.error('Erro ao adicionar horário');
    },
  });
}

export function useUpdateProjectSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, projectId, time }: { id: string; projectId: string; time: string }) => {
      const { error } = await supabase
        .from('waba_project_update_schedules')
        .update({ time })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-schedules', variables.projectId] });
    },
    onError: (error) => {
      console.error('[SCHEDULE] Erro ao atualizar horário:', error);
      toast.error('Erro ao atualizar horário');
    },
  });
}

export function useDeleteProjectSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase
        .from('waba_project_update_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-schedules', variables.projectId] });
      toast.success('Horário removido!');
    },
    onError: (error) => {
      console.error('[SCHEDULE] Erro ao remover horário:', error);
      toast.error('Erro ao remover horário');
    },
  });
}
