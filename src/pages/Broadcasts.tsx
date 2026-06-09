import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useBroadcastsReport, BroadcastReport } from '@/hooks/useBroadcastsReport';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search, Send, CheckCircle2, Clock, XCircle, AlertTriangle,
  Users, FileText, Phone, Building2, Megaphone, Tag, CalendarClock,
  Filter, X, ChevronDown, RotateCcw,
} from 'lucide-react';

// ─── Status ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  sent:       { label: 'Enviado',    color: 'text-green-700 bg-green-50 border-green-200',   icon: <CheckCircle2 className="w-3 h-3" /> },
  scheduled:  { label: 'Agendado',   color: 'text-blue-700 bg-blue-50 border-blue-200',      icon: <Clock className="w-3 h-3" /> },
  preparing:  { label: 'Preparando', color: 'text-yellow-700 bg-yellow-50 border-yellow-200',icon: <Clock className="w-3 h-3" /> },
  cancelled:  { label: 'Cancelado',  color: 'text-red-700 bg-red-50 border-red-200',         icon: <XCircle className="w-3 h-3" /> },
  failed:     { label: 'Falhou',     color: 'text-red-700 bg-red-100 border-red-300',        icon: <AlertTriangle className="w-3 h-3" /> },
};

const getStatus = (s: string) => STATUS_CONFIG[s] ?? { label: s, color: 'text-gray-600 bg-gray-50 border-gray-200', icon: <Clock className="w-3 h-3" /> };

// ─── Card ─────────────────────────────────────────────────────────────────────

