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
  Search, Send, Loader2, MessageSquare, AlertTriangle, Check, CheckCheck,
  Clock, XCircle, Plus, Image as ImageIcon, Mic, FileText, Video, MapPin,
} from 'lucide-react';

const CHAVE_FILTRO = 'waba-chat-numeros-ocultos';

/** Cor por número, para bater o olho e saber de qual linha é a conversa. */
const CORES = [
  { ponto: 'bg-emerald-500', chip: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950', texto: 'text-emerald-700 dark:text-emerald-400' },
  { ponto: 'bg-violet-500',  chip: 'border-violet-500 bg-violet-50 dark:bg-violet-950',   texto: 'text-violet-700 dark:text-violet-400' },
  { ponto: 'bg-amber-500',   chip: 'border-amber-500 bg-amber-50 dark:bg-amber-950',      texto: 'text-amber-700 dark:text-amber-400' },
  { ponto: 'bg-sky-500',     chip: 'border-sky-500 bg-sky-50 dark:bg-sky-950',            texto: 'text-sky-700 dark:text-sky-400' },
  { ponto: 'bg-rose-500',    chip: 'border-rose-500 bg-rose-50 dark:bg-rose-950',         texto: 'text-rose-700 dark:text-rose-400' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const soDigitos = (v: string) => v.replace(/\D/g, '');

const formatarTelefone = (waId: string) => {
  const d = soDigitos(waId);
  if (d.length >= 12 && d.startsWith('55')) {
    const ddd = d.slice(2, 4);
    const resto = d.slice(4);
    const meio = resto.length > 8 ? resto.slice(0, resto.length - 4) : resto.slice(0, 4);
    return `+55 ${ddd} ${meio}-${resto.slice(-4)}`;
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
          <div className={cn(
            'flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide mb-1',
            meu ? 'text-primary-foreground/70' : 'text-muted-foreground',
          )}>
            {icone}{m.tipo}
          </div>
        )}

        {m.texto ? (
          <p className="text-sm whitespace-pre-wrap break-words">{m.texto}</p>
        ) : (
          <p className={cn('text-sm italic', meu ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
            (sem texto)
          </p>
        )}

        <div className={cn(
          'flex items-center gap-1 justify-end mt-1 text-[10px]',
          meu ? 'text-primary-foreground/70' : 'text-muted-foreground',
        )}>
          <span>{horaCurta(m.criadoEm)}</span>
          {meu && <IconeStatus status={m.status} erro={m.erro} />}
        </div>

        {m.erro && <p className="text-[10px] mt-1 text-destructive-foreground/90">{m.erro}</p>}
      </div>
    </div>
  );
};

// ─── Página ──────────────────────────────────────────────────────────────────

interface Selecionada { phoneNumberId: string; waId: string; }

const Chat = () => {
  const { data: numeros = [], isLoading: carregandoNumeros } = useNumerosDoChat();

  // Números desmarcados (ficam fora da caixa de entrada). Guardado só neste
  // navegador — é conveniência de visualização, não configuração do sistema.
  const [ocultos, setOcultos] = useState<Set<string>>(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_FILTRO);
      return salvo ? new Set(JSON.parse(salvo) as string[]) : new Set();
    } catch { return new Set(); }
  });

  const [sel, setSel] = useState<Selecionada | null>(null);
  const [busca, setBusca] = useState('');
  const [rascunho, setRascunho] = useState('');
  const [novoContato, setNovoContato] = useState('');
  const [abrindoNovo, setAbrindoNovo] = useState(false);

  const fimDaLista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem(CHAVE_FILTRO, JSON.stringify([...ocultos])); } catch { /* modo privado */ }
  }, [ocultos]);

  const corPorNumero = useMemo(() => {
    const mapa = new Map<string, typeof CORES[number]>();
    numeros.forEach((n, i) => mapa.set(n.phoneNumberId, CORES[i % CORES.length]));
    return mapa;
  }, [numeros]);

  const numeroPorId = useMemo(
    () => new Map(numeros.map(n => [n.phoneNumberId, n])),
    [numeros],
  );

  const visiveis = useMemo(
    () => numeros.filter(n => !ocultos.has(n.phoneNumberId)).map(n => n.phoneNumberId),
    [numeros, ocultos],
  );

  const { data: conversas = [], isLoading: carregandoConversas } = useConversas(visiveis);
  const { data: mensagens = [], isLoading: carregandoMensagens } =
    useMensagens(sel?.phoneNumberId ?? null, sel?.waId ?? null);
  const enviar = useEnviarMensagem();
  useChatRealtime();

  // Desmarcou o número da conversa aberta? Fecha a conversa.
  useEffect(() => {
    if (sel && ocultos.has(sel.phoneNumberId)) setSel(null);
  }, [ocultos, sel]);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens.length, sel]);

  const conversasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return conversas;
    return conversas.filter(c =>
      (c.contatoNome ?? '').toLowerCase().includes(termo) ||
      c.contatoWaId.includes(soDigitos(termo)),
    );
  }, [conversas, busca]);

  const conversaAtual = conversas.find(
    c => c.contatoWaId === sel?.waId && c.phoneNumberId === sel?.phoneNumberId,
  );
  const janela = restanteDaJanela(conversaAtual?.ultimaEntrada ?? null);
  const janelaFechada = !!sel && !janela;
  const numeroDaConversa: NumeroDoChat | undefined =
    sel ? numeroPorId.get(sel.phoneNumberId) : undefined;

  const alternarNumero = (phoneNumberId: string) => {
    setOcultos(atual => {
      const proximo = new Set(atual);
      if (proximo.has(phoneNumberId)) proximo.delete(phoneNumberId);
      else proximo.add(phoneNumberId);
      return proximo;
    });
  };

  const handleEnviar = async () => {
    const texto = rascunho.trim();
    if (!texto || !sel || !numeroDaConversa) return;
    try {
      await enviar.mutateAsync({ numero: numeroDaConversa, paraWaId: sel.waId, texto });
      setRascunho('');
    } catch (e) {
      toast.error(explicarErroDeEnvio(e));
    }
  };

  const handleNovaConversa = () => {
    const waId = soDigitos(novoContato);
    if (waId.length < 12) {
      toast.error('Informe o número com DDI e DDD. Ex.: +55 92 94687-8669');
      return;
    }
    const origem = numeros.find(n => !ocultos.has(n.phoneNumberId));
    if (!origem) {
      toast.error('Marque ao menos um número para poder enviar.');
      return;
    }
    setSel({ phoneNumberId: origem.phoneNumberId, waId });
    setNovoContato('');
    setAbrindoNovo(false);
  };

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

        {/* Filtro por número: desmarque para tirar da caixa de entrada */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">
            Números
          </span>
          {carregandoNumeros
            ? <Skeleton className="h-9 w-52" />
            : numeros.map(n => {
                const marcado = !ocultos.has(n.phoneNumberId);
                const cor = corPorNumero.get(n.phoneNumberId)!;
                return (
                  <label
                    key={n.phoneNumberId}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer select-none transition-colors',
                      marcado ? cor.chip : 'bg-card border-border opacity-55 hover:opacity-80',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => alternarNumero(n.phoneNumberId)}
                      className="w-3.5 h-3.5 accent-current cursor-pointer"
                    />
                    <span className={cn('w-2 h-2 rounded-full shrink-0', marcado ? cor.ponto : 'bg-muted-foreground/40')} />
                    <span className={cn('text-xs font-bold', marcado && cor.texto)}>{n.nome}</span>
                    <span className="text-[10px] text-muted-foreground">{n.telefone}</span>
                  </label>
                );
              })}
          {visiveis.length === 0 && (
            <span className="text-xs text-muted-foreground">
              Todos desmarcados — marque ao menos um.
            </span>
          )}
        </div>

        <div className="flex-1 flex min-h-0 rounded-xl border border-border overflow-hidden bg-card">

          {/* Caixa de entrada única */}
          <aside className="w-80 shrink-0 border-r border-border flex flex-col min-h-0">
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
                  variant="outline" size="sm"
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
                  {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : conversasFiltradas.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  {visiveis.length === 0
                    ? 'Marque um número acima para ver as conversas.'
                    : conversas.length === 0
                      ? 'Nenhuma conversa ainda. Elas aparecem sozinhas quando alguém escrever para estes números.'
                      : 'Nada encontrado.'}
                </div>
              ) : (
                conversasFiltradas.map(c => {
                  const ativa = c.contatoWaId === sel?.waId && c.phoneNumberId === sel?.phoneNumberId;
                  const aberta = !!restanteDaJanela(c.ultimaEntrada);
                  const cor = corPorNumero.get(c.phoneNumberId);
                  const origem = numeroPorId.get(c.phoneNumberId);
                  return (
                    <button
                      key={`${c.phoneNumberId}:${c.contatoWaId}`}
                      onClick={() => setSel({ phoneNumberId: c.phoneNumberId, waId: c.contatoWaId })}
                      className={cn(
                        'w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors flex gap-2',
                        ativa ? 'bg-primary/10' : 'hover:bg-muted/50',
                      )}
                    >
                      {/* Faixa de cor: identifica o número de destino */}
                      <span className={cn('w-1 rounded-full shrink-0 self-stretch', cor?.ponto ?? 'bg-muted')} />

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold truncate">
                            {c.contatoNome || formatarTelefone(c.contatoWaId)}
                          </span>
                          <span className="text-[9px] text-muted-foreground shrink-0">
                            {horaCurta(c.ultimaEm)}
                          </span>
                        </span>

                        <span className="flex items-center gap-1 mt-0.5">
                          {c.ultimaDirecao === 'out' && (
                            <span className="text-[9px] text-muted-foreground shrink-0">Você:</span>
                          )}
                          <span className="text-[11px] text-muted-foreground truncate">
                            {resumoConversa(c)}
                          </span>
                        </span>

                        <span className="flex items-center gap-1.5 mt-1">
                          <span className={cn('text-[9px] font-bold truncate', cor?.texto)}>
                            {origem?.nome ?? c.phoneNumberId}
                          </span>
                          {aberta && (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1.5 rounded-full shrink-0">
                              aberta
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Conversa */}
          <section className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950">
            {!sel ? (
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
                      {conversaAtual?.contatoNome || formatarTelefone(sel.waId)}
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      {formatarTelefone(sel.waId)}
                      <span className="text-muted-foreground/40">·</span>
                      <span className={cn('font-bold', corPorNumero.get(sel.phoneNumberId)?.texto)}>
                        por {numeroDaConversa?.nome ?? sel.phoneNumberId}
                      </span>
                    </p>
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
                      const mudouODia = !anterior ||
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
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar(); }
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
