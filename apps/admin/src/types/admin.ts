export type UserRole = 'Creator' | 'Brand';
export type AccountStatus = 'Active' | 'Suspended' | 'Pending review' | 'Deleted';
export type CampaignStatus = 'Draft' | 'Published' | 'Private' | 'Active' | 'Completed' | 'Archived';
export type ProposalStatus = 'New' | 'In review' | 'Accepted' | 'Declined' | 'Withdrawn' | 'Completed';
export type Audience = 'Brand' | 'Creator' | 'Both';

// Keep the admin platform taxonomy aligned with the mobile profile flow.
export const adminSocialPlatforms = ['Instagram', 'YouTube', 'TikTok', 'Facebook', 'Pinterest', 'LinkedIn', 'Snapchat', 'X'] as const;
export type AdminSocialPlatform = (typeof adminSocialPlatforms)[number];

export interface AdminSocialAccount {
  platform: AdminSocialPlatform;
  handle: string;
  url: string;
  verified: boolean;
}

export interface AdminNotificationPreference {
  key: string;
  label: string;
  enabled: boolean;
  channel: 'In-app' | 'Push' | 'Email';
}

export interface AdminMediaFile {
  id: string;
  name: string;
  type: 'Image' | 'Video' | 'Document';
  url: string;
  size: string;
}

export interface AdminNotificationRecord {
  id: string;
  userId: string;
  userName: string;
  title: string;
  message: string;
  type: string;
  source: 'App' | 'Admin' | 'System';
  channel: 'All' | 'In-app' | 'Push' | 'Email' | 'WhatsApp';
  deliveryStatus?: string;
  deliveredAt?: string | null;
  lastDeliveryError?: string | null;
  actionLabel?: string;
  actionUrl?: string;
  sentBy: string;
  createdAt: string;
  read: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  location: string;
  status: AccountStatus;
  profileVisible: boolean;
  followers: string;
  joined: string;
  avatar: string;
  categories: string[];
  phone?: string;
  state?: string;
  city?: string;
  bio?: string;
  languages?: string[];
  contentTypes?: string[];
  priceRange?: string;
  responseTime?: string;
  availability?: string;
  website?: string;
  socialAccounts?: AdminSocialAccount[];
  notificationSettings?: AdminNotificationPreference[];
  lastActive?: string;
}

export interface Campaign {
  id: string;
  title: string;
  brand: string;
  category: string;
  location: string;
  status: CampaignStatus;
  proposals: number;
  budget: string;
  deadlineAt?: string | null;
  updated: string;
  media?: AdminMediaFile[];
}

export interface Proposal {
  id: string;
  title: string;
  campaign: string;
  from: string;
  to: string;
  status: ProposalStatus;
  budget: string;
  updated: string;
  hasMedia: boolean;
  media?: AdminMediaFile[];
}

export interface Category {
  id: string;
  name: string;
  group: 'Category' | 'Platform' | 'Content type' | 'Collaboration';
  usage: number;
  status: 'Active' | 'Archived';
}

export interface VersionConfig {
  platform: 'Android' | 'iOS';
  minimumVersion: string;
  latestVersion: string;
  updateType: 'None' | 'Optional' | 'Mandatory';
  sourceType: 'apk' | 'playStore' | 'appStore';
  storeUrl: string;
  message: string;
  releaseNotes: string;
}

export type AppEnvironment = 'Development' | 'Staging' | 'Production';
export type SmtpEncryption = 'TLS' | 'SSL' | 'None';

export interface AdminRuntimeSettings {
  environment: AppEnvironment;
  apiBaseUrl: string;
  webBaseUrl: string;
  mediaBaseUrl: string;
  timezone: string;
  logLevel: 'Error' | 'Warn' | 'Info' | 'Debug';
}

export interface AdminSmtpSettings {
  enabled: boolean;
  provider: string;
  host: string;
  port: string;
  encryption: SmtpEncryption;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
}

export interface AdminWhatsAppSettings {
  enabled: boolean;
  baseUrl: string;
  session: string;
  apiKey: string;
  senderName: string;
}

export interface AdminProductSettings {
  maintenance: boolean;
  publicDiscovery: boolean;
  supportEmail: string;
  supportHours: string;
  privacyUrl: string;
  termsUrl: string;
  guidelinesUrl: string;
}

export interface AdminAppSettings {
  runtime: AdminRuntimeSettings;
  smtp: AdminSmtpSettings;
  whatsapp: AdminWhatsAppSettings;
  product: AdminProductSettings;
}

export interface DashboardStats {
  label: string;
  value: string;
  delta: string;
  direction: 'up' | 'down';
  tone: 'blue' | 'orange' | 'green' | 'slate';
}

export interface AdminSnapshot {
  users: AdminUser[];
  campaigns: Campaign[];
  proposals: Proposal[];
  categories: Category[];
}
