import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useBroadcastsReport, BroadcastReport } from '@/hooks/useBroadcastsReport';
import { useTemplateLibrary, TemplateLibraryItem } from '@/hooks/useTemplateLibrary';
import { useWabaAccounts } from '@/hooks/useWabaTemplates';
import TemplateCreatorDrawer, { TemplateInitialValues } from '@/components/templates/TemplateCreatorDrawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search, Send, CheckCircle2, Clock, XCircle, AlertTriangle,
  Users, FileText, Phone, Building2, Megaphone, Tag, CalendarClock,
  Filter, X, ChevronDown, RotateCcw, Copy, Eye,
  MessageSquare, Image, Video, File, Link2, PhoneCall,
} from 'lucide-react';

// ─── Status ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  sent:       { label: 'Enviado',    color: 'text-green-700 bg-green-50 border-green-200',    icon: <CheckCircle2 className="w-3 h-3" /> },
  scheduled:  { label: 'Agendado',   color: 'text-blue-700 bg-blue-50 border-blue-200',       icon: <Clock className="w-3 h-3" /> },
  preparing:  { label: 'Preparando', color: 'text-yellow-700 bg-yellow-50 border-yellow-200', icon: <Clock className="w-3 h-3" /> },
  cancelled:  { label: 'Cancelado',  color: 'text-red-700 bg-red-50 border-red-200',          icon: <XCircle className="w-3 h-3" /> },
  failed:     { label: 'Falhou',     color: 'text-red-700 bg-red-100 border-red-300',         icon: <AlertTriangle className="w-3 h-3" /> },
};
const getStatus = (s: string) =>
  STATUS_CONFIG[s] ?? { label: s, color: 'text-gray-600 bg-gray-50 border-gray-200', icon: <Clock className="w-3 h-3" /> };

const CAT_COLOR: Record<string, string> = {
  MARKETING:      'text-purple-700 bg-purple-50 border-purple-200',
  UTILITY:        'text-blue-700 bg-blue-50 border-blue-200',
  AUTHENTICATION: 'text-gray-700 bg-gray-50 border-gray-200',
};
const CAT_LABEL: Record<string, string> = {
  MARKETING: 'Marketing', UTILITY: 'Utilidade', AUTHENTICATION: 'Autenticação',
};
const TMPL_STATUS_COLOR: Record<string, string> = {
  APPROVED: 'text-green-700 bg-green-50 border-green-200',
  PENDING:  'text-yellow-700 bg-yellow-50 border-yellow-200',
  REJECTED: 'text-red-700 bg-red-50 border-red-200',
  PAUSED:   'text-orange-700 bg-orange-50 border-orange-200',
  DISABLED: 'text-gray-500 bg-gray-50 border-gray-200',
};
const TMPL_STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Aprovado', PENDING: 'Pendente', REJECTED: 'Rejeitado',
  PAUSED: 'Pausado', DISABLED: 'Desativado', IN_APPEAL: 'Em recurso',
};

// ─── Build initial values from library item ───────────────────────────────────

function buildInitialValues(item: TemplateLibraryItem): TemplateInitialValues {
  const header = item.components.find(c => c.type === 'HEADER');
  const body   = item.components.find(c => c.type === 'BODY');
  const footer = item.components.find(c => c.type === 'FOOTER');
  const btns   = item.components.find(c => c.type === 'BUTTONS');
  const bodyExamples = body?.example?.body_text?.[0] ?? [];

  return {
    name: item.templateName,
    category: item.category as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION',
    language: item.language,
    headerEnabled: !!header,
    headerFormat: (header?.format ?? 'TEXT') as 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT',
    headerText: header?.format === 'TEXT' ? (header.text ?? '') : '',
    headerExample: header?.example?.header_text?.[0] ?? '',
    headerMediaUrl: header?.example?.header_handle?.[0] ?? '',
    body: body?.text ?? '',
    bodyExamples: bodyExamples.map(v => ({ value: v })),
    footerEnabled: !!footer,
    footerText: footer?.text ?? '',
    buttonsEnabled: !!btns && (btns.buttons?.length ?? 0) > 0,
    buttons: (btns?.buttons ?? []).map(b => ({
      type: b.type as 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER',
      text: b.text,
      url: b.url,
      phone_number: b.phone_number,
    })),
  };
}

// ─── Template Modal ───────────────────────────────────────────────────────────

