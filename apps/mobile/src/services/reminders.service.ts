import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { requireOptionalNativeModule } from "expo";
import type { DateTriggerInput, Notification } from "expo-notifications";
import { getReminderTone, REMINDER_TONES } from "../lib/reminderTones";
import { formatReminderDate, formatReminderTime, parseReminderDateTime } from "../lib/reminders";
import type { Reminder, ReminderSettings, ReminderTone, TodoTask } from "../types/marketplace";
import { getDailyStreak, streakReminderDate } from "../lib/streak";

type NotificationsModule = typeof import("expo-notifications");
let notificationsModulePromise: Promise<NotificationsModule | null> | undefined;
const REMOTE_PUSH_TOKEN_KEY = "brandly.remote-push-token";

export function getNotificationsModule() {
  // Local scheduled notifications work in Expo Go. Remote push still needs a development build.
  if (Platform.OS === "web") return Promise.resolve(null);
  return (notificationsModulePromise ??= import("expo-notifications").catch(() => null));
}

export async function registerForRemotePushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const Notifications = await getNotificationsModule();
  if (!Notifications) throw new Error("Remote push is unavailable in this app build. Install the Android/iOS app build, not Expo Go or web.");
  await configureReminderNotifications().catch((error) => console.warn("[push] Reminder notification setup failed", error));
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("chat-messages", {
    name: "Chat messages", importance: Notifications.AndroidImportance.HIGH, sound: "default",
    vibrationPattern: [0, 200], lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  }).catch((error) => console.warn("[push] Chat notification channel setup failed", error));
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    if (requested.status !== "granted") return AsyncStorage.getItem(REMOTE_PUSH_TOKEN_KEY);
  }
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) throw new Error("Expo project ID is missing from this app build.");
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!/^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/.test(token.data)) {
      throw new Error("Expo returned an invalid push token. Rebuild the app with the Brandly EAS project configuration.");
    }
    await AsyncStorage.setItem(REMOTE_PUSH_TOKEN_KEY, token.data).catch((error) => console.warn("[push] Push token cache write failed", error));
    return token.data;
  } catch (error) {
    console.warn("[push] Expo token request failed", error);
    const cachedToken = await AsyncStorage.getItem(REMOTE_PUSH_TOKEN_KEY);
    if (cachedToken) return cachedToken;
    throw error;
  }
}

// Android notification channels keep their original sound forever. Versioning
// the channel is required when an earlier build created it without sound.
// Android notification channels are immutable after creation. Bump this when
// the alarm sound changes so installed builds receive a fresh long-alarm channel.
const channelPrefix = "delivery-reminders-v5";
const EXACT_TRIGGER_TOLERANCE_MS = 5_000;
let previewNotificationId: string | undefined;
let previewRequest = 0;
let previewAudioPlayer: { play: () => void; pause: () => void; remove: () => void; volume: number; loop: boolean } | undefined;
let previewAudioTimer: ReturnType<typeof setTimeout> | undefined;
let reminderQueue = Promise.resolve();
function withReminderLock<T>(work: () => Promise<T>): Promise<T> {
  const next = reminderQueue.catch(() => undefined).then(work);
  reminderQueue = next.then(() => undefined, () => undefined);
  return next;
}
export type ReminderAction = {
  reminderId: string; taskId?: string; ownerId?: string; sourceDueAt: number;
  handledNotificationId: string; stopped: boolean; dueAt: number;
  changedAt: number; notificationId?: string; synced?: boolean; error?: string;
};
let nativeReminder: {
  setOwner(userId: string): Promise<void>;
  createUUID(): string;
  canScheduleExactAlarms(): Promise<boolean>;
  getActions?: () => Promise<Record<string, ReminderAction>>;
  setAction?: (id: string, action: ReminderAction) => Promise<void>;
  removeAction?: (id: string) => Promise<void>;
  scheduleReminder?: (options: {
    reminderId: string;
    triggerAtMillis: number;
    title: string;
    body: string;
    soundFile: string;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
    snoozeMinutes: number;
    ownerId: string;
    taskId?: string | null;
  }) => Promise<string>;
  cancelReminder?: (reminderId: string) => Promise<void>;
  cancelAllReminders?: () => Promise<void>;
} | null = null;

