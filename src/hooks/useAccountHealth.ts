import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MetaHealthError } from '@/services/metaApi';

/**
 * Saúde das contas na Meta.
 *
 * Por que existe: o app lia só `quality_rating`, que continua GREEN mesmo com o
 * número BANIDO — então número bloqueado aparecia como "🟢 Alta". Quem denuncia
 * o bloqueio é `status`/`name_status` (número) e `health_status` (WABA).
 */

export interface NumeroSaude {
  metaStatus: string | null;   // CONNECTED | BANNED | FLAGGED | RESTRICTED...
  nameStatus: string | null;   // APPROVED | DECLINED | PENDING_REVIEW...
  checkedAt: string | null;
}

export interface WabaSaude {
  wabaId: string;
  wabaName: string | null;
  status: string | null;
  accountReviewStatus: string | null;
  canSendMessage: string | null; // AVAILABLE | LIMITED | BLOCKED
  errors: MetaHealthError[];
  warnings: string[];
  checkedAt: string;
  /**
   * A Meta recusou a consulta. É o sintoma típico de BM banida: o token cai e a
   * chamada volta erro em vez de um health_status bonito. Antes esse caso era
   * descartado e a conta ficava verde para sempre.
   */
  erroApi: string | null;
  erroApiCodigo: number | null;
}

/** Conta sem poder enviar — ou que a Meta nem deixa consultar (impeditivo). */
export const contaBloqueada = (c: WabaSaude) => c.canSendMessage === 'BLOCKED' || !!c.erroApi;

/**
 * Conta com aviso: envio limitado, revisão pendente/reprovada ou qualquer
 * additional_info da Meta. Não impede o envio, mas merece olhar.
 */
export const contaComAviso = (c: WabaSaude) =>
  !contaBloqueada(c) &&
  (c.canSendMessage === 'LIMITED' ||
    c.warnings.length > 0 ||
    (!!c.accountReviewStatus && c.accountReviewStatus !== 'APPROVED'));

/** Número com aviso (em análise/limitado), sem estar bloqueado. */
export const numeroComAviso = (metaStatus?: string | null, nameStatus?: string | null) =>
  (!!metaStatus && ['RATE_LIMITED', 'PENDING', 'UNVERIFIED'].includes(metaStatus)) ||
  nameStatus === 'DECLINED' ||
  nameStatus === 'PENDING_REVIEW';

/** true quando o número não pode operar (banido/restrito/sinalizado). */
export const numeroBloqueado = (metaStatus?: string | null) =>
  !!metaStatus && ['BANNED', 'RESTRICTED', 'FLAGGED', 'DELETED'].includes(metaStatus);

/** Rótulo curto para exibir no badge. */
export const rotuloStatusNumero = (metaStatus?: string | null): string | null => {
  switch (metaStatus) {
    case 'BANNED': return 'Banido';
    case 'RESTRICTED': return 'Restrito';
    case 'FLAGGED': return 'Sinalizado';
    case 'RATE_LIMITED': return 'Limitado';
    case 'DELETED': return 'Excluído';
    case 'PENDING': return 'Pendente';
    case 'UNVERIFIED': return 'Não verificado';
    default: return null; // CONNECTED e afins não viram badge
  }
};

// ─── Leitura (do que já está salvo no banco) ─────────────────────────────────

/** Saúde das WABAs já verificadas, por waba_id. */
export function useWabaHealth() {
  return useQuery({
    queryKey: ['waba-health'],
    queryFn: async (): Promise<Record<string, WabaSaude>> => {
      const { data, error } = await supabase.from('waba_account_health').select('*');
      if (error) throw error;

      const mapa: Record<string, WabaSaude> = {};
      for (const r of data ?? []) {
        const row = r as Record<string, unknown>;
        mapa[row.waba_id as string] = {
          wabaId: row.waba_id as string,
          wabaName: (row.waba_name as string) ?? null,
          status: (row.status as string) ?? null,
          accountReviewStatus: (row.account_review_status as string) ?? null,
          canSendMessage: (row.can_send_message as string) ?? null,
          errors: (row.errors as MetaHealthError[]) ?? [],
          // "Your app is not subscribed to the message webhook": esperado — quem
          // recebe as mensagens é o app do fornecedor (DataCrazy), não o nosso.
          warnings: ((row.warnings as string[]) ?? []).filter(
            w => !/not subscribed to the message webhook/i.test(w)
          ),
          checkedAt: row.checked_at as string,
          erroApi: (row.erro_api as string) ?? null,
          erroApiCodigo: (row.erro_api_codigo as number) ?? null,
        };
      }
      return mapa;
    },
    staleTime: 60000,
  });
}

// ─── Verificação (consulta a Meta e salva) ───────────────────────────────────

/**
 * Pede uma verificação imediata. Usa o MESMO mecanismo do agendamento automático
 * (funções no banco + pg_net, nos horários configurados): cobre todas as contas, grava erro da
 * Meta como estado e os tokens não passam pelo navegador.
 *
 * Devolve quantas consultas foram disparadas; 0 = já havia uma em andamento.
 */
export function useVerificarSaude() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<number> => {
      const { data: disparadas, error } = await supabase.rpc('waba_saude_verificar_agora');
      if (error) throw error;

      if ((disparadas as number) > 0) {
        // As respostas da Meta chegam em segundos. Não há mais processamento
        // rodando o tempo todo no banco, então o próprio botão recolhe: uma
        // passada logo e outra para as respostas que atrasarem.
        for (const espera of [8000, 12000]) {
          await new Promise(resolve => setTimeout(resolve, espera));
          const { error: erroProcessar } = await supabase.rpc('waba_saude_processar_agora');
          if (erroProcessar) throw erroProcessar;
        }
      }

      return (disparadas as number) ?? 0;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['waba-health'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers-all'] });
    },
  });
}
