import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Horários de atualização automática — uma configuração para o sistema todo.
 *
 * Valem tanto para a rotina de qualidade (edge function) quanto para a
 * verificação de banimento (pg_cron, recriado por trigger no banco a cada
 * mudança aqui). Antes era por projeto; a tabela antiga virou uma view que
 * espelha estes horários para cada projeto, então a rotina não mudou.
 */
export interface HorarioAtualizacao {
  id: string;
  hora: string; // HH:mm, fuso de Brasília
  ordem: number;
}

const CHAVE = ['horarios-atualizacao'];

export function useHorariosAtualizacao() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: async (): Promise<HorarioAtualizacao[]> => {
      const { data, error } = await supabase
        .from('waba_horarios_atualizacao')
        .select('id, hora, ordem')
        .order('hora');
      if (error) throw error;
      return (data ?? []) as HorarioAtualizacao[];
    },
  });
}

export function useCriarHorario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hora, ordem }: { hora: string; ordem: number }) => {
      const { error } = await supabase.from('waba_horarios_atualizacao').insert({ hora, ordem });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE }),
    onError: (e: { code?: string }) => {
      toast.error(e.code === '23505' ? 'Esse horário já existe' : 'Erro ao adicionar horário');
    },
  });
}

export function useAtualizarHorario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, hora }: { id: string; hora: string }) => {
      const { error } = await supabase.from('waba_horarios_atualizacao').update({ hora }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE }),
    onError: (e: { code?: string }) => {
      toast.error(e.code === '23505' ? 'Esse horário já existe' : 'Erro ao atualizar horário');
    },
  });
}

export function useRemoverHorario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('waba_horarios_atualizacao').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVE });
      toast.success('Horário removido');
    },
    onError: () => toast.error('Erro ao remover horário'),
  });
}

// ─── Execuções (para mostrar o que já rodou hoje) ────────────────────────────

/** Data de hoje em Brasília, no formato que a rotina grava (YYYY-MM-DD). */
const hojeBrasilia = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

/** Horários que já rodaram hoje → quantos projetos foram atualizados. */
export function useExecucoesHoje() {
  return useQuery({
    queryKey: ['execucoes-hoje', hojeBrasilia()],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from('waba_project_schedule_executions')
        .select('schedule_time')
        .eq('execution_date', hojeBrasilia());
      if (error) throw error;

      const porHora: Record<string, number> = {};
      for (const r of data ?? []) {
        const hora = r.schedule_time as string;
        porHora[hora] = (porHora[hora] ?? 0) + 1;
      }
      return porHora;
    },
  });
}

export interface UltimaExecucao {
  executadaEm: string;
  horaBrasilia: string | null;
  numerosAtualizados: number;
}

export function useUltimaExecucao() {
  return useQuery({
    queryKey: ['ultima-execucao'],
    queryFn: async (): Promise<UltimaExecucao | null> => {
      const { data, error } = await supabase
        .from('waba_project_schedule_executions')
        .select('executed_at, brasilia_time, numbers_updated')
        .order('executed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return {
        executadaEm: data.executed_at as string,
        horaBrasilia: (data.brasilia_time as string) ?? null,
        numerosAtualizados: (data.numbers_updated as number) ?? 0,
      };
    },
  });
}
