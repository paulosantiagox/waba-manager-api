// Meta Graph API Service
import { supabase } from '@/integrations/supabase/client';

export interface MetaPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: 'GREEN' | 'YELLOW' | 'RED';
  messaging_limit_tier: string;
}

export interface MetaPhoneNumberDetail extends MetaPhoneNumber {
  code_verification_status?: string;
  account_mode?: string;
  throughput?: {
    level: string;
  };
  is_official_business_account?: boolean;
}

interface MetaApiResponse<T> {
  data: T[];
}

const META_API_BASE = 'https://graph.facebook.com/v21.0';

// Map Meta quality to internal quality
export const mapMetaQuality = (quality: string): 'HIGH' | 'MEDIUM' | 'LOW' => {
  switch (quality) {
    case 'GREEN':
      return 'HIGH';
    case 'YELLOW':
      return 'MEDIUM';
    case 'RED':
      return 'LOW';
    case 'UNKNOWN':
    default:
      // UNKNOWN é retornado pela Meta para números novos ou sem histórico suficiente
      return 'MEDIUM';
  }
};

// Map messaging limit tier to readable format
export const mapMessagingLimit = (tier: string | undefined | null): string => {
  if (!tier) return 'Não definido';
  const tierMap: Record<string, string> = {
    'TIER_1K': '1000',
    'TIER_10K': '10000',
    'TIER_100K': '100000',
    'TIER_UNLIMITED': 'Ilimitado',
  };
  return tierMap[tier] || tier.replace('TIER_', '').replace('K', '000');
};

