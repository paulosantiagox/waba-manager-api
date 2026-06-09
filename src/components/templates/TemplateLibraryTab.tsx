import { useState, useMemo } from 'react';
import { useTemplateLibrary, useSyncTemplateLibrary, TemplateLibraryItem } from '@/hooks/useTemplateLibrary';
import { TemplateInitialValues } from './TemplateCreatorDrawer';
import { WabaAccount } from '@/hooks/useWabaTemplates';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search,
  RefreshCw,
  Loader2,
  FileText,
  ChevronDown,
  CheckCircle2,
  Clock,
  XCircle,
  PauseCircle,
  AlertCircle,
  Copy,
  Database,
  Filter,
  X,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  APPROVED:  { label: 'Aprovado',   color: 'text-green-700 bg-green-50 border-green-200' },
  PENDING:   { label: 'Pendente',   color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  IN_APPEAL: { label: 'Em recurso', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  REJECTED:  { label: 'Rejeitado',  color: 'text-red-700 bg-red-50 border-red-200' },
  PAUSED:    { label: 'Pausado',    color: 'text-orange-700 bg-orange-50 border-orange-200' },
  DISABLED:  { label: 'Desativado', color: 'text-gray-500 bg-gray-50 border-gray-200' },
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  MARKETING:      { label: 'Marketing',    color: 'text-purple-700 bg-purple-50 border-purple-200' },
  UTILITY:        { label: 'Utilidade',    color: 'text-blue-700 bg-blue-50 border-blue-200' },
  AUTHENTICATION: { label: 'Autenticação', color: 'text-gray-700 bg-gray-50 border-gray-200' },
};

const QUALITY_CONFIG: Record<string, { label: string; color: string }> = {
  GREEN:   { label: 'Alta',   color: 'text-green-700' },
  YELLOW:  { label: 'Média',  color: 'text-yellow-600' },
  RED:     { label: 'Baixa',  color: 'text-red-600' },
  UNKNOWN: { label: '—',      color: 'text-gray-400' },
};

const LANG_LABEL: Record<string, string> = {
  pt_BR: 'PT-BR', en_US: 'EN-US', es_ES: 'ES', es_AR: 'ES-AR',
  es_MX: 'ES-MX', fr_FR: 'FR', de_DE: 'DE', it_IT: 'IT',
};

// Build TemplateInitialValues from a library item
function buildInitialValues(item: TemplateLibraryItem): TemplateInitialValues {
  const header = item.components.find(c => c.type === 'HEADER');
  const body = item.components.find(c => c.type === 'BODY');
  const footer = item.components.find(c => c.type === 'FOOTER');
  const buttonsComp = item.components.find(c => c.type === 'BUTTONS');

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
    buttonsEnabled: !!buttonsComp && (buttonsComp.buttons?.length ?? 0) > 0,
    buttons: (buttonsComp?.buttons ?? []).map(b => ({
      type: b.type as 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER',
      text: b.text,
      url: b.url,
      phone_number: b.phone_number,
    })),
  };
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function LibraryCard({
  item,
  onUseAsTemplate,
}: {
  item: TemplateLibraryItem;
  onUseAsTemplate: (values: TemplateInitialValues) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.DISABLED;
  const category = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.UTILITY;
  const quality = QUALITY_CONFIG[item.qualityScore ?? 'UNKNOWN'] ?? QUALITY_CONFIG.UNKNOWN;

  return (
    <div className={cn(
      'border rounded-xl bg-card transition-shadow',
      expanded ? 'shadow-md' : 'hover:shadow-sm'
    )}>
      {/* Header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
          item.status === 'APPROVED' ? 'bg-green-100' :
          item.status === 'REJECTED' ? 'bg-red-100' :
          item.status === 'PENDING' ? 'bg-yellow-100' : 'bg-muted'
        )}>
          <FileText className={cn(
            'w-4 h-4',
            item.status === 'APPROVED' ? 'text-green-600' :
            item.status === 'REJECTED' ? 'text-red-500' :
            item.status === 'PENDING' ? 'text-yellow-600' : 'text-muted-foreground'
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="font-semibold text-sm truncate font-mono" title={item.templateName}>
              {item.templateName}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', status.color)}>
              {item.status === 'APPROVED' ? <CheckCircle2 className="w-3 h-3" /> :
               item.status === 'REJECTED' ? <XCircle className="w-3 h-3" /> :
               item.status === 'PAUSED' || item.status === 'DISABLED' ? <PauseCircle className="w-3 h-3" /> :
               <Clock className="w-3 h-3" />}
              {status.label}
            </span>
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', category.color)}>
              {category.label}
            </span>
            <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted/60">
              {LANG_LABEL[item.language] ?? item.language}
            </span>
            {item.headerType && item.headerType !== 'TEXT' && (
              <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted/60">
                {item.headerType === 'IMAGE' ? '🖼️' : item.headerType === 'VIDEO' ? '🎬' : '📄'} {item.headerType}
              </span>
            )}
            {item.hasVariables && (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                {item.variableCount} var{item.variableCount !== 1 ? 's' : ''}
              </span>
            )}
            {item.buttonCount > 0 && (
              <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted/60">
                {item.buttonCount} botão(ões)
              </span>
            )}
            {item.qualityScore && item.qualityScore !== 'UNKNOWN' && (
              <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', quality.color)}>
                ● {quality.label}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 truncate">
            {item.numberName ?? item.wabaId} · {item.projectName ?? '—'}
          </p>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground flex-shrink-0 mt-1 transition-transform', expanded && 'rotate-180')} />
      </div>

      {/* Body preview (collapsed) */}
      {!expanded && item.bodyText && (
        <div className="px-4 pb-4 -mt-1">
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{item.bodyText}</p>
        </div>
      )}

      {/* Expanded */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {/* WhatsApp preview */}
          <div className="bg-[#e5ddd5] rounded-xl p-3">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Header */}
              {item.headerText && (
                <div className="px-3 pt-3 pb-2 border-b border-gray-100">
                  <p className="font-semibold text-sm">{item.headerText}</p>
                </div>
              )}
              {item.headerType && item.headerType !== 'TEXT' && (
                <div className="px-3 pt-3 pb-2 border-b border-gray-100 flex items-center gap-2 text-xs text-muted-foreground italic">
                  <span>{item.headerType === 'IMAGE' ? '🖼️' : item.headerType === 'VIDEO' ? '🎬' : '📄'}</span>
                  <span>{item.headerType}</span>
                  {item.headerMediaUrl && (
                    <a href={item.headerMediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline not-italic truncate max-w-[200px]">
                      {item.headerMediaUrl}
                    </a>
                  )}
                </div>
              )}
              {/* Body */}
              {item.bodyText && (
                <div className="px-3 py-2.5">
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
                    <div key={i} className="text-center py-2.5 border-b border-gray-50 last:border-0">
                      <span className="text-xs font-semibold text-blue-500">{btn.text}</span>
                      {btn.url && <p className="text-[10px] text-gray-400 mt-0.5">{btn.url}</p>}
                      {btn.phone_number && <p className="text-[10px] text-gray-400 mt-0.5">{btn.phone_number}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Variable examples */}
          {item.hasVariables && item.bodyExamples.length > 0 && item.bodyExamples[0]?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-800 mb-2">Exemplos das variáveis</p>
              <div className="space-y-1">
                {item.bodyExamples[0].map((ex, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-amber-700 w-10 shrink-0">{`{{${i + 1}}}`}</span>
                    <span className="text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-200">{ex}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Header example */}
          {item.headerExample && (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5">
              <span className="font-medium">Exemplo do cabeçalho: </span>
              <span className="font-mono">{item.headerExample}</span>
            </div>
          )}

          {/* Meta info */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1 border-t">
            <div><span className="font-medium text-foreground">ID Meta:</span> <span className="font-mono">{item.metaTemplateId}</span></div>
            <div><span className="font-medium text-foreground">WABA:</span> <span className="font-mono">{item.wabaId}</span></div>
            <div><span className="font-medium text-foreground">1ª vez visto:</span> {formatDistanceToNow(new Date(item.firstSeenAt), { addSuffix: true, locale: ptBR })}</div>
            <div><span className="font-medium text-foreground">Última sync:</span> {formatDistanceToNow(new Date(item.lastSyncedAt), { addSuffix: true, locale: ptBR })}</div>
            {item.rejectedReason && (
              <div className="col-span-2 flex items-start gap-1.5 text-red-600 bg-red-50 rounded p-2 border border-red-100 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{item.rejectedReason}</span>
              </div>
            )}
          </div>

          {/* Action */}
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2 text-xs"
            onClick={e => { e.stopPropagation(); onUseAsTemplate(buildInitialValues(item)); }}
          >
            <Copy className="w-3.5 h-3.5" />
            Usar como modelo para criar novo
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  accounts: WabaAccount[];
  onUseAsTemplate: (values: TemplateInitialValues) => void;
}

export default function TemplateLibraryTab({ accounts, onUseAsTemplate }: Props) {
  const { data: items = [], isLoading } = useTemplateLibrary();
  const { mutate: sync, isPending: isSyncing, data: syncResult } = useSyncTemplateLibrary(accounts);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterProject, setFilterProject] = useState('ALL');
  const [filterLang, setFilterLang] = useState('ALL');
  const [filterHasVars, setFilterHasVars] = useState(false);
  const [filterHasMedia, setFilterHasMedia] = useState(false);

  // Unique projects for filter
  const projects = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach(i => { if (i.projectName) map.set(i.wabaId, i.projectName); });
    return Array.from(map.entries());
  }, [items]);

  const languages = useMemo(() => [...new Set(items.map(i => i.language))], [items]);

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          item.templateName.toLowerCase().includes(q) ||
          item.bodyText?.toLowerCase().includes(q) ||
          item.headerText?.toLowerCase().includes(q) ||
          item.footerText?.toLowerCase().includes(q) ||
          item.projectName?.toLowerCase().includes(q) ||
          item.numberName?.toLowerCase().includes(q) ||
          item.wabaId.includes(q);
        if (!match) return false;
      }
      if (filterCategory !== 'ALL' && item.category !== filterCategory) return false;
      if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
      if (filterProject !== 'ALL' && item.wabaId !== filterProject) return false;
      if (filterLang !== 'ALL' && item.language !== filterLang) return false;
      if (filterHasVars && !item.hasVariables) return false;
      if (filterHasMedia && (!item.headerType || item.headerType === 'TEXT')) return false;
      return true;
    });
  }, [items, search, filterCategory, filterStatus, filterProject, filterLang, filterHasVars, filterHasMedia]);

  const hasActiveFilters = filterCategory !== 'ALL' || filterStatus !== 'ALL' || filterProject !== 'ALL' || filterLang !== 'ALL' || filterHasVars || filterHasMedia || !!search;

  const clearFilters = () => {
    setSearch(''); setFilterCategory('ALL'); setFilterStatus('ALL');
    setFilterProject('ALL'); setFilterLang('ALL');
    setFilterHasVars(false); setFilterHasMedia(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-bold text-lg">Biblioteca de Templates</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {items.length} template{items.length !== 1 ? 's' : ''} armazenado{items.length !== 1 ? 's' : ''} · {filtered.length} visível{filtered.length !== 1 ? 'is' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncResult && (
            <span className="text-xs text-muted-foreground">
              +{syncResult.added} novos · {syncResult.updated} atualizados
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => sync()}
            disabled={isSyncing || accounts.length === 0}
            className="gap-2"
          >
            {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {isSyncing ? 'Sincronizando...' : 'Sincronizar templates'}
          </Button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, conteúdo, projeto, WABA..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

          {/* Category */}
          {(['ALL', 'MARKETING', 'UTILITY', 'AUTHENTICATION'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                filterCategory === cat
                  ? cat === 'MARKETING' ? 'bg-purple-100 text-purple-700 border-purple-300'
                    : cat === 'UTILITY' ? 'bg-blue-100 text-blue-700 border-blue-300'
                    : cat === 'AUTHENTICATION' ? 'bg-gray-100 text-gray-700 border-gray-300'
                    : 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/40'
              )}
            >
              {cat === 'ALL' ? 'Todas' : cat === 'MARKETING' ? 'Marketing' : cat === 'UTILITY' ? 'Utilidade' : 'Auth'}
            </button>
          ))}

          <div className="w-px h-4 bg-border" />

          {/* Status */}
          {(['ALL', 'APPROVED', 'PENDING', 'REJECTED', 'PAUSED'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                filterStatus === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/40'
              )}
            >
              {s === 'ALL' ? 'Todos status' : STATUS_CONFIG[s]?.label ?? s}
            </button>
          ))}

          <div className="w-px h-4 bg-border" />

          {/* Project */}
          {projects.length > 1 && (
            <select
              value={filterProject}
              onChange={e => setFilterProject(e.target.value)}
              className="text-xs border rounded-full px-2.5 py-1 bg-background text-muted-foreground"
            >
              <option value="ALL">Todas as contas</option>
              {projects.map(([wabaId, name]) => (
                <option key={wabaId} value={wabaId}>{name} ({wabaId.slice(-6)})</option>
              ))}
            </select>
          )}

          {/* Language */}
          {languages.length > 1 && (
            <select
              value={filterLang}
              onChange={e => setFilterLang(e.target.value)}
              className="text-xs border rounded-full px-2.5 py-1 bg-background text-muted-foreground"
            >
              <option value="ALL">Todos idiomas</option>
              {languages.map(l => <option key={l} value={l}>{LANG_LABEL[l] ?? l}</option>)}
            </select>
          )}

          <div className="w-px h-4 bg-border" />

          {/* Toggle filters */}
          <button
            onClick={() => setFilterHasVars(v => !v)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
              filterHasVars ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-background text-muted-foreground border-border hover:border-primary/40'
            )}
          >
            Com variáveis
          </button>
          <button
            onClick={() => setFilterHasMedia(v => !v)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
              filterHasMedia ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-background text-muted-foreground border-border hover:border-primary/40'
            )}
          >
            Com mídia
          </button>

          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-1">
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <Database className="w-12 h-12 text-muted-foreground/30" />
          {items.length === 0 ? (
            <>
              <p className="font-medium">Biblioteca vazia</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Clique em <strong>Sincronizar templates</strong> para importar todos os templates das suas contas. Os dados ficam salvos permanentemente.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Nenhum resultado</p>
              <p className="text-sm text-muted-foreground">Tente ajustar os filtros ou a busca.</p>
              <button onClick={clearFilters} className="text-sm text-primary underline">Limpar filtros</button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(item => (
            <LibraryCard key={item.id} item={item} onUseAsTemplate={onUseAsTemplate} />
          ))}
        </div>
      )}
    </div>
  );
}
