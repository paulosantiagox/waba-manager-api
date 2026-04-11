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
// IMPORTANTE: Agora lança erro em vez de retornar fallback errado
export const mapMetaQuality = (quality: string): 'HIGH' | 'MEDIUM' | 'LOW' => {
  switch (quality) {
    case 'GREEN':
      return 'HIGH';
    case 'YELLOW':
      return 'MEDIUM';
    case 'RED':
      return 'LOW';
    default:
      // Lança erro para que o chamador possa tratar adequadamente
      // Isso evita que um erro de API seja interpretado como "MEDIUM"
      throw new Error(`Valor de quality_rating inválido ou ausente: ${quality || 'undefined'}`);
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
