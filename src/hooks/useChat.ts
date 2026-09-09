import { useEffect, useState } from 'react';
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
  /** Quando começou a espera. Null = já respondemos, nada pendente. */
  aguardandoDesde: string | null;
  /** Mensagens recebidas depois da nossa última resposta. */
  naoRespondidas: number;
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

/**
 * Conversas de um ou mais números, mais recente primeiro. Passando vários,
 * as conversas dos três aparecem misturadas numa caixa de entrada só.
 */
export function useConversas(phoneNumberIds: string[]) {
  return useQuery({
    queryKey: ['chat-conversas', [...phoneNumberIds].sort()],
    queryFn: async (): Promise<Conversa[]> => {
      const { data, error } = await supabase
        .from('waba_conversas')
        .select('*')
        .in('phone_number_id', phoneNumberIds)
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
        aguardandoDesde: (r.aguardando_desde as string) ?? null,
        naoRespondidas: (r.nao_respondidas as number) ?? 0,
      }));
    },
    enabled: phoneNumberIds.length > 0,
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
export function useChatRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Sem filtro por número: a caixa de entrada é compartilhada e a RLS já
    // limita o que este usuário enxerga.
    const canal = supabase
      .channel('chat-waba-mensagens')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waba_mensagens' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-mensagens'] });
          queryClient.invalidateQueries({ queryKey: ['chat-conversas'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [queryClient]);
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

/**
 * Relógio que avança sozinho, para o tempo de espera correr na tela sem
 * depender de recarregar. Devolve o instante atual em milissegundos.
 */
export function useAgora(intervaloMs = 1000): number {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(t);
  }, [intervaloMs]);

  return agora;
}

/** "45s", "12min 30s", "3h 12min", "2d 4h" — o que fizer sentido na escala. */
export function formatarEspera(desde: string, agora: number): string {
  const seg = Math.max(0, Math.floor((agora - new Date(desde).getTime()) / 1000));
  if (seg < 60) return `${seg}s`;

  const min = Math.floor(seg / 60);
  if (min < 60) return `${min}min ${seg % 60}s`;

  const horas = Math.floor(min / 60);
  if (horas < 24) return `${horas}h ${min % 60}min`;

  return `${Math.floor(horas / 24)}d ${horas % 24}h`;
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
