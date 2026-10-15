import { createReminderId } from "./reminders.service";
import * as SecureStore from "expo-secure-store";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { Platform } from "react-native";
import { API_BASE_URLS } from "../config/api";
import type { Campaign, CampaignDraft, ContentIdea, ContentIdeaAttachment, DemoAttachment, Influencer, MarketplaceApplication, MarketplaceApplicationStatus, MarketplaceConversationStatus, MarketplaceMessage, ProductionProject, ProductionStage, ProductionStagePayload, ReminderTone, TodoTask } from "../types/marketplace";

const ACCESS_TOKEN_KEY = "brandly.access-token";
const REFRESH_TOKEN_KEY = "brandly.refresh-token";
const API_REQUEST_TIMEOUT_MS = 30_000;
const MEDIA_UPLOAD_TIMEOUT_MS = 180_000;
const MEDIA_MAX_BYTES = 50 * 1024 * 1024;
const PROFILE_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
let sessionExpiredHandler: ((reason?: string) => void) | null = null;
let sessionExpiredNotified = false;
let refreshInFlight: Promise<string | null> | null = null;

export type ApiUser = {
  id: string;
  role: "BRAND" | "CREATOR" | "ADMIN";
  phone: string | null;
  email: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  onboardingComplete: boolean;
  onboardingStep?: "profile" | "details" | "social" | "verifying" | "review" | "success";
  profile: {
    displayName: string;
    bio: string;
    city: string;
    focus: string;
    avatarUrl?: string | null;
    websiteUrl?: string | null;
    audienceSize?: string | null;
    rateRange?: string | null;
    teamSize?: string | null;
    visibility: "PUBLIC" | "PRIVATE";
    languages?: string[] | null;
    locations?: string[] | null;
  } | null;
  socialAccounts: Array<{
    id: string;
    platform: string;
    handle: string;
    profileUrl?: string | null;
    displayName?: string | null;
    followerCount?: number | null;
    followingCount?: number | null;
    postCount?: number | null;
    profileImageUrl?: string | null;
    profileMetadata?: Record<string, unknown> | null;
    syncStatus: "IDLE" | "QUEUED" | "RUNNING" | "SYNCED" | "FAILED";
    syncError?: string | null;
    lastSyncedAt?: string | null;
    verificationMethod?: string | null;
    verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  }>;
};

export type ApiPublicProfile = {
  id: string;
  role: ApiUser["role"];
  profile: ApiUser["profile"];
  socialAccounts: Array<Pick<ApiUser["socialAccounts"][number], "platform" | "handle" | "profileUrl" | "displayName" | "followerCount" | "followingCount" | "postCount" | "profileImageUrl" | "profileMetadata" | "syncStatus" | "syncError" | "lastSyncedAt" | "verificationMethod" | "verificationStatus">>;
  campaignReviews?: { id: string; authorId: string; author: string; rating: number; text: string; date: string; campaignTitle: string }[];
  rating?: number;
  reviewCount?: number;
};
export type RemoteProfileInteractions = {
  savedIds: string[];
  blockedIds: string[];
  comparedIds: string[];
};
export type RemoteProfileDirectory = {
  profiles: ApiPublicProfile[];
  interactions: RemoteProfileInteractions;
};

export type AuthTokens = { accessToken: string; refreshToken: string; expiresIn: number; user: ApiUser };
export type SuspendedAuthResult = { suspended: true; reason: string; reactivationToken: string; userName: string; reviewStatus?: "PENDING" | "REJECTED"; resolutionNote?: string | null };
export type RemoteTask = TodoTask & {
  reminderAt?: string | null;
  reminderStatus?: TodoTask["reminderStatus"];
  reminderSentAt?: string | null;
  reminderStoppedAt?: string | null;
  history?: TodoTask["history"];
};
export type RemoteTaskInput = {
  clientId?: string;
  title: string;
  notes?: string;
  dueDate: string;
  dueTime: string;
  reminderEnabled?: boolean;
  reminderAt?: string | null;
  reminderTone?: ReminderTone;
  kind?: TodoTask["kind"];
  links?: string[];
  attachments?: DemoAttachment[];
  projectId?: string;
  stage?: string;
  campaignId?: string;
  conversationId?: string;
  sourceTaskId?: string;
  brandId?: string;
  creatorId?: string;
};
export type RemoteTaskQuery = {
  from?: string;
  to?: string;
  search?: string;
  remindersOnly?: boolean;
};

