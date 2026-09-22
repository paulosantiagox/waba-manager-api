import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Ban, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WhatsAppNumber } from '@/types';
import { useBusinessManagers } from '@/hooks/useBusinessManagers';
import {
  useWabaHealth, numeroBloqueado, rotuloStatusNumero,
  contaBloqueada, contaComAviso, numeroComAviso,
} from '@/hooks/useAccountHealth';

/**
 * Alertas de restrição da Meta (banimento, bloqueio, pagamento, avisos).
 *
 * Lê só o que já está salvo no banco — a verificação na Meta roda nos horários
 * configurados (botão "Horários") e pelo "Atualizar Todos". Não consulta nada
 * sozinho.
 */
const AlertasSaudeMeta = ({ numeros }: { numeros: WhatsAppNumber[] }) => {
  const { data: saudeWabas = {} } = useWabaHealth();
  const { data: bms = [] } = useBusinessManagers();

  // "Autoflix" sozinho não identifica a conta: várias WABAs têm esse nome.
  const bmDaWaba = useMemo(() => {
    const nomeBm = new Map(bms.map(b => [b.id, b.mainBmName]));
    const mapa = new Map<string, string>();
    for (const n of numeros) {
      if (n.businessManagerId && !mapa.has(n.wabaId)) {
        const nome = nomeBm.get(n.businessManagerId);
        if (nome) mapa.set(n.wabaId, nome);
      }
    }
    return mapa;
  }, [bms, numeros]);
  const rotuloConta = (wabaId: string, wabaName: string | null) =>
    `${wabaName ?? wabaId}${bmDaWaba.has(wabaId) ? ` · BM ${bmDaWaba.get(wabaId)}` : ''}`;

  // WABAs em uso: com pelo menos um número visível. As aposentadas (todos os
  // números ocultos) seguem sendo verificadas, mas não poluem o alerta.
  const wabasEmUso = useMemo(
    () => new Set(numeros.filter(n => n.isVisible).map(n => n.wabaId)),
    [numeros]
  );

  const numerosBloqueados = useMemo(
    () => numeros.filter(n => n.isVisible && numeroBloqueado(n.metaStatus)),
    [numeros]
  );
  const numerosComAviso = useMemo(
    () => numeros.filter(
      n => n.isVisible && !numeroBloqueado(n.metaStatus) && numeroComAviso(n.metaStatus, n.nameStatus)
    ),
    [numeros]
  );
  const contasBloqueadas = useMemo(
    () => Object.values(saudeWabas).filter(c => wabasEmUso.has(c.wabaId) && contaBloqueada(c)),
    [saudeWabas, wabasEmUso]
  );
  const contasComAviso = useMemo(
    () => Object.values(saudeWabas).filter(c => wabasEmUso.has(c.wabaId) && contaComAviso(c)),
    [saudeWabas, wabasEmUso]
  );

  // Fechado por padrão: o resumo de uma linha basta no dia a dia.
  const [aberto, setAberto] = useState<boolean>(() => {
    try { return localStorage.getItem('waba:alertas-meta-aberto') === '1'; } catch { return false; }
  });
  const alternar = () => {
    setAberto(v => {
      try { localStorage.setItem('waba:alertas-meta-aberto', v ? '0' : '1'); } catch { /* ignora */ }
      return !v;
    });
  };

  // Quando foi a última verificação de fato (a mais recente entre as contas).
  const ultimaVerificacao = useMemo(() => {
    const datas = Object.values(saudeWabas).map(c => c.checkedAt).filter(Boolean);
    return datas.length ? datas.sort().at(-1)! : null;
  }, [saudeWabas]);

  const temBloqueio = numerosBloqueados.length > 0 || contasBloqueadas.length > 0;
  const temAviso = numerosComAviso.length > 0 || contasComAviso.length > 0;

  const rodape = (
    <span className="text-muted-foreground">
      verificado nos horários configurados
      {ultimaVerificacao && <> · última em {format(new Date(ultimaVerificacao), "dd/MM 'às' HH:mm")}</>}
    </span>
  );

  if (!temBloqueio && !temAviso) {
    return <p className="text-xs">{rodape}</p>;
  }

  // Resumo de uma linha: só as contagens. O detalhe fica escondido.
  const partes: string[] = [];
  if (contasBloqueadas.length) partes.push(`${contasBloqueadas.length} conta(s) bloqueada(s)`);
  if (numerosBloqueados.length) partes.push(`${numerosBloqueados.length} número(s) bloqueado(s)`);
  if (numerosComAviso.length) partes.push(`${numerosComAviso.length} número(s) com pendência`);
  if (contasComAviso.length) partes.push(`${contasComAviso.length} conta(s) com aviso`);

  return (
    <div className={cn(
      'rounded-lg border text-xs',
      temBloqueio ? 'border-destructive/40 bg-destructive/5' : 'border-warning/40 bg-warning/5'
    )}>
      <button
        type="button"
        onClick={alternar}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        {temBloqueio
          ? <Ban className="w-3.5 h-3.5 text-destructive shrink-0" />
          : <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />}
        <span className={cn('font-semibold', temBloqueio ? 'text-destructive' : 'text-warning')}>
          Meta:
        </span>
        <span className="text-foreground/80 truncate">{partes.join(' · ')}</span>
        <span className="hidden sm:inline">{rodape}</span>
        <span className="ml-auto shrink-0 text-muted-foreground flex items-center gap-1">
          {aberto ? 'ocultar' : 'detalhes'}
          {aberto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
      </button>

      {aberto && (
        <div className="px-3 pb-3 space-y-3 text-sm">
          {temBloqueio && (
            <div className="space-y-1">
              {numerosBloqueados.length > 0 && (
                <p className="text-foreground/80">
                  <strong>{numerosBloqueados.length} número(s) bloqueado(s):</strong>{' '}
                  {numerosBloqueados
                    .map(n => `${n.customName || n.verifiedName} (${rotuloStatusNumero(n.metaStatus)})`)
                    .join(', ')}
                </p>
              )}
              {contasBloqueadas.map(c => (
                <p key={c.wabaId} className="text-foreground/80">
                  <strong>{rotuloConta(c.wabaId, c.wabaName)}:</strong>{' '}
                  {c.erroApi
                    ? `a Meta recusou a consulta — possível BM banida ou token derrubado (${c.erroApi})`
                    : c.errors.length > 0
                      ? c.errors.map(e => e.error_description).join(' · ')
                      : 'conta sem permissão de envio'}
                </p>
              ))}
              <p className="text-xs text-muted-foreground">
                Verifique em business.facebook.com/accountquality. Erro de pagamento se resolve
                atualizando o meio de pagamento da conta.
              </p>
            </div>
          )}

          {temAviso && (
            <div className="space-y-1">
              {numerosComAviso.length > 0 && (
                <p className="text-foreground/80">
                  <strong>{numerosComAviso.length} número(s) com pendência:</strong>{' '}
                  {numerosComAviso
                    .map(n => {
                      const motivo = rotuloStatusNumero(n.metaStatus)
                        ?? (n.nameStatus === 'DECLINED' ? 'nome reprovado' : 'nome em análise');
                      return `${n.customName || n.verifiedName} (${motivo})`;
                    })
                    .join(', ')}
                </p>
              )}
              {contasComAviso.map(c => (
                <p key={c.wabaId} className="text-foreground/80">
                  <strong>{rotuloConta(c.wabaId, c.wabaName)}:</strong>{' '}
                  {[
                    c.canSendMessage === 'LIMITED' ? 'envio limitado' : null,
                    c.accountReviewStatus && c.accountReviewStatus !== 'APPROVED'
                      ? `revisão ${c.accountReviewStatus.toLowerCase()}`
                      : null,
                    ...c.warnings,
                  ].filter(Boolean).join(' · ')}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlertasSaudeMeta;
