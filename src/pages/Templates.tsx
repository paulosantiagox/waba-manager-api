import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useWabaAccounts, useTemplatesForWaba, WabaAccount } from '@/hooks/useWabaTemplates';
import { MetaTemplate } from '@/services/metaApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  PauseCircle,
  MessageSquare,
  Plus,
  History,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import TemplateCreatorDrawer from '@/components/templates/TemplateCreatorDrawer';
import { useTemplateDeployments, useRefreshDeploymentStatus, useTemplateBroadcastStats, TemplateBroadcastStats, TemplateDeployment } from '@/hooks/useTemplateDeployments';
import { useTemplateStatusHistory, useRefreshAllTemplates, useTemplateSnapshots, TemplateStatusChange } from '@/hooks/useTemplateHistory';
import { useWabaAccounts as useAccounts } from '@/hooks/useWabaTemplates';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  MetaTemplate['status'],
  { label: string; icon: React.ReactNode; color: string }
> = {
  APPROVED: {
    label: 'Aprovado',
    icon: <CheckCircle2 className="w-3 h-3" />,
    color: 'text-green-600 bg-green-50 border-green-200',
  },
  PENDING: {
    label: 'Pendente',
    icon: <Clock className="w-3 h-3" />,
    color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  },
  IN_APPEAL: {
    label: 'Em recurso',
    icon: <Clock className="w-3 h-3" />,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  REJECTED: {
    label: 'Rejeitado',
    icon: <XCircle className="w-3 h-3" />,
    color: 'text-red-600 bg-red-50 border-red-200',
  },
  DISABLED: {
    label: 'Desativado',
    icon: <PauseCircle className="w-3 h-3" />,
    color: 'text-gray-500 bg-gray-50 border-gray-200',
  },
  PAUSED: {
    label: 'Pausado',
    icon: <PauseCircle className="w-3 h-3" />,
    color: 'text-orange-600 bg-orange-50 border-orange-200',
  },
};

const CATEGORY_LABEL: Record<string, string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilidade',
  AUTHENTICATION: 'Autenticação',
};

