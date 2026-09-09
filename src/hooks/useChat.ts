import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { enviarMensagemTexto, MetaEnvioError } from '@/services/metaApi';

/**
 * WABAs liberadas para o bate-papo. Hoje só a "AUTOFLIX TREINAMENTOS III"
 * (BM Hotel Marajo) — os 3 números pedidos. Para liberar outra, basta somar
 * o waba_id aqui; nada mais na tela precisa mudar.
 */
export const WABAS_DO_CHAT = ['1803384931026098'];

/** Janela de atendimento da Meta: 24h desde a última mensagem do cliente. */
export const JANELA_MS = 24 * 60 * 60 * 1000;

export interface NumeroDoChat {
  phoneNumberId: string;
  nome: string;
  telefone: string;
  wabaId: string;
  accessToken: string;
}

export interface Conversa {
  phoneNumberId: string;
  contatoWaId: string;
  contatoNome: string | null;
  ultimaMensagem: string | null;
  ultimoTipo: string;
  ultimaDirecao: 'in' | 'out';
  ultimaEm: string;
  ultimaEntrada: string | null;
}

export interface Mensagem {
  id: string;
  phoneNumberId: string;
  contatoWaId: string;
  contatoNome: string | null;
  direcao: 'in' | 'out';
  tipo: string;
  texto: string | null;
  midiaId: string | null;
  midiaMime: string | null;
  metaMessageId: string | null;
  status: string | null;
  erro: string | null;
  criadoEm: string;
}

function mapMensagem(r: Record<string, unknown>): Mensagem {
  return {
    id: r.id as string,
    phoneNumberId: r.phone_number_id as string,
    contatoWaId: r.contato_wa_id as string,
    contatoNome: (r.contato_nome as string) ?? null,
    direcao: r.direcao as 'in' | 'out',
    tipo: r.tipo as string,
    texto: (r.texto as string) ?? null,
    midiaId: (r.midia_id as string) ?? null,
    midiaMime: (r.midia_mime as string) ?? null,
    metaMessageId: (r.meta_message_id as string) ?? null,
    status: (r.status as string) ?? null,
    erro: (r.erro as string) ?? null,
    criadoEm: r.criado_em as string,
  };
}

