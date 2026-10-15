import { ComponentProps, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Animated,
  KeyboardAvoidingView,
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { WebView } from "react-native-webview";
import {
  AppButton,
  AppCard,
  AppIcon,
  Avatar,
  ConfirmModal,
  NATIVE_ANIMATIONS_ENABLED,
  Skeleton,
} from "../../components/ui";
import { useMediaAttachments } from "../../hooks/useMediaAttachments";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import { isLocalMediaUri } from "../../services/authApi.service";
import { MediaAttachment } from "../../services/mediaPicker.service";
import { Campaign, DemoAttachment, MarketplaceApplication, MarketplaceConversationStatus, MarketplaceMessage, TodoTask } from "../../types/marketplace";
import { CampaignSelectionSheet } from "./CampaignSelectionSheet";
import { mergeChatMessages } from "../../lib/chat";
import { formatDisplayDateTime } from "../../lib/dateTime";

type ChatMessage = {
  id: string;
  text: string;
  mine: boolean;
  senderRole?: "Brand" | "Influencer";
  time: string;
  status?: "sent" | "delivered" | "seen" | "failed";
  clientMessageId?: string;
  createdAt?: string;
  replyToId?: string;
  attachmentName?: string;
  attachments?: DemoAttachment[];
  replyTo?: { author: string; text: string };
  edited?: boolean;
  videoBriefId?: string;
  taskId?: string;
  campaignRequestId?: string;
  deleted?: boolean;
  applicationCardAnchor?: boolean;
};
type ChatIconName = ComponentProps<typeof AppIcon>["name"];
type ChatAttachment = {
  id: string;
  name: string;
  type: "image" | "video" | "file";
  uri?: string;
};
type AttachmentMessageSync = {
  messageId: string;
  text: string;
  syncedCount: number;
};
function chatDayLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (day === todayStart) return "Today";
  if (day === todayStart - 86_400_000) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" }).format(date);
}
const REACTION_OPTIONS: {
  key: string;
  label: string;
  emoji: string;
  color: string;
  background: string;
}[] = [
  { key: "like", label: "Like", emoji: "👍", color: "#2563EB", background: "#DBEAFE" },
  { key: "love", label: "Love", emoji: "❤️", color: "#E11D48", background: "#FFE4E6" },
  { key: "celebrate", label: "Celebrate", emoji: "🎉", color: "#7C3AED", background: "#EDE9FE" },
  { key: "laugh", label: "Funny", emoji: "😂", color: "#D97706", background: "#FEF3C7" },
  { key: "approve", label: "Approve", emoji: "✅", color: "#059669", background: "#D1FAE5" },
  { key: "fire", label: "Great", emoji: "🔥", color: "#EA580C", background: "#FFEDD5" },
  { key: "star", label: "Star", emoji: "⭐", color: "#CA8A04", background: "#FEF9C3" },
  { key: "idea", label: "Idea", emoji: "💡", color: "#0891B2", background: "#CFFAFE" },
];