export type RemoteStudioSnapshot = { ideas: ContentIdea[]; projects: ProductionProject[] };
export type RemoteStudioIdeaInput = Omit<ContentIdea, "id" | "projectId" | "notes" | "createdAt" | "updatedAt"> & { attachment?: ContentIdeaAttachment };
export type RemoteCampaignSnapshot = { campaigns: Campaign[]; applications: MarketplaceApplication[] };
export type RemoteCampaignInput = CampaignDraft & { publish?: boolean; visibility?: "PUBLIC" | "PRIVATE" };
export type RemoteCampaignMatch = Influencer & { score: number; reasons: string[] };
export type RemoteChatMessage = MarketplaceMessage & {
  senderId?: string;
  clientMessageId?: string;
  createdAt?: string;
  deleted?: boolean;
  replyToId?: string;
};
export type RemoteChatConversation = {
  id: string;
  applicationId: string;
  campaignId: string;
  brandId: string;
  creatorId: string;
  participantName: string;
  participantInitials: string;
  participantAvatarUrl?: string | null;
  briefTitle: string;
  preview: string;
  status: MarketplaceConversationStatus;
  blockedBy: Array<"brand" | "creator">;
  updatedAt: string;
  unreadCount: number;
  online: boolean;
};
export type RemoteChatSnapshot = {
  hasMore?: boolean;
  nextCursor?: string;
  syncedAt?: string;
  conversationId: string;
  applicationId: string;
  campaignId: string;
  status: MarketplaceConversationStatus;
  canSend: boolean;
  blockedBy?: Array<"brand" | "creator">;
  participant: { id: string; name: string; avatarUrl?: string | null; online: boolean };
  messages: RemoteChatMessage[];
};
export type RemoteAdminChatAttachment = { id: string; name: string; type: "image" | "video" | "file"; uri: string } | { id: string; name: string; type: "social-review"; accountId: string; platform: string; handle: string; contentType: string; contentUrl: string };
export type RemoteAdminChatMessage = { id: string; text: string; mine: boolean; senderId: string; senderRole: "ADMIN" | "BRAND" | "CREATOR"; senderName: string; clientMessageId?: string | null; attachments?: RemoteAdminChatAttachment[]; replyToId?: string; replyTo?: { author: string; text: string }; createdAt: string; time: string; status: "delivered" | "seen"; readAt: string | null };
export type RemoteAdminChatConversation = { id: string; conversationId: string; participant: { id: string; name: "Brandly"; role: string; avatarUrl: null }; online: boolean; preview?: string; updatedAt?: string; unreadCount?: number };
export type RemoteAdminChatSnapshot = RemoteAdminChatConversation & { messages: RemoteAdminChatMessage[]; hasMore: boolean; nextCursor?: string };

async function persistStudioAttachment(attachment: ContentIdeaAttachment): Promise<ContentIdeaAttachment> {
  if (!isLocalMediaUri(attachment.uri)) return attachment;
  const uploaded = await uploadMediaFile(attachment.uri, { category: "project", name: attachment.name });
  if (!uploaded) throw new Error("Sign in is required before saving Studio media.");
  return { ...attachment, uri: uploaded.url, source: "upload" };
}

async function persistStudioIdeaMedia<T extends { attachment?: ContentIdeaAttachment }>(input: T): Promise<T> {
  return input.attachment ? { ...input, attachment: await persistStudioAttachment(input.attachment) } : input;
}

async function persistStudioStageMedia(data: ProductionStagePayload): Promise<ProductionStagePayload> {
  if (!data.attachments?.length) return data;
  return { ...data, attachments: await Promise.all(data.attachments.map(persistStudioAttachment)) } as ProductionStagePayload;
}
export type OtpChallenge = {
  challengeId: string;
  expiresIn: number;
  resendAfterSeconds?: number;
  destination: string;
  channel: "whatsapp";
};
export type EmailOtpChallenge = {
  challengeId: string;
  expiresIn: number;
  resendAfterSeconds?: number;
  destination: string;
  channel: "email";
  signupToken?: string;
};

class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly reason?: string) {
    super(message);
  }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => undefined);
}

async function request<T>(path: string, init: RequestInit, token?: string, timeoutMs = API_REQUEST_TIMEOUT_MS): Promise<T> {
  let lastNetworkError: unknown;
  for (const baseUrl of API_BASE_URLS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          // React Native's FormData can come from a different JS realm; checking
          // the body shape avoids forcing JSON content-type onto multipart data.
          ...(typeof init.body === "string" ? { "content-type": "application/json" } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });
      const body = await readJson(response);
      if (!response.ok) {
        const rawMessage = body && typeof body === "object" && "message" in body
          ? body.message
          : undefined;
        const parsedMessage = Array.isArray(rawMessage)
          ? rawMessage.filter((item): item is string => typeof item === "string").join(" ")
          : typeof rawMessage === "string" && rawMessage.trim()
            ? rawMessage
            : "";
        const message = parsedMessage || "The request could not be completed";
        const errorBody = body && typeof body === "object" ? body as { code?: unknown; reason?: unknown } : {};
        throw new ApiError(message, response.status, typeof errorBody.code === "string" ? errorBody.code : undefined, typeof errorBody.reason === "string" ? errorBody.reason : undefined);
      }
      return body as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError("The server took too long to respond. Please try again.", 408);
      }
      lastNetworkError = error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  void lastNetworkError;
  throw new ApiError("Unable to reach the server. Check that the API is running.", 0);
}

