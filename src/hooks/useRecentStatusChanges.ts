import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { QualityRating } from '@/types';

export interface RecentStatusChange {
  id: string;
  phoneNumberId: string;
  numberName: string;
  displayPhoneNumber: string;
  projectId: string;
  projectName: string;
  previousQuality: QualityRating;
  currentQuality: QualityRating;
  direction: 'up' | 'down';
  changedAt: string;
}

export function useRecentStatusChanges(projectIds?: string[]) {
  return useQuery({
    queryKey: ['recent-status-changes', projectIds],
    queryFn: async () => {
      if (!projectIds || projectIds.length === 0) return [];

      // Busca registros do histórico que tiveram mudança de status (previous_quality diferente de quality_rating)
      const { data: historyData, error: historyError } = await supabase
        .from('waba_status_history')
        .select(`
          id,
          phone_number_id,
          quality_rating,
          previous_quality,
          changed_at
        `)
        .not('previous_quality', 'is', null)
        .order('changed_at', { ascending: false })
        .limit(50);

      if (historyError) throw historyError;
      if (!historyData || historyData.length === 0) return [];

      // Filtra apenas mudanças reais (previous != current)
      const realChanges = historyData.filter(
        h => h.previous_quality && h.previous_quality !== h.quality_rating
      );

      if (realChanges.length === 0) return [];

      // Busca informações dos números
      const numberIds = [...new Set(realChanges.map(h => h.phone_number_id))];
      const { data: numbersData, error: numbersError } = await supabase
        .from('waba_whatsapp_numbers')
        .select('id, custom_name, verified_name, display_phone_number, project_id')
        .in('id', numberIds);

      if (numbersError) throw numbersError;

      // Filtra por projetos do usuário
      const userNumbers = numbersData?.filter(n => projectIds.includes(n.project_id)) || [];
      const userNumberIds = new Set(userNumbers.map(n => n.id));

      // Busca nomes dos projetos
      const projectIdsFromNumbers = [...new Set(userNumbers.map(n => n.project_id))];
      const { data: projectsData, error: projectsError } = await supabase
        .from('waba_projects')
        .select('id, name')
        .in('id', projectIdsFromNumbers);

      if (projectsError) throw projectsError;

      const projectsMap = new Map(projectsData?.map(p => [p.id, p.name]) || []);
      const numbersMap = new Map(userNumbers.map(n => [n.id, n]));

      // Monta o resultado final
      const qualityOrder = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 };
      
      const changes: RecentStatusChange[] = realChanges
        .filter(h => userNumberIds.has(h.phone_number_id))
        .map(h => {
          const number = numbersMap.get(h.phone_number_id)!;
          const currentOrder = qualityOrder[h.quality_rating as keyof typeof qualityOrder] || 0;
          const previousOrder = qualityOrder[h.previous_quality as keyof typeof qualityOrder] || 0;
          
          return {
            id: h.id,
            phoneNumberId: h.phone_number_id,
            numberName: number.custom_name || number.verified_name || 'Número',
            displayPhoneNumber: number.display_phone_number,
            projectId: number.project_id,
            projectName: projectsMap.get(number.project_id) || 'Projeto',
            previousQuality: h.previous_quality as QualityRating,
            currentQuality: h.quality_rating as QualityRating,
            direction: (currentOrder > previousOrder ? 'up' : 'down') as 'up' | 'down',
            changedAt: h.changed_at,
          };
        })
        .slice(0, 50); // Limita a 50 mudanças recentes

      return changes;
    },
    enabled: !!projectIds && projectIds.length > 0,
  });
}
