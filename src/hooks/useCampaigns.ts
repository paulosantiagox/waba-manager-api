import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Campaign, Broadcast, ActionType, CampaignShortcut, BroadcastStatus } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ===================== CAMPAIGNS =====================

export function useCampaigns() {
  const { user, can } = useAuth();
  // admin+master enxergam todas as campanhas; user/consultor só as próprias.
  const veTudo = can('admin');

  return useQuery({
    queryKey: ['campaigns', user?.id, veTudo],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('waba_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      // Sem nível admin, filtra pelas próprias campanhas
      if (!veTudo) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((c): Campaign => ({
        id: c.id,
        userId: c.user_id,
        projectId: c.project_id || undefined,
        name: c.name,
        description: c.description || undefined,
        status: c.status as 'active' | 'archived',
        createdAt: c.created_at,
      }));
    },
    enabled: !!user,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (campaign: { name: string; description?: string; projectId?: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('waba_campaigns')
        .insert({
          user_id: user.id,
          name: campaign.name,
          description: campaign.description,
          project_id: campaign.projectId,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha criada!');
    },
    onError: (error) => {
      toast.error('Erro ao criar campanha');
      console.error(error);
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Campaign> & { id: string }) => {
      const { error } = await supabase
        .from('waba_campaigns')
        .update({
          name: updates.name,
          description: updates.description,
          project_id: updates.projectId,
          status: updates.status,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha atualizada!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar campanha');
      console.error(error);
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('waba_campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha removida!');
    },
    onError: (error) => {
      toast.error('Erro ao remover campanha');
      console.error(error);
    },
  });
}

// ===================== BROADCASTS =====================

export function useBroadcasts(campaignId?: string) {
  return useQuery({
    queryKey: ['broadcasts', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      
      const { data, error } = await supabase
        .from('waba_broadcasts')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('date', { ascending: false });

      if (error) throw error;
      
      return data.map((b): Broadcast => ({
        id: b.id,
        campaignId: b.campaign_id,
        date: b.date,
        time: b.time,
        returnDate: b.return_date || undefined,
        actionTypeId: b.action_type_id,
        phoneNumberId: b.phone_number_id,
        listName: b.list_name,
        templateUsed: b.template_used,
        contactCount: b.contact_count,
        observations: b.observations || undefined,
        tags: b.tags || undefined,
        status: b.status as BroadcastStatus,
        createdAt: b.created_at,
      }));
    },
    enabled: !!campaignId,
  });
}

export function useCreateBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (broadcast: Omit<Broadcast, 'id' | 'createdAt'>) => {
      const { data, error } = await supabase
        .from('waba_broadcasts')
        .insert({
          campaign_id: broadcast.campaignId,
          date: broadcast.date,
          time: broadcast.time,
          return_date: broadcast.returnDate,
          action_type_id: broadcast.actionTypeId,
          phone_number_id: broadcast.phoneNumberId,
          list_name: broadcast.listName,
          template_used: broadcast.templateUsed,
          contact_count: broadcast.contactCount,
          observations: broadcast.observations,
          tags: broadcast.tags,
          status: broadcast.status,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts', variables.campaignId] });
      toast.success('Disparo registrado!');
    },
    onError: (error) => {
      toast.error('Erro ao registrar disparo');
      console.error(error);
    },
  });
}

export function useUpdateBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, campaignId, ...updates }: Partial<Broadcast> & { id: string; campaignId: string }) => {
      const { error } = await supabase
        .from('waba_broadcasts')
        .update({
          date: updates.date,
          time: updates.time,
          return_date: updates.returnDate,
          action_type_id: updates.actionTypeId,
          phone_number_id: updates.phoneNumberId,
          list_name: updates.listName,
          template_used: updates.templateUsed,
          contact_count: updates.contactCount,
          observations: updates.observations,
          tags: updates.tags,
          status: updates.status,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts', variables.campaignId] });
      toast.success('Disparo atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar disparo');
      console.error(error);
    },
  });
}

export function useDeleteBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, campaignId }: { id: string; campaignId: string }) => {
      const { error } = await supabase
        .from('waba_broadcasts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts', variables.campaignId] });
      toast.success('Disparo removido!');
    },
    onError: (error) => {
      toast.error('Erro ao remover disparo');
      console.error(error);
    },
  });
}