// The reminder module is optional on web, Expo Go, and older installed builds.
// A missing native module must disable exact alarms, never prevent the app from
// rendering its first screen.
try {
  nativeReminder = requireOptionalNativeModule<typeof nativeReminder>("ReminderNative");
} catch {
  nativeReminder = null;
}
export function createReminderId(): string {
  if (nativeReminder?.createUUID) return nativeReminder.createUUID();
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (value) => {
    const random = Math.floor(Math.random() * 16);
    return (value === "x" ? random : (random & 3) | 8).toString(16);
  });
}
const ACTION_KEY = "brandly.reminder-actions.v1";
const OWNER_KEY = "brandly.reminder-owner.v1";
export async function readReminderActions(): Promise<Record<string, ReminderAction>> {
  const value = JSON.parse(await AsyncStorage.getItem(ACTION_KEY) ?? "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Saved reminder actions are invalid");
  if (!nativeReminder) return value;
  return nativeReminder.getActions ? { ...value, ...(await nativeReminder.getActions()) } : value;
}
async function writeReminderAction(action: ReminderAction) {
  const actions = await readReminderActions();
  actions[action.reminderId] = action;
  await AsyncStorage.setItem(ACTION_KEY, JSON.stringify(actions));
  if (nativeReminder?.setAction) await nativeReminder.setAction(action.reminderId, JSON.parse(JSON.stringify(action)));
}
export function clearReminderAction(id: string, expectedChangedAt?: number) {
  return withReminderLock(async () => {
    if (expectedChangedAt !== undefined && (await readReminderActions())[id]?.changedAt !== expectedChangedAt) return;
    const actions = await readReminderActions();
    delete actions[id];
    await AsyncStorage.setItem(ACTION_KEY, JSON.stringify(actions));
    if (nativeReminder?.removeAction) await nativeReminder.removeAction(id);
  });
}
export function setReminderOwner(userId?: string | null) {
  return withReminderLock(async () => {
    await AsyncStorage.setItem(OWNER_KEY, userId ?? "");
    if (nativeReminder?.setOwner) await nativeReminder.setOwner(userId ?? "");
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await cancelReminderNotifications(scheduled.filter((item) => {
      const data = item.content.data;
      return (data?.type === "task-reminder" || data?.type === "delivery-reminder")
        && ((!userId) || (data.ownerId && data.ownerId !== userId));
    }).map((item) => item.identifier), Notifications);
  });
}
let actionSync: Promise<void> | undefined;
export function syncReminderActions(userId: string) {
  return actionSync ??= syncPendingReminderActions(userId).finally(() => { actionSync = undefined; });
}
async function syncPendingReminderActions(userId: string) {
  const { updateRemoteTask } = await import("./authApi.service");
  let failure: unknown;
  for (const action of Object.values(await readReminderActions())) {
    if (await AsyncStorage.getItem(OWNER_KEY) !== userId) return;
    if (!action.taskId || action.ownerId !== userId || action.synced || action.error) continue;
    try {
    const saved = await updateRemoteTask(action.taskId, {
      expectedReminderAt: new Date(action.sourceDueAt).toISOString(),
      reminderEnabled: !action.stopped && action.dueAt > Date.now(),
      reminderAt: action.stopped || action.dueAt <= Date.now() ? null : new Date(action.dueAt).toISOString(),
    });
    const desired = action.stopped || action.dueAt <= Date.now() ? null : new Date(action.dueAt).toISOString();
    if (saved.completed || saved.reminderAt !== desired) {
      await clearReminderAction(action.reminderId, action.changedAt);
      if (saved.completed || !saved.reminderEnabled) await cancelReminderSeries(action.taskId);
      continue;
    }
    await withReminderLock(async () => {
      const latest = (await readReminderActions())[action.reminderId];
      if (latest?.changedAt === action.changedAt) await writeReminderAction({ ...latest, synced: true });
    });
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 404) {
        await clearReminderAction(action.reminderId, action.changedAt);
        await cancelReminderSeries(action.taskId);
      } else failure = error;
    }
  }
  if (failure) throw failure;
}
// Expo notification categories should not contain ':' or '-' or native action
// buttons can be ignored on some Android/iOS versions.
export const DELIVERY_REMINDER_CATEGORY = "delivery_reminder";
export const DELIVERY_REMINDER_SNOOZE_ACTION = "delivery-reminder-snooze";
export const DELIVERY_REMINDER_STOP_ACTION = "delivery-reminder-stop";

type ReminderNotificationData = {
  type?: string;
  phase?: string;
  reminderId?: string;
  taskId?: string;
  soundTone?: ReminderTone;
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
  channelId?: string;
  [key: string]: unknown;
};

let configurationPromise: Promise<void> | undefined;
let suppressActiveChatPush = false;
let mutedChatNotificationIds = new Set<string>();

export function setChatNotificationSuppressed(suppressed: boolean) {
  suppressActiveChatPush = suppressed;
}

export function setMutedChatNotificationConversations(ids: string[]) {
  mutedChatNotificationIds = new Set(ids.filter(Boolean));
}

