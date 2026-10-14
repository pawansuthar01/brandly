import AsyncStorage from "@react-native-async-storage/async-storage";
import { mergeChatMessages } from "../../lib/chat";
import {
  ComponentProps,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Animated,
  AppState,
  BackHandler,
  FlatList,
  ImageStyle,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Platform,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import Constants from "expo-constants";
import { Image as ExpoImage } from "expo-image";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  AppButton,
  AppCard,
  AppIcon,
  Avatar,
  NATIVE_ANIMATIONS_ENABLED,
  BottomTabs,
  ConfirmModal,
  FilterChip,
  IconButton,
  MarketplaceCardSkeleton,
  OverflowMenu,
  Pill,
  ProfilePhotoPicker,
  RangeSlider,
  SearchField,
  SectionTitle,
  Toggle,
} from "../../components/ui";
import { useDemoMarketplace } from "../../hooks/useDemoMarketplace";
import { demoBrandBriefs, demoCampaigns, demoContentIdeas, demoInfluencers, demoProjects, demoProposals } from "../../services/demoMarketplace.service";
import { useMobileStoreHydrated } from "../../store/provider";
import { isAdminThemePreview, useTheme } from "../../providers/ThemeProvider";
import { THEME_SCREENS, themeScreenForRoute } from "../../lib/themeScreens";
import { isValidTheme } from "../../lib/themeValidation";
import { useToast } from "../../providers/ToastProvider";
import {
  Campaign,
  CampaignDraft,
  BrandBrief,
  ContentIdea,
  DemoAttachment,
  DealStatus,
  CreatorContentType,
  CreatorReview,
  AuthoredReview,
  CreatorWorkHistory,
  Influencer,
  MarketplaceApplication,
  MarketplaceConversation,
  MarketplaceMessage,
  MarketplaceConversationStatus,
  PublicCreatorProfile,
  SocialPlatform,
  TabName,
  DemoProposal,
  ProposalStatus,
  ProposalContext,
  ProposalDraft,
  ProfileDraft,
  Reminder,
  ReminderSettings,
  TodoTask,
  TodoTaskDraft,
  ProductionProject,
  ProductionStage,
  ProductionStagePayload,
} from "../../types/marketplace";
import { INDIA_STATES, IndiaState } from "../../lib/indiaLocations";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  FlowScreen,
  MarketplaceFlow,
  NotificationSettings,
  ReminderSettingsSheet,
  ReviewDraft,
} from "./FlowScreens";
import { ChatDetail } from "./ChatDetail";
import { CalendarView } from "./CalendarView";
import { BudgetView } from "./BudgetView";
import { StudioView } from "./StudioView";
import { MarketplaceView, MarketplaceChatRequest } from "./MarketplaceView";
import { TodoTaskDetail } from "./TodoTaskDetail";
import { HomeDashboard } from "./HomeDashboard";
import {
  cancelDeliveryReminder,
  cancelDailyStreakReminders,
  clearReminderAction,
  createReminderId,
  handleReminderNotificationAction,
  readReminderActions,
  setReminderOwner,
  syncReminderActions,
  clearObsoleteTaskReminderNotifications,
  cancelReminderSeries,
  configureReminderNotifications,
  DELIVERY_REMINDER_SNOOZE_ACTION,
  DELIVERY_REMINDER_STOP_ACTION,
  getNotificationsModule,
  hasReminderNotificationPermission,
  scheduleDeliveryReminder,
  scheduleTaskReminderSeries,
  syncDailyStreakReminder,
  taskToReminder,
  registerForRemotePushToken,
  setChatNotificationSuppressed,
  setMutedChatNotificationConversations,
  } from "../../services/reminders.service";
import { addMarketplaceMessage as addMarketplaceMessageAction, clearStudio, hydrateCampaignMarketplace, hydrateMarketplaceConversationMessages, hydrateMarketplaceConversations, hydrateStudio, markMarketplaceConversationRead, replaceStudioIdea, replaceStudioProject, setReminderOverride, clearSession, resetCampaignMarketplace, setOnboardingComplete, setProfile, setRole as setStoreRole, setSignupProfile, setSignupRole, setSignupStep, setUserIdentity, setVerification, setMarketplaceConversationBlocked, updateMarketplaceConversationPreferences, updateMarketplaceMessage as updateMarketplaceMessageAction, upsertMarketplaceApplication as upsertMarketplaceApplicationAction, type MobileRootState } from "../../store/store";
import { addRemoteStudioNote, addRemoteTaskNote, archiveRemoteCampaign, confirmRemoteCampaignCompletion, createRemoteCampaign, createRemoteCampaignApplication, createRemoteCampaignReview, createRemoteStudioIdea, createRemoteStudioProject, createRemoteTask, deleteRemoteTask, deleteRemoteChatMessage, getChatSocketUrl, getRemoteAdminChatConversation, getRemoteAdminChatMessages, heartbeatRemoteAdminChat, getRemoteCampaignMatches, getRemoteCampaigns, getRemoteChatConversations, getRemoteChatMessages, getRemoteNotifications, getRemoteProfileDirectory, getRemoteProfileInteractions, getRemotePublicProfile, getRemoteStudio, getRemoteTasks, inviteRemoteCampaignCreator, logout as logoutRemote, markChatOffline, markRemoteAdminChatRead, markRemoteChatRead, markRemoteNotificationRead, registerRemoteDevice, removeRemoteStudioNote, removeRemoteTaskNote, requestOtp, restoreSession, saveRemoteSocialAccount, sendChatPresenceHeartbeat, sendChatTyping, sendRemoteAdminChatMessage, sendRemoteChatMessage, setRemoteProfileInteraction, setSessionExpiredHandler, shareRemoteTask, syncRemoteSocialAccount, updateRemoteCampaign, updateRemoteCampaignApplication, updateRemoteCampaignPayment, updateRemoteChatMessage, updateRemoteStudioIdea, updateRemoteStudioNote, updateRemoteStudioProject, updateRemoteStudioStage, updateRemoteTask, updateRemoteTaskNote, updateRemoteProfile, verifyOtp, withTimeout, type ApiPublicProfile, type ApiUser, type OtpChallenge, type RemoteAdminChatConversation, type RemoteAdminChatMessage, type RemoteAdminChatSnapshot, type RemoteCampaignMatch, type RemoteChatMessage, type RemoteChatSnapshot, type RemoteProfileInteractions, type RemoteTaskInput, type RemoteTaskQuery } from "../../services/authApi.service";
import { openRemoteAdminChatConversation } from "../../services/authApi.service";
import { parseReminderDateTime } from "../../lib/reminders";
import { normalizeTodoTask, taskDateKeyFromDate, taskDateRange } from "../../lib/tasks";
import { CampaignDetailsView } from "./CampaignDetailsView";
import { CampaignApplicationView } from "./CampaignApplicationView";
import { BrandPublicProfileView } from "./BrandPublicProfileView";
import { campaignToBrandBrief, getMarketplaceIdentityId, isPublishedCampaign } from "../../lib/marketplace";
import { makeStyles } from "./marketplaceStyles";
import { AuthScreen, OnboardingScreen, SplashScreen, type OnboardingProfile, type OnboardingProgress } from "./AuthScreens";
import { HomeView } from "./HomeView";
import { CompareCreatorsView, DiscoverFilterDrawer, DiscoverView } from "./DiscoverViews";
import { CampaignsView } from "./CampaignViews";
import {
  EmptyProposalState,
  ProposalDetailView,
  ProposalView,
} from "./ProposalViews";
import { InboxView, NotificationView } from "./UtilityViews";
import { ProfileView } from "./ProfileView";
import { DetailView } from "./DetailView";
import {
  BrandCreatorProfileView,
  CreatorWorkDetailView,
} from "./CreatorProfileViews";
import {
  type Detail,
  type ChatProfile,
  type ChatReturn,
  type AppNotification,
  type AccountDeletionRequest,
  type SocialAccountMap,
  type ContentDetail,
  type CampaignFeedItem,
  type ProposalFeedItem,
  type CampaignFilters,
  type ProposalFilters,
  type DiscoverFilters,
  type NumericRange,
  type LocationSelection,
  type FilterCategory,
  type AppIconName,
  type LocationFilterOption,
  type ScrollHandler,
  DEFAULT_SOCIAL_ACCOUNTS,
  createDefaultProfile,
  getProfileInitials,
  AUTH_SOCIAL_PLATFORMS,
  mapRemoteUserProfile,
  getProfileCompletion,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_DISCOVER_FILTERS,
  DEFAULT_CAMPAIGN_FILTERS,
  DEFAULT_PROPOSAL_FILTERS,
  FILTER_CATEGORIES,
  CREATOR_CATEGORIES,
  DEMO_CREATOR_PROFILE_LOCATIONS,
  SUPPORTED_PLATFORMS,
  SUPPORTED_CONTENT_TYPES,
  normaliseLocationSearch,
  LOCATION_STATE_ALIASES,
  normaliseLocationState,
  matchesLocationSelection,
  getAppliedFilterCount,
  getCampaignAppliedFilterCount,
  getProposalAppliedFilterCount,
  getCampaignFilterStatus,
  isLocationFilterOption,
  getStartingPrice,
  getAmount,
  formatIncome,
  getFollowerCount,
  formatCompactNumber,
  formatRangeLabel,
  isWithinRange,
  normaliseRange,
  includesAny,
  toggleValue,
} from "./marketplaceDomain";

const taskErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message.trim() : "";
  return message || "Task update could not be saved.";
};

const formatNotificationTime = (value?: string) => {
  if (!value) return "Just now";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Just now";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24 && date.toDateString() === new Date().toDateString()) return `${elapsedHours}h ago`;
  const dayLabel = date.toDateString() === new Date(Date.now() - 86_400_000).toDateString() ? "Yesterday" : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
  const timeLabel = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(date);
  return `${dayLabel} · ${timeLabel}`;
};

const mapRemoteDirectoryProfile = (remote: ApiPublicProfile): PublicCreatorProfile => {
  const profile = remote.profile;
  const socialAccounts = Object.fromEntries(
    remote.socialAccounts.map((account) => [account.platform as SocialPlatform, account.profileUrl || account.handle]),
  ) as Partial<Record<SocialPlatform, string>>;
  const socialVerification = Object.fromEntries(
    remote.socialAccounts.map((account) => [account.platform as SocialPlatform, account.verificationStatus]),
  ) as PublicCreatorProfile["socialVerification"];
  const platforms = remote.socialAccounts.map((account) => account.platform as SocialPlatform);
  const followerCount = remote.socialAccounts.reduce((highest, account) => Math.max(highest, account.followerCount ?? 0), 0);
  return {
    id: remote.id,
    name: profile?.displayName?.trim() || "Creator",
    initials: getProfileInitials(profile?.displayName || "Creator"),
    avatarUrl: profile?.avatarUrl || undefined,
    city: profile?.city?.trim() || "India",
    state: profile?.locations?.[0] || "",
    niche: profile?.focus?.trim() || "Creator",
    rating: remote.rating ?? 0,
    reviews: remote.reviewCount ?? 0,
    followers: profile?.audienceSize || (followerCount ? `${followerCount}` : "Audience not added"),
    price: profile?.rateRange || "Rate not added",
    platforms,
    contentTypes: [],
    bio: profile?.bio || "",
    socialAccounts,
    socialVerification,
    reviewItems: (remote.campaignReviews ?? []).map((review) => ({ id: review.id, author: review.author, rating: review.rating, text: review.text, date: new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(new Date(review.date)) })),
  };
};

const mapRemoteChatProfile = (remote: ApiPublicProfile): ChatProfile => {
  const profile = remote.profile;
  const platforms = remote.socialAccounts.map((account) => account.platform as SocialPlatform);
  const highestFollowerCount = remote.socialAccounts.reduce((highest, account) => Math.max(highest, account.followerCount ?? 0), 0);
  const displayName = profile?.displayName?.trim() || "User";
  return {
    id: remote.id,
    kind: remote.role === "BRAND" ? "brand" : "creator",
    name: displayName,
    initials: getProfileInitials(displayName),
    city: profile?.city?.trim() || "Not added",
    state: profile?.locations?.[0] || "",
    niche: profile?.focus?.trim() || "Not added",
    followers: profile?.audienceSize || (highestFollowerCount ? `${highestFollowerCount}` : "Not added"),
    price: profile?.rateRange || "Not added",
    rating: remote.rating ?? 0,
    reviews: remote.reviewCount ?? 0,
    platforms,
    avatarUrl: profile?.avatarUrl || undefined,
    bio: profile?.bio || "",
    socialAccounts: Object.fromEntries(remote.socialAccounts.map((account) => [account.platform as SocialPlatform, account.profileUrl || account.handle])) as Partial<Record<SocialPlatform, string>>,
    socialVerification: Object.fromEntries(remote.socialAccounts.map((account) => [account.platform as SocialPlatform, account.verificationStatus])) as ChatProfile["socialVerification"],
  };
};

const mapRemoteChatMessage = (message: RemoteChatMessage): MarketplaceMessage => ({
  ...message,
  mine: Boolean(message.mine),
  time: message.time || (message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Now"),
  status: message.status ?? "sent",
});

const mergeRemoteChatMessage = (messages: MarketplaceMessage[], next: MarketplaceMessage) => {
  const index = messages.findIndex((item) => item.id === next.id || Boolean(next.clientMessageId && item.clientMessageId === next.clientMessageId));
  if (index === -1) return [...messages, next];
  const merged = [...messages];
  merged[index] = { ...merged[index], ...next };
  return merged;
};

const mapRemoteChatConversation = (item: import("../../services/authApi.service").RemoteChatConversation): MarketplaceConversation => ({
  id: item.id,
  applicationId: item.applicationId,
  campaignId: item.campaignId,
  brandId: item.brandId,
  creatorId: item.creatorId,
  participantName: item.participantName,
  participantInitials: item.participantInitials,
  participantAvatarUrl: item.participantAvatarUrl ?? undefined,
  briefTitle: item.briefTitle,
  preview: item.preview,
  status: item.status,
  blockedBy: item.blockedBy,
  updatedAt: item.updatedAt,
  unreadCount: item.unreadCount,
  online: item.online,
  messages: [],
});

const adminPreviewTaskTitles = ["Review the campaign brief", "Plan the opening hook", "Confirm the shoot location", "Capture the first cut", "Review creator feedback", "Prepare the final edit", "Schedule the post"];
const adminPreviewTasks: TodoTask[] = Array.from({ length: 14 }, (_, index) => {
  const offset = index === 0 ? 0 : index <= 7 ? index : index - 14;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + offset);
  return {
    id: `admin-preview-task-${index}`, title: adminPreviewTaskTitles[index % adminPreviewTaskTitles.length], owner: "Goodground Co.",
    dueDate: taskDateKeyFromDate(dueDate), dueTime: index % 2 ? "2:00 PM" : "10:00 AM",
    notes: "Sample task for the theme preview. Check the content direction, confirm the creator shortlist, and prepare the launch schedule.",
    reminderEnabled: false, reminderTone: "default", completed: offset === -3 || offset === 2,
    noteHistory: [{ id: `admin-preview-note-${index}`, text: "Sample note shown only in the admin preview.", createdAt: new Date().toISOString() }],
  };
});

const mapRemoteAdminChatConversation = (item: RemoteAdminChatConversation): MarketplaceConversation => ({
  id: item.conversationId, applicationId: item.conversationId, participantName: item.participant.name,
  participantInitials: "B", briefTitle: "Brandly support", preview: item.preview ?? "Message Brandly",
  status: "Accepted", blockedBy: [], updatedAt: item.updatedAt ?? new Date().toISOString(),
  unreadCount: item.unreadCount ?? 0, online: item.online, adminChat: true, messages: [],
});

const mapRemoteAdminChatMessage = (item: RemoteAdminChatMessage): MarketplaceMessage => ({
  id: item.id, text: item.text, mine: item.mine, senderId: item.senderId,
  senderRole: item.senderRole === "CREATOR" ? "Influencer" : "Brand", time: item.time,
  createdAt: item.createdAt, clientMessageId: item.clientMessageId ?? undefined,
  status: item.status, edited: false, attachments: item.attachments,
});