function BroadcastCard({ b }: { b: BroadcastReport }) {
  const [expanded, setExpanded] = useState(false);
  const st = getStatus(b.status);

  const dateLabel = b.date
    ? format(new Date(b.date), "dd/MM/yyyy", { locale: ptBR })
    : '—';

  const timeLabel = b.time ? b.time.slice(0, 5) : '—';

  const numberLabel = b.numberCustomName || b.numberVerifiedName || b.displayPhoneNumber || '—';

  return (
    <div className={cn('border rounded-xl bg-card transition-shadow', expanded ? 'shadow-md' : 'hover:shadow-sm')}>
      {/* Header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Icon */}
        <div className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
          b.status === 'sent' ? 'bg-green-100' :
          b.status === 'scheduled' ? 'bg-blue-100' :
          b.status === 'cancelled' ? 'bg-red-100' : 'bg-muted'
        )}>
          <Send className={cn(
            'w-4 h-4',
            b.status === 'sent' ? 'text-green-600' :
            b.status === 'scheduled' ? 'text-blue-600' :
            b.status === 'cancelled' ? 'text-red-500' : 'text-muted-foreground'
          )} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <p className="font-semibold text-sm truncate">{b.listName ?? 'Sem nome'}</p>
            <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border shrink-0', st.color)}>
              {st.icon}{st.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {b.templateUsed && (
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <span className="font-mono">{b.templateUsed}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <strong className="text-foreground">{b.contactCount.toLocaleString('pt-BR')}</strong> contatos
            </span>
            <span className="flex items-center gap-1">
              <CalendarClock className="w-3 h-3" />
              {dateLabel} às {timeLabel}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
            {b.projectName && <span className="flex items-center gap-1"><Building2 className="w-2.5 h-2.5" />{b.projectName}</span>}
            {b.campaignName && <span className="flex items-center gap-1"><Megaphone className="w-2.5 h-2.5" />{b.campaignName}</span>}
            <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{numberLabel}</span>
            {b.displayPhoneNumber && b.numberCustomName && (
              <span className="text-muted-foreground/60">{b.displayPhoneNumber}</span>
            )}
          </div>
        </div>

        <ChevronDown className={cn('w-4 h-4 text-muted-foreground flex-shrink-0 mt-1 transition-transform', expanded && 'rotate-180')} />
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Detail label="Lista" value={b.listName} />
            <Detail label="Template" value={b.templateUsed} mono />
            <Detail label="Contatos" value={b.contactCount.toLocaleString('pt-BR')} />
            <Detail label="Data do disparo" value={`${dateLabel} às ${timeLabel}`} />
            {b.returnDate && <Detail label="Data de retorno" value={format(new Date(b.returnDate), "dd/MM/yyyy", { locale: ptBR })} />}
            <Detail label="Tipo de ação" value={b.actionTypeName} />
            <Detail label="Status" value={st.label} />
            <Detail label="Projeto" value={b.projectName} />
            <Detail label="Campanha" value={b.campaignName} />
            <Detail label="Número" value={numberLabel} />
            <Detail label="Telefone" value={b.displayPhoneNumber} />
            <Detail label="Criado em" value={format(new Date(b.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
          </div>

          {b.observations && (
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Observações</p>
              <p className="text-sm">{b.observations}</p>
            </div>
          )}

          {b.tags && b.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {b.tags.map((tag, i) => (
                <span key={i} className="flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full">
                  <Tag className="w-3 h-3" />{tag}
                </span>
              ))}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground font-mono">ID: {b.id}</p>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('text-sm mt-0.5', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Broadcasts() {
  const { data: broadcasts = [], isLoading } = useBroadcastsReport();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterProject, setFilterProject] = useState('ALL');
  const [filterTemplate, setFilterTemplate] = useState('ALL');
  const [filterAction, setFilterAction] = useState('ALL');

  // Unique values for filters
  const projects = useMemo(() => [...new Set(broadcasts.map(b => b.projectName).filter(Boolean))] as string[], [broadcasts]);
  const templates = useMemo(() => [...new Set(broadcasts.map(b => b.templateUsed).filter(Boolean))].sort() as string[], [broadcasts]);
  const actions = useMemo(() => [...new Set(broadcasts.map(b => b.actionTypeName).filter(Boolean))].sort() as string[], [broadcasts]);

  const filtered = useMemo(() => {
    return broadcasts.filter(b => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          b.listName?.toLowerCase().includes(q) ||
          b.templateUsed?.toLowerCase().includes(q) ||
          b.campaignName?.toLowerCase().includes(q) ||
          b.projectName?.toLowerCase().includes(q) ||
          b.numberCustomName?.toLowerCase().includes(q) ||
          b.displayPhoneNumber?.includes(q) ||
          b.observations?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterStatus !== 'ALL' && b.status !== filterStatus) return false;
      if (filterProject !== 'ALL' && b.projectName !== filterProject) return false;
      if (filterTemplate !== 'ALL' && b.templateUsed !== filterTemplate) return false;
      if (filterAction !== 'ALL' && b.actionTypeName !== filterAction) return false;
      return true;
    });
  }, [broadcasts, search, filterStatus, filterProject, filterTemplate, filterAction]);

  // Summary stats
  const totalContacts = filtered.reduce((s, b) => s + b.contactCount, 0);
  const sentCount = filtered.filter(b => b.status === 'sent').length;

  const hasFilters = search || filterStatus !== 'ALL' || filterProject !== 'ALL' || filterTemplate !== 'ALL' || filterAction !== 'ALL';

  const clearFilters = () => {
    setSearch(''); setFilterStatus('ALL'); setFilterProject('ALL');
    setFilterTemplate('ALL'); setFilterAction('ALL');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Send className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold">Disparos</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Histórico completo de todos os broadcasts realizados
            </p>
          </div>

          {/* Summary cards */}
          {!isLoading && (
            <div className="flex gap-3 flex-wrap">
              <div className="bg-card border rounded-xl px-4 py-2.5 text-center min-w-[90px]">
                <p className="text-2xl font-bold">{filtered.length}</p>
                <p className="text-xs text-muted-foreground">disparos</p>
              </div>
              <div className="bg-card border rounded-xl px-4 py-2.5 text-center min-w-[90px]">
                <p className="text-2xl font-bold text-green-600">{sentCount}</p>
                <p className="text-xs text-muted-foreground">enviados</p>
              </div>
              <div className="bg-card border rounded-xl px-4 py-2.5 text-center min-w-[110px]">
                <p className="text-2xl font-bold text-blue-600">{totalContacts.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-muted-foreground">contatos</p>
              </div>
            </div>
          )}
        </div>

        {/* Search + filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por lista, template, campanha, número..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

            {/* Status */}
            {(['ALL', 'sent', 'scheduled', 'preparing', 'cancelled'] as const).map(s => {
              const cfg = s === 'ALL' ? null : getStatus(s);
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                    filterStatus === s
                      ? s === 'ALL' ? 'bg-primary text-primary-foreground border-primary' : cfg?.color
                      : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                  )}
                >
                  {s === 'ALL' ? 'Todos' : cfg?.label}
                </button>
              );
            })}

            <div className="w-px h-4 bg-border" />

            {/* Project */}
            {projects.length > 1 && (
              <select
                value={filterProject}
                onChange={e => setFilterProject(e.target.value)}
                className="text-xs border rounded-full px-2.5 py-1 bg-background text-muted-foreground"
              >
                <option value="ALL">Todos os projetos</option>
                {projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}

            {/* Template */}
            {templates.length > 0 && (
              <select
                value={filterTemplate}
                onChange={e => setFilterTemplate(e.target.value)}
                className="text-xs border rounded-full px-2.5 py-1 bg-background text-muted-foreground font-mono"
              >
                <option value="ALL">Todos os templates</option>
                {templates.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}

            {/* Action type */}
            {actions.length > 0 && (
              <select
                value={filterAction}
                onChange={e => setFilterAction(e.target.value)}
                className="text-xs border rounded-full px-2.5 py-1 bg-background text-muted-foreground"
              >
                <option value="ALL">Todos os tipos</option>
                {actions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}

            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-center">
            <Send className="w-12 h-12 text-muted-foreground/30" />
            <p className="font-medium">{broadcasts.length === 0 ? 'Nenhum disparo registrado' : 'Nenhum resultado'}</p>
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-primary">
                <RotateCcw className="w-3.5 h-3.5" /> Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(b => <BroadcastCard key={b.id} b={b} />)}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