export function configureReminderNotifications() {
  return configurationPromise ??= configureNativeReminderNotifications().catch((error) => { configurationPromise = undefined; throw error; });
}
async function configureNativeReminderNotifications() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as { type?: string; screen?: string; conversationId?: string; applicationId?: string } | undefined;
      const isChat = data?.type === "CHAT_MESSAGE" || data?.screen === "chat" || Boolean(data?.conversationId || data?.applicationId);
      const conversationId = data?.conversationId ?? data?.applicationId;
      const isActiveChat = suppressActiveChatPush && isChat;
      const isMutedChat = isChat && Boolean(conversationId && mutedChatNotificationIds.has(conversationId));
      const suppress = isActiveChat || isMutedChat;
      return {
      shouldShowBanner: !suppress,
      shouldShowList: !suppress,
      shouldPlaySound: !suppress && Boolean(notification.request.content.sound),
      shouldSetBadge: false,
      ...(Platform.OS === "android" && Notifications.AndroidNotificationPriority
        ? { priority: Notifications.AndroidNotificationPriority.HIGH }
        : {}),
      };
    },
  });
  if (Platform.OS !== "web") {
    await Notifications.setNotificationCategoryAsync(
      DELIVERY_REMINDER_CATEGORY,
      [
        {
          identifier: DELIVERY_REMINDER_SNOOZE_ACTION,
          buttonTitle: "Snooze",
          // Android handles this action through the registered headless
          // notification task, so the app does not need to open first.
          options: { opensAppToForeground: false },
        },
        {
          identifier: DELIVERY_REMINDER_STOP_ACTION,
          buttonTitle: "Stop",
          options: { isDestructive: true, opensAppToForeground: false },
        },
      ],
      { customDismissAction: true },
    );
  }
  if (Platform.OS === "android") {
    await Notifications.registerTaskAsync("brandly-reminder-notification-actions");
    await Promise.all(
      REMINDER_TONES.map((tone) =>
        Promise.all([
          ensureReminderChannel(tone.id !== "silent", true, tone.id, Notifications),
          ensureReminderChannel(tone.id !== "silent", false, tone.id, Notifications),
        ]),
      ),
    );
  }
}

export async function hasReminderNotificationPermission(): Promise<boolean> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;
  const permission = await Notifications.getPermissionsAsync();
  return permission.status === Notifications.PermissionStatus.GRANTED
    || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

async function ensureReminderChannel(
  soundEnabled: boolean,
  vibrationEnabled: boolean,
  tone = "default" as ReminderSettings["soundTone"],
  Notifications?: NotificationsModule,
  longAlarm = true,
) {
  if (Platform.OS !== "android") return;
  const notifications = Notifications ?? (await getNotificationsModule());
  if (!notifications) return;
  const toneOption = getReminderTone(tone);
  const toneId = soundEnabled ? tone : "silent";
  await notifications.setNotificationChannelAsync(
    `${longAlarm ? channelPrefix : `${channelPrefix}-preview`}-${toneId}-${vibrationEnabled ? "vibrate" : "quiet"}`,
    {
      name: "Delivery reminders",
      importance: notifications.AndroidImportance.HIGH,
      sound: soundEnabled
        ? longAlarm ? getReminderAlarmSound(toneOption) : toneOption.file ?? "default"
        : null,
      vibrationPattern: vibrationEnabled ? [0, 250, 250, 250] : [0],
      lockscreenVisibility: notifications.AndroidNotificationVisibility.PUBLIC,
    },
  );
}