// ===================== ACTION TYPES =====================

export function useActionTypes(campaignId?: string) {
  return useQuery({
    queryKey: ['action-types', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      
      const { data, error } = await supabase
        .from('waba_action_types')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('name', { ascending: true });

      if (error) throw error;
      
      return data.map((at): ActionType => ({
        id: at.id,
        campaignId: at.campaign_id,
        name: at.name,
        color: at.color,
        description: at.description || undefined,
        isActive: at.is_active,
      }));
    },
    enabled: !!campaignId,
  });
}

export function useCreateActionType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (actionType: Omit<ActionType, 'id'>) => {
      const { data, error } = await supabase
        .from('waba_action_types')
        .insert({
          campaign_id: actionType.campaignId,
          name: actionType.name,
          color: actionType.color,
          description: actionType.description,
          is_active: actionType.isActive,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['action-types', variables.campaignId] });
      toast.success('Tipo de ação criado!');
    },
    onError: (error) => {
      toast.error('Erro ao criar tipo de ação');
      console.error(error);
    },
  });
}

export function useUpdateActionType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, campaignId, ...updates }: Partial<ActionType> & { id: string; campaignId: string }) => {
      const { error } = await supabase
        .from('waba_action_types')
        .update({
          name: updates.name,
          color: updates.color,
          description: updates.description,
          is_active: updates.isActive,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['action-types', variables.campaignId] });
      toast.success('Tipo de ação atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar tipo de ação');
      console.error(error);
    },
  });
}

export function useDeleteActionType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, campaignId }: { id: string; campaignId: string }) => {
      const { error } = await supabase
        .from('waba_action_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['action-types', variables.campaignId] });
      toast.success('Tipo de ação removido!');
    },
    onError: (error) => {
      toast.error('Erro ao remover tipo de ação');
      console.error(error);
    },
  });
}

// ===================== SHORTCUTS =====================

export function useShortcuts(campaignId?: string) {
  return useQuery({
    queryKey: ['shortcuts', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      
      const { data, error } = await supabase
        .from('waba_campaign_shortcuts')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return data.map((s): CampaignShortcut => ({
        id: s.id,
        campaignId: s.campaign_id,
        name: s.name,
        content: s.content,
        isMultiline: s.is_multiline,
        createdAt: s.created_at,
      }));
    },
    enabled: !!campaignId,
  });
}

export function useCreateShortcut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shortcut: Omit<CampaignShortcut, 'id' | 'createdAt'>) => {
      const { data, error } = await supabase
        .from('waba_campaign_shortcuts')
        .insert({
          campaign_id: shortcut.campaignId,
          name: shortcut.name,
          content: shortcut.content,
          is_multiline: shortcut.isMultiline,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shortcuts', variables.campaignId] });
      toast.success('Atalho criado!');
    },
    onError: (error) => {
      toast.error('Erro ao criar atalho');
      console.error(error);
    },
  });
}

export function useUpdateShortcut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, campaignId, ...updates }: Partial<CampaignShortcut> & { id: string; campaignId: string }) => {
      const { error } = await supabase
        .from('waba_campaign_shortcuts')
        .update({
          name: updates.name,
          content: updates.content,
          is_multiline: updates.isMultiline,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shortcuts', variables.campaignId] });
      toast.success('Atalho atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar atalho');
      console.error(error);
    },
  });
}

export function useDeleteShortcut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, campaignId }: { id: string; campaignId: string }) => {
      const { error } = await supabase
        .from('waba_campaign_shortcuts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shortcuts', variables.campaignId] });
      toast.success('Atalho removido!');
    },
    onError: (error) => {
      toast.error('Erro ao remover atalho');
      console.error(error);
    },
  });
}