async function saveTokens(tokens: Pick<AuthTokens, "accessToken" | "refreshToken">): Promise<void> {
  sessionExpiredNotified = false;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

async function accessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getStoredAccessToken(): Promise<string | null> {
  return accessToken();
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = refreshAccessTokenOnce().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function refreshAccessTokenOnce(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  try {
    const tokens = await request<AuthTokens>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
    await saveTokens(tokens);
    return tokens.accessToken;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearTokens();
      return null;
    }
    throw error;
  }
}

async function expireSession(reason?: string): Promise<void> {
  if (sessionExpiredNotified) return;
  sessionExpiredNotified = true;
  await clearTokens();
  sessionExpiredHandler?.(reason);
}

async function authenticatedRequest<T>(path: string, init: RequestInit, timeoutMs = API_REQUEST_TIMEOUT_MS): Promise<T> {
  const token = await accessToken();
  try {
    return await request<T>(path, init, token ?? undefined, timeoutMs);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    if (error.code === "ACCOUNT_SUSPENDED") { await expireSession(error.reason || error.message); throw error; }
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      await expireSession();
      throw error;
    }
    try {
      return await request<T>(path, init, refreshed, timeoutMs);
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) await expireSession();
      throw retryError;
    }
  }
}

export function setSessionExpiredHandler(handler: ((reason?: string) => void) | null): void {
  sessionExpiredHandler = handler;
}

export async function requestOtp(input: {
  phone: string;
  intent: "signin" | "signup";
  role?: "BRAND" | "CREATOR";
  email?: string;
  displayName?: string;
  signupToken?: string;
}): Promise<OtpChallenge> {
  return request<OtpChallenge>("/auth/otp/request", { method: "POST", body: JSON.stringify(input) });
}

export async function requestEmailOtp(input: {
  email: string;
  phone: string;
  intent: "signup";
  role: "BRAND" | "CREATOR";
}): Promise<EmailOtpChallenge> {
  return request<EmailOtpChallenge>("/auth/email-otp/request", { method: "POST", body: JSON.stringify(input) });
}

export async function requestEmailSigninOtp(input: { email: string }): Promise<EmailOtpChallenge> {
  return request<EmailOtpChallenge>("/auth/email-otp/signin/request", { method: "POST", body: JSON.stringify(input) });
}

export async function verifyEmailOtp(input: {
  challengeId: string;
  code: string;
  email: string;
  signupToken: string;
}): Promise<{ emailVerified: boolean; signupToken: string }> {
  return request<{ emailVerified: boolean; signupToken: string }>("/auth/email-otp/verify", { method: "POST", body: JSON.stringify(input) });
}

export async function verifyEmailSigninOtp(input: {
  challengeId: string;
  code: string;
  email: string;
}): Promise<AuthTokens | SuspendedAuthResult> {
  const tokens = await request<AuthTokens | SuspendedAuthResult>("/auth/email-otp/signin/verify", { method: "POST", body: JSON.stringify(input) });
  if ("suspended" in tokens) return tokens;
  await saveTokens(tokens);
  return tokens;
}

export async function verifyOtp(input: {
  challengeId: string;
  code: string;
  role?: "BRAND" | "CREATOR";
  email?: string;
  displayName?: string;
  signupToken?: string;
}): Promise<AuthTokens | SuspendedAuthResult> {
  const tokens = await request<AuthTokens | SuspendedAuthResult>("/auth/otp/verify", { method: "POST", body: JSON.stringify(input) });
  if ("suspended" in tokens) return tokens;
  await saveTokens(tokens);
  return tokens;
}

export function submitReactivationRequest(token: string, message: string) {
  return request<{ id: string; status: "PENDING"; createdAt: string }>("/auth/reactivation-requests", { method: "POST", body: JSON.stringify({ token, message }) });
}

export async function restoreSession(timeoutMs = API_REQUEST_TIMEOUT_MS, clearOnError = true): Promise<ApiUser | null> {
  if (!(await accessToken()) && !(await SecureStore.getItemAsync(REFRESH_TOKEN_KEY))) return null;
  try {
    return await authenticatedRequest<ApiUser>("/auth/me", { method: "GET" }, timeoutMs);
  } catch (error) {
    if (clearOnError && error instanceof ApiError && error.status === 401) await expireSession();
    return null;
  }
}

export async function logout(): Promise<void> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  try {
    if (refreshToken) await authenticatedRequest("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) });
  } finally {
    await clearTokens();
  }
}

export async function updateRemoteProfile(input: Record<string, unknown>): Promise<ApiUser> {
  const payload = { ...input };
  const avatarUrl = typeof payload.avatarUrl === "string" ? payload.avatarUrl : "";
  if (isLocalMediaUri(avatarUrl)) {
    const uploaded = await uploadMediaFile(avatarUrl, {
      category: "profile",
      name: fileNameFromUri(avatarUrl, "profile-image.jpg"),
    });
    if (!uploaded) throw new Error("Sign in is required before saving a profile image.");
    payload.avatarUrl = uploaded.url;
  }
  return authenticatedRequest<ApiUser>("/profiles/me", { method: "PATCH", body: JSON.stringify(payload) });
}

export type MediaUploadCategory = "profile" | "campaign" | "chat" | "project" | "misc";
export type MediaUploadResult = { key: string; url: string; fileName: string; mimeType: string; size: number };

