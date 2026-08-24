import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BroadcastReport {
  id: string;
  date: string | null;
  time: string | null;
  returnDate: string | null;
  listName: string | null;
  templateUsed: string | null;
  contactCount: number;
  observations: string | null;
  tags: string[] | null;
  status: string;
  createdAt: string;
  campaignName: string | null;
  numberCustomName: string | null;
  numberVerifiedName: string | null;
  displayPhoneNumber: string | null;
  actionTypeName: string | null;
  projectName: string | null;
}

export function useBroadcastsReport() {
  return useQuery({
    queryKey: ['broadcasts-report'],
    queryFn: async (): Promise<BroadcastReport[]> => {
      const { data, error } = await supabase
        .from('waba_broadcasts')
        .select(`
          id, date, time, return_date, list_name, template_used,
          contact_count, observations, tags, status, created_at,
          waba_campaigns ( name, waba_projects ( name ) ),
          waba_whatsapp_numbers ( custom_name, verified_name, display_phone_number ),
          waba_action_types ( name )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((r: Record<string, unknown>) => {
        const campaign = r.waba_campaigns as Record<string, unknown> | null;
        const project = campaign?.waba_projects as Record<string, unknown> | null;
        const number = r.waba_whatsapp_numbers as Record<string, unknown> | null;
        const actionType = r.waba_action_types as Record<string, unknown> | null;

        return {
          id: r.id as string,
          date: (r.date as string) ?? null,
          time: (r.time as string) ?? null,
          returnDate: (r.return_date as string) ?? null,
          listName: (r.list_name as string) ?? null,
          templateUsed: (r.template_used as string) ?? null,
          contactCount: (r.contact_count as number) ?? 0,
          observations: (r.observations as string) ?? null,
          tags: (r.tags as string[]) ?? null,
          status: (r.status as string) ?? 'unknown',
          createdAt: r.created_at as string,
          campaignName: (campaign?.name as string) ?? null,
          numberCustomName: (number?.custom_name as string) ?? null,
          numberVerifiedName: (number?.verified_name as string) ?? null,
          displayPhoneNumber: (number?.display_phone_number as string) ?? null,
          actionTypeName: (actionType?.name as string) ?? null,
          projectName: (project?.name as string) ?? null,
        };
      });
    },
    staleTime: 60000,
  });
}
