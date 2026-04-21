import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { WhatsAppNumber, QualityRating } from '@/types';
import { toast } from 'sonner';

export function useWhatsAppNumbers(projectId?: string) {
  const queryClient = useQueryClient();

  // Subscription realtime integrada
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`whatsapp-numbers-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waba_whatsapp_numbers',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          queryClient.invalidateQueries({ 
            queryKey: ['whatsapp-numbers', projectId] 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);

  return useQuery({
    queryKey: ['whatsapp-numbers', projectId],
    queryFn: async () => {
      let query = supabase
        .from('waba_whatsapp_numbers')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      return data.map((n): WhatsAppNumber => ({
        id: n.id,
        projectId: n.project_id,
        businessManagerId: n.business_manager_id || undefined,
        phoneNumberId: n.phone_number_id,
        displayPhoneNumber: n.display_phone_number,
        verifiedName: n.verified_name,
        customName: n.custom_name || undefined,
        qualityRating: n.quality_rating as QualityRating,
        messagingLimitTier: n.messaging_limit_tier,
        photo: n.photo || undefined,
        wabaId: n.waba_id,
        isVisible: n.is_visible,
        observation: n.observation || undefined,
        createdAt: n.created_at,
        lastChecked: n.last_checked,
        previousQuality: n.previous_quality as QualityRating | undefined,
        lastStatusChange: n.last_status_change || undefined,
      }));
    },
    enabled: projectId !== undefined,
    staleTime: 30000,
  });
}

export function useAllWhatsAppNumbers() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-numbers-all-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waba_whatsapp_numbers',
        },
        () => {
          queryClient.invalidateQueries({ 
            queryKey: ['whatsapp-numbers-all'] 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['whatsapp-numbers-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waba_whatsapp_numbers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return data.map((n): WhatsAppNumber => ({
        id: n.id,
        projectId: n.project_id,
        businessManagerId: n.business_manager_id || undefined,
        phoneNumberId: n.phone_number_id,
        displayPhoneNumber: n.display_phone_number,
        verifiedName: n.verified_name,
        customName: n.custom_name || undefined,
        qualityRating: n.quality_rating as QualityRating,
        messagingLimitTier: n.messaging_limit_tier,
        photo: n.photo || undefined,
        wabaId: n.waba_id,
        isVisible: n.is_visible,
        observation: n.observation || undefined,
        createdAt: n.created_at,
        lastChecked: n.last_checked,
        previousQuality: n.previous_quality as QualityRating | undefined,
        lastStatusChange: n.last_status_change || undefined,
      }));
    },
  });
}

export function useCreateWhatsAppNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (number: Omit<WhatsAppNumber, 'id' | 'createdAt' | 'lastChecked'>) => {
      const { data, error } = await supabase
        .from('waba_whatsapp_numbers')
        .insert({
          project_id: number.projectId,
          business_manager_id: number.businessManagerId,
          phone_number_id: number.phoneNumberId,
          display_phone_number: number.displayPhoneNumber,
          verified_name: number.verifiedName,
          custom_name: number.customName,
          quality_rating: number.qualityRating,
          messaging_limit_tier: number.messagingLimitTier,
          photo: number.photo,
          waba_id: number.wabaId,
          is_visible: number.isVisible,
          observation: number.observation,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers-all'] });
      toast.success('Número adicionado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao adicionar número');
      console.error(error);
    },
  });
}

export function useUpdateWhatsAppNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<{
      displayPhoneNumber: string;
      qualityRating: string;
      messagingLimitTier: string;
      verifiedName: string;
      wabaId: string;
      isVisible: boolean;
      customName: string;
      observation: string;
      lastChecked: string;
      previousQuality: string;
      lastStatusChange: string;
    }> }) => {
      // Monta o objeto de atualização
      const updateData: Record<string, unknown> = {};
      
      if (updates.displayPhoneNumber !== undefined) updateData.display_phone_number = updates.displayPhoneNumber;
      if (updates.qualityRating !== undefined) updateData.quality_rating = updates.qualityRating;
      if (updates.messagingLimitTier !== undefined) updateData.messaging_limit_tier = updates.messagingLimitTier;
      if (updates.verifiedName !== undefined) updateData.verified_name = updates.verifiedName;
      if (updates.wabaId !== undefined) updateData.waba_id = updates.wabaId;
      if (updates.isVisible !== undefined) updateData.is_visible = updates.isVisible;
      if (updates.customName !== undefined) updateData.custom_name = updates.customName;
      if (updates.observation !== undefined) updateData.observation = updates.observation;
      if (updates.lastChecked !== undefined) updateData.last_checked = updates.lastChecked;
      if (updates.previousQuality !== undefined) updateData.previous_quality = updates.previousQuality;
      if (updates.lastStatusChange !== undefined) updateData.last_status_change = updates.lastStatusChange;

      const { error } = await supabase
        .from('waba_whatsapp_numbers')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers-all'] });
    },
    onError: (error) => {
      console.error('[WHATSAPP] Erro ao atualizar número:', error);
      toast.error('Erro ao atualizar número');
    },
  });
}

export function useDeleteWhatsAppNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase
        .from('waba_whatsapp_numbers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers-all'] });
      toast.success('Número removido!');
    },
    onError: (error) => {
      toast.error('Erro ao remover número');
      console.error(error);
    },
  });
}