import { useMemo } from 'react';
import { format } from 'date-fns';
import { Ban, AlertTriangle } from 'lucide-react';
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

  // Quando foi a última verificação de fato (a mais recente entre as contas).
  const ultimaVerificacao = useMemo(() => {
    const datas = Object.values(saudeWabas).map(c => c.checkedAt).filter(Boolean);
    return datas.length ? datas.sort().at(-1)! : null;
  }, [saudeWabas]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Bloqueios e banimentos verificados nos horários configurados — use
        "Atualizar Todos" para checar agora
        {ultimaVerificacao && (
          <> · última verificação em {format(new Date(ultimaVerificacao), "dd/MM 'às' HH:mm")}</>
        )}
      </p>

      {(numerosBloqueados.length > 0 || contasBloqueadas.length > 0) && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Ban className="w-4 h-4 text-destructive" />
            <h3 className="font-semibold text-destructive text-sm">Restrições detectadas na Meta</h3>
          </div>

          {numerosBloqueados.length > 0 && (
            <p className="text-sm text-foreground/80 mb-1">
              <strong>{numerosBloqueados.length} número(s) bloqueado(s):</strong>{' '}
              {numerosBloqueados
                .map(n => `${n.customName || n.verifiedName} (${rotuloStatusNumero(n.metaStatus)})`)
                .join(', ')}
            </p>
          )}

          {contasBloqueadas.map(c => (
            <p key={c.wabaId} className="text-sm text-foreground/80">
              <strong>{rotuloConta(c.wabaId, c.wabaName)}:</strong>{' '}
              {c.erroApi
                ? `a Meta recusou a consulta — possível BM banida ou token derrubado (${c.erroApi})`
                : c.errors.length > 0
                  ? c.errors.map(e => e.error_description).join(' · ')
                  : 'conta sem permissão de envio'}
            </p>
          ))}

          <p className="text-xs text-muted-foreground mt-2">
            Verifique em business.facebook.com/accountquality. Erro de pagamento se resolve
            atualizando o meio de pagamento da conta.
          </p>
        </div>
      )}

      {(numerosComAviso.length > 0 || contasComAviso.length > 0) && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h3 className="font-semibold text-warning text-sm">Avisos da Meta</h3>
          </div>

          {numerosComAviso.length > 0 && (
            <p className="text-sm text-foreground/80 mb-1">
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
            <p key={c.wabaId} className="text-sm text-foreground/80">
              <strong>{rotuloConta(c.wabaId, c.wabaName)}:</strong>{' '}
              {[
                c.canSendMessage === 'LIMITED' ? 'envio limitado' : null,
                c.accountReviewStatus && c.accountReviewStatus !== 'APPROVED'
                  ? `revisão ${c.accountReviewStatus.toLowerCase()}`
                  : null,
                ...c.warnings,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlertasSaudeMeta;
