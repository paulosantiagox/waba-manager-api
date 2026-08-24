import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useProjects() {
  const { user, can } = useAuth();
  const queryClient = useQueryClient();
  // admin+master enxergam todos os projetos; user/consultor só os próprios.
  const veTudo = can('admin');

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('projects-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waba_projects',
        },
        () => {
          queryClient.invalidateQueries({ 
            queryKey: ['projects', user?.id, veTudo] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['all-projects'] 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, veTudo, queryClient]);

  return useQuery({
    queryKey: ['projects', user?.id, veTudo],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from('waba_projects')
        .select('*')
        .order('created_at', { ascending: false });

      // Sem nível admin, filtra pelos próprios projetos
      if (!veTudo) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      return (data || []).map((p): Project => ({
        id: p.id,
        userId: p.user_id,
        name: p.name,
        description: p.description || undefined,
        icon: p.icon || undefined,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));
    },
    enabled: !!user,
  });
}

// Hook for admin to get all projects (for user stats)
export function useAllProjects() {
  const { can } = useAuth();

  return useQuery({
    queryKey: ['all-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waba_projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map((p): Project => ({
        id: p.id,
        userId: p.user_id,
        name: p.name,
        description: p.description || undefined,
        icon: p.icon || undefined,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));
    },
    enabled: can('admin'),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waba_projects')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      return {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        description: data.description || undefined,
        icon: data.icon || undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      } as Project;
    },
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (project: { name: string; description?: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('waba_projects')
        .insert({
          user_id: user.id,
          name: project.name,
          description: project.description,
        })
        .select()
        .single();

      if (error) throw error;

      // Create default schedules: 06:00, 12:00, 18:00
      const defaultSchedules = [
        { project_id: data.id, time: '06:00', order: 1 },
        { project_id: data.id, time: '12:00', order: 2 },
        { project_id: data.id, time: '18:00', order: 3 },
      ];

      const { error: scheduleError } = await supabase
        .from('waba_project_update_schedules')
        .insert(defaultSchedules);

      if (scheduleError) {
        console.error('Erro ao criar horários padrão:', scheduleError);
        // Don't throw - project was created successfully
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-schedules'] });
      toast.success('Projeto criado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar projeto');
      console.error(error);
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string }) => {
      const { error } = await supabase
        .from('waba_projects')
        .update({
          name: updates.name,
          description: updates.description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.id] });
      toast.success('Projeto atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar projeto');
      console.error(error);
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('waba_projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projeto removido!');
    },
    onError: (error) => {
      toast.error('Erro ao remover projeto');
      console.error(error);
    },
  });
}