export function scheduleDeliveryReminder(
  reminder: Reminder, settings: ReminderSettings,
  options: { requestPermission?: boolean } = {},
) {
  return withReminderLock(async () => {
    const Notifications = await getNotificationsModule();
    if (!Notifications) throw new Error("Native notifications are unavailable on this platform");
    await configureReminderNotifications();
    const action = (await readReminderActions())[reminder.id];
    const ownerId = await AsyncStorage.getItem(OWNER_KEY) ?? "";
    if (!ownerId || reminder.ownerId && reminder.ownerId !== ownerId) return null;
    if (reminder.completed) {
      await cancelMatchingReminder(Notifications, reminder.id);
      return null;
    }
    if (action && (!action.ownerId || action.ownerId === ownerId)) {
      if (action.stopped) {
        await cancelMatchingReminder(Notifications, reminder.id);
        return null;
      }
      reminder = { ...reminder, dueAt: action.dueAt, enabled: true };
    }
    if (!reminder.enabled || !Number.isFinite(reminder.dueAt) || reminder.dueAt <= Date.now()) {
      await cancelMatchingReminder(Notifications, reminder.id);
      return null;
    }
    if (reminder.taskId?.startsWith("pending-task-")) return null;
    const resolved = resolveReminderSettings(reminder, settings);
    const channelId = `${channelPrefix}-${resolved.soundEnabled ? resolved.soundTone : "silent"}-${resolved.vibrationEnabled ? "vibrate" : "quiet"}`;
    await ensureReminderChannel(resolved.soundEnabled, resolved.vibrationEnabled, resolved.soundTone, Notifications);
    if (!(await ensurePermission(Notifications, options.requestPermission !== false))) {
      await cancelMatchingReminder(Notifications, reminder.id);
      throw new Error("Notifications are disabled. Enable Brandly notifications in device settings to receive reminders.");
    }
    if (Platform.OS === "ios") {
      const permission = await Notifications.getPermissionsAsync();
      if (permission.ios?.allowsAlert === false || resolved.soundEnabled && permission.ios?.allowsSound === false) {
        throw new Error("Reminder alerts or sounds are disabled in iOS notification settings.");
      }
    }
    await ensureExactAlarmAccess(options.requestPermission !== false);
    const useNativeAndroidAlarm = Platform.OS === "android"
      && Boolean(nativeReminder?.scheduleReminder && nativeReminder.cancelReminder);
    if (Platform.OS === "android" && !useNativeAndroidAlarm) {
      const channel = await Notifications.getNotificationChannelAsync(channelId);
      if (!channel || channel.importance === Notifications.AndroidImportance.NONE || resolved.soundEnabled && channel.sound === null) {
        throw new Error("The reminder channel is blocked. Enable Delivery reminders in device settings.");
      }
    }
    if (useNativeAndroidAlarm) {
      // Android notification channels play a sound once; the native alarm service
      // owns this path so the selected tone loops until Snooze or Stop.
      await cancelMatchingReminder(Notifications, reminder.id);
      return nativeReminder!.scheduleReminder!({
        reminderId: reminder.id,
        triggerAtMillis: reminder.dueAt,
        title: reminder.taskId ? "Task reminder" : "Delivery reminder",
        body: reminder.title,
        soundFile: getReminderAlarmSound(getReminderTone(resolved.soundTone)),
        soundEnabled: resolved.soundEnabled,
        vibrationEnabled: resolved.vibrationEnabled,
        snoozeMinutes: resolved.snoozeMinutes ?? 5,
        ownerId,
        taskId: reminder.taskId,
      });
    }
    const signature = JSON.stringify([reminder.dueAt, reminder.title, resolved, ownerId, DELIVERY_REMINDER_CATEGORY]);
    const identifier = `brandly:${reminder.id}:${reminder.dueAt}`;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const matching = scheduled.filter((item) => item.content.data?.reminderId === reminder.id
      || (reminder.taskId && item.content.data?.taskId === reminder.taskId));
    const keep = matching.find((item) => item.identifier === identifier && (
      item.content.data?.scheduleSignature === signature
      || item.content.data?.snoozed === true && item.content.data?.ownerId === ownerId
        && item.content.data?.channelId === channelId && item.content.body === reminder.title
        && item.content.data?.categoryIdentifier === DELIVERY_REMINDER_CATEGORY
        && Number(item.content.data?.snoozeMinutes) === resolved.snoozeMinutes
    ));
    await cancelReminderNotifications(matching.filter((item) => item !== keep).map((item) => item.identifier), Notifications);
    if (keep) {
      if (action?.error) {
        const { error: previousError, ...recovered } = action;
        await writeReminderAction({ ...recovered, notificationId: keep.identifier });
      }
      return keep.identifier;
    }
    if (Platform.OS === "ios" && scheduled.length - matching.length >= 64) {
      throw new Error("iOS has reached its pending notification limit. Remove a reminder before adding another.");
    }
    const id = await scheduleDateNotification(Notifications, {
      title: reminder.taskId ? "Task reminder" : "Delivery reminder",
      body: reminder.title,
      sound: resolved.soundEnabled ? getReminderAlarmSound(getReminderTone(resolved.soundTone)) : false,
      categoryIdentifier: DELIVERY_REMINDER_CATEGORY,
      sticky: true, autoDismiss: false, interruptionLevel: "timeSensitive",
      data: {
        type: reminder.taskId ? "task-reminder" : "delivery-reminder",
        reminderId: reminder.id, ...(reminder.taskId ? { taskId: reminder.taskId } : {}),
        ownerId, dueAt: reminder.dueAt, snoozeMinutes: resolved.snoozeMinutes,
        soundTone: resolved.soundTone, soundEnabled: resolved.soundEnabled,
        categoryIdentifier: DELIVERY_REMINDER_CATEGORY,
        vibrationEnabled: resolved.vibrationEnabled, channelId, scheduleSignature: signature,
      },
    }, reminder.dueAt, channelId, identifier);
    const actual = await Notifications.getAllScheduledNotificationsAsync();
    if (actual.filter((item) => item.content.data?.reminderId === reminder.id).length !== 1) {
      throw new Error("The device did not retain exactly one reminder schedule. Please retry.");
    }
    if (action?.error) {
      const { error: previousError, ...recovered } = action;
      await writeReminderAction({ ...recovered, notificationId: id });
    }
    return id;
  });
}
async function ensureExactAlarmAccess(openSettings: boolean) {
  if (Platform.OS !== "android") return;
  if (!nativeReminder) throw new Error("Reliable alarms require a Brandly native build; Expo Go cannot verify exact-alarm access.");
  if (await nativeReminder.canScheduleExactAlarms()) return;
  if (openSettings) await openExactAlarmSettings();
  throw new Error("Allow Alarms & reminders for Brandly in device settings, then retry.");
}
async function cancelMatchingReminder(
  Notifications: NotificationsModule,
  reminderId: string,
  extraIds: string[] = [],
  options: { bestEffort?: boolean } = {},
) {
  if (Platform.OS === "android" && nativeReminder?.cancelReminder) {
    if (options.bestEffort) await nativeReminder.cancelReminder(reminderId).catch(() => undefined);
    else await nativeReminder.cancelReminder(reminderId);
  }
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const displayed = await Notifications.getPresentedNotificationsAsync();
  const ids = [...new Set([
    ...extraIds,
    ...scheduled.filter((item) => item.content.data?.reminderId === reminderId).map((item) => item.identifier),
    ...displayed.filter((item) => item.request.content.data?.reminderId === reminderId).map((item) => item.request.identifier),
  ])];
  await cancelReminderNotifications(ids, Notifications, options);
}
export function handleReminderNotificationAction(notification: Notification, actionIdentifier: string) {
  return withReminderLock(async () => {
    const data = notification.request.content.data as ReminderNotificationData;
    if (!data?.reminderId || !["task-reminder", "delivery-reminder"].includes(data.type ?? "")) return null;
    const stopped = actionIdentifier === DELIVERY_REMINDER_STOP_ACTION;
    if (!stopped && actionIdentifier !== DELIVERY_REMINDER_SNOOZE_ACTION) return null;
    if (Platform.OS === "ios" && nativeReminder) return (await readReminderActions())[data.reminderId] ?? null;
    const owner = await AsyncStorage.getItem(OWNER_KEY) ?? "";
    if (!owner || data.ownerId && data.ownerId !== owner) return null;
    const previous = (await readReminderActions())[data.reminderId];
    if (previous?.handledNotificationId === notification.request.identifier) return previous;
    if (previous && Number(data.dueAt ?? 0) < previous.sourceDueAt) return previous;
    const Notifications = await getNotificationsModule();
    if (!Notifications) throw new Error("Native notifications are unavailable");
    const minutes = Math.max(1, Math.min(1440, Number(data.snoozeMinutes) || 5));
    const dueAt = stopped ? Number(data.dueAt) || Date.now() : Math.ceil((Date.now() + minutes * 60_000) / 1000) * 1000;
    const action: ReminderAction = {
      reminderId: data.reminderId, taskId: data.taskId, ownerId: String(data.ownerId ?? owner),
      sourceDueAt: Number(data.dueAt ?? 0), handledNotificationId: notification.request.identifier,
      stopped, dueAt, changedAt: Date.now(),
    };
    await writeReminderAction(action);
    await cancelMatchingReminder(Notifications, data.reminderId, [notification.request.identifier], { bestEffort: true });
    if (stopped) return action;
    try {
      await ensureExactAlarmAccess(false);
      if (!(await ensurePermission(Notifications, false))) throw new Error("Notification permission was revoked");
      const channelId = String(data.channelId ?? `${channelPrefix}-default-vibrate`);
      action.notificationId = await scheduleDateNotification(Notifications, {
        title: notification.request.content.title ?? "Reminder",
        body: notification.request.content.body ?? "",
        sound: data.soundEnabled ? getReminderAlarmSound(getReminderTone(data.soundTone ?? "default")) : false,
        categoryIdentifier: DELIVERY_REMINDER_CATEGORY,
        sticky: true, autoDismiss: false, interruptionLevel: "timeSensitive",
        data: { ...data, categoryIdentifier: DELIVERY_REMINDER_CATEGORY, dueAt, snoozed: true },
      }, dueAt, channelId, `brandly:${data.reminderId}:${dueAt}`);
      await writeReminderAction(action);
      return action;
    } catch (error) {
      await writeReminderAction({ ...action, error: String(error) });
      throw error;
    }
  });
}
export function snoozeReminderFromNotification(notification: Notification) {
  return handleReminderNotificationAction(notification, DELIVERY_REMINDER_SNOOZE_ACTION);
}
export function stopReminderFromNotification(notification: Notification) {
  return handleReminderNotificationAction(notification, DELIVERY_REMINDER_STOP_ACTION);
}
// One reminder owns one OS date trigger. Never pre-schedule retry alarms.
export async function scheduleTaskReminderSeries(reminder: Reminder, settings: ReminderSettings, options: { requestPermission?: boolean } = {}) {
  const id = await scheduleDeliveryReminder(reminder, settings, options);
  return id ? [id] : [];
}