export function MarketplaceApp() {
  const adminThemePreview = isAdminThemePreview();
  const mobileStoreHydrated = useMobileStoreHydrated();
  const dispatch = useDispatch();
  const persistedAuth = useSelector((state: MobileRootState) => state.auth);
  const { theme, mode, toggleTheme, setPage } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [isSplashVisible, setIsSplashVisible] = useState(!adminThemePreview);
  const [authRestorePending, setAuthRestorePending] = useState(!adminThemePreview);
  const [isInDemo, setIsInDemo] = useState(adminThemePreview);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const onboardingProgressSaveQueue = useRef(Promise.resolve());
  const [role, setRole] = useState<"Brand" | "Influencer">("Brand");
  const applyRemoteUserRef = useRef<(user: ApiUser) => void>(null);
  const profile = persistedAuth.profile ?? createDefaultProfile(role);
  const [activeTab, setActiveTab] = useState<TabName>("Home");
  const [openStudioComposer, setOpenStudioComposer] = useState(false);
  const [openCalendarComposer, setOpenCalendarComposer] = useState(false);
  const [marketFilters, setMarketFilters] = useState<DiscoverFilters>(DEFAULT_DISCOVER_FILTERS);
  const [marketFiltersOpen, setMarketFiltersOpen] = useState(false);
  const [remoteDiscoverProfiles, setRemoteDiscoverProfiles] = useState<ApiPublicProfile[]>([]);
  const [remoteDiscoverQuery, setRemoteDiscoverQuery] = useState("");
  const [remoteDiscoverLoading, setRemoteDiscoverLoading] = useState(false);
  const [remoteDiscoverInteractions, setRemoteDiscoverInteractions] = useState<RemoteProfileInteractions>({
    savedIds: [],
    blockedIds: [],
    comparedIds: [],
  });
  const remoteDiscoverRequest = useRef(0);
  const remoteDiscoverProfileCache = useRef(new Map<string, ApiPublicProfile>());
  const remoteDiscoverCreators = useMemo(
    () => remoteDiscoverProfiles.map(mapRemoteDirectoryProfile),
    [remoteDiscoverProfiles],
  );
  const remoteDiscoverAllCreators = useMemo(
    () => Array.from(remoteDiscoverProfileCache.current.values()).map(mapRemoteDirectoryProfile),
    [remoteDiscoverProfiles],
  );
  const remoteDiscoverCreatorIds = useMemo(
    () => new Set(remoteDiscoverAllCreators.map((profile) => profile.id)),
    [remoteDiscoverAllCreators],
  );
  useEffect(() => {
    const requestId = ++remoteDiscoverRequest.current;
    if (!persistedAuth.userId || role !== "Brand") {
      remoteDiscoverProfileCache.current.clear();
      setRemoteDiscoverProfiles([]);
      if (persistedAuth.userId) {
        void getRemoteProfileInteractions()
          .then((interactions) => {
            if (requestId === remoteDiscoverRequest.current) setRemoteDiscoverInteractions(interactions);
          })
          .catch(() => undefined);
      } else {
        setRemoteDiscoverInteractions({ savedIds: [], blockedIds: [], comparedIds: [] });
      }
      setRemoteDiscoverLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      setRemoteDiscoverLoading(true);
      void getRemoteProfileDirectory({ search: remoteDiscoverQuery, role: "CREATOR" })
        .then((directory) => {
          if (requestId !== remoteDiscoverRequest.current) return;
          directory.profiles.forEach((profile) => remoteDiscoverProfileCache.current.set(profile.id, profile));
          setRemoteDiscoverProfiles(directory.profiles);
          setRemoteDiscoverInteractions(directory.interactions);
        })
        .catch(() => {
          if (requestId === remoteDiscoverRequest.current) setRemoteDiscoverProfiles([]);
        })
        .finally(() => {
          if (requestId === remoteDiscoverRequest.current) setRemoteDiscoverLoading(false);
        });
    }, 220);
    return () => clearTimeout(timer);
  }, [persistedAuth.userId, remoteDiscoverQuery, role]);
  const [detail, setDetail] = useState<Detail>(null);
  const activeChatIdRef = useRef<string | undefined>(undefined);
  const mutedChatIdsRef = useRef(new Set<string>());
  // Keep the selected application separate from the shared brand/creator chat.
  // Application actions target the selected request; chat transport targets the
  // canonical conversation shared by all accepted campaigns for the pair.
  const activeChatConversationId = detail?.type === "chat" ? detail.conversationId ?? detail.applicationId : undefined;
  const activeApplicationIdForEffects = activeChatConversationId;
  activeChatIdRef.current = activeChatConversationId;
  useEffect(() => {
    const update = () => setChatNotificationSuppressed(
      AppState.currentState === "active" && detail?.type === "chat" && Boolean(activeChatConversationId),
    );
    update();
    const subscription = AppState.addEventListener("change", update);
    return () => { subscription.remove(); setChatNotificationSuppressed(false); };
  }, [activeChatConversationId, detail]);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [notifications, setNotifications] =
    useState<AppNotification[]>(DEFAULT_NOTIFICATIONS);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const notificationRequestId = useRef(0);
  const loadRemoteNotifications = useCallback(async () => {
    if (!persistedAuth.userId || adminThemePreview) return;
    const requestId = ++notificationRequestId.current;
    setNotificationLoading(true);
    setNotificationError("");
    try {
      const items = await getRemoteNotifications();
      if (requestId !== notificationRequestId.current) return;
      setNotifications(items.map((item) => {
        const isReminder = item.type.includes("REMINDER") || item.data?.phase === "upcoming";
        const isSocialVerification = item.type === "SOCIAL_VERIFICATION";
        const mediaType = item.data?.mediaType;
        const mediaUri = item.data?.mediaUri;
        return {
          id: item.id,
          icon: isReminder ? "alarm-outline" as const : isSocialVerification ? "checkmark-circle-outline" as const : "chatbubble-ellipses-outline" as const,
          title: item.title,
          body: item.body,
          time: formatNotificationTime(item.createdAt),
          read: Boolean(item.readAt),
          category: isReminder ? "reminders" as const : isSocialVerification ? "profileActivity" as const : "messages" as const,
          taskId: item.data?.taskId,
          reminderId: item.data?.reminderId,
          applicationId: item.data?.applicationId,
          conversationId: item.data?.conversationId,
          adminChat: item.data?.adminChat === "true",
          socialPlatform: item.data?.socialPlatform,
          verificationStatus: item.data?.verificationStatus,
          mediaUri: typeof mediaUri === "string" && /^https:\/\//i.test(mediaUri) ? mediaUri : undefined,
          mediaName: item.data?.mediaName,
          mediaType: mediaType === "image" || mediaType === "video" || mediaType === "file" ? mediaType : undefined,
        };
      }));
    } catch (error) {
      if (requestId === notificationRequestId.current) setNotificationError(error instanceof Error ? error.message : "Notifications could not be loaded.");
    } finally {
      if (requestId === notificationRequestId.current) setNotificationLoading(false);
    }
  }, [adminThemePreview, persistedAuth.userId]);
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [deletionRequest, setDeletionRequest] =
    useState<AccountDeletionRequest | null>(null);
  const [accountDeletedAt, setAccountDeletedAt] = useState<number | null>(null);
  const [profileIsPublic, setProfileIsPublic] = useState(() => Boolean(persistedAuth.profile?.isPublic));
  const [isSavingProfileVisibility, setIsSavingProfileVisibility] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [collaborationStatuses, setCollaborationStatuses] = useState<
    Record<string, DealStatus>
  >({});
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountMap>(
    DEFAULT_SOCIAL_ACCOUNTS,
  );
  const [verifiedSocialAccounts, setVerifiedSocialAccounts] = useState<
    SocialPlatform[]
  >([]);
  const [pendingSocialAccounts, setPendingSocialAccounts] = useState<SocialPlatform[]>([]);
  const [socialAccountErrors, setSocialAccountErrors] = useState<Partial<Record<SocialPlatform, string>>>({});
  const saveRemoteSocial = (platform: string, handle: string) => saveRemoteSocialAccount({
    platform,
    handle,
    ...(/^https?:\/\//i.test(handle.trim()) ? { profileUrl: handle.trim() } : {}),
  });
  const requestSocialVerification = async (
    platform: SocialPlatform,
    handle: string,
  ) => {
    if (!persistedAuth.userId) return;
    const account = await withTimeout(saveRemoteSocial(platform, handle), 10_000, "Social profile save took too long. Please try again.");
    setSocialAccounts((current) => ({ ...current, [platform]: handle }));
    setVerifiedSocialAccounts((current) => current.filter((item) => item !== platform));
    setPendingSocialAccounts((current) => current.includes(platform) ? current : [...current, platform]);
    setSocialAccountErrors((current) => ({ ...current, [platform]: undefined }));
    await withTimeout(syncRemoteSocialAccount(account.id), 10_000, "Social profile check took too long. Please try again.");
    const deadline = Date.now() + 12_000;
    for (let attempt = 0; attempt < 8 && Date.now() < deadline; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(1_500, Math.max(0, deadline - Date.now()))));
      const user = await restoreSession(Math.min(2_500, Math.max(1, deadline - Date.now())), false);
      if (!user) break;
      applyRemoteUser(user);
      const refreshed = user.socialAccounts.find((item) => item.platform === platform);
      if (refreshed && refreshed.syncStatus !== "QUEUED" && refreshed.syncStatus !== "RUNNING") break;
    }
  };
  const saveSocialAccounts = async (accounts: SocialAccountMap, verifiedPlatforms: SocialPlatform[]) => {
    const previousAccounts = socialAccounts;
    const previousVerified = verifiedSocialAccounts;
    const previousPending = pendingSocialAccounts;
    const previousErrors = socialAccountErrors;
    setSocialAccounts(accounts);
    setVerifiedSocialAccounts(verifiedPlatforms);
    if (persistedAuth.userId) {
      try {
        const savedAccounts = await withTimeout(
          Promise.all(Object.entries(accounts)
            .filter((entry): entry is [string, string] => Boolean(entry[1]))
            .map(([platform, handle]) => saveRemoteSocial(platform, handle))),
          10_000,
          "Social profile checks took too long. Please try again.",
        );
        let latestAccounts = savedAccounts;
        const deadline = Date.now() + 12_000;
        for (let attempt = 0; attempt < 8 && Date.now() < deadline && latestAccounts.some((account) => account.syncStatus === "QUEUED" || account.syncStatus === "RUNNING"); attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, Math.min(1_500, Math.max(0, deadline - Date.now()))));
          const current = await restoreSession(Math.min(2_500, Math.max(1, deadline - Date.now())), false);
          if (!current) break;
          applyRemoteUser(current);
          latestAccounts = current.socialAccounts.filter((account) => Object.keys(accounts).includes(account.platform));
        }
        setVerifiedSocialAccounts(latestAccounts.filter((account) => account.verificationStatus === "VERIFIED").map((account) => account.platform as SocialPlatform));
        setPendingSocialAccounts(latestAccounts.filter((account) => account.verificationStatus === "PENDING" && account.syncStatus !== "FAILED").map((account) => account.platform as SocialPlatform));
        setSocialAccountErrors(Object.fromEntries(latestAccounts.filter((account) => account.syncStatus === "FAILED").map((account) => [account.platform, account.syncError || "Automatic verification failed. Our team will review this social account soon."])) as Partial<Record<SocialPlatform, string>>);
      } catch (error) {
        setSocialAccounts(previousAccounts);
        setVerifiedSocialAccounts(previousVerified);
        setPendingSocialAccounts(previousPending);
        setSocialAccountErrors(previousErrors);
        throw error;
      }
    }
  };
  const [utilityPage, setUtilityPage] = useState<"Chats" | "Notifications" | null>(null);
  useEffect(() => {
    const route = !isInDemo ? 'auth' : utilityPage ? `utility:${utilityPage}` : detail ? `detail:${detail.type}` : isOnboarding ? 'onboarding' : `tab:${activeTab}`;
    const screen = themeScreenForRoute(route) ?? 'home';
    setPage(screen);
    if (adminThemePreview && window.parent !== window) window.parent.postMessage({ type: 'brandly:theme-preview-screen', screen }, window.location.origin);
  }, [activeTab, adminThemePreview, detail?.type, isInDemo, isOnboarding, setPage, utilityPage]);
  const chromeProgress = useRef(new Animated.Value(1)).current;
  const chromeLayoutProgress = useRef(new Animated.Value(1)).current;
  const chromeVisible = useRef(true);
  const lastScrollY = useRef(0);
  const styles = makeStyles(theme);
  const openExternalLink = async (url: string, label: string) => {
    if (!/^https?:\/\//i.test(url)) {
      showToast(`${label} link is unavailable.`);
      return;
    }
    try {
      if (!(await Linking.canOpenURL(url))) throw new Error("Unsupported link");
      await Linking.openURL(url);
    } catch {
      showToast(`${label} is unavailable right now.`);
    }
  };
  const backLocked = useRef(false);
  const {
    campaigns,
    influencers,
    allInfluencers,
    setQuery: setMarketplaceQuery,
    proposals,
    reminders,
    reminderSettings,
    updateProposalStatus,
    createProposal,
    upsertReminder,
    updateReminder,
    setReminderSettings,
    creatorLocations,
    updateCreatorLocations,
    ideas,
    projects,
    isLoading: marketplaceLoading,
    todoTasks: localTodoTasks,
    addIdea: addIdeaLocal,
    archiveIdea: archiveIdeaLocal,
    unarchiveIdea: unarchiveIdeaLocal,
    addTodoTask: addTodoTaskToStore,
    toggleTodoTask: toggleTodoTaskInStore,
    updateTodoTask: updateTodoTaskInStore,
    addTodoTaskNote: addTodoTaskNoteToStore,
    updateTodoTaskNote: updateTodoTaskNoteToStore,
    removeTodoTaskNote: removeTodoTaskNoteToStore,
    addIdeaNote: addIdeaNoteLocal,
    updateIdeaNote: updateIdeaNoteLocal,
    removeIdeaNote: removeIdeaNoteLocal,
    createProjectFromIdea: createProjectFromIdeaLocal,
    updateIdea: updateIdeaLocal,
    saveProductionStageDraft: saveProductionStageDraftLocal,
    completeProductionStage: completeProductionStageLocal,
    updateProductionProject: updateProductionProjectLocal,
    briefs,
    applications,
    authoredReviews,
    marketplaceConversations,
    marketplaceBlocks,
    submitApplication: submitLocalApplication,
    updateApplicationStatus,
    declineApplication,
    toggleMarketplaceBlock,
    toggleMarketplaceApplicationBlock,
    addMarketplaceMessage,
    updateMarketplaceMessage,
    removeMarketplaceMessage,
    addAuthoredReview,
    updateAuthoredReview,
    upsertCampaign,
    archiveCampaign,
    savedIds,
    toggleSaved,
    comparisonIds: compareCreatorIds,
    toggleComparison,
  } = useDemoMarketplace();
  const reminderOverrides = useSelector((root: MobileRootState) => root.preferences.reminderOverrides);
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioSaving, setStudioSaving] = useState(false);
  const [remoteTodoTasks, setRemoteTodoTasks] = useState<TodoTask[]>([]);
  const [realCampaignsReady, setRealCampaignsReady] = useState(false);
  const [campaignMatches, setCampaignMatches] = useState<Record<string, Influencer[]>>({});
  const [campaignMatchesLoading, setCampaignMatchesLoading] = useState<Record<string, boolean>>({});
  const [campaignMatchIdsByCreator, setCampaignMatchIdsByCreator] = useState<Record<string, string[]>>({});
  const [campaignMatchIdsLoading, setCampaignMatchIdsLoading] = useState<Record<string, boolean>>({});
  const [chatCampaignsRequested, setChatCampaignsRequested] = useState(false);
  const remoteTasksOwnerRef = useRef(persistedAuth.userId);
  const reminderSigningOut = useRef(false);
  const handledReminderActions = useRef(new Set<string>());
  const pendingNotificationRoute = useRef<{ taskId?: string; reminderId?: string; applicationId?: string; conversationId?: string } | null>(null);
  const [remoteChatSnapshots, setRemoteChatSnapshots] = useState<Record<string, RemoteChatSnapshot>>({});
  const [adminChatConversation, setAdminChatConversation] = useState<MarketplaceConversation | null>(null);
  const [adminChatSnapshot, setAdminChatSnapshot] = useState<RemoteAdminChatSnapshot | null>(null);
  const [chatTyping, setChatTyping] = useState<Record<string, boolean>>({});
  const chatOwnerRef = useRef(persistedAuth.userId);
  const [chatSearch, setChatSearch] = useState("");
  const [chatSearchResults, setChatSearchResults] = useState<MarketplaceConversation[]>([]);
  const [chatListLoading, setChatListLoading] = useState(false);
  const [chatListError, setChatListError] = useState("");
  const [chatHasMore, setChatHasMore] = useState(false);
  const chatOffset = useRef(0);
  const chatListRequest = useRef(0);
  const chatListBusy = useRef(false);
  const chatListSyncedAt = useRef(new Map<string, number>());
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatHistoryError, setChatHistoryError] = useState("");
  const chatHistoryBusy = useRef(new Set<string>());
  const chatCacheRef = useRef(marketplaceConversations);
  chatCacheRef.current = marketplaceConversations;
  const loadChatList = useCallback(async (search = "", more = false, force = false) => {
    if (!persistedAuth.userId || (more && chatListBusy.current)) return;
    const query = search.trim();
    const cacheKey = query.toLowerCase();
    if (!more && !force && Date.now() - (chatListSyncedAt.current.get(cacheKey) ?? 0) < 15_000) return;
    const requestId = ++chatListRequest.current;
    chatListBusy.current = true;
    setChatListLoading(true);
    setChatListError("");
    const offset = more ? chatOffset.current : 0;
    try {
      const [items, adminThread] = await Promise.all([getRemoteChatConversations(offset, query), getRemoteAdminChatConversation()]);
      if (requestId !== chatListRequest.current) return;
      const mapped = items.map(mapRemoteChatConversation);
      const mappedAdmin = adminThread ? mapRemoteAdminChatConversation(adminThread) : null;
      setAdminChatConversation(mappedAdmin);
      const visible = mappedAdmin && (!query || `${mappedAdmin.participantName} ${mappedAdmin.preview}`.toLowerCase().includes(query.toLowerCase())) ? [...mapped, mappedAdmin] : mapped;
      if (query) setChatSearchResults((current) => more ? [...current, ...visible.filter((item) => !current.some((stored) => stored.id === item.id))] : visible);
      if (mapped.length || !query && !more) dispatch(hydrateMarketplaceConversations(mapped));
      if (!more) chatListSyncedAt.current.set(cacheKey, Date.now());
      chatOffset.current = offset + items.length;
      setChatHasMore(items.length === 30);
    } catch (error) {
      if (requestId === chatListRequest.current) setChatListError(error instanceof Error ? error.message : "Chats could not be loaded");
    } finally {
      if (requestId === chatListRequest.current) { chatListBusy.current = false; setChatListLoading(false); }
    }
  }, [dispatch, persistedAuth.userId]);
  const loadChatHistory = useCallback(async (applicationId: string, before?: string, force = false) => {
    const requestKey = `${applicationId}:${before ?? "latest"}`;
    if (chatHistoryBusy.current.has(requestKey)) return;
    const cached = chatCacheRef.current.find((item) => item.id === applicationId);
    if (!before && !force && cached?.messagesSyncedAt && Date.now() - cached.messagesSyncedAt < 30_000) {
      if (cached.unreadCount && cached.status === "Accepted") { dispatch(markMarketplaceConversationRead(applicationId)); void markRemoteChatRead(applicationId).catch(() => undefined); }
      return;
    }
    const ownerId = persistedAuth.userId;
    chatHistoryBusy.current.add(requestKey);
    setChatHistoryLoading(true);
    setChatHistoryError("");
    try {
      const snapshot = await getRemoteChatMessages(applicationId, before);
      if (chatOwnerRef.current !== ownerId) return;
      const conversationId = snapshot.conversationId || applicationId;
      const messages = snapshot.messages.map(mapRemoteChatMessage);
      const previous = chatCacheRef.current.find((item) => item.id === conversationId);
      const gap = Boolean(messages[0]?.createdAt && previous?.messages?.at(-1)?.createdAt && messages[0].createdAt! > previous.messages.at(-1)!.createdAt!);
      const nextCursor = before || !previous?.messagesSyncedAt || gap ? snapshot.nextCursor : previous.messageCursor;
      if (!chatCacheRef.current.some((item) => item.id === conversationId)) dispatch(hydrateMarketplaceConversations([{
        id: conversationId, applicationId: conversationId, campaignId: snapshot.campaignId,
        brandId: persistedAuth.role === "brand" ? ownerId : snapshot.participant.id,
        creatorId: persistedAuth.role === "creator" ? ownerId : snapshot.participant.id,
        participantName: snapshot.participant.name, participantInitials: snapshot.participant.name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
        participantAvatarUrl: snapshot.participant.avatarUrl ?? undefined, briefTitle: cached?.briefTitle ?? "",
        preview: messages.at(-1)?.text ?? "", status: snapshot.status, blockedBy: [], online: snapshot.participant.online,
        updatedAt: snapshot.syncedAt ?? new Date().toISOString(),
      }]));
      if (conversationId !== applicationId) setDetail((current) => current?.type === "chat" && current.applicationId === applicationId
        ? { ...current, conversationId, conversationStatus: snapshot.status } : current);
      dispatch(hydrateMarketplaceConversationMessages({ conversationId, messages, syncedAt: Date.now(), nextCursor: snapshot.nextCursor, older: Boolean(before) }));
      setRemoteChatSnapshots((current) => ({ ...current, [conversationId]: { ...snapshot,
        nextCursor,
        messages: mergeChatMessages(chatCacheRef.current.find((item) => item.id === conversationId)?.messages ?? current[conversationId]?.messages ?? [], messages),
      } }));
      if (snapshot.canSend && activeChatIdRef.current === conversationId) {
        dispatch(markMarketplaceConversationRead(conversationId));
        void markRemoteChatRead(conversationId).catch(() => undefined);
      }
    } catch (error) {
      setChatHistoryError(error instanceof Error ? error.message : "Messages could not be loaded");
    } finally { chatHistoryBusy.current.delete(requestKey); setChatHistoryLoading(chatHistoryBusy.current.size > 0); }
  }, [dispatch, persistedAuth.userId, persistedAuth.role]);
  const loadAdminChatHistory = useCallback(async (conversationId: string, before?: string) => {
    setChatHistoryLoading(true); setChatHistoryError("");
    try {
      const snapshot = await getRemoteAdminChatMessages(conversationId, before);
      if (chatOwnerRef.current !== persistedAuth.userId) return;
      const messages = snapshot.messages;
      setAdminChatSnapshot((current) => ({ ...snapshot, messages: before ? [...messages, ...(current?.messages ?? [])] : messages }));
      setAdminChatConversation((current) => current ? { ...current, online: snapshot.online, unreadCount: 0, preview: messages.at(-1)?.text ?? current.preview } : mapRemoteAdminChatConversation(snapshot));
      await markRemoteAdminChatRead(conversationId).catch(() => undefined);
    } catch (error) { setChatHistoryError(error instanceof Error ? error.message : "Brandly chat could not be loaded"); }
    finally { setChatHistoryLoading(false); }
  }, [persistedAuth.userId]);
  const remoteSnapshotOwnerRef = useRef<string | undefined>(undefined);
  const [remoteSnapshotReady, setRemoteSnapshotReady] = useState(false);
  const reminderOwnerRef = useRef(persistedAuth.userId);
  reminderOwnerRef.current = persistedAuth.userId;
  const remoteTaskCache = useRef(new Map<string, { savedAt: number; tasks: TodoTask[] }>());
  const remoteTaskRequests = useRef(new Map<string, Promise<TodoTask[]>>());
  // Task mutations must be ordered per task. A refresh/reminder update that
  // started before a completion update must never overwrite the new state.
  const taskMutationVersions = useRef(new Map<string, number>());
  const taskMutationQueues = useRef(new Map<string, Promise<void>>());
  const todoTasks = useMemo(() => adminThemePreview ? adminPreviewTasks : persistedAuth.userId && remoteTasksOwnerRef.current === persistedAuth.userId ? remoteTodoTasks : [],
    [adminThemePreview, persistedAuth.userId, remoteTodoTasks]);
  const previewIdeas = adminThemePreview && !ideas.length ? demoContentIdeas : ideas;
  const previewProjects = adminThemePreview && !projects.length ? demoProjects : projects;
  useEffect(() => {
    if (!adminThemePreview) return;
    const showScreen = (event: MessageEvent) => {
      const data = event.data;
      if (event.source !== window.parent || event.origin !== window.location.origin || data?.type !== 'brandly:admin-theme-preview' || !THEME_SCREENS.some((screen) => screen.id === data.screen) || (data.mode !== 'light' && data.mode !== 'dark') || (data.role !== 'Brand' && data.role !== 'Influencer') || typeof data.revision !== 'string' || data.revision.length > 100) return;
      const page = event.data.screen;
      setRole(data.role);
      setDetail(null);
      setUtilityPage(null);
      setIsOnboarding(false);
      if (page === 'auth') { setIsOnboarding(false); setIsInDemo(false); return; }
      if (page === 'onboarding') { setIsOnboarding(true); setIsInDemo(true); return; }
      setIsOnboarding(false);
      setIsInDemo(true);
      if (page === 'chat' || page === 'notifications') {
        setUtilityPage(page === 'chat' ? 'Chats' : 'Notifications');
        return;
      }
      if (page === 'taskDetail') {
        const task = todoTasks[0];
        if (task) setDetail({ type: 'todo', taskId: task.id });
        return;
      }
      if (page === 'creatorProfile' || page === 'creatorWork' || page === 'compareCreators') {
        const creator = demoInfluencers[0];
        if (page === 'creatorProfile') setDetail({ type: 'influencer', value: creator });
        else if (page === 'creatorWork') setDetail({ type: 'creatorWork', creator, work: creator.workHistory?.[0] ?? demoInfluencers[1].workHistory![0] });
        else setDetail({ type: 'compareCreators' });
        return;
      }
      if (page === 'brandProfile') { setDetail({ type: 'brandProfile', brief: demoBrandBriefs[0] }); return; }
      if (page === 'campaignDetail' || page === 'campaignApplication') {
        const campaign = demoCampaigns[0];
        setDetail(page === 'campaignApplication' ? { type: 'application', campaign, brief: demoBrandBriefs[0] } : { type: 'campaign', value: campaign });
        return;
      }
      if (page === 'proposalDetail') { setDetail({ type: 'proposal', value: demoProposals[0] }); return; }
      if (page === 'workflow') { setDetail({ type: 'flow', flow: 'campaign-form' }); return; }
      const route = THEME_SCREENS.find((item) => item.id === page)?.routes.find((item) => item.startsWith('tab:'));
      if (route) setActiveTab(route.slice(4) as TabName);
    };
    window.addEventListener('message', showScreen);
    return () => window.removeEventListener('message', showScreen);
  }, [adminThemePreview, todoTasks]);
  const taskCacheWrites = useRef(Promise.resolve());
  useEffect(() => {
    const owner = persistedAuth.userId;
    if (!owner || remoteTasksOwnerRef.current !== owner || !remoteTodoTasks.length && !remoteSnapshotReady) return;
    const snapshot = JSON.stringify(remoteTodoTasks.filter((task) => !task.id.startsWith("pending-task-")));
    taskCacheWrites.current = taskCacheWrites.current.catch(() => undefined)
      .then(() => AsyncStorage.setItem(`brandly.remote-tasks:${owner}`, snapshot));
  }, [persistedAuth.userId, remoteTodoTasks, remoteSnapshotReady]);
  const profileName = profile.name.trim();
  const currentActorId = getMarketplaceIdentityId(role, profileName || (role === "Brand" ? "your brand" : "your creator profile"));
  const currentCreator: PublicCreatorProfile | undefined = useMemo(() => {
    if (role !== "Influencer") return undefined;
    const matchedCreator = allInfluencers.find((creator) => profileName && creator.name.toLowerCase() === profileName.toLowerCase());
    return matchedCreator ? { ...matchedCreator, id: persistedAuth.userId ?? matchedCreator.id } : {
      id: persistedAuth.userId ?? currentActorId,
      name: profileName || "Your creator profile",
      initials: getProfileInitials(profileName),
      city: profile.city || "India",
      niche: profile.focus || "Creator",
      rating: 0,
      reviews: 0,
      followers: "",
      price: "",
      platforms: Object.keys(socialAccounts).filter((value): value is SocialPlatform => value in socialAccounts),
      contentTypes: [],
      bio: profile.bio,
    };
  }, [allInfluencers, currentActorId, persistedAuth.userId, profile.bio, profile.city, profile.focus, profileName, role, socialAccounts]);
  const currentBrandId = role === "Brand" && profileName ? persistedAuth.userId ?? currentActorId : undefined;
  const currentBrandName = profileName || "Your brand";
  const submitApplication = async (draft: Parameters<typeof submitLocalApplication>[0]) => {
    if (persistedAuth.userId) {
      if (!draft.campaignId || !isUuid(draft.campaignId)) {
        throw new Error("This campaign is not connected to a live account.");
      }
      const saved = await createRemoteCampaignApplication(draft.campaignId, {
        message: draft.message,
        responses: draft.responses,
        attachments: draft.attachments,
        contactShared: draft.contactShared,
      });
      dispatch(upsertMarketplaceApplicationAction(saved));
      void getRemoteCampaigns().then((snapshot) => dispatch(hydrateCampaignMarketplace(snapshot))).catch(() => undefined);
      return { application: saved, conversationId: saved.conversationId, created: true };
    }
    return submitLocalApplication(draft);
  };
  const brandCampaigns = useMemo(
    () => role === "Brand"
      ? adminThemePreview ? campaigns : campaigns.filter((campaign) => !currentBrandId || campaign.brandId === currentBrandId || campaign.brand === currentBrandName)
      : [],
    [campaigns, currentBrandId, currentBrandName, role],
  );
  const privateCampaignIds = useMemo(
    () => campaigns.filter((campaign) => campaign.visibility === "private").map((campaign) => campaign.id),
    [campaigns],
  );
  const acceptedCampaignIds = useMemo(
    () => applications.filter((application) => application.status === "Accepted").map((application) => application.campaignId ?? application.briefId),
    [applications],
  );
  const reviewItemsForFlow = useMemo(
    () => {
      const receivedAuthoredReviews = authoredReviews
        .filter((review) => {
          const subject = review.subjectName.trim().toLowerCase();
          return role === "Influencer"
            ? review.authorRole === "Brand" && subject === currentCreator?.name.trim().toLowerCase()
            : review.authorRole === "Influencer" && subject === currentBrandName.trim().toLowerCase();
        })
        .map((review) => ({
          id: review.id,
          author: review.author,
          rating: review.rating,
          text: review.text,
          date: review.date,
          tags: review.tags,
        }));
      const seededReviews = role === "Influencer"
        ? currentCreator?.reviewItems ?? []
        : brandCampaigns
            .flatMap((campaign) => (campaign.brandReviews ?? []).map((review) => ({
              id: review.id,
              author: review.creatorName,
              rating: review.rating,
              text: review.text,
              date: review.date,
            })))
            .filter((review, index, all) => all.findIndex((item) => item.id === review.id) === index);
      return [...seededReviews, ...receivedAuthoredReviews]
        .filter((review, index, all) => all.findIndex((item) => item.id === review.id) === index);
    },
    [authoredReviews, brandCampaigns, currentBrandName, currentCreator, role],
  );
  const profileReviewSummary = useMemo(() => ({
    rating: reviewItemsForFlow.length
      ? reviewItemsForFlow.reduce((sum, review) => sum + review.rating, 0) / reviewItemsForFlow.length
      : 0,
    count: reviewItemsForFlow.length,
  }), [reviewItemsForFlow]);
  const profilePreview = useMemo<ChatProfile>(() => {
    if (role === "Influencer") {
      const creator = currentCreator ?? (!persistedAuth.userId ? allInfluencers[0] : undefined);
      const fallbackName = persistedAuth.userId ? "Your creator profile" : "Aarohi Shah";
      const fallbackCity = persistedAuth.userId ? "Not added" : "Mumbai";
      const fallbackNiche = persistedAuth.userId ? "Not added" : "Lifestyle & fashion";
      return {
        id: creator?.id ?? currentActorId,
        kind: "creator",
        name: profile.name || creator?.name || fallbackName,
        initials: getProfileInitials(profile.name || creator?.name || fallbackName),
        city: profile.city || creator?.city || fallbackCity,
        state: creator?.state || (persistedAuth.userId ? "" : "Maharashtra"),
        niche: profile.focus || creator?.niche || fallbackNiche,
        followers: creator?.followers || (persistedAuth.userId ? "Not added" : "Growing audience"),
        price: creator?.price || (persistedAuth.userId ? "Not added" : "Discussed privately"),
        rating: creator?.rating ?? 0,
        reviews: creator?.reviews ?? 0,
        platforms: creator?.platforms ?? ["Instagram"],
        avatarUrl: profile.avatarUri || creator?.avatarUrl,
      };
    }
    const campaign = brandCampaigns[0] ?? campaigns[0];
    const fallbackBrandName = persistedAuth.userId ? "Your brand profile" : "Goodground Co.";
    const fallbackBrandCity = persistedAuth.userId ? "Not added" : "Mumbai";
    const fallbackBrandFocus = persistedAuth.userId ? "Not added" : "Lifestyle";
    const brandBrief = briefs.find((brief) =>
      (currentBrandId && brief.brandId === currentBrandId) ||
      brief.brandName === currentBrandName,
    );
    return {
      id: currentBrandId ?? campaign?.brandId ?? currentActorId,
      kind: "brand",
      name: profile.name || campaign?.brand || fallbackBrandName,
      initials: getProfileInitials(profile.name || campaign?.brand || fallbackBrandName),
      city: profile.city || campaign?.city || brandBrief?.city || fallbackBrandCity,
      state: persistedAuth.userId ? "" : "Maharashtra",
      niche: profile.focus || campaign?.category || brandBrief?.category || fallbackBrandFocus,
      followers: `${brandCampaigns.length} active brief${brandCampaigns.length === 1 ? "" : "s"}`,
      price: campaign?.budget || brandBrief?.budget || (persistedAuth.userId ? "Not added" : "Flexible budget"),
      rating: profileReviewSummary.rating,
      reviews: profileReviewSummary.count,
      platforms: Object.keys(socialAccounts).filter(
        (value): value is SocialPlatform => value in socialAccounts,
      ),
      avatarUrl: profile.avatarUri || brandBrief?.brandLogoUrl,
    };
  }, [allInfluencers, brandCampaigns, briefs, campaigns, currentActorId, currentBrandId, currentBrandName, currentCreator, persistedAuth.userId, profile, profileReviewSummary, role, socialAccounts]);
  const profileCompletion = useMemo(
    () => getProfileCompletion(profile, role, socialAccounts),
    [profile, role, socialAccounts],
  );
  const homeApplications = useMemo(
    () => role === "Brand"
      ? applications.filter((application) => !currentBrandId || !application.brandId || application.brandId === currentBrandId)
      : applications.filter((application) => !currentCreator || application.creatorId === currentCreator.id),
    [applications, currentBrandId, currentCreator, role],
  );
  const sentCampaignIdsForCreator = useMemo(
    () => detail?.type === "influencer"
      ? applications.filter((application) => application.creatorId === detail.value.id && application.brandId === (currentBrandId ?? currentActorId) && application.campaignId).map((application) => application.campaignId as string)
      : [],
    [applications, currentActorId, currentBrandId, detail],
  );
  const calendarTasks = role === "Brand"
    ? todoTasks.filter((task) => !task.sourceTaskId)
    : todoTasks.filter((task) => !task.sharedWithCreatorAt || Boolean(task.sourceTaskId) || task.creatorId === persistedAuth.userId);
  const homeDataLoading = Boolean(
    persistedAuth.userId && (
      !realCampaignsReady ||
      !remoteSnapshotReady ||
      (role === "Brand" ? remoteDiscoverLoading : studioLoading)
    ),
  );
  const taskReminders = useMemo(
    () => todoTasks
      .filter((task) => task.reminderEnabled || task.reminderAt || (task.reminderStatus && task.reminderStatus !== "NONE"))
      .map((task) => ({ ...taskToReminder(task), ...reminderOverrides?.[`${persistedAuth.userId}:task-reminder-${task.id}`] })),
    [todoTasks, reminderOverrides, persistedAuth.userId],
  );
  const visibleReminders = useMemo(
    () => [...reminders, ...taskReminders],
    [reminders, taskReminders],
  );
  const isUuid = (value?: string) => Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
  const reminderAtForTask = (task: Pick<TodoTask, "dueDate" | "dueTime" | "reminderEnabled" | "reminderAt">) => {
    if (!task.reminderEnabled || task.dueTime.trim().toLowerCase() === "anytime") return null;
    if (task.reminderAt) return task.reminderAt;
    const timestamp = parseReminderDateTime(task.dueDate, task.dueTime);
    return timestamp ? new Date(timestamp).toISOString() : null;
  };
  const remoteTaskInput = (task: TodoTask): RemoteTaskInput => ({
    title: task.title,
    notes: task.notes,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    reminderEnabled: task.reminderEnabled,
    reminderAt: reminderAtForTask(task),
    reminderTone: task.reminderTone,
    kind: task.kind,
    links: task.links,
    attachments: task.attachments,
    projectId: task.projectId,
    stage: task.stage,
    campaignId: task.campaignId,
    conversationId: task.conversationId,
    ...(isUuid(task.sourceTaskId) ? { sourceTaskId: task.sourceTaskId } : {}),
    ...(isUuid(task.brandId) ? { brandId: task.brandId } : {}),
    ...(isUuid(task.creatorId) ? { creatorId: task.creatorId } : {}),
  });
  const replaceRemoteTask = (nextTask: TodoTask, expectedMutationVersion?: number) => setRemoteTodoTasks((current) => {
    const normalizedTask = normalizeTodoTask(nextTask);
    const activeMutation = taskMutationQueues.current.has(normalizedTask.id);
    if (expectedMutationVersion === undefined && activeMutation) return current;
    if (expectedMutationVersion !== undefined && taskMutationVersions.current.get(normalizedTask.id) !== expectedMutationVersion) return current;
    const index = current.findIndex((task) => task.id === normalizedTask.id);
    if (index === -1) return [normalizedTask, ...current];
    const existingTask = current[index];
    const incomingUpdatedAt = normalizedTask.updatedAt ? Date.parse(normalizedTask.updatedAt) : NaN;
    const existingUpdatedAt = existingTask.updatedAt ? Date.parse(existingTask.updatedAt) : NaN;
    if (Number.isFinite(incomingUpdatedAt) && Number.isFinite(existingUpdatedAt) && incomingUpdatedAt < existingUpdatedAt) return current;
    const next = current.slice();
    next[index] = normalizedTask;
    return next;
  });
  const mergeRemoteTasks = (items: TodoTask[]) => {
    const normalizedItems = items.map(normalizeTodoTask);
    setRemoteTodoTasks((current) => {
      const byId = new Map(current.map((task) => [task.id, task]));
      normalizedItems.forEach((task) => {
        // Keep the optimistic task visible while its write is in flight.
        if (taskMutationQueues.current.has(task.id)) return;
        const existing = byId.get(task.id);
        const incomingUpdatedAt = task.updatedAt ? Date.parse(task.updatedAt) : NaN;
        const existingUpdatedAt = existing?.updatedAt ? Date.parse(existing.updatedAt) : NaN;
        // A broad refresh can finish after the PATCH response. Never let its
        // older snapshot roll a completed task back to its previous state.
        if (Number.isFinite(incomingUpdatedAt) && Number.isFinite(existingUpdatedAt) && incomingUpdatedAt < existingUpdatedAt) return;
        byId.set(task.id, task);
      });
      return Array.from(byId.values());
    });
  };
  const loadRemoteTasks = async (query: RemoteTaskQuery = {}, force = false) => {
    if (!persistedAuth.userId) {
      setRemoteTodoTasks([]);
      return;
    }
    const key = JSON.stringify({ userId: persistedAuth.userId, ...query });
    const cached = remoteTaskCache.current.get(key);
    if (!force && cached && Date.now() - cached.savedAt < 30_000) {
      mergeRemoteTasks(cached.tasks);
      return cached.tasks;
    }
    const existingRequest = remoteTaskRequests.current.get(key);
    if (existingRequest) return existingRequest;
    const requestedOwner = persistedAuth.userId;
    const request = getRemoteTasks(query)
      .then((items) => {
        if (reminderOwnerRef.current !== requestedOwner) return [];
        remoteTasksOwnerRef.current = requestedOwner;
        const normalized = items.map((item) => normalizeTodoTask(item as TodoTask));
        remoteTaskCache.current.set(key, { savedAt: Date.now(), tasks: normalized });
        mergeRemoteTasks(normalized);
        if (Object.keys(query).length === 0) {
          const ids = new Set(normalized.map((task) => task.id));
          setRemoteTodoTasks((current) => current.filter((task) => ids.has(task.id)
            || task.id.startsWith("pending-task-") || taskMutationQueues.current.has(task.id)));
          remoteSnapshotOwnerRef.current = requestedOwner;
          setRemoteSnapshotReady(true);
        }
        return normalized;
      })
      .finally(() => remoteTaskRequests.current.delete(key));
    remoteTaskRequests.current.set(key, request);
    return request;
  };
  const addTodoTask = (draft: TodoTaskDraft) => {
    if (!persistedAuth.userId) {
      showToast("Sign in to save tasks.");
      return null;
    }
    const clientId = createReminderId();
    const owner = persistedAuth.userId;
    const id = `pending-task-${clientId}`;
    const optimistic = normalizeTodoTask({ ...draft, id, owner: profile.name || "You", completed: false } as TodoTask);
    setRemoteTodoTasks((current) => [optimistic, ...current]);
    void createRemoteTask({ ...remoteTaskInput(optimistic), clientId }).then((saved) => {
      if (reminderOwnerRef.current !== owner) return;
      const normalized = normalizeTodoTask(saved as TodoTask);
      setRemoteTodoTasks((current) => current.map((task) => task.id === id ? normalized : task));
      showToast("Task saved to your calendar", "success");
    }).catch(() => {
      setRemoteTodoTasks((current) => current.filter((task) => task.id !== id));
      showToast("Task could not be saved. Please try again.", "error");
    });
    return id;
  };
  const updateTodoTask = (id: string, changes: Partial<TodoTask>) => {
    const current = todoTasks.find((task) => task.id === id);
    const mutationOwner = persistedAuth.userId;
    if (!current) return;
    if (changes.reminderEnabled !== undefined || changes.reminderAt !== undefined
      || changes.dueDate !== undefined || changes.dueTime !== undefined || changes.completed !== undefined) {
      void clearReminderAction(`task-reminder-${id}`);
    }
    const draft = normalizeTodoTask({ ...current, ...changes, id });
    const scheduleChanged = changes.dueDate !== undefined || changes.dueTime !== undefined;
    const next = scheduleChanged
      ? normalizeTodoTask({
          ...draft,
          reminderAt: draft.reminderEnabled && draft.dueTime.trim().toLowerCase() !== "anytime"
            ? (() => {
                const timestamp = parseReminderDateTime(draft.dueDate, draft.dueTime);
                return timestamp ? new Date(timestamp).toISOString() : null;
              })()
            : null,
        })
      : draft;
    setRemoteTodoTasks((items) => items.map((task) => task.id === id ? next : task));
    if (!persistedAuth.userId || Object.keys(changes).every((key) => key === "reminderNotificationId")) return;
    remoteTaskCache.current.clear();
    const version = (taskMutationVersions.current.get(id) ?? 0) + 1;
    taskMutationVersions.current.set(id, version);
    const payload: Partial<RemoteTaskInput> & { completed?: boolean } = changes.completed !== undefined
      // Completion is intentionally a small command. Do not resend old
      // links/attachments/reminder data that can make a valid completion
      // fail validation or re-arm an older reminder request.
      ? { completed: next.completed, reminderEnabled: false, reminderAt: null }
      : remoteTaskInput(next);
    const previous = taskMutationQueues.current.get(id) ?? Promise.resolve();
    let request: Promise<void>;
    request = previous
      .catch(() => undefined)
      .then(async () => {
        if (reminderOwnerRef.current !== mutationOwner) return;
        const saved = await updateRemoteTask(id, payload);
        if (reminderOwnerRef.current === mutationOwner && taskMutationVersions.current.get(id) === version) {
          remoteTaskCache.current.clear();
          replaceRemoteTask(saved as TodoTask, version);
          if (changes.completed !== undefined) {
            showToast(next.completed ? "Task marked complete" : "Task marked open", "success");
          }
        }
      })
      .catch((error) => {
        if (taskMutationVersions.current.get(id) !== version) return;
        void loadRemoteTasks({ from: next.dueDate, to: next.dueDate }, true).catch(() => undefined);
        showToast(taskErrorMessage(error), "error");
      })
      .finally(() => {
        if (taskMutationQueues.current.get(id) === request) taskMutationQueues.current.delete(id);
      });
    taskMutationQueues.current.set(id, request);
  };
  const deleteTodoTask = async (id: string) => {
    try {
      await deleteRemoteTask(id);
      await cancelReminderSeries(id);
      await clearReminderAction(`task-reminder-${id}`);
      setRemoteTodoTasks((current) => current.filter((task) => task.id !== id));
      taskReminderSchedules.current.delete(id);
      remoteTaskCache.current.clear();
      setDetail(null);
      showToast("Task deleted", "success");
    } catch (error) { showToast(taskErrorMessage(error), "error"); }
  };
  const addTodoTaskNote = (id: string, text: string) => {
    if (!persistedAuth.userId) return addTodoTaskNoteToStore(id, text);
    void addRemoteTaskNote(id, text).then((saved) => replaceRemoteTask(saved as TodoTask)).catch(() => showToast("Task note could not be saved."));
  };
  const updateTodoTaskNote = (id: string, noteId: string, text: string) => {
    if (!persistedAuth.userId) return updateTodoTaskNoteToStore(id, noteId, text);
    void updateRemoteTaskNote(id, noteId, text).then((saved) => replaceRemoteTask(saved as TodoTask)).catch(() => showToast("Task note could not be updated."));
  };
  const removeTodoTaskNote = (id: string, noteId: string) => {
    if (!persistedAuth.userId) return removeTodoTaskNoteToStore(id, noteId);
    void removeRemoteTaskNote(id, noteId).then((saved) => replaceRemoteTask(saved as TodoTask)).catch(() => showToast("Task note could not be removed."));
  };
  const sendCreatorRequest = (creator: Influencer, campaign: Campaign, notify = true) => {
    const brief = briefs.find((item) => item.campaignId === campaign.id) ?? campaignToBrandBrief(campaign);
    if (persistedAuth.userId && isUuid(campaign.id)) {
      if (!isUuid(creator.id)) {
        showToast("This creator is not connected to a live account.", "error");
        return false;
      }
      void inviteRemoteCampaignCreator(campaign.id, creator.id, `Campaign invitation for ${campaign.title}`)
        .then((saved) => {
          dispatch(upsertMarketplaceApplicationAction(saved));
          void getRemoteCampaigns().then((snapshot) => dispatch(hydrateCampaignMarketplace(snapshot))).catch(() => undefined);
          if (notify) showToast("Creator request sent", "success");
        })
        .catch((error) => showToast(error instanceof Error ? error.message : "Campaign invitation could not be saved.", "error"));
      return true;
    }
    if (persistedAuth.userId) {
      showToast("This campaign is not connected to a live account.", "error");
      return false;
    }
    void submitApplication({
      briefId: brief.id,
      campaignId: campaign.id,
      brandId: currentBrandId ?? currentActorId,
      briefTitle: campaign.title,
      brandName: currentBrandName,
      brandInitials: getProfileInitials(currentBrandName),
      creatorId: creator.id,
      creatorName: creator.name,
      creatorInitials: creator.initials,
      creatorProfile: creator,
      contactShared: false,
      responses: {},
      attachments: [],
      direction: "brand-to-creator",
      message: `Campaign invitation for ${campaign.title}`,
    }).then((result) => {
      if (notify) showToast(result.created ? "Creator request sent" : `This campaign request is already ${result.application.status.toLowerCase()}.`);
    });
    return true;
  };
  const sendCreatorRequests = (campaign: Campaign, creatorIds: string[]) => {
    const created = Array.from(new Set(creatorIds)).reduce((count, creatorId) => {
      const creator = eligibleCampaignRecipients.find((item) => item.id === creatorId);
      return creator && sendCreatorRequest(creator, campaign, false) ? count + 1 : count;
    }, 0);
    showToast(created ? `Campaign sent to ${created} creator${created === 1 ? "" : "s"}.` : "This campaign was already sent to the selected creators.");
    return created;
  };
  const sendCreatorCampaigns = (creator: Influencer, selectedCampaigns: Campaign[]) => {
    const created = selectedCampaigns.reduce((count, campaign) => count + (sendCreatorRequest(creator, campaign, false) ? 1 : 0), 0);
    showToast(created ? `${created} campaign${created === 1 ? "" : "s"} sent to ${creator.name}.` : "Those campaigns were already sent to this creator.");
    return created;
  };
  const toggleRemoteProfileInteraction = (kind: "saved" | "blocked" | "compared", targetId: string, onFailure?: () => void) => {
    const key = kind === "saved" ? "savedIds" : kind === "blocked" ? "blockedIds" : "comparedIds";
    const previous = remoteDiscoverInteractions;
    const active = !previous[key].includes(targetId);
    setRemoteDiscoverInteractions((current) => ({
      ...current,
      [key]: active ? [...current[key], targetId] : current[key].filter((id) => id !== targetId),
    }));
    void setRemoteProfileInteraction(kind, targetId, active)
      .then((next) => {
        setRemoteDiscoverInteractions(next);
        if (kind === "blocked" && active) {
          remoteDiscoverProfileCache.current.delete(targetId);
          setRemoteDiscoverProfiles((current) => current.filter((profile) => profile.id !== targetId));
          setDetail((current) => current?.type === "profile" && current.value.id === targetId ? null : current);
          void getRemoteCampaigns().then((snapshot) => dispatch(hydrateCampaignMarketplace(snapshot))).catch(() => undefined);
          void loadChatList("", false, true);
        }
      })
      .catch((error) => {
        setRemoteDiscoverInteractions(previous);
        onFailure?.();
        showToast(error instanceof Error ? error.message : "Profile action could not be saved.", "error");
      });
  };
  const toggleRemoteCreatorSaved = (creatorId: string) => {
    if (!remoteDiscoverCreatorIds.has(creatorId)) return;
    toggleRemoteProfileInteraction("saved", creatorId);
  };
  const toggleCompareCreator = (creatorId: string) => {
    if (remoteDiscoverCreatorIds.has(creatorId)) {
      if (!remoteDiscoverInteractions.comparedIds.includes(creatorId) && remoteDiscoverInteractions.comparedIds.length >= 10) {
        showToast("You can compare up to 10 creators.");
        return;
      }
      toggleRemoteProfileInteraction("compared", creatorId);
      return;
    }
    if (compareCreatorIds.includes(creatorId)) {
      toggleComparison(creatorId);
      return;
    }
    if (compareCreatorIds.length >= 10) {
      showToast("You can compare up to 10 creators.");
      return;
    }
    toggleComparison(creatorId);
  };
  const discoverCompareCreatorIds = role === "Brand"
    ? remoteDiscoverInteractions.comparedIds
    : compareCreatorIds;
  const discoverCreatorsForCompare = role === "Brand" && !adminThemePreview ? remoteDiscoverAllCreators : allInfluencers;
  const discoverSavedIds = role === "Brand" ? remoteDiscoverInteractions.savedIds : savedIds;
  const [proposalReminderTarget, setProposalReminderTarget] =
    useState<Reminder | null>(null);
  const [proposalReminderDraft, setProposalReminderDraft] =
    useState<ReminderSettings>(reminderSettings);
  const [proposalReminderEnabled, setProposalReminderEnabled] = useState(false);
  const taskReminderSchedules = useRef(new Map<string, { notificationIds: string[] }>());
  const remotePushToken = useRef<string | null>(null);
  const localReminderCapabilityRegistered = useRef(false);
  const remoteDeviceRegistration = useRef(Promise.resolve());
  const pushRegistrationInFlight = useRef(false);
  const pushRegistrationNoticeShown = useRef(false);
  const notificationSettingsName = Platform.OS === "ios" ? "iPhone Settings" : "Android Settings";
  const queueRemoteDeviceRegistration = useCallback((token: string, supportsLocalReminders: boolean) => {
    const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
    const request = remoteDeviceRegistration.current
      .catch(() => undefined)
      .then(() => registerRemoteDevice(token, platform, Constants.expoConfig?.version, supportsLocalReminders));
    remoteDeviceRegistration.current = request.then(() => undefined, () => undefined);
    return request;
  }, []);
  const registerPushDeviceForUser = useCallback(async () => {
    if (adminThemePreview || !persistedAuth.userId || authRestorePending || pushRegistrationInFlight.current) return;
    pushRegistrationInFlight.current = true;
    try {
      const token = remotePushToken.current ?? await registerForRemotePushToken();
      remotePushToken.current = token;
      if (!token) {
        localReminderCapabilityRegistered.current = false;
        if (!pushRegistrationNoticeShown.current) {
          showToast(`Allow notifications for Brandly in ${notificationSettingsName} to receive chat alerts.`, "error");
          pushRegistrationNoticeShown.current = true;
        }
        return;
      }
      const permissionGranted = await hasReminderNotificationPermission();
      await queueRemoteDeviceRegistration(token, permissionGranted);
      localReminderCapabilityRegistered.current = permissionGranted;
      if (!permissionGranted && !pushRegistrationNoticeShown.current) {
        showToast(`Turn on Brandly notifications in ${notificationSettingsName} to see chat alerts.`, "error");
        pushRegistrationNoticeShown.current = true;
      } else if (permissionGranted) pushRegistrationNoticeShown.current = false;
    } catch (error) {
      localReminderCapabilityRegistered.current = false;
      console.warn("[push] Device registration failed", error);
      if (!pushRegistrationNoticeShown.current) {
        const reason = error instanceof Error && error.message.trim()
          ? error.message.trim().slice(0, 150)
          : "Unknown registration error";
        showToast(`Push setup failed: ${reason}`, "error");
        pushRegistrationNoticeShown.current = true;
      }
    } finally {
      pushRegistrationInFlight.current = false;
    }
  }, [adminThemePreview, authRestorePending, notificationSettingsName, persistedAuth.userId, queueRemoteDeviceRegistration, showToast]);
  const registerLocalReminderCapability = () => {
    if (!persistedAuth.userId || !remotePushToken.current || localReminderCapabilityRegistered.current) return;
    localReminderCapabilityRegistered.current = true;
    void queueRemoteDeviceRegistration(remotePushToken.current, true).catch(() => {
      localReminderCapabilityRegistered.current = false;
    });
  };
  const scheduleTaskReminder = async (
    task: TodoTask, requestPermission: boolean, settings: ReminderSettings = reminderSettings,
  ) => {
    if (task.id.startsWith("pending-task-")) return;
    const owner = persistedAuth.userId;
    if (reminderSigningOut.current || !owner || reminderOwnerRef.current !== owner) return;
    try {
      if (task.completed || !task.reminderEnabled || task.dueTime.trim().toLowerCase() === "anytime") {
        await cancelReminderSeries(task.id);
        taskReminderSchedules.current.delete(task.id);
        return;
      }
      const notificationIds = await scheduleTaskReminderSeries(
        { ...taskToReminder(task), ...reminderOverrides?.[`${owner}:task-reminder-${task.id}`], ownerId: owner }, { ...settings, soundTone: task.reminderTone },
        { requestPermission },
      );
      if (reminderOwnerRef.current !== owner) return;
      taskReminderSchedules.current.set(task.id, { notificationIds });
      if (notificationIds.length) registerLocalReminderCapability();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Reminder could not be scheduled", "error");
    }
  };
  useEffect(() => {
    let active = true;
    const reconcile = async () => {
      if (reminderSigningOut.current || !active || reminderOwnerRef.current !== persistedAuth.userId) return;
      await setReminderOwner(persistedAuth.userId);
      const actions = await readReminderActions();
      if (!active) return;
      for (const action of Object.values(actions)) {
        if (action.ownerId && action.ownerId !== persistedAuth.userId) continue;
        const taskForAction = action.taskId ? todoTasks.find((task) => task.id === action.taskId) : undefined;
        if (taskForAction?.completed || (action.synced && taskForAction?.reminderAt
          && Date.parse(taskForAction.reminderAt) !== action.dueAt
          && Date.parse(taskForAction.reminderAt) !== action.sourceDueAt
          && Date.parse(taskForAction.updatedAt ?? "") > action.changedAt)) {
          await clearReminderAction(action.reminderId, action.changedAt);
          delete actions[action.reminderId];
          continue;
        }
        if (action.error) showToast(action.error, "error");
        const local = reminders.find((item) => item.id === action.reminderId);
        if (local && (local.enabled !== !action.stopped || local.dueAt !== action.dueAt || local.notificationId !== action.notificationId)) updateReminder({ id: action.reminderId, enabled: !action.stopped,
          dueAt: action.dueAt, notificationId: action.notificationId });
        if (action.taskId && todoTasks.some((task) => !task.completed && task.id === action.taskId && (task.reminderEnabled !== !action.stopped || task.reminderAt !== (action.stopped ? null : new Date(action.dueAt).toISOString())))) setRemoteTodoTasks((current) => current.map((task) => !task.completed && task.id === action.taskId && (task.reminderEnabled !== !action.stopped || task.reminderAt !== (action.stopped ? null : new Date(action.dueAt).toISOString())) ? {
          ...task, reminderEnabled: !action.stopped,
          reminderAt: action.stopped ? null : new Date(action.dueAt).toISOString(),
          reminderStatus: action.stopped ? "STOPPED" : "PENDING",
        } : task));
      }
      if (persistedAuth.userId) await clearObsoleteTaskReminderNotifications(todoTasks, remoteSnapshotReady && remoteSnapshotOwnerRef.current === persistedAuth.userId);
      for (const task of todoTasks) {
        const action = actions[`task-reminder-${task.id}`];
        const effective = action && action.ownerId === persistedAuth.userId && !task.completed
          ? { ...task, reminderEnabled: !action.stopped,
              reminderAt: action.stopped ? null : new Date(action.dueAt).toISOString() }
          : task;
        await scheduleTaskReminder(effective, false);
      }
      for (const reminder of reminders.filter((item) => item.enabled)) {
        const proposal = reminder.proposalId ? proposals.find((item) => item.id === reminder.proposalId) : undefined;
        if (proposal?.status === "Completed" || proposal?.status === "Declined") {
          await clearReminderAction(reminder.id);
          await cancelDeliveryReminder(reminder.notificationId, reminder.id);
          updateReminder({ id: reminder.id, enabled: false, notificationId: undefined });
          continue;
        }
        if (reminderSigningOut.current || !active || reminderOwnerRef.current !== persistedAuth.userId) return;
        await scheduleDeliveryReminder(reminder, reminderSettings, { requestPermission: false });
      }
      if (persistedAuth.userId) await syncReminderActions(persistedAuth.userId);
    };
    void reconcile().catch((error) => showToast(error instanceof Error ? error.message : "Reminder reconciliation failed", "error"));
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void reconcile().catch((error) => showToast(error instanceof Error ? error.message : "Reminder reconciliation failed", "error"));
    });
    return () => { active = false; subscription.remove(); };
  }, [persistedAuth.userId, todoTasks, reminders, reminderSettings, reminderOverrides, remoteSnapshotReady, proposals]);
  useEffect(() => {
    if (adminThemePreview || authRestorePending) return;
    if (!persistedAuth.userId) {
      void cancelDailyStreakReminders().catch(() => undefined);
      return;
    }
    if (!remoteSnapshotReady || remoteSnapshotOwnerRef.current !== persistedAuth.userId) return;
    void syncDailyStreakReminder(persistedAuth.userId, todoTasks).catch(() => undefined);
  }, [adminThemePreview, authRestorePending, persistedAuth.userId, remoteSnapshotReady, todoTasks]);
  const getChatProfile = (name: string): ChatProfile => {
    const liveSession = Boolean(persistedAuth.userId);
    if (role === "Brand") {
      const creatorSource = liveSession ? remoteDiscoverAllCreators : allInfluencers;
      const creator = creatorSource.find((item) => item.name === name) ?? (!liveSession && currentCreator?.name === name ? currentCreator : undefined);
      return {
        id: creator?.id ?? "chat-creator",
        kind: "creator",
        name: creator?.name ?? name,
        initials: creator?.initials ?? name.slice(0, 2).toUpperCase(),
        city: creator?.city ?? (liveSession ? "Not added" : "Mumbai"),
        state: creator?.state ?? (liveSession ? "" : "Maharashtra"),
        niche: creator?.niche ?? (liveSession ? "Not added" : "Lifestyle creator"),
        followers: creator?.followers ?? (liveSession ? "Not added" : "84K"),
        price: creator?.price ?? (liveSession ? "Not added" : "₹8K – ₹15K"),
        rating: creator?.rating ?? (liveSession ? 0 : 4.8),
        reviews: creator?.reviews ?? (liveSession ? 0 : 24),
        platforms: creator?.platforms ?? (liveSession ? [] : ["Instagram", "YouTube"]),
        avatarUrl: creator?.avatarUrl,
      };
    }
    const campaign = campaigns.find((item) => item.brand === name);
    return {
      id: campaign?.id ?? "chat-brand",
      kind: "brand",
      name,
      initials: name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      city: campaign?.city ?? (liveSession ? "Not added" : "Mumbai"),
      state: liveSession ? "" : "Maharashtra",
      niche: campaign?.category ?? (liveSession ? "Not added" : "Brand collaborations"),
      followers: campaign ? `${campaigns.filter((item) => item.brand === name).length} campaigns` : (liveSession ? "Not added" : "12 campaigns"),
      price: campaign?.budget ?? (liveSession ? "Not added" : "Flexible budget"),
      rating: liveSession ? 0 : 4.8,
      reviews: liveSession ? 0 : 32,
      platforms: liveSession ? [] : ["Instagram", "LinkedIn"],
    };
  };
  const changeTab = (tab: TabName) => {
    if (
      (role === "Brand" && (tab === "Studio" || tab === "Market" || tab === "Proposals")) ||
      (role === "Influencer" && (tab === "Campaigns" || tab === "Budget"))
    ) {
      setActiveTab("Home");
      return;
    }
    setDetail(null);
    setUtilityPage(null);
    setActiveTab(tab);
  };
  const toggleTodoTask = (id: string) => {
    const task = todoTasks.find((item) => item.id === id);
    if (!task) return;
    if (persistedAuth.userId) {
      // Ignore a second tap until the first completion PATCH has settled.
      // This keeps a fast double-tap from enqueueing an unintended reopen.
      if (taskMutationQueues.current.has(id)) return;
      const completed = !task.completed;
      const scheduled = taskReminderSchedules.current.get(id);
      if (scheduled) {
        void cancelReminderSeries(id, scheduled.notificationIds).catch(() => undefined);
        taskReminderSchedules.current.delete(id);
      }
      updateTodoTask(id, {
        completed,
        reminderEnabled: completed ? false : task.reminderEnabled,
        reminderAt: completed ? null : task.reminderAt,
        reminderStatus: completed ? "STOPPED" : "NONE",
        reminderNotificationId: undefined,
      });
      return;
    }
    void cancelReminderSeries(task.id, taskReminderSchedules.current.get(task.id)?.notificationIds ?? []).catch(() => undefined);
    const completed = !task.completed;
    updateTodoTaskInStore(id, { completed, reminderNotificationId: undefined });
    if (!completed) scheduleTaskReminder({ ...task, completed, reminderNotificationId: undefined }, true);
  };
  const hasRemoteStudio = Boolean(persistedAuth.userId && persistedAuth.role === "creator");
  const addContentIdea = (idea: Omit<ContentIdea, "id">) => {
    if (!hasRemoteStudio) {
      addIdeaLocal(idea);
      showToast("Idea saved to your studio");
      return;
    }
    setStudioSaving(true);
    const { projectId: _projectId, notes: _notes, ...remoteIdea } = idea;
    void createRemoteStudioIdea(remoteIdea).then((saved) => {
      dispatch(replaceStudioIdea(saved));
      showToast("Idea saved to your studio", "success");
    }).catch((error) => showToast(error instanceof Error ? error.message : "Idea could not be saved", "error"))
      .finally(() => setStudioSaving(false));
  };
  const updateContentIdea = (id: string, changes: Partial<Omit<ContentIdea, "id">>) => {
    if (!hasRemoteStudio) {
      updateIdeaLocal(id, changes);
      return;
    }
    setStudioSaving(true);
    const { projectId: _projectId, notes, ...remoteChanges } = changes;
    void updateRemoteStudioIdea(id, { ...remoteChanges, ...(notes !== undefined ? { notes } : {}) }).then((saved) => {
      dispatch(replaceStudioIdea(saved));
      showToast("Idea updated", "success");
    }).catch((error) => showToast(error instanceof Error ? error.message : "Idea could not be updated", "error"))
      .finally(() => setStudioSaving(false));
  };
  const archiveContentIdea = (id: string, archived: boolean) => {
    if (!hasRemoteStudio) {
      (archived ? archiveIdeaLocal : unarchiveIdeaLocal)(id);
      return;
    }
    setStudioSaving(true);
    void updateRemoteStudioIdea(id, { archived }).then((saved) => {
      dispatch(replaceStudioIdea(saved));
      showToast(archived ? "Idea archived" : "Idea restored", "success");
    }).catch((error) => showToast(error instanceof Error ? error.message : "Idea could not be updated", "error"))
      .finally(() => setStudioSaving(false));
  };
  const addStudioNote = (id: string, text: string) => {
    if (!hasRemoteStudio) {
      addIdeaNoteLocal(id, text);
      return;
    }
    setStudioSaving(true);
    void addRemoteStudioNote(id, text).then((saved) => dispatch(replaceStudioIdea(saved)))
      .catch((error) => showToast(error instanceof Error ? error.message : "Note could not be saved", "error"))
      .finally(() => setStudioSaving(false));
  };
  const updateStudioNote = (id: string, noteId: string, text: string) => {
    if (!hasRemoteStudio) {
      updateIdeaNoteLocal(id, noteId, text);
      return;
    }
    setStudioSaving(true);
    void updateRemoteStudioNote(id, noteId, text).then((saved) => dispatch(replaceStudioIdea(saved)))
      .catch((error) => showToast(error instanceof Error ? error.message : "Note could not be updated", "error"))
      .finally(() => setStudioSaving(false));
  };
  const removeStudioNote = (id: string, noteId: string) => {
    if (!hasRemoteStudio) {
      removeIdeaNoteLocal(id, noteId);
      return;
    }
    setStudioSaving(true);
    void removeRemoteStudioNote(id, noteId).then((saved) => dispatch(replaceStudioIdea(saved)))
      .catch((error) => showToast(error instanceof Error ? error.message : "Note could not be removed", "error"))
      .finally(() => setStudioSaving(false));
  };
  const createStudioProject = (ideaId: string) => {
    if (!hasRemoteStudio) {
      createProjectFromIdeaLocal(ideaId);
      return;
    }
    setStudioSaving(true);
    void createRemoteStudioProject(ideaId).then((saved) => {
      dispatch(replaceStudioProject(saved));
      showToast("Project workflow created", "success");
    }).catch((error) => showToast(error instanceof Error ? error.message : "Project could not be created", "error"))
      .finally(() => setStudioSaving(false));
  };
  const saveStudioStageDraft = (id: string, stage: ProductionStage, data: ProductionStagePayload) => {
    if (!hasRemoteStudio) {
      saveProductionStageDraftLocal(id, stage, data);
      return;
    }
    setStudioSaving(true);
    void updateRemoteStudioStage(id, stage, data, false).then((saved) => dispatch(replaceStudioProject(saved)))
      .catch((error) => showToast(error instanceof Error ? error.message : "Stage draft could not be saved", "error"))
      .finally(() => setStudioSaving(false));
  };
  const completeStudioStage = (id: string, stage: ProductionStage, data: ProductionStagePayload) => {
    if (!hasRemoteStudio) {
      completeProductionStageLocal(id, stage, data);
      return;
    }
    setStudioSaving(true);
    void updateRemoteStudioStage(id, stage, data, true).then((saved) => dispatch(replaceStudioProject(saved)))
      .catch((error) => showToast(error instanceof Error ? error.message : "Stage could not be completed", "error"))
      .finally(() => setStudioSaving(false));
  };
  const updateStudioProject = (id: string, changes: Partial<Omit<ProductionProject, "id" | "ideaId" | "workflowSteps" | "stageData" | "validationErrors" | "currentStage" | "createdAt">>) => {
    if (!hasRemoteStudio) {
      updateProductionProjectLocal(id, changes);
      return;
    }
    setStudioSaving(true);
    void updateRemoteStudioProject(id, { dueDate: changes.dueDate, assignedTo: changes.assignedTo, archived: changes.archived }).then((saved) => dispatch(replaceStudioProject(saved)))
      .catch((error) => showToast(error instanceof Error ? error.message : "Project details could not be saved", "error"))
      .finally(() => setStudioSaving(false));
  };
  const openCalendar = () => {
    setDetail(null);
    setUtilityPage(null);
    setActiveTab("Calendar");
  };
  const openNewCreatorTask = () => {
    setDetail(null);
    setUtilityPage(null);
    setOpenCalendarComposer(true);
    setActiveTab("Calendar");
  };
  const setChromeVisible = (visible: boolean) => {
    if (chromeVisible.current === visible) return;
    chromeVisible.current = visible;
    Animated.parallel([
      Animated.timing(chromeProgress, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
      }),
      Animated.timing(chromeLayoutProgress, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start();
  };
  const runBack = (callback: () => void) => {
    if (backLocked.current) return;
    backLocked.current = true;
    callback();
    setTimeout(() => {
      backLocked.current = false;
    }, 450);
  };
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = offsetY - lastScrollY.current;
    lastScrollY.current = offsetY;
    if (offsetY < 12 || delta < -3) setChromeVisible(true);
    else if (delta > 5) setChromeVisible(false);
  };
  const returnFromChat = (returnTo: ChatReturn) => {
    setDetail(null);
    if (returnTo.type === "utility") {
      setUtilityPage(returnTo.page);
      return;
    }
    if (returnTo.type === "proposal") {
      setUtilityPage(null);
      setDetail({ type: "proposal", value: returnTo.value });
      return;
    }
    setUtilityPage(null);
    setActiveTab(returnTo.tab);
  };
  useEffect(() => {
    lastScrollY.current = 0;
    setChromeVisible(true);
  }, [activeTab, detail, utilityPage]);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (detail) {
          if (backLocked.current) return true;
          runBack(() => {
            if (detail.type === "chat") returnFromChat(detail.returnTo);
            else setDetail(null);
          });
          return true;
        }
        if (utilityPage) {
          runBack(() => setUtilityPage(null));
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [detail, utilityPage]);
  useEffect(() => {
    const timer = setTimeout(() => setIsSplashVisible(false), 1100);
    return () => clearTimeout(timer);
  }, []);
  const applyRemoteUser = (user: ApiUser) => {
    const nextRole = user.role === "CREATOR" ? "Influencer" : "Brand";
    const remoteSocialAccounts = Array.isArray(user.socialAccounts) ? user.socialAccounts : [];
    const remoteProfile = user.profile;
    const remoteLanguages = Array.isArray(remoteProfile?.languages)
      ? remoteProfile.languages.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
      : [];
    const remoteLocations = Array.isArray(remoteProfile?.locations)
      ? remoteProfile.locations.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
      : [];
    setRole(nextRole);
    dispatch(setStoreRole(user.role === "CREATOR" ? "creator" : "brand"));
    dispatch(setSignupRole(user.role === "CREATOR" ? "Influencer" : "Brand"));
    dispatch(setUserIdentity({ userId: user.id, email: user.email ?? undefined, phone: user.phone ?? undefined, authSource: "remote" }));
    dispatch(setVerification({ phoneVerified: user.phoneVerified, emailVerified: user.emailVerified }));
    dispatch(setProfile(mapRemoteUserProfile(user)));
    updateCreatorLocations(remoteLocations);
    dispatch(setOnboardingComplete(user.onboardingComplete));
    setProfileIsPublic(remoteProfile?.visibility === "PUBLIC");
    const accounts: SocialAccountMap = {};
    remoteSocialAccounts.forEach((account) => {
      if (AUTH_SOCIAL_PLATFORMS.includes(account.platform as SocialPlatform)) {
        if (typeof account.handle === "string" && account.handle.trim()) {
          accounts[account.platform as SocialPlatform] = account.handle;
        }
      }
    });
    setSocialAccounts(accounts);
    setSocialAccountErrors(Object.fromEntries(remoteSocialAccounts.filter((account) => account.syncStatus === "FAILED").map((account) => [account.platform, account.syncError || "Automatic verification failed. Our team will review this social account soon."])) as Partial<Record<SocialPlatform, string>>);
    setVerifiedSocialAccounts(
      remoteSocialAccounts
        .filter((account) => account.verificationStatus === "VERIFIED")
        .map((account) => account.platform as SocialPlatform)
        .filter((platform) => AUTH_SOCIAL_PLATFORMS.includes(platform)),
    );
    setPendingSocialAccounts(
      remoteSocialAccounts
        .filter((account) => account.verificationStatus === "PENDING" && account.syncStatus !== "FAILED")
        .map((account) => account.platform as SocialPlatform)
        .filter((platform) => AUTH_SOCIAL_PLATFORMS.includes(platform)),
    );
    const remoteStep = user.onboardingStep ?? "profile";
    const signupStep = remoteStep === "details"
      ? "details"
      : remoteStep === "social"
        ? "social"
        : remoteStep === "verifying"
          ? "verifying"
          : remoteStep === "review"
            ? "review"
            : remoteStep === "success" || user.onboardingComplete
              ? "success"
              : "profile";
    dispatch(setSignupStep(signupStep));
    dispatch(setSignupProfile({
      displayName: nextRole === "Influencer" ? remoteProfile?.displayName ?? "" : "",
      bio: nextRole === "Influencer" ? remoteProfile?.bio ?? "" : "",
      niche: nextRole === "Influencer" ? remoteProfile?.focus ?? "" : "",
      brandName: nextRole === "Brand" ? remoteProfile?.displayName ?? "" : "",
      industry: nextRole === "Brand" ? remoteProfile?.focus ?? "" : "",
      brandBio: nextRole === "Brand" ? remoteProfile?.bio ?? "" : "",
      brandBudget: nextRole === "Brand" ? remoteProfile?.rateRange ?? "" : "",
      website: remoteProfile?.websiteUrl ?? "",
      location: remoteProfile?.city ?? "",
      audienceLocations: remoteLocations,
      audienceSize: typeof remoteProfile?.audienceSize === "string" ? remoteProfile.audienceSize : "",
      rate: nextRole === "Influencer" && typeof remoteProfile?.rateRange === "string" ? remoteProfile.rateRange : "",
      teamSize: typeof remoteProfile?.teamSize === "string" ? remoteProfile.teamSize : "",
      languages: remoteLanguages.length ? remoteLanguages : ["English"],
      profileImageUri: remoteProfile?.avatarUrl ?? null,
      instagramUrl: accounts.Instagram ?? "",
      youtubeUrl: accounts.YouTube ?? "",
      twitterUrl: accounts.X ?? "",
      linkedinUrl: accounts.LinkedIn ?? "",
      socialAccounts: accounts,
    }));
    setIsInDemo(true);
    setIsOnboarding(!user.onboardingComplete);
  };
  applyRemoteUserRef.current = applyRemoteUser;
  const saveOnboardingProgress = (progress: OnboardingProgress) => {
    const save = async () => {
      if (progress.profile.name.trim().length < 2) return;
      const avatarUrl = progress.profile.avatarUri?.trim();
      const websiteUrl = progress.profile.websiteUrl?.trim();
      await updateRemoteProfile({
        displayName: progress.profile.name.trim(),
        bio: progress.profile.bio.trim(),
        city: progress.profile.city.trim(),
        focus: progress.profile.focus.trim(),
        ...(avatarUrl ? { avatarUrl } : {}),
        ...(websiteUrl && /^https?:\/\//i.test(websiteUrl) ? { websiteUrl } : {}),
        ...(progress.profile.audienceSize ? { audienceSize: progress.profile.audienceSize } : {}),
        ...(progress.profile.rateRange ? { rateRange: progress.profile.rateRange } : {}),
        ...(progress.profile.teamSize ? { teamSize: progress.profile.teamSize } : {}),
        visibility: progress.profile.isPublic ? "PUBLIC" : "PRIVATE",
        languages: progress.languages,
        locations: progress.locations,
        onboardingStep: progress.onboardingStep,
      });
    };
    const request = onboardingProgressSaveQueue.current.then(save, save);
    onboardingProgressSaveQueue.current = request.catch(() => undefined);
    return request;
  };
  const resetToAuth = useCallback((message?: string) => {
    reminderSigningOut.current = true;
    remoteSnapshotOwnerRef.current = undefined;
    void setReminderOwner(null).catch(() => undefined);
    for (const [taskId, scheduled] of taskReminderSchedules.current) {
      void cancelReminderSeries(taskId, scheduled.notificationIds).catch(() => undefined);
    }
    taskReminderSchedules.current.clear();
    remotePushToken.current = null;
    localReminderCapabilityRegistered.current = false;
    dispatch(clearSession());
    setRemoteTodoTasks([]);
    remoteTaskCache.current.clear();
    remoteTaskRequests.current.clear();
    taskMutationVersions.current.clear();
    taskMutationQueues.current.clear();
    setDetail(null);
    setUtilityPage(null);
    setActiveTab("Home");
    setIsOnboarding(false);
    setIsInDemo(false);
    setRealCampaignsReady(false);
    if (message) showToast(message);
  }, [dispatch, showToast]);
  useEffect(() => {
    setSessionExpiredHandler((reason) => resetToAuth(reason ? `Your account is suspended: ${reason}` : "Your session expired. Please sign in again."));
    return () => setSessionExpiredHandler(null);
  }, [resetToAuth]);
  useEffect(() => {
    if (adminThemePreview) { setAuthRestorePending(false); return; }
    if (!mobileStoreHydrated) return;
    let active = true;
    void restoreSession()
      .then((user) => {
        if (!active) return;
        if (user) {
          applyRemoteUser(user);
        } else {
          // The API is the source of truth after reload; never resurrect a local onboarding draft.
          dispatch(clearSession());
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setAuthRestorePending(false);
      });
    return () => { active = false; };
  }, [adminThemePreview, mobileStoreHydrated]);
  useEffect(() => {
    if (authRestorePending) return;
    if (!persistedAuth.userId || persistedAuth.role !== "creator") {
      dispatch(clearStudio());
      setStudioLoading(false);
      return;
    }
    let active = true;
    setStudioLoading(true);
    void getRemoteStudio()
      .then((snapshot) => {
        if (active) dispatch(hydrateStudio(snapshot));
      })
      .catch((error) => {
        if (!active) return;
        dispatch(clearStudio());
        showToast(error instanceof Error ? error.message : "Studio could not be loaded", "error");
      })
      .finally(() => {
        if (active) setStudioLoading(false);
      });
    return () => { active = false; };
  }, [authRestorePending, dispatch, persistedAuth.role, persistedAuth.userId, showToast]);
  useEffect(() => {
    if (authRestorePending) return;
    if (!persistedAuth.userId) {
      dispatch(resetCampaignMarketplace());
      setCampaignMatches({});
      setRealCampaignsReady(false);
      return;
    }
    let active = true;
    setRealCampaignsReady(false);
    dispatch(hydrateCampaignMarketplace({ campaigns: [], applications: [] }));
    void getRemoteCampaigns()
      .then((snapshot) => {
        if (!active) return;
        dispatch(hydrateCampaignMarketplace(snapshot));
        setRealCampaignsReady(true);
      })
      .catch((error) => {
        if (!active) return;
        dispatch(hydrateCampaignMarketplace({ campaigns: [], applications: [] }));
        setRealCampaignsReady(true);
        showToast(error instanceof Error ? error.message : "Campaigns could not be loaded", "error");
      });
    return () => { active = false; };
  }, [authRestorePending, dispatch, persistedAuth.userId, showToast]);
  useEffect(() => {
    if (authRestorePending) return;
    const ownerChanged = chatOwnerRef.current !== persistedAuth.userId;
    chatOwnerRef.current = persistedAuth.userId;
    if (!persistedAuth.userId) {
      dispatch(hydrateMarketplaceConversations([]));
      setRemoteChatSnapshots({});
      setAdminChatConversation(null); setAdminChatSnapshot(null);
      setChatTyping({});
      chatListSyncedAt.current.clear();
      return;
    }
    if (ownerChanged) { dispatch(hydrateMarketplaceConversations([])); setRemoteChatSnapshots({}); setAdminChatConversation(null); setAdminChatSnapshot(null); setChatTyping({}); chatListSyncedAt.current.clear(); }
    void loadChatList("", false, true);
    return () => { chatListRequest.current += 1; };
  }, [authRestorePending, dispatch, persistedAuth.userId, loadChatList]);
  useEffect(() => {
    if (utilityPage !== "Chats" || !persistedAuth.userId) return;
    const timer = setTimeout(() => void loadChatList(chatSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [chatSearch, utilityPage, persistedAuth.userId, loadChatList]);
  useEffect(() => {
    if (authRestorePending || !persistedAuth.userId || !detail || detail.type !== "chat" || detail.adminChat || !activeApplicationIdForEffects || !isUuid(activeApplicationIdForEffects)) return;
    setChatCampaignsRequested(false);
    void loadChatHistory(activeApplicationIdForEffects);
  }, [activeApplicationIdForEffects, authRestorePending, detail?.type, persistedAuth.userId, loadChatHistory]);
  useEffect(() => {
    if (authRestorePending || !persistedAuth.userId || !detail || detail.type !== "chat" || !detail.adminChat || !detail.conversationId) return;
    setChatCampaignsRequested(false);
    void loadAdminChatHistory(detail.conversationId);
    void heartbeatRemoteAdminChat(detail.conversationId).catch(() => undefined);
    const timer = setInterval(() => void heartbeatRemoteAdminChat(detail.conversationId!).catch(() => undefined), 30_000);
    return () => clearInterval(timer);
  }, [authRestorePending, detail, persistedAuth.userId, loadAdminChatHistory]);
  useEffect(() => {
    if (authRestorePending || !persistedAuth.userId) return;
    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectAttempts = 0;
    let connectedOnce = false;
    let connecting = false;
    const retry = () => {
      if (active && AppState.currentState === "active" && !reconnectTimer) reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        void connect();
      }, Math.min(60_000, 4_000 * 2 ** Math.min(reconnectAttempts++, 4)));
    };
    const connect = async () => {
      if (connecting || socket || !active || AppState.currentState !== "active") return;
      connecting = true;
      const url = await getChatSocketUrl().catch(() => null);
      connecting = false;
      if (!active || AppState.currentState !== "active") return;
      if (!url) { retry(); return; }
      try { socket = new WebSocket(url); } catch { retry(); return; }
      const connectedSocket = socket;
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as {
            type?: string;
            channel?: string;
            conversationId?: string;
            applicationId?: string;
            campaignId?: string;
            userId?: string;
            online?: boolean;
            typing?: boolean;
            readerId?: string;
            reason?: string;
            message?: RemoteChatMessage;
            messageId?: string;
            status?: string;
          };
          if (payload.type === "account.suspended") {
            resetToAuth(payload.reason ? `Your account is suspended: ${payload.reason}` : "Your account has been suspended. Please sign in to request a review.");
            connectedSocket.close();
            return;
          }
          if (payload.type === "ready") {
            reconnectAttempts = 0;
            if (connectedOnce) {
              void loadChatList("", false, true);
              void getRemoteCampaigns().then((snapshot) => dispatch(hydrateCampaignMarketplace(snapshot))).catch(() => undefined);
              if (activeChatIdRef.current) void loadChatHistory(activeChatIdRef.current, undefined, true);
            }
            connectedOnce = true;
            return;
          }
          if (payload.type === "campaign.application.created" || payload.type === "campaign.application.updated") {
            if (payload.applicationId && !mutedChatIdsRef.current.has(payload.applicationId) && activeChatIdRef.current !== payload.applicationId && activeChatIdRef.current !== payload.conversationId) {
              const id = `chat-update-${payload.applicationId}-${payload.status ?? "new"}`;
              setNotifications((current) => current.some((item) => item.id === id) ? current : [{
                id,
                icon: "chatbubble-ellipses-outline",
                title: payload.type === "campaign.application.created" ? "New collaboration request" : `Application ${payload.status?.toLowerCase() ?? "updated"}`,
                body: "Open the chat to review this collaboration update.",
                time: "Now",
                read: false,
                category: "messages",
                applicationId: payload.applicationId,
                conversationId: payload.conversationId,
              }, ...current]);
            }
            void getRemoteCampaigns().then((snapshot) => dispatch(hydrateCampaignMarketplace(snapshot))).catch(() => undefined);
            void loadChatList("", false, true);
            return;
          }
          const applicationId = payload.conversationId;
          if (!applicationId) return;
          if (payload.channel === "ADMIN_CHAT") {
            if (payload.type === "presence" && typeof payload.online === "boolean") {
              setAdminChatConversation((current) => current?.id === applicationId ? { ...current, online: payload.online as boolean } : current);
              setAdminChatSnapshot((current) => current?.conversationId === applicationId ? { ...current, online: payload.online as boolean } : current);
            }
          if (payload.type === "message.created" && payload.message) {
              const remoteMessage = payload.message as unknown as RemoteAdminChatMessage;
              const next = mapRemoteAdminChatMessage(remoteMessage);
              setAdminChatSnapshot((current) => current?.conversationId === applicationId && !current.messages.some((item) => item.id === next.id)
                ? { ...current, messages: [...current.messages, remoteMessage] }
                : current);
              const active = activeChatIdRef.current === applicationId;
              setAdminChatConversation((current) => current?.id === applicationId ? { ...current, preview: next.text, updatedAt: next.createdAt ?? new Date().toISOString(), unreadCount: active || next.mine ? 0 : (current.unreadCount ?? 0) + 1 } : current);
              if (active && !next.mine) void markRemoteAdminChatRead(applicationId).catch(() => undefined);
              if (!active && !next.mine) {
                const id = `admin-chat-${next.id}`;
                setNotifications((current) => current.some((item) => item.id === id) ? current : [{ id, icon: "chatbubble-ellipses-outline", title: "Brandly", body: next.text, time: next.time, read: false, category: "messages", conversationId: applicationId, adminChat: true }, ...current]);
              }
            }
            if (payload.type === "conversation.read" && payload.readerId !== persistedAuth.userId) {
              setAdminChatSnapshot((current) => current?.conversationId === applicationId ? { ...current, messages: current.messages.map((item) => item.mine ? { ...item, status: "seen", readAt: new Date().toISOString() } : item) } : current);
            }
            void loadChatList("", false, true);
            return;
          }
          if (payload.type === "presence" && typeof payload.online === "boolean") {
            setRemoteChatSnapshots((current) => {
              const snapshot = current[applicationId];
              if (!snapshot) return current;
              return { ...current, [applicationId]: { ...snapshot, participant: { ...snapshot.participant, online: payload.online as boolean } } };
            });
            return;
          }
          if (payload.type === "typing" && typeof payload.typing === "boolean") {
            setChatTyping((current) => ({ ...current, [applicationId]: payload.typing as boolean }));
            if (payload.typing) setTimeout(() => setChatTyping((current) => current[applicationId] ? { ...current, [applicationId]: false } : current), 4_000);
            return;
          }
          if (payload.type === "message.created" && payload.message) {
            const next = mapRemoteChatMessage(payload.message);
            if (!chatCacheRef.current.some((item) => item.id === applicationId)) {
              void loadChatList("", false, true).then(() => {
                if (!active) return;
                dispatch(addMarketplaceMessageAction({ conversationId: applicationId, message: next }));
                if (activeChatIdRef.current === applicationId) dispatch(markMarketplaceConversationRead(applicationId));
              }).catch(() => undefined);
            }
            if (next.campaignRequestId) void getRemoteCampaigns().then((snapshot) => dispatch(hydrateCampaignMarketplace(snapshot))).catch(() => undefined);
            if (next.taskId) void loadRemoteTasks({}, true).catch(() => undefined);
            dispatch(addMarketplaceMessageAction({ conversationId: applicationId, message: next }));
            setRemoteChatSnapshots((current) => {
              const snapshot = current[applicationId];
              if (!snapshot) return current;
              return {
                ...current,
                [applicationId]: {
                  ...snapshot,
                  status: "Accepted",
                  messages: mergeRemoteChatMessage(snapshot.messages, next),
                },
              };
            });
            if (activeChatIdRef.current === applicationId) {
              dispatch(markMarketplaceConversationRead(applicationId));
              void markRemoteChatRead(applicationId).catch(() => undefined);
            } else if (!mutedChatIdsRef.current.has(applicationId)) {
              const id = `chat-message-${next.id}`;
              setNotifications((current) => current.some((item) => item.id === id) ? current : [{
                id,
                icon: "chatbubble-ellipses-outline",
                title: "New message",
                body: next.text || "You received a new collaboration message.",
                time: "Now",
                read: false,
                category: "messages",
                applicationId,
                conversationId: applicationId,
              }, ...current]);
            }
            return;
          }
          if (payload.type === "message.updated" && payload.message) {
            const next = mapRemoteChatMessage(payload.message);
            dispatch(updateMarketplaceMessageAction({ conversationId: applicationId, messageId: next.id, changes: next }));
            setRemoteChatSnapshots((current) => {
              const snapshot = current[applicationId];
              if (!snapshot) return current;
              return { ...current, [applicationId]: { ...snapshot, messages: mergeRemoteChatMessage(snapshot.messages, next) } };
            });
            return;
          }
          if (payload.type === "message.deleted" && payload.messageId) {
            const changes = { deleted: true, text: "This message was deleted", attachments: [], attachmentName: undefined, replyTo: undefined, taskId: undefined, campaignRequestId: undefined, videoBriefId: undefined };
            dispatch(updateMarketplaceMessageAction({ conversationId: applicationId, messageId: payload.messageId, changes }));
            setRemoteChatSnapshots((current) => {
              const snapshot = current[applicationId];
              if (!snapshot) return current;
              return { ...current, [applicationId]: { ...snapshot, messages: snapshot.messages.map((message) => message.id === payload.messageId ? { ...message, ...changes } : message) } };
            });
            return;
          }
          if (payload.type === "conversation.read" && payload.readerId) {
            for (const message of chatCacheRef.current.find((item) => item.id === applicationId)?.messages ?? []) {
              if (message.senderId !== payload.readerId) dispatch(updateMarketplaceMessageAction({ conversationId: applicationId, messageId: message.id, changes: { status: "seen" } }));
            }
            setRemoteChatSnapshots((current) => {
              const snapshot = current[applicationId];
              if (!snapshot) return current;
              return { ...current, [applicationId]: { ...snapshot, messages: snapshot.messages.map((message) => message.mine ? { ...message, status: "seen" } : message) } };
            });
          }
        } catch {
          // Ignore malformed realtime frames; the next REST refresh remains authoritative.
        }
      };
      socket.onclose = () => {
        if (socket === connectedSocket) socket = null;
        retry();
      };
      socket.onerror = () => connectedSocket.close();
    };
    void connect();
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = undefined; }
      if (state === "active") { if (!socket) void connect(); }
      else socket?.close();
    });
    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      appStateSubscription.remove();
      socket?.close();
      socket = null;
    };
  }, [authRestorePending, persistedAuth.userId, loadChatList, loadChatHistory, resetToAuth]);
  useEffect(() => {
    if (authRestorePending || !persistedAuth.userId) return;
    const heartbeat = () => {
      if (AppState.currentState !== "active") return;
      const applicationId = activeChatIdRef.current;
      void sendChatPresenceHeartbeat(applicationId && /^\w{8}-\w{4}-[1-5]\w{3}-[89ab]\w{3}-\w{12}$/i.test(applicationId) ? applicationId : undefined).catch(() => undefined);
    };
    heartbeat();
    const interval = setInterval(heartbeat, 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") heartbeat();
      else void markChatOffline().catch(() => undefined);
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
      void markChatOffline().catch(() => undefined);
    };
  }, [activeApplicationIdForEffects, authRestorePending, persistedAuth.userId]);
  useEffect(() => {
    if (authRestorePending) return;
    if (!persistedAuth.userId) {
      for (const [id, schedule] of taskReminderSchedules.current) void cancelReminderSeries(id, schedule.notificationIds);
      taskReminderSchedules.current.clear();
      setRemoteTodoTasks([]);
      remoteTaskCache.current.clear();
      remoteTaskRequests.current.clear();
      taskMutationVersions.current.clear();
      taskMutationQueues.current.clear();
      return;
    }
    reminderSigningOut.current = false;
    remoteSnapshotOwnerRef.current = undefined;
    let active = true;
    setRemoteTodoTasks([]);
    void (async () => {
      setRemoteSnapshotReady(false);
      const owner = persistedAuth.userId;
      const cached = await AsyncStorage.getItem(`brandly.remote-tasks:${owner}`);
      if (cached && active && reminderOwnerRef.current === owner) {
        remoteTasksOwnerRef.current = owner;
        try { mergeRemoteTasks(JSON.parse(cached)); } catch { /* Ignore invalid cache, retain OS alarms. */ }
      }
      await loadRemoteTasks({}, true);
    })()
      .then(() => undefined)
      .catch(() => { if (active) showToast("Tasks could not be loaded. Pull to retry."); });
    return () => { active = false; };
  }, [authRestorePending, persistedAuth.userId, showToast]);
  useEffect(() => {
    if (!persistedAuth.userId || authRestorePending) return;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      void restoreSession(10_000, false)
        .then((user) => {
          if (user) applyRemoteUserRef.current?.(user);
        })
        .catch(() => undefined);
      void getRemoteCampaigns().then((snapshot) => dispatch(hydrateCampaignMarketplace(snapshot))).catch(() => undefined);
      void loadChatList();
      if (persistedAuth.role === "creator") {
        void getRemoteStudio().then((snapshot) => dispatch(hydrateStudio(snapshot))).catch(() => undefined);
      }
      void loadRemoteTasks({}, true).catch(() => undefined);
      void hasReminderNotificationPermission().then((granted) => {
        if (granted) void registerPushDeviceForUser();
      }).catch(() => undefined);
    });
    return () => subscription.remove();
  }, [authRestorePending, dispatch, loadChatList, persistedAuth.role, persistedAuth.userId, registerPushDeviceForUser]);
  useEffect(() => {
    void registerPushDeviceForUser();
  }, [registerPushDeviceForUser]);
  useEffect(() => {
    if (adminThemePreview) return;
    if (!persistedAuth.userId) {
      notificationRequestId.current += 1;
      setNotifications(DEFAULT_NOTIFICATIONS);
      setNotificationLoading(false);
      setNotificationError("");
      return;
    }
    setNotifications([]);
    void loadRemoteNotifications();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void loadRemoteNotifications();
    });
    return () => { notificationRequestId.current += 1; subscription.remove(); };
  }, [adminThemePreview, loadRemoteNotifications, persistedAuth.userId]);
  const openNotificationTarget = (target: { taskId?: string; reminderId?: string; applicationId?: string; conversationId?: string; adminChat?: boolean; socialPlatform?: string; verificationStatus?: string }) => {
    if (target.adminChat && target.conversationId) {
      pendingNotificationRoute.current = null;
      setUtilityPage(null);
      setDetail({ type: "chat", name: "Brandly", initials: "B", conversationId: target.conversationId, conversationStatus: "Accepted", adminChat: true, returnTo: { type: "utility", page: "Chats" } });
      return;
    }
    if (target.socialPlatform) {
      pendingNotificationRoute.current = null;
      setUtilityPage(null);
      setActiveTab("Profile");
      setDetail({ type: "flow", flow: "social-accounts" });
      showToast(target.verificationStatus === "VERIFIED" ? `${target.socialPlatform} is verified.` : `${target.socialPlatform} needs an update. Check your social accounts.`);
      return;
    }
    const applicationId = target.applicationId?.trim();
    if (applicationId) {
      const application = applications.find((item) => item.id === applicationId);
      if (application) {
        pendingNotificationRoute.current = null;
        openMarketplaceChat({ application: target.conversationId ? { ...application, conversationId: target.conversationId } : application, messageMine: false }, { type: "utility", page: "Chats" });
        return;
      }
      pendingNotificationRoute.current = { applicationId, conversationId: target.conversationId };
      setDetail(null);
      setUtilityPage("Chats");
      if (!persistedAuth.userId) return;
      void getRemoteCampaigns().then((snapshot) => {
        dispatch(hydrateCampaignMarketplace(snapshot));
        const next = snapshot.applications.find((item) => item.id === applicationId);
        if (next) {
          pendingNotificationRoute.current = null;
          openMarketplaceChat({ application: target.conversationId ? { ...next, conversationId: target.conversationId } : next, messageMine: false }, { type: "utility", page: "Chats" });
        }
      }).catch(() => showToast("This chat could not be opened right now."));
      return;
    }
    const taskId = target.taskId?.trim();
    const reminderId = target.reminderId?.trim();
    if (taskId) {
      const openTask = (id: string) => {
        pendingNotificationRoute.current = null;
        setUtilityPage(null);
        setActiveTab("Calendar");
        setDetail({ type: "todo", taskId: id });
      };
      if (todoTasks.some((task) => task.id === taskId)) {
        openTask(taskId);
        return;
      }
      // Notification taps can arrive before the cold-start task snapshot.
      // Keep the exact target while the authoritative list is loaded.
      pendingNotificationRoute.current = { taskId };
      setUtilityPage(null);
      setActiveTab("Calendar");
      if (!persistedAuth.userId) return;
      void loadRemoteTasks({}, true).then((items) => {
        if (items?.some((task) => task.id === taskId)) openTask(taskId);
        else {
          pendingNotificationRoute.current = null;
          setUtilityPage("Notifications");
          showToast("This task is no longer available.");
        }
      }).catch(() => showToast("The task could not be opened right now."));
      return;
    }
    if (reminderId) {
      pendingNotificationRoute.current = null;
      setUtilityPage(null);
      setDetail({ type: "flow", flow: "reminders", reminderId });
    }
  };
  useEffect(() => {
    const target = pendingNotificationRoute.current;
    if (!persistedAuth.userId) return;
    if (target?.applicationId) {
      const application = applications.find((item) => item.id === target.applicationId);
      if (application) {
        pendingNotificationRoute.current = null;
        openMarketplaceChat({ application: target.conversationId ? { ...application, conversationId: target.conversationId } : application, messageMine: false }, { type: "utility", page: "Chats" });
      }
      return;
    }
    if (!target?.taskId) return;
    if (todoTasks.some((task) => task.id === target.taskId)) {
      pendingNotificationRoute.current = null;
      setUtilityPage(null);
      setActiveTab("Calendar");
      setDetail({ type: "todo", taskId: target.taskId });
    }
  }, [persistedAuth.userId, todoTasks]);
  useEffect(() => {
    let active = true;
    let subscription: { remove: () => void } | undefined;
    void getNotificationsModule().then((Notifications) => {
      if (!active || !Notifications) return;
      void configureReminderNotifications().catch(() => undefined);
      subscription = Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data as { type?: string; screen?: string; phase?: string; reminderId?: string; taskId?: string; applicationId?: string; conversationId?: string; adminChat?: string; messageId?: string; event?: string; status?: string; socialPlatform?: string; verificationStatus?: string; mediaUri?: string; mediaName?: string; mediaType?: string } | undefined;
        if (data?.type === "SOCIAL_VERIFICATION") {
          const id = `social-verification-${data.socialPlatform ?? "account"}-${Date.now()}`;
          setNotifications((current) => [{
            id,
            icon: "checkmark-circle-outline",
            title: notification.request.content.title ?? "Social account review updated",
            body: notification.request.content.body ?? "Your social account review has been updated.",
            time: "Now", read: false, category: "profileActivity",
            socialPlatform: data.socialPlatform, verificationStatus: data.verificationStatus,
          }, ...current.filter((item) => item.id !== id)]);
          return;
        }
        const isAdminChat = data?.adminChat === "true";
        const isChat = data?.type === "CHAT_MESSAGE" || data?.screen === "chat" || Boolean(data?.applicationId) || isAdminChat;
        if (isChat) {
          if (data?.type === "CHAT_MESSAGE" && data.applicationId && activeChatIdRef.current === data.applicationId) return;
          const chatTargetId = data?.conversationId ?? data?.applicationId;
          if (chatTargetId && mutedChatIdsRef.current.has(chatTargetId)) return;
          const id = data?.messageId
            ? `chat-message-${data.messageId}`
            : `chat-update-${data?.applicationId ?? Date.now()}-${data?.status ?? data?.event ?? "new"}`;
          setNotifications((current) => current.some((item) => item.id === id) ? current : [
            {
              id,
              icon: "chatbubble-ellipses-outline",
              title: notification.request.content.title ?? "New message",
              body: notification.request.content.body ?? "You have a new collaboration message.",
              time: "Now",
              read: false,
              category: "messages",
              applicationId: data?.applicationId,
              conversationId: data?.conversationId,
              adminChat: isAdminChat,
              mediaUri: data?.mediaUri && /^https:\/\//i.test(data.mediaUri) ? data.mediaUri : undefined,
              mediaName: data?.mediaName,
              mediaType: data?.mediaType === "image" || data?.mediaType === "video" || data?.mediaType === "file" ? data.mediaType : undefined,
            },
            ...current,
          ]);
          return;
        }
        const reminderId = String(data?.reminderId ?? Date.now());
        const upcoming = data?.phase === "upcoming";
        setNotifications((current) => [
          {
            id: `reminder-due-${reminderId}-${Date.now()}`,
            icon: "alarm-outline",
            title: upcoming ? "Upcoming reminder" : "Task reminder",
            body: notification.request.content.body ?? (upcoming ? "A reminder is coming up in 2 minutes." : "A task reminder is due."),
            time: "Now",
            read: false,
            category: "reminders",
            taskId: data?.taskId,
            reminderId: data?.reminderId,
          },
          ...current,
        ]);
      });
    });
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);
  useEffect(() => {
    let active = true;
    let subscription: { remove: () => void } | undefined;
    void getNotificationsModule().then((Notifications) => {
      if (!active || !Notifications) return;
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (data?.type === "SOCIAL_VERIFICATION") {
          if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) openNotificationTarget({
            socialPlatform: typeof data.socialPlatform === "string" ? data.socialPlatform : undefined,
            verificationStatus: typeof data.verificationStatus === "string" ? data.verificationStatus : undefined,
          });
          return;
        }
        const isChat = data?.type === "CHAT_MESSAGE" || data?.screen === "chat" || typeof data?.applicationId === "string";
        if (isChat) {
          if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
            openNotificationTarget({
              applicationId: typeof data?.applicationId === "string" ? data.applicationId : undefined,
              conversationId: typeof data?.conversationId === "string" ? data.conversationId : undefined,
              adminChat: data?.adminChat === "true",
            });
          }
          return;
        }
        const isReminder = data?.type === "delivery-reminder"
          || data?.type === "task-reminder"
          || data?.phase === "upcoming"
          || Boolean(data?.taskId)
          || Boolean(data?.reminderId);
        if (!isReminder) return;
        if (response.actionIdentifier !== DELIVERY_REMINDER_STOP_ACTION
          && response.actionIdentifier !== DELIVERY_REMINDER_SNOOZE_ACTION) {
          if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
            openNotificationTarget({
              taskId: typeof data?.taskId === "string" ? data.taskId : undefined,
              reminderId: typeof data?.reminderId === "string" ? data.reminderId : undefined,
              applicationId: typeof data?.applicationId === "string" ? data.applicationId : undefined,
            });
          }
          return;
        }
        if (data?.type !== "delivery-reminder" && data?.type !== "task-reminder") return;
        void handleReminderNotificationAction(response.notification, response.actionIdentifier)
          .then(async (action) => {
            if (!action) return;
            // The foreground response listener and the Android headless task
            // can receive the same native action. The service makes the
            // mutation idempotent; this guard keeps the UI/toast idempotent as
            // well, so repeated taps cannot create duplicate state changes.
            const actionKey = `${action.reminderId}:${action.handledNotificationId}:${action.changedAt}`;
            if (handledReminderActions.current.has(actionKey)) return;
            handledReminderActions.current.add(actionKey);
            const snoozeMinutes = Math.max(1, Math.round((action.dueAt - action.changedAt) / 60_000));
            const reminder = reminders.find((item) => item.id === action.reminderId);
            if (reminder) updateReminder({
              id: reminder.id, enabled: !action.stopped,
              dueAt: action.dueAt, notificationId: action.notificationId,
            });
            if (action.taskId) setRemoteTodoTasks((current) => current.map((task) => task.id === action.taskId ? {
              ...task, reminderEnabled: !action.stopped,
              reminderAt: action.stopped ? null : new Date(action.dueAt).toISOString(),
              reminderStatus: action.stopped ? "STOPPED" : "PENDING",
              reminderNotificationId: action.notificationId,
            } : task));
            setNotifications((current) => [
              {
                id: `reminder-action-${actionKey}`,
                icon: "alarm-outline",
                title: action.stopped ? "Reminder stopped" : "Reminder snoozed",
                body: action.stopped
                  ? "This task reminder is no longer active."
                  : `Next reminder in ${snoozeMinutes} minute${snoozeMinutes === 1 ? "" : "s"}. The task is still active.`,
                time: "Now",
                read: false,
                category: "reminders",
                taskId: action.taskId,
                reminderId: action.reminderId,
              },
              ...current,
            ]);
            showToast(action.stopped ? "Reminder stopped" : `Reminder snoozed for ${snoozeMinutes} minutes`);
            if (persistedAuth.userId) await syncReminderActions(persistedAuth.userId);
          })
          .catch((error) => showToast(error instanceof Error ? error.message : "Reminder action could not be saved", "error"));
      });
    });
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [loadRemoteTasks, persistedAuth.userId, reminderSettings, reminders, showToast, todoTasks, updateReminder, updateTodoTask]);
  useEffect(() => {
    if (isSplashVisible || isInDemo || !persistedAuth.role || !persistedAuth.onboardingComplete) return;
    setRole(persistedAuth.role === "creator" ? "Influencer" : "Brand");
    setIsInDemo(true);
    setIsOnboarding(false);
  }, [isInDemo, isSplashVisible, persistedAuth.onboardingComplete, persistedAuth.role]);
  useEffect(() => {
    if (persistedAuth.profile?.isPublic !== undefined) {
      setProfileIsPublic(persistedAuth.profile.isPublic);
    }
  }, [persistedAuth.profile?.isPublic]);
  useEffect(() => {
    if (
      (role === "Brand" && (activeTab === "Studio" || activeTab === "Market" || activeTab === "Proposals")) ||
      (role === "Influencer" && (activeTab === "Campaigns" || activeTab === "Budget"))
    ) {
      setActiveTab("Home");
    }
  }, [activeTab, role]);
  useEffect(() => {
    if (!deletionRequest) return;
    const remaining = deletionRequest.expiresAt - Date.now();
    if (remaining <= 0) {
      setDeletionRequest(null);
      setAccountDeletedAt(deletionRequest.expiresAt);
      return;
    }
    const timer = setTimeout(() => {
      setDeletionRequest(null);
      setAccountDeletedAt(deletionRequest.expiresAt);
    }, remaining);
    return () => clearTimeout(timer);
  }, [deletionRequest]);

  const blockedCampaignIds = useMemo(
    () => currentCreator
      ? marketplaceBlocks
          .filter((block) => block.creatorId === currentCreator.id && block.campaignId)
          .map((block) => block.campaignId as string)
      : [],
    [currentCreator, marketplaceBlocks],
  );
  const activeMarketplaceApplication: MarketplaceApplication | undefined =
    detail?.type === "chat" && detail.applicationId
      ? applications.find((application) => application.id === detail.applicationId)
      : undefined;
  const activeMarketplaceConversation =
    detail?.type === "chat" && detail.conversationId
      ? marketplaceConversations.find((conversation) => conversation.id === detail.conversationId)
      : undefined;
  const activeRemoteChatSnapshot = activeChatConversationId
    ? remoteChatSnapshots[activeChatConversationId]
    : undefined;
  const activeAdminChatSnapshot = activeChatConversationId === adminChatSnapshot?.conversationId ? adminChatSnapshot : undefined;
  const activeTodoTask: TodoTask | undefined =
    detail?.type === "todo"
      ? todoTasks.find((task) => task.id === detail.taskId)
      : undefined;
  const activeChatBriefs = useMemo(() => {
    if (detail?.type !== "chat" || !activeMarketplaceConversation) return [];
    return todoTasks.filter((task) =>
      (task.kind === "video-brief" || (!task.kind && Boolean(task.briefId))) &&
      (task.conversationId === activeMarketplaceConversation.id ||
        task.creatorId === activeMarketplaceConversation.creatorId) &&
      (!task.campaignId || !activeMarketplaceConversation.campaignId || task.campaignId === activeMarketplaceConversation.campaignId),
    );
  }, [activeMarketplaceConversation, detail, todoTasks]);
  const sentCampaignIdsForChat = useMemo(
    () => activeMarketplaceConversation || activeRemoteChatSnapshot?.participant.id || activeMarketplaceApplication
      ? applications.filter((application) => application.creatorId === (role === "Brand" ? activeMarketplaceConversation?.creatorId ?? activeRemoteChatSnapshot?.participant.id ?? activeMarketplaceApplication?.creatorId : currentCreator?.id) && application.brandId === (role === "Brand" ? currentBrandId ?? currentActorId : activeMarketplaceConversation?.brandId ?? activeMarketplaceApplication?.brandId ?? activeRemoteChatSnapshot?.participant.id) && application.campaignId && !["Declined", "Blocked", "Withdrawn"].includes(application.status)).map((application) => application.campaignId as string)
      : [],
    [activeMarketplaceApplication, activeMarketplaceConversation, activeRemoteChatSnapshot?.participant.id, applications, currentActorId, currentBrandId, currentCreator?.id, role],
  );
  const chatCampaignCreatorId = activeMarketplaceConversation?.creatorId ?? activeRemoteChatSnapshot?.participant.id ?? activeMarketplaceApplication?.creatorId;
  const campaignMatchTargetId = role === "Brand" && persistedAuth.userId
    ? detail?.type === "influencer"
      ? detail.value.id
      : detail?.type === "profile" && detail.value.kind === "creator"
        ? detail.value.id
      : detail?.type === "chat" && chatCampaignsRequested
        ? chatCampaignCreatorId
        : undefined
    : undefined;
  useEffect(() => {
    if (!campaignMatchTargetId || !isUuid(campaignMatchTargetId)) return;
    const availableCampaigns = brandCampaigns.filter((campaign) => isPublishedCampaign(campaign) && campaign.applicationsOpen !== false && isUuid(campaign.id));
    let active = true;
    setCampaignMatchIdsLoading((current) => ({ ...current, [campaignMatchTargetId]: true }));
    setCampaignMatchIdsByCreator((current) => ({ ...current, [campaignMatchTargetId]: [] }));
    void getRemoteCampaigns(undefined, campaignMatchTargetId).then((snapshot) => {
      if (!active) return;
      const availableIds = new Set(availableCampaigns.map((campaign) => campaign.id));
      setCampaignMatchIdsByCreator((current) => ({
        ...current,
        [campaignMatchTargetId]: snapshot.campaigns.filter((campaign) => availableIds.has(campaign.id)).map((campaign) => campaign.id),
      }));
    }).catch((error) => { if (active) showToast(error instanceof Error ? error.message : "Campaigns could not be loaded", "error"); }).finally(() => {
      if (active) setCampaignMatchIdsLoading((current) => ({ ...current, [campaignMatchTargetId]: false }));
    });
    return () => { active = false; };
  }, [brandCampaigns, campaignMatchTargetId, showToast]);
  const sentTaskIdsForChat = useMemo(
    () => Array.from(new Set([
      ...(activeMarketplaceConversation?.messages ?? []),
      ...(activeRemoteChatSnapshot?.messages ?? []),
    ].flatMap((message) => message.taskId ? [message.taskId] : []))),
    [activeMarketplaceConversation, activeRemoteChatSnapshot],
  );
  const chatUnreadCount = useMemo(
    () => marketplaceConversations.reduce((total, conversation) => total + (conversation.unreadCount ?? 0), 0) + (adminChatConversation?.unreadCount ?? 0),
    [adminChatConversation?.unreadCount, marketplaceConversations],
  );
  const mutedChatNotificationIds = useMemo(
    () => marketplaceConversations.filter((conversation) => conversation.muted).flatMap((conversation) => [conversation.id, conversation.applicationId]),
    [marketplaceConversations],
  );
  mutedChatIdsRef.current = new Set(mutedChatNotificationIds);
  useEffect(() => {
    setMutedChatNotificationConversations(mutedChatNotificationIds);
    return () => setMutedChatNotificationConversations([]);
  }, [mutedChatNotificationIds]);

  const showDiscover = (category?: string) => {
    setMarketFilters((current) => ({ ...current, categories: typeof category === "string" ? [category] : [] }));
    changeTab(role === "Brand" ? "Discover" : "Market");
  };
  const showCampaigns = () => changeTab(role === "Brand" ? "Campaigns" : "Market");
  const toggleBlockedUser = (name: string, userId?: string, nextActive?: boolean, onFailure?: () => void) => {
    const active = nextActive ?? !blockedUsers.includes(name);
    setBlockedUsers((current) => active
      ? [...current, name]
      : current.filter((item) => item !== name));
    if (userId && isUuid(userId)) {
      toggleRemoteProfileInteraction("blocked", userId, () => {
        setBlockedUsers((current) => active
          ? current.filter((item) => item !== name)
          : current.includes(name) ? current : [...current, name]);
        onFailure?.();
      });
    }
  };
  const markNotificationRead = (id: string) => {
    setNotifications((current) => current.map((notification) =>
      notification.id === id ? { ...notification, read: true } : notification,
    ));
    if (persistedAuth.userId && isUuid(id)) void markRemoteNotificationRead(id).catch((error) => {
      setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, read: false } : notification));
      setNotificationError(error instanceof Error ? error.message : "Notification could not be marked as read.");
    });
  };
  const markAllNotificationsRead = () => {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    if (persistedAuth.userId) {
      void Promise.all(notifications.filter((notification) => !notification.read && isUuid(notification.id)).map((notification) => markRemoteNotificationRead(notification.id))).catch(() => {
        setNotifications(notifications);
        setNotificationError("Some notifications could not be marked as read. Refresh and try again.");
      });
    }
  };
  const requestAccountDeletion = () => {
    const requestedAt = Date.now();
    setDeletionRequest({
      requestedAt,
      expiresAt: requestedAt + 14 * 24 * 60 * 60 * 1000,
    });
    setAccountDeletedAt(null);
    setDetail(null);
    setUtilityPage(null);
    setIsOnboarding(false);
    setIsInDemo(false);
    dispatch(clearSession());
  };
  const handleAuthContinue = (
    selectedRole: "Brand" | "Influencer",
    needsOnboarding: boolean,
    isGuest = false,
  ) => {
    if (deletionRequest) {
      if (Date.now() < deletionRequest.expiresAt) {
        setDeletionRequest(null);
        showToast("Account deletion cancelled. Welcome back.");
      } else {
        // The recovery window has passed; this session starts without restoring
        // the deleted account.
        setDeletionRequest(null);
        showToast("The 14-day recovery window has ended.");
      }
    } else if (accountDeletedAt) {
      showToast("The account was permanently deleted after 14 days.");
      setAccountDeletedAt(null);
    }
    setRole(selectedRole);
    setMarketplaceQuery("");
    dispatch(setStoreRole(selectedRole === "Influencer" ? "creator" : "brand"));
    dispatch(setUserIdentity({ authSource: "guest", userId: undefined, email: undefined, phone: undefined }));
    dispatch(setVerification({ phoneVerified: true, emailVerified: true }));
    const guestCreator = allInfluencers.find((item) => item.id === "creator-aarohi-shah") ?? allInfluencers[0];
    const guestBrandCampaign = campaigns.find((item) => item.brandId === "brand-goodground-co") ?? campaigns[0];
    const guestBrandBrief = briefs.find((item) => item.campaignId === guestBrandCampaign?.id);
    const initialProfile: ProfileDraft = isGuest
      ? selectedRole === "Brand"
        ? {
            name: guestBrandCampaign?.brand ?? "Goodground Co.",
            city: guestBrandCampaign?.city ?? "Mumbai",
            focus: guestBrandCampaign?.category ?? "Lifestyle",
            bio: guestBrandBrief?.brandDescription ?? guestBrandCampaign?.brandDescription ?? "A thoughtful brand building clear, creator-friendly campaigns.",
            avatarUri: guestBrandBrief?.brandLogoUrl,
          }
        : {
            name: guestCreator?.name ?? "Aarohi Shah",
            city: guestCreator?.city ?? "Mumbai",
            focus: guestCreator?.niche ?? "Lifestyle & fashion",
            bio: guestCreator?.bio ?? "A creator making useful, warm content for everyday routines.",
            avatarUri: guestCreator?.avatarUrl,
          }
      : createDefaultProfile(selectedRole);
    dispatch(setProfile({ ...initialProfile, isPublic: false }));
    dispatch(setOnboardingComplete(!needsOnboarding));
    setSocialAccounts(
      isGuest && selectedRole === "Brand"
        ? { Instagram: "@goodgroundco", LinkedIn: "goodground-co" }
        : selectedRole === "Brand"
          ? DEFAULT_SOCIAL_ACCOUNTS
        : { Instagram: "@aarohi.mehta", YouTube: "Aarohi Mehta", Pinterest: "aarohi-boards" },
    );
    setVerifiedSocialAccounts(
      selectedRole === "Brand"
        ? ["Instagram", "YouTube", "LinkedIn"]
        : ["Instagram", "YouTube", "Pinterest"],
    );
    setProfileIsPublic(false);
    setIsInDemo(true);
    setIsOnboarding(needsOnboarding);
  };
  const saveProfileVisibility = async (isPublic: boolean) => {
    if (isSavingProfileVisibility) return;
    const previousValue = profileIsPublic;
    const nextProfile = { ...profile, isPublic };
    setIsSavingProfileVisibility(true);
    setProfileIsPublic(isPublic);
    dispatch(setProfile(nextProfile));
    try {
      if (!persistedAuth.userId) throw new Error("Your session expired. Please sign in again.");
      const avatarUrl = nextProfile.avatarUri?.trim();
      const websiteUrl = nextProfile.websiteUrl?.trim();
      const savedUser = await updateRemoteProfile({
        displayName: nextProfile.name.trim(),
        city: nextProfile.city.trim(),
        focus: nextProfile.focus.trim(),
        bio: nextProfile.bio.trim(),
        ...(avatarUrl ? { avatarUrl } : {}),
        ...(websiteUrl && /^https?:\/\//i.test(websiteUrl) ? { websiteUrl } : {}),
        visibility: isPublic ? "PUBLIC" : "PRIVATE",
        locations: creatorLocations,
      });
      applyRemoteUser(savedUser);
      showToast(isPublic ? "Profile is now public" : "Profile is now private");
    } catch (error) {
      setProfileIsPublic(previousValue);
      dispatch(setProfile({ ...profile, isPublic: previousValue }));
      showToast(error instanceof Error ? error.message : "Profile visibility could not be saved");
    } finally {
      setIsSavingProfileVisibility(false);
    }
  };

  const openCreatorProfile = (creator: PublicCreatorProfile, returnTo?: "compare") => {
    setDetail(returnTo ? { type: "influencer", value: creator, returnTo } : { type: "influencer", value: creator });
    if (role !== "Brand" || !persistedAuth.userId) return;
    void getRemotePublicProfile(creator.id).then((remoteProfile) => {
      const socialAccounts = Object.fromEntries(
        remoteProfile.socialAccounts.map((account) => [account.platform as SocialPlatform, account.profileUrl || account.handle]),
      ) as Partial<Record<SocialPlatform, string>>;
      const socialVerification = Object.fromEntries(
        remoteProfile.socialAccounts.map((account) => [account.platform as SocialPlatform, account.verificationStatus]),
      ) as PublicCreatorProfile["socialVerification"];
      setDetail((current) => {
        if (!current || current.type !== "influencer" || current.value.id !== creator.id) return current;
        return {
          ...current,
          value: {
            ...current.value,
            ...(remoteProfile.profile?.bio ? { bio: remoteProfile.profile.bio } : {}),
            ...(Object.keys(socialAccounts).length ? { socialAccounts } : {}),
            socialVerification,
          },
        };
      });
    }).catch(() => undefined);
  };
  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    reminderSigningOut.current = true;
    try {
      await markChatOffline().catch(() => undefined);
      remoteSnapshotOwnerRef.current = undefined;
      await onboardingProgressSaveQueue.current.catch(() => undefined);
      const token = remotePushToken.current;
      if (token) {
        const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
        await registerRemoteDevice(token, platform, Constants.expoConfig?.version, false, false).catch(() => undefined);
      }
      await setReminderOwner(null);
      await logoutRemote().catch(() => undefined);
      resetToAuth("You have been signed out.");
    } finally {
      setIsLoggingOut(false);
    }
  };
  const openChat = (
    name: string,
    initials: string,
    returnTo: ChatReturn,
  ) => {
    markNotificationRead("chat-update");
    setUtilityPage(null);
    setDetail({ type: "chat", name, initials, returnTo });
  };
  const openMarketplaceChat = ({ application, messageMine }: MarketplaceChatRequest, returnTo: ChatReturn = { type: "tab", tab: "Market" }) => {
    const participantName = role === "Brand" ? application.creatorName : application.brandName;
    const participantInitials = role === "Brand" ? application.creatorInitials : application.brandInitials;
    const conversationId = application.conversationId ?? application.id;
    const conversation = marketplaceConversations.find((item) => item.id === conversationId);
    setUtilityPage(null);
    dispatch(markMarketplaceConversationRead(conversationId));
    setDetail({
      type: "chat",
      name: participantName,
      initials: participantInitials,
      returnTo,
      applicationId: application.id,
      conversationId,
      conversationStatus: conversation?.status ?? application.status,
      initialMessage: application.message,
      initialMessageMine: messageMine,
      initialAttachments: application.attachments,
    });
  };
  const acceptMarketplaceApplication = async (applicationId: string) => {
    const application = applications.find((item) => item.id === applicationId);
    if (persistedAuth.userId && isUuid(applicationId)) {
      try {
        const saved = await updateRemoteCampaignApplication(applicationId, "Accepted");
        dispatch(upsertMarketplaceApplicationAction(saved));
        void loadChatList("", false, true);
        setRemoteChatSnapshots((current) => current[applicationId]
          ? { ...current, [applicationId]: { ...current[applicationId], status: "Accepted", canSend: true } }
          : current);
        showToast("Application accepted. Chat is now open.", "success");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Application status could not be saved.", "error");
      }
      return;
    }
    updateApplicationStatus(applicationId, "Accepted");
    const campaign = application?.campaignId ? campaigns.find((item) => item.id === application.campaignId) : undefined;
    if (campaign && campaign.visibility === "private") {
      upsertCampaign({ ...campaign, visibility: "public", updatedAt: new Date().toISOString() });
    }
    showToast("Application accepted. Chat is now open.", "success");
  };
  const rejectMarketplaceApplication = async (applicationId: string, reason: string, canReapply: boolean) => {
    if (persistedAuth.userId && isUuid(applicationId)) {
      try {
        const saved = await updateRemoteCampaignApplication(applicationId, "Declined", { rejectionReason: reason, allowReapply: canReapply });
        dispatch(upsertMarketplaceApplicationAction(saved));
        void loadChatList("", false, true);
        setRemoteChatSnapshots((current) => current[applicationId]
          ? { ...current, [applicationId]: { ...current[applicationId], status: "Declined", canSend: false } }
          : current);
        showToast("Application declined.", "success");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Application status could not be saved.", "error");
      }
      return;
    }
    declineApplication(applicationId, reason, canReapply);
    showToast("Application declined. The creator can see your reason.", "success");
  };
  const toggleMarketplaceConversationBlock = (conversationId: string) => {
    const conversation = marketplaceConversations.find((item) => item.id === conversationId);
    const application = applications.find((item) => item.id === conversation?.applicationId);
    const participantName = conversation?.participantName ?? application?.creatorName ?? application?.brandName ?? "profile";
    const remoteTargetId = role === "Brand" ? conversation?.creatorId ?? application?.creatorId : conversation?.brandId ?? application?.brandId;
    if (persistedAuth.userId && remoteTargetId && isUuid(remoteTargetId)) {
      const currentlyBlocked = Boolean(conversation?.blockedBy.length || blockedUsers.includes(participantName));
      const actor = role === "Brand" ? "brand" : "creator";
      dispatch(setMarketplaceConversationBlocked({ id: conversationId, actor, blocked: !currentlyBlocked }));
      toggleBlockedUser(participantName, remoteTargetId, !currentlyBlocked, () => dispatch(setMarketplaceConversationBlocked({ id: conversationId, actor, blocked: currentlyBlocked })));
      return;
    }
    if (role === "Brand" && application?.creatorId && application.brandId) {
      toggleMarketplaceApplicationBlock({
        applicationId: application.id,
        campaignId: application.campaignId,
        brandId: application.brandId,
        creatorId: application.creatorId,
      });
      return;
    }
    toggleMarketplaceBlock(conversationId, role === "Brand" ? "brand" : "creator");
  };
  const toggleConversationFavorite = (conversation: MarketplaceConversation) => {
    dispatch(updateMarketplaceConversationPreferences({ id: conversation.id, changes: { favorite: !conversation.favorite } }));
  };
  const toggleConversationMute = (conversation: MarketplaceConversation) => {
    dispatch(updateMarketplaceConversationPreferences({ id: conversation.id, changes: { muted: !conversation.muted } }));
  };
  const openChatProfile = (name: string, returnTo: ChatReturn) => {
    if (role === "Influencer") {
      const brandCampaign = campaigns.find((campaign) => campaign.brand === name);
      if (brandCampaign) {
        setDetail({
          type: "brandProfile",
          brief: briefs.find((brief) => brief.campaignId === brandCampaign.id) ?? campaignToBrandBrief(brandCampaign),
          returnTo,
        });
        return;
      }
    }
    const profile = getChatProfile(name);
    setDetail({
      type: "profile",
      value: profile,
      returnTo: {
        type: "chat",
        name,
        initials: profile.initials,
        returnTo,
      },
    });
  };
  const openBrandProfile = (brandId: string | undefined, campaignId: string | undefined, returnTo: ChatReturn) => {
    const brandCampaign = campaigns.find((campaign) => campaignId && campaign.id === campaignId && (!brandId || campaign.brandId === brandId))
      ?? campaigns.find((campaign) => brandId && campaign.brandId === brandId);
    if (!brandCampaign) {
      showToast("Brand profile is unavailable for this conversation.");
      return;
    }
    setDetail({
      type: "brandProfile",
      brief: briefs.find((brief) => brief.campaignId === brandCampaign.id) ?? campaignToBrandBrief(brandCampaign),
      returnTo,
    });
  };
  const defaultProposalContext: ProposalContext = {
    campaignId: campaigns[0]?.id ?? (persistedAuth.userId ? "" : "demo-brief"),
    campaignTitle: campaigns[0]?.title ?? (persistedAuth.userId ? "No campaign selected" : "New collaboration brief"),
    participantName: campaigns[0]?.brand ?? (persistedAuth.userId ? "No participant selected" : role === "Influencer" ? "Mellow Skincare" : "Aarohi Mehta"),
    participantInitials: campaigns[0]?.brandInitials ?? (persistedAuth.userId ? "" : role === "Influencer" ? "MS" : "AM"),
    participantAvatarUrl:
      role === "Influencer"
        ? undefined
        : persistedAuth.userId ? undefined : "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
    city: campaigns[0]?.city ?? (persistedAuth.userId ? "Not added" : "Mumbai"),
    defaultAmount: campaigns[0]?.budget ?? (persistedAuth.userId ? "Not added" : role === "Influencer" ? "₹14,000" : "₹12,000"),
    defaultDeliverables: campaigns[0]?.deliverables ?? (persistedAuth.userId ? "Not added" : "1 reel, 3 story frames, usage for 30 days"),
  };
  const proposalContextForApplication = (applicationId?: string): ProposalContext => {
    const application = applicationId ? applications.find((item) => item.id === applicationId) : undefined;
    if (!application) return defaultProposalContext;
    const campaign = campaigns.find((item) => item.id === application.campaignId);
    const participantIsCreator = role === "Brand";
    return {
      campaignId: application.campaignId ?? application.briefId,
      campaignTitle: application.briefTitle,
      participantName: participantIsCreator ? application.creatorName : application.brandName,
      participantInitials: participantIsCreator ? application.creatorInitials : application.brandInitials,
      participantAvatarUrl: participantIsCreator ? application.creatorProfile.avatarUrl : undefined,
      city: application.creatorProfile.city,
      defaultAmount: application.payment?.amount ? `₹${Number(application.payment.amount).toLocaleString("en-IN")}` : campaign?.budget ?? "Not recorded",
      defaultDeliverables: campaign?.deliverables || "Not specified",
    };
  };
  const submitProposal = (context: ProposalContext, draft: ProposalDraft) => {
    const hasSchedule = Boolean(
      draft.deliveryDate?.trim() && draft.deliveryTime?.trim() && draft.reminderAt,
    );
    const schedule = hasSchedule
      ? {
          format: draft.deliverables.toLowerCase().includes("reel")
            ? "Reel delivery"
            : "Content delivery",
          deliveryDate: draft.deliveryDate!.trim(),
          deliveryTime: draft.deliveryTime!.trim(),
          reminderSet: draft.reminderEnabled ?? false,
          dueAt: draft.reminderAt,
        }
      : undefined;
    createProposal({
      direction:
        role === "Influencer" ? "creator_to_brand" : "brand_to_creator",
      status: "Pending",
      proposalTitle: draft.title,
      campaignId: context.campaignId,
      campaignTitle: context.campaignTitle,
      participantName: context.participantName,
      participantInitials: context.participantInitials,
      participantAvatarUrl: context.participantAvatarUrl,
      city: context.city,
      amount: draft.amount,
      deliverables: draft.deliverables,
      message: draft.message,
      attachments: draft.attachments,
      schedule,
    });
    if (schedule && draft.reminderAt && schedule.reminderSet) {
      const reminder: Reminder = {
        id: `reminder-${context.campaignId}-${Date.now()}`,
        proposalId: context.campaignId,
        title: schedule.format,
        campaignTitle: context.campaignTitle,
        participantName: context.participantName,
        deliveryDate: schedule.deliveryDate,
        deliveryTime: schedule.deliveryTime,
        dueAt: draft.reminderAt,
        enabled: schedule.reminderSet,
        soundEnabled: draft.reminderSettings?.soundEnabled ?? reminderSettings.soundEnabled,
        vibrationEnabled: draft.reminderSettings?.vibrationEnabled ?? reminderSettings.vibrationEnabled,
        soundTone: draft.reminderSettings?.soundTone ?? reminderSettings.soundTone ?? "default",
      };
      upsertReminder(reminder);
      if (reminder.enabled) {
        void scheduleDeliveryReminder(reminder, reminderSettings, { requestPermission: true })
          .then((notificationId) => {
            if (notificationId) updateReminder({ id: reminder.id, notificationId });
            else showToast("Reminder saved. Allow notifications to receive the alarm.");
          })
          .catch(() => showToast("Reminder saved, but the alarm could not be scheduled."));
      }
      if (notificationSettings.reminders) {
        setNotifications((current) => [
          {
            id: `reminder-set-${reminder.id}`,
            icon: "alarm-outline",
            title: "Reminder set",
            body: `${reminder.title} is set for ${reminder.deliveryDate} at ${reminder.deliveryTime}.`,
            time: "Just now",
            read: false,
            category: "reminders",
          },
          ...current,
        ]);
      }
    }
    if (notificationSettings.proposalUpdates || notificationSettings.proposalRequests) {
      setNotifications((current) => [
        {
          id: `proposal-sent-${Date.now()}`,
          icon: "paper-plane-outline",
          title: "Proposal sent",
          body: `Your proposal for ${context.campaignTitle} is ready for review.`,
          time: "Just now",
          read: false,
          category: "proposalUpdates",
        },
        ...current,
      ]);
    }
  };
  const toggleReminder = (id: string, enabled: boolean) => {
    const taskId = id.startsWith("task-reminder-") ? id.slice("task-reminder-".length) : undefined;
    const task = taskId ? todoTasks.find((item) => item.id === taskId) : undefined;
    if (task) {
      if (!enabled) {
        updateTodoTask(task.id, {
          reminderEnabled: false,
          reminderAt: null,
          reminderStatus: "STOPPED",
          reminderNotificationId: undefined,
        });
        showToast("Task reminder turned off");
        return;
      }
      const dueAt = task.reminderAt
        ? Date.parse(task.reminderAt)
        : parseReminderDateTime(task.dueDate, task.dueTime);
      if (!dueAt || dueAt <= Date.now()) {
        showToast("Choose a future date and time before turning this reminder on.");
        return;
      }
      updateTodoTask(task.id, {
        reminderEnabled: true,
        reminderAt: new Date(dueAt).toISOString(),
        reminderStatus: "PENDING",
        reminderNotificationId: undefined,
      });
      showToast("Task reminder turned on");
      return;
    }
    const reminder = reminders.find((item) => item.id === id);
    if (!reminder) return;
    if (enabled && reminder.dueAt <= Date.now()) {
      showToast("Choose a future date and time before turning this reminder on.");
      return;
    }
    if (!enabled) {
      void clearReminderAction(id);
      void cancelDeliveryReminder(reminder.notificationId, reminder.id).catch(() => undefined);
      updateReminder({ id, enabled: false, notificationId: undefined });
      showToast("Reminder turned off");
      return;
    }
    void clearReminderAction(id);
    const nextReminder = { ...reminder, enabled: true, notificationId: undefined };
    updateReminder(nextReminder);
    void scheduleDeliveryReminder(nextReminder, reminderSettings, { requestPermission: true })
      .then((notificationId) => {
        if (notificationId) updateReminder({ id, notificationId });
        else showToast("Reminder is on. Allow notifications to receive the alarm.");
      })
      .catch(() => showToast("Reminder is on, but the alarm could not be scheduled."));
  };
  const saveReminderItemSettings = (
    id: string,
    settings: ReminderSettings,
    enabledOverride?: boolean,
    schedule?: {
      deliveryDate: string;
      deliveryTime: string;
      dueAt: number;
      enabled?: boolean;
    },
  ) => {
    const taskId = id.startsWith("task-reminder-") ? id.slice("task-reminder-".length) : undefined;
    const task = taskId ? todoTasks.find((item) => item.id === taskId) : undefined;
    if (task) {
      dispatch(setReminderOverride({ key: `${persistedAuth.userId}:${id}`, settings }));
      const enabled = schedule?.enabled ?? enabledOverride ?? task.reminderEnabled;
      const dueAt = schedule?.dueAt
        ?? (task.reminderAt ? Date.parse(task.reminderAt) : parseReminderDateTime(task.dueDate, task.dueTime));
      if (enabled && (!dueAt || dueAt <= Date.now())) {
        showToast("Choose a future date and time before turning this reminder on.");
        return;
      }
      updateTodoTask(task.id, {
        ...(schedule
          ? {
              dueDate: taskDateKeyFromDate(new Date(schedule.dueAt)),
              dueTime: schedule.deliveryTime,
            }
          : {}),
        reminderEnabled: enabled,
        reminderAt: enabled && dueAt ? new Date(dueAt).toISOString() : null,
        reminderStatus: enabled ? "PENDING" : "STOPPED",
        reminderTone: settings.soundTone,
        reminderNotificationId: undefined,
      });
      return;
    }
    const reminder = reminders.find((item) => item.id === id);
    if (!reminder) return;
    void cancelDeliveryReminder(reminder.notificationId, reminder.id).catch(() => undefined);
    void clearReminderAction(id);
    const nextReminder: Reminder = {
      ...reminder,
      ...(schedule
        ? {
            deliveryDate: schedule.deliveryDate,
            deliveryTime: schedule.deliveryTime,
            dueAt: schedule.dueAt,
          }
        : {}),
      enabled: schedule?.enabled ?? enabledOverride ?? reminder.enabled,
      soundEnabled: settings.soundEnabled,
      vibrationEnabled: settings.vibrationEnabled,
      soundTone: settings.soundTone,
      notificationId: undefined,
    };
    updateReminder(nextReminder);
    if (nextReminder.enabled && nextReminder.dueAt > Date.now()) {
      void scheduleDeliveryReminder(nextReminder, reminderSettings, { requestPermission: true })
        .then((notificationId) => {
          updateReminder({ id, notificationId: notificationId ?? undefined });
          if (!notificationId) showToast("Reminder saved. Allow notifications for the alarm.");
        })
        .catch(() => showToast("Reminder saved, but the alarm could not be scheduled."));
    }
  };
  const saveReminderSettings = (nextSettings: ReminderSettings) => {
    setReminderSettings(nextSettings);
    todoTasks
      .filter((task) => task.reminderEnabled && !task.completed)
      .forEach((task) => {
        if (persistedAuth.userId) {
          updateTodoTask(task.id, {
            reminderTone: nextSettings.soundTone,
            reminderNotificationId: undefined,
          });
        } else {
          updateTodoTaskInStore(task.id, { reminderNotificationId: undefined });
          scheduleTaskReminder({ ...task, reminderNotificationId: undefined }, false, nextSettings);
        }
      });
    void Promise.all(
      reminders
        .filter((reminder) => reminder.enabled)
        .map(async (reminder) => {
          await cancelDeliveryReminder(reminder.notificationId, reminder.id).catch(() => undefined);
          const notificationId = await scheduleDeliveryReminder(
            { ...reminder, notificationId: undefined },
            nextSettings,
            { requestPermission: false },
          );
          updateReminder({ id: reminder.id, notificationId: notificationId ?? undefined });
        }),
    ).catch(() => undefined);
  };
  const openProposalReminder = (proposal: DemoProposal) => {
    const reminder = reminders.find((item) => item.proposalId === proposal.id);
    if (!reminder) {
      showToast("No delivery reminder is set for this proposal.");
      return;
    }
    setProposalReminderTarget(reminder);
    setProposalReminderEnabled(reminder.enabled);
    setProposalReminderDraft({
      soundEnabled: reminder.soundEnabled ?? reminderSettings.soundEnabled,
      vibrationEnabled: reminder.vibrationEnabled ?? reminderSettings.vibrationEnabled,
      soundTone: reminder.soundTone ?? reminderSettings.soundTone ?? "default",
    });
  };
  const handleProposalStatus = (id: string, status: ProposalStatus) => {
    updateProposalStatus(id, status);
    const proposal = proposals.find((item) => item.id === id);
    if (!proposal) return;
    const statusNotifications: AppNotification[] = [];
    if (notificationSettings.proposalUpdates) {
      statusNotifications.push({
        id: `proposal-status-${id}-${Date.now()}`,
        icon: status === "Accepted" ? "checkmark-circle-outline" : "paper-plane-outline",
        title: `Proposal ${status.toLowerCase()}`,
        body: `${proposal.campaignTitle} was updated for ${proposal.participantName}.`,
        time: "Just now",
        read: false,
        category: "proposalUpdates",
      });
    }
    if (status === "Accepted" && notificationSettings.messages) {
      statusNotifications.push({
        id: `chat-ready-${id}-${Date.now()}`,
        icon: "chatbubble-ellipses-outline",
        title: "Chat is ready",
        body: `Your collaboration with ${proposal.participantName} is ready to continue in Inbox.`,
        time: "Just now",
        read: false,
        category: "messages",
      });
    }
    if (statusNotifications.length) {
      setNotifications((current) => [...statusNotifications, ...current]);
    }
  };
  const handleDealStatusSave = (campaignId: string, status: DealStatus) => {
    setCollaborationStatuses((current) => ({ ...current, [campaignId]: status }));
    if (!notificationSettings.proposalUpdates) return;
    setNotifications((current) => [
      {
        id: `collaboration-status-${campaignId}-${Date.now()}`,
        icon: status === "Completed" ? "checkmark-circle-outline" : "briefcase-outline",
        title: "Collaboration status updated",
        body: `Your collaboration is now marked as ${status.toLowerCase()}.`,
        time: "Just now",
        read: false,
        category: "proposalUpdates",
      },
      ...current,
    ]);
  };
  const confirmCollaborationComplete = async (applicationId: string) => {
    const application = applications.find((item) => item.id === applicationId);
    if (persistedAuth.userId && !isUuid(applicationId)) {
      showToast("This collaboration is not linked to a saved request. Refresh the chat and try again.", "error");
      return;
    }
    if (!persistedAuth.userId) {
      if (!application) {
        showToast("This collaboration could not be found. Reopen the chat and try again.", "error");
        return;
      }
      const completionConfirmedBy = { brand: Boolean(application.completionConfirmedBy?.brand), creator: Boolean(application.completionConfirmedBy?.creator) };
      completionConfirmedBy[role === "Brand" ? "brand" : "creator"] = true;
      const completedAt = completionConfirmedBy.brand && completionConfirmedBy.creator ? application.completedAt ?? new Date().toISOString() : null;
      dispatch(upsertMarketplaceApplicationAction({ ...application, completionConfirmedBy, completedAt }));
      showToast(completedAt ? "Collaboration completed. Both sides can now leave a review." : "Confirmation recorded. The other participant must confirm too.", "success");
      return;
    }
    try {
      const confirmation = await confirmRemoteCampaignCompletion(applicationId);
      if (application) dispatch(upsertMarketplaceApplicationAction({ ...application, completedAt: confirmation.completedAt, completionConfirmedBy: { brand: confirmation.brandConfirmed, creator: confirmation.creatorConfirmed } }));
      void getRemoteCampaigns().then((snapshot) => dispatch(hydrateCampaignMarketplace(snapshot))).catch(() => undefined);
      showToast(confirmation.completedAt ? "Collaboration completed. Both sides can now leave a review." : "Completion recorded. The other participant must confirm too.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Completion could not be saved.", "error");
    }
  };
  const handleReviewSubmit = async (draft: ReviewDraft) => {
    if (persistedAuth.userId) {
      const requestedApplicationId = detail?.type === "flow" ? detail.applicationId : undefined;
      const targetUserId = detail?.type === "profile" ? detail.value.id : detail?.type === "brandProfile" ? detail.brief.brandId : undefined;
      const eligible = applications.filter((application) => application.completedAt && !(application.reviews ?? []).some((review) => review.authorId === persistedAuth.userId) && (role === "Brand" ? application.brandId === persistedAuth.userId : application.creatorId === persistedAuth.userId) && (!targetUserId || (role === "Brand" ? application.creatorId : application.brandId) === targetUserId));
      const applicationId = requestedApplicationId ?? eligible.sort((left, right) => (right.completedAt ?? "").localeCompare(left.completedAt ?? ""))[0]?.id;
      if (!applicationId || !isUuid(applicationId)) {
        showToast("Open a completed collaboration from its chat to leave a review.", "error");
        return false;
      }
      try {
        const savedReview = await createRemoteCampaignReview(applicationId, { rating: draft.rating, text: draft.text });
        const reviewedApplication = applications.find((application) => application.id === applicationId);
        const subjectId = role === "Brand" ? reviewedApplication?.creatorId : reviewedApplication?.brandId;
        if (reviewedApplication) dispatch(upsertMarketplaceApplicationAction({ ...reviewedApplication, reviews: [...(reviewedApplication.reviews ?? []), {
          id: savedReview.id,
          authorId: savedReview.authorId,
          author: role === "Brand" ? currentBrandName || "Brand" : profileName || "Creator",
          subjectId: savedReview.subjectId,
          subject: role === "Brand" ? reviewedApplication.creatorName : reviewedApplication.brandName,
          rating: savedReview.rating,
          text: savedReview.text,
          createdAt: savedReview.createdAt,
        }] }));
        void getRemoteCampaigns().then((snapshot) => dispatch(hydrateCampaignMarketplace(snapshot))).catch(() => undefined);
        if (role === "Brand" && subjectId && isUuid(subjectId)) void getRemotePublicProfile(subjectId).then((refreshedProfile) => {
          remoteDiscoverProfileCache.current.set(refreshedProfile.id, refreshedProfile);
          setRemoteDiscoverProfiles((current) => [...current.filter((profile) => profile.id !== refreshedProfile.id), refreshedProfile]);
        }).catch(() => undefined);
        showToast("Review saved and added to the participant’s profile.", "success");
        return true;
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Review could not be saved.", "error");
        return false;
      }
    }
    const applicationId = detail?.type === "flow" ? detail.applicationId : undefined;
    const application = applicationId ? applications.find((item) => item.id === applicationId) : undefined;
    const reviewId = `review-authored-${Date.now()}`;
    if (application) dispatch(upsertMarketplaceApplicationAction({ ...application, reviews: [...(application.reviews ?? []), {
      id: reviewId,
      authorId: persistedAuth.userId || (role === "Brand" ? application.brandId ?? "brand-local" : application.creatorId),
      author: currentBrandName || profileName || "You",
      subjectId: role === "Brand" ? application.creatorId : application.brandId ?? "brand-local",
      subject: role === "Brand" ? application.creatorName : application.brandName,
      rating: draft.rating,
      text: draft.text,
      createdAt: new Date().toISOString(),
    }] }));
    addAuthoredReview({
      id: reviewId,
      author: currentBrandName || profileName || "You",
      rating: draft.rating,
      text: draft.text,
      date: new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(new Date()),
      subjectName: draft.subject,
      campaignId: defaultProposalContext.campaignId,
      authorRole: role,
    });
    if (!notificationSettings.profileActivity) return true;
    setNotifications((current) => [
      {
        id: `review-published-${Date.now()}`,
        icon: "checkmark-circle-outline",
        title: "Review published",
        body: `Your collaboration review for ${draft.subject} is now available.`,
        time: "Just now",
        read: false,
        category: "profileActivity",
      },
      ...current,
    ]);
    return true;
  };
  const handleCampaignSave = (draft: CampaignDraft, publish = false) => {
    const existing = draft.id ? campaigns.find((item) => item.id === draft.id) : undefined;
    const now = new Date().toISOString();
    const campaign: Campaign = {
      ...existing,
      id: existing?.id ?? draft.id ?? `campaign-${Date.now()}`,
      brandId: existing?.brandId ?? currentBrandId ?? currentActorId,
      brandInitials: existing?.brandInitials ?? getProfileInitials(currentBrandName),
      brand: existing?.brand ?? currentBrandName,
      title: draft.title,
      description: draft.description,
      city: draft.city,
      category: draft.category,
      budget: draft.budget,
      deadline: draft.deadline || existing?.deadline || "Flexible",
      status: publish ? "Published" : "Draft",
      platforms: draft.platforms ?? existing?.platforms,
      deliverables: draft.deliverables ?? existing?.deliverables,
      requirements: draft.requirements ?? existing?.requirements,
      creatorRequirements: draft.creatorRequirements ?? existing?.creatorRequirements,
      collaborationVideoUrl: draft.collaborationVideoUrl || existing?.collaborationVideoUrl,
      collaborationVideoLabel: draft.collaborationVideoLabel ?? existing?.collaborationVideoLabel,
      media: draft.media ?? existing?.media,
      applicationLimit: draft.applicationLimit !== undefined ? draft.applicationLimit : existing?.applicationLimit,
      approvalLimit: draft.approvalLimit !== undefined ? draft.approvalLimit : existing?.approvalLimit,
      closeOnApplicationLimit: draft.closeOnApplicationLimit ?? existing?.closeOnApplicationLimit ?? true,
      closeOnApprovalLimit: draft.closeOnApprovalLimit ?? existing?.closeOnApprovalLimit ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      publishedAt: publish ? existing?.publishedAt ?? now : existing?.publishedAt,
      visibility: existing?.visibility ?? "public",
    };
    if (!persistedAuth.userId) {
      upsertCampaign(campaign);
      return;
    }
    const input = {
      ...draft,
      publish,
      visibility: campaign.visibility === "private" ? "PRIVATE" as const : "PUBLIC" as const,
    };
    const request = draft.id
      ? updateRemoteCampaign(draft.id, input)
      : createRemoteCampaign(input);
    void request
      .then((saved) => {
        upsertCampaign(saved);
        showToast(publish ? "Campaign published" : "Campaign draft saved", "success");
      })
      .catch((error) => showToast(error instanceof Error ? error.message : "Campaign could not be saved", "error"));
  };
  const handleCampaignCreate = (draft: CampaignDraft) => handleCampaignSave(draft, false);
  const openCampaignApplication = (campaign: Campaign) => {
    if (role !== "Influencer" || !currentCreator) return;
    const existing = applications.find((application) =>
      application.creatorId === currentCreator.id &&
      (application.campaignId ?? application.briefId) === campaign.id,
    );
    if (existing && !(existing.status === "Declined" && existing.canReapply === true)) return;
    setDetail({
      type: "application",
      campaign,
      brief: briefs.find((brief) => brief.campaignId === campaign.id) ?? campaignToBrandBrief(campaign),
    });
  };
  const handleCampaignArchive = (id: string) => {
    if (persistedAuth.userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      void archiveRemoteCampaign(id).then((saved) => upsertCampaign(saved)).catch((error) => showToast(error instanceof Error ? error.message : "Campaign could not be archived", "error"));
    } else {
      archiveCampaign(id);
    }
    showToast("Campaign archived");
  };
  useEffect(() => {
    const campaignId = detail?.type === "campaign" ? detail.value.id : undefined;
    if (role !== "Brand" || !persistedAuth.userId || !campaignId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId)) return;
    let active = true;
    setCampaignMatchesLoading((current) => ({ ...current, [campaignId]: true }));
    void getRemoteCampaignMatches(campaignId)
      .then((matches: RemoteCampaignMatch[]) => {
        if (!active) return;
        setCampaignMatches((current) => ({
          ...current,
          [campaignId]: matches.map((match) => ({ ...match, matchScore: match.score, matchReasons: match.reasons } as Influencer)),
        }));
      })
      .catch(() => setCampaignMatches((current) => ({ ...current, [campaignId]: [] })))
      .finally(() => {
        if (active) setCampaignMatchesLoading((current) => ({ ...current, [campaignId]: false }));
      });
    return () => { active = false; };
  }, [detail, persistedAuth.userId, role]);
  const selectedProposal =
    detail?.type === "proposal"
      ? proposals.find((item) => item.id === detail.value.id) ?? detail.value
      : null;
  if (isSplashVisible || authRestorePending) return <SplashScreen />;
  if (!isInDemo)
    return (
      <AuthScreen
        onAuthenticated={applyRemoteUser}
        onProgressSave={saveOnboardingProgress}
      />
    );
  if (isOnboarding)
    return (
      <OnboardingScreen
        role={role}
        initialProfile={profile}
        initialSignupProfile={persistedAuth.signupProfile}
        initialStep={
                persistedAuth.signupStep === "details" ? 1
            : persistedAuth.signupStep === "social" ? 2
              : persistedAuth.signupStep === "verifying" ? 3
                : persistedAuth.signupStep === "review" || persistedAuth.signupStep === "creating" || persistedAuth.signupStep === "success" ? 4
                : 0
        }
        email={persistedAuth.email}
        phone={persistedAuth.phone}
        initialSocialAccounts={socialAccounts}
        verifiedSocialAccounts={verifiedSocialAccounts}
        pendingSocialAccounts={pendingSocialAccounts}
        socialAccountErrors={socialAccountErrors}
        onSocialAccountsSave={saveSocialAccounts}
        onProgressSave={saveOnboardingProgress}
        onComplete={async (completedProfile) => {
          if (!persistedAuth.userId) throw new Error("Your session expired. Please sign in again.");
          await onboardingProgressSaveQueue.current.catch(() => undefined);
          const avatarUrl = completedProfile.profile.avatarUri?.trim();
          const websiteUrl = completedProfile.profile.websiteUrl?.trim();
          const completedUser = await updateRemoteProfile({
            displayName: completedProfile.profile.name.trim(),
            city: completedProfile.profile.city.trim(),
            focus: completedProfile.profile.focus.trim(),
            bio: completedProfile.profile.bio.trim(),
            ...(avatarUrl ? { avatarUrl } : {}),
            ...(websiteUrl && /^https?:\/\//i.test(websiteUrl) ? { websiteUrl } : {}),
            audienceSize: completedProfile.profile.audienceSize,
            rateRange: completedProfile.profile.rateRange,
            teamSize: completedProfile.profile.teamSize,
            languages: completedProfile.profile.languages,
            visibility: completedProfile.profile.isPublic ? "PUBLIC" : "PRIVATE",
            locations: completedProfile.locations,
            onboardingStep: "success",
          });
          updateCreatorLocations(completedProfile.locations);
          applyRemoteUser(completedUser);
        }}
      />
    );
  const creatorFromConversation = (conversation: MarketplaceConversation): Influencer | undefined => {
    if (!conversation.creatorId) return undefined;
    return allInfluencers.find((item) => item.id === conversation.creatorId) ?? {
      id: conversation.creatorId,
      name: conversation.participantName || "Creator",
      initials: conversation.participantInitials || "CR",
      avatarUrl: conversation.participantAvatarUrl,
      city: "India",
      niche: "Creator",
      rating: 0,
      reviews: 0,
      followers: "",
      price: "",
      platforms: [] as SocialPlatform[],
      contentTypes: [] as CreatorContentType[],
    };
  };
  const eligibleTaskRecipients = marketplaceConversations
    .filter((conversation) => conversation.status === "Accepted" && !conversation.blockedBy.length && conversation.creatorId)
    .map((conversation) => {
      const creator = creatorFromConversation(conversation);
      return creator ? { creator, conversation } : undefined;
    })
    .filter((item): item is { creator: Influencer; conversation: MarketplaceConversation } => Boolean(item))
    .filter((item, index, items) => items.findIndex((candidate) => candidate.creator.id === item.creator.id) === index);
  const activeChatTaskRecipient = (): { creator: Influencer; conversation: MarketplaceConversation } | undefined => {
    if (detail?.type !== "chat" || detail.adminChat) return undefined;
    const creatorId = activeMarketplaceConversation?.creatorId
      ?? activeRemoteChatSnapshot?.participant.id
      ?? activeMarketplaceApplication?.creatorId;
    const applicationId = activeMarketplaceConversation?.applicationId ?? detail.applicationId ?? detail.conversationId;
    if (!creatorId || !applicationId) return undefined;
    if (activeMarketplaceConversation) {
      const creator = creatorFromConversation(activeMarketplaceConversation);
      return creator ? { creator, conversation: activeMarketplaceConversation } : undefined;
    }
    const fallbackConversation: MarketplaceConversation = {
      id: detail.conversationId ?? applicationId,
      applicationId,
      campaignId: activeMarketplaceApplication?.campaignId,
      brandId: activeMarketplaceApplication?.brandId,
      creatorId,
      participantName: activeRemoteChatSnapshot?.participant.name ?? detail.name,
      participantInitials: detail.initials,
      participantAvatarUrl: activeRemoteChatSnapshot?.participant.avatarUrl ?? undefined,
      briefTitle: activeMarketplaceApplication?.briefTitle ?? "",
      preview: "",
      status: activeRemoteChatSnapshot?.status ?? detail.conversationStatus ?? "Accepted",
      blockedBy: [],
      updatedAt: new Date().toISOString(),
      messages: activeRemoteChatSnapshot?.messages,
    };
    const creator = creatorFromConversation(fallbackConversation);
    return creator ? { creator, conversation: fallbackConversation } : undefined;
  };
  const campaignMatchCreators = detail?.type === "campaign" ? campaignMatches[detail.value.id] ?? [] : [];
  const eligibleCampaignRecipients = campaignMatchCreators
    .filter((creator, index, creators) => creators.findIndex((item) => item.id === creator.id) === index)
    .sort((a, b) => Number(discoverSavedIds.includes(b.id)) - Number(discoverSavedIds.includes(a.id)));
  const sendTaskToCreators = async (task: TodoTask, creatorIds: string[], preferredRecipient?: { creator: Influencer; conversation: MarketplaceConversation }) => {
    if (role !== "Brand") return 0;
    const recipients = creatorIds
      .filter((creatorId, index, ids) => ids.indexOf(creatorId) === index)
      .map((creatorId) => eligibleTaskRecipients.find((item) => item.creator.id === creatorId)
        ?? (preferredRecipient?.creator.id === creatorId ? preferredRecipient : undefined))
      .filter((item): item is { creator: Influencer; conversation: MarketplaceConversation } => Boolean(item));
    if (!recipients.length) {
      showToast("An accepted collaboration is required to send this task.");
      return 0;
    }
    const sharedCreatorIds = new Set(task.sharedWithCreatorIds ?? []);
    if (task.creatorId && task.sharedWithCreatorAt) sharedCreatorIds.add(task.creatorId);
    const pendingRecipients = recipients.filter(({ creator }) => !sharedCreatorIds.has(creator.id));
    if (!pendingRecipients.length) {
      showToast("This task was already sent to the selected creators.");
      return 0;
    }
    if (persistedAuth.userId) {
      const remoteRecipients = pendingRecipients.filter(({ creator }) => isUuid(creator.id));
      if (!remoteRecipients.length || !isUuid(task.id)) {
        showToast("This collaboration is not connected to a live account yet.");
        return 0;
      }
      showToast("Saving task sharing…");
      const results = await Promise.allSettled(remoteRecipients.map(async ({ creator, conversation }) => {
        const sharedTask = await shareRemoteTask(task.id, creator.id);
        const savedMessage = await sendRemoteChatMessage(conversation.applicationId, {
          text: `Task: ${task.title}`,
          taskId: task.id,
          clientMessageId: `task-share:${task.id}:${creator.id}`,
        });
        const message = mapRemoteChatMessage(savedMessage);
        dispatch(addMarketplaceMessageAction({ conversationId: conversation.applicationId, message }));
        setRemoteChatSnapshots((current) => {
          const snapshot = current[conversation.applicationId];
          return snapshot ? { ...current, [conversation.applicationId]: { ...snapshot, messages: mergeRemoteChatMessage(snapshot.messages, message) } } : current;
        });
        return sharedTask;
      }));
      const savedResults = results.filter((result): result is PromiseFulfilledResult<import("../../services/authApi.service").RemoteTask> => result.status === "fulfilled");
      const savedCount = savedResults.length;
      if (savedCount) {
        remoteTaskCache.current.clear();
        const savedById = new Map(savedResults.map(({ value }) => [value.id, normalizeTodoTask(value as TodoTask)]));
        setRemoteTodoTasks((current) => current.map((item) => savedById.get(item.id) ?? item));
        await loadRemoteTasks({}, true).catch(() => undefined);
        showToast(`Task shared with ${savedCount} creator${savedCount === 1 ? "" : "s"}.`, "success");
      }
      if (savedCount < results.length) showToast(`${results.length - savedCount} task share${results.length - savedCount === 1 ? "" : "s"} could not be saved.`, "error");
      return savedCount;
    }
    const sentAt = new Date().toISOString();
    pendingRecipients.forEach(({ creator, conversation }) => {
      sharedCreatorIds.add(creator.id);
      const hasMessage = conversation.messages?.some((message) => message.taskId === task.id);
      if (!hasMessage) {
        addMarketplaceMessage(conversation.id, {
          id: `task-message-${task.id}-${creator.id}`,
          taskId: task.id,
          text: `Task: ${task.title}`,
          mine: true,
          senderRole: "Brand",
          time: "Now",
          status: "sent",
        });
      }
    });
    const firstRecipient = pendingRecipients[0];
    const firstShare = !task.sharedWithCreatorAt && !(task.sharedWithCreatorIds?.length);
    updateTodoTask(task.id, {
      kind: "task",
      brandId: currentBrandId ?? currentActorId,
      senderName: currentBrandName,
      sentAt,
      sharedWithCreatorAt: task.sharedWithCreatorAt ?? sentAt,
      sharedWithCreatorIds: Array.from(sharedCreatorIds),
      ...(firstShare ? { creatorId: firstRecipient.creator.id, conversationId: firstRecipient.conversation.id } : {}),
    });
    showToast(`Task sent to ${pendingRecipients.length} creator${pendingRecipients.length === 1 ? "" : "s"}.`);
    return pendingRecipients.length;
  };
  const sendTaskToCreator = (task: TodoTask, creatorId: string, preferredRecipient?: { creator: Influencer; conversation: MarketplaceConversation }) => sendTaskToCreators(task, [creatorId], preferredRecipient).then((count) => count > 0);
  const activeTaskShareContext = () => {
    if (detail?.type !== "chat" || detail.adminChat) return undefined;
    const conversationId = activeMarketplaceConversation?.id ?? detail.conversationId ?? detail.applicationId;
    const applicationId = activeMarketplaceConversation?.applicationId ?? activeMarketplaceApplication?.id ?? detail.applicationId ?? conversationId;
    const participantId = role === "Brand"
      ? activeMarketplaceConversation?.creatorId ?? activeRemoteChatSnapshot?.participant.id ?? activeMarketplaceApplication?.creatorId
      : activeMarketplaceConversation?.brandId ?? activeRemoteChatSnapshot?.participant.id ?? activeMarketplaceApplication?.brandId;
    const status = activeMarketplaceConversation?.status ?? activeRemoteChatSnapshot?.status ?? activeMarketplaceApplication?.status ?? detail.conversationStatus;
    const blocked = Boolean(activeMarketplaceConversation?.blockedBy.length || activeRemoteChatSnapshot?.blockedBy?.length);
    if (!conversationId || !applicationId || !participantId || status !== "Accepted" || blocked) return undefined;
    return { conversationId, applicationId, participantId };
  };
  const sendTaskInActiveChat = async (task: TodoTask) => {
    const context = activeTaskShareContext();
    if (!context) {
      showToast("An accepted, unblocked user chat is required to share a task.", "error");
      return false;
    }
    const existingMessages = activeMarketplaceConversation?.messages ?? activeRemoteChatSnapshot?.messages ?? [];
    if (existingMessages.some((message) => message.taskId === task.id)) {
      showToast("This task is already in this chat.");
      return false;
    }
    if (persistedAuth.userId) {
      if (!isUuid(task.id) || !isUuid(context.participantId) || !isUuid(context.applicationId)) {
        throw new Error("This task or chat is not connected to a live account.");
      }
      const savedTask = await shareRemoteTask(task.id, context.participantId);
      const savedMessage = await sendRemoteChatMessage(context.applicationId, {
        text: `Task: ${task.title}`,
        taskId: task.id,
        clientMessageId: `task-share:${task.id}:${context.applicationId}`,
      });
      const message = mapRemoteChatMessage(savedMessage);
      dispatch(addMarketplaceMessageAction({ conversationId: context.conversationId, message }));
      setRemoteChatSnapshots((current) => {
        const snapshot = current[context.conversationId];
        return snapshot ? { ...current, [context.conversationId]: { ...snapshot, messages: mergeRemoteChatMessage(snapshot.messages, message) } } : current;
      });
      remoteTaskCache.current.clear();
      setRemoteTodoTasks((current) => current.map((item) => item.id === savedTask.id ? normalizeTodoTask(savedTask as TodoTask) : item));
      await loadRemoteTasks({}, true).catch(() => undefined);
      showToast("Task shared in chat.", "success");
      return true;
    }
    const localConversation = marketplaceConversations.find((item) => item.id === context.conversationId);
    if (!localConversation) {
      showToast("This chat is unavailable. Please reopen it and try again.", "error");
      return false;
    }
    const sentAt = new Date().toISOString();
    addMarketplaceMessage(localConversation.id, {
      id: `task-message-${task.id}-${localConversation.id}`,
      taskId: task.id,
      text: `Task: ${task.title}`,
      mine: true,
      senderRole: role,
      time: "Now",
      status: "sent",
      createdAt: sentAt,
    });
    updateTodoTask(task.id, {
      kind: "task",
      senderName: profileName,
      sentAt,
      conversationId: localConversation.id,
      ...(role === "Brand" ? { brandId: currentActorId, creatorId: context.participantId, sharedWithCreatorAt: sentAt, sharedWithCreatorIds: Array.from(new Set([...(task.sharedWithCreatorIds ?? []), context.participantId])) } : { brandId: context.participantId, creatorId: currentActorId }),
    });
    showToast("Task shared in chat.", "success");
    return true;
  };
  const addReceivedTaskToTodo = (task: TodoTask, conversationId?: string) => {
    if (role !== "Influencer" || task.kind === "video-brief" || !task.sharedWithCreatorAt) return false;
    if (!currentCreator || (!task.sharedWithCreatorIds?.includes(currentCreator.id) && task.creatorId !== currentCreator.id)) {
      showToast("This task was sent to a different creator.");
      return false;
    }
    const created = addTodoTask({
      kind: "task",
      sourceTaskId: task.id,
      brandId: task.brandId,
      conversationId: conversationId ?? task.conversationId,
      senderName: task.senderName,
      title: task.title,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      notes: task.notes,
      links: task.links,
      attachments: task.attachments,
      reminderEnabled: task.reminderEnabled,
      reminderTone: task.reminderTone,
      campaignId: task.campaignId,
      creatorId: currentCreator.id,
    });
    if (!created) showToast("Added to your tasks");
    return Boolean(created);
  };
  const sendCampaignFromChat = (campaign: Campaign) => {
    const recipient = activeChatTaskRecipient();
    const conversation = recipient?.conversation;
    if (role !== "Brand" || (detail?.type === "chat" && detail.adminChat) || !conversation || conversation.status !== "Accepted" || conversation.blockedBy.length || activeRemoteChatSnapshot?.blockedBy?.length) {
      showToast("An accepted active chat is required to send a campaign request.");
      return;
    }
    const creator = recipient.creator;
    if (!creator || !isPublishedCampaign(campaign)) {
      showToast("Choose a published campaign for this creator.");
      return;
    }
    const conversationId = conversation.applicationId;
    if (persistedAuth.userId && isUuid(campaign.id)) {
      if (!isUuid(creator.id)) {
        showToast("This creator is not connected to a live account.", "error");
        return;
      }
      void inviteRemoteCampaignCreator(campaign.id, creator.id, `Campaign invitation for ${campaign.title}`)
        .then((saved) => {
          dispatch(upsertMarketplaceApplicationAction(saved));
          void loadChatHistory(conversationId, undefined, true);
          void getRemoteCampaigns().then((snapshot) => dispatch(hydrateCampaignMarketplace(snapshot))).catch(() => undefined);
          showToast("Campaign request sent", "success");
        })
        .catch((error) => showToast(error instanceof Error ? error.message : "Campaign request could not be saved.", "error"));
      showToast("Saving campaign request…");
      return;
    }
    if (persistedAuth.userId) {
      showToast("This campaign is not connected to a live account.", "error");
      return;
    }
    const brief = briefs.find((item) => item.campaignId === campaign.id) ?? campaignToBrandBrief(campaign);
    void submitApplication({
      briefId: brief.id,
      campaignId: campaign.id,
      brandId: currentBrandId ?? currentActorId,
      briefTitle: campaign.title,
      brandName: currentBrandName,
      brandInitials: getProfileInitials(currentBrandName),
      creatorId: creator.id,
      creatorName: creator.name,
      creatorInitials: creator.initials,
      creatorProfile: creator,
      contactShared: false,
      responses: {},
      attachments: [],
      direction: "brand-to-creator",
      message: `Campaign invitation for ${campaign.title}`,
      conversationId: conversation.id,
    }).then((result) => {
      showToast(result.application.status === "Pending" ? "Campaign request sent" : `Campaign is already ${result.application.status.toLowerCase()}`);
    });
  };
  const handleChatCampaignSelection = (campaign: Campaign) => {
    if (detail?.type !== "chat" || detail.adminChat) return;
    if (role === "Brand") {
      sendCampaignFromChat(campaign);
      return;
    }
    const context = activeTaskShareContext();
    const brandId = activeMarketplaceConversation?.brandId ?? activeMarketplaceApplication?.brandId ?? activeRemoteChatSnapshot?.participant.id;
    if (!context || !brandId || campaign.brandId !== brandId || !isPublishedCampaign(campaign) || campaign.applicationsOpen === false) {
      showToast("Choose an open campaign from this brand in an accepted chat.", "error");
      return;
    }
    if (sentCampaignIdsForChat.includes(campaign.id)) {
      showToast("You already have a request for this campaign.");
      return;
    }
    const brief = briefs.find((item) => item.campaignId === campaign.id) ?? campaignToBrandBrief(campaign);
    setDetail({
      type: "application",
      campaign,
      brief,
      returnToChat: {
        name: detail.name,
        initials: detail.initials,
        returnTo: detail.returnTo,
        applicationId: detail.applicationId ?? activeMarketplaceApplication?.id,
        conversationId: context.conversationId,
        conversationStatus: "Accepted",
      },
    });
  };
  const openVideoBrief = (briefId: string) => {
    const task = todoTasks.find((item) => (item.briefId ?? item.id) === briefId || item.id === briefId);
    if (task) setDetail({ type: "todo", taskId: task.id });
  };
  const content =
    utilityPage === "Notifications" ? (
      <NotificationView
        onScroll={handleScroll}
        notifications={notifications}
        notificationSettings={notificationSettings}
        onMarkRead={markNotificationRead}
        onMarkAllRead={markAllNotificationsRead}
        onOpenNotification={openNotificationTarget}
        loading={notificationLoading}
        error={notificationError}
        onRetry={() => void loadRemoteNotifications()}
      />
    ) : utilityPage === "Chats" ? (
      <InboxView
        role={role}
        applications={role === "Brand"
          ? applications.filter((application) =>
              application.direction !== "brand-to-creator" &&
              (!profileName || !application.brandId || application.brandId === currentBrandId),
            )
          : applications.filter((application) => application.creatorId === currentCreator?.id)}
        conversations={persistedAuth.userId ? chatSearch.trim() ? chatSearchResults : [...marketplaceConversations, ...(adminChatConversation ? [adminChatConversation] : [])] : undefined}
        search={chatSearch}
        onSearch={(value) => { chatListRequest.current += 1; setChatSearch(value); setChatSearchResults([]); setChatListLoading(Boolean(persistedAuth.userId)); setChatHasMore(false); }}
        loading={chatListLoading}
        error={chatListError}
        onRetry={() => void loadChatList(chatSearch.trim(), false, true)}
        hasMore={chatHasMore}
        onLoadMore={() => void loadChatList(chatSearch.trim(), true)}
        onOpenApplication={(application) => openMarketplaceChat({ application, messageMine: role === "Influencer" }, { type: "utility", page: "Chats" })}
        onOpenConversation={(conversation) => {
          if (conversation.adminChat) {
            setUtilityPage(null);
            setDetail({ type: "chat", name: "Brandly", initials: "B", conversationId: conversation.id, conversationStatus: "Accepted", adminChat: true, returnTo: { type: "utility", page: "Chats" } });
            return;
          }
          const application = applications.find((item) => item.id === conversation.applicationId);
          if (application) openMarketplaceChat({ application, messageMine: role === "Influencer" }, { type: "utility", page: "Chats" });
          else setDetail({ type: "chat", name: conversation.participantName, initials: conversation.participantInitials,
            applicationId: conversation.applicationId, conversationId: conversation.id, conversationStatus: conversation.status,
            returnTo: { type: "utility", page: "Chats" } });
        }}
        onToggleFavorite={toggleConversationFavorite}
        onToggleMute={toggleConversationMute}
        onToggleBlock={(conversation) => toggleMarketplaceConversationBlock(conversation.id)}
        onScroll={handleScroll}
      />
    ) : detail?.type === "todo" ? (
      activeTodoTask ? (
        <TodoTaskDetail
          task={activeTodoTask}
          onBack={() => runBack(() => setDetail(null))}
          onToggle={() => toggleTodoTask(activeTodoTask.id)}
          onDelete={() => { void deleteTodoTask(activeTodoTask.id); }}
          onAddNote={(note) => addTodoTaskNote(activeTodoTask.id, note)}
          onUpdateNote={(noteId, note) => updateTodoTaskNote(activeTodoTask.id, noteId, note)}
          onRemoveNote={(noteId) => removeTodoTaskNote(activeTodoTask.id, noteId)}
          onOpenCalendar={openCalendar}
          onOpenChat={() => {
            const application = applications.find((item) => item.conversationId === activeTodoTask.conversationId);
            if (application) openMarketplaceChat({ application, messageMine: role === "Influencer" }, { type: "tab", tab: "Calendar" });
          }}
          onScroll={handleScroll}
          eligibleRecipients={role === "Brand" ? eligibleTaskRecipients.map(({ creator }) => ({ creator, relationship: "Accepted collaboration" })) : []}
          onSendToCreator={role === "Brand" ? (creatorId) => sendTaskToCreator(activeTodoTask, creatorId) : undefined}
          onSendToCreators={role === "Brand" ? (creatorIds) => sendTaskToCreators(activeTodoTask, creatorIds) : undefined}
        />
      ) : null
    ) : detail?.type === "flow" ? (
      <SafeAreaView style={styles.detailSafe}>
        <FlowScreen
          flow={detail.flow}
          initialReminderId={detail.reminderId}
          role={role}
          onBack={() => {
            runBack(() => {
              if (detail.returnTo?.type === "chat") {
                setDetail({
                  type: "chat",
                  name: detail.returnTo.name,
                  initials: detail.returnTo.initials,
                  returnTo: detail.returnTo.returnTo,
                  applicationId: detail.returnTo.applicationId,
                });
              } else {
                setDetail(null);
              }
            });
          }}
          onProposalSubmit={
            detail.flow === "proposal"
              ? (draft) => submitProposal(defaultProposalContext, draft)
              : undefined
          }
          onCampaignCreate={handleCampaignCreate}
          onCampaignSave={handleCampaignSave}
          initialCampaign={detail.campaign}
          onDealStatusSave={(status) =>
            handleDealStatusSave(defaultProposalContext.campaignId, status)
          }
           onReviewSubmit={handleReviewSubmit}
           reviewItems={reviewItemsForFlow}
           onReviewRequest={() => setDetail({ type: "flow", flow: "review" })}
          authoredReviews={authoredReviews.filter((review) => review.authorRole === role)}
          onReviewUpdate={updateAuthoredReview}
          savedCreators={discoverCreatorsForCompare.filter((creator) => discoverSavedIds.includes(creator.id))}
          initialDealStatus={collaborationStatuses[defaultProposalContext.campaignId]}
          proposalContext={proposalContextForApplication(detail.type === "flow" ? detail.applicationId : undefined)}
          initialLocations={creatorLocations}
          onProfileLocationsSave={updateCreatorLocations}
          initialProfile={profile}
          profileEmail={persistedAuth.email}
          profilePhone={persistedAuth.phone}
          onProfileSave={async (nextProfile) => {
            const visibility = nextProfile.isPublic === undefined
              ? (profileIsPublic ? "PUBLIC" : "PRIVATE")
              : nextProfile.isPublic ? "PUBLIC" : "PRIVATE";
            if (!persistedAuth.userId) {
              dispatch(setProfile(nextProfile));
              setProfileIsPublic(nextProfile.isPublic ?? profileIsPublic);
              updateCreatorLocations(nextProfile.locations ?? []);
              return;
            }
            const avatarUrl = nextProfile.avatarUri?.trim();
            const websiteUrl = nextProfile.websiteUrl?.trim();
            const savedUser = await updateRemoteProfile({
              displayName: nextProfile.name.trim(),
              city: nextProfile.city.trim(),
              focus: nextProfile.focus.trim(),
              bio: nextProfile.bio.trim(),
              ...(avatarUrl ? { avatarUrl } : {}),
              ...(websiteUrl && /^https?:\/\//i.test(websiteUrl) ? { websiteUrl } : {}),
              audienceSize: nextProfile.audienceSize,
              rateRange: nextProfile.rateRange,
              teamSize: nextProfile.teamSize,
              languages: nextProfile.languages ?? [],
              visibility,
              locations: nextProfile.locations ?? [],
            });
            applyRemoteUser(savedUser);
          }}
          onOpenCreator={openCreatorProfile}
          blockedUsers={blockedUsers}
          onUnblockUser={toggleBlockedUser}
          notificationSettings={notificationSettings}
          onNotificationSettingsSave={setNotificationSettings}
          reminders={visibleReminders}
          reminderSettings={reminderSettings}
          onReminderToggle={toggleReminder}
          onReminderSettingsSave={saveReminderSettings}
          onReminderItemSettingsSave={(id, settings, schedule) =>
            saveReminderItemSettings(id, settings, schedule?.enabled, schedule)
          }
          onDeleteAccount={requestAccountDeletion}
          onSupportSubmit={async (topic, message) => {
            if (!persistedAuth.userId) throw new Error("Sign in to message Brandly Support.");
            const thread = await openRemoteAdminChatConversation();
            await sendRemoteAdminChatMessage(thread.conversationId, `Support request · ${topic}\n\n${message}`, `support-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
            void loadChatList("", false, true);
          }}
          initialSocialAccounts={socialAccounts}
          verifiedSocialAccounts={verifiedSocialAccounts}
          pendingSocialAccounts={pendingSocialAccounts}
          socialAccountErrors={socialAccountErrors}
          onSocialAccountsSave={saveSocialAccounts}
          onSocialVerificationRequest={persistedAuth.userId ? requestSocialVerification : undefined}
        />
      </SafeAreaView>
    ) : detail?.type === "proposal" ? (
      <SafeAreaView style={styles.detailSafe}>
        <ProposalDetailView
          role={role}
          proposal={
            proposals.find((item) => item.id === detail.value.id) ??
            detail.value
          }
          onBack={() => runBack(() => setDetail(null))}
          onProposalStatus={handleProposalStatus}
          onChat={(name, initials) =>
            openChat(name, initials, {
              type: "proposal",
              value: selectedProposal ?? detail.value,
            })
          }
          onReminderPress={openProposalReminder}
        />
      </SafeAreaView>
    ) : detail?.type === "application" ? (
      currentCreator ? (
        <SafeAreaView style={styles.detailSafe}>
          <CampaignApplicationView
            campaign={detail.campaign}
            brief={detail.brief}
            currentCreator={currentCreator}
            onBack={() => runBack(() => detail.returnToChat ? setDetail({ type: "chat", ...detail.returnToChat }) : setDetail({ type: "campaign", value: detail.campaign }))}
            onSubmitted={(application) => detail.returnToChat
              ? openMarketplaceChat({ application, messageMine: true }, detail.returnToChat.returnTo)
              : setDetail({ type: "campaign", value: detail.campaign })}
            onSubmitApplication={submitApplication}
            onScroll={handleScroll}
          />
        </SafeAreaView>
      ) : null
    ) : detail?.type === "compareCreators" ? (
      <SafeAreaView style={styles.detailSafe}>
        <CompareCreatorsView
          creators={discoverCreatorsForCompare}
          selectedIds={discoverCompareCreatorIds}
          onBack={() => runBack(() => setDetail(null))}
          onRemove={toggleCompareCreator}
          onOpenCreator={(creator) => openCreatorProfile(creator, "compare")}
        />
      </SafeAreaView>
    ) : detail?.type === "brandProfile" ? (
      <SafeAreaView style={styles.detailSafe}>
        <BrandPublicProfileView
          brief={detail.brief}
          campaigns={campaigns}
          authoredReviews={authoredReviews}
          onOpenCampaign={(campaign) => setDetail({ type: "campaign", value: campaign })}
          onBack={() => runBack(() => {
            if (detail.returnTo) returnFromChat(detail.returnTo);
            else setDetail(null);
          })}
          onScroll={handleScroll}
          backLabel="Back to chat"
        />
      </SafeAreaView>
    ) : detail?.type === "creatorWork" ? (
      <SafeAreaView style={styles.detailSafe}>
        <CreatorWorkDetailView
          creator={detail.creator}
          work={detail.work}
          onBack={() => runBack(() => openCreatorProfile(detail.creator, detail.returnTo))}
          onScroll={handleScroll}
        />
      </SafeAreaView>
    ) : detail?.type === "influencer" && role === "Brand" ? (
      <SafeAreaView style={styles.detailSafe}>
        <BrandCreatorProfileView
          creator={detail.value}
          campaigns={brandCampaigns.filter((campaign) =>
            (campaignMatchIdsByCreator[detail.value.id] ?? []).includes(campaign.id),
          )}
          saved={discoverSavedIds.includes(detail.value.id)}
          compared={discoverCompareCreatorIds.includes(detail.value.id)}
          onBack={() => runBack(() => setDetail(detail.returnTo === "compare" ? { type: "compareCreators" } : null))}
          onToggleSaved={() => remoteDiscoverCreatorIds.has(detail.value.id) ? toggleRemoteCreatorSaved(detail.value.id) : toggleSaved(detail.value.id)}
          onToggleCompare={() => toggleCompareCreator(detail.value.id)}
          sentCampaignIds={sentCampaignIdsForCreator}
          campaignsLoading={Boolean(campaignMatchIdsLoading[detail.value.id])}
          onOpenWork={(work) => setDetail({ type: "creatorWork", creator: detail.value, work, returnTo: detail.returnTo })}
          onSendCreatorRequest={sendCreatorRequest}
          onSendCreatorRequests={sendCreatorCampaigns}
          onScroll={handleScroll}
        />
      </SafeAreaView>
    ) : detail?.type === "campaign" ? (
        <CampaignDetailsView
          campaign={detail.value}
          brief={briefs.find((brief) => brief.campaignId === detail.value.id) ?? campaignToBrandBrief(detail.value)}
          campaigns={campaigns}
          authoredReviews={authoredReviews}
          onOpenCampaign={(campaign) => setDetail({ type: "campaign", value: campaign })}
           role={role}
           isOwner={Boolean(
             role === "Brand" && (
               (Boolean(detail.value.brandId) && detail.value.brandId === (currentBrandId ?? currentActorId)) ||
               (!detail.value.brandId && detail.value.brand === currentBrandName)
             ),
           )}
           eligibleCreators={eligibleCampaignRecipients}
          eligibleCreatorsLoading={Boolean(campaignMatchesLoading[detail.value.id])}
          sentCreatorIds={applications.filter((application) => application.campaignId === detail.value.id && application.brandId === (currentBrandId ?? currentActorId)).map((application) => application.creatorId)}
          hasAcceptedCollaboration={acceptedCampaignIds.includes(detail.value.id)}
          onSendToCreator={(creatorId) => {
            const creator = eligibleCampaignRecipients.find((item) => item.id === creatorId);
            return creator ? sendCreatorRequest(creator, detail.value) : false;
          }}
          onSendToCreators={(creatorIds) => sendCreatorRequests(detail.value, creatorIds)}
          viewerBrandName={role === "Brand" ? currentBrandName : undefined}
          viewerBrandLogoUrl={role === "Brand" ? profile.avatarUri : undefined}
        application={applications.find((application) =>
          application.creatorId === currentCreator?.id &&
          (application.campaignId ?? application.briefId) === detail.value.id,
        )}
        blocked={Boolean(currentCreator && marketplaceBlocks.some((block) =>
          block.creatorId === currentCreator.id &&
          block.brandId === (detail.value.brandId ?? "") &&
          (!block.campaignId || block.campaignId === detail.value.id),
        ))}
        onBack={() => runBack(() => setDetail(null))}
        onApply={() => openCampaignApplication(detail.value)}
        onEdit={() => setDetail({ type: "flow", flow: "campaign-form", campaign: detail.value })}
        onChangeVisibility={(visibility) => {
          if (visibility === "private" && acceptedCampaignIds.includes(detail.value.id)) {
            showToast("Accepted campaigns must stay public.");
            return;
          }
          const updated = { ...detail.value, visibility, updatedAt: new Date().toISOString() };
          if (persistedAuth.userId && isUuid(detail.value.id)) {
            void updateRemoteCampaign(detail.value.id, {
              id: detail.value.id,
              title: updated.title,
              city: updated.city,
              category: updated.category,
              budget: updated.budget,
              description: updated.description,
              deadline: updated.deadline,
              platforms: updated.platforms,
              deliverables: updated.deliverables,
              requirements: updated.requirements,
              creatorRequirements: updated.creatorRequirements,
              collaborationVideoUrl: updated.collaborationVideoUrl,
              collaborationVideoLabel: updated.collaborationVideoLabel,
              media: updated.media,
              visibility: visibility === "private" ? "PRIVATE" : "PUBLIC",
              publish: updated.status !== "Draft",
            }).then((saved) => {
              upsertCampaign(saved);
              setDetail({ type: "campaign", value: saved });
              showToast(`Campaign is now ${visibility}.`);
            }).catch((error) => showToast(error instanceof Error ? error.message : "Campaign visibility could not be saved", "error"));
            return;
          }
          upsertCampaign(updated);
          setDetail({ type: "campaign", value: updated });
          showToast(`Campaign is now ${visibility}.`);
        }}
        onPublish={() => {
          handleCampaignSave({
            id: detail.value.id,
            title: detail.value.title,
            city: detail.value.city,
            category: detail.value.category,
            budget: detail.value.budget,
            description: detail.value.description,
            deadline: detail.value.deadline,
            platforms: detail.value.platforms,
            deliverables: detail.value.deliverables,
            requirements: detail.value.requirements,
            creatorRequirements: detail.value.creatorRequirements,
            collaborationVideoUrl: detail.value.collaborationVideoUrl,
            collaborationVideoLabel: detail.value.collaborationVideoLabel,
            media: detail.value.media,
          }, true);
          setDetail({ type: "campaign", value: { ...detail.value, status: "Published", publishedAt: detail.value.publishedAt ?? new Date().toISOString() } });
        }}
        onScroll={handleScroll}
      />
    ) : detail?.type === "chat" ? (
      <ChatDetail
        key={detail.conversationId ?? `${detail.name}-${detail.initialMessage ?? ""}`}
        name={detail.name}
        initials={detail.initials}
        adminChat={detail.adminChat}
        avatarUrl={detail.adminChat ? undefined : activeRemoteChatSnapshot?.participant.avatarUrl ?? activeMarketplaceConversation?.participantAvatarUrl ?? getChatProfile(detail.name).avatarUrl}
        role={role}
        liveSession={Boolean(persistedAuth.userId)}
        online={detail.adminChat ? activeAdminChatSnapshot?.online ?? adminChatConversation?.online ?? false : activeRemoteChatSnapshot?.participant.online ?? activeMarketplaceConversation?.online ?? false}
        typing={!detail.adminChat && Boolean(activeChatConversationId && chatTyping[activeChatConversationId])}
        onBack={() => runBack(() => returnFromChat(detail.returnTo))}
        onOpenProfile={() => {
          if (detail.adminChat) return;
          const participantId = role === "Brand"
            ? activeRemoteChatSnapshot?.participant.id ?? activeMarketplaceConversation?.creatorId ?? activeMarketplaceApplication?.creatorId
            : activeMarketplaceConversation?.brandId ?? activeMarketplaceApplication?.brandId;
          const returnTo = { type: "chat" as const, name: detail.name, initials: detail.initials, returnTo: detail.returnTo };
          const openRemoteProfile = (remoteProfile: ApiPublicProfile) => {
            const profile = mapRemoteChatProfile(remoteProfile);
            if (role === "Brand") {
              remoteDiscoverProfileCache.current.set(remoteProfile.id, remoteProfile);
              setRemoteDiscoverProfiles((current) => [...current.filter((item) => item.id !== remoteProfile.id), remoteProfile]);
            }
            setDetail({ type: "profile", value: profile, returnTo });
          };
          const cachedProfile = participantId
            ? remoteDiscoverProfileCache.current.get(participantId)
            : undefined;
          if (cachedProfile) openRemoteProfile(cachedProfile);
          if (persistedAuth.userId && participantId && isUuid(participantId)) {
            void getRemotePublicProfile(participantId)
              .then(openRemoteProfile)
              .catch(() => {
                if (!cachedProfile) showToast("Could not load the latest profile. Check your connection and try again.", "error");
              });
            return;
          }
          const latestDirectoryProfile = participantId
            ? Array.from(remoteDiscoverProfileCache.current.values()).find((item) => item.id === participantId)
            : Array.from(remoteDiscoverProfileCache.current.values()).find((item) => item.profile?.displayName?.trim().toLowerCase() === detail.name.trim().toLowerCase());
          if (latestDirectoryProfile) {
            openRemoteProfile(latestDirectoryProfile);
            return;
          }
          if (role === "Influencer") {
            openBrandProfile(
              activeMarketplaceApplication?.brandId ?? activeMarketplaceConversation?.brandId,
              activeMarketplaceApplication?.campaignId ?? activeMarketplaceConversation?.campaignId,
              detail.returnTo,
            );
            return;
          }
          openChatProfile(detail.name, detail.returnTo);
        }}
        blocked={!detail.adminChat && Boolean(activeRemoteChatSnapshot?.blockedBy?.length || activeMarketplaceConversation?.blockedBy.length || blockedUsers.includes(detail.name))}
        conversationStatus={detail.adminChat ? detail.conversationStatus ?? "Accepted" : activeRemoteChatSnapshot?.status ?? activeMarketplaceApplication?.status ?? detail.conversationStatus ?? "Accepted"}
        initialMessage={detail.initialMessage}
        initialMessageMine={detail.initialMessageMine}
        initialAttachments={detail.adminChat ? undefined : detail.initialAttachments}
        application={detail.adminChat ? undefined : activeMarketplaceApplication}
        conversationId={detail.conversationId}
        storedMessages={detail.adminChat ? activeAdminChatSnapshot?.messages.map(mapRemoteAdminChatMessage) : activeMarketplaceConversation?.messages ?? activeRemoteChatSnapshot?.messages}
        historyLoading={chatHistoryLoading}
        historyError={chatHistoryError}
        hasOlderMessages={detail.adminChat ? Boolean(activeAdminChatSnapshot?.nextCursor) : Boolean(activeMarketplaceConversation ? activeMarketplaceConversation.messageCursor : activeRemoteChatSnapshot?.nextCursor)}
        onLoadOlderMessages={() => { if (!activeChatConversationId) return; if (detail.adminChat) void loadAdminChatHistory(activeChatConversationId, activeAdminChatSnapshot?.nextCursor); else void loadChatHistory(activeChatConversationId, activeMarketplaceConversation?.messageCursor ?? activeRemoteChatSnapshot?.nextCursor); }}
        onRetryHistory={() => { if (!activeChatConversationId) return; if (detail.adminChat) void loadAdminChatHistory(activeChatConversationId); else void loadChatHistory(activeChatConversationId, undefined, true); }}
        videoBriefs={activeChatBriefs}
        tasks={todoTasks}
        receivedTaskSourceIds={todoTasks.filter((task) => task.sourceTaskId && (!currentCreator || task.creatorId === currentCreator.id)).flatMap((task) => task.sourceTaskId ? [task.sourceTaskId] : [])}
        campaigns={role === "Brand"
          ? brandCampaigns.filter((campaign) =>
              isPublishedCampaign(campaign) &&
              campaign.applicationsOpen !== false &&
              (campaignMatchIdsByCreator[chatCampaignCreatorId ?? ""] ?? []).includes(campaign.id),
            )
          : campaigns.filter((campaign) =>
              isPublishedCampaign(campaign) &&
              campaign.applicationsOpen !== false &&
              campaign.brandId === (activeMarketplaceConversation?.brandId ?? activeMarketplaceApplication?.brandId ?? activeRemoteChatSnapshot?.participant.id),
            )}
        campaignsLoading={role === "Brand" && Boolean(campaignMatchIdsLoading[chatCampaignCreatorId ?? ""])}
        sentCampaignIds={sentCampaignIdsForChat}
        sentTaskIds={sentTaskIdsForChat}
        onSendTask={sendTaskInActiveChat}
        onSendCampaign={handleChatCampaignSelection}
        onRequestCampaigns={() => setChatCampaignsRequested(true)}
        onOpenVideoBrief={openVideoBrief}
        onOpenTask={(task) => setDetail({ type: "todo", taskId: task.id })}
        onAddTaskToTodo={addReceivedTaskToTodo}
        onOpenCampaign={(campaign) => setDetail({ type: "campaign", value: campaign })}
        campaignRequests={applications}
        onAcceptCampaignRequest={acceptMarketplaceApplication}
        onRejectCampaignRequest={(applicationId) => rejectMarketplaceApplication(applicationId, "Creator declined this campaign request.", false)}
        onSendMessage={async (message) => {
          if (!activeChatConversationId) throw new Error("Open a valid conversation before sending a message.");
          if (detail.adminChat) {
            const saved = await sendRemoteAdminChatMessage(activeChatConversationId, message.text, message.clientMessageId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, message.attachments?.map(({ id, name, type, uri }) => ({ id, name, type, uri: uri ?? "" })));
            setAdminChatSnapshot((current) => current?.conversationId === activeChatConversationId && !current.messages.some((item) => item.id === saved.id) ? { ...current, messages: [...current.messages, saved] } : current);
            setAdminChatConversation((current) => current?.id === activeChatConversationId ? { ...current, preview: saved.text, updatedAt: saved.createdAt, unreadCount: 0 } : current);
            return mapRemoteAdminChatMessage(saved);
          }
          if (persistedAuth.userId && isUuid(activeChatConversationId)) {
            const saved = await sendRemoteChatMessage(activeChatConversationId, {
              text: message.text,
              attachments: message.attachments,
              clientMessageId: message.clientMessageId,
              replyToId: message.replyToId,
            });
            dispatch(addMarketplaceMessageAction({ conversationId: activeChatConversationId, message: mapRemoteChatMessage(saved) }));
            setRemoteChatSnapshots((current) => {
              const snapshot = current[activeChatConversationId];
              if (!snapshot) return current;
              return { ...current, [activeChatConversationId]: { ...snapshot, messages: mergeRemoteChatMessage(snapshot.messages, mapRemoteChatMessage(saved)) } };
            });
            return mapRemoteChatMessage(saved);
          }
          addMarketplaceMessage(activeChatConversationId, message);
          return message;
        }}
        onTyping={detail.adminChat ? undefined : (typing) => {
          if (persistedAuth.userId && activeChatConversationId && isUuid(activeChatConversationId)) {
            void sendChatTyping(activeChatConversationId, typing).catch(() => undefined);
          }
        }}
        onUpdateMessage={detail.adminChat ? undefined : async (messageId, changes) => {
          if (!activeChatConversationId) return;
          if (persistedAuth.userId && isUuid(activeChatConversationId) && isUuid(messageId)) {
            const saved = await updateRemoteChatMessage(activeChatConversationId, messageId, { text: changes.text, attachments: changes.attachments });
            dispatch(updateMarketplaceMessageAction({ conversationId: activeChatConversationId, messageId, changes: mapRemoteChatMessage(saved) }));
            setRemoteChatSnapshots((current) => {
              const snapshot = current[activeChatConversationId];
              if (!snapshot) return current;
              return { ...current, [activeChatConversationId]: { ...snapshot, messages: mergeRemoteChatMessage(snapshot.messages, mapRemoteChatMessage(saved)) } };
            });
            return;
          }
          updateMarketplaceMessage(activeChatConversationId, messageId, changes);
        }}
        onDeleteMessage={detail.adminChat ? undefined : async (messageId) => {
          if (!activeChatConversationId) return;
          if (persistedAuth.userId && isUuid(activeChatConversationId) && isUuid(messageId)) {
            await deleteRemoteChatMessage(activeChatConversationId, messageId);
            const changes = { deleted: true, text: "This message was deleted", attachments: [], attachmentName: undefined, replyTo: undefined, taskId: undefined, campaignRequestId: undefined, videoBriefId: undefined };
            dispatch(updateMarketplaceMessageAction({ conversationId: activeChatConversationId, messageId, changes }));
            setRemoteChatSnapshots((current) => {
              const snapshot = current[activeChatConversationId];
              if (!snapshot) return current;
              return { ...current, [activeChatConversationId]: { ...snapshot, messages: snapshot.messages.map((message) => message.id === messageId ? { ...message, ...changes } : message) } };
            });
            return;
          }
          updateMarketplaceMessage(activeChatConversationId, messageId, { deleted: true, text: "This message was deleted", attachments: [], attachmentName: undefined, replyTo: undefined, taskId: undefined, campaignRequestId: undefined, videoBriefId: undefined });
        }}
        onAcceptApplication={
          detail.applicationId
            ? () => acceptMarketplaceApplication(detail.applicationId!)
            : undefined
        }
        onConfirmCompletion={detail.applicationId ?? activeMarketplaceApplication?.id ? () => confirmCollaborationComplete((detail.applicationId ?? activeMarketplaceApplication!.id)) : undefined}
        onReviewApplication={detail.applicationId ?? activeMarketplaceApplication?.id ? () => setDetail({ type: "flow", flow: "review", applicationId: detail.applicationId ?? activeMarketplaceApplication!.id, returnTo: { type: "chat", name: detail.name, initials: detail.initials, returnTo: detail.returnTo, applicationId: detail.applicationId ?? activeMarketplaceApplication!.id } }) : undefined}
        onRejectApplication={
          detail.applicationId
            ? (reason, canReapply) => rejectMarketplaceApplication(detail.applicationId!, reason, canReapply)
            : undefined
        }
        onToggleBlock={
          detail.adminChat ? undefined : detail.conversationId
            ? () => toggleMarketplaceConversationBlock(detail.conversationId!)
            : () => toggleBlockedUser(detail.name)
        }
      />
    ) : detail ? (
      <SafeAreaView style={styles.detailSafe}>
        <DetailView
          detail={detail as ContentDetail}
          role={role}
          onBack={() =>
            runBack(() => {
              if (detail.type === "profile" && detail.returnTo?.type === "chat") {
                setDetail({
                  type: "chat",
                  name: detail.returnTo.name,
                  initials: detail.returnTo.initials,
                  returnTo: detail.returnTo.returnTo,
                });
              } else {
                setDetail(null);
              }
            })
          }
          onProposalSubmit={(context, draft) => submitProposal(context, draft)}
          proposals={proposals}
          onOpenProposal={(proposal) => setDetail({ type: "proposal", value: proposal })}
          proposalContext={defaultProposalContext}
          savedCreatorIds={role === "Brand" && persistedAuth.userId ? discoverSavedIds : savedIds}
          onToggleCreatorSaved={(creatorId) => {
            if (persistedAuth.userId && isUuid(creatorId)) toggleRemoteCreatorSaved(creatorId);
            else toggleSaved(creatorId);
          }}
          initialLocations={creatorLocations}
          onProfileLocationsSave={updateCreatorLocations}
          blockedUsers={blockedUsers}
          onBlockUser={toggleBlockedUser}
          notificationSettings={notificationSettings}
          onNotificationSettingsSave={setNotificationSettings}
          onDeleteAccount={requestAccountDeletion}
          onOpenChatProfile={openChatProfile}
          initialSocialAccounts={socialAccounts}
          verifiedSocialAccounts={verifiedSocialAccounts}
          pendingSocialAccounts={pendingSocialAccounts}
          socialAccountErrors={socialAccountErrors}
          onSocialAccountsSave={saveSocialAccounts}
          onSocialVerificationRequest={persistedAuth.userId ? requestSocialVerification : undefined}
          onCampaignCreate={handleCampaignCreate}
          onApplyToCampaign={(campaign) => {
            const brief = briefs.find((item) => item.campaignId === campaign.id) ?? campaignToBrandBrief(campaign);
            setDetail({ type: "application", campaign, brief });
          }}
          campaigns={role === "Brand" && detail.type === "profile" && detail.value.kind === "creator"
            ? brandCampaigns.filter((campaign) =>
                (campaignMatchIdsByCreator[detail.value.id] ?? []).includes(campaign.id),
              )
            : campaigns}
          campaignsLoading={Boolean(role === "Brand" && detail.type === "profile" && detail.value.kind === "creator" && campaignMatchIdsLoading[detail.value.id])}
          liveData={Boolean(persistedAuth.userId)}
          reviewItems={reviewItemsForFlow}
          savedCreators={(role === "Brand" && persistedAuth.userId && !adminThemePreview ? remoteDiscoverAllCreators : allInfluencers).filter((creator) => (role === "Brand" && persistedAuth.userId && !adminThemePreview ? discoverSavedIds : savedIds).includes(creator.id))}
          brandId={currentBrandId}
          onSendCreatorRequest={sendCreatorRequest}
          onSendCreatorRequests={sendCreatorCampaigns}
          sentCampaignIds={sentCampaignIdsForCreator}
          onDealStatusSave={(status) =>
            handleDealStatusSave(defaultProposalContext.campaignId, status)
          }
          onReviewSubmit={handleReviewSubmit}
          authoredReviews={authoredReviews.filter((review) => review.authorRole === role)}
          onReviewUpdate={updateAuthoredReview}
          initialDealStatus={
            collaborationStatuses[defaultProposalContext.campaignId]
          }
          profileIsPublic={profileIsPublic}
          onProfileVisibilitySave={saveProfileVisibility}
        />
      </SafeAreaView>
    ) : activeTab === "Home" ? (
      <HomeDashboard
        role={role}
        onScroll={handleScroll}
        onDiscover={showDiscover}
        onInfluencer={(value) => {
          const creator = (role === "Brand" && !adminThemePreview ? remoteDiscoverAllCreators : allInfluencers).find((item) => item.id === value.id);
          if (creator) openCreatorProfile(creator);
        }}
        onCampaign={(value) =>
          value ? setDetail({ type: "campaign", value }) : showCampaigns()
        }
         onProfileEdit={() => setDetail({ type: "flow", flow: "profile-form" })}
         onOpenCampaignVideo={(url) => void openExternalLink(url, "Campaign video")}
          tasks={todoTasks}
          ideas={previewIdeas}
          applications={homeApplications}
          profileCompletion={profileCompletion}
          onToggleTask={toggleTodoTask}
          onOpenTask={(task) => setDetail({ type: "todo", taskId: task.id })}
         onOpenCalendar={openCalendar}
         onCreateTask={role === "Influencer" ? openNewCreatorTask : undefined}
         additionalCampaigns={role === "Brand" ? brandCampaigns : campaigns}
         privateCampaignIds={privateCampaignIds}
         creatorDirectory={role === "Brand" ? adminThemePreview ? allInfluencers : remoteDiscoverAllCreators : undefined}
         loading={homeDataLoading}
         onChat={(name, initials) =>
           openChat(name, initials, { type: "tab", tab: "Home" })
         }
         onOpenApplication={(application) =>
           openMarketplaceChat({ application, messageMine: false }, { type: "tab", tab: "Home" })
         }
        onReminderPress={openProposalReminder}
        proposals={proposals}
        onProposal={(value) => setDetail({ type: "proposal", value })}
      />
    ) : activeTab === "Calendar" ? (
      <CalendarView
        tasks={calendarTasks}
        projects={role === "Influencer" ? previewProjects : []}
        campaigns={brandCampaigns}
        creators={role === "Brand" ? adminThemePreview ? allInfluencers : remoteDiscoverAllCreators : []}
        role={role}
        onToggleTask={toggleTodoTask}
        onOpenTask={(task) => setDetail({ type: "todo", taskId: task.id })}
        onAddTask={addTodoTask}
        onUpdateTask={updateTodoTask}
        onRequestTasks={(range) => void loadRemoteTasks(range).catch(() => undefined)}
        openComposerOnMount={openCalendarComposer}
        onComposerOpened={() => setOpenCalendarComposer(false)}
        onScroll={handleScroll}
      />
    ) : activeTab === "Studio" && role === "Influencer" ? (
      <StudioView
        ideas={previewIdeas}
        projects={previewProjects}
        tasks={todoTasks}
        isLoading={marketplaceLoading || studioLoading}
        isSaving={studioSaving}
        onAddIdea={addContentIdea}
        onUpdateIdea={updateContentIdea}
        onCreateProject={createStudioProject}
        onAddIdeaNote={addStudioNote}
        onUpdateIdeaNote={updateStudioNote}
        onRemoveIdeaNote={removeStudioNote}
        onArchiveIdea={(id) => archiveContentIdea(id, true)}
        onUnarchiveIdea={(id) => archiveContentIdea(id, false)}
        onToggleTask={toggleTodoTask}
        onOpenTask={(task) => setDetail({ type: "todo", taskId: task.id })}
        onOpenCalendar={openCalendar}
        onSaveStageDraft={saveStudioStageDraft}
        onCompleteStage={completeStudioStage}
        onUpdateProject={updateStudioProject}
        onScroll={handleScroll}
        openComposer={openStudioComposer}
        onComposerOpened={() => setOpenStudioComposer(false)}
      />
    ) : activeTab === "Market" && role === "Influencer" ? (
      <>
      <MarketplaceView
        role={role}
        filters={marketFilters}
        onChangeFilters={setMarketFilters}
        onOpenFilters={() => setMarketFiltersOpen(true)}
        onClearFilters={() => setMarketFilters(DEFAULT_DISCOVER_FILTERS)}
        filterCount={getAppliedFilterCount(marketFilters)}
        briefs={briefs}
        campaigns={campaigns}
        authoredReviews={authoredReviews}
        creators={influencers}
        applications={applications}
        currentCreator={currentCreator}
        blockedCampaignIds={blockedCampaignIds}
        onOpenCampaign={(campaignId) => {
          const campaign = campaigns.find((item) => item.id === campaignId);
          if (campaign) setDetail({ type: "campaign", value: campaign });
        }}
        onSubmitApplication={submitApplication}
        onOpenChat={openMarketplaceChat}
        onScroll={handleScroll}
        loading={Boolean(persistedAuth.userId && !realCampaignsReady)}
      />
      <DiscoverFilterDrawer visible={marketFiltersOpen} value={marketFilters} states={INDIA_STATES} target="briefs" onClose={() => setMarketFiltersOpen(false)} onApply={(nextFilters) => { setMarketFilters(nextFilters); setMarketFiltersOpen(false); }} />
      </>
    ) : activeTab === "Discover" ? (
      <DiscoverView
        role={role}
        savedLocations={creatorLocations}
        onScroll={handleScroll}
        onInfluencer={(value) => {
          openCreatorProfile(value);
        }}
        onCampaign={(value) => setDetail({ type: "campaign", value })}
        additionalCampaigns={campaigns}
        privateCampaignIds={privateCampaignIds}
        realCampaignsReady={realCampaignsReady}
        compareCreatorIds={discoverCompareCreatorIds}
        onToggleCompare={toggleCompareCreator}
        onOpenCompare={() => setDetail({ type: "compareCreators" })}
        backendCreators={role === "Brand" && !adminThemePreview ? remoteDiscoverCreators : undefined}
        backendAllCreators={role === "Brand" && !adminThemePreview ? remoteDiscoverAllCreators : undefined}
        backendQuery={role === "Brand" && !adminThemePreview ? remoteDiscoverQuery : undefined}
        onBackendQueryChange={role === "Brand" && !adminThemePreview ? setRemoteDiscoverQuery : undefined}
        backendSavedIds={role === "Brand" && !adminThemePreview ? discoverSavedIds : undefined}
        onBackendSave={role === "Brand" && !adminThemePreview ? toggleRemoteCreatorSaved : undefined}
        backendLoading={role === "Brand" && !adminThemePreview ? remoteDiscoverLoading : undefined}
         initialFilters={marketFilters}
       />
    ) : activeTab === "Campaigns" ? (
      <CampaignsView
        role={role}
        onScroll={handleScroll}
        onCampaign={(value) => setDetail({ type: "campaign", value })}
        onCreate={() => setDetail({ type: "flow", flow: "campaign-form" })}
        additionalCampaigns={[]}
        privateCampaignIds={privateCampaignIds}
        acceptedCampaignIds={acceptedCampaignIds}
         proposals={proposals}
         onProposal={(proposal) => setDetail({ type: "proposal", value: proposal })}
         onReminderPress={openProposalReminder}
         loading={Boolean(persistedAuth.userId && !realCampaignsReady)}
         onEditCampaign={(campaign) => setDetail({ type: "flow", flow: "campaign-form", campaign })}
        onPublishCampaign={(campaign) => handleCampaignSave({ id: campaign.id, title: campaign.title, city: campaign.city, category: campaign.category, budget: campaign.budget, description: campaign.description, deadline: campaign.deadline, platforms: campaign.platforms, deliverables: campaign.deliverables, requirements: campaign.requirements, creatorRequirements: campaign.creatorRequirements, collaborationVideoUrl: campaign.collaborationVideoUrl, collaborationVideoLabel: campaign.collaborationVideoLabel, media: campaign.media }, true)}
        onArchiveCampaign={(campaign) => handleCampaignArchive(campaign.id)}
        onChangeVisibility={(campaign, visibility) => {
          if (visibility === "private" && acceptedCampaignIds.includes(campaign.id)) {
            showToast("Accepted campaigns must stay public.");
            return;
          }
          const updated = { ...campaign, visibility, updatedAt: new Date().toISOString() };
          if (persistedAuth.userId && isUuid(campaign.id)) {
            void updateRemoteCampaign(campaign.id, {
              id: campaign.id,
              title: campaign.title,
              city: campaign.city,
              category: campaign.category,
              budget: campaign.budget,
              description: campaign.description,
              deadline: campaign.deadline,
              platforms: campaign.platforms,
              deliverables: campaign.deliverables,
              requirements: campaign.requirements,
              creatorRequirements: campaign.creatorRequirements,
              collaborationVideoUrl: campaign.collaborationVideoUrl,
              collaborationVideoLabel: campaign.collaborationVideoLabel,
              media: campaign.media,
              visibility: visibility === "private" ? "PRIVATE" : "PUBLIC",
              publish: campaign.status !== "Draft",
            }).then((saved) => upsertCampaign(saved)).catch((error) => showToast(error instanceof Error ? error.message : "Campaign visibility could not be saved", "error"));
            return;
          }
          upsertCampaign(updated);
          showToast(`Campaign is now ${visibility}.`);
        }}
        currentBrandId={adminThemePreview ? undefined : currentBrandId}
        currentBrandName={adminThemePreview ? undefined : currentBrandName}
      />
    ) : activeTab === "Budget" && role === "Brand" ? (
      <BudgetView
        campaigns={campaigns}
        proposals={proposals}
        currentBrandId={currentBrandId}
        applications={applications}
        onSavePayment={async (applicationId, amount, paid) => {
          if (!persistedAuth.userId || !isUuid(applicationId)) return false;
          await updateRemoteCampaignPayment(applicationId, { amount, paid });
          dispatch(hydrateCampaignMarketplace(await getRemoteCampaigns()));
          showToast("Payment record saved.", "success");
          return true;
        }}
        onScroll={handleScroll}
      />
    ) : activeTab === "Proposals" ? (
      <ProposalView
        role={role}
        proposals={proposals}
        onScroll={handleScroll}
        onProposal={(value) => setDetail({ type: "proposal", value })}
        onProposalStatus={handleProposalStatus}
        onReminderPress={openProposalReminder}
        onChat={(name, initials) =>
          openChat(name, initials, { type: "tab", tab: "Proposals" })
        }
      />
    ) : (
      <ProfileView
        role={role}
        mode={mode}
        onScroll={handleScroll}
        onTheme={toggleTheme}
        onFlow={(flow) => setDetail({ type: "flow", flow })}
        onOpenReminders={() => {
          void loadRemoteTasks({ remindersOnly: true }).catch(() => undefined);
          setDetail({ type: "flow", flow: "reminders" });
        }}
        savedLocations={creatorLocations}
        profileIsPublic={profileIsPublic}
        isSavingProfileVisibility={isSavingProfileVisibility}
        profile={profile}
        profileCompletion={profileCompletion}
        phoneVerified={persistedAuth.phoneVerified}
        emailVerified={persistedAuth.emailVerified}
        onOpenProfilePreview={() =>
          setDetail({ type: "profile", value: profilePreview, readOnly: true })
        }
        socialAccounts={socialAccounts}
        verifiedSocialAccounts={verifiedSocialAccounts}
        onProfileVisibilitySave={saveProfileVisibility}
        isLoggingOut={isLoggingOut}
        reviewRating={profileReviewSummary.rating}
        reviewCount={profileReviewSummary.count}
        onLogout={handleLogout}
      />
    );

  const pageTitle = utilityPage
    ? utilityPage === "Chats"
      ? role === "Brand" ? "Brand inbox" : "Creator inbox"
      : role === "Brand" ? "Brand updates" : "Creator updates"
    : activeTab === "Home"
      ? role === "Brand" ? "Brand workspace" : "Creator home"
      : role === "Brand"
        ? {
            Studio: "Creator studio",
            Market: "Find creators",
            Discover: "Find creators",
            Campaigns: "Brand campaigns",
            Calendar: "Calendar",
            Budget: "Budget & payments",
            Proposals: "Creator proposals",
            Profile: "Brand profile",
          }[activeTab]
        : {
            Studio: "Creator studio",
            Market: "Find briefs",
            Discover: "Find briefs",
            Campaigns: "Creator campaigns",
            Calendar: "Calendar",
            Budget: "Budget",
            Proposals: "My applications",
            Profile: "Creator profile",
          }[activeTab];
  const pageTagline = utilityPage
    ? utilityPage === "Chats"
      ? role === "Brand"
        ? "Accepted creator conversations"
        : "Accepted brand conversations"
      : role === "Brand"
        ? "Proposal and campaign updates"
        : "Application and collaboration updates"
    : activeTab !== "Home"
      ? role === "Brand"
        ? activeTab === "Studio"
          ? "Save ideas and manage daily work"
          : activeTab === "Market" || activeTab === "Discover"
          ? "Search by audience, niche and location"
          : activeTab === "Campaigns"
            ? "Create and manage creator briefs"
            : activeTab === "Calendar"
              ? "Plan and track your content tasks"
            : activeTab === "Budget"
              ? "Track commitments and creator payments"
            : activeTab === "Proposals"
              ? "Review creator applications"
              : "Manage your brand account"
        : activeTab === "Studio"
          ? "Save ideas and manage daily work"
          : activeTab === "Market" || activeTab === "Discover"
          ? "Browse campaigns that match your audience"
          : activeTab === "Campaigns"
            ? "Public briefs and your applications"
            : activeTab === "Calendar"
              ? "Plan uploads and collaboration tasks"
            : activeTab === "Budget"
              ? "Review campaign budgets and payments"
            : activeTab === "Proposals"
              ? "Track applications and requests"
              : "Manage your creator account"
      : null;
  const isDarkMode = mode === "dark";
  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.read && notificationSettings[notification.category],
  ).length;
  const roleBackground = isDarkMode
    ? theme.colors.background
    : role === "Brand"
      ? theme.colors.backgroundBrand
      : theme.colors.backgroundCreator;
  return (
    <View style={[styles.app, { backgroundColor: roleBackground }]}>
      {!isDarkMode ? (
        <View pointerEvents="none" style={styles.roleBackdrop}>
          <View style={[styles.backdropShapePrimary, role === "Brand" ? styles.backdropBrandPrimary : styles.backdropCreatorPrimary]} />
          <View style={[styles.backdropShapeSecondary, role === "Brand" ? styles.backdropBrandSecondary : styles.backdropCreatorSecondary]} />
          <View style={[styles.backdropShapeTertiary, role === "Brand" ? styles.backdropBrandTertiary : styles.backdropCreatorTertiary]} />
        </View>
      ) : null}
      {!detail ? (
        <Animated.View
          testID="theme-component-appBar"
          style={[
            styles.topbar,
            styles.topbarOverlay,
            typeof theme.components.appBar.background === "string" ? { backgroundColor: theme.components.appBar.background } : null,
            {
              paddingTop: Math.max(insets.top, theme.spacing.lg),
              opacity: chromeProgress,
              transform: [
                {
                  translateY: chromeProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-84, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.topbarTitle}>
            <Text numberOfLines={1} style={[styles.wordmark, typeof theme.components.appBar.foreground === "string" ? { color: theme.components.appBar.foreground } : null]}>
              {pageTitle}
            </Text>
            {pageTagline ? (
              <Text numberOfLines={1} style={[styles.tagline, typeof theme.components.appBar.foreground === "string" ? { color: theme.components.appBar.foreground } : null]}>
                {pageTagline}
              </Text>
            ) : null}
          </View>
          <View style={styles.topbarActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={unreadNotificationCount ? `Open notifications, ${unreadNotificationCount} unread` : "Open notifications"}
              onPress={() => {
                setDetail(null);
                setUtilityPage("Notifications");
              }}
              style={({ pressed }) => [styles.notification, pressed && { backgroundColor: theme.colors.surfaceMuted }]}
            >
              <AppIcon
                name="notifications-outline"
                size={21}
                color={theme.colors.primary}
              />
              {unreadNotificationCount > 0 ? <View style={styles.notificationBadge} pointerEvents="none"><Text style={styles.notificationBadgeText}>{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}</Text></View> : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open profile for ${profile.name || "your account"}`}
              onPress={() => {
                setDetail(null);
                setUtilityPage(null);
                changeTab("Profile");
              }}
              style={styles.notification}
            >
              <Avatar
                initials={getProfileInitials(profile.name || (role === "Brand" ? "Brand" : "Creator"))}
                uri={profile.avatarUri}
                size="small"
              />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
      {!detail ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.chromeSpacer,
            {
              height: chromeLayoutProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [
                  0,
                  Math.max(insets.top, theme.spacing.lg) +
                    theme.spacing.md +
                    44,
                ],
              }),
            },
          ]}
        />
      ) : null}
      <Animated.View
        style={[
          styles.content,
          !detail && {
            paddingBottom: chromeLayoutProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 56 + insets.bottom],
            }),
          },
        ]}
      >
        {content}
      </Animated.View>
      {!detail && (
        <Animated.View
          style={[
            styles.bottomChrome,
            {
              opacity: chromeProgress,
              transform: [
                {
                  translateY: chromeProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [92, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {(activeTab === "Home" || activeTab === "Calendar") && !utilityPage ? (
            <View
              style={[
                styles.homeAddButton,
                { bottom: 56 + insets.bottom + theme.spacing.sm },
              ]}
            >
              <IconButton name="add" label="Add task" variant="primary" onPress={openNewCreatorTask} />
            </View>
          ) : null}
          <BottomTabs
            active={activeTab}
            role={role}
            onChange={changeTab}
            onChat={() => {
              setDetail(null);
              setUtilityPage("Chats");
            }}
            chatActive={utilityPage === "Chats"}
            chatUnreadCount={chatUnreadCount}
          />
        </Animated.View>
      )}
      <ReminderSettingsSheet
        visible={proposalReminderTarget !== null}
        title={proposalReminderTarget?.title ?? "Delivery reminder"}
        detail="Update this proposal reminder without leaving your proposal list."
        campaignTitle={proposalReminderTarget?.campaignTitle ?? ""}
        participantName={proposalReminderTarget?.participantName ?? ""}
        deliveryDate={proposalReminderTarget?.deliveryDate}
        deliveryTime={proposalReminderTarget?.deliveryTime}
        settings={proposalReminderDraft}
        onChange={setProposalReminderDraft}
        onClose={() => setProposalReminderTarget(null)}
        onSave={() => {
          if (proposalReminderTarget) {
            saveReminderItemSettings(
              proposalReminderTarget.id,
              proposalReminderDraft,
              proposalReminderEnabled,
            );
          }
          setProposalReminderTarget(null);
          showToast("Delivery reminder saved");
        }}
        enabled={proposalReminderEnabled}
        onEnabledChange={setProposalReminderEnabled}
      />
    </View>
  );
}
