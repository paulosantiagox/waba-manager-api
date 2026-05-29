import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const META_API = 'https://graph.facebook.com/v21.0';
const FIELDS = 'id,name,status,category,language';

interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
}

interface WabaAccount {
  waba_id: string;
  access_token: string;
  project_name: string;
}

async function fetchTemplates(wabaId: string, token: string): Promise<MetaTemplate[]> {
  const url = `${META_API}/${wabaId}/message_templates?fields=${FIELDS}&limit=200`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.data ?? [];
}

Deno.serve(async (req) => {
  // Allow manual trigger via POST and scheduled cron
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // 1. Load all WABAs with their access tokens
    const { data: bms, error: bmsErr } = await supabase
      .from('waba_business_managers')
      .select('id, access_token, project_id, main_bm_name');
    if (bmsErr) throw bmsErr;

    const { data: numbers, error: numErr } = await supabase
      .from('waba_whatsapp_numbers')
      .select('waba_id, business_manager_id, project_id')
      .eq('is_visible', true);
    if (numErr) throw numErr;

    const { data: projects, error: projErr } = await supabase
      .from('waba_projects')
      .select('id, name');
    if (projErr) throw projErr;

    const projectMap = new Map((projects ?? []).map((p: any) => [p.id, p.name]));
    const bmMap = new Map((bms ?? []).map((b: any) => [b.id, { token: b.access_token, projectId: b.project_id }]));

    // Deduplicate WABAs
    const wabaMap = new Map<string, WabaAccount>();
    for (const num of numbers ?? []) {
      if (wabaMap.has(num.waba_id)) continue;
      const bm = bmMap.get(num.business_manager_id);
      if (!bm) continue;
      wabaMap.set(num.waba_id, {
        waba_id: num.waba_id,
        access_token: bm.token,
        project_name: projectMap.get(bm.projectId) ?? bm.projectId,
      });
    }

    const results: Record<string, { updated: number; errors: string[] }> = {};

    for (const account of wabaMap.values()) {
      const { waba_id, access_token, project_name } = account;
      results[waba_id] = { updated: 0, errors: [] };

      let templates: MetaTemplate[];
      try {
        templates = await fetchTemplates(waba_id, access_token);
      } catch (e: any) {
        results[waba_id].errors.push(e.message);
        continue;
      }

      // Load existing snapshots for this WABA
      const { data: snapshots } = await supabase
        .from('waba_template_snapshots')
        .select('template_name, status, category')
        .eq('waba_id', waba_id);

      const snapshotMap = new Map(
        (snapshots ?? []).map((s: any) => [s.template_name, { status: s.status, category: s.category }])
      );

      const historyInserts: any[] = [];
      const snapshotUpserts: any[] = [];

      for (const t of templates) {
        const prev = snapshotMap.get(t.name);
        const statusChanged = prev && prev.status !== t.status;
        const categoryChanged = prev && prev.category !== t.category;

        if (statusChanged || categoryChanged || !prev) {
          if (prev && (statusChanged || categoryChanged)) {
            historyInserts.push({
              waba_id,
              project_name,
              template_id: t.id,
              template_name: t.name,
              previous_status: prev.status,
              new_status: t.status,
              previous_category: prev.category,
              new_category: t.category,
            });
            results[waba_id].updated++;
          }

          snapshotUpserts.push({
            waba_id,
            template_id: t.id,
            template_name: t.name,
            status: t.status,
            category: t.category,
            language: t.language,
            last_synced_at: new Date().toISOString(),
          });
        } else {
          // Update last_synced_at even when nothing changed
          snapshotUpserts.push({
            waba_id,
            template_id: t.id,
            template_name: t.name,
            status: t.status,
            category: t.category,
            language: t.language,
            last_synced_at: new Date().toISOString(),
          });
        }
      }

      if (snapshotUpserts.length > 0) {
        const { error: upsertErr } = await supabase
          .from('waba_template_snapshots')
          .upsert(snapshotUpserts, { onConflict: 'waba_id,template_name' });
        if (upsertErr) results[waba_id].errors.push(upsertErr.message);
      }

      if (historyInserts.length > 0) {
        const { error: histErr } = await supabase
          .from('waba_template_status_history')
          .insert(historyInserts);
        if (histErr) results[waba_id].errors.push(histErr.message);
      }

      // Small delay to avoid Meta rate limiting
      await new Promise(r => setTimeout(r, 300));
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
