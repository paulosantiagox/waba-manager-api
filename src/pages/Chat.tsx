import { useState, useEffect, useRef, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  useNumerosDoChat,
  useConversas,
  useMensagens,
  useEnviarMensagem,
  useChatRealtime,
  explicarErroDeEnvio,
  JANELA_MS,
  NumeroDoChat,
  Conversa,
  Mensagem,
} from '@/hooks/useChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Phone, Search, Send, Loader2, MessageSquare, AlertTriangle,
  Check, CheckCheck, Clock, XCircle, Plus, Image as ImageIcon,
  Mic, FileText, Video, MapPin,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const soDigitos = (v: string) => v.replace(/\D/g, '');

/** +55 92 94687-8669 → 5592946878669 */
const paraWaId = (telefone: string) => soDigitos(telefone);

const formatarTelefone = (waId: string) => {
  const d = soDigitos(waId);
  if (d.length >= 12 && d.startsWith('55')) {
    const ddd = d.slice(2, 4);
    const resto = d.slice(4);
    const meio = resto.length > 8 ? resto.slice(0, resto.length - 4) : resto.slice(0, 4);
    const fim = resto.slice(-4);
    return `+55 ${ddd} ${meio}-${fim}`;
  }
  return `+${d}`;
};

const horaCurta = (iso: string) => format(new Date(iso), 'HH:mm');

const diaLegivel = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, "d 'de' MMMM", { locale: ptBR });
};

const ICONE_TIPO: Record<string, React.ReactNode> = {
  image: <ImageIcon className="w-3 h-3" />,
  audio: <Mic className="w-3 h-3" />,
  video: <Video className="w-3 h-3" />,
  document: <FileText className="w-3 h-3" />,
  sticker: <ImageIcon className="w-3 h-3" />,
  location: <MapPin className="w-3 h-3" />,
};

const resumoConversa = (c: Conversa) => {
  if (c.ultimaMensagem) return c.ultimaMensagem;
  const rotulos: Record<string, string> = {
    image: 'Imagem', audio: 'Áudio', video: 'Vídeo',
    document: 'Documento', sticker: 'Figurinha', location: 'Localização',
  };
  return rotulos[c.ultimoTipo] ?? 'Mensagem';
};

/** Quanto falta da janela de 24h; null quando já fechou ou nunca abriu. */
const restanteDaJanela = (ultimaEntrada: string | null): string | null => {
  if (!ultimaEntrada) return null;
  const restante = new Date(ultimaEntrada).getTime() + JANELA_MS - Date.now();
  if (restante <= 0) return null;
  const horas = Math.floor(restante / 3_600_000);
  const minutos = Math.floor((restante % 3_600_000) / 60_000);
  return horas > 0 ? `${horas}h${minutos.toString().padStart(2, '0')}` : `${minutos}min`;
};

const IconeStatus = ({ status, erro }: { status: string | null; erro: string | null }) => {
  if (erro || status === 'failed') return <XCircle className="w-3 h-3 text-destructive" />;
  if (status === 'read') return <CheckCheck className="w-3 h-3 text-sky-500" />;
  if (status === 'delivered') return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
  if (status === 'sent') return <Check className="w-3 h-3 text-muted-foreground" />;
  return <Clock className="w-3 h-3 text-muted-foreground/60" />;
};

// ─── Bolha ───────────────────────────────────────────────────────────────────

