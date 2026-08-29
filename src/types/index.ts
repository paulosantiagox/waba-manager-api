// User types
// role vem de user_app_access (padrão do grupo 3SMAX: master|admin|user|consultor|...).
// `ativo` (boolean) substitui o antigo `status` string — o estado 'pending' deixou de existir.
export interface User {
  id: string;
  name: string;       // user_profiles.nome
  email: string;
  role: string;       // app_role (user_app_access.role)
  photo?: string;     // user_profiles.avatar_url
  ativo: boolean;     // user_profiles.ativo
  createdAt: string;
  lastLogin?: string;
}

// Business Manager types
export interface BusinessManager {
  id: string;
  projectId: string;
  mainBmName: string;
  mainBmId: string;
  subBmName?: string;
  subBmId?: string;
  cardName?: string;
  cardLast4?: string;
  accessToken: string;
  createdAt: string;
}

// Project types
export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

// WhatsApp Number types
export type QualityRating = 'HIGH' | 'MEDIUM' | 'LOW';

export interface WhatsAppNumber {
  id: string;
  projectId: string;
  businessManagerId?: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  customName?: string;
  qualityRating: QualityRating;
  messagingLimitTier: string;
  photo?: string;
  wabaId: string;
  isVisible: boolean;
  observation?: string;
  createdAt: string;
  lastChecked: string;
  previousQuality?: QualityRating;
  lastStatusChange?: string;
  /** status do número na Meta (CONNECTED | BANNED | FLAGGED | RESTRICTED...).
   *  quality_rating segue GREEN mesmo banido — é este campo que denuncia. */
  metaStatus?: string;
  /** name_status na Meta (APPROVED | DECLINED | PENDING_REVIEW...) */
  nameStatus?: string;
  healthCheckedAt?: string;
}

// Status History types
export interface StatusHistory {
  id: string;
  phoneNumberId: string;
  qualityRating: QualityRating;
  messagingLimitTier: string;
  previousQuality?: QualityRating;
  changedAt: string;
  expectedRecovery?: string;
  observation?: string;
  isError?: boolean;
  errorMessage?: string;
}

// Error tracking for numbers
export interface NumberErrorLog {
  id: string;
  phoneNumberId: string;
  errorMessage: string;
  attemptedAt: string;
}

export interface NumberErrorState {
  phoneNumberId: string;
  errorCount: number;
  lastError: string;
  attempts: NumberErrorLog[];
  hidden?: boolean;
}

// Status change notification for numbers
export interface StatusChangeNotification {
  id: string;
  phoneNumberId: string;
  projectId: string;
  previousQuality: QualityRating;
  newQuality: QualityRating;
  direction: 'up' | 'down';
  changedAt: string;
  read?: boolean;
}

// Campaign types
export interface Campaign {
  id: string;
  userId: string;
  projectId?: string;
  name: string;
  description?: string;
  status: 'active' | 'archived';
  createdAt: string;
}

// Campaign Shortcut types
export interface CampaignShortcut {
  id: string;
  campaignId: string;
  name: string;
  content: string;
  isMultiline: boolean;
  createdAt: string;
}

// Action Type types
export interface ActionType {
  id: string;
  campaignId: string;
  name: string;
  color: string;
  description?: string;
  isActive: boolean;
}

// Broadcast types
export type BroadcastStatus = 'preparing' | 'scheduled' | 'cancelled' | 'sent';

export interface Broadcast {
  id: string;
  campaignId: string;
  date: string;
  time: string;
  returnDate?: string;
  actionTypeId: string;
  phoneNumberId: string;
  listName: string;
  templateUsed: string;
  contactCount: number;
  observations?: string;
  tags?: string[];
  status: BroadcastStatus;
  createdAt: string;
}

// Activity Log types
export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}
