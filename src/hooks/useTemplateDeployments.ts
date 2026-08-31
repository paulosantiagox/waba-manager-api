import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWabaTemplates } from '@/services/metaApi';

export interface TemplateDeployment {
  id: string;
  userId: string;
  projectId: string | null;
  projectName: string;
  wabaId: string;
  templateBaseName: string;
  templateName: string;
  versionNumber: number;
  requestedCategory: string;
  actualCategory: string | null;
  categoryChanged: boolean;
  language: string;
  components: unknown[];
  metaTemplateId: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  lastCheckedAt: string;
}

function mapRow(r: Record<string, unknown>): TemplateDeployment {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    projectId: (r.project_id as string) ?? null,
    projectName: r.project_name as string,
    wabaId: r.waba_id as string,
    templateBaseName: r.template_base_name as string,
    templateName: r.template_name as string,
    versionNumber: r.version_number as number,
    requestedCategory: r.requested_category as string,
    actualCategory: (r.actual_category as string) ?? null,
    categoryChanged: r.category_changed as boolean,
    language: r.language as string,
    components: (r.components as unknown[]) ?? [],
    metaTemplateId: (r.meta_template_id as string) ?? null,
    status: r.status as string,
    errorMessage: (r.error_message as string) ?? null,
    createdAt: r.created_at as string,
    lastCheckedAt: r.last_checked_at as string,
  };
}

export function useTemplateDeployments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['template-deployments', user?.id],
    queryFn: async (): Promise<TemplateDeployment[]> => {
      const { data, error } = await supabase
        .from('waba_template_deployments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []).map(r => mapRow(r as Record<string, unknown>));
    },
    enabled: !!user,
  });
}

export function useSaveDeployment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (deployment: Omit<TemplateDeployment, 'id' | 'userId' | 'createdAt' | 'lastCheckedAt'>) => {
      if (!user) throw new Error('Não autenticado');

      const { data, error } = await supabase
        .from('waba_template_deployments')
        .insert({
          user_id: user.id,
          project_id: deployment.projectId,
          project_name: deployment.projectName,
          waba_id: deployment.wabaId,
          template_base_name: deployment.templateBaseName,
          template_name: deployment.templateName,
          version_number: deployment.versionNumber,
          requested_category: deployment.requestedCategory,
          actual_category: deployment.actualCategory,
          category_changed: deployment.categoryChanged,
          language: deployment.language,
          components: deployment.components,
          meta_template_id: deployment.metaTemplateId,
          status: deployment.status,
          error_message: deployment.errorMessage,
        })
        .select()
        .single();

      if (error) throw error;
      return mapRow(data as Record<string, unknown>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-deployments'] });
    },
  });
}

export interface TemplateBroadcastStats {
  templateName: string;
  broadcastCount: number;
  totalContacts: number;
}

export function useTemplateBroadcastStats() {
  return useQuery({
    queryKey: ['template-broadcast-stats'],
    queryFn: async (): Promise<Map<string, TemplateBroadcastStats>> => {
      const { data, error } = await supabase
        .from('waba_broadcasts')
        .select('template_used, contact_count')
        .not('template_used', 'is', null)
        .not('status', 'eq', 'cancelled');

      if (error) throw error;

      const map = new Map<string, TemplateBroadcastStats>();
      for (const row of data ?? []) {
        const name = row.template_used as string;
        if (!name) continue;
        const existing = map.get(name) ?? { templateName: name, broadcastCount: 0, totalContacts: 0 };
        existing.broadcastCount += 1;
        existing.totalContacts += (row.contact_count as number) ?? 0;
        map.set(name, existing);
      }
      return map;
    },
    staleTime: 60000,
  });
}

export function useRefreshDeploymentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deploymentId,
      wabaId,
      accessToken,
      templateName,
      requestedCategory,
    }: {
      deploymentId: string;
      wabaId: string;
      accessToken: string;
      templateName: string;
      requestedCategory?: string;
    }) => {
      const templates = await fetchWabaTemplates(wabaId, accessToken);
      const found = templates.find(t => t.name === templateName);

      const update: Record<string, unknown> = { last_checked_at: new Date().toISOString() };
      if (found) {
        update.status = found.status;
        update.actual_category = found.category;
        // Recalcula a flag: antes só a categoria era atualizada, então um
        // template reclassificado (UTILITY → MARKETING) continuava com
        // category_changed = false e não era sinalizado.
        if (requestedCategory) {
          update.category_changed = found.category !== requestedCategory;
        }
      }

      const { error } = await supabase
        .from('waba_template_deployments')
        .update(update)
        .eq('id', deploymentId);

      if (error) throw error;
      return found ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-deployments'] });
    },
  });
}
