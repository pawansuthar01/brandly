import type { AdminAppSettings, AdminSnapshot, AdminUser, Campaign, Category, VersionConfig } from '@/types/admin';
import { readAdminSession } from '@/lib/admin-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV === 'production' ? 'https://api.brandly.pawansuthar.in/v1' : 'http://localhost:3000/v1');

/** Resolve media paths from old/local records against the configured API host. */
export function resolveAdminMediaUrl(value: string | null | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const configuredApi = new URL(API_BASE_URL);
  const raw = value.trim();
  try {
    const relative = raw.replace(/^\/+/, '');
    const candidate = /^https?:\/\//i.test(raw)
      ? new URL(raw)
      : relative.startsWith('v1/')
        ? new URL(`/${relative}`, configuredApi.origin)
        : new URL(relative, `${configuredApi.origin}${configuredApi.pathname.replace(/\/+$/, '')}/`);
    const isApiMedia = candidate.pathname.includes('/media/files/');
    if (isApiMedia || ['localhost', '127.0.0.1', '0.0.0.0'].includes(candidate.hostname) && !['localhost', '127.0.0.1', '0.0.0.0'].includes(configuredApi.hostname)) {
      candidate.protocol = configuredApi.protocol;
      candidate.host = configuredApi.host;
      if (isApiMedia && candidate.pathname.startsWith('/media/files/') && configuredApi.pathname.endsWith('/v1')) {
        candidate.pathname = `${configuredApi.pathname}${candidate.pathname}`;
      }
    }
    return candidate.toString();
  } catch {
    return raw;
  }
}

type AppSettingsResponse = { settings: AdminAppSettings; versions: VersionConfig[] };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = readAdminSession();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(session?.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? body.message : undefined;
    throw new Error(Array.isArray(message) ? message.join(' ') : typeof message === 'string' ? message : 'Admin API request failed');
  }
  return body as T;
}

export async function loginAdmin(email: string, password: string) {
  return request<{ accessToken: string; expiresIn: number; email: string; role: 'Owner' | 'Moderator' }>('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function getAdminAppSettings(): Promise<AppSettingsResponse> {
  return request<AppSettingsResponse>('/admin/settings/app');
}

export function saveAdminAppSettings(settings: AdminAppSettings, versions: VersionConfig[]): Promise<AppSettingsResponse> {
  return request<AppSettingsResponse>('/admin/settings/app', {
    method: 'PUT',
    body: JSON.stringify({ settings, versions }),
  });
}

export function deleteAdminAppSettings(): Promise<AppSettingsResponse> {
  return request<AppSettingsResponse>('/admin/settings/app', { method: 'DELETE' });
}

type AdminOverview = Pick<AdminSnapshot, 'users' | 'campaigns' | 'proposals'>;

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
  const data = await request<AdminOverview>('/admin/overview?take=200');
  const categoryCounts = new Map<string, number>();
  data.campaigns.forEach((campaign) => categoryCounts.set(campaign.category, (categoryCounts.get(campaign.category) ?? 0) + 1));
  const categories: Category[] = Array.from(categoryCounts.entries()).map(([name, usage]) => ({ id: name, name, group: 'Category', usage, status: 'Active' }));
  return { ...data, categories };
}

export function suspendUser(id: string, suspended: boolean, reason?: string): Promise<{ id: string; status: AdminUser['status'] }> {
  return request(`/admin/users/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ suspended, ...(suspended ? { reason } : {}) }) });
}

export async function updateCampaignStatus(id: string, status: 'Archived' | 'Private'): Promise<void> {
  await request<{ id: string; status: Campaign['status'] }>(`/admin/campaigns/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status: status.toUpperCase() }) });
}

export type AdminNotificationRecord = {
  id: string; userId: string; userName: string; title: string; message: string; type: string;
  source: 'App' | 'Admin'; channel: 'Push' | 'Email' | 'WhatsApp'; sentBy: string;
  createdAt: string; read: boolean; deliveryStatus?: string; deliveredAt?: string | null; lastDeliveryError?: string | null; actionLabel?: string; actionUrl?: string;
};

export function getAdminNotifications(): Promise<AdminNotificationRecord[]> {
  return request('/notifications/admin/logs');
}

export function sendAdminNotifications(input: { userIds: string[]; title: string; body: string; channels: Array<'PUSH' | 'EMAIL' | 'WHATSAPP'>; data?: Record<string, string> }) {
  return request<{ requested: number; completed: number; failed: number; delivery: { delivered: number; accepted: number; pending: number; failed: number } }>('/notifications/admin/send-bulk', { method: 'POST', body: JSON.stringify({ type: 'ADMIN_ANNOUNCEMENT', ...input }) });
}

