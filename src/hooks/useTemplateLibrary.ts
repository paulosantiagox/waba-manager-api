import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchWabaTemplates, MetaTemplate, MetaTemplateComponent } from '@/services/metaApi';
import { WabaAccount } from './useWabaTemplates';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TemplateLibraryItem {
  id: string;
  metaTemplateId: string;
  wabaId: string;
  projectId: string | null;
  projectName: string | null;
  numberName: string | null;
  templateName: string;
  status: string;
  category: string;
  language: string;
  qualityScore: string | null;
  rejectedReason: string | null;
  components: MetaTemplateComponent[];
  headerType: string | null;
  headerText: string | null;
  headerMediaUrl: string | null;
  bodyText: string | null;
  footerText: string | null;
  buttons: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
  bodyExamples: string[][];
  headerExample: string | null;
  hasVariables: boolean;
  variableCount: number;
  buttonCount: number;
  firstSeenAt: string;
  lastSyncedAt: string;
}

function mapRow(r: Record<string, unknown>): TemplateLibraryItem {
  return {
    id: r.id as string,
    metaTemplateId: r.meta_template_id as string,
    wabaId: r.waba_id as string,
    projectId: (r.project_id as string) ?? null,
    projectName: (r.project_name as string) ?? null,
    numberName: (r.number_name as string) ?? null,
    templateName: r.template_name as string,
    status: r.status as string,
    category: r.category as string,
    language: r.language as string,
    qualityScore: (r.quality_score as string) ?? null,
    rejectedReason: (r.rejected_reason as string) ?? null,
    components: (r.components as MetaTemplateComponent[]) ?? [],
    headerType: (r.header_type as string) ?? null,
    headerText: (r.header_text as string) ?? null,
    headerMediaUrl: (r.header_media_url as string) ?? null,
    bodyText: (r.body_text as string) ?? null,
    footerText: (r.footer_text as string) ?? null,
    buttons: (r.buttons as TemplateLibraryItem['buttons']) ?? [],
    bodyExamples: (r.body_examples as string[][]) ?? [],
    headerExample: (r.header_example as string) ?? null,
    hasVariables: (r.has_variables as boolean) ?? false,
    variableCount: (r.variable_count as number) ?? 0,
    buttonCount: (r.button_count as number) ?? 0,
    firstSeenAt: r.first_seen_at as string,
    lastSyncedAt: r.last_synced_at as string,
  };
}

// ─── Component extractor ──────────────────────────────────────────────────────

function extractFromComponents(components: MetaTemplateComponent[]) {
  const header = components.find(c => c.type === 'HEADER');
  const body = components.find(c => c.type === 'BODY');
  const footer = components.find(c => c.type === 'FOOTER');
  const buttonsComp = components.find(c => c.type === 'BUTTONS');

  const headerType = header ? (header.format ?? 'TEXT') : null;
  const headerText = header?.format === 'TEXT' ? (header.text ?? null) : null;
  const headerMediaUrl = header?.example?.header_handle?.[0] ?? null;
  const headerExample = header?.example?.header_text?.[0] ?? headerMediaUrl ?? null;
  const bodyText = body?.text ?? null;
  const bodyExamples = body?.example?.body_text ?? [];
  const variableCount = bodyText ? [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].length : 0;
  const footerText = footer?.text ?? null;
  const buttons = (buttonsComp?.buttons ?? []).map(b => ({
    type: b.type,
    text: b.text,
    ...(b.url ? { url: b.url } : {}),
    ...(b.phone_number ? { phone_number: b.phone_number } : {}),
  }));

  return {
    header_type: headerType,
    header_text: headerText,
    header_media_url: headerMediaUrl,
    header_example: headerExample,
    body_text: bodyText,
    footer_text: footerText,
    buttons,
    body_examples: bodyExamples,
    has_variables: variableCount > 0,
    variable_count: variableCount,
    button_count: buttons.length,
  };
}

// ─── Hook: read ───────────────────────────────────────────────────────────────

export function useTemplateLibrary() {
  return useQuery({
    queryKey: ['template-library'],
    queryFn: async (): Promise<TemplateLibraryItem[]> => {
      const { data, error } = await supabase
        .from('waba_template_library')
        .select('*')
        .order('template_name', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(r => mapRow(r as Record<string, unknown>));
    },
    staleTime: 30000,
  });
}

// ─── Hook: sync ───────────────────────────────────────────────────────────────

export function useSyncTemplateLibrary(accounts: WabaAccount[]) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{ added: number; updated: number; errors: string[] }> => {
      let added = 0;
      let updated = 0;
      const errors: string[] = [];

      // Load existing keys to count added vs updated
      const { data: existingRows } = await supabase
        .from('waba_template_library')
        .select('waba_id, template_name');

      const existingSet = new Set(
        (existingRows ?? []).map((r: Record<string, unknown>) => `${r.waba_id}::${r.template_name}`)
      );

      for (const account of accounts) {
        let templates: MetaTemplate[];
        try {
          templates = await fetchWabaTemplates(account.wabaId, account.accessToken);
        } catch (e: unknown) {
          errors.push(`${account.projectName} (${account.wabaId}): ${(e as Error).message}`);
          continue;
        }

        if (templates.length === 0) continue;

        const payloads = templates.map(t => {
          const key = `${account.wabaId}::${t.name}`;
          if (existingSet.has(key)) { updated++; } else { added++; }

          return {
            meta_template_id: t.id,
            waba_id: account.wabaId,
            project_id: account.projectId,
            project_name: account.projectName,
            number_name: account.numberNames[0] ?? null,
            template_name: t.name,
            status: t.status,
            category: t.category,
            language: t.language,
            quality_score: t.quality_score?.score ?? null,
            rejected_reason:
              t.rejected_reason && t.rejected_reason !== 'NONE'
                ? t.rejected_reason
                : null,
            components: t.components,
            ...extractFromComponents(t.components),
            last_synced_at: new Date().toISOString(),
          };
        });

        const { error: upsertErr } = await supabase
          .from('waba_template_library')
          .upsert(payloads, { onConflict: 'waba_id,template_name' });

        if (upsertErr) {
          errors.push(`${account.projectName} (${account.wabaId}): ${upsertErr.message}`);
        }
      }

      return { added, updated, errors };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-library'] });
    },
  });
}