export async function previewReminderSound(settings: ReminderSettings) {
  const request = ++previewRequest;
  await cancelPreviewNotification();
  const reminderSettings = resolveReminderSettings({}, settings);
  if (!reminderSettings.soundEnabled) return false;
  const tone = getReminderTone(reminderSettings.soundTone);
  const previewSource = reminderAudioSources[reminderSettings.soundTone];
  if (previewSource) {
    try {
      const Audio = await import("expo-audio");
      await Audio.setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: "doNotMix" });
      const player = Audio.createAudioPlayer(previewSource, { updateInterval: 250 });
      if (request !== previewRequest) {
        player.remove();
        return false;
      }
      player.volume = 1;
      player.loop = true;
      previewAudioPlayer = player;
      player.play();
      return true;
    } catch {
      // Fall through to a notification preview for older/dev runtimes.
    }
  }
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;
  const channelId = `${channelPrefix}-preview-${reminderSettings.soundTone}-${reminderSettings.vibrationEnabled ? "vibrate" : "quiet"}`;
  await ensureReminderChannel(
    reminderSettings.soundEnabled,
    reminderSettings.vibrationEnabled,
    reminderSettings.soundTone,
    Notifications,
    false,
  );
  if (!(await ensurePermission(Notifications, true))) return false;
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Reminder sound preview",
      body: "This is how your reminder will sound.",
      sound: tone.file ?? "default",
      categoryIdentifier: DELIVERY_REMINDER_CATEGORY,
      interruptionLevel: "active",
      data: { type: "delivery-reminder-preview" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      repeats: false,
      ...(Platform.OS === "android" ? { channelId } : {}),
    },
  });
  if (request !== previewRequest) {
    await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
    return false;
  }
  previewNotificationId = notificationId;
  return true;
}

