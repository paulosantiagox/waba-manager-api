import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';

export interface TemplateStatusChange {
  id: string;
  wabaId: string;
  projectName: string | null;
  templateId: string;
  templateName: string;
  previousStatus: string | null;
  newStatus: string;
  previousCategory: string | null;
  newCategory: string;
  changedAt: string;
}

export interface TemplateSnapshot {
  wabaId: string;
  templateName: string;
  status: string;
  category: string;
  lastSyncedAt: string;
}

function mapHistory(r: Record<string, unknown>): TemplateStatusChange {
  return {
    id: r.id as string,
    wabaId: r.waba_id as string,
    projectName: (r.project_name as string) ?? null,
    templateId: r.template_id as string,
    templateName: r.template_name as string,
    previousStatus: (r.previous_status as string) ?? null,
    newStatus: r.new_status as string,
    previousCategory: (r.previous_category as string) ?? null,
    newCategory: r.new_category as string,
    changedAt: r.changed_at as string,
  };
}

export function useTemplateStatusHistory() {
  return useQuery({
    queryKey: ['template-status-history'],
    queryFn: async (): Promise<TemplateStatusChange[]> => {
      const { data, error } = await supabase
        .from('waba_template_status_history')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map(r => mapHistory(r as Record<string, unknown>));
    },
    staleTime: 30000,
  });
}

export function useTemplateSnapshots(wabaId: string | null) {
  return useQuery({
    queryKey: ['template-snapshots', wabaId],
    queryFn: async (): Promise<Map<string, TemplateSnapshot>> => {
      if (!wabaId) return new Map();
      const { data, error } = await supabase
        .from('waba_template_snapshots')
        .select('waba_id, template_name, status, category, last_synced_at')
        .eq('waba_id', wabaId);
      if (error) throw error;
      return new Map(
        (data ?? []).map(r => [
          r.template_name,
          {
            wabaId: r.waba_id,
            templateName: r.template_name,
            status: r.status,
            category: r.category,
            lastSyncedAt: r.last_synced_at,
          },
        ])
      );
    },
    enabled: !!wabaId,
    staleTime: 30000,
  });
}

export function useRefreshAllTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/refresh-all-templates`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-status-history'] });
      queryClient.invalidateQueries({ queryKey: ['template-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['waba-templates'] });
    },
  });
}
