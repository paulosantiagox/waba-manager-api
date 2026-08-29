import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchNumberHealth, fetchWabaHealth, MetaHealthError } from '@/services/metaApi';

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
}

/** Conta sem poder enviar (impeditivo). */
export const contaBloqueada = (c: WabaSaude) => c.canSendMessage === 'BLOCKED';

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
          warnings: (row.warnings as string[]) ?? [],
          checkedAt: row.checked_at as string,
        };
      }
      return mapa;
    },
    staleTime: 60000,
  });
}

// ─── Verificação (consulta a Meta e salva) ───────────────────────────────────

interface ContaParaChecar {
  wabaId: string;
  accessToken: string;
}

interface NumeroParaChecar {
  id: string;             // id da linha em waba_whatsapp_numbers
  phoneNumberId: string;
  accessToken: string;
}

export interface ResultadoChecagem {
  numerosChecados: number;
  numerosBloqueados: number;
  wabasChecadas: number;
  wabasBloqueadas: number;
  falhas: number;
}

/**
 * Varre números e WABAs na Meta e grava o resultado. Falha em uma conta não
 * derruba as outras — só conta em `falhas`.
 */
export function useVerificarSaude() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      numeros,
      contas,
    }: {
      numeros: NumeroParaChecar[];
      contas: ContaParaChecar[];
    }): Promise<ResultadoChecagem> => {
      let falhas = 0;
      let numerosBloqueados = 0;
      let wabasBloqueadas = 0;
      const agora = new Date().toISOString();

      // 1) Status de cada número
      const numeroResultados = await Promise.all(
        numeros.map(async n => {
          try {
            const h = await fetchNumberHealth(n.phoneNumberId, n.accessToken);
            return { id: n.id, status: h.status ?? null, nameStatus: h.name_status ?? null };
          } catch {
            falhas++;
            return null;
          }
        })
      );

      for (const r of numeroResultados) {
        if (!r) continue;
        if (numeroBloqueado(r.status)) numerosBloqueados++;
        const { error } = await supabase
          .from('waba_whatsapp_numbers')
          .update({ meta_status: r.status, name_status: r.nameStatus, health_checked_at: agora })
          .eq('id', r.id);
        if (error) falhas++;
      }

      // 2) Saúde de cada WABA
      const linhas: Record<string, unknown>[] = [];
      await Promise.all(
        contas.map(async c => {
          try {
            const h = await fetchWabaHealth(c.wabaId, c.accessToken);
            if (h.canSendMessage === 'BLOCKED') wabasBloqueadas++;
            linhas.push({
              waba_id: h.id,
              waba_name: h.name ?? null,
              status: h.status ?? null,
              account_review_status: h.account_review_status ?? null,
              can_send_message: h.canSendMessage ?? null,
              errors: h.errors,
              warnings: h.warnings,
              checked_at: agora,
            });
          } catch {
            falhas++;
          }
        })
      );

      if (linhas.length > 0) {
        const { error } = await supabase
          .from('waba_account_health')
          .upsert(linhas, { onConflict: 'waba_id' });
        if (error) falhas++;
      }

      return {
        numerosChecados: numeroResultados.filter(Boolean).length,
        numerosBloqueados,
        wabasChecadas: linhas.length,
        wabasBloqueadas,
        falhas,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waba-health'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] });
      queryClient.invalidateQueries({ queryKey: ['all-whatsapp-numbers'] });
    },
  });
}