export async function sendAdminNotification(value: { userId: string; title: string; message: string; channel?: string; actionLabel?: string; actionUrl?: string }) {
  return sendAdminNotifications({
    userIds: [value.userId], title: value.title, body: value.message,
    channels: value.channel === 'Email' ? ['EMAIL'] : value.channel === 'All' ? ['PUSH', 'EMAIL', 'WHATSAPP'] : ['PUSH'],
    data: { ...(value.actionLabel ? { actionLabel: value.actionLabel } : {}), ...(value.actionUrl ? { actionUrl: value.actionUrl } : {}) },
  });
}

export type AdminSocialReview = {
  id: string; platform: string; handle: string; profileUrl: string | null; displayName: string | null;
  followerCount: number | null; followingCount: number | null; postCount: number | null; profileImageUrl: string | null;
  syncStatus: string; syncError: string | null; createdAt: string;
  user: { id: string; role: 'Brand' | 'Creator'; status: string; email: string | null; phone: string | null; joinedAt: string; name: string; city: string; bio: string; avatarUrl: string | null; visibility: string; profileCompleted: number };
  contentRequest: { id: string; contentType: string; contentUrl: string; createdAt: string } | null;
};
export function getAdminSocialReviews(offset = 0) {
  return request<{ items: AdminSocialReview[]; nextOffset: number | null }>(`/profiles/admin/social-reviews?take=25&offset=${offset}`);
}
export function reviewAdminSocialAccount(id: string) {
  return request<{ id: string; userId: string; platform: string; status: string; reviewedAt: string; notificationQueued: boolean }>(`/profiles/admin/social-reviews/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({ status: 'VERIFIED' }),
  });
}

export type AdminChatUser = { id: string; name: string; email: string | null; role: 'Brand' | 'Creator'; status: string; avatarUrl?: string | null; city?: string | null; conversationId: string | null; preview: string; updatedAt: string | null; unreadCount: number; online: boolean };
export type AdminChatAttachment = { id: string; name: string; type: 'image' | 'video' | 'file'; uri: string };
export type AdminChatMessage = { id: string; text: string; mine: boolean; senderId: string; senderRole: 'ADMIN' | 'BRAND' | 'CREATOR'; senderName: string; clientMessageId?: string | null; attachments?: AdminChatAttachment[]; createdAt: string; time: string; status: 'delivered' | 'seen'; readAt: string | null };
export type AdminChatSnapshot = { id: string; conversationId: string; participant: { id: string; name: string; role: string; avatarUrl: string | null }; online: boolean; messages: AdminChatMessage[]; hasMore: boolean; nextCursor?: string };
export function getAdminChatUsers(search = '', offset = 0) { return request<{ items: AdminChatUser[]; nextOffset: number | null }>(`/admin/chats/users?take=30&offset=${offset}&search=${encodeURIComponent(search)}`); }
export function openAdminChat(userId: string) { return request<Omit<AdminChatSnapshot, 'messages' | 'hasMore'>>(`/admin/chats/users/${encodeURIComponent(userId)}/conversation`, { method: 'POST', body: '{}' }); }
export function getAdminChatMessages(conversationId: string, before?: string) { return request<AdminChatSnapshot>(`/admin/chats/conversations/${encodeURIComponent(conversationId)}/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`); }
export function sendAdminChatMessage(conversationId: string, text: string, clientMessageId: string, attachments?: AdminChatAttachment[]) { return request<AdminChatMessage>(`/admin/chats/conversations/${encodeURIComponent(conversationId)}/messages`, { method: 'POST', body: JSON.stringify({ text, clientMessageId, attachments }) }); }
export function markAdminChatRead(conversationId: string) { return request<{ read: number }>(`/admin/chats/conversations/${encodeURIComponent(conversationId)}/read`, { method: 'POST', body: '{}' }); }
export function heartbeatAdminChat(conversationId: string) { return request<{ online: boolean }>(`/admin/chats/conversations/${encodeURIComponent(conversationId)}/heartbeat`, { method: 'POST', body: '{}' }); }
export type AdminChatReport = { id: string; conversationId: string; userId: string; userName: string; email: string | null; role: 'Brand' | 'Creator'; type: 'FEEDBACK' | 'BUG_REPORT'; message: string; attachments: AdminChatAttachment[]; createdAt: string };
export function getAdminChatReports(type: 'ALL' | 'FEEDBACK' | 'BUG_REPORT' = 'ALL', before?: string) { return request<{ items: AdminChatReport[]; nextCursor: string | null }>(`/admin/chats/reports?type=${type}&take=25${before ? `&before=${encodeURIComponent(before)}` : ''}`); }
export type AccountReactivationRequest = { id: string; userId: string; message: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; reviewerId: string | null; reviewedAt: string | null; resolutionNote: string | null; createdAt: string; user: { id: string; role: string; status: string; email: string | null; suspensionReason: string | null; suspendedAt: string | null; profile: { displayName: string; avatarUrl: string | null } | null } };
export function getAccountReactivationRequests(offset = 0) { return request<{ items: AccountReactivationRequest[]; nextOffset: number | null }>(`/admin/account-reactivations?take=25&offset=${offset}`); }
export function reviewAccountReactivation(id: string, status: 'APPROVED' | 'REJECTED', resolutionNote?: string) { return request<AccountReactivationRequest>(`/admin/account-reactivations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status, resolutionNote }) }); }
export async function uploadAdminChatAttachment(file: File): Promise<AdminChatAttachment> {
  const session = readAdminSession();
  if (!session?.accessToken) throw new Error('Admin sign-in is required to upload a file.');
  const form = new FormData(); form.append('category', 'chat'); form.append('file', file, file.name);
  const response = await fetch(`${API_BASE_URL}/media/upload`, { method: 'POST', headers: { authorization: `Bearer ${session.accessToken}` }, body: form });
  const body = await response.json().catch(() => undefined) as { url?: string; message?: string | string[] } | undefined;
  if (!response.ok || !body?.url) throw new Error(Array.isArray(body?.message) ? body.message.join(' ') : typeof body?.message === 'string' ? body.message : 'The attachment could not be uploaded.');
  return { id: crypto.randomUUID(), name: file.name, type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file', uri: body.url };
}
export function getAdminChatSocketUrl() {
  const token = readAdminSession()?.accessToken;
  if (!token) return null;
  return `${API_BASE_URL.replace(/^http/, 'ws').replace(/\/v1\/?$/, '')}/chat/socket?accessToken=${encodeURIComponent(token)}`;
}

export type AdminTheme = { schemaVersion: 1; name: string; content?: Record<string, string>; tokens: { colors: Record<'light' | 'dark', Record<string, string>>; gradients?: Record<'light' | 'dark', Record<'top' | 'right' | 'bottom' | 'left', string>>; typography: Record<string, { size: number; lineHeight: number; weight: string; family: string }>; spacing: Record<string, number>; radius: Record<string, number>; opacity: { disabled: number; overlay: Record<'light' | 'dark', number> }; borders: { width: number }; elevation: Record<string, number>; shadows: Record<'light' | 'dark', { color: string; card: number; floating: number; modal: number; cardRadius: number; floatingRadius: number; modalRadius: number }>; components: Record<string, Record<string, string | number>>; pages: Record<string, Record<string, string | number>>; pageComponents?: Record<string, Record<string, Record<string, string | number>>>; pageGroups?: Record<string, { pages: string[]; colors: Record<string, string>; followRegistry?: boolean }> } };
export type ThemeDraft = { id: string; name: string; revision: number; document: AdminTheme; changeNote: string; updatedAt: string; updatedBy: string };
export type ThemeDraftSummary = Omit<ThemeDraft, 'document'> & { publishedRevision: number | null };
export type ThemeVersionSummary = { id: string; name: string; revision: number; changeNote: string; sourceId: string | null; authorId: string; createdAt: string; active?: boolean };
export type ThemeVersion = ThemeVersionSummary & { document: AdminTheme };
export function getActiveTheme() { return request<{ id: string; name: string; revision: number; published: boolean; theme: AdminTheme }>('/app-themes/active'); }
export function getThemeDrafts(cursor?: string) { return request<{ items: ThemeDraftSummary[]; nextCursor: string | null }>(`/admin/themes/drafts?take=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`); }
export function getThemeDraft(id: string) { return request<ThemeDraft>(`/admin/themes/drafts/${id}`); }
export function createThemeDraft(theme: AdminTheme, name: string, changeNote = '') { return request<ThemeDraft>('/admin/themes/drafts', { method: 'POST', body: JSON.stringify({ theme, name, changeNote }) }); }
export function saveThemeDraft(draft: ThemeDraft, theme: AdminTheme, name: string, changeNote: string) { return request<ThemeDraft>(`/admin/themes/drafts/${draft.id}`, { method: 'PUT', body: JSON.stringify({ theme, name, changeNote, expectedRevision: draft.revision }) }); }
export function publishThemeDraft(draft: Pick<ThemeDraft, 'id' | 'revision'>, changeNote: string) { return request<ThemeVersion>(`/admin/themes/drafts/${draft.id}/publish`, { method: 'POST', body: JSON.stringify({ expectedRevision: draft.revision, changeNote }) }); }
export function getThemeVersions(cursor?: string) { return request<{ items: ThemeVersionSummary[]; nextCursor: string | null }>(`/admin/themes/versions?take=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`); }
export function getThemeVersion(id: string) { return request<ThemeVersion>(`/admin/themes/versions/${id}`); }
export function activateThemeVersion(id: string) { return request<{ version: ThemeVersion; restored: boolean }>(`/admin/themes/versions/${id}/activate`, { method: 'POST', body: '{}' }); }
export function getThemeActivations(cursor?: string) { return request<{ items: Array<{ id: string; action: string; actorId: string; createdAt: string; version: ThemeVersionSummary }>; nextCursor: string | null }>(`/admin/themes/activations?take=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`); }