// Fetch phone numbers from WABA
export const fetchPhoneNumbers = async (
  wabaId: string,
  accessToken: string
): Promise<MetaPhoneNumber[]> => {
  const url = `${META_API_BASE}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Erro ao buscar números da API do Meta');
  }

  const data: MetaApiResponse<MetaPhoneNumber> = await response.json();
  return data.data || [];
};

// Fetch detailed phone number info
export const fetchPhoneNumberDetail = async (
  phoneId: string,
  accessToken: string
): Promise<MetaPhoneNumberDetail> => {
  const url = `${META_API_BASE}/${phoneId}?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,code_verification_status,account_mode,throughput,is_official_business_account`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Erro ao buscar detalhes do número');
  }

  return response.json();
};

// Fetch Business Manager name
export const fetchBusinessManagerName = async (
  bmId: string,
  accessToken: string
): Promise<{ id: string; name: string }> => {
  const url = `${META_API_BASE}/${bmId}?fields=id,name`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Erro ao buscar dados da BM');
  }

  return response.json();
};

// Template component types
export interface MetaTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  text?: string;
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'OTP';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
  example?: {
    header_text?: string[];
    body_text?: string[][];
    header_handle?: string[];
  };
}

export interface MetaTemplate {
  id: string;
  name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'DISABLED' | 'IN_APPEAL' | 'PAUSED';
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  components: MetaTemplateComponent[];
  quality_score?: {
    score: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  };
  rejected_reason?: string;
}

// Fetch templates from a WABA
export const fetchWabaTemplates = async (
  wabaId: string,
  accessToken: string
): Promise<MetaTemplate[]> => {
  const fields = 'id,name,status,category,language,components,quality_score,rejected_reason';
  const url = `${META_API_BASE}/${wabaId}/message_templates?fields=${fields}&limit=100`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Erro ao buscar templates da WABA');
  }

  const data: MetaApiResponse<MetaTemplate> & { paging?: unknown } = await response.json();
  return data.data || [];
};

// ─── Upload de mídia para exemplo de cabeçalho ────────────────────────────────

/**
 * Cabeçalho IMAGE/VIDEO/DOCUMENT exige `example.header_handle` com um HANDLE da
 * Resumable Upload API — URL pública NÃO é aceita (era o bug: mandávamos a URL
 * e a Meta respondia "precisa de um exemplo/modelo").
 *
 * Fluxo: abre a sessão em /{app-id}/uploads e envia os bytes; a resposta traz o
 * handle (`h`) que vai no template.
 */
export const uploadMediaHandle = async (
  wabaId: string,
  arquivo: Blob,
  fileName: string
): Promise<string> => {
  // O endpoint `upload:` da Meta não responde ao preflight de CORS, então o
  // navegador não consegue enviar os bytes. A edge function faz isso no
  // servidor — e busca o token da BM no banco, sem passar pelo cliente.
  const buffer = await arquivo.arrayBuffer();
  let binario = '';
  const chunk = 0x8000; // fatiado para não estourar a pilha em arquivos grandes
  const view = new Uint8Array(buffer);
  for (let i = 0; i < view.length; i += chunk) {
    binario += String.fromCharCode(...view.subarray(i, i + chunk));
  }

  const { data, error } = await supabase.functions.invoke('meta-upload-handle', {
    body: {
      wabaId,
      fileBase64: btoa(binario),
      fileName,
      fileType: arquivo.type || 'application/octet-stream',
    },
  });

  if (error) throw new Error(error.message || 'Falha ao enviar a mídia de exemplo');
  if (!data?.handle) throw new Error(data?.error || 'A Meta não devolveu o handle da mídia');

  return data.handle as string;
};

/**
 * Imagem de exemplo gerada localmente (sem rede, sem CORS). Serve só para a
 * aprovação do template — a imagem real vai no disparo, pelos parâmetros.
 */
export const gerarImagemExemplo = (): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 418; // proporção recomendada pela Meta para header
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 800, 418);
    grad.addColorStop(0, '#1e3a8a');
    grad.addColorStop(1, '#2563eb');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 418);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Imagem de exemplo', 400, 200);
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText('A imagem real é enviada no disparo', 400, 250);
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('Falha ao gerar imagem de exemplo'))),
      'image/jpeg',
      0.85
    );
  });
};

/** PDF mínimo válido, para cabeçalho DOCUMENT. */
export const gerarPdfExemplo = (): Blob => {
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj
trailer<</Root 1 0 R>>
%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
};

// ─── Template creation ────────────────────────────────────────────────────────

export interface CreateTemplatePayload {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  components: MetaTemplateComponent[];
}

export interface CreateTemplateResult {
  id: string;
  status: MetaTemplate['status'];
  category: MetaTemplate['category'];
}

export const createWabaTemplate = async (
  wabaId: string,
  accessToken: string,
  payload: CreateTemplatePayload
): Promise<CreateTemplateResult> => {
  const url = `${META_API_BASE}/${wabaId}/message_templates`;

  // Strip undefined/empty optional fields from buttons to avoid Meta rejecting them
  const cleanedPayload = {
    ...payload,
    components: payload.components.map(c => {
      if (c.type !== 'BUTTONS' || !c.buttons) return c;
      return {
        ...c,
        buttons: c.buttons.map(btn => {
          const b: Record<string, string> = { type: btn.type, text: btn.text };
          if (btn.url) b.url = btn.url;
          if (btn.phone_number) b.phone_number = btn.phone_number;
          return b;
        }),
      };
    }),
  };

  console.log('[META] Creating template payload:', JSON.stringify(cleanedPayload, null, 2));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cleanedPayload),
  });

  const json = await response.json();

  if (!response.ok) {
    // Extract the most detailed error message available from Meta
    const details =
      json.error?.error_data?.details ||
      json.error?.error_user_msg ||
      json.error?.message ||
      `Erro ${response.status}`;

    console.error('[META] Template creation error:', JSON.stringify(json, null, 2));
    throw new Error(details);
  }

  return {
    id: json.id,
    status: json.status ?? 'PENDING',
    category: json.category ?? payload.category,
  };
};

// ─── Saúde da conta / do número ───────────────────────────────────────────────

/** status do número na Meta. quality_rating segue GREEN mesmo banido — é aqui que aparece. */
export type MetaNumberStatus =
  | 'CONNECTED' | 'BANNED' | 'FLAGGED' | 'RESTRICTED' | 'RATE_LIMITED'
  | 'PENDING' | 'DELETED' | 'MIGRATED' | 'UNVERIFIED' | 'UNKNOWN';

export interface MetaNumberHealth {
  id: string;
  display_phone_number?: string;
  status?: MetaNumberStatus;
  name_status?: string;
  quality_rating?: string;
  messaging_limit_tier?: string;
}

export interface MetaHealthError {
  error_code: number;
  error_description: string;
  possible_solution?: string;
}

export interface MetaWabaHealth {
  id: string;
  name?: string;
  status?: string;
  account_review_status?: string;
  /** AVAILABLE = ok · LIMITED = aviso · BLOCKED = não envia */
  canSendMessage?: 'AVAILABLE' | 'LIMITED' | 'BLOCKED';
  /** impeditivos (banimento, pagamento) */
  errors: MetaHealthError[];
  /** avisos informativos que não bloqueiam (additional_info) */
  warnings: string[];
}

/** Status real de um número (CONNECTED/BANNED/FLAGGED...). */
export const fetchNumberHealth = async (
  phoneId: string,
  accessToken: string
): Promise<MetaNumberHealth> => {
  const fields = 'id,display_phone_number,status,name_status,quality_rating,messaging_limit_tier';
  const response = await fetch(`${META_API_BASE}/${phoneId}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Erro ao buscar status do número');
  }
  return response.json();
};

/** health_status da WABA: banimento, erro de pagamento, review reprovado. */
export const fetchWabaHealth = async (
  wabaId: string,
  accessToken: string
): Promise<MetaWabaHealth> => {
  const fields = 'id,name,status,account_review_status,health_status';
  const response = await fetch(`${META_API_BASE}/${wabaId}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Erro ao buscar saúde da WABA');
  }
  const json = await response.json();

  // Junta erros e avisos de todas as entidades (WABA, BUSINESS, APP).
  const entities: Array<{ errors?: MetaHealthError[]; additional_info?: string[] }> =
    json.health_status?.entities ?? [];
  const errors = entities.flatMap(e => e.errors ?? []);
  const warnings = [...new Set(entities.flatMap(e => e.additional_info ?? []))];

  return {
    id: json.id,
    name: json.name,
    status: json.status,
    account_review_status: json.account_review_status,
    canSendMessage: json.health_status?.can_send_message,
    errors,
    warnings,
  };
};

// Fetch WABA name
export const fetchWABAName = async (
  wabaId: string,
  accessToken: string
): Promise<{ id: string; name: string }> => {
  const url = `${META_API_BASE}/${wabaId}?fields=id,name`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Erro ao buscar dados da WABA');
  }

  return response.json();
};