export function ChatDetail({
  name,
  initials,
  avatarUrl,
  role = "Brand",
  onBack,
  onOpenProfile,
  liveSession = false,
  online = false,
  typing = false,
  blocked = false,
  conversationStatus = "Accepted",
  adminChat = false,
  initialMessage,
  initialMessageMine = false,
  initialAttachments,
  application,
  onAcceptApplication,
  onRejectApplication,
  onConfirmCompletion,
  onReviewApplication,
  onToggleBlock,
  storedMessages,
  conversationId,
  onSendMessage,
  onTyping,
  onUpdateMessage,
  onDeleteMessage,
  forwardTargets = [],
  onForwardMessages,
  isConversationPinned = false,
  onToggleConversationPin,
  pinStorageKey,
  videoBriefs = [],
  tasks = [],
  receivedTaskSourceIds = [],
  campaigns = [],
  campaignsLoading = false,
  sentCampaignIds = [],
  sentTaskIds = [],
  onSendTask,
  onSendCampaign,
  onRequestCampaigns,
  onOpenVideoBrief,
  onOpenTask,
  onOpenCampaign,
  onAddTaskToTodo,
  campaignRequests = [],
  onAcceptCampaignRequest,
  onRejectCampaignRequest,
  historyLoading = false, historyError = "", hasOlderMessages = false, onLoadOlderMessages, onRetryHistory,
}: {
  name: string;
  initials: string;
  avatarUrl?: string;
  role?: "Brand" | "Influencer";
  onBack: () => void;
  onOpenProfile: () => void;
  liveSession?: boolean;
  online?: boolean;
  typing?: boolean;
  blocked?: boolean;
  conversationStatus?: MarketplaceConversationStatus;
  adminChat?: boolean;
  initialMessage?: string;
  initialMessageMine?: boolean;
  initialAttachments?: DemoAttachment[];
  application?: MarketplaceApplication;
  onAcceptApplication?: () => void | Promise<void>;
  onRejectApplication?: (reason: string, canReapply: boolean) => void | Promise<void>;
  onConfirmCompletion?: () => void | Promise<void>;
  onReviewApplication?: () => void;
  onToggleBlock?: () => void;
  conversationId?: string;
  storedMessages?: MarketplaceMessage[];
  onSendMessage?: (message: MarketplaceMessage) => MarketplaceMessage | void | Promise<MarketplaceMessage | void>;
  onTyping?: (typing: boolean) => void;
  onUpdateMessage?: (messageId: string, changes: Partial<MarketplaceMessage>) => void | Promise<void>;
  onDeleteMessage?: (messageId: string) => void | Promise<void>;
  forwardTargets?: { id: string; name: string; preview?: string }[];
  onForwardMessages?: (targetId: string, messages: MarketplaceMessage[], batchId: string) => Promise<void>;
  isConversationPinned?: boolean;
  onToggleConversationPin?: () => void;
  pinStorageKey?: string;
  videoBriefs?: TodoTask[];
  tasks?: TodoTask[];
  receivedTaskSourceIds?: string[];
  campaigns?: Campaign[];
  campaignsLoading?: boolean;
  sentCampaignIds?: string[];
  sentTaskIds?: string[];
  onSendTask?: (task: TodoTask) => boolean | void | Promise<boolean | void>;
  onSendCampaign?: (campaign: Campaign) => void;
  onRequestCampaigns?: () => void;
  onOpenVideoBrief?: (briefId: string) => void;
  onOpenTask?: (task: TodoTask) => void;
  onOpenCampaign?: (campaign: Campaign) => void;
  onAddTaskToTodo?: (task: TodoTask, conversationId?: string) => boolean;
  campaignRequests?: MarketplaceApplication[];
  onAcceptCampaignRequest?: (applicationId: string) => void;
  onRejectCampaignRequest?: (applicationId: string) => void;
  historyLoading?: boolean;
  historyError?: string;
  hasOlderMessages?: boolean;
  onLoadOlderMessages?: () => void;
  onRetryHistory?: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const enterProgress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    enterProgress.setValue(0);
    const animation = Animated.timing(enterProgress, { toValue: 1, duration: 180, useNativeDriver: NATIVE_ANIMATIONS_ENABLED });
    animation.start();
    return () => animation.stop();
  }, [conversationId, enterProgress]);
  const backLocked = useRef(false);
  const handleBack = () => {
    if (backLocked.current) return;
    backLocked.current = true;
    onBack();
    setTimeout(() => {
      backLocked.current = false;
    }, 450);
  };
  const [draft, setDraft] = useState("");
  const composerInputRef = useRef<TextInput>(null);
  const [isSending, setIsSending] = useState(false);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const typingActive = useRef(false);
  const onTypingRef = useRef(onTyping);
  onTypingRef.current = onTyping;
  const [composerActionsOpen, setComposerActionsOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [forwardPickerOpen, setForwardPickerOpen] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [forwardBatchId, setForwardBatchId] = useState("");
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [supportReportType, setSupportReportType] = useState<"Feedback" | "Bug report" | null>(null);
  const [supportReportText, setSupportReportText] = useState("");
  const [supportReportError, setSupportReportError] = useState("");
  const [supportReportSending, setSupportReportSending] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [attachmentSyncVersion, setAttachmentSyncVersion] = useState(0);
  const sendLocked = useRef(false);
  const lastSendAttempt = useRef<ChatMessage | null>(null);
  const attachmentMessageSync = useRef<AttachmentMessageSync | null>(null);
  const threadRef = useRef<FlatList<ChatMessage>>(null);
  const swipeValues = useRef(new Map<string, Animated.Value>());
  const keepAtBottom = useRef(true);
  const [selectedMedia, setSelectedMedia] = useState<{
    attachments: ChatAttachment[];
    index: number;
  } | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [allowReapply, setAllowReapply] = useState(false);
  const [rejectError, setRejectError] = useState("");
  const [applicationActionPending, setApplicationActionPending] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [sendingTaskId, setSendingTaskId] = useState<string | null>(null);
  const [taskPickerError, setTaskPickerError] = useState("");
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false);
  const submitSupportReport = async () => {
    const body = supportReportText.trim();
    if (!supportReportType || (!body && !attachments.length)) { setSupportReportError("Add a message or attachment before sending."); return; }
    if (body.length > 4500) { setSupportReportError("Keep your message under 4,500 characters."); return; }
    if (!onSendMessage) { setSupportReportError("Support chat is unavailable. Please try again."); return; }
    setSupportReportSending(true);
    setSupportReportError("");
    const message: MarketplaceMessage = {
      id: `support-${Date.now()}`,
      clientMessageId: `${supportReportType === "Feedback" ? "feedback" : "bug-report"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: `[${supportReportType}] ${body}`,
      mine: true,
      senderRole: role,
      time: "Now",
      createdAt: new Date().toISOString(),
      status: "sent",
    };
    try {
      const uploaded = await uploadAttachments();
      message.attachments = uploaded.map(toMessageAttachment);
      message.text = `[${supportReportType}]${body ? ` ${body}` : ""}`;
      const saved = await onSendMessage(message);
      setMessages((current) => mergeChatMessages(current, [saved ?? message]));
      clearAttachments();
      keepAtBottom.current = true;
      setSupportReportType(null);
      setSupportReportText("");
      requestAnimationFrame(() => threadRef.current?.scrollToEnd({ animated: true }));
    } catch (error) {
      setSupportReportError(error instanceof Error ? error.message : "Your report could not be sent. Try again.");
    } finally { setSupportReportSending(false); }
  };
  const openAttachment = async (uri?: string) => {
    if (!uri) { setAttachmentError("This attachment has no available file link."); return; }
    try {
      await Linking.openURL(uri);
      setAttachmentError("");
    } catch {
      setAttachmentError("This attachment could not be opened on this device.");
    }
  };
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(
    null,
  );
  const [messageActionMode, setMessageActionMode] = useState<
    "actions" | "reactions" | null
  >(null);
  const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(
    null,
  );
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const lastMessageTap = useRef<{ id: string; at: number } | null>(null);
  const [attachmentToRemove, setAttachmentToRemove] =
    useState<MediaAttachment | null>(null);
  const [reactions, setReactions] = useState<Record<string, string | undefined>>(
    {},
  );
  const canMessage = !blocked && conversationStatus === "Accepted";
  const notifyTyping = (active: boolean) => {
    if (!onTyping || !canMessage) return;
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    if (!active) {
      if (typingActive.current) onTyping(false);
      typingActive.current = false;
      return;
    }
    if (!typingActive.current) onTyping(true);
    typingActive.current = true;
    typingStopTimer.current = setTimeout(() => {
      typingActive.current = false;
      onTyping(false);
    }, 1_500);
  };
  useEffect(() => () => {
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    if (typingActive.current) onTypingRef.current?.(false);
  }, []);
  const canReviewApplication = Boolean(application) && (
    (role === "Brand" && application?.direction !== "brand-to-creator") ||
    (role === "Influencer" && application?.direction === "brand-to-creator")
  );
  const isBrandInvitation = role === "Influencer" && application?.direction === "brand-to-creator";
  const normalizeStoredMessages = (items: MarketplaceMessage[]) => items.map((message) => ({
    ...message,
    mine: adminChat ? message.mine : message.senderRole ? message.senderRole === role : message.mine,
  }));
  const [messages, setMessages] = useState<ChatMessage[]>(() => storedMessages ? normalizeStoredMessages(storedMessages) : (application ? [] : liveSession ? [] : initialMessage
    ? [{ id: "application-message", text: initialMessage, mine: initialMessageMine, time: "Just now", status: "delivered", attachments: initialAttachments?.filter((item): item is DemoAttachment & { uri: string } => Boolean(item.uri)) }]
    : [
      {
        id: "m1",
        text: role === "Influencer" ? "Hi Aarohi! I would love to know more about your content approach." : "Hi Maya! I would love to know more about the deliverables.",
        mine: false,
        time: "10:41 AM",
      },
      {
        id: "m2",
        text: "Thanks for connecting. I have shared the brief details here.",
        mine: true,
        time: "10:43 AM",
        status: "seen",
        attachments: [
          { id: "demo-chat-image-1", name: "Brief moodboard", type: "image", uri: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=640&q=80" },
          { id: "demo-chat-image-2", name: "Product reference", type: "image", uri: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=640&q=80" },
        ],
      },
    ]));
  const seenMessageIds = useRef(new Set(messages.map((message) => message.id)));
  const loadingOlderMessages = useRef(false);
  const olderMessagesBefore = useRef<{ createdAt: string; id: string } | null>(null);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [olderHistoryExpanded, setOlderHistoryExpanded] = useState(false);
  // shortcut: message pins stay on this account's device until chat exposes a server pin API.
  const [pinnedMessage, setPinnedMessage] = useState<Pick<ChatMessage, "id" | "text" | "mine" | "createdAt" | "time"> | null>(null);
  const [pinStoreReady, setPinStoreReady] = useState(false);
  const [pinStoreKey, setPinStoreKey] = useState("");
  const [initialHistoryCutoff] = useState(() => Date.now() - 2 * 24 * 60 * 60 * 1000);
  const initialScrollPending = useRef(true);
  const initialHistoryStarted = useRef(false);
  useEffect(() => {
    if (storedMessages) setMessages((current) => mergeChatMessages(current, normalizeStoredMessages(storedMessages)));
  }, [role, storedMessages]);
  useEffect(() => {
    let active = true;
    const key = pinStorageKey ?? "";
    setPinStoreReady(false);
    setPinStoreKey(key);
    if (!key) { setPinnedMessage(null); setPinStoreReady(true); return () => { active = false; }; }
    void AsyncStorage.getItem(key).then((raw) => {
      if (!active) return;
      try {
        const value = raw ? JSON.parse(raw) as Pick<ChatMessage, "id" | "text" | "mine" | "createdAt" | "time"> : null;
        setPinnedMessage(value && typeof value.id === "string" && typeof value.text === "string" && typeof value.mine === "boolean" ? value : null);
      } catch { setPinnedMessage(null); }
      setPinStoreReady(true);
    }).catch(() => { if (active) { setPinnedMessage(null); setPinStoreReady(true); } });
    return () => { active = false; };
  }, [pinStorageKey]);
  useEffect(() => {
    if (!pinStoreReady || !pinStoreKey || pinStoreKey !== (pinStorageKey ?? "")) return;
    const operation = pinnedMessage ? AsyncStorage.setItem(pinStoreKey, JSON.stringify(pinnedMessage)) : AsyncStorage.removeItem(pinStoreKey);
    void operation.catch(() => undefined);
  }, [pinStorageKey, pinStoreKey, pinStoreReady, pinnedMessage]);
  useEffect(() => {
    const deletedIds = new Set(messages.filter((message) => message.deleted).map((message) => message.id));
    if (selectedMessage && deletedIds.has(selectedMessage.id)) { setSelectedMessage(null); setMessageActionMode(null); }
    if (replyingTo && deletedIds.has(replyingTo.id)) setReplyingTo(null);
    if (pinnedMessage && deletedIds.has(pinnedMessage.id)) setPinnedMessage(null);
    if (deletedIds.size) setReactions((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !deletedIds.has(id))));
  }, [messages, pinnedMessage, replyingTo, selectedMessage]);
  useEffect(() => {
    if (historyLoading) { initialHistoryStarted.current = true; return; }
    if (!initialHistoryStarted.current || !initialScrollPending.current) return;
    requestAnimationFrame(() => {
      threadRef.current?.scrollToEnd({ animated: false });
      keepAtBottom.current = true;
      initialScrollPending.current = false;
    });
  }, [historyLoading]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!initialScrollPending.current || initialHistoryStarted.current) return;
      requestAnimationFrame(() => {
        threadRef.current?.scrollToEnd({ animated: false });
        keepAtBottom.current = true;
        initialScrollPending.current = false;
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [conversationId]);
  useEffect(() => {
    if (initialScrollPending.current) {
      messages.forEach((message) => seenMessageIds.current.add(message.id));
      requestAnimationFrame(() => threadRef.current?.scrollToEnd({ animated: false }));
      return;
    }
    let incoming = messages.filter((message) => !seenMessageIds.current.has(message.id));
    if (loadingOlderMessages.current) {
      const cutoff = olderMessagesBefore.current;
      const historical = incoming.filter((message) => !cutoff || !message.createdAt || message.createdAt < cutoff.createdAt || (message.createdAt === cutoff.createdAt && message.id < cutoff.id));
      historical.forEach((message) => seenMessageIds.current.add(message.id));
      incoming = incoming.filter((message) => !historical.includes(message));
      if (!historyLoading) {
        loadingOlderMessages.current = false;
        olderMessagesBefore.current = null;
      }
    }
    incoming.forEach((message) => seenMessageIds.current.add(message.id));
    if (!incoming.length) return;
    if (keepAtBottom.current) {
      keepAtBottom.current = true;
      setNewMessageCount(0);
      requestAnimationFrame(() => threadRef.current?.scrollToEnd({ animated: true }));
    } else {
      setNewMessageCount((count) => count + incoming.filter((message) => !message.mine).length);
    }
  }, [historyLoading, messages]);
  const {
    attachments,
    addFile,
    addGif,
    addMedia,
    uploadAttachments,
    getUploadedAttachments,
    hasPendingUploads,
    clearAttachments,
    removeAttachment,
    uploadError,
    isBusy: isSelectingOrUploading,
  } =
    useMediaAttachments();
  const canSend = canMessage && !isSending && Boolean(draft.trim() || attachments.length);
  const openMedia = (items: ChatAttachment[], index: number) => {
    if (!items[index]?.uri) {
      setAttachmentError("This attachment has no available file link.");
      return;
    }
    setAttachmentError("");
    setSelectedMedia({ attachments: items, index });
  };
  const toMessageAttachment = (item: MediaAttachment): DemoAttachment => {
    const { uploadState: _uploadState, ...attachment } = item;
    return attachment;
  };
  useEffect(() => {
    const sync = attachmentMessageSync.current;
    if (!sync || !attachments.length) return;
    const uploaded = getUploadedAttachments();
    if (uploaded.length > sync.syncedCount) {
      sync.syncedCount = uploaded.length;
      const messageAttachments = uploaded.map(toMessageAttachment);
      setMessages((current) => current.map((message) => message.id === sync.messageId ? { ...message, attachments: messageAttachments } : message));
      void Promise.resolve(onUpdateMessage?.(sync.messageId, { text: sync.text, attachments: messageAttachments })).then(() => {
        const currentSync = attachmentMessageSync.current;
        if (!currentSync || currentSync.messageId !== sync.messageId) return;
        const settled = !hasPendingUploads() && attachments.every((item) => item.uploadState !== "failed");
        if (settled && uploaded.length >= attachments.length) {
          uploaded.forEach((item) => removeAttachment(item.id));
          attachmentMessageSync.current = null;
        }
      }).catch(() => {
        setAttachmentError("The message was sent, but one attachment could not be synced. Please try again.");
      });
    }
  }, [attachmentSyncVersion, attachments, getUploadedAttachments, hasPendingUploads, onUpdateMessage, removeAttachment]);
  const send = async () => {
    if (!canSend || sendLocked.current) return;
    const content = draft.trim();
    if (!content && attachments.length === 0) return;
    sendLocked.current = true;
    setIsSending(true);
    setAttachmentError("");
    let pendingMessage: ChatMessage | undefined;
    let previousEdited: ChatMessage | undefined;
    try {
      if (editingMessageId) {
        previousEdited = messages.find((message) => message.id === editingMessageId);
        if (!previousEdited) return;
        const changes = { text: content || previousEdited.text, edited: true };
        setMessages((current) => current.map((message) => message.id === editingMessageId ? { ...message, ...changes } : message));
        await onUpdateMessage?.(editingMessageId, changes);
        setEditingMessageId(null);
      } else {
        const selectedAttachments = attachments.slice();
        if (adminChat && selectedAttachments.length) await uploadAttachments();
        const uploadedAttachments = getUploadedAttachments();
        const hasPendingAttachmentUploads = !adminChat && (hasPendingUploads() || selectedAttachments.some((item) => isLocalMediaUri(item.uri)));
        const readyAttachments = adminChat || !hasPendingAttachmentUploads ? uploadedAttachments.map(toMessageAttachment) : undefined;
        const failed = [lastSendAttempt.current, ...messages.filter((item) => item.status === "failed")].find((item) => item && item.text === content && (item.attachments ?? []).map((file) => file.id).join() === selectedAttachments.map((file) => file.id).join());
        const message: ChatMessage = {
          id: failed?.id ?? `${Date.now()}`,
          clientMessageId: failed?.clientMessageId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: content, mine: true, createdAt: new Date().toISOString(), senderRole: role,
          replyToId: replyingTo?.id,
          time: "Now", status: "sent", attachmentName: selectedAttachments.map((item) => item.name).join(", "), attachments: selectedAttachments as DemoAttachment[],
          replyTo: replyingTo ? { author: replyingTo.mine ? "You" : name, text: messagePreviewText(replyingTo) } : undefined,
        };
        pendingMessage = message;
        lastSendAttempt.current = message;
        keepAtBottom.current = true;
        setMessages((current) => mergeChatMessages(current, [message]));
        if (liveSession && (!conversationId || !onSendMessage)) throw new Error("This conversation is unavailable. Reopen it and try again.");
        const savedMessage = conversationId
          ? await onSendMessage?.({
              ...message,
              text: content || (selectedAttachments.length ? "Sent an attachment" : ""),
              attachments: readyAttachments,
            })
          : undefined;
        const savedMessageId = savedMessage?.id ?? message.id;
        setMessages((current) => current.map((item) => item.id === message.id ? { ...item, id: savedMessageId, attachments: selectedAttachments as DemoAttachment[] } : item));
        if (hasPendingAttachmentUploads && savedMessageId !== message.id) {
          attachmentMessageSync.current = { messageId: savedMessageId, text: content, syncedCount: 0 };
          setAttachmentSyncVersion((current) => current + 1);
        } else if (hasPendingAttachmentUploads) {
          attachmentMessageSync.current = { messageId: savedMessageId, text: content, syncedCount: 0 };
          setAttachmentSyncVersion((current) => current + 1);
        } else {
          clearAttachments();
        }
        lastSendAttempt.current = null;
      }
      setDraft("");
      setReplyingTo(null);
      if (!attachmentMessageSync.current && attachments.length) clearAttachments();
    } catch (error) {
      if (previousEdited) { const previous = previousEdited; setMessages((current) => current.map((item) => item.id === previous.id ? previous : item)); }
      if (pendingMessage) { const failedId = pendingMessage.id; setMessages((current) => current.map((item) => item.id === failedId ? { ...item, status: "failed" } : item)); }
      setAttachmentError(error instanceof Error ? error.message : "This message could not be saved. Try again.");
    } finally { sendLocked.current = false; setIsSending(false); }
  };
  const closeMessageActions = () => {
    setSelectedMessage(null);
    setMessageActionMode(null);
  };
  const chooseReaction = (reaction: string) => {
    if (!selectedMessage || selectedMessage.deleted) return;
    setReactions((current) => ({
      ...current,
      [selectedMessage.id]:
        current[selectedMessage.id] === reaction ? undefined : reaction,
    }));
    closeMessageActions();
  };
  const startReply = () => {
    if (!selectedMessage || selectedMessage.deleted || !canMessage) return;
    setReplyingTo(selectedMessage);
    closeMessageActions();
  };
  const toggleLike = (message: ChatMessage) => {
    if (message.deleted) return;
    setReactions((current) => ({ ...current, [message.id]: current[message.id] === "like" ? undefined : "like" }));
  };
  const handleMessagePress = (message: ChatMessage) => {
    if (message.deleted) return;
    const now = Date.now();
    const previous = lastMessageTap.current;
    if (previous?.id === message.id && now - previous.at < 320) {
      toggleLike(message);
      lastMessageTap.current = null;
      return;
    }
    lastMessageTap.current = { id: message.id, at: now };
    setTimeout(() => {
      if (lastMessageTap.current?.id === message.id && Date.now() - lastMessageTap.current.at >= 320) lastMessageTap.current = null;
    }, 340);
  };
  const startEdit = () => {
    if (!selectedMessage?.mine || selectedMessage.deleted || adminChat || !onUpdateMessage) return;
    setEditingMessageId(selectedMessage.id);
    setDraft(selectedMessage.text);
    setReplyingTo(null);
    closeMessageActions();
  };
  const confirmDeleteMessage = async () => {
    if (!messageToDelete || messageToDelete.deleted || adminChat || !onDeleteMessage || sendLocked.current) return;
    const removed = messageToDelete;
    sendLocked.current = true; setIsSending(true);
    try {
      if (conversationId) await onDeleteMessage?.(removed.id);
      setMessages((current) => current.map((message) => message.id === removed.id ? {
        ...message,
        deleted: true,
        text: "This message was deleted",
        attachments: [],
        attachmentName: undefined,
        replyTo: undefined,
        taskId: undefined,
        campaignRequestId: undefined,
        videoBriefId: undefined,
      } : message));
      if (replyingTo?.id === removed.id) setReplyingTo(null);
      setMessageToDelete(null);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "This message could not be deleted. Try again.");
      setMessageToDelete(null);
    } finally { sendLocked.current = false; setIsSending(false); }
  };
  const confirmRemoveAttachment = () => {
    if (attachmentToRemove) removeAttachment(attachmentToRemove.id);
    setAttachmentToRemove(null);
  };
  const messagePreviewText = (message: ChatMessage) => {
    const text = message.text?.trim();
    if (text) return text;
    if (message.attachmentName) return message.attachmentName;
    if (message.attachments?.length) return `${message.attachments.length} attachment${message.attachments.length === 1 ? "" : "s"}`;
    return "Message";
  };
  const togglePinnedMessage = (message: ChatMessage) => {
    if (message.deleted || !pinStorageKey) return;
    setPinnedMessage((current) => current?.id === message.id ? null : {
      id: message.id,
      text: messagePreviewText(message),
      mine: message.mine,
      createdAt: message.createdAt,
      time: message.time,
    });
    closeMessageActions();
  };
  const replyPreviewFor = (message: ChatMessage) => {
    if (message.replyTo) return message.replyTo;
    if (!message.replyToId) return undefined;
    const target = messages.find((item) => item.id === message.replyToId);
    if (!target) return { author: "Replied message", text: "Original message unavailable" };
    return {
      author: target.mine ? "You" : name,
      text: messagePreviewText(target),
    };
  };
  const applicationAttachments = application?.attachments.filter((attachment): attachment is ChatAttachment => attachment.type !== "social-review") ?? [];
  const applicationCard = application ? <AppCard style={styles.applicationCard}>
    <View style={styles.applicationHeader}><View style={styles.flex}><Text style={styles.applicationEyebrow}>APPLICATION</Text><Text style={styles.applicationTitle}>{application.briefTitle}</Text><Text style={styles.applicationMeta}>{application.brandName} · {formatDisplayDateTime(application.submittedAt)}</Text></View><Text style={styles.applicationStatus}>{application.status === "Declined" ? "Rejected" : application.status}</Text></View>
    <View style={styles.applicationPerson}><Avatar initials={application.creatorInitials} uri={application.creatorProfile.avatarUrl} size="small" /><View style={styles.flex}><Text style={styles.applicationName}>{application.creatorName}</Text><Text style={styles.applicationMeta}>{application.creatorProfile.niche} · {application.creatorProfile.city} · {application.creatorProfile.followers} followers</Text></View></View>
    <Text style={styles.applicationBody}>{application.message}</Text>
    {applicationAttachments.length ? <ChatAttachmentGrid attachments={applicationAttachments} onOpen={(index) => openMedia(applicationAttachments, index)} /> : null}
    {application.status === "Declined" ? <View style={styles.declineInfo}><Text style={styles.applicationName}>Brand feedback</Text><Text style={styles.applicationBody}>{application.rejectionReason || "The brand declined this application."}</Text><Text style={styles.applicationMeta}>{application.canReapply ? role === "Brand" ? "The creator may apply again." : "You can apply again from Market." : "Another application is not available for this brief."}</Text></View> : null}
    {!blocked && canReviewApplication && application.status === "Pending" && onAcceptApplication && onRejectApplication ? <View style={styles.applicationActions}><AppButton label="Accept" icon="checkmark" loading={applicationActionPending} onPress={() => { setApplicationActionPending(true); void Promise.resolve(onAcceptApplication()).finally(() => setApplicationActionPending(false)); }} style={styles.flex} /><AppButton label="Reject" icon="close" variant="secondary" disabled={applicationActionPending} onPress={() => setRejectOpen(true)} style={styles.flex} /></View> : null}
    {!blocked && application.status === "Accepted" && !application.completedAt && onConfirmCompletion ? <View style={styles.applicationActions}><AppButton label={application.completionConfirmedBy?.[role === "Brand" ? "brand" : "creator"] ? "Completion confirmed" : "Confirm completion"} icon="checkmark-circle-outline" loading={applicationActionPending} disabled={applicationActionPending || Boolean(application.completionConfirmedBy?.[role === "Brand" ? "brand" : "creator"])} onPress={() => { setApplicationActionPending(true); void Promise.resolve(onConfirmCompletion()).finally(() => setApplicationActionPending(false)); }} style={styles.flex} /></View> : null}
    {!blocked && application.completedAt && onReviewApplication && !(application.reviews ?? []).some((review) => review.authorId === (role === "Brand" ? application.brandId : application.creatorId)) ? <View style={styles.applicationActions}><AppButton label="Review collaboration" icon="star-outline" onPress={onReviewApplication} style={styles.flex} /></View> : null}
  </AppCard> : null;
  const hasApplicationMessage = Boolean(application && messages.some((message) => message.campaignRequestId === application.id));
  const applicationAnchor = application && !hasApplicationMessage ? {
    id: `application-card-${application.id}`,
    text: "",
    mine: false,
    time: "",
    createdAt: application.submittedAt,
    applicationCardAnchor: true,
  } : undefined;
  const allTimelineMessages = applicationAnchor ? mergeChatMessages(messages, [applicationAnchor]) : messages;
  const timelineMessages = olderHistoryExpanded
    ? allTimelineMessages
    : allTimelineMessages.filter((message) => !message.createdAt || new Date(message.createdAt).getTime() >= initialHistoryCutoff || message.applicationCardAnchor);
  const applicationAnchorId = application ? messages.find((message) => message.campaignRequestId === application.id)?.id ?? applicationAnchor?.id : undefined;
  const selectedMessages = selectedMessageIds.map((id) => messages.find((message) => message.id === id)).filter((message): message is ChatMessage => Boolean(message && !message.deleted));
  const canBulkDelete = !adminChat && Boolean(onDeleteMessage) && selectedMessages.length > 0 && selectedMessages.every((message) => message.mine);
  const canForwardMessage = (message: ChatMessage) => !message.deleted && !message.applicationCardAnchor && !message.taskId && !message.campaignRequestId && !message.videoBriefId && !message.attachments?.some((attachment) => attachment.type === "social-review");
  const toggleSelectedMessage = (message: ChatMessage) => {
    if (!canForwardMessage(message)) return;
    if (selectedMessageIds.includes(message.id)) {
      const next = selectedMessageIds.filter((id) => id !== message.id);
      setSelectedMessageIds(next);
      if (!next.length) setForwardPickerOpen(false);
      return;
    }
    if (selectedMessageIds.length >= 5) { setAttachmentError("Select up to 5 messages at a time."); return; }
    setAttachmentError("");
    setSelectedMessageIds([...selectedMessageIds, message.id]);
  };
  const openForwardPicker = () => {
    if (!onForwardMessages || !selectedMessages.length || !forwardTargets.length) return;
    setForwardBatchId(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setForwardPickerOpen(true);
  };
  const selectMessageAndForward = (message: ChatMessage | null) => {
    if (!message || !onForwardMessages || !forwardTargets.length || !canForwardMessage(message)) return;
    if (!selectedMessageIds.includes(message.id) && selectedMessageIds.length >= 5) { setAttachmentError("Select up to 5 messages at a time."); closeMessageActions(); return; }
    setSelectedMessageIds((current) => current.includes(message.id) ? current : [...current, message.id]);
    setForwardBatchId(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setForwardPickerOpen(true);
    closeMessageActions();
  };
  const forwardSelectedMessages = async (targetId: string) => {
    if (!onForwardMessages || forwarding || !selectedMessages.length) return;
    setForwarding(true);
    setAttachmentError("");
    try {
      await onForwardMessages(targetId, selectedMessages.map(({ id, text, attachments }) => ({ id, text, attachments } as MarketplaceMessage)), forwardBatchId);
      setForwardPickerOpen(false);
      setSelectedMessageIds([]);
      setForwardBatchId("");
      setAttachmentError("");
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Messages could not be forwarded. Try again.");
    } finally { setForwarding(false); }
  };
  const confirmDeleteSelectedMessages = async () => {
    if (!canBulkDelete || !onDeleteMessage || sendLocked.current) return;
    sendLocked.current = true;
    setIsSending(true);
    const results = await Promise.allSettled(selectedMessages.map((message) => onDeleteMessage(message.id)));
    const deletedIds = new Set(selectedMessages.filter((_, index) => results[index].status === "fulfilled").map((message) => message.id));
    if (deletedIds.size) {
      setMessages((current) => current.map((message) => deletedIds.has(message.id) ? { ...message, deleted: true, text: "This message was deleted", attachments: [], attachmentName: undefined, replyTo: undefined, taskId: undefined, campaignRequestId: undefined, videoBriefId: undefined } : message));
      setSelectedMessageIds((current) => current.filter((id) => !deletedIds.has(id)));
    }
    const failedCount = results.length - deletedIds.size;
    setAttachmentError(failedCount ? `${deletedIds.size} deleted; ${failedCount} could not be deleted. Try again.` : "");
    setBulkDeleteOpen(false);
    sendLocked.current = false;
    setIsSending(false);
  };
  const jumpToReply = (messageId?: string) => {
    if (!messageId) return;
    const index = allTimelineMessages.findIndex((message) => message.id === messageId);
    if (index < 0) { setAttachmentError("Load older messages to find this reply."); return; }
    setHighlightedMessageId(messageId);
    if (!olderHistoryExpanded && allTimelineMessages[index].createdAt && new Date(allTimelineMessages[index].createdAt!).getTime() < initialHistoryCutoff) setOlderHistoryExpanded(true);
    requestAnimationFrame(() => {
      const scroll = () => threadRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      try { scroll(); }
      catch { threadRef.current?.scrollToOffset({ offset: Math.max(0, index * 100), animated: true }); }
    });
    setTimeout(() => setHighlightedMessageId((current) => current === messageId ? null : current), 1500);
  };
  return (
    <Animated.View style={{ flex: 1, opacity: enterProgress, transform: [{ translateY: enterProgress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
    <KeyboardAvoidingView
      style={[styles.page, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={handleBack}
          style={styles.iconButton}
        >
          <AppIcon name="chevron-back" />
        </Pressable>
        <View style={styles.avatarWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${name} profile`}
            onPress={onOpenProfile}
            hitSlop={6}
          >
            <Avatar initials={initials} uri={avatarUrl} size="small" />
          </Pressable>
          {online ? <View style={styles.onlineDot} /> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${name} profile`}
          onPress={onOpenProfile}
          style={styles.headerInfo}
        >
          <Text style={styles.name}>{name}</Text>
          <Text style={[styles.status, !online && !typing && styles.statusOffline]}>
            {blocked
              ? "Messaging blocked"
              : conversationStatus === "Pending"
                ? "Application awaiting review"
                : conversationStatus === "Declined"
                  ? "Application declined"
                  : typing
                    ? "typing…"
                    : online
                      ? "Online"
                      : "Offline"}
          </Text>
        </Pressable>
        {!adminChat && onToggleConversationPin ? <Pressable accessibilityRole="button" accessibilityLabel={isConversationPinned ? `Unpin ${name} chat` : `Pin ${name} chat`} accessibilityState={{ selected: isConversationPinned }} onPress={onToggleConversationPin} style={styles.iconButton}><AppIcon name={isConversationPinned ? "pin" : "pin-outline"} color={isConversationPinned ? theme.colors.primary : theme.colors.textSecondary} /></Pressable> : null}
        {onToggleBlock ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={blocked ? `Unblock ${name}` : `Block ${name}`}
            onPress={() => blocked ? onToggleBlock?.() : setBlockConfirmOpen(true)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <AppIcon name={blocked ? "lock-open-outline" : "ban-outline"} color={blocked ? theme.colors.primary : theme.colors.danger} />
          </Pressable>
        ) : null}
      </View>
      {selectedMessageIds.length ? <View style={styles.selectionToolbar}>
        <Text style={styles.selectionCount}>{selectedMessageIds.length}/5 selected</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel message selection" onPress={() => setSelectedMessageIds([])} style={styles.selectionIcon}><AppIcon name="close" color={theme.colors.textSecondary} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Forward selected messages" disabled={!onForwardMessages || !forwardTargets.length || forwarding} onPress={openForwardPicker} style={[styles.selectionAction, (!onForwardMessages || !forwardTargets.length) && styles.selectionDisabled]}><AppIcon name="arrow-redo-outline" size={17} color={theme.colors.primary} /><Text style={styles.selectionActionText}>Forward</Text></Pressable>
        {canBulkDelete ? <Pressable accessibilityRole="button" accessibilityLabel="Delete selected messages" onPress={() => setBulkDeleteOpen(true)} style={styles.selectionAction}><AppIcon name="trash-outline" size={17} color={theme.colors.danger} /><Text style={[styles.selectionActionText, { color: theme.colors.danger }]}>Delete</Text></Pressable> : null}
      </View> : null}
      {pinnedMessage ? <Pressable accessibilityRole="button" accessibilityLabel={`Pinned message from ${pinnedMessage.mine ? "you" : name}. Tap to jump to it.`} onPress={() => jumpToReply(pinnedMessage.id)} style={styles.pinnedMessageBanner}><AppIcon name="pin" size={17} color={theme.colors.primary} /><View style={styles.flex}><Text style={styles.pinnedMessageLabel}>Pinned message</Text><Text numberOfLines={1} style={styles.pinnedMessageText}>{pinnedMessage.mine ? "You" : name}: {pinnedMessage.text}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Unpin message" onPress={(event) => { event.stopPropagation(); setPinnedMessage(null); }} style={styles.selectionIcon}><AppIcon name="close" size={16} color={theme.colors.textSecondary} /></Pressable></Pressable> : null}
      <FlatList
        ref={threadRef}
        contentContainerStyle={styles.thread}
        showsVerticalScrollIndicator={false}
        data={timelineMessages}
        keyExtractor={(message) => message.id}
        initialNumToRender={20}
        windowSize={7}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        onLayout={() => { if ((initialScrollPending.current || keepAtBottom.current) && timelineMessages.length) requestAnimationFrame(() => threadRef.current?.scrollToEnd({ animated: false })); }}
        onContentSizeChange={() => { if ((initialScrollPending.current || keepAtBottom.current) && timelineMessages.length) threadRef.current?.scrollToEnd({ animated: false }); }}
        onScroll={({ nativeEvent }) => {
          if (initialScrollPending.current) return;
          keepAtBottom.current = nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height - nativeEvent.contentOffset.y < 80;
          if (keepAtBottom.current) setNewMessageCount(0);
        }}
        onScrollToIndexFailed={({ index }) => {
          threadRef.current?.scrollToOffset({ offset: Math.max(0, index * 100), animated: true });
          setTimeout(() => threadRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }), 120);
        }}
        scrollEventThrottle={100}
        ListHeaderComponent={<>
        {hasOlderMessages && onLoadOlderMessages ? <AppButton label="Load older messages" compact variant="secondary" loading={historyLoading} disabled={historyLoading} onPress={() => { setOlderHistoryExpanded(true); const oldest = timelineMessages.find((message) => message.createdAt); loadingOlderMessages.current = true; olderMessagesBefore.current = oldest?.createdAt ? { createdAt: oldest.createdAt, id: oldest.id } : null; onLoadOlderMessages(); }} /> : null}
        {historyError ? <View><Text accessibilityRole="alert" style={styles.attachmentError}>{historyError}</Text>{onRetryHistory ? <AppButton label="Try again" compact onPress={onRetryHistory} /> : null}</View> : null}
        {historyLoading && !messages.length ? <View style={{ gap: 10 }}>{[0, 1, 2].map((key) => <Skeleton key={key} height={48} />)}</View> : null}
        <View style={styles.encryptionNote}>
          <AppIcon name="lock-closed-outline" size={15} color={theme.colors.primary} />
          <Text style={styles.encryptionText}>
            {adminChat
              ? "Private messages with Brandly. Attach photos, videos, and files when you need to."
              : conversationStatus === "Pending"
              ? "Application thread. The brand must accept before messaging starts."
              : "Private collaboration chat. Keep briefs and files inside this conversation."}
          </Text>
        </View>
        </>}
        renderItem={({ item: message, index }) => {
          const day = chatDayLabel(message.createdAt);
          const previousDay = chatDayLabel(timelineMessages[index - 1]?.createdAt);
          const supportReportType = adminChat ? /^\[(Feedback|Bug report)\]\s*/.exec(message.text)?.[1] : undefined;
          const supportReportBody = supportReportType ? message.text.replace(/^\[(?:Feedback|Bug report)\]\s*/, "") : message.text;
          const mediaAttachments = message.attachments?.filter((attachment): attachment is ChatAttachment => attachment.type !== "social-review") ?? [];
          const dayDivider = day && day !== previousDay ? <View style={styles.dayDivider}><Text style={styles.dayDividerText}>{day}</Text></View> : null;
          if (message.applicationCardAnchor) return <View>{dayDivider}<View style={styles.applicationRow}>{applicationCard}</View></View>;
          const replyPreview = replyPreviewFor(message);
          let swipeValue = swipeValues.current.get(message.id);
          if (!swipeValue) { swipeValue = new Animated.Value(0); swipeValues.current.set(message.id, swipeValue); }
          const replyResponder = PanResponder.create({
            onMoveShouldSetPanResponder: (_, gesture) => canMessage && !selectedMessageIds.length && !message.deleted && gesture.dx > 16 && gesture.dx > Math.abs(gesture.dy),
            onPanResponderMove: (_, gesture) => swipeValue?.setValue(Math.max(0, Math.min(72, gesture.dx))),
            onPanResponderRelease: (_, gesture) => {
              if (canMessage && gesture.dx > 64 && !message.deleted) {
                setReplyingTo(message);
                setEditingMessageId(null);
              }
              Animated.spring(swipeValue!, { toValue: 0, useNativeDriver: NATIVE_ANIMATIONS_ENABLED, speed: 24, bounciness: 4 }).start();
            },
            onPanResponderTerminate: () => Animated.spring(swipeValue!, { toValue: 0, useNativeDriver: NATIVE_ANIMATIONS_ENABLED }).start(),
          });
          return <View key={message.id}>{dayDivider}<View style={styles.messageRow} {...replyResponder.panHandlers}>
          <Animated.View pointerEvents="none" style={[styles.replySwipeCue, { opacity: swipeValue.interpolate({ inputRange: [0, 20, 64], outputRange: [0, 0.55, 1], extrapolate: "clamp" }) }]}><AppIcon name="return-down-forward-outline" size={18} color={theme.colors.primary} /></Animated.View>
          <Animated.View style={[styles.messageContent, message.campaignRequestId && styles.messageContentCampaign, message.mine && styles.messageContentMine, { transform: [{ translateX: swipeValue }] }]}>
          {selectedMessageIds.includes(message.id) ? <View style={styles.selectedIndicator}><AppIcon name="checkmark-circle" size={18} color={theme.colors.primary} /></View> : null}
          <Pressable
            key={message.id}
            accessibilityRole="button"
            accessibilityLabel={`Message from ${message.mine ? "you" : name}`}
            onPress={() => selectedMessageIds.length ? toggleSelectedMessage(message) : handleMessagePress(message)}
            onLongPress={() => {
              if (message.deleted || !canMessage) return;
              setSelectedMessage(message);
              setMessageActionMode("actions");
            }}
            delayLongPress={350}
            style={[
              styles.bubble,
              selectedMessageIds.includes(message.id) && styles.selectedBubble,
              highlightedMessageId === message.id && styles.replyTargetHighlight,
              (Boolean(replyPreview) || Boolean(message.taskId) || Boolean(message.campaignRequestId) || Boolean(message.videoBriefId) || Boolean(message.attachments?.length)) && styles.richBubble,
              message.mine ? styles.bubbleMine : styles.bubbleOther,
            ]}
          >
            {!message.deleted && replyPreview ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Jump to replied message" disabled={!message.replyToId} onPress={() => jumpToReply(message.replyToId)} style={[styles.replyPreview, message.mine && styles.replyPreviewMine]}>
                <AppIcon
                  name="return-down-forward-outline"
                  size={15}
                  color={message.mine ? theme.colors.primaryText : theme.colors.primary}
                />
                <View style={styles.replyPreviewCopy}>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[styles.replyAuthor, message.mine && styles.bubbleMineText]}
                  >
                    {replyPreview.author}
                  </Text>
                  <Text
                    numberOfLines={2}
                    ellipsizeMode="tail"
                    style={[styles.replyText, message.mine && styles.bubbleMineText]}
                  >
                    {replyPreview.text}
                  </Text>
                </View>
              </Pressable>
            ) : null}
            {!message.deleted && message.taskId ? (() => {
              const task = tasks.find((item) => item.id === message.taskId);
              if (!task) return (
                <View style={[styles.taskMessage, message.mine && styles.taskMessageMine]}>
                  <View style={styles.videoBriefIcon}><AppIcon name="checkbox-outline" size={18} color={theme.colors.primary} /></View>
                  <View style={styles.flex}><Text style={[styles.videoBriefEyebrow, message.mine && styles.bubbleMineText]}>TASK</Text><Text style={[styles.videoBriefTitle, message.mine && styles.bubbleMineText]}>Shared task</Text><Text style={[styles.videoBriefMeta, message.mine && styles.bubbleMineText]}>Loading task details…</Text></View>
                </View>
              );
              const alreadyAdded = receivedTaskSourceIds.includes(task.id);
              return (
                <View style={[styles.taskMessage, message.mine && styles.taskMessageMine]}>
                  <View style={styles.videoBriefIcon}><AppIcon name="checkbox-outline" size={18} color={theme.colors.primary} /></View>
                  <View style={styles.flex}>
                    <Text style={[styles.videoBriefEyebrow, message.mine && styles.bubbleMineText]}>TASK</Text>
                    <Text style={[styles.videoBriefTitle, message.mine && styles.bubbleMineText]}>{task.title}</Text>
                    <Text numberOfLines={3} style={[styles.videoBriefMeta, message.mine && styles.bubbleMineText]}>{task.dueDate}{task.senderName ? ` · From ${task.senderName}` : ""}{task.notes ? ` · ${task.notes}` : ""}</Text>
                    <View style={styles.taskMessageActions}>
                      <AppButton label="View task" compact variant="secondary" style={styles.taskMessageButton} onPress={() => onOpenTask?.(task)} />
                      {role === "Influencer" ? <AppButton label={alreadyAdded ? "Added to your tasks" : "Add to your task list"} compact disabled={alreadyAdded} style={styles.taskMessageButton} onPress={() => onAddTaskToTodo?.(task, conversationId)} /> : null}
                    </View>
                  </View>
                </View>
              );
            })() : null}
            {!message.deleted && message.campaignRequestId ? (() => {
              const request = campaignRequests.find((item) => item.id === message.campaignRequestId);
              const campaign = campaigns.find((item) => item.id === request?.campaignId);
              if (!request || !campaign) return (
                <View style={[styles.taskMessage, message.mine && styles.taskMessageMine]}>
                  <View style={styles.videoBriefIcon}><AppIcon name="briefcase-outline" size={18} color={theme.colors.primary} /></View>
                  <View style={styles.flex}><Text style={[styles.videoBriefEyebrow, message.mine && styles.bubbleMineText]}>CAMPAIGN REQUEST</Text><Text style={[styles.videoBriefTitle, message.mine && styles.bubbleMineText]}>Campaign details</Text><Text style={[styles.videoBriefMeta, message.mine && styles.bubbleMineText]}>Loading campaign details…</Text></View>
                </View>
              );
              const status = request.status === "Declined" ? "Rejected" : request.status;
              const canRespond = request.direction === "brand-to-creator" ? role === "Influencer" : role === "Brand";
              const campaignCover = campaign.media?.find((item) => item.type === "image" && item.uri);
              const campaignUnavailable = campaign.visibility === "private" || campaign.approvalLimitReached === true;
              return (
                <View style={[styles.taskMessage, message.mine && styles.taskMessageMine]}>
                  <View style={styles.flex}>
                    {campaignCover?.uri ? <ExpoImage source={{ uri: campaignCover.uri }} contentFit="cover" style={styles.campaignRequestBanner} accessibilityLabel={`${campaign.title} campaign banner`} /> : <View style={styles.videoBriefIcon}><AppIcon name="briefcase-outline" size={18} color={theme.colors.primary} /></View>}
                    <Text style={[styles.videoBriefEyebrow, message.mine && styles.bubbleMineText]}>CAMPAIGN REQUEST · {campaign.visibility === "private" ? "PRIVATE" : campaignUnavailable ? "SLOTS FILLED" : status.toUpperCase()}</Text>
                    <Text style={[styles.videoBriefTitle, message.mine && styles.bubbleMineText]}>{campaign.title}</Text>
                    <Text numberOfLines={2} style={[styles.videoBriefMeta, message.mine && styles.bubbleMineText]}>{campaign.budget} · {campaign.description}</Text>
                    {campaign.applicationCount !== undefined ? <Text style={[styles.videoBriefMeta, message.mine && styles.bubbleMineText]}>{campaign.applicationCount} {campaign.applicationCount === 1 ? "creator applied" : "creators applied"}</Text> : null}
                    {campaignUnavailable ? <Text style={[styles.videoBriefMeta, message.mine && styles.bubbleMineText]}>{campaign.visibility === "private" ? "This campaign is private now." : "All approved creator slots are filled."}</Text> : null}
                    {!message.mine ? <View style={styles.taskMessageActions}>
                      {!campaignUnavailable ? <AppButton label="View campaign" compact variant="secondary" style={styles.taskMessageButton} onPress={() => onOpenCampaign?.(campaign)} /> : null}
                      {canRespond && request.status === "Pending" && !campaignUnavailable ? <><AppButton label="Accept" compact style={styles.taskMessageButton} onPress={() => onAcceptCampaignRequest?.(request.id)} /><AppButton label="Reject" compact variant="secondary" style={styles.taskMessageButton} onPress={() => onRejectCampaignRequest?.(request.id)} /></> : null}
                    </View> : null}
                  </View>
                </View>
              );
            })() : null}
            {!message.deleted && message.videoBriefId ? (() => {
              const brief = videoBriefs.find((item) => (item.briefId ?? item.id) === message.videoBriefId || item.id === message.videoBriefId);
              return brief ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View video brief ${brief.title}`}
                  onPress={() => onOpenVideoBrief?.(message.videoBriefId!)}
                  style={[styles.videoBriefMessage, message.mine && styles.videoBriefMessageMine]}
                >
                  <View style={styles.videoBriefIcon}><AppIcon name="videocam-outline" size={18} color={theme.colors.primary} /></View>
                  <View style={styles.flex}>
                    <Text style={[styles.videoBriefEyebrow, message.mine && styles.bubbleMineText]}>VIDEO BRIEF</Text>
                    <Text style={[styles.videoBriefTitle, message.mine && styles.bubbleMineText]}>{brief.title}</Text>
                    <Text numberOfLines={2} style={[styles.videoBriefMeta, message.mine && styles.bubbleMineText]}>{brief.dueDate} · {brief.notes || "Open the brief for details"}</Text>
                  </View>
                  <AppIcon name="chevron-forward" size={17} color={message.mine ? theme.colors.primaryText : theme.colors.primary} />
                </Pressable>
              ) : null;
            })() : null}
            {!message.deleted && message.attachments?.filter((attachment) => attachment.type === "social-review").map((card) => <View key={card.id} style={[styles.taskMessage, message.mine && styles.taskMessageMine]}>
              <View style={styles.videoBriefIcon}><AppIcon name="checkmark-circle-outline" size={19} color={theme.colors.primary} /></View>
              <View style={styles.flex}>
                <Text style={[styles.videoBriefEyebrow, message.mine && styles.bubbleMineText]}>SOCIAL ACCOUNT REVIEW</Text>
                <Text style={[styles.videoBriefTitle, message.mine && styles.bubbleMineText]}>{card.platform} · {card.handle}</Text>
                <Text style={[styles.videoBriefMeta, message.mine && styles.bubbleMineText]}>Review {card.contentType} proof; it must be public and match this account.</Text>
                {/^https?:\/\//i.test(card.contentUrl ?? "") ? <AppButton label="Open submitted proof" compact variant="secondary" style={styles.taskMessageButton} onPress={() => { void Linking.openURL(card.contentUrl!).catch(() => undefined); }} /> : null}
              </View>
            </View>)}
            {!message.deleted && mediaAttachments.length > 0 ? (
              <ChatAttachmentGrid
                attachments={mediaAttachments}
                mine={message.mine}
                onOpen={(index) => openMedia(mediaAttachments, index)}
              />
            ) : null}
            {!message.deleted && message.attachmentName && !message.attachments?.length ? (
              <View style={styles.attachment}>
                <AppIcon
                  name="document-text-outline"
                  color={
                    message.mine
                      ? theme.colors.primaryText
                      : theme.colors.primary
                  }
                />
                <Text
                  numberOfLines={2}
                  ellipsizeMode="middle"
                  style={[
                    styles.attachmentText,
                    message.mine && styles.bubbleMineText,
                  ]}
                >
                  {message.attachmentName}
                </Text>
              </View>
            ) : null}
            {supportReportType && !message.deleted ? <View style={styles.supportReportMessage}>
              <View style={styles.supportReportMessageHeading}><AppIcon name={supportReportType === "Bug report" ? "bug-outline" : "chatbox-ellipses-outline"} size={16} color={theme.colors.primary} /><Text style={styles.supportReportMessageTitle}>{supportReportType}</Text></View>
              {supportReportBody ? <Text style={styles.messageText}>{supportReportBody}</Text> : null}
            </View> : null}
            {!supportReportType && message.text && (
              (!message.taskId && !message.campaignRequestId && !message.videoBriefId) ||
              (Boolean(message.taskId) && !tasks.some((item) => item.id === message.taskId)) ||
              (Boolean(message.campaignRequestId) && (
                !campaignRequests.some((item) => item.id === message.campaignRequestId) ||
                !campaigns.some((item) => item.id === campaignRequests.find((request) => request.id === message.campaignRequestId)?.campaignId)
              )) ||
              (Boolean(message.videoBriefId) && !videoBriefs.some((item) => (item.briefId ?? item.id) === message.videoBriefId || item.id === message.videoBriefId))
            ) ? (
              <Text
                style={[
                  styles.messageText,
                  message.deleted && styles.deletedMessage,
                  message.mine && styles.bubbleMineText,
                ]}
              >
                {message.text}
              </Text>
            ) : null}
            <View style={styles.messageFooter}>
              <Text style={[styles.time, message.mine && styles.bubbleMineTime]}>
                {message.time}{message.edited ? " · edited" : ""}
              </Text>
               {message.mine ? (
                 <AppIcon
                   name={
                     message.status === "failed"
                       ? "alert-circle-outline"
                       : message.status === "seen"
                       ? "checkmark-done"
                      : message.status === "delivered"
                        ? "checkmark-done-outline"
                        : "checkmark"
                  }
                  size={15}
                   color={message.status === "failed" ? theme.colors.danger : message.status === "seen" ? theme.colors.success : theme.colors.primaryText}
                />
              ) : null}
            </View>
          </Pressable>
          {!message.deleted && reactions[message.id] ? (() => {
            const reaction = REACTION_OPTIONS.find((item) => item.key === reactions[message.id]);
            if (!reaction) return null;
            return (
              <View style={[styles.reactionBadge, { backgroundColor: reaction.background }]}>
                <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              </View>
            );
          })() : null}
          </Animated.View>
          {applicationCard && message.id === applicationAnchorId ? <View style={styles.applicationRow}>{applicationCard}</View> : null}
          </View></View>;
        }}
        ListFooterComponent={typing ? <View style={styles.typingIndicator}><View style={styles.typingDots}><View style={styles.typingDot} /><View style={styles.typingDot} /><View style={styles.typingDot} /></View><Text style={styles.typingText}>typing…</Text></View> : null}
        ListEmptyComponent={applicationCard}
      />
      {newMessageCount > 0 ? <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${newMessageCount} new message${newMessageCount === 1 ? "" : "s"}. Jump to latest`}
        onPress={() => {
          keepAtBottom.current = true;
          setNewMessageCount(0);
          threadRef.current?.scrollToEnd({ animated: true });
        }}
        style={styles.newMessagesButton}
      ><AppIcon name="arrow-down" size={16} color={theme.colors.primaryText} /><Text style={styles.newMessagesText}>New messages · {newMessageCount}</Text></Pressable> : null}
      {attachmentError || uploadError ? <Text accessibilityRole="alert" style={styles.attachmentError}>{attachmentError || uploadError}</Text> : null}
      {!application && !blocked && conversationStatus === "Pending" ? (
        <View style={styles.pendingNotice}>
          <View style={styles.pendingCopy}>
            <Text style={styles.pendingTitle}>{role === "Brand" ? "Review this application" : "Waiting for brand review"}</Text>
            <Text style={styles.pendingText}>{role === "Brand" ? "Accept the public profile and brief details to unlock collaboration chat." : "Your application has been sent. Chat will unlock after the brand accepts."}</Text>
          </View>
          {role === "Brand" && onAcceptApplication ? <AppButton label="Accept" compact icon="checkmark" loading={applicationActionPending} onPress={() => { setApplicationActionPending(true); void Promise.resolve(onAcceptApplication()).finally(() => setApplicationActionPending(false)); }} /> : null}
        </View>
      ) : null}
      {blocked ? (
        <View style={styles.blockedNotice}>
          <AppIcon name="ban-outline" size={18} color={theme.colors.danger} />
          <Text style={styles.blockedNoticeText}>
            Messaging is blocked for this profile. Unblock them from their profile to send a message.
          </Text>
        </View>
      ) : null}
      {!blocked && (replyingTo || editingMessageId) ? (
        <View style={styles.composerContext}>
          <AppIcon
            name={editingMessageId ? "create-outline" : "return-down-forward-outline"}
            size={17}
            color={theme.colors.primary}
          />
          <View style={styles.composerContextCopy}>
            <Text style={styles.composerContextTitle}>
              {editingMessageId ? "Editing message" : `Replying to ${replyingTo?.mine ? "your message" : name}`}
            </Text>
            {!editingMessageId && replyingTo ? (
              <Text numberOfLines={1} style={styles.composerContextText}>
                {messagePreviewText(replyingTo)}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editingMessageId ? "Cancel editing" : "Cancel reply"}
            onPress={() => {
              setReplyingTo(null);
              setEditingMessageId(null);
              setDraft("");
            }}
            style={styles.contextClose}
          >
            <AppIcon name="close" size={18} color={theme.colors.textSecondary} />
          </Pressable>
        </View>
      ) : null}
      {!blocked && attachments.length ? (
        <ScrollView
          horizontal
          contentContainerStyle={[
            styles.attachments,
            { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) },
          ]}
        >
          {attachments.map((item) => (
            <ComposerAttachmentPreview key={item.id} attachment={item} onRemove={() => setAttachmentToRemove(item)} />
          ))}
        </ScrollView>
      ) : null}
      {canMessage ? <View
        style={[
          styles.composer,
          { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) },
        ]}
      >
        <Pressable accessibilityRole="button" accessibilityLabel="Insert emoji" onPress={() => setEmojiPickerOpen(true)} style={styles.iconButton}>
          <AppIcon name="happy-outline" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={adminChat ? "Open feedback and report options" : "Open chat actions"}
          accessibilityHint={adminChat ? "Send feedback or report a bug to Brandly" : "Choose a task, campaign, photo, video or file"}
          onPress={() => setComposerActionsOpen(true)}
          style={styles.iconButton}
        >
          <AppIcon name="ellipsis-horizontal" />
        </Pressable>
        <TextInput
          ref={composerInputRef}
          value={draft}
          editable={!isSending}
          onChangeText={(value) => {
            setDraft(value);
            notifyTyping(Boolean(value.trim()));
          }}
          onBlur={() => notifyTyping(false)}
          placeholder={
            editingMessageId
              ? "Edit your message"
              : replyingTo
                ? "Write a reply"
                : role === "Influencer"
                  ? "Reply to the brand"
                  : "Write a message"
          }
          placeholderTextColor={theme.colors.inputPlaceholder}
          style={styles.input}
          multiline
          textAlignVertical="center"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend, busy: isSending }}
          disabled={!canSend}
          onPress={send}
          style={[styles.send, !canSend && styles.sendDisabled]}
        >
          {isSending ? <ActivityIndicator size="small" color={theme.colors.primaryText} /> : <AppIcon name="send" color={theme.colors.primaryText} />}
        </Pressable>
      </View> : <View style={[styles.composerLocked, { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) }]}><AppIcon name={blocked ? "ban-outline" : "lock-closed-outline"} size={17} color={theme.colors.textSecondary} /><Text style={styles.composerLockedText}>{blocked ? "Messaging is blocked for this conversation." : conversationStatus === "Pending" ? "Messaging starts after the campaign request is accepted." : "Messaging is unavailable for this request."}</Text></View>}
      <Modal
        transparent
        visible={composerActionsOpen}
        animationType="slide"
        onRequestClose={() => setComposerActionsOpen(false)}
      >
        <View style={styles.briefPickerOverlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close chat actions" onPress={() => setComposerActionsOpen(false)} style={styles.briefPickerBackdrop} />
          <View style={[styles.actionPicker, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]} accessibilityViewIsModal>
            <View style={styles.messageActionHeader}>
              <View style={styles.flex}>
                <Text style={styles.messageActionTitle}>{adminChat ? "Contact Brandly" : "Chat actions"}</Text>
                <Text style={styles.applicationMeta}>{adminChat ? "Your message is visible to the support team." : "Share something in this collaboration."}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close chat actions" onPress={() => setComposerActionsOpen(false)} style={styles.contextClose}><AppIcon name="close" color={theme.colors.textSecondary} /></Pressable>
            </View>
            <View style={styles.messageActionList}>
              {adminChat ? <>
                <MessageAction icon="chatbox-ellipses-outline" label="Send feedback" onPress={() => { setComposerActionsOpen(false); setSupportReportType("Feedback"); setSupportReportError(""); }} />
                <MessageAction icon="bug-outline" label="Report a bug" onPress={() => { setComposerActionsOpen(false); setSupportReportType("Bug report"); setSupportReportError(""); }} />
              </> : null}
              {!adminChat && onSendTask && tasks.some((task) => task.kind !== "video-brief") ? <MessageAction icon="checkbox-outline" label="Send task" onPress={() => { setComposerActionsOpen(false); setTaskPickerError(""); setTaskPickerOpen(true); }} /> : null}
              {!adminChat && onSendCampaign && (onRequestCampaigns || campaigns.length || campaignsLoading) ? <MessageAction icon={role === "Brand" ? "paper-plane-outline" : "briefcase-outline"} label={role === "Brand" ? "Send campaign" : "Apply to campaign"} onPress={() => { setComposerActionsOpen(false); onRequestCampaigns?.(); setCampaignPickerOpen(true); }} /> : null}
              <MessageAction icon="images-outline" label="Media & files" onPress={() => { setComposerActionsOpen(false); setMediaPickerOpen(true); }} />
            </View>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={Boolean(supportReportType)} animationType="slide" onRequestClose={() => setSupportReportType(null)}>
        <View style={styles.briefPickerOverlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close feedback form" onPress={() => setSupportReportType(null)} style={styles.briefPickerBackdrop} />
          <View style={[styles.actionPicker, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]} accessibilityViewIsModal>
            <View style={styles.messageActionHeader}>
              <View style={styles.flex}><Text style={styles.messageActionTitle}>{supportReportType}</Text><Text style={styles.applicationMeta}>Only you and the Brandly admin team can see this.</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close feedback form" onPress={() => setSupportReportType(null)} style={styles.contextClose}><AppIcon name="close" color={theme.colors.textSecondary} /></Pressable>
            </View>
            <TextInput accessibilityLabel={supportReportType ?? "Feedback"} value={supportReportText} onChangeText={(value) => { setSupportReportText(value); setSupportReportError(""); }} placeholder={supportReportType === "Bug report" ? "What happened? Include the steps if you can." : "What would you like us to know?"} placeholderTextColor={theme.colors.inputPlaceholder} multiline maxLength={4500} textAlignVertical="top" style={styles.supportReportInput} />
            <View style={styles.messageActionList}>
              <MessageAction icon="images-outline" label="Attach photo or video" onPress={() => void addMedia()} />
              <MessageAction icon="document-attach-outline" label="Attach file" onPress={() => void addFile()} />
            </View>
            {attachments.length ? <ScrollView horizontal contentContainerStyle={styles.attachments}>{attachments.map((item) => <ComposerAttachmentPreview key={item.id} attachment={item} onRemove={() => removeAttachment(item.id)} />)}</ScrollView> : null}
            {uploadError ? <Text accessibilityRole="alert" style={styles.attachmentError}>{uploadError}</Text> : null}
            {supportReportError ? <Text accessibilityRole="alert" style={styles.attachmentError}>{supportReportError}</Text> : null}
            <AppButton label={supportReportSending ? "Sending…" : "Send to Brandly"} icon="paper-plane-outline" loading={supportReportSending} disabled={supportReportSending || (!supportReportText.trim() && !attachments.length) || isSelectingOrUploading} onPress={() => void submitSupportReport()} />
          </View>
        </View>
      </Modal>
      <Modal
        transparent
        visible={mediaPickerOpen}
        animationType="slide"
        onRequestClose={() => setMediaPickerOpen(false)}
      >
        <View style={styles.briefPickerOverlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close media picker" onPress={() => setMediaPickerOpen(false)} style={styles.briefPickerBackdrop} />
          <View style={[styles.actionPicker, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]} accessibilityViewIsModal>
            <View style={styles.messageActionHeader}>
              <View style={styles.flex}>
                <Text style={styles.messageActionTitle}>Add to message</Text>
                <Text style={styles.applicationMeta}>Choose photos, videos or a document.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close media picker" onPress={() => setMediaPickerOpen(false)} style={styles.contextClose}><AppIcon name="close" color={theme.colors.textSecondary} /></Pressable>
            </View>
            <View style={styles.messageActionList}>
              <MessageAction icon="images-outline" label="Photos & videos" onPress={() => { setMediaPickerOpen(false); void addMedia(); }} />
              <MessageAction icon="sparkles-outline" label="GIF" onPress={() => { setMediaPickerOpen(false); void addGif(); }} />
              <MessageAction icon="document-attach-outline" label="File" onPress={() => { setMediaPickerOpen(false); void addFile(); }} />
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        transparent
        visible={taskPickerOpen}
        animationType="slide"
        onRequestClose={() => setTaskPickerOpen(false)}
      >
        <View style={styles.briefPickerOverlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close task picker" onPress={() => setTaskPickerOpen(false)} style={styles.briefPickerBackdrop} />
          <View style={[styles.briefPicker, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
            <View style={styles.messageActionHeader}>
              <View style={styles.flex}>
                <Text style={styles.messageActionTitle}>Send task</Text>
                <Text style={styles.applicationMeta}>Choose an open task for this active collaboration.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close task picker" onPress={() => setTaskPickerOpen(false)} style={styles.contextClose}><AppIcon name="close" color={theme.colors.textSecondary} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.briefPickerList} showsVerticalScrollIndicator={false}>
              {tasks.filter((task) => task.kind !== "video-brief").map((task) => {
                const alreadySent = sentTaskIds.includes(task.id);
                const sending = sendingTaskId === task.id;
                return <Pressable key={task.id} accessibilityRole="button" accessibilityLabel={`${alreadySent ? "Task already sent" : "Send task"} ${task.title}`} disabled={alreadySent || Boolean(sendingTaskId)} onPress={async () => {
                  setSendingTaskId(task.id);
                  try {
                    const sent = await onSendTask?.(task);
                    if (sent !== false) setTaskPickerOpen(false);
                    else setTaskPickerError("This task could not be shared with this participant.");
                  } catch (error) {
                    setTaskPickerError(error instanceof Error ? error.message : "Task could not be sent. Try again.");
                  } finally {
                    setSendingTaskId(null);
                  }
                }} style={({ pressed }) => [styles.briefPickerItem, (alreadySent || sending) && styles.pickerItemDisabled, pressed && styles.pressed]}><View style={styles.videoBriefIcon}><AppIcon name="checkbox-outline" size={18} color={alreadySent || sending ? theme.colors.textSecondary : theme.colors.primary} /></View><View style={styles.flex}><Text style={[styles.videoBriefTitle, alreadySent && styles.pickerTextDisabled]}>{task.title}</Text><Text style={styles.videoBriefMeta}>{alreadySent ? "Already sent in this conversation" : sending ? "Sending task…" : `${task.dueDate} · ${task.dueTime}`}</Text></View>{sending ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <AppIcon name={alreadySent ? "checkmark-circle-outline" : "paper-plane-outline"} color={alreadySent ? theme.colors.textSecondary : theme.colors.primary} />}</Pressable>;
              })}
              {!tasks.some((task) => task.kind !== "video-brief") ? <Text style={styles.applicationMeta}>No open tasks are ready to send.</Text> : null}
              {taskPickerError ? <Text accessibilityRole="alert" style={styles.attachmentError}>{taskPickerError}</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <CampaignSelectionSheet
        visible={campaignPickerOpen}
        campaigns={campaigns}
        loading={campaignsLoading}
        disabledCampaignIds={sentCampaignIds}
        actionLabel={role === "Brand" ? "Send" : "Apply to"}
        subtitle={role === "Brand" ? `Invite ${name} to one of your campaigns.` : `Apply to ${name}'s published campaign.`}
        onClose={() => setCampaignPickerOpen(false)}
        onSelect={(campaign) => onSendCampaign?.(campaign)}
        emptyMessage="No published campaigns are available for this conversation."
      />
      <ChatMediaGallery
        attachments={selectedMedia?.attachments ?? []}
        initialIndex={selectedMedia?.index ?? 0}
        visible={Boolean(selectedMedia)}
        onClose={() => setSelectedMedia(null)}
        onOpenFile={openAttachment}
      />
      <Modal transparent visible={rejectOpen} animationType="fade" onRequestClose={() => setRejectOpen(false)}>
        <View style={styles.rejectOverlay}><Pressable accessibilityRole="button" accessibilityLabel="Close rejection form" onPress={() => setRejectOpen(false)} style={styles.rejectBackdrop} /><AppCard style={styles.rejectCard}>
          <Text style={styles.applicationTitle}>Reject application</Text>
          <Text style={styles.applicationMeta}>The creator will see your reason in this chat.</Text>
          <TextInput accessibilityLabel="Reason for rejection" value={rejectReason} onChangeText={(value) => { setRejectReason(value); setRejectError(""); }} placeholder="Explain what did not fit this brief" placeholderTextColor={theme.colors.inputPlaceholder} multiline textAlignVertical="top" style={styles.rejectInput} />
          {!isBrandInvitation ? <Pressable accessibilityRole="checkbox" accessibilityLabel="Allow creator to apply again" accessibilityState={{ checked: allowReapply }} onPress={() => setAllowReapply((current) => !current)} style={styles.rejectChoice}><AppIcon name={allowReapply ? "checkbox" : "square-outline"} size={22} color={theme.colors.primary} /><Text style={styles.applicationBody}>Allow this creator to apply again</Text></Pressable> : <Text style={styles.applicationMeta}>This invitation will be closed for this campaign.</Text>}
          {rejectError ? <Text accessibilityRole="alert" style={styles.rejectError}>{rejectError}</Text> : null}
          <View style={styles.applicationActions}><AppButton label="Cancel" variant="secondary" disabled={applicationActionPending} onPress={() => setRejectOpen(false)} style={styles.flex} /><AppButton label="Confirm rejection" loading={applicationActionPending} onPress={() => { const reason = rejectReason.trim(); if (reason.length < 3) { setRejectError("Add a clear reason before rejecting."); return; } setApplicationActionPending(true); void Promise.resolve(onRejectApplication?.(reason, isBrandInvitation ? false : allowReapply)).finally(() => setApplicationActionPending(false)); setRejectOpen(false); setRejectReason(""); setAllowReapply(false); }} style={styles.flex} /></View>
        </AppCard></View>
      </Modal>
      <Modal
        transparent
        visible={Boolean(selectedMessage && !selectedMessage.deleted && messageActionMode)}
        animationType="fade"
        onRequestClose={closeMessageActions}
      >
        <View style={styles.messageActionOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close message actions"
            onPress={closeMessageActions}
            style={styles.messageActionBackdrop}
          />
          <View style={[styles.messageActionSheet, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
            <View style={styles.messageActionHeader}>
              {messageActionMode === "reactions" ? <View style={styles.flex} /> : <View style={styles.flex}>
                <Text style={styles.messageActionTitle}>Message actions</Text>
                <Text numberOfLines={1} style={styles.messageActionPreview}>{selectedMessage?.text}</Text>
              </View>}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close message actions"
                onPress={closeMessageActions}
                style={styles.contextClose}
              >
                <AppIcon name="close" color={theme.colors.textSecondary} />
              </Pressable>
            </View>
            {messageActionMode === "reactions" ? (
              <View style={styles.reactionOptions}>
                {REACTION_OPTIONS.map((reaction) => (
                  <Pressable
                    key={reaction.key}
                    accessibilityRole="button"
                    accessibilityLabel={reaction.label}
                    accessibilityHint="Add or remove this reaction"
                    accessibilityState={{ selected: reactions[selectedMessage?.id ?? ""] === reaction.key }}
                    onPress={() => chooseReaction(reaction.key)}
                    style={({ pressed }) => [
                      styles.reactionOption,
                      reactions[selectedMessage?.id ?? ""] === reaction.key && { backgroundColor: reaction.background, borderColor: reaction.color },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.reactionOptionEmoji}>{reaction.emoji}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.messageActionList}>
                <MessageAction
                  icon="return-down-forward-outline"
                  label="Reply"
                  onPress={startReply}
                />
                {onForwardMessages && forwardTargets.length && selectedMessage && canForwardMessage(selectedMessage) ? <>
                  <MessageAction icon="checkbox-outline" label="Select messages" onPress={() => { if (!selectedMessage) return; if (!selectedMessageIds.includes(selectedMessage.id) && selectedMessageIds.length >= 5) { setAttachmentError("Select up to 5 messages at a time."); closeMessageActions(); return; } setSelectedMessageIds((current) => current.includes(selectedMessage.id) ? current : [...current, selectedMessage.id]); closeMessageActions(); }} />
                  <MessageAction icon="arrow-redo-outline" label="Forward" onPress={() => selectMessageAndForward(selectedMessage)} />
                </> : null}
                <MessageAction
                  icon="heart-outline"
                  label="Add reaction"
                  onPress={() => setMessageActionMode("reactions")}
                />
                {pinStorageKey && selectedMessage ? <MessageAction icon={pinnedMessage?.id === selectedMessage.id ? "pin" : "pin-outline"} label={pinnedMessage?.id === selectedMessage.id ? "Unpin message" : "Pin message"} onPress={() => togglePinnedMessage(selectedMessage)} /> : null}
                {!adminChat && selectedMessage?.mine && onUpdateMessage ? (
                  <MessageAction
                    icon="create-outline"
                    label="Edit message"
                    onPress={startEdit}
                  />
                ) : null}
                {!adminChat && selectedMessage?.mine && onDeleteMessage ? (
                  <MessageAction
                    icon="trash-outline"
                    label="Delete message"
                    destructive
                    onPress={() => {
                      setMessageToDelete(selectedMessage);
                      closeMessageActions();
                    }}
                  />
                ) : null}
              </View>
            )}
          </View>
        </View>
      </Modal>
      <ConfirmModal
        visible={Boolean(messageToDelete)}
        title="Delete this message?"
        message="This message will be removed from this conversation."
        confirmLabel="Delete"
        confirmIcon="trash-outline"
        confirmLoading={isSending}
        destructive
        onCancel={() => setMessageToDelete(null)}
        onConfirm={confirmDeleteMessage}
      />
      <ConfirmModal
        visible={bulkDeleteOpen}
        title={`Delete ${selectedMessages.length} messages?`}
        message="Only your selected messages will be removed. Messages that fail to delete will stay selected."
        confirmLabel={isSending ? "Deleting…" : "Delete"}
        confirmIcon="trash-outline"
        confirmLoading={isSending}
        destructive
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={confirmDeleteSelectedMessages}
      />
      <Modal transparent visible={emojiPickerOpen} animationType="fade" onRequestClose={() => setEmojiPickerOpen(false)}>
        <View style={styles.messageActionOverlay}><Pressable accessibilityRole="button" accessibilityLabel="Close emoji picker" onPress={() => setEmojiPickerOpen(false)} style={styles.messageActionBackdrop} /><View style={styles.emojiPicker}>
          <View style={styles.messageActionHeader}><Text style={styles.messageActionTitle}>Emoji</Text><Pressable accessibilityRole="button" accessibilityLabel="Close emoji picker" onPress={() => setEmojiPickerOpen(false)} style={styles.contextClose}><AppIcon name="close" color={theme.colors.textSecondary} /></Pressable></View>
          <View style={styles.emojiGrid}>{["😀", "😂", "🥰", "😍", "😊", "😉", "👍", "👏", "🙏", "❤️", "🔥", "🎉", "✨", "💯", "🤝", "💡", "😮", "😢", "✅", "⭐"].map((emoji) => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Insert ${emoji}`} onPress={() => { setDraft((current) => `${current}${emoji}`); setEmojiPickerOpen(false); requestAnimationFrame(() => composerInputRef.current?.focus()); }} style={styles.emojiOption}><Text style={styles.emojiOptionText}>{emoji}</Text></Pressable>)}</View>
        </View></View>
      </Modal>
      <Modal transparent visible={forwardPickerOpen} animationType="slide" onRequestClose={() => !forwarding && setForwardPickerOpen(false)}>
        <View style={styles.briefPickerOverlay}><Pressable accessibilityRole="button" accessibilityLabel="Close forward picker" onPress={() => !forwarding && setForwardPickerOpen(false)} style={styles.briefPickerBackdrop} /><View style={[styles.actionPicker, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
          <View style={styles.messageActionHeader}><View style={styles.flex}><Text style={styles.messageActionTitle}>Forward {selectedMessages.length} message{selectedMessages.length === 1 ? "" : "s"}</Text><Text style={styles.applicationMeta}>Choose an active conversation.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close forward picker" disabled={forwarding} onPress={() => setForwardPickerOpen(false)} style={styles.contextClose}><AppIcon name="close" color={theme.colors.textSecondary} /></Pressable></View>
          <ScrollView style={styles.forwardTargetsList} contentContainerStyle={styles.briefPickerList}>{forwardTargets.map((target) => <Pressable key={target.id} accessibilityRole="button" accessibilityLabel={`Forward to ${target.name}`} disabled={forwarding} onPress={() => void forwardSelectedMessages(target.id)} style={[styles.briefPickerItem, forwarding && styles.pickerItemDisabled]}><View style={styles.videoBriefIcon}><AppIcon name="chatbubble-ellipses-outline" color={theme.colors.primary} /></View><View style={styles.flex}><Text style={styles.videoBriefTitle}>{target.name}</Text><Text numberOfLines={1} style={styles.videoBriefMeta}>{target.preview || "Conversation"}</Text></View>{forwarding ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <AppIcon name="arrow-redo-outline" color={theme.colors.primary} />}</Pressable>)}</ScrollView>
          {!forwardTargets.length ? <Text style={styles.applicationMeta}>No other active conversations are available.</Text> : null}
        </View></View>
      </Modal>
      <ConfirmModal
        visible={blockConfirmOpen}
        title={`Block ${name}?`}
        message="You will stop receiving messages from this collaboration."
        confirmLabel="Block"
        confirmIcon="ban-outline"
        destructive
        onCancel={() => setBlockConfirmOpen(false)}
        onConfirm={() => { setBlockConfirmOpen(false); onToggleBlock?.(); }}
      />
      <ConfirmModal
        visible={attachmentToRemove !== null}
        title="Remove this attachment?"
        message="This file will be removed from the message composer before sending."
        confirmLabel="Remove"
        confirmIcon="trash-outline"
        destructive
        onCancel={() => setAttachmentToRemove(null)}
        onConfirm={confirmRemoveAttachment}
      />
    </KeyboardAvoidingView>
    </Animated.View>
  );
}

function VideoAttachmentPreview({ uri, style }: { uri: string; style: object }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });
  return <VideoView player={player} nativeControls contentFit="contain" style={style} />;
}

function ComposerAttachmentPreview({ attachment, onRemove }: { attachment: MediaAttachment; onRemove: () => void }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const status = attachment.uploadState;
  return (
    <View style={styles.composerAttachmentCard}>
      {attachment.type === "image" ? (
        <ExpoImage source={attachment.uri} contentFit="cover" cachePolicy="memory-disk" style={styles.composerAttachmentImage} accessibilityLabel={`${attachment.name} preview`} />
      ) : (
        <View style={styles.composerAttachmentIcon}>
          <AppIcon name={attachment.type === "video" ? "videocam-outline" : "document-text-outline"} size={24} color={theme.colors.primary} />
        </View>
      )}
      <View style={styles.composerAttachmentInfo}>
        <Text numberOfLines={1} style={styles.attachmentName}>{attachment.name}</Text>
        <View style={styles.composerAttachmentStatus}>
          {status === "uploading" ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <AppIcon name={status === "failed" ? "alert-circle-outline" : status === "uploaded" ? "checkmark-circle" : "cloud-upload-outline"} size={15} color={status === "failed" ? theme.colors.danger : status === "uploaded" ? theme.colors.success : theme.colors.textSecondary} />}
          <Text style={styles.composerAttachmentStatusText}>{status === "uploaded" ? "Ready" : status === "failed" ? "Failed" : status === "uploading" ? "Uploading" : "Preparing"}</Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${attachment.name} from attachments`} onPress={onRemove} style={styles.composerAttachmentRemove} hitSlop={6}>
        <AppIcon name="close-circle" color={theme.colors.danger} />
      </Pressable>
    </View>
  );
}

function ChatAttachmentGrid({
  attachments,
  mine = false,
  onOpen,
}: {
  attachments: ChatAttachment[];
  mine?: boolean;
  onOpen: (index: number) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const visibleAttachments = attachments.slice(0, 4);
  return (
    <View style={styles.messageMediaGrid}>
      {visibleAttachments.map((attachment, index) => {
        const isImage = attachment.type === "image" && Boolean(attachment.uri);
        return (
          <Pressable
            key={attachment.id}
            accessibilityRole="button"
            accessibilityLabel={`Open shared ${attachment.type} ${attachment.name}`}
            onPress={() => onOpen(index)}
            style={[
              styles.messageMediaTile,
              attachments.length === 1 && styles.messageMediaTileSingle,
              mine && styles.messageMediaTileMine,
            ]}
          >
            {isImage ? (
              <ExpoImage
                accessibilityLabel={`Shared image ${attachment.name}`}
                source={attachment.uri}
                cachePolicy="memory-disk"
                contentFit="cover"
                transition={120}
                style={styles.messageMediaTileImage}
              />
            ) : (
              <View style={styles.messageMediaTileCopy}>
                <AppIcon
                  name={attachment.type === "video" ? "play-circle-outline" : "document-text-outline"}
                  size={28}
                  color={mine ? theme.colors.primaryText : theme.colors.primary}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.messageMediaTileLabel, mine && styles.bubbleMineText]}
                >
                  {attachment.name}
                </Text>
              </View>
            )}
            {attachments.length > 4 && index === 3 ? (
              <View style={styles.mediaCountOverlay}>
                <Text style={styles.mediaCountText}>+{attachments.length - 4}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function ChatMediaSlide({
  attachment,
  onOpenFile,
}: {
  attachment: ChatAttachment;
  onOpenFile: (uri?: string) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  if (!attachment.uri) {
    return (
      <View style={styles.mediaGalleryFile}>
        <AppIcon name="document-text-outline" size={34} color={theme.colors.primary} />
        <Text style={styles.mediaGalleryFileTitle}>File unavailable</Text>
      </View>
    );
  }
  if (attachment.type === "image") {
    return (
      <ExpoImage
        accessibilityLabel={`${attachment.name} preview`}
        source={attachment.uri}
        cachePolicy="memory-disk"
        contentFit="contain"
        style={styles.mediaGalleryMedia}
      />
    );
  }
  if (attachment.type === "video") {
    return <VideoAttachmentPreview uri={attachment.uri} style={styles.mediaGalleryMedia} />;
  }
  return (
    <View style={styles.mediaGalleryDocumentWrap}>
      <WebView
        source={{ uri: attachment.uri }}
        style={styles.mediaGalleryDocument}
        originWhitelist={["*"]}
        startInLoadingState
        renderError={() => (
          <View style={styles.mediaGalleryFile}>
            <AppIcon name="document-text-outline" size={34} color={theme.colors.primary} />
            <Text style={styles.mediaGalleryFileTitle}>File preview unavailable</Text>
            <Text style={styles.mediaGalleryFileMeta} numberOfLines={2}>{attachment.name}</Text>
          </View>
        )}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${attachment.name}`}
        onPress={() => onOpenFile(attachment.uri)}
        style={styles.mediaGalleryOpenFile}
      >
        <AppIcon name="open-outline" size={17} color={theme.colors.primaryText} />
        <Text style={styles.mediaGalleryOpenFileText}>Open file</Text>
      </Pressable>
    </View>
  );
}

function ChatMediaGallery({
  attachments,
  initialIndex,
  visible,
  onClose,
  onOpenFile,
}: {
  attachments: ChatAttachment[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
  onOpenFile: (uri?: string) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const stageWidth = Math.max(width - theme.spacing.lg * 2, 1);

  useEffect(() => {
    if (!visible) return;
    const nextIndex = Math.min(Math.max(initialIndex, 0), Math.max(attachments.length - 1, 0));
    setActiveIndex(nextIndex);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: nextIndex * stageWidth, animated: false }));
  }, [attachments.length, initialIndex, stageWidth, visible]);

  const moveTo = (index: number) => {
    const nextIndex = Math.min(Math.max(index, 0), attachments.length - 1);
    setActiveIndex(nextIndex);
    scrollRef.current?.scrollTo({ x: nextIndex * stageWidth, animated: true });
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.mediaGalleryOverlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close media gallery"
          onPress={onClose}
          style={styles.mediaGalleryBackdrop}
        />
        <View
          style={[
            styles.mediaGallery,
            { paddingTop: Math.max(insets.top, theme.spacing.md), paddingBottom: Math.max(insets.bottom, theme.spacing.md) },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.mediaGalleryHeader}>
            <View style={styles.flex}>
              <Text numberOfLines={1} style={styles.mediaGalleryTitle}>
                {attachments[activeIndex]?.name ?? "Shared media"}
              </Text>
              <Text style={styles.mediaGallerySubtitle}>
                {attachments.length ? `${activeIndex + 1} of ${attachments.length}` : "Shared media"}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close media gallery" onPress={onClose} style={styles.mediaGalleryClose}>
              <AppIcon name="close" size={22} color={theme.colors.primaryText} />
            </Pressable>
          </View>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: initialIndex * stageWidth, y: 0 }}
            onMomentumScrollEnd={(event) => setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / stageWidth))}
            style={styles.mediaGalleryStage}
          >
            {attachments.map((attachment) => (
              <View key={attachment.id} style={[styles.mediaGallerySlide, { width: stageWidth }]}>
                <ChatMediaSlide attachment={attachment} onOpenFile={onOpenFile} />
              </View>
            ))}
          </ScrollView>
          <View style={styles.mediaGalleryNav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous attachment"
              disabled={activeIndex === 0}
              onPress={() => moveTo(activeIndex - 1)}
              style={[styles.mediaGalleryNavButton, activeIndex === 0 && styles.disabledButton]}
            >
              <AppIcon name="chevron-back" color={theme.colors.primaryText} />
            </Pressable>
            <Text style={styles.mediaGalleryCounter}>{activeIndex + 1} / {Math.max(attachments.length, 1)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next attachment"
              disabled={activeIndex >= attachments.length - 1}
              onPress={() => moveTo(activeIndex + 1)}
              style={[styles.mediaGalleryNavButton, activeIndex >= attachments.length - 1 && styles.disabledButton]}
            >
              <AppIcon name="chevron-forward" color={theme.colors.primaryText} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MessageAction({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: ChatIconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.messageAction, pressed && styles.pressed]}
    >
      <AppIcon
        name={icon}
        size={20}
        color={destructive ? theme.colors.danger : theme.colors.primary}
      />
      <Text
        style={[
          styles.messageActionLabel,
          destructive && styles.messageActionDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (theme: AppTheme) =>
  createThemeStyles(theme, {
    page: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    avatarWrap: { position: "relative" },
    onlineDot: {
      position: "absolute",
      right: -1,
      bottom: -1,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.colors.success,
      borderWidth: 2,
      borderColor: theme.colors.surface,
    },
    headerInfo: { flex: 1 },
    name: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      fontWeight: "800",
      fontFamily: theme.type.bodyFont,
    },
    status: {
      color: theme.colors.success,
      fontSize: theme.type.caption,
      marginTop: 2,
    },
    statusOffline: { color: theme.colors.textSecondary },
    typingIndicator: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
    },
    typingDots: { flexDirection: "row", alignItems: "center", gap: 3 },
    typingDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.primary },
    typingText: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont },
    applicationCard: { gap: theme.spacing.md, marginBottom: theme.spacing.md, backgroundColor: theme.colors.surfaceSky },
    applicationRow: { width: "100%" },
    dayDivider: { alignSelf: "center", marginVertical: theme.spacing.xs, paddingHorizontal: theme.spacing.md, paddingVertical: 4, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceMuted },
    dayDividerText: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontWeight: "700", fontFamily: theme.type.bodyFont },
    applicationHeader: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
    applicationEyebrow: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
    applicationTitle: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.displayFont },
    applicationMeta: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont },
    applicationStatus: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
    applicationPerson: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
    applicationName: { color: theme.colors.textPrimary, fontSize: theme.type.body, fontWeight: "800", fontFamily: theme.type.bodyFont },
    applicationBody: { color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont },
    applicationAttachments: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
    applicationAttachment: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, maxWidth: "100%", minHeight: 44, padding: theme.spacing.xs, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceMuted },
    applicationThumb: { width: 48, height: 48, borderRadius: theme.radius.sm },
    applicationActions: { flexDirection: "row", gap: theme.spacing.sm },
    declineInfo: { gap: theme.spacing.xs, padding: theme.spacing.md, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceMuted },
    rejectOverlay: { flex: 1, justifyContent: "center", padding: theme.spacing.lg, backgroundColor: theme.colors.overlay },
    rejectBackdrop: { ...StyleSheet.absoluteFill },
    rejectCard: { gap: theme.spacing.md },
    rejectInput: { minHeight: 108, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.inputBackground, color: theme.colors.textPrimary, fontSize: theme.type.body, fontFamily: theme.type.bodyFont },
    supportReportInput: { minHeight: 132, maxHeight: 220, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.inputBackground, color: theme.colors.textPrimary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont },
    supportReportMessage: { gap: theme.spacing.xs, padding: theme.spacing.sm, marginBottom: theme.spacing.xs, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
    supportReportMessageHeading: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
    supportReportMessageTitle: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
    rejectChoice: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
    rejectError: { color: theme.colors.danger, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont },
    pendingNotice: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.accent,
      borderTopWidth: 1,
      borderTopColor: theme.colors.cardBorder,
    },
    pendingCopy: { flex: 1, minWidth: 0, gap: 2 },
    pendingTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "800",
      fontFamily: theme.type.bodyFont,
    },
    pendingText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: theme.type.lineHeight.caption,
      fontFamily: theme.type.bodyFont,
    },
    blockedNotice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceMuted,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    blockedNoticeText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: 18,
    },
    encryptionNote: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
    },
    encryptionText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      textAlign: "center",
    },
    iconButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
    },
    thread: {
      width: "100%",
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.xl,
      backgroundColor: theme.colors.background,
    },
    selectionToolbar: { width: "100%", flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, backgroundColor: theme.colors.surfaceRaised, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    selectionCount: { flex: 1, color: theme.colors.textPrimary, fontSize: theme.type.caption, fontWeight: "800" },
    selectionIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.pill },
    selectionAction: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.xs, paddingHorizontal: theme.spacing.sm, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted },
    selectionActionText: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "800" },
    selectionDisabled: { opacity: 0.45 },
    pinnedMessageBanner: { minHeight: 52, width: "100%", flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised },
    pinnedMessageLabel: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "800" },
    pinnedMessageText: { color: theme.colors.textPrimary, fontSize: theme.type.caption },
    newMessagesButton: {
      position: "absolute",
      zIndex: 2,
      alignSelf: "center",
      bottom: 88,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primary,
      elevation: 3,
    },
    newMessagesText: { color: theme.colors.primaryText, fontSize: theme.type.caption, fontWeight: "800" },
    bubble: {
      maxWidth: "100%",
      width: "auto",
      minWidth: 0,
      flexShrink: 1,
      borderRadius: 18,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    richBubble: { width: "100%", overflow: "hidden" },
    bubbleOther: {
      alignSelf: "flex-start",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderBottomLeftRadius: 6,
    },
    bubbleMine: {
      alignSelf: "flex-end",
      backgroundColor: theme.colors.primary,
      borderBottomRightRadius: 6,
    },
    selectedBubble: { borderWidth: 2, borderColor: theme.colors.focus },
    replyTargetHighlight: { borderWidth: 3, borderColor: theme.colors.focus },
    messageText: {
      maxWidth: "100%",
      flexShrink: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.type.bodyFont,
      lineHeight: theme.type.lineHeight.body,
    },
    messageRow: { width: "100%", alignItems: "stretch" },
    replySwipeCue: { position: "absolute", left: 2, top: "50%", width: 30, height: 30, marginTop: -15, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceRaised, zIndex: 1 },
    messageContent: { maxWidth: "92%", minWidth: 0, alignSelf: "flex-start" },
    selectedIndicator: { position: "absolute", right: -8, top: -8, zIndex: 2, borderRadius: theme.radius.pill, backgroundColor: theme.colors.background },
    messageContentMine: { alignSelf: "flex-end" },
    messageContentCampaign: { width: "88%", maxWidth: 340 },
    deletedMessage: { color: theme.colors.textSecondary, fontStyle: "italic" },
    bubbleMineText: { color: theme.colors.primaryText },
    time: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      alignSelf: "flex-end",
      marginTop: 4,
    },
    bubbleMineTime: { color: theme.colors.primaryText },
    flex: { flex: 1, minWidth: 0 },
    replyPreview: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.xs,
      width: "100%",
      minWidth: 0,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      marginBottom: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.primary,
      backgroundColor: theme.colors.surfaceMuted,
      overflow: "hidden",
    },
    replyPreviewMine: {
      borderLeftColor: theme.colors.primaryText,
      backgroundColor: theme.colors.primaryText + "20",
    },
    replyPreviewCopy: { flex: 1, minWidth: 0, gap: 2 },
    replyAuthor: {
      color: theme.colors.primary,
      fontSize: theme.type.caption,
      fontWeight: "800",
    },
    replyText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: 16,
      flexShrink: 1,
    },
    messageFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: theme.spacing.xs,
    },
    reactionBadge: {
      alignSelf: "flex-start",
      minWidth: 28,
      height: 24,
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: theme.spacing.xs,
      marginTop: -5,
      borderWidth: 2,
      borderColor: theme.colors.background,
    },
    reactionEmoji: { fontSize: 15, lineHeight: 18 },
    reactionOptionEmoji: { fontSize: 23, lineHeight: 28 },
    attachment: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      alignItems: "center",
      paddingBottom: theme.spacing.xs,
      marginBottom: theme.spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    messageMediaGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.xs,
      maxWidth: 244,
    },
    messageMediaTile: {
      width: 116,
      height: 104,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.control,
      backgroundColor: theme.colors.surfaceMuted,
    },
    messageMediaTileSingle: { width: 224, height: 178 },
    messageMediaTileMine: { backgroundColor: theme.colors.primaryText + "26" },
    messageMediaTileImage: { width: "100%", height: "100%" },
    messageMediaTileCopy: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      padding: theme.spacing.sm,
    },
    messageMediaTileLabel: {
      maxWidth: "90%",
      color: theme.colors.primary,
      fontSize: theme.type.caption,
      fontWeight: "800",
      textAlign: "center",
    },
    mediaCountOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.overlay,
    },
    mediaCountText: {
      color: theme.colors.primaryText,
      fontSize: theme.type.title,
      fontWeight: "900",
      fontFamily: theme.type.bodyFont,
    },
    videoBriefMessage: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      minWidth: 0,
      overflow: "hidden",
      gap: theme.spacing.xs,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    videoBriefMessageMine: {
      backgroundColor: theme.colors.primaryText + "20",
      borderWidth: 1,
      borderColor: theme.colors.primaryText + "38",
    },
    taskMessage: {
      flexDirection: "row",
      alignItems: "flex-start",
      width: "100%",
      minWidth: 0,
      alignSelf: "stretch",
      overflow: "hidden",
      gap: theme.spacing.xs,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceMuted,
    },
    taskMessageMine: {
      borderColor: theme.colors.primaryText + "38",
      backgroundColor: theme.colors.primaryText + "20",
    },
    taskMessageActions: { width: "100%", flexDirection: "column", alignItems: "stretch", gap: theme.spacing.xs, marginTop: theme.spacing.sm },
    taskMessageButton: { width: "100%", maxWidth: "100%", minWidth: 0, alignSelf: "stretch", flexShrink: 1 },
    videoBriefIcon: {
      width: 34,
      height: 34,
      borderRadius: theme.radius.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceRaised,
    },
    campaignRequestBanner: { width: "100%", height: 104, marginBottom: theme.spacing.sm, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceRaised },
    videoBriefEyebrow: { color: theme.colors.primary, fontSize: 10, fontWeight: "800" },
    videoBriefTitle: { color: theme.colors.textPrimary, fontSize: theme.type.body, lineHeight: 20, fontWeight: "800", maxWidth: "100%", flexShrink: 1, minWidth: 0 },
    videoBriefMeta: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: 17, maxWidth: "100%", flexShrink: 1, minWidth: 0 },
    briefPickerOverlay: { flex: 1, justifyContent: "flex-end" },
    briefPickerBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.overlay },
    briefPicker: { maxHeight: "72%", padding: theme.spacing.lg, gap: theme.spacing.md, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceRaised },
    actionPicker: { padding: theme.spacing.lg, gap: theme.spacing.md, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceRaised },
    forwardTargetsList: { maxHeight: 380 },
    briefPickerList: { gap: theme.spacing.sm, paddingBottom: theme.spacing.sm },
    briefPickerItem: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, padding: theme.spacing.sm, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
    pickerItemDisabled: { opacity: 0.58 },
    pickerTextDisabled: { color: theme.colors.textSecondary },
    attachmentError: {
      color: theme.colors.danger,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      fontSize: theme.type.caption,
      fontFamily: theme.type.bodyFont,
    },
    disabledButton: { opacity: 0.45 },
    mediaGalleryOverlay: { flex: 1, backgroundColor: theme.colors.overlay },
    mediaGalleryBackdrop: { ...StyleSheet.absoluteFill },
    mediaGallery: {
      flex: 1,
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    mediaGalleryHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    mediaGalleryTitle: {
      color: theme.colors.primaryText,
      fontSize: theme.type.bodyLarge,
      fontWeight: "900",
      fontFamily: theme.type.bodyFont,
    },
    mediaGallerySubtitle: {
      marginTop: 2,
      color: theme.colors.primaryText,
      opacity: 0.78,
      fontSize: theme.type.caption,
      fontFamily: theme.type.bodyFont,
    },
    mediaGalleryClose: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primary,
    },
    mediaGalleryStage: { flexGrow: 0, height: "72%" },
    mediaGallerySlide: {
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderRadius: theme.radius.control,
      backgroundColor: theme.colors.surfaceRaised,
    },
    mediaGalleryMedia: { width: "100%", height: "100%" },
    mediaGalleryDocumentWrap: { width: "100%", height: "100%" },
    mediaGalleryDocument: { flex: 1, backgroundColor: theme.colors.surface },
    mediaGalleryFile: {
      width: "100%",
      minHeight: 220,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.surface,
    },
    mediaGalleryFileTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      fontWeight: "900",
      textAlign: "center",
      fontFamily: theme.type.bodyFont,
    },
    mediaGalleryFileMeta: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      textAlign: "center",
    },
    mediaGalleryOpenFile: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.primary,
    },
    mediaGalleryOpenFileText: {
      color: theme.colors.primaryText,
      fontSize: theme.type.caption,
      fontWeight: "800",
      fontFamily: theme.type.bodyFont,
    },
    mediaGalleryNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    mediaGalleryNavButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primary,
    },
    mediaGalleryCounter: {
      color: theme.colors.primaryText,
      fontSize: theme.type.caption,
      fontWeight: "800",
      fontFamily: theme.type.bodyFont,
    },
    mediaViewer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.overlay,
    },
    mediaViewerImage: { width: "100%", height: "72%" },
    mediaViewerClose: {
      position: "absolute",
      top: theme.spacing.xl,
      right: theme.spacing.lg,
      width: 44,
      height: 44,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },
    attachmentText: {
      color: theme.colors.primary,
      flex: 1,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    attachments: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    attachmentChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    attachmentName: {
      maxWidth: 150,
      color: theme.colors.textPrimary,
      fontSize: theme.type.caption,
    },
    composerAttachmentCard: {
      width: 220,
      minHeight: 76,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.xs,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    composerAttachmentImage: { width: 64, height: 64, borderRadius: theme.radius.sm },
    composerAttachmentIcon: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceSky },
    composerAttachmentInfo: { flex: 1, minWidth: 0, gap: theme.spacing.xs },
    composerAttachmentStatus: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
    composerAttachmentStatusText: { color: theme.colors.textSecondary, fontSize: 11, fontFamily: theme.type.bodyFont },
    composerAttachmentRemove: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    composerContext: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    composerContextCopy: { flex: 1, minWidth: 0, gap: 2 },
    composerContextTitle: {
      color: theme.colors.primary,
      fontSize: theme.type.caption,
      fontWeight: "800",
    },
    composerContextText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    contextClose: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.pill,
    },
    composer: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    composerLocked: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    composerLockedText: {
      flexShrink: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: 17,
      textAlign: "center",
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 100,
      paddingHorizontal: theme.spacing.md,
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.type.bodyFont,
      lineHeight: theme.type.lineHeight.body,
      backgroundColor: theme.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.pill,
    },
    send: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },
    sendDisabled: { backgroundColor: theme.colors.disabled },
    messageActionOverlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "flex-end",
    },
    messageActionBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.colors.overlay,
    },
    messageActionSheet: {
      width: "100%",
      maxWidth: 520,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
    },
    messageActionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    messageActionTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      fontWeight: "900",
    },
    messageActionPreview: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      marginTop: 2,
    },
    messageActionList: { gap: theme.spacing.xs },
    messageAction: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.md,
    },
    messageActionLabel: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "700",
    },
    messageActionDanger: { color: theme.colors.danger },
    reactionOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: theme.spacing.sm,
    },
    reactionOption: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surfaceMuted,
    },
    emojiPicker: { width: "90%", maxWidth: 380, padding: theme.spacing.md, gap: theme.spacing.md, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceRaised },
    emojiGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: theme.spacing.xs },
    emojiOption: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted },
    emojiOptionText: { fontSize: 26 },
    pressed: { opacity: 0.78 },
  });