export async function stopReminderSoundPreview(
  Notifications?: NotificationsModule,
) {
  previewRequest += 1;
  await cancelPreviewNotification(Notifications);
}

async function cancelPreviewNotification(Notifications?: NotificationsModule) {
  if (previewAudioTimer) {
    clearTimeout(previewAudioTimer);
    previewAudioTimer = undefined;
  }
  const player = previewAudioPlayer;
  previewAudioPlayer = undefined;
  if (player) {
    try { player.pause(); } catch { /* player may already be released by the native runtime */ }
    try { player.remove(); } catch { /* player may already be removed by the native runtime */ }
  }
  const notificationId = previewNotificationId;
  previewNotificationId = undefined;
  if (!notificationId) return;
  const notifications = Notifications ?? (await getNotificationsModule());
  await notifications?.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
}

const reminderAudioSources: Partial<Record<ReminderTone, number>> = {
  "soft-chime": require("../../assets/sounds/soft_chime.wav"),
  "bright-bell": require("../../assets/sounds/bright_bell.wav"),
  "focus-pulse": require("../../assets/sounds/focus_pulse.wav"),
  "morning-rise": require("../../assets/sounds/morning_rise.wav"),
  "warm-double": require("../../assets/sounds/warm_double.wav"),
  "clear-triangle": require("../../assets/sounds/clear_triangle.wav"),
  "gentle-wave": require("../../assets/sounds/gentle_wave.wav"),
  "short-alert": require("../../assets/sounds/short_alert.wav"),
  "deep-note": require("../../assets/sounds/deep_note.wav"),
  "sparkle-sequence": require("../../assets/sounds/sparkle_sequence.wav"),
  "akx-alarmed": require("../../assets/sounds/akx_alarmed.wav"),
  "akx-beeper": require("../../assets/sounds/akx_beeper.wav"),
  "akx-belligerent": require("../../assets/sounds/akx_belligerent.wav"),
  "akx-calm": require("../../assets/sounds/akx_calm.wav"),
  "akx-chord": require("../../assets/sounds/akx_chord.wav"),
  "akx-chord2": require("../../assets/sounds/akx_chord2.wav"),
  "akx-cloud": require("../../assets/sounds/akx_cloud.wav"),
  "akx-glass": require("../../assets/sounds/akx_glass.wav"),
  "akx-glisten": require("../../assets/sounds/akx_glisten.wav"),
  "akx-polite": require("../../assets/sounds/akx_polite.wav"),
  "akx-sharp": require("../../assets/sounds/akx_sharp.wav"),
  "akx-whistleronic": require("../../assets/sounds/akx_whistleronic.wav"),
};

function getReminderAlarmSound(tone: ReturnType<typeof getReminderTone>) {
  if (Platform.OS === "android") return tone.alarmFile ?? tone.file ?? "default";
  return tone.file ?? "default";
}

async function scheduleDateNotification(
  Notifications: NotificationsModule,
  content: Parameters<NotificationsModule["scheduleNotificationAsync"]>[0]["content"],
  timestamp: number,
  channelId?: string,
  identifier?: string,
) {
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) throw new Error("Choose a future reminder time");
  const trigger: DateTriggerInput = {
    type: "date" as DateTriggerInput["type"],
    date: timestamp,
    ...(Platform.OS === "android" ? { channelId } : {}),
  };
  const nextTrigger = await Notifications.getNextTriggerDateAsync(trigger);
  if (nextTrigger === null || Math.abs(nextTrigger - timestamp) > EXACT_TRIGGER_TOLERANCE_MS) {
    throw new Error("Reminder trigger could not be scheduled at the requested time");
  }
  try {
    return await Notifications.scheduleNotificationAsync({ identifier, content, trigger });
  } catch (error) {
    if (Platform.OS === "android" && /exact|alarm|permission|security/i.test(String(error))) {
      await openExactAlarmSettings();
    }
    throw error;
  }
}

