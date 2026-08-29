// Meta Graph API Service

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
  canSendMessage?: 'AVAILABLE' | 'LIMITED' | 'BLOCKED';
  errors: MetaHealthError[];
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

  // Junta os erros de todas as entidades (WABA, BUSINESS, APP) numa lista só.
  const entities: Array<{ errors?: MetaHealthError[] }> = json.health_status?.entities ?? [];
  const errors = entities.flatMap(e => e.errors ?? []);

  return {
    id: json.id,
    name: json.name,
    status: json.status,
    account_review_status: json.account_review_status,
    canSendMessage: json.health_status?.can_send_message,
    errors,
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
