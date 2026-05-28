import { useState, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Send,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WabaAccount } from '@/hooks/useWabaTemplates';
import { createWabaTemplate, CreateTemplatePayload, MetaTemplateComponent } from '@/services/metaApi';
import { useSaveDeployment } from '@/hooks/useTemplateDeployments';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';

interface FormButton {
  type: ButtonType;
  text: string;
  url?: string;
  phone_number?: string;
}

interface FormValues {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  headerEnabled: boolean;
  headerFormat: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  headerText: string;
  headerExample: string;
  body: string;
  bodyExamples: { value: string }[];
  footerEnabled: boolean;
  footerText: string;
  buttonsEnabled: boolean;
  buttons: FormButton[];
}

// Extract {{N}} variable indices from text (sorted, unique)
function extractVarIndices(text: string): number[] {
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)];
  const indices = [...new Set(matches.map(m => Number(m[1])))].sort((a, b) => a - b);
  return indices;
}

interface DeployItem {
  key: string;
  wabaId: string;
  projectName: string;
  bmName: string;
  accessToken: string;
  templateName: string;
  versionNumber: number;
  projectId: string | null;
  status: 'waiting' | 'creating' | 'done' | 'error' | 'category_changed';
  actualCategory?: string;
  metaId?: string;
  errorMessage?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LANGUAGES = [
  { value: 'pt_BR', label: 'Português (Brasil)' },
  { value: 'en_US', label: 'English (US)' },
  { value: 'es_ES', label: 'Español (España)' },
  { value: 'es_AR', label: 'Español (Argentina)' },
  { value: 'es_MX', label: 'Español (México)' },
  { value: 'fr_FR', label: 'Français' },
  { value: 'de_DE', label: 'Deutsch' },
  { value: 'it_IT', label: 'Italiano' },
  { value: 'ja_JP', label: '日本語' },
  { value: 'zh_CN', label: '中文 (简体)' },
];

const CATEGORY_INFO: Record<string, { label: string; color: string; desc: string }> = {
  MARKETING: {
    label: 'Marketing',
    color: 'text-purple-600',
    desc: 'Promoções, ofertas e novidades',
  },
  UTILITY: {
    label: 'Utilidade',
    color: 'text-blue-600',
    desc: 'Confirmações, atualizações e alertas',
  },
  AUTHENTICATION: {
    label: 'Autenticação',
    color: 'text-gray-600',
    desc: 'Códigos de verificação OTP',
  },
};

const DELAY_MS = 1800; // delay between each creation to avoid rate limiting

// ─── Status icon ─────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: DeployItem['status'] }) {
  switch (status) {
    case 'waiting':
      return <Clock className="w-4 h-4 text-muted-foreground" />;
    case 'creating':
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case 'done':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'category_changed':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  }
}

function statusLabel(item: DeployItem, requestedCategory: string) {
  switch (item.status) {
    case 'waiting': return 'Aguardando...';
    case 'creating': return 'Criando...';
    case 'done': return `Criado · ${item.metaId}`;
    case 'error': return item.errorMessage ?? 'Erro desconhecido';
    case 'category_changed':
      return `Categoria alterada: ${requestedCategory} → ${item.actualCategory}`;
  }
}

// ─── WABA Selector ───────────────────────────────────────────────────────────