async function openExactAlarmSettings() {
  if (Platform.OS !== "android") return;
  try {
    const IntentLauncher = await import("expo-intent-launcher");
    const packageName = Constants.expoConfig?.android?.package;
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_SCHEDULE_EXACT_ALARM,
      packageName ? { data: `package:${packageName}` } : undefined,
    );
  } catch {
    // Some OEMs do not expose the exact-alarm settings activity.
  }
}

async function ensurePermission(Notifications: NotificationsModule, requestPermission: boolean) {
  const permission = await Notifications.getPermissionsAsync();
  const granted =
    permission.status === Notifications.PermissionStatus.GRANTED ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (granted) return true;
  if (!requestPermission) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return (
    requested.status === Notifications.PermissionStatus.GRANTED ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

function resolveReminderSettings(
  reminder: Pick<Reminder, "soundEnabled" | "vibrationEnabled" | "soundTone">,
  defaults: ReminderSettings,
): ReminderSettings {
  const soundTone = reminder.soundTone ?? defaults.soundTone ?? "default";
  return {
    soundEnabled:
      soundTone === "silent"
        ? false
        : reminder.soundEnabled ?? defaults.soundEnabled,
    vibrationEnabled: reminder.vibrationEnabled ?? defaults.vibrationEnabled,
    soundTone,
    snoozeMinutes: Math.max(1, Math.min(1440, Number(defaults.snoozeMinutes) || 5)),
  };
}

export async function cancelDeliveryReminder(notificationId?: string, reminderId?: string) {
  const Notifications = await getNotificationsModule();
  if (Notifications && (notificationId || reminderId)) {
    await withReminderLock(() => reminderId
      ? cancelMatchingReminder(Notifications, reminderId, notificationId ? [notificationId] : [])
      : cancelReminderNotifications([notificationId!], Notifications));
  }
}

export function cancelReminderSeries(taskId: string, notificationIds: string[] = []) {
  return withReminderLock(async () => {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const displayed = await Notifications.getPresentedNotificationsAsync();
  const matchingIds = scheduled
    .filter((item) => String(item.content.data?.taskId ?? "") === taskId)
    .map((item) => item.identifier);
  const displayedIds = displayed
    .filter((item) => String(item.request.content.data?.taskId ?? "") === taskId)
    .map((item) => item.request.identifier);
  const ids = Array.from(new Set([...notificationIds, ...matchingIds, ...displayedIds]));
  if (Platform.OS === "android" && nativeReminder?.cancelReminder) {
    await nativeReminder.cancelReminder(`task-reminder-${taskId}`);
  }
  await cancelReminderNotifications(ids, Notifications);
  });
}

export async function syncDailyStreakReminder(userId: string, tasks: TodoTask[], now = new Date()) {
  if (Platform.OS === "web" || !userId) return;
  const Notifications = await getNotificationsModule();
  if (!Notifications || !(await hasReminderNotificationPermission())) return;
  const streak = getDailyStreak(tasks, now);
  const targetDate = streakReminderDate(now, streak.todayCompleted);
  const targetKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;
  const prefix = `brandly:daily-streak:${userId}:`;
  const identifier = `${prefix}${targetKey}`;
  const markerKey = `brandly.daily-streak.reminder:${userId}:${targetKey}`;
  await withReminderLock(async () => {
    const [scheduled, presented, marker] = await Promise.all([
      Notifications.getAllScheduledNotificationsAsync(),
      Notifications.getPresentedNotificationsAsync(),
      AsyncStorage.getItem(markerKey),
    ]);
    const knownIds = new Set([...scheduled.map((item) => item.identifier), ...presented.map((item) => item.request.identifier)]);
    for (const item of scheduled) {
      if (item.identifier.startsWith(prefix) && item.identifier !== identifier) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier).catch(() => undefined);
        await AsyncStorage.removeItem(`brandly.daily-streak.reminder:${userId}:${item.identifier.slice(prefix.length)}`);
      } else if (item.identifier.startsWith("brandly:daily-streak:") && !item.identifier.startsWith(prefix)) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier).catch(() => undefined);
        const [, , otherUserId, day] = item.identifier.split(":");
        if (otherUserId && day) await AsyncStorage.removeItem(`brandly.daily-streak.reminder:${otherUserId}:${day}`);
      }
    }
    if (marker || knownIds.has(identifier)) return;
    if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("streak-reminders", {
      name: "Daily consistency", importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0], lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    const reminderAt = streakReminderDate(now, streak.todayCompleted);
    const isToday = reminderAt.getDate() === now.getDate() && reminderAt.getMonth() === now.getMonth() && reminderAt.getFullYear() === now.getFullYear();
    const isLate = isToday && now.getHours() >= 23;
    const body = isLate
      ? streak.current > 0
        ? "Midnight is close. Complete one small task to keep your streak alive."
        : "There is still time for one small win today. Complete a task to start your streak."
      : isToday && streak.current > 0
        ? "One hour left to keep your streak alive. One small task is enough before midnight."
        : isToday
          ? "Start your streak today. Complete one small task before midnight—every bit of progress counts."
          : "Keep your consistency going tomorrow. One small completed task is enough to protect your streak.";
    const trigger = isLate ? null : {
      type: "date" as DateTriggerInput["type"],
      date: reminderAt,
      ...(Platform.OS === "android" ? { channelId: "streak-reminders" } : {}),
    };
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: "A gentle streak reminder",
        body,
        sound: false,
        data: { type: "STREAK_REMINDER", screen: "home", date: targetKey },
      },
      trigger,
    });
    await AsyncStorage.setItem(markerKey, "scheduled");
  });
}