const CATEGORY_COLOR: Record<string, string> = {
  MARKETING: 'text-purple-600 bg-purple-50 border-purple-200',
  UTILITY: 'text-blue-600 bg-blue-50 border-blue-200',
  AUTHENTICATION: 'text-gray-600 bg-gray-50 border-gray-200',
};

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({ template, broadcastStats, snapshotStatus, snapshotCategory }: {
  template: MetaTemplate;
  broadcastStats?: TemplateBroadcastStats;
  snapshotStatus?: string;
  snapshotCategory?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_CONFIG[template.status] ?? STATUS_CONFIG.DISABLED;

  const bodyComponent = template.components.find(c => c.type === 'BODY');
  const headerComponent = template.components.find(c => c.type === 'HEADER');
  const footerComponent = template.components.find(c => c.type === 'FOOTER');
  const buttonsComponent = template.components.find(c => c.type === 'BUTTONS');

  const hasMedia = headerComponent && headerComponent.format !== 'TEXT';

  const statusChanged = snapshotStatus && snapshotStatus !== template.status;
  const categoryChanged = snapshotCategory && snapshotCategory !== template.category;

  return (
    <div className={cn(
      'border rounded-xl bg-card transition-shadow flex flex-col',
      expanded ? 'shadow-md' : 'hover:shadow-sm'
    )}>
      {/* Card header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
          template.status === 'APPROVED' ? 'bg-green-100' :
          template.status === 'REJECTED' ? 'bg-red-100' :
          template.status === 'PENDING' || template.status === 'IN_APPEAL' ? 'bg-yellow-100' :
          'bg-muted'
        )}>
          <FileText className={cn(
            'w-4 h-4',
            template.status === 'APPROVED' ? 'text-green-600' :
            template.status === 'REJECTED' ? 'text-red-500' :
            template.status === 'PENDING' || template.status === 'IN_APPEAL' ? 'text-yellow-600' :
            'text-muted-foreground'
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <p className="font-semibold text-sm truncate" title={template.name}>
              {template.name}
            </p>
            {(statusChanged || categoryChanged) && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
                <AlertTriangle className="w-2.5 h-2.5" />
                Mudou
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', status.color)}>
              {status.icon}
              {status.label}
            </span>
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', CATEGORY_COLOR[template.category] ?? 'text-gray-600 bg-gray-50 border-gray-200')}>
              {CATEGORY_LABEL[template.category] ?? template.category}
            </span>
            <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted/60">
              {template.language}
            </span>
            {hasMedia && (
              <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted/60">
                {headerComponent.format === 'IMAGE' ? '🖼️' : headerComponent.format === 'VIDEO' ? '🎬' : '📄'}
              </span>
            )}
            {buttonsComponent?.buttons && buttonsComponent.buttons.length > 0 && (
              <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted/60">
                {buttonsComponent.buttons.length} {buttonsComponent.buttons.length === 1 ? 'botão' : 'botões'}
              </span>
            )}
            {broadcastStats && broadcastStats.broadcastCount > 0 && (
              <span className="text-xs text-indigo-600 px-1.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 font-medium" title={`${broadcastStats.totalContacts.toLocaleString('pt-BR')} contatos no total`}>
                {broadcastStats.broadcastCount} disparo{broadcastStats.broadcastCount !== 1 ? 's' : ''} · {broadcastStats.totalContacts.toLocaleString('pt-BR')} contatos
              </span>
            )}
          </div>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform mt-1', expanded && 'rotate-180')} />
      </div>

      {/* Body preview (collapsed) */}
      {bodyComponent?.text && !expanded && (
        <div className="px-4 pb-4 -mt-1">
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {bodyComponent.text}
          </p>
        </div>
      )}

      {/* Expanded: WhatsApp preview */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="bg-[#e5ddd5] rounded-xl p-3">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {headerComponent && (
                <div className="px-3 pt-3 pb-2 border-b border-gray-100">
                  {headerComponent.format === 'TEXT' ? (
                    <p className="font-semibold text-sm">{headerComponent.text}</p>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                      <span>{headerComponent.format === 'IMAGE' ? '🖼️' : headerComponent.format === 'VIDEO' ? '🎬' : '📄'}</span>
                      <span>{headerComponent.format}</span>
                    </div>
                  )}
                </div>
              )}
              {bodyComponent?.text && (
                <div className="px-3 py-2.5">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{bodyComponent.text}</p>
                </div>
              )}
              {footerComponent?.text && (
                <div className="px-3 pb-2.5">
                  <p className="text-xs text-gray-400">{footerComponent.text}</p>
                </div>
              )}
              {buttonsComponent?.buttons && buttonsComponent.buttons.length > 0 && (
                <div className="border-t border-gray-100">
                  {buttonsComponent.buttons.map((btn, i) => (
                    <div key={i} className="text-center py-2.5 border-b border-gray-50 last:border-0">
                      <span className="text-xs font-semibold text-blue-500">{btn.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {(statusChanged || categoryChanged) && (
            <div className="flex flex-wrap gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              {statusChanged && (
                <span className="flex items-center gap-1 text-amber-800">
                  <AlertTriangle className="w-3 h-3" />
                  Status: <b>{snapshotStatus}</b> <ArrowRight className="w-3 h-3" /> <b>{template.status}</b>
                </span>
              )}
              {categoryChanged && (
                <span className="flex items-center gap-1 text-amber-800">
                  Categoria: <b>{snapshotCategory}</b> <ArrowRight className="w-3 h-3" /> <b>{template.category}</b>
                </span>
              )}
            </div>
          )}

          {template.rejected_reason && (
            <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-2.5 border border-red-100">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{template.rejected_reason}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground font-mono">ID: {template.id}</p>
        </div>
      )}
    </div>
  );
}

// ─── Templates panel ──────────────────────────────────────────────────────────

function TemplatesPanel({ account }: { account: WabaAccount }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading, isFetching, isError, error, dataUpdatedAt } = useTemplatesForWaba(
    account.wabaId,
    account.accessToken
  );
  const { data: broadcastStatsMap } = useTemplateBroadcastStats();
  const { data: snapshotsMap } = useTemplateSnapshots(account.wabaId);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['waba-templates', account.wabaId] });
  };

  const filtered = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch =
        search === '' ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.components.some(c => c.text?.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || t.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [templates, search, statusFilter, categoryFilter]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { ALL: templates.length };
    for (const t of templates) {
      result[t.status] = (result[t.status] ?? 0) + 1;
      result[`cat_${t.category}`] = (result[`cat_${t.category}`] ?? 0) + 1;
    }
    return result;
  }, [templates]);

  const statusOptions = [
    { key: 'ALL', label: 'Todos' },
    { key: 'APPROVED', label: 'Aprovados' },
    { key: 'PENDING', label: 'Pendentes' },
    { key: 'REJECTED', label: 'Rejeitados' },
    { key: 'PAUSED', label: 'Pausados' },
    { key: 'DISABLED', label: 'Desativados' },
  ];

  const categoryOptions = [
    { key: 'ALL', label: 'Todas categorias', color: '' },
    { key: 'UTILITY', label: 'Utilidade', color: 'text-blue-600 border-blue-300 bg-blue-50' },
    { key: 'MARKETING', label: 'Marketing', color: 'text-purple-600 border-purple-300 bg-purple-50' },
    { key: 'AUTHENTICATION', label: 'Autenticação', color: 'text-gray-600 border-gray-300 bg-gray-50' },
  ];

  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Header + search + refresh */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="font-bold text-xl truncate">{account.projectName}</h2>
            {!isLoading && (
              <span className="text-sm text-muted-foreground shrink-0">{templates.length} templates</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground truncate">
              WABA {account.wabaId}
              {account.numberNames.length > 0 && <> · {account.numberNames.join(' · ')}</>}
            </p>
            {updatedAt && (
              <span className="text-xs text-muted-foreground shrink-0">
                · atualizado às {updatedAt}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-50"
            title="Atualizar status dos templates"
          >
            {isFetching
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />}
            Atualizar
          </button>
          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Category quick filters */}
      <div className="flex gap-2 flex-wrap -mt-1">
        {categoryOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => setCategoryFilter(opt.key)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold transition-all border',
              categoryFilter === opt.key
                ? opt.color || 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-background text-muted-foreground border-border hover:border-primary/40'
            )}
          >
            {opt.label}
            {opt.key !== 'ALL' && counts[`cat_${opt.key}`] !== undefined && (
              <span className="ml-1.5 font-normal opacity-70">{counts[`cat_${opt.key}`] ?? 0}</span>
            )}
            {opt.key === 'ALL' && (
              <span className="ml-1.5 font-normal opacity-70">{templates.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Status filter chips */}
      <div className="flex gap-1.5 flex-wrap -mt-1">
        {statusOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => setStatusFilter(opt.key)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-all border',
              statusFilter === opt.key
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
            )}
          >
            {opt.label}
            {counts[opt.key] !== undefined && (
              <span className={cn('ml-1.5 font-normal', statusFilter === opt.key ? 'opacity-75' : 'opacity-50')}>
                {counts[opt.key] ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 py-16 text-center">
          <AlertCircle className="w-10 h-10 text-destructive/60" />
          <div>
            <p className="font-medium text-sm">Erro ao buscar templates</p>
            <p className="text-xs text-muted-foreground mt-1">{(error as Error)?.message ?? 'Verifique o token de acesso.'}</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 py-16 text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {templates.length === 0 ? 'Nenhum template nesta WABA.' : 'Nenhum template corresponde ao filtro.'}
          </p>
        </div>
      ) : (
        <div className="mt-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 pb-6">
            {filtered.map(template => (
              <TemplateCard
                key={`${template.id}-${template.language}`}
                template={template}
                broadcastStats={broadcastStatsMap?.get(template.name)}
                snapshotStatus={snapshotsMap?.get(template.name)?.status}
                snapshotCategory={snapshotsMap?.get(template.name)?.category}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Account tree sidebar ─────────────────────────────────────────────────────

function AccountTree({
  accounts,
  selectedWabaId,
  onSelect,
}: {
  accounts: WabaAccount[];
  selectedWabaId: string | null;
  onSelect: (account: WabaAccount) => void;
}) {
  const byProject = useMemo(() => {
    const map = new Map<string, { name: string; accounts: WabaAccount[] }>();
    for (const acc of accounts) {
      if (!map.has(acc.projectId)) map.set(acc.projectId, { name: acc.projectName, accounts: [] });
      map.get(acc.projectId)!.accounts.push(acc);
    }
    return Array.from(map.values());
  }, [accounts]);

  const [openProjects, setOpenProjects] = useState<Set<string>>(() => {
    const s = new Set<string>();
    accounts.forEach(a => s.add(a.projectId));
    return s;
  });

  const toggle = (id: string) => {
    setOpenProjects(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-1">
      {byProject.map(group => (
        <div key={group.name}>
          <button
            onClick={() => toggle(group.accounts[0].projectId)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm font-semibold text-foreground/80"
          >
            {openProjects.has(group.accounts[0].projectId)
              ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
              : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
            <span className="truncate">{group.name}</span>
          </button>

          {openProjects.has(group.accounts[0].projectId) && (
            <div className="ml-4 space-y-0.5">
              {group.accounts.map(acc => (
                <button
                  key={acc.wabaId}
                  onClick={() => onSelect(acc)}
                  className={cn(
                    'flex items-start gap-2 w-full px-3 py-2 rounded-lg text-left transition-colors text-sm',
                    selectedWabaId === acc.wabaId
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{acc.numberNames[0] ?? acc.wabaId}</p>
                    {acc.numberNames.length > 1 && (
                      <p className={cn('text-xs', selectedWabaId === acc.wabaId ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                        +{acc.numberNames.length - 1} número(s)
                      </p>
                    )}
                    <p className={cn('text-xs truncate mt-0.5', selectedWabaId === acc.wabaId ? 'text-primary-foreground/60' : 'text-muted-foreground/60')}>
                      {acc.wabaId}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Deployment History ───────────────────────────────────────────────────────

function statusColor(status: string) {
  switch (status) {
    case 'APPROVED': return 'text-green-600 bg-green-50 border-green-200';
    case 'PENDING': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'REJECTED': return 'text-red-600 bg-red-50 border-red-200';
    case 'ERROR': return 'text-red-700 bg-red-100 border-red-300';
    case 'PAUSED': return 'text-orange-600 bg-orange-50 border-orange-200';
    default: return 'text-gray-500 bg-gray-50 border-gray-200';
  }
}

function DeploymentHistory({ accounts }: { accounts: WabaAccount[] }) {
  const { data: deployments = [], isLoading } = useTemplateDeployments();
  const { mutate: refreshStatus, isPending: refreshing } = useRefreshDeploymentStatus();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Build wabaId → accessToken map
  const tokenMap = useMemo(() => {
    const m = new Map<string, string>();
    accounts.forEach(a => m.set(a.wabaId, a.accessToken));
    return m;
  }, [accounts]);

  const handleRefresh = (d: TemplateDeployment) => {
    const token = tokenMap.get(d.wabaId);
    if (!token) return;
    setRefreshingId(d.id);
    refreshStatus(
      { deploymentId: d.id, wabaId: d.wabaId, accessToken: token, templateName: d.templateName },
      { onSettled: () => setRefreshingId(null) }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  if (deployments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <History className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Nenhum deploy registrado ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
        {deployments.map(d => (
          <div key={d.id} className="border rounded-xl p-3 bg-card hover:shadow-sm transition-shadow">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium text-sm font-mono">{d.templateName}</span>
                  {d.categoryChanged && (
                    <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" />
                      Categoria alterada
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', statusColor(d.status))}>
                    {d.status}
                  </span>
                  {d.categoryChanged && d.actualCategory && (
                    <>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border', CATEGORY_COLOR[d.requestedCategory] ?? '')}>
                        ← {CATEGORY_LABEL[d.requestedCategory] ?? d.requestedCategory}
                      </span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border', CATEGORY_COLOR[d.actualCategory] ?? '')}>
                        {CATEGORY_LABEL[d.actualCategory] ?? d.actualCategory}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {d.projectName} · WABA {d.wabaId}
                  {d.metaTemplateId && <> · ID: {d.metaTemplateId}</>}
                </p>
                {d.errorMessage && (
                  <p className="text-xs text-red-600 mt-1">{d.errorMessage}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
              {d.metaTemplateId && tokenMap.has(d.wabaId) && (
                <button
                  onClick={() => handleRefresh(d)}
                  disabled={refreshingId === d.id}
                  className="flex items-center justify-center p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                  title="Atualizar status"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', refreshingId === d.id && 'animate-spin')} />
                </button>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}

// ─── Status Change History ────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Aprovado', PENDING: 'Pendente', REJECTED: 'Rejeitado',
  PAUSED: 'Pausado', DISABLED: 'Desativado', IN_APPEAL: 'Em recurso',
};

const STATUS_BADGE: Record<string, string> = {
  APPROVED: 'text-green-700 bg-green-50 border-green-200',
  PENDING: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  REJECTED: 'text-red-700 bg-red-50 border-red-200',
  PAUSED: 'text-orange-700 bg-orange-50 border-orange-200',
  DISABLED: 'text-gray-500 bg-gray-50 border-gray-200',
  IN_APPEAL: 'text-blue-700 bg-blue-50 border-blue-200',
};

function StatusChangeHistory() {
  const { data: changes = [], isLoading } = useTemplateStatusHistory();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <AlertTriangle className="w-10 h-10 text-muted-foreground/30" />
        <div>
          <p className="font-medium text-sm">Nenhuma mudança detectada</p>
          <p className="text-xs text-muted-foreground mt-1">
            Clique em <Zap className="w-3 h-3 inline" /> para sincronizar todos os templates e detectar mudanças.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {changes.map(c => (
        <div key={c.id} className="border rounded-xl p-3 bg-card hover:shadow-sm transition-shadow">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="font-medium text-sm font-mono">{c.templateName}</span>
                {c.projectName && (
                  <span className="text-xs text-muted-foreground">{c.projectName}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {c.previousStatus !== c.newStatus && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Status:</span>
                    {c.previousStatus && (
                      <span className={cn('px-2 py-0.5 rounded-full border font-medium', STATUS_BADGE[c.previousStatus] ?? 'text-gray-500 bg-gray-50 border-gray-200')}>
                        {STATUS_LABEL[c.previousStatus] ?? c.previousStatus}
                      </span>
                    )}
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className={cn('px-2 py-0.5 rounded-full border font-medium', STATUS_BADGE[c.newStatus] ?? 'text-gray-500 bg-gray-50 border-gray-200')}>
                      {STATUS_LABEL[c.newStatus] ?? c.newStatus}
                    </span>
                  </div>
                )}
                {c.previousCategory !== c.newCategory && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Categoria:</span>
                    <span className={cn('px-2 py-0.5 rounded-full border', CATEGORY_COLOR[c.previousCategory ?? ''] ?? 'text-gray-500 bg-gray-50 border-gray-200')}>
                      {CATEGORY_LABEL[c.previousCategory ?? ''] ?? c.previousCategory}
                    </span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className={cn('px-2 py-0.5 rounded-full border', CATEGORY_COLOR[c.newCategory] ?? 'text-gray-500 bg-gray-50 border-gray-200')}>
                      {CATEGORY_LABEL[c.newCategory] ?? c.newCategory}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                WABA {c.wabaId} · {formatDistanceToNow(new Date(c.changedAt), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Templates() {
  const { data: accounts = [], isLoading: loadingAccounts } = useWabaAccounts();
  const [selectedAccount, setSelectedAccount] = useState<WabaAccount | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const queryClient = useQueryClient();

  const resolvedAccount = selectedAccount ?? accounts[0] ?? null;

  const [activeTab, setActiveTab] = useState<'templates' | 'history' | 'changes'>('templates');

  // Mirror the same query the TemplatesPanel uses — React Query deduplicates, no double fetch
  const { isFetching: isRefreshing, dataUpdatedAt } = useTemplatesForWaba(
    resolvedAccount?.wabaId ?? null,
    resolvedAccount?.accessToken ?? null,
  );

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const handleRefreshCurrent = () => {
    if (resolvedAccount) {
      queryClient.invalidateQueries({ queryKey: ['waba-templates', resolvedAccount.wabaId] });
    }
  };

  const { mutate: runRefreshAll, isPending: isRefreshingAll } = useRefreshAllTemplates();

  return (
    <DashboardLayout>
      {/* Two-column layout: sticky sidebar + scrollable content */}
      <div className="flex gap-0 -m-8 min-h-screen">

        {/* Sticky sidebar */}
        <aside className="w-64 flex-shrink-0 border-r bg-card/50 sticky top-0 h-screen flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-1">
              <h1 className="font-bold text-base">Templates</h1>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleRefreshCurrent}
                  disabled={isRefreshing || !resolvedAccount}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-40"
                  title="Atualizar WABA atual"
                >
                  {isRefreshing
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <RefreshCw className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => runRefreshAll()}
                  disabled={isRefreshingAll}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border text-muted-foreground hover:text-foreground hover:border-amber-400 hover:text-amber-600 transition-colors disabled:opacity-40"
                  title="Atualizar TODOS os templates e detectar mudanças"
                >
                  {isRefreshingAll
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Zap className="w-3.5 h-3.5" />}
                </button>
                <Button size="sm" className="h-8 px-2.5 gap-1.5 text-xs" onClick={() => setCreatorOpen(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  Criar
                </Button>
              </div>
            </div>
            {lastUpdated && (
              <p className="text-[10px] text-muted-foreground">atualizado às {lastUpdated}</p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loadingAccounts ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
              </div>
            ) : accounts.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Nenhuma conta encontrada.</p>
              </div>
            ) : (
              <AccountTree
                accounts={accounts}
                selectedWabaId={resolvedAccount?.wabaId ?? null}
                onSelect={setSelectedAccount}
              />
            )}
          </div>
        </aside>

        {/* Main scrollable content */}
        <div className="flex-1 flex flex-col">
          {/* Tab bar — sticky */}
          <div className="sticky top-0 z-10 bg-background border-b px-6 pt-4 pb-0">
            <div className="flex gap-1">
              {([
                { key: 'templates', label: 'Templates', icon: <FileText className="w-3.5 h-3.5" /> },
                { key: 'changes', label: 'Mudanças de Status', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
                { key: 'history', label: 'Histórico de Deploy', icon: <History className="w-3.5 h-3.5" /> },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors',
                    activeTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Page content — scrolls naturally */}
          <div className="flex-1 p-6">
            {activeTab === 'templates' ? (
              resolvedAccount ? (
                <TemplatesPanel key={resolvedAccount.wabaId} account={resolvedAccount} />
              ) : (
                <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
                  <MessageSquare className="w-14 h-14 text-muted-foreground/30" />
                  <div>
                    <p className="font-medium">Selecione uma conta</p>
                    <p className="text-sm text-muted-foreground mt-1">Escolha uma WABA na lista à esquerda.</p>
                  </div>
                </div>
              )
            ) : activeTab === 'changes' ? (
              <StatusChangeHistory />
            ) : (
              <DeploymentHistory accounts={accounts} />
            )}
          </div>
        </div>
      </div>

      <TemplateCreatorDrawer
        open={creatorOpen}
        onClose={() => setCreatorOpen(false)}
        accounts={accounts}
      />
    </DashboardLayout>
  );
}