const Bolha = ({ m }: { m: Mensagem }) => {
  const meu = m.direcao === 'out';
  const icone = ICONE_TIPO[m.tipo];

  return (
    <div className={cn('flex px-4', meu ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3 py-2 shadow-sm',
          meu
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-white dark:bg-slate-800 border border-border rounded-bl-sm',
        )}
      >
        {icone && (
          <div
            className={cn(
              'flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide mb-1',
              meu ? 'text-primary-foreground/70' : 'text-muted-foreground',
            )}
          >
            {icone}
            {m.tipo}
          </div>
        )}

        {m.texto ? (
          <p className="text-sm whitespace-pre-wrap break-words">{m.texto}</p>
        ) : (
          <p className={cn('text-sm italic', meu ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
            (sem texto)
          </p>
        )}

        <div
          className={cn(
            'flex items-center gap-1 justify-end mt-1 text-[10px]',
            meu ? 'text-primary-foreground/70' : 'text-muted-foreground',
          )}
        >
          <span>{horaCurta(m.criadoEm)}</span>
          {meu && <IconeStatus status={m.status} erro={m.erro} />}
        </div>

        {m.erro && <p className="text-[10px] mt-1 text-destructive-foreground/90">{m.erro}</p>}
      </div>
    </div>
  );
};

// ─── Página ──────────────────────────────────────────────────────────────────

const Chat = () => {
  const { data: numeros = [], isLoading: carregandoNumeros } = useNumerosDoChat();
  const [numeroId, setNumeroId] = useState<string | null>(null);
  const [contato, setContato] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [rascunho, setRascunho] = useState('');
  const [novoContato, setNovoContato] = useState('');
  const [abrindoNovo, setAbrindoNovo] = useState(false);

  const fimDaLista = useRef<HTMLDivElement>(null);

  // Seleciona o primeiro número assim que a lista chega.
  useEffect(() => {
    if (!numeroId && numeros.length > 0) setNumeroId(numeros[0].phoneNumberId);
  }, [numeros, numeroId]);

  const numero: NumeroDoChat | undefined = numeros.find(n => n.phoneNumberId === numeroId);

  const { data: conversas = [], isLoading: carregandoConversas } = useConversas(numeroId);
  const { data: mensagens = [], isLoading: carregandoMensagens } = useMensagens(numeroId, contato);
  const enviar = useEnviarMensagem();
  useChatRealtime(numeroId);

  // Ao trocar de número, a conversa aberta não faz mais sentido.
  useEffect(() => { setContato(null); }, [numeroId]);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens.length, contato]);

  const conversasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return conversas;
    return conversas.filter(
      c =>
        (c.contatoNome ?? '').toLowerCase().includes(termo) ||
        c.contatoWaId.includes(soDigitos(termo)),
    );
  }, [conversas, busca]);

  const conversaAtual = conversas.find(c => c.contatoWaId === contato);
  const janela = restanteDaJanela(conversaAtual?.ultimaEntrada ?? null);
  // Conversa nova (aberta manualmente) ainda não tem histórico de entrada.
  const janelaFechada = !!contato && !janela;

  const handleEnviar = async () => {
    const texto = rascunho.trim();
    if (!texto || !numero || !contato) return;

    try {
      await enviar.mutateAsync({ numero, paraWaId: contato, texto });
      setRascunho('');
    } catch (e) {
      toast.error(explicarErroDeEnvio(e));
    }
  };

  const handleNovaConversa = () => {
    const waId = paraWaId(novoContato);
    if (waId.length < 12) {
      toast.error('Informe o número com DDI e DDD. Ex.: +55 92 94687-8669');
      return;
    }
    setContato(waId);
    setNovoContato('');
    setAbrindoNovo(false);
  };

  // ── Estados vazios ────────────────────────────────────────────────────────
  if (!carregandoNumeros && numeros.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[70vh] text-center gap-3">
          <MessageSquare className="w-10 h-10 text-muted-foreground/40" />
          <h2 className="text-lg font-bold">Nenhum número liberado</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            O bate-papo está limitado à WABA AUTOFLIX TREINAMENTOS III. Se os números
            sumiram, confira se continuam visíveis no projeto.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-7rem)]">
        {/* Seletor de número de origem */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">
            Enviando por
          </span>
          {carregandoNumeros
            ? <Skeleton className="h-9 w-48" />
            : numeros.map(n => (
                <button
                  key={n.phoneNumberId}
                  onClick={() => setNumeroId(n.phoneNumberId)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left transition-colors',
                    n.phoneNumberId === numeroId
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border hover:border-primary/40',
                  )}
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-bold">{n.nome}</span>
                  <span
                    className={cn(
                      'text-[10px]',
                      n.phoneNumberId === numeroId ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}
                  >
                    {n.telefone}
                  </span>
                </button>
              ))}
        </div>

        <div className="flex-1 flex min-h-0 rounded-xl border border-border overflow-hidden bg-card">
          {/* Lista de conversas */}
          <aside className="w-72 shrink-0 border-r border-border flex flex-col min-h-0">
            <div className="p-2.5 border-b border-border space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar conversa"
                  className="pl-8 h-8 text-xs"
                />
              </div>

              {abrindoNovo ? (
                <div className="flex gap-1">
                  <Input
                    autoFocus
                    value={novoContato}
                    onChange={e => setNovoContato(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleNovaConversa()}
                    placeholder="+55 92 94687-8669"
                    className="h-8 text-xs"
                  />
                  <Button size="sm" className="h-8 px-2" onClick={handleNovaConversa}>OK</Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs gap-1.5"
                  onClick={() => setAbrindoNovo(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nova conversa
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {carregandoConversas ? (
                <div className="p-2 space-y-2">
                  {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : conversasFiltradas.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  {conversas.length === 0
                    ? 'Nenhuma conversa ainda. Elas aparecem sozinhas quando alguém escrever para este número.'
                    : 'Nada encontrado.'}
                </div>
              ) : (
                conversasFiltradas.map(c => {
                  const ativa = c.contatoWaId === contato;
                  const aberta = !!restanteDaJanela(c.ultimaEntrada);
                  return (
                    <button
                      key={c.contatoWaId}
                      onClick={() => setContato(c.contatoWaId)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors',
                        ativa ? 'bg-primary/10' : 'hover:bg-muted/50',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold truncate">
                          {c.contatoNome || formatarTelefone(c.contatoWaId)}
                        </span>
                        <span className="text-[9px] text-muted-foreground shrink-0">
                          {horaCurta(c.ultimaEm)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {c.ultimaDirecao === 'out' && (
                          <span className="text-[9px] text-muted-foreground shrink-0">Você:</span>
                        )}
                        <span className="text-[11px] text-muted-foreground truncate">
                          {resumoConversa(c)}
                        </span>
                      </div>
                      {aberta && (
                        <span className="inline-block mt-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded-full">
                          janela aberta
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Conversa */}
          <section className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950">
            {!contato ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
                <MessageSquare className="w-10 h-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Escolha uma conversa à esquerda ou comece uma nova.
                </p>
              </div>
            ) : (
              <>
                <header className="px-4 py-2.5 border-b border-border bg-card flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">
                      {conversaAtual?.contatoNome || formatarTelefone(contato)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatarTelefone(contato)}</p>
                  </div>
                  {janela ? (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-1 rounded-full shrink-0">
                      janela aberta · {janela}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950 px-2 py-1 rounded-full shrink-0">
                      janela fechada
                    </span>
                  )}
                </header>

                <div className="flex-1 overflow-y-auto py-3 space-y-2">
                  {carregandoMensagens ? (
                    <div className="px-4 space-y-2">
                      {[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-1/2" />)}
                    </div>
                  ) : mensagens.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-8">
                      Sem mensagens nesta conversa.
                    </p>
                  ) : (
                    mensagens.map((m, i) => {
                      const anterior = mensagens[i - 1];
                      const mudouODia =
                        !anterior ||
                        new Date(anterior.criadoEm).toDateString() !== new Date(m.criadoEm).toDateString();
                      return (
                        <div key={m.id} className="space-y-2">
                          {mudouODia && (
                            <div className="flex justify-center">
                              <span className="text-[10px] font-medium text-muted-foreground bg-card border border-border px-2 py-0.5 rounded-full">
                                {diaLegivel(m.criadoEm)}
                              </span>
                            </div>
                          )}
                          <Bolha m={m} />
                        </div>
                      );
                    })
                  )}
                  <div ref={fimDaLista} />
                </div>

                {janelaFechada && (
                  <div className="flex items-start gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                      Passaram-se mais de 24h desde a última mensagem do cliente. A Meta só
                      aceita <strong>template aprovado</strong> agora — texto livre vai ser recusado.
                    </p>
                  </div>
                )}

                <footer className="p-3 border-t border-border bg-card flex items-end gap-2">
                  <Textarea
                    value={rascunho}
                    onChange={e => setRascunho(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleEnviar();
                      }
                    }}
                    placeholder="Escreva uma mensagem…  (Enter envia, Shift+Enter quebra linha)"
                    className="min-h-[42px] max-h-32 text-sm resize-none"
                    rows={1}
                  />
                  <Button
                    onClick={handleEnviar}
                    disabled={!rascunho.trim() || enviar.isPending}
                    className="h-[42px] px-4 shrink-0 gap-2"
                  >
                    {enviar.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Send className="w-4 h-4" />}
                    Enviar
                  </Button>
                </footer>
              </>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Chat;