export function isLocalMediaUri(value: string): boolean {
  return /^(file|content|ph|assets-library):\/\//i.test(value);
}

function fileNameFromUri(uri: string, fallback: string): string {
  const value = decodeURIComponent(uri.split(/[?#]/)[0].split("/").pop() || "").trim();
  return value.replace(/[^a-zA-Z0-9._-]/g, "_") || fallback;
}

function mimeTypeFromFileName(name: string): string | undefined {
  const extension = name.toLowerCase().split(/[?#]/)[0].split(".").pop();
  return extension === "jpg" || extension === "jpeg" ? "image/jpeg"
    : extension === "png" ? "image/png"
      : extension === "webp" ? "image/webp"
        : extension === "gif" ? "image/gif"
          : extension === "mp4" ? "video/mp4"
            : extension === "mov" ? "video/quicktime"
              : extension === "webm" ? "video/webm"
                : extension === "pdf" ? "application/pdf"
                  : undefined;
}

function mediaUploadMessage(body: unknown): string {
  const rawMessage = body && typeof body === "object" && "message" in body ? body.message : undefined;
  return Array.isArray(rawMessage)
    ? rawMessage.filter((item): item is string => typeof item === "string").join(" ")
    : typeof rawMessage === "string" && rawMessage.trim()
      ? rawMessage
      : "The media upload could not be completed.";
}

function uploadNativeTask(task: FileSystemLegacy.UploadTask): Promise<FileSystemLegacy.FileSystemUploadResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      void task.cancelAsync().catch(() => undefined);
      reject(new ApiError("The media upload took too long. Please try again.", 408));
    }, MEDIA_UPLOAD_TIMEOUT_MS);
    task.uploadAsync().then((result) => {
      if (settled) return;
      clearTimeout(timer);
      if (!result) reject(new ApiError("The media upload was cancelled.", 408));
      else resolve(result);
    }).catch((error) => {
      if (settled) return;
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function uploadMediaNative(
  uri: string,
  options: { category: MediaUploadCategory; name: string; type: string },
  token?: string,
): Promise<MediaUploadResult> {
  let lastNetworkError: unknown;
  for (const baseUrl of API_BASE_URLS) {
    try {
      const task = FileSystemLegacy.createUploadTask(`${baseUrl}/media/upload`, uri, {
        uploadType: FileSystemLegacy.FileSystemUploadType.MULTIPART,
        fieldName: "file",
        mimeType: options.type,
        parameters: { category: options.category },
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
        httpMethod: "POST",
        sessionType: FileSystemLegacy.FileSystemSessionType.BACKGROUND,
      });
      const response = await uploadNativeTask(task);
      const body = response.body ? JSON.parse(response.body) as unknown : undefined;
      if (response.status < 200 || response.status >= 300) {
        throw new ApiError(mediaUploadMessage(body), response.status);
      }
      if (!body || typeof body !== "object") {
        throw new ApiError("The server returned an invalid media upload response.", 502);
      }
      return body as MediaUploadResult;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      lastNetworkError = error;
    }
  }
  void lastNetworkError;
  throw new ApiError("Unable to reach the server while uploading media. Check your connection and try again.", 0);
}

export async function uploadMediaFile(
  uri: string,
  options: { category: MediaUploadCategory; name?: string; type?: string },
): Promise<MediaUploadResult | null> {
  if (!isLocalMediaUri(uri)) return null;
  const [token, refreshToken] = await Promise.all([
    accessToken(),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  // Pre-auth onboarding may keep the local preview until account creation;
  // an existing refresh token must still go through authenticatedRequest so it
  // can refresh the access token before uploading.
  if (!token && !refreshToken) return null;
  const name = options.name || fileNameFromUri(uri, "attachment");
  const type = options.type || mimeTypeFromFileName(name) || (options.category === "profile" ? "image/jpeg" : "application/octet-stream");
  try {
    const info = await FileSystemLegacy.getInfoAsync(uri);
    const maxBytes = options.category === "profile" ? PROFILE_MEDIA_MAX_BYTES : MEDIA_MAX_BYTES;
    if (info.exists && typeof info.size === "number" && info.size > maxBytes) {
      throw new ApiError(`File size must be ${Math.round(maxBytes / (1024 * 1024))}MB or less.`, 413);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
  }

  if (Platform.OS === "web") {
    const form = new FormData();
    form.append("category", options.category);
    form.append("file", { uri, name, type } as unknown as Blob);
    return authenticatedRequest<MediaUploadResult>("/media/upload", { method: "POST", body: form }, MEDIA_UPLOAD_TIMEOUT_MS);
  }

  const uploadWithToken = (nextToken?: string) => uploadMediaNative(uri, { category: options.category, name, type }, nextToken);
  try {
    return await uploadWithToken(token ?? undefined);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    if (error.code === "ACCOUNT_SUSPENDED") { await expireSession(error.reason || error.message); throw error; }
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      await expireSession();
      throw error;
    }
    try {
      return await uploadWithToken(refreshed);
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) await expireSession();
      throw retryError;
    }
  }
}

export async function getRemotePublicProfile(userId: string): Promise<ApiPublicProfile> {
  return authenticatedRequest<ApiPublicProfile>(`/profiles/${encodeURIComponent(userId)}`, { method: "GET" });
}

export async function getRemoteProfileDirectory(input: { search?: string; role?: ApiUser["role"]; saved?: boolean } = {}): Promise<RemoteProfileDirectory> {
  const params = new URLSearchParams();
  if (input.search?.trim()) params.set("search", input.search.trim());
  if (input.role) params.set("role", input.role);
  if (input.saved) params.set("saved", "true");
  const query = params.toString();
  return authenticatedRequest<RemoteProfileDirectory>(`/profiles/discover${query ? `?${query}` : ""}`, { method: "GET" });
}

export async function getRemoteProfileInteractions(): Promise<RemoteProfileInteractions> {
  return authenticatedRequest<RemoteProfileInteractions>("/profiles/me/interactions", { method: "GET" });
}

export async function setRemoteProfileInteraction(
  type: "saved" | "blocked" | "compared",
  targetId: string,
  active: boolean,
): Promise<RemoteProfileInteractions> {
  return authenticatedRequest<RemoteProfileInteractions>(
    `/profiles/me/interactions/${type}/${encodeURIComponent(targetId)}`,
    { method: "PATCH", body: JSON.stringify({ active }) },
  );
}

export async function saveRemoteSocialAccount(input: { platform: string; handle: string; profileUrl?: string }): Promise<ApiUser["socialAccounts"][number]> {
  return authenticatedRequest<ApiUser["socialAccounts"][number]>("/profiles/me/social-accounts", { method: "POST", body: JSON.stringify(input) });
}

export async function syncRemoteSocialAccount(accountId: string): Promise<ApiUser["socialAccounts"][number]> {
  return authenticatedRequest<ApiUser["socialAccounts"][number]>(`/profiles/me/social-accounts/${encodeURIComponent(accountId)}/sync`, { method: "POST", body: JSON.stringify({}) });
}

export async function requestRemoteSocialVerification(accountId: string, input: { contentType: "profile" | "post" | "video" | "story"; contentUrl: string }) {
  return authenticatedRequest(`/profiles/me/social-accounts/${encodeURIComponent(accountId)}/verify`, { method: "POST", body: JSON.stringify(input) });
}

export async function registerRemoteDevice(token: string, platform: "ios" | "android" | "web", appVersion?: string, supportsLocalReminders = false, sessionActive = true) {
  return authenticatedRequest("/notifications/devices", { method: "POST", body: JSON.stringify({ token, platform, appVersion, supportsLocalReminders, sessionActive }) });
}

export async function getRemoteNotifications() {
  return authenticatedRequest<Array<{ id: string; type: string; title: string; body: string; data?: Record<string, string>; readAt?: string | null; createdAt?: string }>>("/notifications", { method: "GET" });
}

export type RemoteNotificationPreferences = {
  messages: boolean;
  profileActivity: boolean;
  proposalUpdates: boolean;
  taskUpdates: boolean;
};

export async function getRemoteNotificationPreferences(): Promise<RemoteNotificationPreferences> {
  return authenticatedRequest<RemoteNotificationPreferences>("/notifications/preferences", { method: "GET" });
}

export async function saveRemoteNotificationPreferences(preferences: RemoteNotificationPreferences): Promise<RemoteNotificationPreferences> {
  return authenticatedRequest<RemoteNotificationPreferences>("/notifications/preferences", { method: "PATCH", body: JSON.stringify(preferences) });
}

export async function markRemoteNotificationRead(id: string) {
  return authenticatedRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH", body: JSON.stringify({}) });
}

export async function getRemoteTasks(query: RemoteTaskQuery = {}): Promise<RemoteTask[]> {
  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return authenticatedRequest<RemoteTask[]>(`/tasks${params ? `?${params}` : ""}`, { method: "GET" });
}

const chatRequests = new Map<string, Promise<unknown>>();
async function chatGet<T>(path: string): Promise<T> {
  const key = `${await accessToken()}:${path}`;
  const pending = chatRequests.get(key);
  if (pending) return pending as Promise<T>;
  const request = authenticatedRequest<T>(path, { method: "GET" }).finally(() => chatRequests.delete(key));
  chatRequests.set(key, request);
  return request;
}

export async function getRemoteChatConversations(offset = 0, search = ""): Promise<RemoteChatConversation[]> {
  return chatGet<RemoteChatConversation[]>(`/chat/conversations?offset=${offset}&search=${encodeURIComponent(search)}`);
}

export async function getRemoteAdminChatConversation(): Promise<RemoteAdminChatConversation | null> {
  return chatGet<RemoteAdminChatConversation | null>("/chat/admin/conversation");
}
export async function openRemoteAdminChatConversation(): Promise<RemoteAdminChatConversation> {
  return authenticatedRequest<RemoteAdminChatConversation>("/chat/admin/conversation", { method: "POST", body: "{}" });
}
export async function getRemoteAdminChatMessages(conversationId: string, before?: string): Promise<RemoteAdminChatSnapshot> {
  return chatGet<RemoteAdminChatSnapshot>(`/chat/admin/conversations/${encodeURIComponent(conversationId)}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`);
}
export async function sendRemoteAdminChatMessage(conversationId: string, text: string, clientMessageId: string, attachments?: RemoteAdminChatMessage["attachments"], replyToId?: string): Promise<RemoteAdminChatMessage> {
  return authenticatedRequest<RemoteAdminChatMessage>(`/chat/admin/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", body: JSON.stringify({ text, clientMessageId, attachments, replyToId }) });
}
export async function markRemoteAdminChatRead(conversationId: string): Promise<void> {
  await authenticatedRequest(`/chat/admin/conversations/${encodeURIComponent(conversationId)}/read`, { method: "POST", body: "{}" });
}
export async function heartbeatRemoteAdminChat(conversationId: string): Promise<void> {
  await authenticatedRequest("/chat/admin/presence/heartbeat", { method: "POST", body: JSON.stringify({ conversationId }) });
}

export async function getRemoteChatMessages(applicationId: string, before?: string): Promise<RemoteChatSnapshot> {
  return chatGet<RemoteChatSnapshot>(`/chat/conversations/${encodeURIComponent(applicationId)}/messages?limit=30${before ? `&before=${encodeURIComponent(before)}` : ""}`);
}

export async function sendRemoteChatMessage(applicationId: string, input: { text?: string; attachments?: DemoAttachment[]; clientMessageId?: string; replyToId?: string; taskId?: string; campaignApplicationId?: string }): Promise<RemoteChatMessage> {
  return authenticatedRequest<RemoteChatMessage>(`/chat/conversations/${encodeURIComponent(applicationId)}/messages`, { method: "POST", body: JSON.stringify(input) });
}

export async function updateRemoteChatMessage(applicationId: string, messageId: string, input: { text?: string; attachments?: DemoAttachment[] }): Promise<RemoteChatMessage> {
  return authenticatedRequest<RemoteChatMessage>(`/chat/conversations/${encodeURIComponent(applicationId)}/messages/${encodeURIComponent(messageId)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function deleteRemoteChatMessage(applicationId: string, messageId: string): Promise<void> {
  await authenticatedRequest(`/chat/conversations/${encodeURIComponent(applicationId)}/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
}

const chatReads = new Map<string, { dirty: boolean; promise: Promise<void> }>();
export async function markRemoteChatRead(applicationId: string): Promise<void> {
  const key = `${await accessToken()}:${applicationId}`;
  const pending = chatReads.get(key);
  if (pending) { pending.dirty = true; return pending.promise; }
  const state = { dirty: true, promise: Promise.resolve() };
  state.promise = (async () => {
    do {
      await new Promise((resolve) => setTimeout(resolve, 200));
      state.dirty = false;
      await authenticatedRequest(`/chat/conversations/${encodeURIComponent(applicationId)}/read`, { method: "POST", body: JSON.stringify({}) });
    } while (state.dirty);
  })().finally(() => chatReads.delete(key));
  chatReads.set(key, state);
  return state.promise;
}

let presenceQueue = Promise.resolve();
export async function sendChatPresenceHeartbeat(applicationId?: string): Promise<void> {
  presenceQueue = presenceQueue.catch(() => undefined).then(async () => {
    await authenticatedRequest("/chat/presence/heartbeat", { method: "POST", body: JSON.stringify(applicationId ? { applicationId } : {}) });
  });
  return presenceQueue;
}

export async function markChatOffline(): Promise<void> {
  presenceQueue = presenceQueue.catch(() => undefined).then(async () => {
    await authenticatedRequest("/chat/presence/offline", { method: "POST", body: JSON.stringify({}) });
  });
  return presenceQueue;
}

export async function sendChatTyping(applicationId: string, typing: boolean): Promise<void> {
  await authenticatedRequest("/chat/typing", {
    method: "POST",
    body: JSON.stringify({ applicationId, typing }),
  });
}

export async function getChatSocketUrl(): Promise<string | null> {
  let token = await getStoredAccessToken();
  if (token) {
    try {
      const payload = JSON.parse(globalThis.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now() + 60_000) token = await refreshAccessToken();
    } catch { /* The websocket authenticates malformed tokens. */ }
  }
  if (!token || !API_BASE_URLS[0]) return null;
  const baseUrl = API_BASE_URLS[0].replace(/\/v1\/?$/i, "").replace(/^http/i, "ws");
  return `${baseUrl}/chat/socket?accessToken=${encodeURIComponent(token)}`;
}

export async function getRemoteStudio(): Promise<RemoteStudioSnapshot> {
  return authenticatedRequest<RemoteStudioSnapshot>("/studio", { method: "GET" });
}

const campaignDeadlineAt = (deadline?: string) => {
  const value = deadline?.trim();
  if (!value || value === "Flexible") return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T23:59:59.999Z`;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
};

async function persistCampaignMedia(items: DemoAttachment[] | undefined): Promise<DemoAttachment[]> {
  return Promise.all((items ?? []).map(async (item) => {
    if (!item.uri || !isLocalMediaUri(item.uri)) return item;
    const uploaded = await uploadMediaFile(item.uri, { category: "campaign", name: item.name });
    if (!uploaded) throw new Error("Sign in is required before saving campaign media.");
    return { ...item, uri: uploaded.url };
  }));
}

async function persistTaskMedia<T extends { attachments?: DemoAttachment[] }>(input: T): Promise<T> {
  if (!input.attachments?.length) return input;
  return {
    ...input,
    attachments: await Promise.all(input.attachments.map(async (item) => {
      if (!item.uri || !isLocalMediaUri(item.uri)) return item;
      const uploaded = await uploadMediaFile(item.uri, { category: "misc", name: item.name });
      if (!uploaded) throw new Error("Sign in is required before saving task media.");
      return { ...item, uri: uploaded.url };
    })),
  };
}

const campaignPayload = async (input: RemoteCampaignInput) => {
  const deadlineAt = campaignDeadlineAt(input.deadline);
  const hasApplicationLimit = input.applicationLimit !== undefined && input.applicationLimit !== null;
  const hasApprovalLimit = input.approvalLimit !== undefined && input.approvalLimit !== null;
  return {
    title: input.title,
    description: input.description,
    targetLocations: [input.city].filter(Boolean),
    city: input.city,
    category: input.category,
    budget: input.budget,
    ...(deadlineAt ? { deadlineAt } : {}),
    platforms: input.platforms ?? [],
    deliverables: input.deliverables ?? "",
    requirements: input.requirements ?? [],
    creatorRequirements: input.creatorRequirements ?? "",
    media: await persistCampaignMedia(input.media),
    collaborationVideoUrl: input.collaborationVideoUrl ?? "",
    collaborationVideoLabel: input.collaborationVideoLabel ?? "",
    ...(input.minimumFollowers !== undefined ? { minimumFollowers: input.minimumFollowers } : {}),
    ...(hasApplicationLimit ? { applicationLimit: input.applicationLimit, closeOnApplicationLimit: input.closeOnApplicationLimit ?? true } : {}),
    ...(hasApprovalLimit ? { approvalLimit: input.approvalLimit, closeOnApprovalLimit: input.closeOnApprovalLimit ?? true } : {}),
    ...(input.visibility ? { visibility: input.visibility } : {}),
    ...(input.publish !== undefined ? { publish: input.publish } : {}),
  };
};

export async function getRemoteCampaigns(search?: string, creatorId?: string): Promise<RemoteCampaignSnapshot> {
  const params = new URLSearchParams();
  if (search?.trim()) params.set("search", search.trim());
  if (creatorId) params.set("creatorId", creatorId);
  return chatGet<RemoteCampaignSnapshot>(`/campaigns${params.size ? `?${params}` : ""}`);
}

export async function createRemoteCampaign(input: RemoteCampaignInput): Promise<Campaign> {
  return authenticatedRequest<Campaign>("/campaigns", { method: "POST", body: JSON.stringify(await campaignPayload(input)) });
}

export async function updateRemoteCampaign(id: string, input: RemoteCampaignInput): Promise<Campaign> {
  return authenticatedRequest<Campaign>(`/campaigns/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(await campaignPayload(input)) });
}

export async function archiveRemoteCampaign(id: string): Promise<Campaign> {
  return authenticatedRequest<Campaign>(`/campaigns/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getRemoteCampaignMatches(id: string): Promise<RemoteCampaignMatch[]> {
  return authenticatedRequest<RemoteCampaignMatch[]>(`/campaigns/${encodeURIComponent(id)}/matches`, { method: "GET" });
}

export async function createRemoteCampaignApplication(id: string, input: { message?: string; responses?: Record<string, string>; attachments?: DemoAttachment[]; contactShared?: boolean }): Promise<MarketplaceApplication> {
  return authenticatedRequest<MarketplaceApplication>(`/campaigns/${encodeURIComponent(id)}/applications`, { method: "POST", body: JSON.stringify({ ...input, attachments: await persistCampaignMedia(input.attachments) }) });
}

export async function inviteRemoteCampaignCreator(id: string, creatorId: string, message?: string): Promise<MarketplaceApplication> {
  return authenticatedRequest<MarketplaceApplication>(`/campaigns/${encodeURIComponent(id)}/invitations`, { method: "POST", body: JSON.stringify({ creatorId, message }) });
}

export async function updateRemoteCampaignApplication(applicationId: string, status: MarketplaceApplicationStatus, options?: { rejectionReason?: string; allowReapply?: boolean }): Promise<MarketplaceApplication> {
  const serverStatus = status === "Accepted" ? "ACCEPTED" : status === "Declined" ? "DECLINED" : status === "Blocked" ? "DECLINED" : "WITHDRAWN";
  return authenticatedRequest<MarketplaceApplication>(`/campaigns/applications/${encodeURIComponent(applicationId)}`, { method: "PATCH", body: JSON.stringify({ status: serverStatus, ...options }) });
}

export async function confirmRemoteCampaignCompletion(applicationId: string): Promise<{ applicationId: string; completedAt: string | null; brandConfirmed: boolean; creatorConfirmed: boolean }> {
  return authenticatedRequest(`/campaigns/applications/${encodeURIComponent(applicationId)}/completion`, { method: "POST" });
}

export async function createRemoteCampaignReview(applicationId: string, input: { rating: number; text: string }) {
  return authenticatedRequest<{ id: string; applicationId: string; authorId: string; subjectId: string; rating: number; text: string; createdAt: string }>(`/campaigns/applications/${encodeURIComponent(applicationId)}/reviews`, { method: "POST", body: JSON.stringify(input) });
}

export async function updateRemoteCampaignPayment(applicationId: string, input: { amount: string; paid: boolean }) {
  return authenticatedRequest<{ applicationId: string; amount: string; paidAt: string | null; updatedAt: string }>(`/campaigns/applications/${encodeURIComponent(applicationId)}/payment`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function createRemoteStudioIdea(input: RemoteStudioIdeaInput): Promise<ContentIdea> {
  return authenticatedRequest<ContentIdea>("/studio/ideas", { method: "POST", body: JSON.stringify(await persistStudioIdeaMedia(input)) });
}

export async function updateRemoteStudioIdea(id: string, input: Partial<RemoteStudioIdeaInput> & { archived?: boolean; notes?: ContentIdea["notes"] }): Promise<ContentIdea> {
  const mediaInput = "attachment" in input ? await persistStudioIdeaMedia(input) : input;
  return authenticatedRequest<ContentIdea>(`/studio/ideas/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(mediaInput) });
}

export async function addRemoteStudioNote(id: string, text: string): Promise<ContentIdea> {
  return authenticatedRequest<ContentIdea>(`/studio/ideas/${encodeURIComponent(id)}/notes`, { method: "POST", body: JSON.stringify({ text }) });
}

export async function updateRemoteStudioNote(id: string, noteId: string, text: string): Promise<ContentIdea> {
  return authenticatedRequest<ContentIdea>(`/studio/ideas/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`, { method: "PATCH", body: JSON.stringify({ text }) });
}

export async function removeRemoteStudioNote(id: string, noteId: string): Promise<ContentIdea> {
  return authenticatedRequest<ContentIdea>(`/studio/ideas/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`, { method: "DELETE" });
}

export async function createRemoteStudioProject(ideaId: string): Promise<ProductionProject> {
  return authenticatedRequest<ProductionProject>(`/studio/ideas/${encodeURIComponent(ideaId)}/project`, { method: "POST", body: JSON.stringify({}) });
}

export async function updateRemoteStudioProject(id: string, input: { dueDate?: string | null; assignedTo?: string; archived?: boolean }): Promise<ProductionProject> {
  return authenticatedRequest<ProductionProject>(`/studio/projects/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function updateRemoteStudioStage(id: string, stage: ProductionStage, data: ProductionStagePayload, complete = false): Promise<ProductionProject> {
  return authenticatedRequest<ProductionProject>(`/studio/projects/${encodeURIComponent(id)}/stages/${encodeURIComponent(stage)}`, { method: "PATCH", body: JSON.stringify({ data: await persistStudioStageMedia(data), complete }) });
}

export async function createRemoteTask(input: RemoteTaskInput): Promise<RemoteTask> {
  return authenticatedRequest<RemoteTask>("/tasks", { method: "POST", body: JSON.stringify({ ...(await persistTaskMedia(input)), clientId: input.clientId ?? createReminderId() }) });
}

export async function updateRemoteTask(id: string, input: Partial<RemoteTaskInput> & { completed?: boolean; expectedReminderAt?: string }): Promise<RemoteTask> {
  const { clientId: _clientId, sourceTaskId: _sourceTaskId, brandId: _brandId, creatorId: _creatorId, ...updateInput } = input;
  return authenticatedRequest<RemoteTask>(`/tasks/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(await persistTaskMedia(updateInput)) });
}

export async function deleteRemoteTask(id: string): Promise<void> {
  await authenticatedRequest(`/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function shareRemoteTask(id: string, userId: string): Promise<RemoteTask> {
  return authenticatedRequest<RemoteTask>(`/tasks/${encodeURIComponent(id)}/share`, { method: "POST", body: JSON.stringify({ userId }) });
}

export async function addRemoteTaskNote(id: string, text: string): Promise<RemoteTask> {
  return authenticatedRequest<RemoteTask>(`/tasks/${encodeURIComponent(id)}/notes`, { method: "POST", body: JSON.stringify({ text }) });
}

export async function updateRemoteTaskNote(id: string, noteId: string, text: string): Promise<RemoteTask> {
  return authenticatedRequest<RemoteTask>(`/tasks/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`, { method: "PATCH", body: JSON.stringify({ text }) });
}

export async function removeRemoteTaskNote(id: string, noteId: string): Promise<RemoteTask> {
  return authenticatedRequest<RemoteTask>(`/tasks/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`, { method: "DELETE" });
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
