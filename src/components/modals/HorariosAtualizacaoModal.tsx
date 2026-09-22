import React, { useState, useEffect, useCallback, forwardRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Plus, Trash2, AlertCircle, CheckCircle, Loader2, Circle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useHorariosAtualizacao, useCriarHorario, useAtualizarHorario, useRemoverHorario,
  useExecucoesHoje, useUltimaExecucao,
} from '@/hooks/useHorariosAtualizacao';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAXIMO = 6;
const RECOMENDADO = 4;

/** "0630" → "06:30" enquanto digita. */
function formatarHora(valor: string): string {
  const d = valor.replace(/\D/g, '');
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2, 4)}`;
}

function horaValida(hora: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(hora)) return false;
  const [h, m] = hora.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

const CampoHora = forwardRef<HTMLInputElement, {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  className?: string;
}>(({ value, onChange, onBlur, className = '' }, ref) => {
  const ok = value === '' || horaValida(value);
  return (
    <div className="relative">
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        placeholder="HH:MM"
        value={value}
        onChange={e => onChange(formatarHora(e.target.value))}
        onBlur={onBlur}
        maxLength={5}
        className={`${className} ${!ok ? 'border-destructive focus-visible:ring-destructive' : ''}`}
      />
      {!ok && value !== '' && (
        <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
      )}
    </div>
  );
});
CampoHora.displayName = 'CampoHora';

type Estado = 'aguardando' | 'executado' | 'perdido' | 'proximo';

function minutosAgoraBrasilia(): number {
  const [h, m] = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date()).split(':').map(Number);
  return h * 60 + m;
}

function estadoDe(hora: string, executadas: Record<string, number>): Estado {
  if (executadas[hora]) return 'executado';
  const [h, m] = hora.split(':').map(Number);
  const diff = h * 60 + m - minutosAgoraBrasilia();
  if (diff >= 0 && diff <= 2) return 'proximo';
  if (diff > 2) return 'aguardando';
  // A rotina roda de 15 em 15 min; só é "perdido" depois dessa janela.
  return diff < -15 ? 'perdido' : 'proximo';
}

const INDICADOR: Record<Estado, { Icone: React.ElementType; cor: string; rotulo: string; anim?: string }> = {
  aguardando: { Icone: Circle, cor: 'text-muted-foreground', rotulo: 'Aguardando' },
  executado:  { Icone: CheckCircle, cor: 'text-green-500', rotulo: 'Executado' },
  perdido:    { Icone: AlertCircle, cor: 'text-orange-500', rotulo: 'Não executado' },
  proximo:    { Icone: Loader2, cor: 'text-blue-500', rotulo: 'Próximo', anim: 'animate-spin' },
};

export default function HorariosAtualizacaoModal({ open, onOpenChange }: Props) {
  const { data: horarios = [], isLoading } = useHorariosAtualizacao();
  const { data: executadas = {} } = useExecucoesHoje();
  const { data: ultima } = useUltimaExecucao();
  const criar = useCriarHorario();
  const atualizar = useAtualizarHorario();
  const remover = useRemoverHorario();

  const [novaHora, setNovaHora] = useState('12:00');
  const [editando, setEditando] = useState<Record<string, string>>({});
  const [, setTick] = useState(0);

  // Só o indicador visual muda a cada minuto; não consulta nada.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setTick(n => n + 1), 60000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    setEditando(Object.fromEntries(horarios.map(h => [h.id, h.hora])));
  }, [horarios]);

  const adicionar = useCallback(() => {
    if (horarios.length >= MAXIMO) return;
    if (!horaValida(novaHora)) {
      toast.error('Horário inválido. Use o formato HH:MM');
      return;
    }
    criar.mutate({ hora: novaHora, ordem: horarios.length + 1 }, {
      onSuccess: () => toast.success('Horário adicionado'),
    });
  }, [horarios.length, novaHora, criar]);

  const salvarEdicao = useCallback((id: string) => {
    const hora = editando[id];
    const atual = horarios.find(h => h.id === id);
    if (hora && horaValida(hora) && atual && atual.hora !== hora) {
      atualizar.mutate({ id, hora }, { onSuccess: () => toast.success('Horário atualizado') });
    }
  }, [editando, horarios, atualizar]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Horários de Atualização
          </DialogTitle>
          <DialogDescription>
            Vale para todos os projetos. Em cada horário o sistema consulta a qualidade dos
            números e verifica banimentos e bloqueios. Fuso de Brasília.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {ultima && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4" />
                <span>
                  Última execução: {formatDistanceToNow(new Date(ultima.executadaEm), { addSuffix: true, locale: ptBR })}
                  {ultima.horaBrasilia && <span className="ml-1">({ultima.horaBrasilia})</span>}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{ultima.numerosAtualizados} números</span>
            </div>
          )}

          {horarios.length > RECOMENDADO && (
            <Alert className="border-yellow-500/50 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-600 dark:text-yellow-400">
                Cada horário consulta a Meta para todos os números e contas. Recomendamos no
                máximo {RECOMENDADO} por dia.
              </AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {horarios.map((h, i) => {
                const { Icone, cor, rotulo, anim } = INDICADOR[estadoDe(h.hora, executadas)];
                const projetos = executadas[h.hora];
                return (
                  <div key={h.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <span className={`inline-flex items-center gap-1 w-28 shrink-0 ${cor}`} title={rotulo}>
                      <Icone className={`h-3 w-3 ${anim ?? ''}`} />
                      <span className="text-xs">
                        {rotulo}{projetos ? ` · ${projetos} proj.` : ''}
                      </span>
                    </span>
                    <span className="text-sm font-medium text-muted-foreground w-16">Horário {i + 1}</span>
                    <CampoHora
                      value={editando[h.id] ?? h.hora}
                      onChange={v => setEditando(prev => ({ ...prev, [h.id]: v }))}
                      onBlur={() => salvarEdicao(h.id)}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => remover.mutate(h.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}

              {horarios.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum horário configurado</p>
                  <p className="text-xs mt-1">Sem horários, nada roda sozinho — só pelo botão Atualizar</p>
                </div>
              )}
            </div>
          )}

          {horarios.length < MAXIMO && (
            <div className="flex items-center gap-3 pt-4 border-t">
              <CampoHora value={novaHora} onChange={setNovaHora} className="flex-1" />
              <Button onClick={adicionar} disabled={criar.isPending || !horaValida(novaHora)} className="gap-2">
                {criar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Adicionar
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center pt-4 border-t">
            Máximo de {MAXIMO} horários por dia · Recomendado: {RECOMENDADO}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