function WabaSelector({
  accounts,
  selected,
  onChange,
}: {
  accounts: WabaAccount[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const byProject = useMemo(() => {
    const map = new Map<string, { name: string; accounts: WabaAccount[] }>();
    for (const acc of accounts) {
      if (!map.has(acc.projectId)) map.set(acc.projectId, { name: acc.projectName, accounts: [] });
      map.get(acc.projectId)!.accounts.push(acc);
    }
    return Array.from(map.entries());
  }, [accounts]);

  const [open, setOpen] = useState<Set<string>>(() => new Set(accounts.map(a => a.projectId)));

  const toggle = (wabaId: string) => {
    const next = new Set(selected);
    next.has(wabaId) ? next.delete(wabaId) : next.add(wabaId);
    onChange(next);
  };

  const toggleProject = (projectId: string, accountIds: string[]) => {
    const allSelected = accountIds.every(id => selected.has(id));
    const next = new Set(selected);
    accountIds.forEach(id => (allSelected ? next.delete(id) : next.add(id)));
    onChange(next);
  };

  const toggleOpenProject = (id: string) => {
    const next = new Set(open);
    next.has(id) ? next.delete(id) : next.add(id);
    setOpen(next);
  };

  return (
    <div className="space-y-1">
      {byProject.map(([projectId, group]) => {
        const ids = group.accounts.map(a => a.wabaId);
        const allChecked = ids.every(id => selected.has(id));
        const someChecked = ids.some(id => selected.has(id));
        const isOpen = open.has(projectId);

        return (
          <div key={projectId} className="border rounded-lg overflow-hidden">
            {/* Project row */}
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors">
              <Checkbox
                checked={allChecked}
                data-state={someChecked && !allChecked ? 'indeterminate' : undefined}
                onCheckedChange={() => toggleProject(projectId, ids)}
                className="data-[state=indeterminate]:bg-primary/50"
              />
              <button
                type="button"
                className="flex-1 flex items-center gap-2 text-sm font-semibold text-left"
                onClick={() => toggleOpenProject(projectId)}
              >
                {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                {group.name}
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {ids.filter(id => selected.has(id)).length}/{ids.length}
                </span>
              </button>
            </div>

            {/* WABA accounts */}
            {isOpen && (
              <div className="divide-y divide-border/50">
                {group.accounts.map(acc => (
                  <label
                    key={acc.wabaId}
                    className="flex items-start gap-2 px-4 py-2 hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selected.has(acc.wabaId)}
                      onCheckedChange={() => toggle(acc.wabaId)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {acc.numberNames[0] ?? acc.wabaId}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{acc.wabaId}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Version preview ──────────────────────────────────────────────────────────

function versionName(baseName: string, version: number, total: number) {
  if (total === 1) return baseName;
  return `${baseName}_${String(version).padStart(2, '0')}`;
}

// ─── Build components payload ─────────────────────────────────────────────────

function buildComponents(values: FormValues): MetaTemplateComponent[] {
  const components: MetaTemplateComponent[] = [];

  if (values.headerEnabled) {
    const header: MetaTemplateComponent = { type: 'HEADER', format: values.headerFormat };
    if (values.headerFormat === 'TEXT') {
      header.text = values.headerText;
      // Include example if header has {{1}}
      if (values.headerText.includes('{{1}}') && values.headerExample?.trim()) {
        header.example = { header_text: [values.headerExample.trim()] };
      }
    }
    components.push(header);
  }

  if (values.body.trim()) {
    const bodyComp: MetaTemplateComponent = { type: 'BODY', text: values.body.trim() };
    const indices = extractVarIndices(values.body);
    if (indices.length > 0) {
      const exampleValues = indices.map(i => values.bodyExamples?.[i - 1]?.value?.trim() || `exemplo_${i}`);
      bodyComp.example = { body_text: [exampleValues] };
    }
    components.push(bodyComp);
  }

  if (values.footerEnabled && values.footerText.trim()) {
    components.push({ type: 'FOOTER', text: values.footerText.trim() });
  }

  if (values.buttonsEnabled && values.buttons.length > 0) {
    components.push({ type: 'BUTTONS', buttons: values.buttons });
  }

  return components;
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  accounts: WabaAccount[];
}

type Step = 'form' | 'deploying' | 'done';

export default function TemplateCreatorDrawer({ open, onClose, accounts }: Props) {
  const { mutateAsync: saveDeployment } = useSaveDeployment();

  const { register, control, watch, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      name: '',
      category: 'MARKETING',
      language: 'pt_BR',
      headerEnabled: false,
      headerFormat: 'TEXT',
      headerText: '',
      headerExample: '',
      body: '',
      bodyExamples: [],
      footerEnabled: false,
      footerText: '',
      buttonsEnabled: false,
      buttons: [],
    },
  });

  const { fields: buttonFields, append: addButton, remove: removeButton } = useFieldArray({
    control,
    name: 'buttons',
  });

  const { fields: bodyExampleFields, replace: replaceBodyExamples } = useFieldArray({
    control,
    name: 'bodyExamples',
  });

  // Sync bodyExamples fields when body text changes
  const bodyText = watch('body');
  const bodyVarIndices = useMemo(() => extractVarIndices(bodyText ?? ''), [bodyText]);
  useMemo(() => {
    const current = bodyExampleFields.length;
    const needed = bodyVarIndices.length;
    if (current !== needed) {
      replaceBodyExamples(Array.from({ length: needed }, (_, i) => ({
        value: bodyExampleFields[i]?.value ?? '',
      })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyVarIndices.length]);

  const [selectedWabas, setSelectedWabas] = useState<Set<string>>(new Set());
  const [versionCount, setVersionCount] = useState(1);
  const [step, setStep] = useState<Step>('form');
  const [deployItems, setDeployItems] = useState<DeployItem[]>([]);
  const [deployedCount, setDeployedCount] = useState(0);

  const watchValues = watch();
  const baseName = (watchValues.name ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '_');

  const totalItems = selectedWabas.size * versionCount;
  const progress = totalItems > 0 ? Math.round((deployedCount / totalItems) * 100) : 0;

  const handleClose = () => {
    if (step === 'deploying') return; // prevent close during deploy
    reset();
    setSelectedWabas(new Set());
    setVersionCount(1);
    setStep('form');
    setDeployItems([]);
    setDeployedCount(0);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (selectedWabas.size === 0) {
      toast.error('Selecione pelo menos uma WABA.');
      return;
    }
    if (!values.body.trim()) {
      toast.error('O corpo do template é obrigatório.');
      return;
    }

    // Build initial deploy queue
    const selectedAccounts = accounts.filter(a => selectedWabas.has(a.wabaId));
    const items: DeployItem[] = [];

    for (const acc of selectedAccounts) {
      for (let v = 1; v <= versionCount; v++) {
        items.push({
          key: `${acc.wabaId}::v${v}`,
          wabaId: acc.wabaId,
          projectName: acc.projectName,
          bmName: acc.bmName,
          accessToken: acc.accessToken,
          templateName: versionName(baseName, v, versionCount),
          versionNumber: v,
          projectId: acc.projectId,
          status: 'waiting',
        });
      }
    }

    setDeployItems(items);
    setDeployedCount(0);
    setStep('deploying');

    const components = buildComponents(values);
    let doneCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Mark as creating
      setDeployItems(prev =>
        prev.map(d => (d.key === item.key ? { ...d, status: 'creating' } : d))
      );

      try {
        const result = await createWabaTemplate(item.wabaId, item.accessToken, {
          name: item.templateName,
          category: values.category,
          language: values.language,
          components,
        } as CreateTemplatePayload);

        const categoryChanged = result.category !== values.category;
        const finalStatus: DeployItem['status'] = categoryChanged ? 'category_changed' : 'done';

        setDeployItems(prev =>
          prev.map(d =>
            d.key === item.key
              ? {
                  ...d,
                  status: finalStatus,
                  metaId: result.id,
                  actualCategory: result.category,
                }
              : d
          )
        );

        // Save to Supabase
        await saveDeployment({
          projectId: item.projectId,
          projectName: item.projectName,
          wabaId: item.wabaId,
          templateBaseName: baseName,
          templateName: item.templateName,
          versionNumber: item.versionNumber,
          requestedCategory: values.category,
          actualCategory: result.category,
          categoryChanged,
          language: values.language,
          components,
          metaTemplateId: result.id,
          status: result.status,
          errorMessage: null,
        });
      } catch (err) {
        const errorMessage = (err as Error).message;
        setDeployItems(prev =>
          prev.map(d =>
            d.key === item.key ? { ...d, status: 'error', errorMessage } : d
          )
        );

        // Save error to Supabase
        await saveDeployment({
          projectId: item.projectId,
          projectName: item.projectName,
          wabaId: item.wabaId,
          templateBaseName: baseName,
          templateName: item.templateName,
          versionNumber: item.versionNumber,
          requestedCategory: values.category,
          actualCategory: null,
          categoryChanged: false,
          language: values.language,
          components,
          metaTemplateId: null,
          status: 'ERROR',
          errorMessage,
        });
      }

      doneCount++;
      setDeployedCount(doneCount);

      // Delay between requests (except after last)
      if (i < items.length - 1) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }

    setStep('done');
  });

  const successCount = deployItems.filter(d => d.status === 'done' || d.status === 'category_changed').length;
  const errorCount = deployItems.filter(d => d.status === 'error').length;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 flex flex-col"
        onInteractOutside={step === 'deploying' ? e => e.preventDefault() : undefined}
      >
        <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
          <SheetTitle>
            {step === 'form' && 'Criar Template'}
            {step === 'deploying' && 'Enviando templates...'}
            {step === 'done' && 'Deploy concluído'}
          </SheetTitle>
        </SheetHeader>

        {/* ─── FORM STEP ─── */}
        {step === 'form' && (
          <ScrollArea className="flex-1">
            <form onSubmit={onSubmit} className="p-6 space-y-6">

              {/* Template info */}
              <section className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Informações do Template
                </h3>

                <div className="space-y-2">
                  <Label>Nome base</Label>
                  <Input
                    {...register('name', { required: true })}
                    placeholder="meu_template"
                    className={cn(errors.name && 'border-destructive')}
                  />
                  {baseName && (
                    <p className="text-xs text-muted-foreground">
                      Será salvo como: <span className="font-mono font-medium">{baseName}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Controller
                      name="category"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CATEGORY_INFO).map(([val, info]) => (
                              <SelectItem key={val} value={val}>
                                <span className={cn('font-medium', info.color)}>{info.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {watchValues.category && (
                      <p className="text-xs text-muted-foreground">
                        {CATEGORY_INFO[watchValues.category]?.desc}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Idioma</Label>
                    <Controller
                      name="language"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LANGUAGES.map(l => (
                              <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>
              </section>

              <Separator />

              {/* Components */}
              <section className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Componentes
                </h3>

                {/* Header */}
                <div className="border rounded-lg overflow-hidden">
                  <label className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer">
                    <Controller
                      name="headerEnabled"
                      control={control}
                      render={({ field }) => (
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                    <span className="text-sm font-medium">Cabeçalho (opcional)</span>
                  </label>
                  {watchValues.headerEnabled && (
                    <div className="p-4 space-y-3 border-t">
                      <Controller
                        name="headerFormat"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TEXT">Texto</SelectItem>
                              <SelectItem value="IMAGE">Imagem</SelectItem>
                              <SelectItem value="VIDEO">Vídeo</SelectItem>
                              <SelectItem value="DOCUMENT">Documento</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {watchValues.headerFormat === 'TEXT' && (
                        <div className="space-y-2">
                          <Input {...register('headerText')} placeholder="Cabeçalho — ex: Olá {{1}}" />
                          {watchValues.headerText?.includes('{{1}}') && (
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono font-bold text-amber-700 w-8 shrink-0">{'{{1}}'}</span>
                              <Input
                                {...register('headerExample')}
                                placeholder="Exemplo do cabeçalho"
                                className="h-8 text-sm bg-amber-50 border-amber-200"
                              />
                            </div>
                          )}
                        </div>
                      )}
                      {watchValues.headerFormat !== 'TEXT' && (
                        <p className="text-xs text-muted-foreground italic">
                          Mídia será adicionada via URL no momento do envio.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="space-y-2">
                  <Label>
                    Corpo <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    {...register('body', { required: true })}
                    placeholder="Olá, {{1}}! Temos uma novidade para você..."
                    rows={4}
                    className={cn(errors.body && 'border-destructive')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {'{{1}}'}, {'{{2}}'} para variáveis dinâmicas.
                  </p>
                </div>

                {/* Body variable examples */}
                {bodyVarIndices.length > 0 && (
                  <div className="border rounded-lg overflow-hidden bg-amber-50/50 border-amber-200">
                    <div className="px-4 py-2.5 bg-amber-100/60 border-b border-amber-200">
                      <p className="text-xs font-semibold text-amber-800">
                        Exemplos das variáveis (obrigatório pela Meta)
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Informe um valor de exemplo para cada variável detectada no corpo.
                      </p>
                    </div>
                    <div className="p-4 space-y-2">
                      {bodyVarIndices.map((varIdx, fieldIdx) => (
                        <div key={varIdx} className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold text-amber-700 w-8 shrink-0">
                            {`{{${varIdx}}}`}
                          </span>
                          <Input
                            {...register(`bodyExamples.${fieldIdx}.value`)}
                            placeholder={`Ex: João`}
                            className="h-8 text-sm bg-white"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="border rounded-lg overflow-hidden">
                  <label className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer">
                    <Controller
                      name="footerEnabled"
                      control={control}
                      render={({ field }) => (
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                    <span className="text-sm font-medium">Rodapé (opcional)</span>
                  </label>
                  {watchValues.footerEnabled && (
                    <div className="p-4 border-t">
                      <Input {...register('footerText')} placeholder="Texto do rodapé" />
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="border rounded-lg overflow-hidden">
                  <label className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer">
                    <Controller
                      name="buttonsEnabled"
                      control={control}
                      render={({ field }) => (
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                    <span className="text-sm font-medium">Botões (opcional)</span>
                  </label>
                  {watchValues.buttonsEnabled && (
                    <div className="p-4 border-t space-y-3">
                      {buttonFields.map((field, idx) => (
                        <div key={field.id} className="flex gap-2 items-start">
                          <div className="flex-1 space-y-2">
                            <Controller
                              name={`buttons.${idx}.type`}
                              control={control}
                              render={({ field: f }) => (
                                <Select value={f.value} onValueChange={f.onChange}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="QUICK_REPLY">Resposta Rápida</SelectItem>
                                    <SelectItem value="URL">URL</SelectItem>
                                    <SelectItem value="PHONE_NUMBER">Telefone</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            <Input
                              {...register(`buttons.${idx}.text`)}
                              placeholder="Texto do botão"
                              className="h-8 text-xs"
                            />
                            {watchValues.buttons?.[idx]?.type === 'URL' && (
                              <Input
                                {...register(`buttons.${idx}.url`)}
                                placeholder="https://..."
                                className="h-8 text-xs"
                              />
                            )}
                            {watchValues.buttons?.[idx]?.type === 'PHONE_NUMBER' && (
                              <Input
                                {...register(`buttons.${idx}.phone_number`)}
                                placeholder="+5511999999999"
                                className="h-8 text-xs"
                              />
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive/70 hover:text-destructive mt-0.5"
                            onClick={() => removeButton(idx)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      {buttonFields.length < 3 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => addButton({ type: 'QUICK_REPLY', text: '' })}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar botão
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <Separator />

              {/* WABA Selector */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    WABAs de destino
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {selectedWabas.size} selecionada(s)
                  </span>
                </div>
                <WabaSelector
                  accounts={accounts}
                  selected={selectedWabas}
                  onChange={setSelectedWabas}
                />
              </section>

              <Separator />

              {/* Versions */}
              <section className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Versões
                </h3>
                <div className="flex items-center gap-3">
                  <Label className="shrink-0">Quantas versões?</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={versionCount}
                    onChange={e => setVersionCount(Math.max(1, Math.min(20, Number(e.target.value))))}
                    className="w-20 text-center"
                  />
                </div>
                {baseName && versionCount > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: Math.min(versionCount, 5) }).map((_, i) => (
                      <Badge key={i} variant="secondary" className="font-mono text-xs">
                        {versionName(baseName, i + 1, versionCount)}
                      </Badge>
                    ))}
                    {versionCount > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{versionCount - 5} mais
                      </Badge>
                    )}
                  </div>
                )}
              </section>

              <Separator />

              {/* Summary + submit */}
              <section className="space-y-3">
                {totalItems > 0 && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                    <p className="font-medium">Resumo do deploy</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      {selectedWabas.size} WABA(s) × {versionCount} versão(ões) ={' '}
                      <strong>{totalItems} template(s)</strong> a criar
                      {totalItems > 1 && (
                        <> · ~{Math.ceil((totalItems * DELAY_MS) / 1000)}s estimado</>
                      )}
                    </p>
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={selectedWabas.size === 0 || !watchValues.name?.trim()}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Criar {totalItems > 0 ? `${totalItems} template(s)` : 'templates'}
                </Button>
              </section>
            </form>
          </ScrollArea>
        )}

        {/* ─── DEPLOYING + DONE STEP ─── */}
        {(step === 'deploying' || step === 'done') && (
          <div className="flex flex-col flex-1 overflow-hidden p-6 gap-5">
            {/* Progress bar */}
            <div className="space-y-2 flex-shrink-0">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {step === 'done' ? 'Concluído' : `Criando ${deployedCount + 1} de ${totalItems}...`}
                </span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              {step === 'done' && (
                <div className="flex gap-3 text-xs">
                  <span className="text-green-600 font-medium">✓ {successCount} criado(s)</span>
                  {errorCount > 0 && (
                    <span className="text-red-600 font-medium">✗ {errorCount} erro(s)</span>
                  )}
                </div>
              )}
            </div>

            {/* Items list */}
            <ScrollArea className="flex-1 -mx-1 px-1">
              <div className="space-y-2">
                {deployItems.map(item => (
                  <div
                    key={item.key}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border text-sm transition-colors',
                      item.status === 'done' && 'border-green-200 bg-green-50',
                      item.status === 'category_changed' && 'border-yellow-200 bg-yellow-50',
                      item.status === 'error' && 'border-red-200 bg-red-50',
                      item.status === 'creating' && 'border-blue-200 bg-blue-50',
                      item.status === 'waiting' && 'border-border bg-card opacity-60',
                    )}
                  >
                    <StatusIcon status={item.status} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.templateName}</p>
                      <p className="text-xs text-muted-foreground">{item.projectName} · {item.wabaId}</p>
                      <p className={cn(
                        'text-xs mt-0.5',
                        item.status === 'error' && 'text-red-600',
                        item.status === 'category_changed' && 'text-yellow-700',
                      )}>
                        {statusLabel(item, watchValues.category)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Done actions */}
            {step === 'done' && (
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    reset();
                    setSelectedWabas(new Set());
                    setVersionCount(1);
                    setStep('form');
                    setDeployItems([]);
                    setDeployedCount(0);
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Criar outro
                </Button>
                <Button className="flex-1" onClick={handleClose}>
                  Fechar
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
