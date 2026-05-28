import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useWabaAccounts, useTemplatesForWaba, WabaAccount } from '@/hooks/useWabaTemplates';
import { MetaTemplate } from '@/services/metaApi';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  MetaTemplate['status'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; color: string }
> = {
  APPROVED: {
    label: 'Aprovado',
    variant: 'default',
    icon: <CheckCircle2 className="w-3 h-3" />,
    color: 'text-green-600 bg-green-50 border-green-200',
  },
  PENDING: {
    label: 'Pendente',
    variant: 'secondary',
    icon: <Clock className="w-3 h-3" />,
    color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  },
  IN_APPEAL: {
    label: 'Em recurso',
    variant: 'secondary',
    icon: <Clock className="w-3 h-3" />,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  REJECTED: {
    label: 'Rejeitado',
    variant: 'destructive',
    icon: <XCircle className="w-3 h-3" />,
    color: 'text-red-600 bg-red-50 border-red-200',
  },
  DISABLED: {
    label: 'Desativado',
    variant: 'outline',
    icon: <PauseCircle className="w-3 h-3" />,
    color: 'text-gray-500 bg-gray-50 border-gray-200',
  },
  PAUSED: {
    label: 'Pausado',
    variant: 'outline',
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

function TemplateCard({ template }: { template: MetaTemplate }) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_CONFIG[template.status] ?? STATUS_CONFIG.DISABLED;

  const bodyComponent = template.components.find(c => c.type === 'BODY');
  const headerComponent = template.components.find(c => c.type === 'HEADER');
  const footerComponent = template.components.find(c => c.type === 'FOOTER');
  const buttonsComponent = template.components.find(c => c.type === 'BUTTONS');

  return (
    <div className="border rounded-xl bg-card hover:shadow-sm transition-shadow">
      {/* Header row */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <FileText className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">{template.name}</span>
            <span className="text-xs text-muted-foreground">{template.language}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', status.color)}>
              {status.icon}
              {status.label}
            </span>
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', CATEGORY_COLOR[template.category] ?? 'text-gray-600 bg-gray-50 border-gray-200')}>
              {CATEGORY_LABEL[template.category] ?? template.category}
            </span>
          </div>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform mt-1', expanded && 'rotate-180')} />
      </div>

      {/* Preview body text even when collapsed */}
      {bodyComponent?.text && !expanded && (
        <div className="px-4 pb-3 -mt-1">
          <p className="text-xs text-muted-foreground line-clamp-2 pl-12">{bodyComponent.text}</p>
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="border-t mx-4 mb-4 pt-3 space-y-3">
          {/* WhatsApp-like preview */}
          <div className="bg-[#e5ddd5] rounded-xl p-3">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden max-w-xs">
              {headerComponent && (
                <div className="p-3 pb-1 border-b border-gray-100">
                  {headerComponent.format === 'TEXT' && (
                    <p className="font-semibold text-sm">{headerComponent.text}</p>
                  )}
                  {headerComponent.format && headerComponent.format !== 'TEXT' && (
                    <p className="text-xs text-muted-foreground italic">
                      [{headerComponent.format}]
                    </p>
                  )}
                </div>
              )}
              {bodyComponent?.text && (
                <div className="p-3 pb-1">
                  <p className="text-sm whitespace-pre-wrap">{bodyComponent.text}</p>
                </div>
              )}
              {footerComponent?.text && (
                <div className="px-3 pb-2">
                  <p className="text-xs text-gray-500">{footerComponent.text}</p>
                </div>
              )}
              {buttonsComponent?.buttons && buttonsComponent.buttons.length > 0 && (
                <div className="border-t border-gray-100">
                  {buttonsComponent.buttons.map((btn, i) => (
                    <div key={i} className="text-center py-2 border-b border-gray-100 last:border-0">
                      <span className="text-xs font-medium text-blue-500">{btn.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {template.rejected_reason && (
            <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-2 border border-red-100">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{template.rejected_reason}</span>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            <span className="font-medium">ID:</span> {template.id}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Templates panel (right side) ────────────────────────────────────────────

function TemplatesPanel({ account }: { account: WabaAccount }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { data: templates = [], isLoading, isError, error } = useTemplatesForWaba(
    account.wabaId,
    account.accessToken
  );

  const filtered = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch =
        search === '' ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.components.some(c => c.text?.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [templates, search, statusFilter]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { ALL: templates.length };
    for (const t of templates) {
      result[t.status] = (result[t.status] ?? 0) + 1;
    }
    return result;
  }, [templates]);

  const filterOptions = [
    { key: 'ALL', label: 'Todos' },
    { key: 'APPROVED', label: 'Aprovados' },
    { key: 'PENDING', label: 'Pendentes' },
    { key: 'REJECTED', label: 'Rejeitados' },
    { key: 'PAUSED', label: 'Pausados' },
    { key: 'DISABLED', label: 'Desativados' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="border-b pb-4 mb-4">
        <h2 className="font-semibold text-lg">{account.projectName}</h2>
        <p className="text-sm text-muted-foreground">WABA: {account.wabaId}</p>
        {account.numberNames.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {account.numberNames.join(' · ')}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar template..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {filterOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border',
                statusFilter === opt.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/40'
              )}
            >
              {opt.label}
              {counts[opt.key] !== undefined && (
                <span className={cn('ml-1', statusFilter === opt.key ? 'opacity-80' : 'opacity-60')}>
                  ({counts[opt.key] ?? 0})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 py-12 text-center">
          <AlertCircle className="w-10 h-10 text-destructive/60" />
          <div>
            <p className="font-medium text-sm">Erro ao buscar templates</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(error as Error)?.message ?? 'Verifique o token de acesso desta BM.'}
            </p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 py-12 text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {templates.length === 0
              ? 'Nenhum template encontrado nesta WABA.'
              : 'Nenhum template corresponde ao filtro.'}
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1 -mr-2 pr-2">
          <div className="space-y-3 pb-4">
            {filtered.map(template => (
              <TemplateCard key={`${template.id}-${template.language}`} template={template} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ─── Sidebar account tree ─────────────────────────────────────────────────────

function AccountTree({
  accounts,
  selectedWabaId,
  onSelect,
}: {
  accounts: WabaAccount[];
  selectedWabaId: string | null;
  onSelect: (account: WabaAccount) => void;
}) {
  // Group by project
  const byProject = useMemo(() => {
    const map = new Map<string, { name: string; accounts: WabaAccount[] }>();
    for (const acc of accounts) {
      if (!map.has(acc.projectId)) {
        map.set(acc.projectId, { name: acc.projectName, accounts: [] });
      }
      map.get(acc.projectId)!.accounts.push(acc);
    }
    return Array.from(map.values());
  }, [accounts]);

  const [openProjects, setOpenProjects] = useState<Set<string>>(() => {
    // Open all by default
    const s = new Set<string>();
    accounts.forEach(a => s.add(a.projectId));
    return s;
  });

  const toggleProject = (id: string) => {
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
          {/* Project header */}
          <button
            onClick={() => toggleProject(group.accounts[0].projectId)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm font-semibold text-foreground/80"
          >
            {openProjects.has(group.accounts[0].projectId)
              ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
              : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
            <span className="truncate">{group.name}</span>
          </button>

          {/* WABA accounts under this project */}
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
                    <p className="truncate text-xs font-medium">
                      {acc.numberNames[0] ?? acc.wabaId}
                    </p>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Templates() {
  const { data: accounts = [], isLoading: loadingAccounts } = useWabaAccounts();
  const [selectedAccount, setSelectedAccount] = useState<WabaAccount | null>(null);

  // Auto-select first account when loaded
  const resolvedAccount = selectedAccount ?? accounts[0] ?? null;

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-64 flex-shrink-0 border-r bg-card/50 flex flex-col">
          <div className="p-4 border-b">
            <h1 className="font-bold text-base">Templates</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Contas WhatsApp</p>
          </div>
          <ScrollArea className="flex-1 p-2">
            {loadingAccounts ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Nenhuma conta encontrada. Cadastre Business Managers nos seus projetos.
                </p>
              </div>
            ) : (
              <AccountTree
                accounts={accounts}
                selectedWabaId={resolvedAccount?.wabaId ?? null}
                onSelect={setSelectedAccount}
              />
            )}
          </ScrollArea>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-hidden p-6">
          {resolvedAccount ? (
            <TemplatesPanel key={resolvedAccount.wabaId} account={resolvedAccount} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <MessageSquare className="w-14 h-14 text-muted-foreground/30" />
              <div>
                <p className="font-medium">Selecione uma conta</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Escolha uma WABA na lista à esquerda para ver os templates.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </DashboardLayout>
  );
}