/** Números liberados + o token da BM dona de cada um. */
export function useNumerosDoChat() {
  return useQuery({
    queryKey: ['chat-numeros', WABAS_DO_CHAT],
    queryFn: async (): Promise<NumeroDoChat[]> => {
      const { data, error } = await supabase
        .from('waba_whatsapp_numbers')
        .select('phone_number_id, display_phone_number, verified_name, custom_name, waba_id, business_manager_id')
        .in('waba_id', WABAS_DO_CHAT)
        .eq('is_visible', true)
        .order('custom_name');

      if (error) throw error;
      const numeros = data ?? [];
      if (numeros.length === 0) return [];

      const bmIds = [...new Set(numeros.map(n => n.business_manager_id).filter(Boolean))] as string[];
      const { data: bms, error: erroBm } = await supabase
        .from('waba_business_managers')
        .select('id, access_token')
        .in('id', bmIds);

      if (erroBm) throw erroBm;
      const tokenPorBm = new Map((bms ?? []).map(b => [b.id as string, b.access_token as string]));

      return numeros
        .map(n => ({
          phoneNumberId: n.phone_number_id as string,
          nome: (n.custom_name as string) || (n.verified_name as string),
          telefone: n.display_phone_number as string,
          wabaId: n.waba_id as string,
          accessToken: tokenPorBm.get(n.business_manager_id as string) ?? '',
        }))
        .filter(n => !!n.accessToken);
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Conversas de um número, mais recente primeiro. */
export function useConversas(phoneNumberId: string | null) {
  return useQuery({
    queryKey: ['chat-conversas', phoneNumberId],
    queryFn: async (): Promise<Conversa[]> => {
      const { data, error } = await supabase
        .from('waba_conversas')
        .select('*')
        .eq('phone_number_id', phoneNumberId)
        .order('ultima_em', { ascending: false });

      if (error) throw error;
      return (data ?? []).map((r: Record<string, unknown>) => ({
        phoneNumberId: r.phone_number_id as string,
        contatoWaId: r.contato_wa_id as string,
        contatoNome: (r.contato_nome as string) ?? null,
        ultimaMensagem: (r.ultima_mensagem as string) ?? null,
        ultimoTipo: r.ultimo_tipo as string,
        ultimaDirecao: r.ultima_direcao as 'in' | 'out',
        ultimaEm: r.ultima_em as string,
        ultimaEntrada: (r.ultima_entrada as string) ?? null,
      }));
    },
    enabled: !!phoneNumberId,
  });
}

/** Mensagens de uma conversa, em ordem cronológica. */
export function useMensagens(phoneNumberId: string | null, contatoWaId: string | null) {
  return useQuery({
    queryKey: ['chat-mensagens', phoneNumberId, contatoWaId],
    queryFn: async (): Promise<Mensagem[]> => {
      const { data, error } = await supabase
        .from('waba_mensagens')
        .select('*')
        .eq('phone_number_id', phoneNumberId)
        .eq('contato_wa_id', contatoWaId)
        .order('criado_em', { ascending: true })
        .limit(500);

      if (error) throw error;
      return (data ?? []).map(r => mapMensagem(r as Record<string, unknown>));
    },
    enabled: !!phoneNumberId && !!contatoWaId,
  });
}

/**
 * Recarrega conversa e lista quando o webhook grava algo novo.
 * Sem isso a mensagem recebida só apareceria ao recarregar a página.
 */
export function useChatRealtime(phoneNumberId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!phoneNumberId) return;

    const canal = supabase
      .channel(`chat-${phoneNumberId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waba_mensagens',
          filter: `phone_number_id=eq.${phoneNumberId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-mensagens'] });
          queryClient.invalidateQueries({ queryKey: ['chat-conversas', phoneNumberId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [phoneNumberId, queryClient]);
}

/** Envia na Meta e grava o que saiu, para a conversa ficar completa. */
export function useEnviarMensagem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      numero,
      paraWaId,
      texto,
    }: {
      numero: NumeroDoChat;
      paraWaId: string;
      texto: string;
    }) => {
      const { metaMessageId } = await enviarMensagemTexto(
        numero.phoneNumberId,
        numero.accessToken,
        paraWaId,
        texto,
      );

      const { error } = await supabase.from('waba_mensagens').insert({
        phone_number_id: numero.phoneNumberId,
        waba_id: numero.wabaId,
        contato_wa_id: paraWaId,
        direcao: 'out',
        tipo: 'text',
        texto,
        meta_message_id: metaMessageId || null,
        status: 'sent',
        enviado_por: user?.id ?? null,
      });

      // A mensagem JÁ saiu na Meta — falhar aqui é só perder o histórico local.
      if (error) console.error('mensagem enviada mas não gravada:', error);

      return metaMessageId;
    },
    onSuccess: (_dados, variaveis) => {
      queryClient.invalidateQueries({ queryKey: ['chat-mensagens'] });
      queryClient.invalidateQueries({ queryKey: ['chat-conversas', variaveis.numero.phoneNumberId] });
    },
  });
}

/** Traduz o erro da Meta para algo acionável em português. */
export function explicarErroDeEnvio(erro: unknown): string {
  if (erro instanceof MetaEnvioError) {
    if (erro.code === 131047) {
      return 'Fora da janela de 24h. O cliente precisa mandar uma mensagem primeiro, ou use um template aprovado.';
    }
    if (erro.code === 131026) {
      return 'Número não tem WhatsApp ou não pode receber mensagens.';
    }
    if (erro.code === 190) {
      return 'Token da BM expirou. Atualize o token nas configurações do projeto.';
    }
    if (erro.code === 131031 || erro.code === 368) {
      return 'Esta conta está bloqueada ou restrita pela Meta.';
    }
    return erro.message;
  }
  return erro instanceof Error ? erro.message : 'Erro desconhecido ao enviar';
}