function TemplateModal({
  templateName,
  libraryMap,
  onUseAsTemplate,
  open,
  onClose,
}: {
  templateName: string;
  libraryMap: Map<string, TemplateLibraryItem>;
  onUseAsTemplate: (values: TemplateInitialValues) => void;
  open: boolean;
  onClose: () => void;
}) {
  // Find best match: exact name, or first match containing the name
  const item = libraryMap.get(templateName) ??
    [...libraryMap.values()].find(i => i.templateName.startsWith(templateName.replace(/_\d+$/, '')));

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Template: <span className="font-mono">{templateName}</span>
          </DialogTitle>
        </DialogHeader>

        {!item ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/30" />
            <p className="font-medium">Template não encontrado na biblioteca</p>
            <p className="text-sm text-muted-foreground">
              Sincronize a biblioteca em <strong>Templates → Modelos</strong> para carregar os dados.
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-4 pr-1">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border',
                TMPL_STATUS_COLOR[item.status] ?? 'text-gray-600 bg-gray-50 border-gray-200')}>
                <CheckCircle2 className="w-3 h-3" />
                {TMPL_STATUS_LABEL[item.status] ?? item.status}
              </span>
              <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', CAT_COLOR[item.category] ?? '')}>
                {CAT_LABEL[item.category] ?? item.category}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border font-medium">
                {item.language}
              </span>
              {item.hasVariables && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                  {item.variableCount} variável(is)
                </span>
              )}
              {item.buttonCount > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border">
                  {item.buttonCount} botão(ões)
                </span>
              )}
            </div>

            {/* WhatsApp Preview */}
            <div className="bg-[#e5ddd5] rounded-xl p-3">
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Header */}
                {item.headerText && (
                  <div className="px-3 pt-3 pb-2 border-b border-gray-100">
                    <p className="font-semibold text-sm">{item.headerText}</p>
                  </div>
                )}
                {item.headerType && item.headerType !== 'TEXT' && (
                  <div className="px-3 pt-3 pb-2 border-b border-gray-100 flex items-center gap-2 text-xs text-muted-foreground">
                    {item.headerType === 'IMAGE' ? <Image className="w-4 h-4" /> :
                     item.headerType === 'VIDEO' ? <Video className="w-4 h-4" /> :
                     <File className="w-4 h-4" />}
                    <span className="font-medium">{item.headerType}</span>
                    {item.headerMediaUrl && (
                      <a href={item.headerMediaUrl} target="_blank" rel="noopener noreferrer"
                         className="text-blue-500 underline truncate max-w-[250px]">
                        {item.headerMediaUrl}
                      </a>
                    )}
                  </div>
                )}
                {/* Body */}
                {item.bodyText && (
                  <div className="px-3 py-3">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{item.bodyText}</p>
                  </div>
                )}
                {/* Footer */}
                {item.footerText && (
                  <div className="px-3 pb-2.5">
                    <p className="text-xs text-gray-400">{item.footerText}</p>
                  </div>
                )}
                {/* Buttons */}
                {item.buttons.length > 0 && (
                  <div className="border-t border-gray-100">
                    {item.buttons.map((btn, i) => (
                      <div key={i} className="flex items-center justify-center gap-1.5 py-2.5 border-b border-gray-50 last:border-0">
                        {btn.type === 'URL' ? <Link2 className="w-3.5 h-3.5 text-blue-400" /> :
                         btn.type === 'PHONE_NUMBER' ? <PhoneCall className="w-3.5 h-3.5 text-blue-400" /> :
                         <MessageSquare className="w-3.5 h-3.5 text-blue-400" />}
                        <span className="text-xs font-semibold text-blue-500">{btn.text}</span>
                        {btn.url && <span className="text-[10px] text-gray-400 truncate max-w-[150px]">{btn.url}</span>}
                        {btn.phone_number && <span className="text-[10px] text-gray-400">{btn.phone_number}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Variable examples */}
            {item.hasVariables && item.bodyExamples.length > 0 && item.bodyExamples[0]?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-800 mb-2">Exemplos das variáveis (para aprovação)</p>
                <div className="space-y-1.5">
                  {item.bodyExamples[0].map((ex, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-amber-700 w-10 shrink-0">{`{{${i + 1}}}`}</span>
                      <span className="bg-white border border-amber-200 px-2 py-0.5 rounded text-amber-900">{ex}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Header example */}
            {item.headerExample && (
              <div className="text-xs bg-muted/40 rounded-lg p-2.5">
                <span className="font-semibold">Exemplo do cabeçalho: </span>
                <span className="font-mono">{item.headerExample}</span>
              </div>
            )}

            {/* Meta info */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs border-t pt-3">
              <div><span className="font-semibold text-muted-foreground">ID Meta:</span> <span className="font-mono">{item.metaTemplateId}</span></div>
              <div><span className="font-semibold text-muted-foreground">WABA:</span> <span className="font-mono">{item.wabaId}</span></div>
              <div><span className="font-semibold text-muted-foreground">Conta:</span> {item.numberName ?? '—'}</div>
              <div><span className="font-semibold text-muted-foreground">Projeto:</span> {item.projectName ?? '—'}</div>
              {item.qualityScore && item.qualityScore !== 'UNKNOWN' && (
                <div><span className="font-semibold text-muted-foreground">Qualidade:</span> {item.qualityScore}</div>
              )}
              <div><span className="font-semibold text-muted-foreground">Última sync:</span> {format(new Date(item.lastSyncedAt), "dd/MM/yy HH:mm", { locale: ptBR })}</div>
              {item.rejectedReason && (
                <div className="col-span-2 flex items-start gap-1.5 text-red-600 bg-red-50 rounded p-2 border border-red-100">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{item.rejectedReason}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex gap-2 pt-3 border-t flex-shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Fechar
          </Button>
          {item && (
            <Button
              className="flex-1 gap-2"
              onClick={() => { onClose(); onUseAsTemplate(buildInitialValues(item)); }}
            >
              <Copy className="w-4 h-4" />
              Usar como modelo para novo template
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Broadcast Card ───────────────────────────────────────────────────────────

function BroadcastCard({
  b,
  libraryMap,
  onViewTemplate,
}: {
  b: BroadcastReport;
  libraryMap: Map<string, TemplateLibraryItem>;
  onViewTemplate: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const st = getStatus(b.status);
  const dateLabel = b.date ? format(new Date(b.date), "dd/MM/yyyy", { locale: ptBR }) : '—';
  const timeLabel = b.time ? b.time.slice(0, 5) : '—';
  const numberLabel = b.numberCustomName || b.numberVerifiedName || b.displayPhoneNumber || '—';
  const hasTemplate = !!b.templateUsed && libraryMap.has(b.templateUsed);

  return (
    <div className={cn('border rounded-xl bg-card transition-shadow', expanded ? 'shadow-md' : 'hover:shadow-sm')}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4 cursor-pointer select-none" onClick={() => setExpanded(v => !v)}>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
          b.status === 'sent' ? 'bg-green-100' : b.status === 'scheduled' ? 'bg-blue-100' :
          b.status === 'cancelled' ? 'bg-red-100' : 'bg-muted')}>
          <Send className={cn('w-4 h-4',
            b.status === 'sent' ? 'text-green-600' : b.status === 'scheduled' ? 'text-blue-600' :
            b.status === 'cancelled' ? 'text-red-500' : 'text-muted-foreground')} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <p className="font-semibold text-sm truncate">{b.listName ?? 'Sem nome'}</p>
            <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border shrink-0', st.color)}>
              {st.icon}{st.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {b.templateUsed && (
              <button
                onClick={e => { e.stopPropagation(); onViewTemplate(b.templateUsed!); }}
                className={cn(
                  'flex items-center gap-1 transition-colors',
                  hasTemplate ? 'text-primary hover:text-primary/80 font-medium' : 'text-muted-foreground'
                )}
                title={hasTemplate ? 'Ver detalhes do template' : 'Template não encontrado na biblioteca'}
              >
                <FileText className="w-3 h-3" />
                <span className="font-mono underline-offset-2 hover:underline">{b.templateUsed}</span>
                {hasTemplate && <Eye className="w-2.5 h-2.5" />}
              </button>
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

          {/* View template button */}
          {b.templateUsed && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={() => onViewTemplate(b.templateUsed!)}
            >
              <Eye className="w-3.5 h-3.5" />
              {hasTemplate ? 'Ver template completo' : `Buscar "${b.templateUsed}" na biblioteca`}
            </Button>
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
  const { data: libraryItems = [] } = useTemplateLibrary();
  const { data: accounts = [] } = useWabaAccounts();

  // Build lookup map by template name
  const libraryMap = useMemo(() =>
    new Map(libraryItems.map(i => [i.templateName, i])),
    [libraryItems]
  );

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterProject, setFilterProject] = useState('ALL');
  const [filterTemplate, setFilterTemplate] = useState('ALL');
  const [filterAction, setFilterAction] = useState('ALL');

  // Template modal state
  const [templateModalName, setTemplateModalName] = useState<string | null>(null);

  // Creator drawer state
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [drawerInitialValues, setDrawerInitialValues] = useState<TemplateInitialValues | undefined>(undefined);

  const projects  = useMemo(() => [...new Set(broadcasts.map(b => b.projectName).filter(Boolean))] as string[], [broadcasts]);
  const templates = useMemo(() => [...new Set(broadcasts.map(b => b.templateUsed).filter(Boolean))].sort() as string[], [broadcasts]);
  const actions   = useMemo(() => [...new Set(broadcasts.map(b => b.actionTypeName).filter(Boolean))].sort() as string[], [broadcasts]);

  const filtered = useMemo(() => broadcasts.filter(b => {
    if (search) {
      const q = search.toLowerCase();
      if (!(b.listName?.toLowerCase().includes(q) || b.templateUsed?.toLowerCase().includes(q) ||
            b.campaignName?.toLowerCase().includes(q) || b.projectName?.toLowerCase().includes(q) ||
            b.numberCustomName?.toLowerCase().includes(q) || b.displayPhoneNumber?.includes(q) ||
            b.observations?.toLowerCase().includes(q))) return false;
    }
    if (filterStatus !== 'ALL' && b.status !== filterStatus) return false;
    if (filterProject !== 'ALL' && b.projectName !== filterProject) return false;
    if (filterTemplate !== 'ALL' && b.templateUsed !== filterTemplate) return false;
    if (filterAction !== 'ALL' && b.actionTypeName !== filterAction) return false;
    return true;
  }), [broadcasts, search, filterStatus, filterProject, filterTemplate, filterAction]);

  const totalContacts = filtered.reduce((s, b) => s + b.contactCount, 0);
  const sentCount = filtered.filter(b => b.status === 'sent').length;
  const hasFilters = !!(search || filterStatus !== 'ALL' || filterProject !== 'ALL' || filterTemplate !== 'ALL' || filterAction !== 'ALL');

  const clearFilters = () => {
    setSearch(''); setFilterStatus('ALL'); setFilterProject('ALL');
    setFilterTemplate('ALL'); setFilterAction('ALL');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Send className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold">Disparos</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Histórico completo de todos os broadcasts · clique no template para ver detalhes
            </p>
          </div>
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
            <Input placeholder="Buscar por lista, template, campanha, número..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            {(['ALL', 'sent', 'scheduled', 'preparing', 'cancelled'] as const).map(s => {
              const cfg = s === 'ALL' ? null : getStatus(s);
              return (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                    filterStatus === s
                      ? s === 'ALL' ? 'bg-primary text-primary-foreground border-primary' : cfg?.color
                      : 'bg-background text-muted-foreground border-border hover:border-primary/40')}>
                  {s === 'ALL' ? 'Todos' : cfg?.label}
                </button>
              );
            })}
            <div className="w-px h-4 bg-border" />
            {projects.length > 1 && (
              <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
                className="text-xs border rounded-full px-2.5 py-1 bg-background text-muted-foreground">
                <option value="ALL">Todos os projetos</option>
                {projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            {templates.length > 0 && (
              <select value={filterTemplate} onChange={e => setFilterTemplate(e.target.value)}
                className="text-xs border rounded-full px-2.5 py-1 bg-background text-muted-foreground font-mono">
                <option value="ALL">Todos os templates</option>
                {templates.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {actions.length > 0 && (
              <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
                className="text-xs border rounded-full px-2.5 py-1 bg-background text-muted-foreground">
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
            {filtered.map(b => (
              <BroadcastCard
                key={b.id}
                b={b}
                libraryMap={libraryMap}
                onViewTemplate={setTemplateModalName}
              />
            ))}
          </div>
        )}
      </div>

      {/* Template detail modal */}
      {templateModalName && (
        <TemplateModal
          templateName={templateModalName}
          libraryMap={libraryMap}
          open={!!templateModalName}
          onClose={() => setTemplateModalName(null)}
          onUseAsTemplate={values => {
            setDrawerInitialValues(values);
            setCreatorOpen(true);
          }}
        />
      )}

      {/* Creator drawer */}
      <TemplateCreatorDrawer
        open={creatorOpen}
        onClose={() => { setCreatorOpen(false); setDrawerInitialValues(undefined); }}
        accounts={accounts}
        initialValues={drawerInitialValues}
      />
    </DashboardLayout>
  );
}
