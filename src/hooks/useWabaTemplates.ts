import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchWabaTemplates, MetaTemplate } from '@/services/metaApi';
import { useProjects } from './useProjects';

export interface WabaAccount {
  wabaId: string;
  accessToken: string;
  projectId: string;
  projectName: string;
  bmName: string;
  numberNames: string[]; // display names of numbers in this waba
}

export interface WabaTemplatesResult {
  wabaId: string;
  projectId: string;
  projectName: string;
  bmName: string;
  numberNames: string[];
  templates: MetaTemplate[];
  error?: string;
}

// Builds the flat list of WABA accounts accessible to the user
export function useWabaAccounts() {
  const { data: projects = [] } = useProjects();

  return useQuery({
    queryKey: ['waba-accounts', projects.map(p => p.id)],
    queryFn: async (): Promise<WabaAccount[]> => {
      if (projects.length === 0) return [];

      const projectIds = projects.map(p => p.id);

      // Fetch all BMs and numbers for user's projects
      const [bmsRes, numbersRes] = await Promise.all([
        supabase
          .from('waba_business_managers')
          .select('*')
          .in('project_id', projectIds),
        supabase
          .from('waba_whatsapp_numbers')
          .select('project_id, waba_id, business_manager_id, verified_name, custom_name, is_visible')
          .in('project_id', projectIds)
          .eq('is_visible', true),
      ]);

      if (bmsRes.error) throw bmsRes.error;
      if (numbersRes.error) throw numbersRes.error;

      const bms = bmsRes.data || [];
      const numbers = numbersRes.data || [];

      // Build a map: bmId → accessToken
      const bmTokenMap = new Map<string, { token: string; name: string }>();
      for (const bm of bms) {
        bmTokenMap.set(bm.id, { token: bm.access_token, name: bm.main_bm_name });
      }

      // Build projectId → project name map
      const projectMap = new Map(projects.map(p => [p.id, p.name]));

      // Group numbers by (projectId, wabaId)
      const wabaMap = new Map<string, WabaAccount>();
      for (const num of numbers) {
        const key = `${num.project_id}::${num.waba_id}`;
        if (!wabaMap.has(key)) {
          // Find token: prefer the BM linked to this number, fallback to first BM of project
          const linkedBm = num.business_manager_id
            ? bmTokenMap.get(num.business_manager_id)
            : undefined;
          const fallbackBm = bms.find(b => b.project_id === num.project_id);
          const bmInfo = linkedBm ?? (fallbackBm ? { token: fallbackBm.access_token, name: fallbackBm.main_bm_name } : null);

          if (!bmInfo) continue; // no token available — skip

          wabaMap.set(key, {
            wabaId: num.waba_id,
            accessToken: bmInfo.token,
            projectId: num.project_id,
            projectName: projectMap.get(num.project_id) ?? num.project_id,
            bmName: bmInfo.name,
            numberNames: [],
          });
        }
        const displayName = num.custom_name || num.verified_name;
        wabaMap.get(key)!.numberNames.push(displayName);
      }

      return Array.from(wabaMap.values());
    },
    enabled: projects.length > 0,
    staleTime: 60000,
  });
}

// Fetch templates for a specific WABA — always fresh, no stale cache
export function useTemplatesForWaba(wabaId: string | null, accessToken: string | null) {
  return useQuery({
    queryKey: ['waba-templates', wabaId],
    queryFn: async (): Promise<MetaTemplate[]> => {
      if (!wabaId || !accessToken) return [];
      return fetchWabaTemplates(wabaId, accessToken);
    },
    enabled: !!wabaId && !!accessToken,
    staleTime: 0,        // sempre considera stale — rebusca ao focar a janela
    refetchOnWindowFocus: true,  // rebusca ao voltar para a aba
    retry: 1,
  });
}