export async function cancelDailyStreakReminders(userId?: string) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  const prefix = `brandly:daily-streak:${userId ? `${userId}:` : ""}`;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled
    .filter((item) => item.identifier.startsWith(prefix))
    .map(async (item) => {
      await Notifications.cancelScheduledNotificationAsync(item.identifier).catch(() => undefined);
      const [, , ownerId, day] = item.identifier.split(":");
      if (ownerId && day) await AsyncStorage.removeItem(`brandly.daily-streak.reminder:${ownerId}:${day}`);
    }));
}

/**
 * Remove native task alarms that belong to tasks already completed, stopped,
 * expired, or no longer present in the current remote task snapshot. Native
 * alarms survive a JS process restart, so the in-memory schedule map cannot
 * clean these up by itself.
 */
export function clearObsoleteTaskReminderNotifications(tasks: TodoTask[], authoritative = false) {
  return withReminderLock(async () => {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  const knownTaskIds = new Set(tasks.map((task) => task.id));
  const completedTaskIds = new Set(tasks.filter((task) => task.completed).map((task) => task.id));
  const actions = await readReminderActions();
  const activeTaskIds = new Set(
    tasks
      .filter((task) => task.reminderEnabled && !task.completed && task.dueTime.toLowerCase() !== "anytime")
      .filter((task) => taskToReminder(task).dueAt > Date.now())
      .map((task) => task.id),
  );
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const staleIds = scheduled
    .filter((notification) => {
      const data = notification.content.data as { type?: string; taskId?: string } | undefined;
      return data?.type === "task-reminder"
        && Boolean(data.taskId)
        && (authoritative || knownTaskIds.has(String(data.taskId)))
        && !activeTaskIds.has(String(data.taskId))
        && (completedTaskIds.has(String(data.taskId)) || !(knownTaskIds.has(String(data.taskId)) && Object.values(actions).some((action) => action.taskId === data.taskId && !action.stopped && action.dueAt > Date.now())));
    })
    .map((notification) => notification.identifier);
  if (Platform.OS === "android" && nativeReminder?.cancelReminder) {
    const staleTaskIds = tasks
      .filter((task) => !activeTaskIds.has(task.id))
      .filter((task) => completedTaskIds.has(task.id) || !Object.values(actions).some((action) => action.taskId === task.id && !action.stopped && action.dueAt > Date.now()))
      .map((task) => `task-reminder-${task.id}`);
    await Promise.all(staleTaskIds.map((reminderId) => nativeReminder.cancelReminder!(reminderId)));
  }
  await cancelReminderNotifications(staleIds, Notifications);
  });
}

export async function cancelReminderNotifications(
  notificationIds: string[],
  Notifications?: NotificationsModule | null,
  options: { bestEffort?: boolean } = {},
) {
  const notifications = Notifications ?? (await getNotificationsModule());
  if (!notifications) return;
  await Promise.all([...new Set(notificationIds)].map(async (id) => {
    if (options.bestEffort) {
      await notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
      await notifications.dismissNotificationAsync(id).catch(() => undefined);
      return;
    }
    await notifications.cancelScheduledNotificationAsync(id);
    await notifications.dismissNotificationAsync(id);
  }));
}

export function taskToReminder(task: TodoTask): Reminder {
  const storedReminderAt = task.reminderAt ? Date.parse(task.reminderAt) : NaN;
  return {
    id: `task-reminder-${task.id}`,
    taskId: task.id,
    title: task.title,
    campaignTitle: task.campaignId ? "Campaign task" : "Task",
    participantName: task.senderName ?? task.owner,
    deliveryDate: Number.isFinite(storedReminderAt) ? formatReminderDate(storedReminderAt) : task.dueDate,
    deliveryTime: Number.isFinite(storedReminderAt) ? formatReminderTime(storedReminderAt) : task.dueTime,
    dueAt: Number.isNaN(storedReminderAt)
      ? parseReminderDateTime(task.dueDate, task.dueTime) ?? 0
      : storedReminderAt,
    enabled: task.reminderEnabled && !task.completed,
    completed: task.completed,
    soundEnabled: task.reminderTone !== "silent",
    soundTone: task.reminderTone,
    notificationId: task.reminderNotificationId,
  };
}
