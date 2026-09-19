import {
  ComponentProps,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  BackHandler,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  AppButton,
  AppCard,
  AppIcon,
  Avatar,
  BottomTabs,
  ConfirmModal,
  FilterChip,
  IconButton,
  MarketplaceCardSkeleton,
  Pill,
  RangeSlider,
  SearchField,
  SectionTitle,
  Toggle,
} from "../../components/ui";
import { useDemoMarketplace } from "../../hooks/useDemoMarketplace";
import {
  ProposalCard,
  ProposalMediaGallery,
  ReviewSummary,
  SocialLinks,
  LocationFilterSheet,
} from "../../components/marketplace";
import { useTheme } from "../../providers/ThemeProvider";
import { useToast } from "../../providers/ToastProvider";
import { AppTheme } from "../../styles/theme";
import {
  Campaign,
  CampaignDraft,
  DealStatus,
  CreatorContentType,
  Influencer,
  SocialPlatform,
  TabName,
  DemoProposal,
  ProposalStatus,
  ProposalContext,
  ProposalDraft,
} from "../../types/marketplace";
import { INDIA_STATES, IndiaState } from "../../lib/indiaLocations";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  FlowScreen,
  MarketplaceFlow,
  NotificationSettings,
} from "./FlowScreens";
import { ChatDetail } from "./ChatDetail";
import { CreatorSpotlight, HomeDashboard } from "./HomeDashboard";

type Detail =
  | { type: "influencer"; value: Influencer }
  | {
      type: "profile";
      value: ChatProfile;
      returnTo?: { type: "chat"; name: string; initials: string; returnTo: ChatReturn };
    }
  | { type: "campaign"; value: Campaign }
  | {
      type: "chat";
      name: string;
      initials: string;
      returnTo: ChatReturn;
    }
  | { type: "proposal"; value: DemoProposal }
  | {
      type: "flow";
      flow: MarketplaceFlow;
      returnTo?: { type: "chat"; name: string; initials: string; returnTo: ChatReturn };
    }
  | null;
type ChatProfile = {
  id: string;
  kind: "brand" | "creator";
  name: string;
  initials: string;
  city: string;
  state: string;
  niche: string;
  followers: string;
  price: string;
  rating: number;
  reviews: number;
  platforms: SocialPlatform[];
  avatarUrl?: string;
};
type ChatReturn =
  | { type: "utility"; page: "Chats" }
  | { type: "tab"; tab: TabName }
  | { type: "proposal"; value: DemoProposal };
type AppNotification = {
  id: string;
  icon:
    | "paper-plane-outline"
    | "chatbubble-ellipses-outline"
    | "checkmark-circle-outline"
    | "briefcase-outline";
  title: string;
  body: string;
  time: string;
  read: boolean;
  category: keyof NotificationSettings;
};
type AccountDeletionRequest = {
  requestedAt: number;
  expiresAt: number;
};
type SocialAccountMap = Partial<Record<SocialPlatform, string>>;
const DEFAULT_SOCIAL_ACCOUNTS: SocialAccountMap = {
  Instagram: "@mayastudio",
  YouTube: "Maya Studio",
  LinkedIn: "Maya Studio",
};
const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  {
    id: "proposal-update",
    icon: "paper-plane-outline",
    title: "New proposal received",
    body: "A creator sent a proposal for your campaign brief.",
    time: "12 min ago",
    read: false,
    category: "proposalRequests",
  },
  {
    id: "chat-update",
    icon: "chatbubble-ellipses-outline",
    title: "New message from Aarohi",
    body: "Your accepted collaboration has a new message.",
    time: "1 hr ago",
    read: false,
    category: "messages",
  },
  {
    id: "match-update",
    icon: "briefcase-outline",
    title: "New campaign match",
    body: "A campaign in your preferred category and location is ready to review.",
    time: "3 hrs ago",
    read: false,
    category: "newMatches",
  },
  {
    id: "profile-update",
    icon: "checkmark-circle-outline",
    title: "Profile is ready to discover",
    body: "Your updated location preferences are now visible in matching.",
    time: "Yesterday",
    read: true,
    category: "profileActivity",
  },
];
type ContentDetail = Exclude<
  Detail,
  | { type: "flow"; flow: MarketplaceFlow }
  | { type: "proposal"; value: DemoProposal }
  | null
>;
type CampaignFeedItem =
  | { id: string; kind: "rail"; title: string; campaigns: Campaign[] }
  | { id: string; kind: "card"; campaign: Campaign };
type ProposalFeedItem =
  | { id: string; kind: "rail"; title: string; proposals: DemoProposal[] }
  | { id: string; kind: "card"; proposal: DemoProposal };
type CreatorFeedItem = {
  id: string;
  kind: "rail";
  title: string;
  creators: Influencer[];
};
type CampaignFilters = {
  statuses: ("Open" | "In progress" | "Closed")[];
  categories: string[];
};
type ProposalFilters = {
  status: ProposalStatus[];
  direction: ("incoming" | "sent")[];
  cities: string[];
};
type DiscoverFilters = {
  locations: LocationSelection[];
  platforms: SocialPlatform[];
  priceRange: NumericRange;
  ratingRange: NumericRange;
  followersRange: NumericRange;
  categories: string[];
  contentTypes: CreatorContentType[];
};
type NumericRange = { min: string; max: string };
type LocationSelection = { state: string; city: string | null };
type FilterCategory =
  | "city"
  | "price"
  | "audience"
  | "category"
  | "platform"
  | "contentType"
  | "rating";
type AppIconName = ComponentProps<typeof AppIcon>["name"];
type LocationFilterOption = {
  id: string;
  label: string;
  value: string;
  kind: "state" | "city";
  state: string;
  city: string | null;
  searchValue: string;
};
const DEFAULT_DISCOVER_FILTERS: DiscoverFilters = {
  locations: [],
  platforms: [],
  priceRange: { min: "", max: "" },
  ratingRange: { min: "", max: "" },
  followersRange: { min: "", max: "" },
  categories: [],
  contentTypes: [],
};
const DEFAULT_CAMPAIGN_FILTERS: CampaignFilters = {
  statuses: [],
  categories: [],
};
const DEFAULT_PROPOSAL_FILTERS: ProposalFilters = {
  status: [],
  direction: [],
  cities: [],
};
const FILTER_CATEGORIES: {
  key: FilterCategory;
  label: string;
  railLabel: string;
  icon: AppIconName;
}[] = [
  {
    key: "city",
    label: "Location",
    railLabel: "Place",
    icon: "location-outline",
  },
  {
    key: "price",
    label: "Price range",
    railLabel: "Price",
    icon: "cash-outline",
  },
  {
    key: "audience",
    label: "Followers",
    railLabel: "People",
    icon: "people-outline",
  },
  {
    key: "category",
    label: "Categories",
    railLabel: "Topics",
    icon: "grid-outline",
  },
  {
    key: "platform",
    label: "Platforms",
    railLabel: "Apps",
    icon: "phone-portrait-outline",
  },
  {
    key: "contentType",
    label: "Content type",
    railLabel: "Content",
    icon: "videocam-outline",
  },
  { key: "rating", label: "Rating", railLabel: "Rating", icon: "star-outline" },
];
const CREATOR_CATEGORIES = [
  "Fashion",
  "Beauty",
  "Food",
  "Lifestyle",
  "Tech",
  "Fitness",
  "Travel",
  "Home",
  "Gaming",
  "Finance",
  "Education",
  "Parenting",
];
const DEMO_CREATOR_PROFILE_LOCATIONS = [
  "Mumbai",
  "Delhi",
  "Bengaluru",
  "Pune",
  "Hyderabad",
  "Pan India",
];
const SUPPORTED_PLATFORMS: SocialPlatform[] = [
  "Instagram",
  "YouTube",
  "TikTok",
  "Facebook",
  "Pinterest",
  "LinkedIn",
  "Snapchat",
  "X",
];
const SUPPORTED_CONTENT_TYPES: CreatorContentType[] = [
  "Reel",
  "Short video",
  "Long video",
  "Photo post",
  "Story",
  "Live",
  "Carousel",
  "Blog post",
];
const normaliseLocationSearch = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("en-IN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
const getAppliedFilterCount = (filters: DiscoverFilters) =>
  [
    filters.locations.length > 0,
    filters.platforms.length > 0,
    filters.priceRange.min !== "" || filters.priceRange.max !== "",
    filters.ratingRange.min !== "" || filters.ratingRange.max !== "",
    filters.followersRange.min !== "" || filters.followersRange.max !== "",
    filters.categories.length > 0,
    filters.contentTypes.length > 0,
  ].filter(Boolean).length;
const getCampaignAppliedFilterCount = (filters: CampaignFilters) =>
  [filters.statuses.length > 0, filters.categories.length > 0].filter(Boolean)
    .length;
const getProposalAppliedFilterCount = (filters: ProposalFilters) =>
  [
    filters.status.length > 0,
    filters.direction.length > 0,
    filters.cities.length > 0,
  ].filter(Boolean).length;
const getCampaignFilterStatus = (status: Campaign["status"]) =>
  status === "Open"
    ? "Open"
    : status === "Completed"
      ? "Closed"
      : "In progress";
const isLocationFilterOption = (
  option: unknown,
): option is LocationFilterOption =>
  typeof option === "object" &&
  option !== null &&
  "kind" in option &&
  ((option as { kind?: unknown }).kind === "state" ||
    (option as { kind?: unknown }).kind === "city") &&
  "state" in option;
const getStartingPrice = (price: string) => {
  const value = Number.parseFloat(price.match(/[\d.]+/)?.[0] ?? "0");
  return price.includes("K") ? value * 1000 : value;
};
const getFollowerCount = (followers: string) => {
  const value = Number.parseFloat(followers.match(/[\d.]+/)?.[0] ?? "0");
  return followers.includes("M") ? value * 1000000 : value * 1000;
};
const formatCompactNumber = (value: string, prefix = "") => {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  if (number >= 1000000) return `${prefix}${number / 1000000}M`;
  if (number >= 1000) return `${prefix}${number / 1000}K`;
  return `${prefix}${number}`;
};
const formatRangeLabel = (
  range: NumericRange,
  prefix = "",
  emptyLabel: string,
) => {
  if (!range.min && !range.max) return emptyLabel;
  if (range.min && !range.max)
    return `${formatCompactNumber(range.min, prefix)}+`;
  if (!range.min && range.max)
    return `Under ${formatCompactNumber(range.max, prefix)}`;
  return `${formatCompactNumber(range.min, prefix)}–${formatCompactNumber(range.max, prefix)}`;
};
const isWithinRange = (value: number, range: NumericRange) => {
  const min = Number(range.min);
  const max = Number(range.max);
  return (
    (!range.min || (Number.isFinite(min) && value >= min)) &&
    (!range.max || (Number.isFinite(max) && value <= max))
  );
};
const normaliseRange = (
  range: NumericRange,
  minimum: number,
  maximum: number,
): NumericRange => {
  const parse = (value: string) =>
    value === "" || !Number.isFinite(Number(value))
      ? null
      : Math.min(maximum, Math.max(minimum, Number(value)));
  const min = parse(range.min);
  const max = parse(range.max);
  const format = (value: number) => String(Number(value.toFixed(3)));
  return {
    min: min === null ? "" : format(max !== null && min > max ? max : min),
    max: max === null ? "" : format(min !== null && min > max ? min : max),
  };
};
const includesAny = <T,>(values: T[], selected: T[]) =>
  selected.length === 0 || selected.some((value) => values.includes(value));
const toggleValue = <T,>(values: T[], value: T) =>
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
type ScrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => void;

export function DemoApp() {
  const { theme, mode, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [isInDemo, setIsInDemo] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [role, setRole] = useState<"Brand" | "Influencer">("Brand");
  const [activeTab, setActiveTab] = useState<TabName>("Home");
  const [detail, setDetail] = useState<Detail>(null);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [notifications, setNotifications] =
    useState<AppNotification[]>(DEFAULT_NOTIFICATIONS);
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [deletionRequest, setDeletionRequest] =
    useState<AccountDeletionRequest | null>(null);
  const [accountDeletedAt, setAccountDeletedAt] = useState<number | null>(null);
  const [profileIsPublic, setProfileIsPublic] = useState(false);
  const [createdCampaigns, setCreatedCampaigns] = useState<Campaign[]>([]);
  const [privateCampaignIds, setPrivateCampaignIds] = useState<string[]>([]);
  const [collaborationStatuses, setCollaborationStatuses] = useState<
    Record<string, DealStatus>
  >({});
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountMap>(
    DEFAULT_SOCIAL_ACCOUNTS,
  );
  const [verifiedSocialAccounts, setVerifiedSocialAccounts] = useState<
    SocialPlatform[]
  >(["Instagram", "YouTube", "LinkedIn"]);
  const [utilityPage, setUtilityPage] = useState<"Chats" | "Notifications" | null>(null);
  const chromeProgress = useRef(new Animated.Value(1)).current;
  const chromeLayoutProgress = useRef(new Animated.Value(1)).current;
  const chromeVisible = useRef(true);
  const lastScrollY = useRef(0);
  const styles = makeStyles(theme);
  const backLocked = useRef(false);
  const {
    campaigns,
    influencers,
    proposals,
    updateProposalStatus,
    createProposal,
    creatorLocations,
    updateCreatorLocations,
  } = useDemoMarketplace();
  const getChatProfile = (name: string): ChatProfile => {
    if (role === "Brand") {
      const creator = influencers.find((item) => item.name === name) ?? influencers[0];
      return {
        id: creator?.id ?? "chat-creator",
        kind: "creator",
        name: creator?.name ?? name,
        initials: creator?.initials ?? name.slice(0, 2).toUpperCase(),
        city: creator?.city ?? "Mumbai",
        state: creator?.state ?? "Maharashtra",
        niche: creator?.niche ?? "Lifestyle creator",
        followers: creator?.followers ?? "84K",
        price: creator?.price ?? "₹8K – ₹15K",
        rating: creator?.rating ?? 4.8,
        reviews: creator?.reviews ?? 24,
        platforms: creator?.platforms ?? ["Instagram", "YouTube"],
        avatarUrl: creator?.avatarUrl,
      };
    }
    const campaign = campaigns.find((item) => item.brand === name);
    return {
      id: campaign?.id ?? "chat-brand",
      kind: "brand",
      name,
      initials: name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      city: campaign?.city ?? "Mumbai",
      state: "Maharashtra",
      niche: campaign?.category ?? "Brand collaborations",
      followers: "12 campaigns",
      price: campaign?.budget ?? "Flexible budget",
      rating: 4.8,
      reviews: 32,
      platforms: ["Instagram", "LinkedIn"],
    };
  };
  const changeTab = (tab: TabName) => {
    setDetail(null);
    setUtilityPage(null);
    setActiveTab(tab);
  };
  const setChromeVisible = (visible: boolean) => {
    if (chromeVisible.current === visible) return;
    chromeVisible.current = visible;
    Animated.parallel([
      Animated.timing(chromeProgress, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
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

  const showDiscover = () => changeTab("Discover");
  const showCampaigns = () => changeTab("Campaigns");
  const toggleBlockedUser = (name: string) =>
    setBlockedUsers((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    );
  const markNotificationRead = (id: string) =>
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    );
  const markAllNotificationsRead = () =>
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true })),
    );
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
  };
  const handleAuthContinue = (
    selectedRole: "Brand" | "Influencer",
    needsOnboarding: boolean,
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
    setSocialAccounts(
      selectedRole === "Brand"
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
  const openChat = (
    name: string,
    initials: string,
    returnTo: ChatReturn,
  ) => {
    markNotificationRead("chat-update");
    setUtilityPage(null);
    setDetail({ type: "chat", name, initials, returnTo });
  };
  const openChatProfile = (name: string, returnTo: ChatReturn) => {
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
  const defaultProposalContext: ProposalContext = {
    campaignId: campaigns[0]?.id ?? "demo-brief",
    campaignTitle: campaigns[0]?.title ?? "New collaboration brief",
    participantName: role === "Influencer" ? "Mellow Skincare" : "Aarohi Mehta",
    participantInitials: role === "Influencer" ? "MS" : "AM",
    participantAvatarUrl:
      role === "Influencer"
        ? undefined
        : "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
    city: campaigns[0]?.city ?? "Mumbai",
    defaultAmount: role === "Influencer" ? "₹14,000" : "₹12,000",
    defaultDeliverables: "1 reel, 3 story frames, usage for 30 days",
  };
  const submitProposal = (context: ProposalContext, draft: ProposalDraft) => {
    setPrivateCampaignIds((current) =>
      current.includes(context.campaignId)
        ? current
        : [...current, context.campaignId],
    );
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
    });
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
  const handleProposalStatus = (id: string, status: ProposalStatus) => {
    updateProposalStatus(id, status);
    const proposal = proposals.find((item) => item.id === id);
    if (!proposal) return;
    if (status === "Accepted") {
      setPrivateCampaignIds((current) =>
        current.includes(proposal.campaignId)
          ? current
          : [...current, proposal.campaignId],
      );
    }
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
  const handleReviewSubmit = (subject: string) => {
    if (!notificationSettings.profileActivity) return;
    setNotifications((current) => [
      {
        id: `review-published-${Date.now()}`,
        icon: "checkmark-circle-outline",
        title: "Review published",
        body: `Your collaboration review for ${subject} is now available.`,
        time: "Just now",
        read: false,
        category: "profileActivity",
      },
      ...current,
    ]);
  };
  const handleCampaignCreate = (draft: CampaignDraft) => {
    const campaign: Campaign = {
      id: `created-campaign-${Date.now()}`,
      brand: "Maya Studio",
      title: draft.title,
      description: draft.description,
      city: draft.city,
      category: draft.category,
      budget: draft.budget,
      deadline: "New brief",
      status: "Open",
    };
    setCreatedCampaigns((current) => [campaign, ...current]);
  };
  const selectedProposal =
    detail?.type === "proposal"
      ? proposals.find((item) => item.id === detail.value.id) ?? detail.value
      : null;
  if (isSplashVisible) return <SplashScreen />;
  if (!isInDemo)
    return (
      <AuthScreen
        onContinue={handleAuthContinue}
      />
    );
  if (isOnboarding)
    return (
      <OnboardingScreen
        role={role}
        onComplete={(profile) => {
          updateCreatorLocations(profile.locations);
          setIsOnboarding(false);
        }}
      />
    );
  const content =
    utilityPage === "Notifications" ? (
      <NotificationView
        onScroll={handleScroll}
        notifications={notifications}
        notificationSettings={notificationSettings}
        onMarkRead={markNotificationRead}
        onMarkAllRead={markAllNotificationsRead}
      />
    ) : utilityPage === "Chats" ? (
      <InboxView
        role={role}
        onScroll={handleScroll}
        onChat={(name, initials) => {
          openChat(name, initials, { type: "utility", page: "Chats" });
        }}
      />
    ) : detail?.type === "flow" ? (
      <SafeAreaView style={styles.detailSafe}>
        <FlowScreen
          flow={detail.flow}
          role={role}
          onBack={() => {
            runBack(() => {
              if (detail.returnTo?.type === "chat") {
                setDetail({
                  type: "chat",
                  name: detail.returnTo.name,
                  initials: detail.returnTo.initials,
                  returnTo: detail.returnTo.returnTo,
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
          onDealStatusSave={(status) =>
            handleDealStatusSave(defaultProposalContext.campaignId, status)
          }
          onReviewSubmit={handleReviewSubmit}
          onReviewRequest={() => setDetail({ type: "flow", flow: "review" })}
          initialDealStatus={collaborationStatuses[defaultProposalContext.campaignId]}
          proposalContext={defaultProposalContext}
          initialLocations={creatorLocations}
          onProfileLocationsSave={updateCreatorLocations}
          onOpenCreator={(name) => {
            const creator = influencers.find((item) => item.name === name);
            if (creator) setDetail({ type: "influencer", value: creator });
          }}
          blockedUsers={blockedUsers}
          onUnblockUser={toggleBlockedUser}
          notificationSettings={notificationSettings}
          onNotificationSettingsSave={setNotificationSettings}
          onDeleteAccount={requestAccountDeletion}
          initialSocialAccounts={socialAccounts}
          verifiedSocialAccounts={verifiedSocialAccounts}
          onSocialAccountsSave={(accounts, verifiedPlatforms) => {
            setSocialAccounts(accounts);
            setVerifiedSocialAccounts(verifiedPlatforms);
          }}
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
        />
      </SafeAreaView>
    ) : detail?.type === "chat" ? (
      <ChatDetail
        name={detail.name}
        initials={detail.initials}
        role={role}
        onBack={() => runBack(() => returnFromChat(detail.returnTo))}
        onOpenProfile={() => openChatProfile(detail.name, detail.returnTo)}
        blocked={blockedUsers.includes(detail.name)}
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
          onSocialAccountsSave={(accounts, verifiedPlatforms) => {
            setSocialAccounts(accounts);
            setVerifiedSocialAccounts(verifiedPlatforms);
          }}
          onCampaignCreate={handleCampaignCreate}
          onDealStatusSave={(status) =>
            handleDealStatusSave(
              detail.type === "campaign"
                ? detail.value.id
                : defaultProposalContext.campaignId,
              status,
            )
          }
          onReviewSubmit={handleReviewSubmit}
          initialDealStatus={
            detail.type === "campaign"
              ? collaborationStatuses[detail.value.id]
              : collaborationStatuses[defaultProposalContext.campaignId]
          }
          profileIsPublic={profileIsPublic}
          onProfileVisibilitySave={setProfileIsPublic}
        />
      </SafeAreaView>
    ) : activeTab === "Home" ? (
      <HomeDashboard
        role={role}
        onScroll={handleScroll}
        onDiscover={showDiscover}
        onInfluencer={(value) => setDetail({ type: "influencer", value })}
        onCampaign={(value) =>
          value ? setDetail({ type: "campaign", value }) : showCampaigns()
        }
        onProfileEdit={() => setDetail({ type: "flow", flow: "profile-form" })}
        additionalCampaigns={createdCampaigns}
        privateCampaignIds={privateCampaignIds}
        onChat={(name, initials) =>
          openChat(name, initials, { type: "tab", tab: "Home" })
        }
        proposals={proposals}
        onProposal={(value) => setDetail({ type: "proposal", value })}
      />
    ) : activeTab === "Discover" ? (
      <DiscoverView
        role={role}
        savedLocations={creatorLocations}
        onScroll={handleScroll}
        onInfluencer={(value) => setDetail({ type: "influencer", value })}
        onCampaign={(value) => setDetail({ type: "campaign", value })}
        additionalCampaigns={createdCampaigns}
        privateCampaignIds={privateCampaignIds}
      />
    ) : activeTab === "Campaigns" ? (
      <CampaignsView
        role={role}
        onScroll={handleScroll}
        onCampaign={(value) => setDetail({ type: "campaign", value })}
        onCreate={() => setDetail({ type: "flow", flow: "campaign-form" })}
        additionalCampaigns={createdCampaigns}
        privateCampaignIds={privateCampaignIds}
        proposals={proposals}
        onProposal={(proposal) => setDetail({ type: "proposal", value: proposal })}
      />
    ) : activeTab === "Proposals" ? (
      <ProposalView
        role={role}
        proposals={proposals}
        onScroll={handleScroll}
        onProposal={(value) => setDetail({ type: "proposal", value })}
        onProposalStatus={handleProposalStatus}
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
        savedLocations={creatorLocations}
        profileIsPublic={profileIsPublic}
        socialAccounts={socialAccounts}
        verifiedSocialAccounts={verifiedSocialAccounts}
        onProfileVisibilitySave={setProfileIsPublic}
      />
    );

  const pageTitle = utilityPage
    ? utilityPage === "Chats"
      ? role === "Brand"
        ? "Brand inbox"
        : "Creator inbox"
      : role === "Brand"
        ? "Brand updates"
        : "Creator updates"
    : activeTab === "Home"
      ? role === "Brand"
        ? "Brand workspace"
        : "Creator home"
      : role === "Brand"
        ? {
            Discover: "Find creators",
            Campaigns: "Brand campaigns",
            Proposals: "Creator proposals",
            Profile: "Brand profile",
          }[activeTab]
        : {
            Discover: "Find briefs",
            Campaigns: "Creator campaigns",
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
        ? activeTab === "Discover"
          ? "Search by audience, niche and location"
          : activeTab === "Campaigns"
            ? "Create and manage creator briefs"
            : activeTab === "Proposals"
              ? "Review creator applications"
              : "Manage your brand account"
        : activeTab === "Discover"
          ? "Browse campaigns that match your audience"
          : activeTab === "Campaigns"
            ? "Public briefs and your applications"
            : activeTab === "Proposals"
              ? "Track applications and requests"
              : "Manage your creator account"
      : null;
  return (
    <View style={styles.app}>
      {!detail ? (
        <Animated.View
          style={[
            styles.topbar,
            styles.topbarOverlay,
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
            <Text numberOfLines={1} style={styles.wordmark}>
              {pageTitle}
            </Text>
            {pageTagline ? (
              <Text numberOfLines={1} style={styles.tagline}>
                {pageTagline}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
            onPress={() => {
              setDetail(null);
              setUtilityPage("Notifications");
            }}
            style={styles.notification}
          >
            <AppIcon
              name="notifications-outline"
              size={21}
              color={theme.colors.primary}
            />
          </Pressable>
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
      <View style={styles.content}>
        {content}
      </View>
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
          <BottomTabs
            active={activeTab}
            onChange={changeTab}
            onChat={() => {
              setDetail(null);
              setUtilityPage("Chats");
            }}
            chatActive={utilityPage === "Chats"}
          />
        </Animated.View>
      )}
    </View>
  );
}

function SplashScreen() {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.splash}>
      <View style={styles.splashMark}>
        <AppIcon name="sparkles" size={30} color={theme.colors.primaryText} />
      </View>
      <Text style={styles.splashWordmark}>brandly</Text>
      <Text style={styles.splashCopy}>Creator partnerships, made clear.</Text>
      <View style={styles.splashLoader}>
        <View style={styles.splashLoaderFill} />
      </View>
    </View>
  );
}

function AuthScreen({
  onContinue,
}: {
  onContinue: (role: "Brand" | "Influencer", needsOnboarding: boolean) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [role, setRole] = useState<"Brand" | "Influencer">("Brand");
  const [step, setStep] = useState<
    "welcome" | "signin" | "signup" | "signin-otp" | "signup-otp"
  >("welcome");
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [signinIdentifier, setSigninIdentifier] = useState("");
  const [signinOtp, setSigninOtp] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [authError, setAuthError] = useState("");
  const resetAuthError = () => setAuthError("");
  const submitSignup = () => {
    resetAuthError();
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      setAuthError("Enter your name, email and phone number to continue.");
      return;
    }
    if (!email.includes("@") || phone.replace(/\D/g, "").length < 10) {
      setAuthError("Enter a valid email address and 10-digit phone number.");
      return;
    }
    setStep("signup-otp");
  };
  const submitSignin = () => {
    resetAuthError();
    if (!signinIdentifier.trim()) {
      setAuthError(`Enter your ${method === "email" ? "email address" : "phone number"}.`);
      return;
    }
    if (
      (method === "email" && !signinIdentifier.includes("@")) ||
      (method === "phone" && signinIdentifier.replace(/\D/g, "").length < 10)
    ) {
      setAuthError(
        method === "email"
          ? "Enter a valid email address."
          : "Enter a valid 10-digit phone number.",
      );
      return;
    }
    setStep("signin-otp");
  };
  const verifySignup = () => {
    if (emailOtp !== "1234" || phoneOtp !== "1234") {
      setAuthError("Use the demo code 1234 for both email and phone.");
      return;
    }
    onContinue(role, true);
  };
  const verifySignin = () => {
    if (signinOtp !== "1234") {
      setAuthError("Use the demo verification code 1234.");
      return;
    }
    onContinue(role, false);
  };
  if (step === "welcome")
    return (
      <AuthShell>
        <View style={styles.authLogo}>
          <AppIcon name="sparkles" size={28} color={theme.colors.primaryText} />
        </View>
        <Pill label="CREATOR PARTNERSHIPS" accent />
        <Text style={styles.authTitle}>
          Every right deal starts with the right match.
        </Text>
        <Text style={styles.authBody}>
          A trusted, global space for brands and creators to build partnerships.
        </Text>
        <View style={styles.authOptions}>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: role === "Brand" }}
            onPress={() => setRole("Brand")}
            style={[
              styles.authOption,
              role === "Brand" && styles.authOptionSelected,
            ]}
          >
            <AppIcon name="storefront-outline" color={theme.colors.primary} />
            <View style={styles.flex}>
              <Text style={styles.authOptionTitle}>I represent a brand</Text>
              <Text style={styles.authOptionText}>
                Find creators for your next campaign.
              </Text>
            </View>
            <AppIcon
              name={role === "Brand" ? "radio-button-on" : "radio-button-off"}
              color={theme.colors.primary}
            />
          </Pressable>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: role === "Influencer" }}
            onPress={() => setRole("Influencer")}
            style={[
              styles.authOption,
              role === "Influencer" && styles.authOptionSelected,
            ]}
          >
            <AppIcon name="person-outline" color={theme.colors.primary} />
            <View style={styles.flex}>
              <Text style={styles.authOptionTitle}>I am a creator</Text>
              <Text style={styles.authOptionText}>
                Find campaigns that fit your audience.
              </Text>
            </View>
            <AppIcon
              name={
                role === "Influencer" ? "radio-button-on" : "radio-button-off"
              }
              color={theme.colors.primary}
            />
          </Pressable>
        </View>
        <AppButton label="Create account" onPress={() => setStep("signup")} />
        <AppButton
          label="Sign in"
          variant="secondary"
          onPress={() => setStep("signin")}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => onContinue(role, false)}
          style={styles.guestAction}
        >
          <Text style={styles.guestText}>Continue as a guest</Text>
          <AppIcon
            name="arrow-forward"
            size={16}
            color={theme.colors.primary}
          />
        </Pressable>
        <Text style={styles.authFootnote}>
          By continuing, you agree to the Terms and Privacy Policy.
        </Text>
      </AuthShell>
    );
  if (step === "signup-otp")
    return (
      <AuthShell>
        <IconButton
          name="arrow-back"
          label="Back"
          onPress={() => {
            resetAuthError();
            setStep("signup");
          }}
        />
        <View style={styles.authFormIntro}>
          <Pill label="VERIFY CONTACTS" accent />
          <Text style={styles.authTitle}>Verify email and phone</Text>
          <Text style={styles.authBody}>
            Both contacts are required before we set up your account.
          </Text>
        </View>
        <AppCard flat style={styles.otpCard}>
          <AppIcon name="mail-outline" size={22} color={theme.colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.authLabel}>Email verification</Text>
            <Text style={styles.authHint}>{email || "your email address"}</Text>
          </View>
        </AppCard>
        <TextInput
          accessibilityLabel="Email verification code"
          keyboardType="number-pad"
          maxLength={4}
          value={emailOtp}
          onChangeText={setEmailOtp}
          placeholder="Email OTP"
          placeholderTextColor={theme.colors.textSecondary}
          style={styles.authInput}
        />
        <AppCard flat style={styles.otpCard}>
          <AppIcon
            name="phone-portrait-outline"
            size={22}
            color={theme.colors.primary}
          />
          <View style={styles.flex}>
            <Text style={styles.authLabel}>Phone verification</Text>
            <Text style={styles.authHint}>{phone || "your phone number"}</Text>
          </View>
        </AppCard>
        <TextInput
          accessibilityLabel="Phone verification code"
          keyboardType="number-pad"
          maxLength={4}
          value={phoneOtp}
          onChangeText={setPhoneOtp}
          placeholder="Phone OTP"
          placeholderTextColor={theme.colors.textSecondary}
          style={styles.authInput}
        />
        <Text style={styles.demoOtpHint}>Demo OTP for both contacts: 1234</Text>
        {authError ? <Text style={styles.authError}>{authError}</Text> : null}
        <AppButton label="Verify both and continue" icon="checkmark" onPress={verifySignup} />
      </AuthShell>
    );
  if (step === "signin-otp")
    return (
      <AuthShell>
        <IconButton
          name="arrow-back"
          label="Back"
          onPress={() => {
            resetAuthError();
            setStep("signin");
          }}
        />
        <View style={styles.authFormIntro}>
          <Pill label="VERIFY SIGN IN" accent />
          <Text style={styles.authTitle}>Enter your one-time code</Text>
          <Text style={styles.authBody}>
            We sent a verification code to your {method}.
          </Text>
        </View>
        <TextInput
          accessibilityLabel="Sign in verification code"
          keyboardType="number-pad"
          maxLength={4}
          value={signinOtp}
          onChangeText={setSigninOtp}
          placeholder="4-digit OTP"
          placeholderTextColor={theme.colors.textSecondary}
          style={styles.authInput}
        />
        <Text style={styles.demoOtpHint}>Demo OTP: 1234</Text>
        {authError ? <Text style={styles.authError}>{authError}</Text> : null}
        <AppButton label="Verify and sign in" icon="log-in-outline" onPress={verifySignin} />
      </AuthShell>
    );
  const isSignIn = step === "signin";
  return (
    <AuthShell>
      <IconButton
        name="arrow-back"
        label="Back"
        onPress={() => {
          resetAuthError();
          setStep("welcome");
        }}
      />
      <View style={styles.authFormIntro}>
        <Pill label={isSignIn ? "WELCOME BACK" : "GET STARTED"} accent />
        <Text style={styles.authTitle}>
          {isSignIn
            ? "Welcome back"
            : role === "Brand"
              ? "Set up your finder profile"
              : "Build your creator profile"}
        </Text>
        <Text style={styles.authBody}>
          {isSignIn
            ? "Sign in to manage your partnerships."
            : "Set up your account in a few simple steps."}
        </Text>
      </View>
      {isSignIn ? (
      <View style={styles.methodTabs}>
        <Pressable
          onPress={() => {
            resetAuthError();
            setMethod("email");
          }}
          style={[
            styles.methodTab,
            method === "email" && styles.methodTabActive,
          ]}
        >
          <AppIcon
            name="mail-outline"
            size={18}
            color={
              method === "email"
                ? theme.colors.primary
                : theme.colors.textSecondary
            }
          />
          <Text
            style={[
              styles.methodText,
              method === "email" && styles.methodTextActive,
            ]}
          >
            Email
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            resetAuthError();
            setMethod("phone");
          }}
          style={[
            styles.methodTab,
            method === "phone" && styles.methodTabActive,
          ]}
        >
          <AppIcon
            name="phone-portrait-outline"
            size={18}
            color={
              method === "phone"
                ? theme.colors.primary
                : theme.colors.textSecondary
            }
          />
          <Text
            style={[
              styles.methodText,
              method === "phone" && styles.methodTextActive,
            ]}
          >
            Phone
          </Text>
        </Pressable>
      </View>
      ) : null}
      {!isSignIn ? (
        <TextInput
          accessibilityLabel="Full name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          placeholderTextColor={theme.colors.textSecondary}
          style={styles.authInput}
        />
      ) : null}
      {!isSignIn ? (
        <>
          <TextInput
            accessibilityLabel="Email address"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor={theme.colors.textSecondary}
            style={styles.authInput}
          />
          <TextInput
            accessibilityLabel="Phone number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor={theme.colors.textSecondary}
            style={styles.authInput}
          />
          <Text style={styles.authHint}>
            We will verify both contacts with a one-time code.
          </Text>
        </>
      ) : method === "email" ? (
        <TextInput
          accessibilityLabel="Email address"
          autoCapitalize="none"
          keyboardType="email-address"
          value={signinIdentifier}
          onChangeText={setSigninIdentifier}
          placeholder="Email address"
          placeholderTextColor={theme.colors.textSecondary}
          style={styles.authInput}
        />
      ) : (
        <TextInput
          accessibilityLabel="Phone number"
          keyboardType="phone-pad"
          value={signinIdentifier}
          onChangeText={setSigninIdentifier}
          placeholder="Phone number"
          placeholderTextColor={theme.colors.textSecondary}
          style={styles.authInput}
        />
      )}
      {isSignIn ? (
        <Text style={styles.authHint}>
          We will send a one-time verification code. No password is required.
        </Text>
      ) : null}
      {authError ? <Text style={styles.authError}>{authError}</Text> : null}
      <AppButton
        label={
          isSignIn
            ? "Send sign-in code"
            : "Send verification codes"
        }
        onPress={isSignIn ? submitSignin : submitSignup}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          resetAuthError();
          setStep(isSignIn ? "signup" : "signin");
        }}
      >
        <Text style={styles.authSwitch}>
          {isSignIn
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </Text>
      </Pressable>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const drift = useRef(new Animated.Value(0)).current;
  const { width, height } = useWindowDimensions();
  const compactScreen = height < 760 || width < 360;
  const horizontalPadding = width < 360 ? theme.spacing.md : theme.spacing.lg;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 4200,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 4200,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [drift]);
  return (
    <SafeAreaView style={styles.authShell} edges={["top", "bottom"]}>
      <View pointerEvents="none" style={styles.authBackdrop}>
        <Animated.View
          style={[
            styles.authOrbPrimary,
            {
              transform: [
                {
                  translateX: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-18, 20],
                  }),
                },
                {
                  translateY: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 30],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.authOrbSecondary,
            {
              transform: [
                {
                  translateX: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [22, -16],
                  }),
                },
                {
                  translateY: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, -18],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.auth,
          {
            justifyContent: compactScreen ? "flex-start" : "center",
            paddingHorizontal: horizontalPadding,
            paddingTop: compactScreen ? theme.spacing.sm : theme.spacing.md,
            paddingBottom: theme.spacing.lg,
          },
        ]}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

type OnboardingProfile = {
  locations: string[];
  languages: string[];
  focus: string[];
};

function OnboardingScreen({
  role,
  onComplete,
}: {
  role: "Brand" | "Influencer";
  onComplete: (profile: OnboardingProfile) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [step, setStep] = useState(0);
  const [locations, setLocations] = useState<string[]>(["Mumbai"]);
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [focus, setFocus] = useState<string[]>(
    role === "Brand" ? ["Beauty"] : ["Beauty", "Fashion"],
  );
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [error, setError] = useState("");
  const locationOptions = useMemo(
    () =>
      Array.from(
        new Set([
          "Pan India",
          ...INDIA_STATES.map((item) => item.state),
          ...INDIA_STATES.flatMap((item) => item.cities.map((city) => city.name)),
        ]),
      ),
    [],
  );
  const languageOptions = [
    "English",
    "Hindi",
    "Hinglish",
    "Tamil",
    "Telugu",
    "Bengali",
    "Marathi",
  ];
  const focusOptions =
    role === "Brand"
      ? ["Beauty", "Fashion", "Food", "Technology", "Wellness", "Travel"]
      : ["Beauty", "Fashion", "Food", "Technology", "Fitness", "Travel"];
  const screens = [
    {
      icon: "location-outline" as const,
      title: "Where do you work?",
      body:
        role === "Brand"
          ? "Choose the locations where you want to discover creators and run campaigns."
          : "Choose the locations where brands can find you for relevant collaborations.",
    },
    {
      icon: "language-outline" as const,
      title: "Which languages do you use?",
      body: "Select the languages you are comfortable using for briefs and conversations.",
    },
    {
      icon: "options-outline" as const,
      title: role === "Brand" ? "What do you want to promote?" : "What do you create?",
      body:
        role === "Brand"
          ? "Choose a few categories so creator recommendations are more relevant."
          : "Choose your focus areas so suitable campaign briefs are easier to find.",
    },
  ];
  const current = screens[step];
  const toggleValue = (
    value: string,
    currentValues: string[],
    setter: (values: string[]) => void,
  ) => {
    setter(
      currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value],
    );
    setError("");
  };
  const continueOnboarding = () => {
    const hasSelection =
      step === 0 ? locations.length > 0 : step === 1 ? languages.length > 0 : focus.length > 0;
    if (!hasSelection) {
      setError("Select at least one option to continue.");
      return;
    }
    setError("");
    if (step === screens.length - 1) {
      onComplete({ locations, languages, focus });
      return;
    }
    setStep((value) => value + 1);
  };
  return (
    <View style={styles.onboarding}>
      <View style={styles.skipButton}>
        <Text style={styles.skipText}>Required setup</Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.onboardingScrollContent}
      >
        <View style={styles.onboardingContent}>
          <View style={styles.onboardingIcon}>
            <AppIcon
              name={current.icon}
              size={36}
              color={theme.colors.primaryText}
            />
          </View>
          <Text style={styles.onboardingStep}>
            {step + 1} of {screens.length}
          </Text>
          <Text style={styles.onboardingTitle}>{current.title}</Text>
          <Text style={styles.onboardingBody}>{current.body}</Text>
          {step === 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose work locations"
              onPress={() => setLocationSheetOpen(true)}
              style={({ pressed }) => [
                styles.onboardingSelector,
                pressed && styles.pressed,
              ]}
            >
              <AppIcon
                name="location-outline"
                size={22}
                color={theme.colors.primary}
              />
              <View style={styles.flex}>
                <Text style={styles.onboardingSelectorLabel}>Work locations</Text>
                <Text numberOfLines={2} style={styles.onboardingSelectorValue}>
                  {locations.join(", ")}
                </Text>
              </View>
              <AppIcon
                name="chevron-forward"
                size={18}
                color={theme.colors.textSecondary}
              />
            </Pressable>
          ) : null}
          {step === 1 ? (
            <View style={styles.onboardingChoiceGrid}>
              {languageOptions.map((language) => (
                <FilterChip
                  key={language}
                  label={language}
                  selected={languages.includes(language)}
                  onPress={() => toggleValue(language, languages, setLanguages)}
                />
              ))}
            </View>
          ) : null}
          {step === 2 ? (
            <View style={styles.onboardingChoiceGrid}>
              {focusOptions.map((item) => (
                <FilterChip
                  key={item}
                  label={item}
                  selected={focus.includes(item)}
                  onPress={() => toggleValue(item, focus, setFocus)}
                />
              ))}
            </View>
          ) : null}
          {error ? <Text style={styles.onboardingError}>{error}</Text> : null}
          <View style={styles.progressRow}>
            {screens.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index === step && styles.progressDotActive,
                ]}
              />
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={styles.onboardingActions}>
        {step > 0 ? (
          <AppButton
            label="Back"
            variant="secondary"
            onPress={() => {
              setError("");
              setStep((value) => value - 1);
            }}
          />
        ) : null}
        <View style={styles.flex}>
          <AppButton
            label={step === screens.length - 1 ? "Start exploring" : "Continue"}
            onPress={continueOnboarding}
          />
        </View>
      </View>
      <LocationFilterSheet
        visible={locationSheetOpen}
        locations={locationOptions}
        selected={locations}
        subtitle="Search and select one or more Indian cities or states"
        onClose={() => setLocationSheetOpen(false)}
        onApply={(selected) => {
          setLocations(selected);
          setLocationSheetOpen(false);
          setError("");
        }}
      />
    </View>
  );
}

function HomeView({
  role,
  onDiscover,
  onInfluencer,
}: {
  role: "Brand" | "Influencer";
  onDiscover: () => void;
  onInfluencer: (item: Influencer) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { influencers, campaigns, isLoading } = useDemoMarketplace();
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.hero}>
        <Pill label={`${role.toUpperCase()} ACCOUNT`} accent />
        <Text style={styles.heroTitle}>Good morning, Maya.</Text>
        <Text style={styles.heroBody}>
          {role === "Brand"
            ? "Your next campaign deserves creators who feel like the perfect fit."
            : "Explore campaign opportunities that match your audience and content style."}
        </Text>
        <AppButton
          label={role === "Brand" ? "Find influencers" : "Explore campaigns"}
          onPress={onDiscover}
        />
      </View>
      <SectionTitle
        title="Top matches"
        action="View all"
        onAction={onDiscover}
      />
      {isLoading ? (
        <MarketplaceSkeleton />
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontal}
          >
            {influencers.slice(0, 3).map((item) => (
              <InfluencerCard
                key={item.id}
                item={item}
                compact
                onPress={() => onInfluencer(item)}
              />
            ))}
          </ScrollView>
          <SectionTitle title="Your campaigns" action="Manage" />
          {campaigns.slice(0, 2).map((item) => (
            <CampaignCard key={item.id} item={item} />
          ))}
        </>
      )}
      <SectionTitle title="Explore by category" />
      <View style={styles.categoryGrid}>
        {(
          [
            { label: "Beauty", icon: "sparkles-outline" },
            { label: "Fashion", icon: "shirt-outline" },
            { label: "Food", icon: "restaurant-outline" },
            { label: "Tech", icon: "phone-portrait-outline" },
            { label: "Fitness", icon: "barbell-outline" },
            { label: "Travel", icon: "airplane-outline" },
          ] as const
        ).map((item) => (
          <AppCard key={item.label} style={styles.categoryCard}>
            <AppIcon name={item.icon} size={23} color={theme.colors.primary} />
            <Text style={styles.categoryText}>{item.label}</Text>
          </AppCard>
        ))}
      </View>
    </ScrollView>
  );
}

function DiscoverView({
  role,
  savedLocations,
  onScroll,
  onInfluencer,
  onCampaign,
  additionalCampaigns = [],
  privateCampaignIds = [],
}: {
  role: "Brand" | "Influencer";
  savedLocations: string[];
  onScroll: ScrollHandler;
  onInfluencer: (item: Influencer) => void;
  onCampaign: (item: Campaign) => void;
  additionalCampaigns?: Campaign[];
  privateCampaignIds?: string[];
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { width } = useWindowDimensions();
  const { influencers, query, setQuery, savedIds, toggleSaved, isLoading } =
    useDemoMarketplace();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [filters, setFilters] = useState<DiscoverFilters>(
    DEFAULT_DISCOVER_FILTERS,
  );
  const creatorCardWidth = Math.min(
    320,
    Math.max(248, width - theme.spacing.lg * 2),
  );
  const creatorInset = Math.max(0, (width - creatorCardWidth) / 2);
  const filteredInfluencers = influencers.filter(
    (item) =>
      (filters.locations.length === 0 ||
        filters.locations.some(
          (location) =>
            item.state === location.state &&
            (location.city === null || item.city === location.city),
        )) &&
      includesAny(item.platforms, filters.platforms) &&
      includesAny(item.contentTypes, filters.contentTypes) &&
      isWithinRange(item.rating, filters.ratingRange) &&
      (filters.categories.length === 0 ||
        filters.categories.some((category) =>
          item.niche.toLowerCase().includes(category.toLowerCase()),
        )) &&
      isWithinRange(getFollowerCount(item.followers), filters.followersRange) &&
      isWithinRange(getStartingPrice(item.price), filters.priceRange),
  );
  const appliedCount = getAppliedFilterCount(filters);
  const resetFilters = () => setFilters(DEFAULT_DISCOVER_FILTERS);
  if (role === "Influencer") {
    return (
      <CreatorDiscoverView
        savedLocations={savedLocations}
        onScroll={onScroll}
        onCampaign={onCampaign}
        additionalCampaigns={additionalCampaigns}
        privateCampaignIds={privateCampaignIds}
      />
    );
  }
  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.discoverHeading}>
          <View style={styles.flex}>
            <Text style={styles.pageIntro}>
              Search by niche, location or audience fit.
            </Text>
          </View>
          <IconButton
            name="funnel-outline"
            label="Open advanced filters"
            selected={appliedCount > 0}
            onPress={() => setIsFilterOpen(true)}
          />
        </View>
        <SearchField
          value={query}
          onChangeText={setQuery}
          onFilter={() => setIsFilterOpen(true)}
          filterActive={appliedCount > 0}
        />
        <View style={styles.resultsHeader}>
          <Text style={styles.resultText}>
            {isLoading || isApplyingFilters
              ? "Finding creator matches…"
              : `${filteredInfluencers.length} creator profiles`}
          </Text>
          {appliedCount ? (
            <ClearFiltersButton onPress={resetFilters} />
          ) : null}
        </View>
        {isLoading || isApplyingFilters ? (
          <MarketplaceSkeleton />
        ) : filteredInfluencers.length === 0 ? (
          <NoResultsState
            onClear={
              query.trim() || appliedCount
                ? () => {
                    setQuery("");
                    resetFilters();
                  }
                : undefined
            }
            clearLabel={appliedCount ? "Clear all filters" : "Clear search"}
          />
        ) : (
          <View style={styles.discoveryFeed}>
            {createCreatorFeed(filteredInfluencers).map((section) => (
              <CreatorRail
                key={section.id}
                title={section.title}
                creators={section.creators}
                width={creatorCardWidth}
                inset={creatorInset}
                savedIds={savedIds}
                onSave={toggleSaved}
                onInfluencer={onInfluencer}
              />
            ))}
          </View>
        )}
      </ScrollView>
      <DiscoverFilterDrawer
        visible={isFilterOpen}
        value={filters}
        states={INDIA_STATES}
        onClose={() => setIsFilterOpen(false)}
        onApply={(nextFilters) => {
          setIsApplyingFilters(true);
          setFilters(nextFilters);
          setIsFilterOpen(false);
          setTimeout(() => setIsApplyingFilters(false), 420);
        }}
      />
    </>
  );
}

function DiscoverFilterDrawer({
  visible,
  value,
  states,
  onClose,
  onApply,
}: {
  visible: boolean;
  value: DiscoverFilters;
  states: IndiaState[];
  onClose: () => void;
  onApply: (filters: DiscoverFilters) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("city");
  const [draft, setDraft] = useState<DiscoverFilters>(value);
  const [locationQuery, setLocationQuery] = useState("");

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setLocationQuery("");
      setActiveCategory("city");
    }
  }, [value, visible]);

  const popularCities = [
    "Mumbai",
    "Delhi",
    "Bengaluru",
    "Hyderabad",
    "Pune",
    "Ahmedabad",
    "Chennai",
    "Kolkata",
  ];
  const locationOptions = useMemo<LocationFilterOption[]>(
    () =>
      states.flatMap((item) => [
        {
          id: `state-${item.state}`,
          label: item.state,
          value: item.state,
          kind: "state" as const,
          state: item.state,
          city: null,
          searchValue: normaliseLocationSearch(item.state),
        },
        ...item.cities.map((city) => ({
          id: `city-${city.id}`,
          label: `${city.name} · ${city.district}, ${item.state}`,
          value: city.name,
          kind: "city" as const,
          state: item.state,
          city: city.name,
          searchValue: normaliseLocationSearch(
            `${city.name} ${city.district} ${item.state}`,
          ),
        })),
      ]),
    [states],
  );
  const visibleLocationOptions = useMemo(() => {
    const searchTerm = normaliseLocationSearch(locationQuery);
    if (!searchTerm) {
      return locationOptions
        .filter(
          (item) => item.kind === "city" && popularCities.includes(item.value),
        )
        .slice(0, 8);
    }
    return locationOptions
      .filter((item) => item.searchValue.includes(searchTerm))
      .sort((left, right) => {
        const leftExact = normaliseLocationSearch(left.value) === searchTerm;
        const rightExact = normaliseLocationSearch(right.value) === searchTerm;
        if (leftExact !== rightExact) return leftExact ? -1 : 1;
        const leftStarts = normaliseLocationSearch(left.value).startsWith(
          searchTerm,
        );
        const rightStarts = normaliseLocationSearch(right.value).startsWith(
          searchTerm,
        );
        if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
        if (left.kind !== right.kind) return left.kind === "city" ? -1 : 1;
        return left.label.localeCompare(right.label, "en-IN");
      })
      .slice(0, 50);
  }, [locationOptions, locationQuery]);
  const options =
    activeCategory === "city"
      ? visibleLocationOptions
      : activeCategory === "platform"
        ? SUPPORTED_PLATFORMS
        : activeCategory === "category"
          ? CREATOR_CATEGORIES
          : activeCategory === "contentType"
            ? SUPPORTED_CONTENT_TYPES
            : [];
  const draftAppliedCount = getAppliedFilterCount(draft);
  const isRangeCategory =
    activeCategory === "price" ||
    activeCategory === "rating" ||
    activeCategory === "audience";
  const rangeConfig =
    activeCategory === "price"
      ? {
          key: "priceRange" as const,
          label: "Campaign price range",
          maximum: 100000,
          step: 1000,
          formatValue: (value: number) =>
            value === 100000
              ? "₹100K+"
              : value >= 1000
                ? `₹${value / 1000}K`
                : `₹${value}`,
          suggestions: [
            { label: "Under ₹5K", min: "", max: "5000" },
            { label: "₹5K–₹15K", min: "5000", max: "15000" },
            { label: "₹15K–₹30K", min: "15000", max: "30000" },
            { label: "₹30K+", min: "30000", max: "" },
            { label: "₹100K+", min: "100000", max: "" },
          ],
        }
      : activeCategory === "rating"
        ? {
            key: "ratingRange" as const,
            label: "Creator rating range",
            maximum: 5,
            step: 0.1,
            formatValue: (value: number) => `${value.toFixed(1)} / 5`,
            suggestions: [
              { label: "4.0+", min: "4", max: "" },
              { label: "4.5+", min: "4.5", max: "" },
              { label: "4.8+", min: "4.8", max: "" },
              { label: "Top rated", min: "4.9", max: "" },
            ],
          }
        : {
            key: "followersRange" as const,
            label: "Creator followers range",
            maximum: 1000000,
            step: 10000,
            formatValue: (value: number) =>
              value === 1000000
                ? "1M+"
                : value >= 1000
                  ? `${value / 1000}K`
                  : String(value),
            suggestions: [
              { label: "Under 10K", min: "", max: "10000" },
              { label: "10K–50K", min: "10000", max: "50000" },
              { label: "50K–100K", min: "50000", max: "100000" },
              { label: "100K+", min: "100000", max: "" },
            ],
          };
  const selectedSummary =
    activeCategory === "city"
      ? draft.locations.length
        ? `${draft.locations.length} selected`
        : "Any location"
      : activeCategory === "platform"
        ? draft.platforms.length
          ? `${draft.platforms.length} selected`
          : "Any platform"
        : activeCategory === "category"
          ? draft.categories.length
            ? `${draft.categories.length} selected`
            : "Any category"
          : activeCategory === "contentType"
            ? draft.contentTypes.length
              ? `${draft.contentTypes.length} selected`
              : "Any content"
            : activeCategory === "price"
              ? draft.priceRange.min || draft.priceRange.max
                ? formatRangeLabel(draft.priceRange, "₹", "Any budget")
                : "Any budget"
              : activeCategory === "rating"
                ? draft.ratingRange.min || draft.ratingRange.max
                  ? `${draft.ratingRange.min || "0"} – ${draft.ratingRange.max || "5"}`
                  : "Any rating"
                : formatRangeLabel(draft.followersRange, "", "Any audience");
  const toggleLocation = (option: LocationFilterOption) => {
    setDraft((current) => {
      const exists = current.locations.some(
        (location) =>
          location.state === option.state && location.city === option.city,
      );
      if (exists) {
        return {
          ...current,
          locations: current.locations.filter(
            (location) =>
              location.state !== option.state || location.city !== option.city,
          ),
        };
      }
      const withoutStateWideSelection =
        option.kind === "city"
          ? current.locations.filter(
              (location) =>
                location.state !== option.state || location.city !== null,
            )
          : current.locations;
      return {
        ...current,
        locations: [
          ...withoutStateWideSelection,
          { state: option.state, city: option.city },
        ],
      };
    });
  };
  const toggleMultiOption = (option: string) => {
    setDraft((current) => {
      if (activeCategory === "platform") {
        return {
          ...current,
          platforms: toggleValue(current.platforms, option as SocialPlatform),
        };
      }
      if (activeCategory === "category") {
        return {
          ...current,
          categories: toggleValue(current.categories, option),
        };
      }
      if (activeCategory === "contentType") {
        return {
          ...current,
          contentTypes: toggleValue(
            current.contentTypes,
            option as CreatorContentType,
          ),
        };
      }
      return current;
    });
  };
  const isMultiOptionSelected = (option: string) => {
    if (activeCategory === "platform")
      return draft.platforms.includes(option as SocialPlatform);
    if (activeCategory === "category") return draft.categories.includes(option);
    if (activeCategory === "contentType")
      return draft.contentTypes.includes(option as CreatorContentType);
    return false;
  };
  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.filterDrawerOverlay}>
        <Pressable style={styles.filterBackdrop} onPress={onClose} />
        <View
          style={[
            styles.filterDrawer,
            { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) },
          ]}
        >
          <View style={styles.filterSheetHandle} />
          <View style={styles.filterDrawerHeader}>
            <View style={styles.filterDrawerTitleRow}>
              <AppIcon
                name="options-outline"
                size={20}
                color={theme.colors.primary}
              />
              <View style={styles.flex}>
                <Text style={styles.sheetTitle}>Filter creators</Text>
                <Text numberOfLines={1} style={styles.sheetSubtitle}>
                  India only ·{" "}
                  {draftAppliedCount
                    ? `${draftAppliedCount} selected`
                    : "choose filters"}
                </Text>
              </View>
            </View>
            <IconButton name="close" label="Close filters" onPress={onClose} />
          </View>
          <View style={styles.filterDrawerBody}>
            <View style={styles.filterCategoryRail}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.filterCategoryRailScroll}
                contentContainerStyle={styles.filterCategoryRailContent}
              >
                {FILTER_CATEGORIES.map((categoryItem) => {
                  const selected = activeCategory === categoryItem.key;
                  const applied =
                    categoryItem.key === "city"
                      ? draft.locations.length > 0
                      : categoryItem.key === "platform"
                        ? draft.platforms.length > 0
                        : categoryItem.key === "price"
                          ? Boolean(
                              draft.priceRange.min || draft.priceRange.max,
                            )
                          : categoryItem.key === "rating"
                            ? Boolean(
                                draft.ratingRange.min || draft.ratingRange.max,
                              )
                            : categoryItem.key === "category"
                              ? draft.categories.length > 0
                              : categoryItem.key === "contentType"
                                ? draft.contentTypes.length > 0
                                : Boolean(
                                    draft.followersRange.min ||
                                    draft.followersRange.max,
                                  );
                  return (
                    <Pressable
                      key={categoryItem.key}
                      accessibilityRole="button"
                      accessibilityLabel={categoryItem.label}
                      accessibilityState={{ selected }}
                      onPress={() => setActiveCategory(categoryItem.key)}
                      style={({ pressed }) => [
                        styles.filterCategoryItem,
                        selected && styles.filterCategoryItemActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <AppIcon
                        name={categoryItem.icon}
                        size={18}
                        color={
                          selected
                            ? theme.colors.primary
                            : theme.colors.textSecondary
                        }
                      />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.filterCategoryLabel,
                          selected && styles.filterCategoryLabelActive,
                        ]}
                      >
                        {categoryItem.railLabel}
                      </Text>
                      {applied ? (
                        <View style={styles.filterCategoryDot} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <View style={styles.filterOptionsPane}>
              <View style={styles.filterOptionsHeader}>
                <View style={styles.flex}>
                  <Text style={styles.filterOptionsTitle}>
                    {
                      FILTER_CATEGORIES.find(
                        (item) => item.key === activeCategory,
                      )?.label
                    }
                  </Text>
                  <Text numberOfLines={1} style={styles.filterOptionsValue}>
                    {selectedSummary}
                  </Text>
                </View>
                <AppIcon
                  name={
                    activeCategory === "city" ? "map-outline" : "list-outline"
                  }
                  size={19}
                  color={theme.colors.primary}
                />
              </View>
              {activeCategory === "city" ? (
                <View style={styles.locationSearchBox}>
                  <AppIcon
                    name="search-outline"
                    size={17}
                    color={theme.colors.textSecondary}
                  />
                  <TextInput
                    accessibilityLabel="Search Indian states or cities"
                    value={locationQuery}
                    onChangeText={setLocationQuery}
                    placeholder="Search state or city"
                    placeholderTextColor={theme.colors.textSecondary}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="search"
                    style={styles.locationSearchInput}
                  />
                </View>
              ) : null}
              {isRangeCategory ? (
                <View style={styles.filterRangeContent}>
                  <RangeSlider
                    label={rangeConfig.label}
                    minValue={draft[rangeConfig.key].min}
                    maxValue={draft[rangeConfig.key].max}
                    onChange={(range) =>
                      setDraft((current) => ({
                        ...current,
                        [rangeConfig.key]: range,
                      }))
                    }
                    minimum={0}
                    maximum={rangeConfig.maximum}
                    step={rangeConfig.step}
                    formatValue={rangeConfig.formatValue}
                  />
                  <Text style={styles.rangeHelperText}>Quick suggestions</Text>
                  <View style={styles.rangeSuggestions}>
                    {rangeConfig.suggestions.map((suggestion) => {
                      const range = draft[rangeConfig.key];
                      return (
                        <FilterChip
                          key={suggestion.label}
                          label={suggestion.label}
                          selected={
                            range.min === suggestion.min &&
                            range.max === suggestion.max
                          }
                          onPress={() =>
                            setDraft((current) => ({
                              ...current,
                              [rangeConfig.key]: {
                                min: suggestion.min,
                                max: suggestion.max,
                              },
                            }))
                          }
                        />
                      );
                    })}
                  </View>
                </View>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.filterOptionsList}
                >
                  {options.length ? (
                    options.map((option) => {
                      const isLocationOption = isLocationFilterOption(option);
                      const optionLabel = isLocationOption
                        ? option.label
                        : option;
                      const optionKey = isLocationOption ? option.id : option;
                      const selected = isLocationOption
                        ? draft.locations.some(
                            (location) =>
                              location.state === option.state &&
                              location.city === option.city,
                          )
                        : isMultiOptionSelected(option);
                      return (
                        <Pressable
                          key={optionKey}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          onPress={() =>
                            isLocationOption
                              ? toggleLocation(option)
                              : toggleMultiOption(option)
                          }
                          style={({ pressed }) => [
                            styles.filterOptionRow,
                            selected && styles.filterOptionRowSelected,
                            pressed && styles.pressed,
                          ]}
                        >
                          <View
                            style={[
                              styles.filterOptionIcon,
                              selected && styles.filterOptionIconSelected,
                            ]}
                          >
                            <AppIcon
                              name={
                                selected
                                  ? "checkmark"
                                  : isLocationOption
                                    ? "location-outline"
                                    : "chevron-forward"
                              }
                              size={17}
                              color={
                                selected
                                  ? theme.colors.primaryText
                                  : theme.colors.primary
                              }
                            />
                          </View>
                          <Text
                            numberOfLines={2}
                            style={[
                              styles.filterOptionLabel,
                              selected && styles.filterOptionLabelSelected,
                            ]}
                          >
                            {optionLabel}
                          </Text>
                          {selected ? (
                            <View style={styles.filterSelectedCheck}>
                              <AppIcon
                                name="checkmark"
                                size={13}
                                color={theme.colors.primaryText}
                              />
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })
                  ) : (
                    <View style={styles.filterEmpty}>
                      <AppIcon
                        name="search-outline"
                        size={22}
                        color={theme.colors.textSecondary}
                      />
                      <Text style={styles.filterEmptyTitle}>
                        No matching locations
                      </Text>
                      <Text style={styles.filterEmptyBody}>
                        Search by an official Indian state, city or town name.
                      </Text>
                    </View>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
          <View style={styles.filterDrawerActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setDraft(DEFAULT_DISCOVER_FILTERS);
                setLocationQuery("");
              }}
              style={({ pressed }) => [
                styles.filterResetButton,
                pressed && styles.pressed,
              ]}
            >
              <AppIcon
                name="refresh-outline"
                size={17}
                color={theme.colors.primary}
              />
              <Text style={styles.filterResetText}>Reset</Text>
            </Pressable>
            <View style={styles.flex}>
              <AppButton
                label={`Apply${draftAppliedCount ? ` ${draftAppliedCount} filter${draftAppliedCount === 1 ? "" : "s"}` : " filters"}`}
                icon="checkmark"
                onPress={() =>
                  onApply({
                    ...draft,
                    priceRange: normaliseRange(draft.priceRange, 0, 100000),
                    ratingRange: normaliseRange(draft.ratingRange, 0, 5),
                    followersRange: normaliseRange(
                      draft.followersRange,
                      0,
                      1000000,
                    ),
                  })
                }
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createCreatorFeed(creators: Influencer[]): CreatorFeedItem[] {
  const feed: CreatorFeedItem[] = [];
  for (
    let offset = 0, railNumber = 0;
    offset < creators.length;
    offset += 3, railNumber += 1
  ) {
    feed.push({
      id: `creator-rail-${railNumber}`,
      kind: "rail",
      title: railNumber === 0 ? "Recommended creators" : "More creator matches",
      creators: creators.slice(offset, offset + 3),
    });
  }
  return feed;
}

function CreatorRail({
  title,
  creators,
  width,
  inset,
  savedIds,
  onSave,
  onInfluencer,
}: {
  title: string;
  creators: Influencer[];
  width: number;
  inset: number;
  savedIds: string[];
  onSave: (id: string) => void;
  onInfluencer: (item: Influencer) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [activeIndex, setActiveIndex] = useState(0);
  const interval = width + theme.spacing.sm;
  return (
    <View style={styles.discoveryRailSection}>
      <View style={styles.discoveryRailHeader}>
        <View style={styles.discoveryRailTitleGroup}>
          <AppIcon
            name="people-outline"
            size={17}
            color={theme.colors.primary}
          />
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.discoveryRailTitle}
          >
            {title}
          </Text>
        </View>
        <View style={styles.discoveryRailHintGroup}>
          <AppIcon
            name="swap-horizontal-outline"
            size={14}
            color={theme.colors.textSecondary}
          />
          <Text numberOfLines={1} style={styles.discoveryRailHint}>
            Swipe
          </Text>
        </View>
      </View>
      <ScrollView
        horizontal
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        disableIntervalMomentum
        snapToInterval={interval}
        snapToAlignment="start"
        style={styles.discoveryCarouselViewport}
        contentContainerStyle={[
          styles.discoveryCarousel,
          { paddingHorizontal: inset },
        ]}
        onMomentumScrollEnd={(event) =>
          setActiveIndex(
            Math.min(
              creators.length - 1,
              Math.max(
                0,
                Math.round(event.nativeEvent.contentOffset.x / interval),
              ),
            ),
          )
        }
      >
        {creators.map((item, index) => (
          <CreatorSpotlight
            key={item.id}
            item={item}
            width={width}
            saved={savedIds.includes(item.id)}
            onSave={() => onSave(item.id)}
            onPress={() => onInfluencer(item)}
          />
        ))}
      </ScrollView>
      <View style={styles.discoveryDots}>
        {creators.map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.discoveryDot,
              index === activeIndex && styles.discoveryDotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function CreatorDiscoverView({
  savedLocations,
  onScroll,
  onCampaign,
  additionalCampaigns,
  privateCampaignIds,
}: {
  savedLocations: string[];
  onScroll: ScrollHandler;
  onCampaign: (item: Campaign) => void;
  additionalCampaigns: Campaign[];
  privateCampaignIds: string[];
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { width } = useWindowDimensions();
  const { campaigns: demoCampaigns, query, setQuery, isLoading } =
    useDemoMarketplace();
  const campaigns = [...additionalCampaigns, ...demoCampaigns];
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [isLocationFilterOpen, setIsLocationFilterOpen] = useState(false);
  const briefCardWidth = Math.min(
    322,
    Math.max(248, width - theme.spacing.lg * 2),
  );
  const visibleCampaigns = campaigns.filter((campaign) => {
    const matchesQuery =
      `${campaign.brand} ${campaign.title} ${campaign.city} ${campaign.category}`
        .toLowerCase()
        .includes(query.toLowerCase());
    return (
      matchesQuery &&
      !privateCampaignIds.includes(campaign.id) &&
      (!selectedLocations.length ||
        selectedLocations.includes("Pan India") ||
        selectedLocations.includes(campaign.city) ||
        campaign.city === "Pan India")
    );
  });
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.discoverHeading}>
        <View style={styles.flex}>
          <Text style={styles.pageIntro}>
            Browse briefs that fit your audience, city and content style.
          </Text>
        </View>
        <View style={styles.creatorDiscoverIcon}>
          <AppIcon
            name="briefcase-outline"
            size={20}
            color={theme.colors.primary}
          />
        </View>
      </View>
      <SearchField
        value={query}
        onChangeText={setQuery}
        onFilter={() => setIsLocationFilterOpen(true)}
        filterActive={selectedLocations.length > 0}
        placeholder="Search briefs, brand or city"
        accessibilityLabel="Search campaign briefs"
      />
      <LocationFilterSheet
        visible={isLocationFilterOpen}
        locations={
          savedLocations.length
            ? savedLocations
            : DEMO_CREATOR_PROFILE_LOCATIONS
        }
        selected={selectedLocations}
        limitWithoutQuery={null}
        onClose={() => setIsLocationFilterOpen(false)}
        onApply={setSelectedLocations}
      />
      <View style={styles.resultsHeader}>
        <Text style={styles.resultText}>
          {isLoading
            ? "Finding briefs…"
            : `${visibleCampaigns.length} campaign briefs`}
        </Text>
        {selectedLocations.length ? (
          <ClearFiltersButton
            onPress={() => setSelectedLocations([])}
          />
        ) : null}
      </View>
      {isLoading ? (
        <MarketplaceSkeleton />
      ) : visibleCampaigns.length === 0 ? (
        <NoResultsState
          onClear={
            query.trim() || selectedLocations.length
              ? () => {
                  setQuery("");
                  setSelectedLocations([]);
                }
              : undefined
          }
          clearLabel={
            selectedLocations.length ? "Clear all filters" : "Clear search"
          }
        />
      ) : (
        <View style={styles.discoveryFeed}>
          {createCampaignFeed(visibleCampaigns).map((section) =>
            section.kind === "rail" ? (
              <CampaignRail
                key={section.id}
                title={section.title}
                campaigns={section.campaigns}
                width={briefCardWidth}
                onCampaign={onCampaign}
              />
            ) : (
              <CampaignCard
                key={section.id}
                item={section.campaign}
                onPress={() => onCampaign(section.campaign)}
              />
            ),
          )}
        </View>
      )}
    </ScrollView>
  );
}

function CampaignsView({
  role,
  onScroll,
  onCampaign,
  onCreate,
  additionalCampaigns = [],
  privateCampaignIds = [],
  proposals,
  onProposal,
}: {
  role: "Brand" | "Influencer";
  onScroll: ScrollHandler;
  onCampaign: (item: Campaign) => void;
  onCreate: () => void;
  additionalCampaigns?: Campaign[];
  privateCampaignIds?: string[];
  proposals: DemoProposal[];
  onProposal: (proposal: DemoProposal) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { width } = useWindowDimensions();
  const { campaigns: demoCampaigns, isLoading } = useDemoMarketplace();
  const campaigns = [...additionalCampaigns, ...demoCampaigns];
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<CampaignFilters>(
    DEFAULT_CAMPAIGN_FILTERS,
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const appliedCount = getCampaignAppliedFilterCount(filters);
  const categories = useMemo(
    () => Array.from(new Set(campaigns.map((campaign) => campaign.category))),
    [campaigns],
  );
  const visibleCampaigns = useMemo(
    () =>
      campaigns.filter((campaign) => {
        const searchValue =
          `${campaign.brand} ${campaign.title} ${campaign.city} ${campaign.category} ${campaign.status}`.toLowerCase();
        return (
          (!query.trim() || searchValue.includes(query.toLowerCase())) &&
          (filters.statuses.length === 0 ||
            filters.statuses.includes(getCampaignFilterStatus(campaign.status))) &&
          (filters.categories.length === 0 ||
            filters.categories.includes(campaign.category))
        );
      }),
    [campaigns, filters.categories, filters.statuses, query],
  );
  const campaignFeed = useMemo(
    () => createCampaignFeed(visibleCampaigns),
    [visibleCampaigns],
  );
  const counts = useMemo(
    () => ({
      active: visibleCampaigns.filter((item) => item.status === "Open").length,
      progress: visibleCampaigns.filter(
        (item) => item.status === "Proposal sent" || item.status === "Accepted",
      ).length,
      closed: visibleCampaigns.filter((item) => item.status === "Completed").length,
    }),
    [visibleCampaigns],
  );
  const resetFilters = () => setFilters(DEFAULT_CAMPAIGN_FILTERS);
  const railCardWidth = Math.min(
    322,
    Math.max(248, width - theme.spacing.lg * 2),
  );
  if (role === "Influencer") {
    return (
      <CreatorCampaignsView
        onScroll={onScroll}
        onCampaign={onCampaign}
        additionalCampaigns={additionalCampaigns}
        privateCampaignIds={privateCampaignIds}
        proposals={proposals}
        onProposal={onProposal}
      />
    );
  }
  return (
    <>
      <FlatList
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={isLoading ? [] : campaignFeed}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          item.kind === "rail" ? (
            <CampaignRail
              title={item.title}
              campaigns={item.campaigns}
              width={railCardWidth}
              onCampaign={onCampaign}
            />
          ) : (
            <CampaignCard
              item={item.campaign}
              onPress={() => onCampaign(item.campaign)}
            />
          )
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.campaignList}
        ListHeaderComponent={
        <View style={styles.campaignHeader}>
          <View style={styles.pageRow}>
            <View style={styles.flex}>
              <Text style={styles.pageIntro}>
                Manage briefs, proposals and completed work.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create campaign"
              onPress={onCreate}
              style={styles.addButton}
            >
              <AppIcon name="add" size={24} color={theme.colors.primaryText} />
            </Pressable>
          </View>
          <SearchField
            value={query}
            onChangeText={setQuery}
            onFilter={() => setIsFilterOpen(true)}
            filterActive={appliedCount > 0}
            placeholder="Search campaign, brand or city"
            accessibilityLabel="Search brand campaigns"
          />
          <View style={styles.summaryRow}>
            <Stat label="Open" value={`${counts.active}`} />
            <Stat label="In progress" value={`${counts.progress}`} />
            <Stat label="Closed" value={`${counts.closed}`} />
          </View>
          <View style={styles.campaignFilterHeader}>
            <View>
              <Text style={styles.campaignSectionTitle}>
                Your campaign flow
              </Text>
              <Text style={styles.resultText}>
                {isLoading
                  ? "Loading campaigns…"
                  : `${visibleCampaigns.length} campaigns shown`}
              </Text>
            </View>
            {query.trim() || appliedCount ? (
              <ClearFiltersButton
                onPress={() => {
                  setQuery("");
                  resetFilters();
                }}
              />
            ) : null}
          </View>
          {isLoading ? <MarketplaceSkeleton /> : null}
        </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <CampaignEmptyState
              hasFilters={Boolean(query.trim() || appliedCount)}
              onCreate={onCreate}
              onClear={() => {
                setQuery("");
                resetFilters();
              }}
            />
          )
        }
        ListFooterComponent={
          isLoading ? null : (
            <AppCard style={styles.tipCard}>
              <View style={styles.tipIcon}>
                <AppIcon
                  name="bulb-outline"
                  size={22}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.tipTitle}>
                  A clear brief gets stronger matches
                </Text>
                <Text style={styles.tipBody}>
                  Add deliverables, target city and budget range before
                  publishing.
                </Text>
              </View>
            </AppCard>
          )
        }
      />
      <CampaignFilterDrawer
        visible={isFilterOpen}
        value={filters}
        categories={categories}
        onClose={() => setIsFilterOpen(false)}
        onApply={(nextFilters) => {
          setFilters(nextFilters);
          setIsFilterOpen(false);
        }}
      />
    </>
  );
}

function CreatorCampaignsView({
  onScroll,
  onCampaign,
  additionalCampaigns,
  privateCampaignIds,
  proposals,
  onProposal,
}: {
  onScroll: ScrollHandler;
  onCampaign: (item: Campaign) => void;
  additionalCampaigns: Campaign[];
  privateCampaignIds: string[];
  proposals: DemoProposal[];
  onProposal: (proposal: DemoProposal) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { campaigns: demoCampaigns, isLoading } = useDemoMarketplace();
  const campaigns = [...additionalCampaigns, ...demoCampaigns];
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<CampaignFilters>(
    DEFAULT_CAMPAIGN_FILTERS,
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const categories = useMemo(
    () => Array.from(new Set(campaigns.map((campaign) => campaign.category))),
    [campaigns],
  );
  const appliedCount = getCampaignAppliedFilterCount(filters);
  const visibleCampaigns = campaigns.filter(
    (campaign) => {
      const searchValue =
        `${campaign.brand} ${campaign.title} ${campaign.city} ${campaign.category}`.toLowerCase();
      return (
        !privateCampaignIds.includes(campaign.id) &&
        (!query.trim() || searchValue.includes(query.toLowerCase())) &&
        (filters.statuses.length === 0 ||
          filters.statuses.includes(getCampaignFilterStatus(campaign.status))) &&
        (filters.categories.length === 0 ||
          filters.categories.includes(campaign.category))
      );
    },
  );
  const publicBriefs = visibleCampaigns.filter(
    (campaign) => campaign.status === "Open",
  );
  const myApplications = proposals
    .filter(
      (proposal) =>
        proposal.direction === "creator_to_brand" &&
        proposal.status !== "Declined",
    )
    .slice()
    .reverse();
  const activeCollaborations = myApplications.filter(
    (proposal) =>
      proposal.status === "Accepted" || proposal.status === "Completed",
  );
  const renderApplication = (proposal: DemoProposal) => (
    <ProposalCard
      key={proposal.id}
      proposal={proposal}
      onViewDetails={() => onProposal(proposal)}
    />
  );
  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.pageRow}>
          <View style={styles.flex}>
            <Text style={styles.pageIntro}>
              Find public briefs, track applications and continue active collaborations.
            </Text>
          </View>
          <View style={styles.creatorDiscoverIcon}>
            <AppIcon
              name="briefcase-outline"
              size={20}
              color={theme.colors.primary}
            />
          </View>
        </View>
        <SearchField
          value={query}
          onChangeText={setQuery}
          onFilter={() => setIsFilterOpen(true)}
          filterActive={appliedCount > 0}
          placeholder="Search briefs, brand or city"
          accessibilityLabel="Search creator campaign briefs"
        />
        <View style={styles.resultsHeader}>
          <Text style={styles.resultText}>
            {isLoading
              ? "Loading briefs…"
              : `${visibleCampaigns.length} briefs shown`}
          </Text>
          {query.trim() || appliedCount ? (
            <ClearFiltersButton
              onPress={() => {
                setQuery("");
                setFilters(DEFAULT_CAMPAIGN_FILTERS);
              }}
            />
          ) : null}
        </View>
        <SectionTitle
          title="Public briefs"
          action={publicBriefs.length ? `${publicBriefs.length} open` : undefined}
        />
        {isLoading ? (
          <MarketplaceSkeleton />
        ) : publicBriefs.length === 0 ? (
          <NoResultsState
            onClear={
              query.trim() || appliedCount
                ? () => {
                    setQuery("");
                    setFilters(DEFAULT_CAMPAIGN_FILTERS);
                  }
                : undefined
            }
            clearLabel={appliedCount ? "Clear all filters" : "Clear search"}
          />
        ) : (
          publicBriefs.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              item={campaign}
              onPress={() => onCampaign(campaign)}
            />
          ))
        )}
        <SectionTitle
          title="My applications"
          action={myApplications.length ? `${myApplications.length} tracked` : undefined}
        />
        {myApplications.length ? (
          <View style={styles.campaignProposalList}>
            {myApplications.map(renderApplication)}
          </View>
        ) : (
          <AppCard flat style={styles.campaignEmptyInline}>
            <AppIcon
              name="paper-plane-outline"
              size={24}
              color={theme.colors.primary}
            />
            <Text style={styles.emptyTitle}>No applications yet</Text>
            <Text style={styles.emptyBody}>
              Open a public brief and send your first proposal.
            </Text>
          </AppCard>
        )}
        <SectionTitle
          title="Active collaborations"
          action={activeCollaborations.length ? `${activeCollaborations.length} active` : undefined}
        />
        {activeCollaborations.length ? (
          <View style={styles.campaignProposalList}>
            {activeCollaborations.map(renderApplication)}
          </View>
        ) : (
          <AppCard flat style={styles.campaignEmptyInline}>
            <AppIcon
              name="briefcase-outline"
              size={24}
              color={theme.colors.primary}
            />
            <Text style={styles.emptyTitle}>No active collaborations</Text>
            <Text style={styles.emptyBody}>
              Accepted applications will appear here for quick access.
            </Text>
          </AppCard>
        )}
      </ScrollView>
      <CampaignFilterDrawer
        visible={isFilterOpen}
        value={filters}
        categories={categories}
        onClose={() => setIsFilterOpen(false)}
        onApply={(nextFilters) => {
          setFilters(nextFilters);
          setIsFilterOpen(false);
        }}
      />
    </>
  );
}

function CampaignFilterDrawer({
  visible,
  value,
  categories,
  onClose,
  onApply,
}: {
  visible: boolean;
  value: CampaignFilters;
  categories: string[];
  onClose: () => void;
  onApply: (filters: CampaignFilters) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const [activeCategory, setActiveCategory] = useState<"status" | "category">(
    "status",
  );
  const [draft, setDraft] = useState<CampaignFilters>(value);
  useEffect(() => {
    if (visible) {
      setDraft(value);
      setActiveCategory("status");
    }
  }, [value, visible]);
  const appliedCount = getCampaignAppliedFilterCount(draft);
  const options =
    activeCategory === "status"
      ? ["Open", "In progress", "Closed"]
      : categories;
  const selectedCount =
    activeCategory === "status"
      ? draft.statuses.length
      : draft.categories.length;
  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.filterDrawerOverlay}>
        <Pressable style={styles.filterBackdrop} onPress={onClose} />
        <View
          style={[
            styles.filterDrawer,
            { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) },
          ]}
        >
          <View style={styles.filterSheetHandle} />
          <View style={styles.filterDrawerHeader}>
            <View style={styles.filterDrawerTitleRow}>
              <AppIcon
                name="funnel-outline"
                size={20}
                color={theme.colors.primary}
              />
              <View style={styles.flex}>
                <Text style={styles.sheetTitle}>Filter campaigns</Text>
                <Text numberOfLines={1} style={styles.sheetSubtitle}>
                  {appliedCount ? `${appliedCount} selected` : "choose filters"}
                </Text>
              </View>
            </View>
            <IconButton name="close" label="Close filters" onPress={onClose} />
          </View>
          <View style={styles.filterDrawerBody}>
            <View style={styles.filterCategoryRail}>
              {[
                {
                  key: "status" as const,
                  icon: "radio-button-on-outline" as const,
                  label: "Status",
                },
                {
                  key: "category" as const,
                  icon: "grid-outline" as const,
                  label: "Category",
                },
              ].map((item) => {
                const selected = activeCategory === item.key;
                const applied =
                  item.key === "status"
                    ? draft.statuses.length > 0
                    : draft.categories.length > 0;
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setActiveCategory(item.key)}
                    style={({ pressed }) => [
                      styles.filterCategoryItem,
                      selected && styles.filterCategoryItemActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <AppIcon
                      name={item.icon}
                      size={18}
                      color={
                        selected
                          ? theme.colors.primary
                        : theme.colors.textSecondary
                      }
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.filterCategoryLabel,
                        selected && styles.filterCategoryLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {applied ? <View style={styles.filterCategoryDot} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.filterOptionsPane}>
              <View style={styles.filterOptionsHeader}>
                <View style={styles.flex}>
                  <Text style={styles.filterOptionsTitle}>
                    {activeCategory === "status" ? "Status" : "Category"}
                  </Text>
                  <Text numberOfLines={1} style={styles.filterOptionsValue}>
                    {selectedCount ? `${selectedCount} selected` : "Any"}
                  </Text>
                </View>
                <AppIcon
                  name={activeCategory === "status" ? "flag-outline" : "list-outline"}
                  size={19}
                  color={theme.colors.primary}
                />
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.filterOptionsList}
              >
                {options.map((option) => {
                  const selected =
                    activeCategory === "status"
                      ? draft.statuses.includes(
                          option as CampaignFilters["statuses"][number],
                        )
                      : draft.categories.includes(option);
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() =>
                        setDraft((current) =>
                          activeCategory === "status"
                            ? {
                                ...current,
                                statuses: toggleValue(
                                  current.statuses,
                                  option as CampaignFilters["statuses"][number],
                                ),
                              }
                            : {
                                ...current,
                                categories: toggleValue(
                                  current.categories,
                                  option,
                                ),
                              },
                        )
                      }
                      style={({ pressed }) => [
                        styles.filterOptionRow,
                        selected && styles.filterOptionRowSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.filterOptionIcon,
                          selected && styles.filterOptionIconSelected,
                        ]}
                      >
                        <AppIcon
                          name={selected ? "checkmark" : "chevron-forward"}
                          size={17}
                          color={
                            selected
                              ? theme.colors.primaryText
                              : theme.colors.primary
                          }
                        />
                      </View>
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.filterOptionLabel,
                          selected && styles.filterOptionLabelSelected,
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
          <View style={styles.filterDrawerActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDraft(DEFAULT_CAMPAIGN_FILTERS)}
              style={({ pressed }) => [
                styles.filterResetButton,
                pressed && styles.pressed,
              ]}
            >
              <AppIcon
                name="refresh-outline"
                size={17}
                color={theme.colors.primary}
              />
              <Text style={styles.filterResetText}>Reset</Text>
            </Pressable>
            <View style={styles.flex}>
              <AppButton
                label={`Apply${appliedCount ? ` ${appliedCount}` : ""}`}
                icon="checkmark"
                onPress={() => onApply(draft)}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ProposalView({
  role,
  proposals,
  onScroll,
  onProposal,
  onProposalStatus,
  onChat,
}: {
  role: "Brand" | "Influencer";
  proposals: DemoProposal[];
  onScroll: ScrollHandler;
  onProposal: (proposal: DemoProposal) => void;
  onProposalStatus: (id: string, status: ProposalStatus) => void;
  onChat: (name: string, initials: string) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ProposalFilters>(
    DEFAULT_PROPOSAL_FILTERS,
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const incomingDirection =
    role === "Brand" ? "creator_to_brand" : "brand_to_creator";
  const visibleProposals = useMemo(
    () =>
      proposals.filter((proposal) => {
        if (proposal.status === "Declined") return false;
        const direction =
          proposal.direction === incomingDirection ? "incoming" : "sent";
        const searchValue =
          `${proposal.participantName} ${proposal.campaignTitle} ${proposal.city} ${proposal.status}`.toLowerCase();
        return (
          (!query.trim() || searchValue.includes(query.toLowerCase())) &&
          (filters.status.length === 0 ||
            filters.status.includes(proposal.status)) &&
          (filters.direction.length === 0 ||
            filters.direction.includes(direction)) &&
          (filters.cities.length === 0 ||
            filters.cities.includes(proposal.city))
        );
      }),
    [
      filters.cities,
      filters.direction,
      filters.status,
      incomingDirection,
      proposals,
      query,
    ],
  );
  const proposalFeed = useMemo(
    () => createProposalFeed(visibleProposals),
    [visibleProposals],
  );
  const proposalRailWidth = Math.min(
    340,
    Math.max(248, width - theme.spacing.lg * 2),
  );
  const appliedCount = getProposalAppliedFilterCount(filters);
  const proposalCities = useMemo(
    () =>
      Array.from(
        new Set(
          proposals
            .filter((proposal) => proposal.status !== "Declined")
            .map((proposal) => proposal.city),
        ),
      ),
    [proposals],
  );
  const pending = proposals.filter(
    (proposal) => proposal.status === "Pending",
  ).length;
  const resetFilters = () => setFilters(DEFAULT_PROPOSAL_FILTERS);
  const renderProposalCard = (proposal: DemoProposal) => (
    <ProposalCard
      key={proposal.id}
      proposal={proposal}
      onViewDetails={() => onProposal(proposal)}
      onAccept={
        proposal.status === "Pending"
          ? () => onProposalStatus(proposal.id, "Accepted")
          : undefined
      }
      onDecline={
        proposal.status === "Pending"
          ? () => onProposalStatus(proposal.id, "Declined")
          : undefined
      }
      onChat={
        proposal.status === "Accepted"
          ? () =>
              onChat(
                proposal.participantName,
                proposal.participantInitials,
              )
          : undefined
      }
    />
  );
  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.pageRow}>
          <View style={styles.flex}>
            <Text style={styles.detailTitle}>
              {role === "Brand" ? "Creator proposals" : "Your applications"}
            </Text>
            <Text style={styles.pageIntro}>
              {role === "Brand"
                ? "Review creator applications, open the full brief and accept the right fit."
                : "Track sent applications and review brand requests in one place."}
            </Text>
          </View>
          <View style={styles.creatorDiscoverIcon}>
            <AppIcon
              name="paper-plane-outline"
              size={20}
              color={theme.colors.primary}
            />
          </View>
        </View>
        <SearchField
          value={query}
          onChangeText={setQuery}
          onFilter={() => setIsFilterOpen(true)}
          filterActive={appliedCount > 0}
          placeholder="Search proposals, name or city"
          accessibilityLabel="Search proposals"
        />
        <View style={styles.summaryRow}>
          <Stat label="Needs review" value={`${pending}`} />
          <Stat
            label="Accepted"
            value={`${proposals.filter((proposal) => proposal.status === "Accepted").length}`}
          />
          <Stat
            label="All"
            value={`${proposals.filter((proposal) => proposal.status !== "Declined").length}`}
          />
        </View>
        <View style={styles.resultsHeader}>
          <Text style={styles.resultText}>
            {`${visibleProposals.length} proposals shown`}
          </Text>
          {query.trim() || appliedCount ? (
            <ClearFiltersButton
              onPress={() => {
                setQuery("");
                resetFilters();
              }}
            />
          ) : null}
        </View>
        {visibleProposals.length === 0 ? (
          <NoResultsState
            onClear={
              query.trim() || appliedCount
                ? () => {
                    setQuery("");
                    resetFilters();
                  }
                : undefined
            }
            clearLabel={appliedCount ? "Clear all filters" : "Clear search"}
          />
        ) : (
          proposalFeed.map((item) =>
            item.kind === "rail" ? (
              <ProposalRail
                key={item.id}
                title={item.title}
                proposals={item.proposals}
                width={proposalRailWidth}
                renderProposal={renderProposalCard}
              />
            ) : (
              renderProposalCard(item.proposal)
            ),
          )
        )}
      </ScrollView>
      <ProposalFilterDrawer
        visible={isFilterOpen}
        value={filters}
        cities={proposalCities}
        onClose={() => setIsFilterOpen(false)}
        onApply={(nextFilters) => {
          setFilters(nextFilters);
          setIsFilterOpen(false);
        }}
      />
    </>
  );
}

function ProposalFilterDrawer({
  visible,
  value,
  cities,
  onClose,
  onApply,
}: {
  visible: boolean;
  value: ProposalFilters;
  cities: string[];
  onClose: () => void;
  onApply: (filters: ProposalFilters) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const [activeCategory, setActiveCategory] = useState<
    "status" | "direction" | "city"
  >("status");
  const [draft, setDraft] = useState<ProposalFilters>(value);
  useEffect(() => {
    if (visible) {
      setDraft(value);
      setActiveCategory("status");
    }
  }, [value, visible]);
  const appliedCount = getProposalAppliedFilterCount(draft);
  const options =
    activeCategory === "status"
      ? ["Pending", "Accepted", "Declined", "Completed"]
      : activeCategory === "direction"
        ? ["incoming", "sent"]
        : cities;
  const selectedCount =
    activeCategory === "status"
      ? draft.status.length
      : activeCategory === "direction"
        ? draft.direction.length
        : draft.cities.length;
  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.filterDrawerOverlay}>
        <Pressable style={styles.filterBackdrop} onPress={onClose} />
        <View
          style={[
            styles.filterDrawer,
            { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) },
          ]}
        >
          <View style={styles.filterSheetHandle} />
          <View style={styles.filterDrawerHeader}>
            <View style={styles.filterDrawerTitleRow}>
              <AppIcon
                name="options-outline"
                size={20}
                color={theme.colors.primary}
              />
              <View style={styles.flex}>
                <Text style={styles.sheetTitle}>Filter proposals</Text>
                <Text numberOfLines={1} style={styles.sheetSubtitle}>
                  {appliedCount ? `${appliedCount} selected` : "choose filters"}
                </Text>
              </View>
            </View>
            <IconButton name="close" label="Close filters" onPress={onClose} />
          </View>
          <View style={styles.filterDrawerBody}>
            <View style={styles.filterCategoryRail}>
              {[
                {
                  key: "status" as const,
                  icon: "flag-outline" as const,
                  label: "Status",
                },
                {
                  key: "direction" as const,
                  icon: "swap-horizontal-outline" as const,
                  label: "Type",
                },
                {
                  key: "city" as const,
                  icon: "location-outline" as const,
                  label: "City",
                },
              ].map((item) => {
                const selected = activeCategory === item.key;
                const applied =
                  item.key === "status"
                    ? draft.status.length > 0
                    : item.key === "direction"
                      ? draft.direction.length > 0
                      : draft.cities.length > 0;
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setActiveCategory(item.key)}
                    style={({ pressed }) => [
                      styles.filterCategoryItem,
                      selected && styles.filterCategoryItemActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <AppIcon
                      name={item.icon}
                      size={18}
                      color={
                        selected
                          ? theme.colors.primary
                        : theme.colors.textSecondary
                      }
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.filterCategoryLabel,
                        selected && styles.filterCategoryLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {applied ? <View style={styles.filterCategoryDot} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.filterOptionsPane}>
              <View style={styles.filterOptionsHeader}>
                <View style={styles.flex}>
                  <Text style={styles.filterOptionsTitle}>
                    {activeCategory === "status"
                      ? "Status"
                      : activeCategory === "direction"
                        ? "Direction"
                        : "City"}
                  </Text>
                  <Text numberOfLines={1} style={styles.filterOptionsValue}>
                    {selectedCount ? `${selectedCount} selected` : "Any"}
                  </Text>
                </View>
                <AppIcon
                  name="list-outline"
                  size={19}
                  color={theme.colors.primary}
                />
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.filterOptionsList}
              >
                {options.map((option) => {
                  const selected =
                    activeCategory === "status"
                      ? draft.status.includes(option as ProposalStatus)
                      : activeCategory === "direction"
                        ? draft.direction.includes(
                            option as ProposalFilters["direction"][number],
                          )
                        : draft.cities.includes(option);
                  const label =
                    option === "incoming"
                      ? "Incoming"
                      : option === "sent"
                        ? "Sent"
                        : option;
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() =>
                        setDraft((current) => {
                          if (activeCategory === "status") {
                            return {
                              ...current,
                              status: toggleValue(
                                current.status,
                                option as ProposalStatus,
                              ),
                            };
                          }
                          if (activeCategory === "direction") {
                            return {
                              ...current,
                              direction: toggleValue(
                                current.direction,
                                option as ProposalFilters["direction"][number],
                              ),
                            };
                          }
                          return {
                            ...current,
                            cities: toggleValue(current.cities, option),
                          };
                        })
                      }
                      style={({ pressed }) => [
                        styles.filterOptionRow,
                        selected && styles.filterOptionRowSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.filterOptionIcon,
                          selected && styles.filterOptionIconSelected,
                        ]}
                      >
                        <AppIcon
                          name={selected ? "checkmark" : "chevron-forward"}
                          size={17}
                          color={
                            selected
                              ? theme.colors.primaryText
                              : theme.colors.primary
                          }
                        />
                      </View>
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.filterOptionLabel,
                          selected && styles.filterOptionLabelSelected,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
          <View style={styles.filterDrawerActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDraft(DEFAULT_PROPOSAL_FILTERS)}
              style={({ pressed }) => [
                styles.filterResetButton,
                pressed && styles.pressed,
              ]}
            >
              <AppIcon
                name="refresh-outline"
                size={17}
                color={theme.colors.primary}
              />
              <Text style={styles.filterResetText}>Reset</Text>
            </Pressable>
            <View style={styles.flex}>
              <AppButton
                label={`Apply${appliedCount ? ` ${appliedCount}` : ""}`}
                icon="checkmark"
                onPress={() => onApply(draft)}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ProposalRail({
  title,
  proposals,
  width,
  renderProposal,
}: {
  title: string;
  proposals: DemoProposal[];
  width: number;
  renderProposal: (proposal: DemoProposal) => ReactNode;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { width: screenWidth } = useWindowDimensions();
  const sideInset = Math.max(0, (screenWidth - width) / 2);
  const snapOffsets = proposals.map(
    (_, index) => index * (width + theme.spacing.sm),
  );
  return (
    <View style={styles.campaignRailSection}>
      <View style={styles.campaignRailHeader}>
        <Text style={styles.campaignRailTitle}>{title}</Text>
        <Text style={styles.campaignRailHint}>Swipe to review</Text>
      </View>
      <ScrollView
        horizontal
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        disableIntervalMomentum
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        style={styles.campaignRailViewport}
        contentContainerStyle={[
          styles.campaignRailContent,
          { paddingHorizontal: sideInset },
        ]}
      >
        {proposals.map((proposal) => (
          <View key={proposal.id} style={[styles.campaignRailItem, { width }]}>
            {renderProposal(proposal)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function createProposalFeed(proposals: DemoProposal[]): ProposalFeedItem[] {
  const feed: ProposalFeedItem[] = [];
  let offset = 0;
  let railNumber = 0;
  while (proposals.length - offset >= 3) {
    const railProposals = proposals.slice(offset, offset + 3);
    feed.push({
      id: `proposal-rail-${railNumber}`,
      kind: "rail",
      title: railNumber === 0 ? "Priority proposals" : "More proposals",
      proposals: railProposals,
    });
    offset += railProposals.length;
    railNumber += 1;
    const standardCards = proposals.slice(offset, offset + 2);
    standardCards.forEach((proposal) =>
      feed.push({ id: `proposal-card-${proposal.id}`, kind: "card", proposal }),
    );
    offset += standardCards.length;
  }
  proposals
    .slice(offset)
    .forEach((proposal) =>
      feed.push({ id: `proposal-card-${proposal.id}`, kind: "card", proposal }),
    );
  return feed;
}

function EmptyProposalState({
  role,
  incoming,
}: {
  role: "Brand" | "Influencer";
  incoming: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <AppCard style={styles.emptyProposal}>
      <AppIcon
        name="paper-plane-outline"
        size={22}
        color={theme.colors.primary}
      />
      <Text style={styles.emptyTitle}>
        {incoming
          ? role === "Brand"
            ? "No creator requests yet"
            : "No brand requests yet"
          : role === "Brand"
            ? "No sent proposals yet"
            : "No applications yet"}
      </Text>
      <Text style={styles.emptyBody}>
        New collaboration activity will appear here.
      </Text>
    </AppCard>
  );
}

function ProposalBack({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const locked = useRef(false);
  const handlePress = () => {
    if (locked.current) return;
    locked.current = true;
    onBack();
    setTimeout(() => {
      locked.current = false;
    }, 450);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
      onPress={handlePress}
    >
      <Text style={styles.back}>‹ Back</Text>
    </Pressable>
  );
}

function ProposalDetailView({
  role,
  proposal,
  onBack,
  onProposalStatus,
  onChat,
}: {
  role: "Brand" | "Influencer";
  proposal: DemoProposal;
  onBack: () => void;
  onProposalStatus: (id: string, status: ProposalStatus) => void;
  onChat: (name: string, initials: string) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const isIncoming =
    role === "Brand"
      ? proposal.direction === "creator_to_brand"
      : proposal.direction === "brand_to_creator";
  const [pendingStatus, setPendingStatus] = useState<
    "Accepted" | "Declined" | null
  >(null);
  const confirmStatusChange = () => {
    if (!pendingStatus) return;
    onProposalStatus(proposal.id, pendingStatus);
    setPendingStatus(null);
  };
  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <ProposalBack onBack={onBack} />
        <Pill
          label={proposal.status}
          accent={
            proposal.status === "Accepted" || proposal.status === "Completed"
          }
        />
        <View style={styles.proposalDetailHero}>
        <Avatar
          initials={proposal.participantInitials}
          uri={proposal.participantAvatarUrl}
          size="large"
        />
        <View style={styles.flex}>
          <Text style={styles.detailTitle}>{proposal.participantName}</Text>
          <Text style={styles.pageIntro}>
            {proposal.city} · {proposal.campaignTitle}
          </Text>
          <Text style={styles.rating}>{proposal.amount}</Text>
        </View>
      </View>
      <View style={styles.detailFacts}>
        <Fact
          label="Proposal title"
          value={proposal.proposalTitle ?? "Collaboration proposal"}
        />
        <Fact label="Campaign" value={proposal.campaignTitle} />
        <Fact label="Location" value={proposal.city} />
        <Fact label="Updated" value={proposal.updatedAt} />
      </View>
      <AppCard>
        <Text style={styles.tipTitle}>Deliverables</Text>
        <Text style={styles.tipBody}>{proposal.deliverables}</Text>
      </AppCard>
      <AppCard>
        <Text style={styles.tipTitle}>Proposal message</Text>
        <Text style={styles.tipBody}>{proposal.message}</Text>
      </AppCard>
      <SectionTitle title="Attached media & files" />
      <ProposalMediaGallery attachments={proposal.attachments} />
        <View style={styles.detailActionRow}>
          {isIncoming && proposal.status === "Pending" ? (
            <>
              <AppButton
                label="Decline"
                variant="secondary"
                onPress={() => setPendingStatus("Declined")}
                icon="close"
              />
              <View style={styles.detailActionPrimary}>
                <AppButton
                  label="Accept proposal"
                  onPress={() => setPendingStatus("Accepted")}
                  icon="checkmark"
                />
              </View>
            </>
          ) : null}
          {proposal.status === "Accepted" ? (
            <AppButton
              label="Open chat"
              onPress={() =>
                onChat(proposal.participantName, proposal.participantInitials)
              }
              icon="chatbubble-ellipses-outline"
            />
          ) : null}
        </View>
      </ScrollView>
      <ConfirmModal
        visible={pendingStatus !== null}
        title={pendingStatus === "Declined" ? "Decline proposal?" : "Accept proposal?"}
        message={
          pendingStatus === "Declined"
            ? "This proposal will be marked as declined for both sides."
            : "Accept this proposal and make the collaboration ready for chat?"
        }
        confirmLabel={pendingStatus === "Declined" ? "Decline" : "Accept"}
        confirmIcon={pendingStatus === "Declined" ? "close" : "checkmark"}
        destructive={pendingStatus === "Declined"}
        onCancel={() => setPendingStatus(null)}
        onConfirm={confirmStatusChange}
      />
    </>
  );
}

function NotificationView({
  onScroll,
  notifications,
  notificationSettings,
  onMarkRead,
  onMarkAllRead,
}: {
  onScroll: ScrollHandler;
  notifications: AppNotification[];
  notificationSettings: NotificationSettings;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const visibleNotifications = notifications.filter(
    (notification) =>
      !notification.read && notificationSettings[notification.category],
  );
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.pageRow}>
        <View style={styles.flex}>
          <Text style={styles.pageIntro}>
            Updates about proposals, messages and your profile.
          </Text>
        </View>
        <View style={styles.notificationHeaderActions}>
          {visibleNotifications.length ? (
            <IconButton
              name="checkmark-done-outline"
              label="Mark all notifications as read"
              onPress={onMarkAllRead}
              selected
            />
          ) : null}
          <View style={styles.creatorDiscoverIcon}>
            <AppIcon
              name="notifications-outline"
              size={20}
              color={theme.colors.primary}
            />
          </View>
        </View>
      </View>
      <View style={styles.notificationList}>
        {visibleNotifications.length ? (
          visibleNotifications.map((notification) => (
          <Pressable
            key={notification.id}
            accessibilityRole="button"
            accessibilityLabel={`${notification.title}. ${notification.read ? "Read" : "Unread"}`}
            onPress={() => onMarkRead(notification.id)}
            style={({ pressed }) => [
              styles.notificationRow,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.notificationIcon}>
              <AppIcon
                name={notification.icon}
                size={19}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.notificationCopy}>
              <Text
                style={[
                  styles.notificationTitle,
                  notification.read && styles.notificationTitleRead,
                ]}
              >
                {notification.title}
              </Text>
              <Text style={styles.notificationBody}>{notification.body}</Text>
              <Text style={styles.notificationTime}>{notification.time}</Text>
            </View>
            <View style={styles.notificationActions}>
              {!notification.read ? (
                <View style={styles.notificationUnread} />
              ) : null}
              {!notification.read ? (
                <IconButton
                  name="checkmark-outline"
                  label={`Mark ${notification.title} as read`}
                  onPress={() => onMarkRead(notification.id)}
                />
              ) : (
                <AppIcon
                  name="checkmark-done-outline"
                  size={18}
                  color={theme.colors.textSecondary}
                />
              )}
            </View>
          </Pressable>
          ))
        ) : (
          <AppCard flat style={styles.campaignEmpty}>
            <AppIcon
              name="checkmark-done-outline"
              size={24}
              color={theme.colors.primary}
            />
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptyBody}>
              Read or disabled notifications will stay out of this inbox.
            </Text>
          </AppCard>
        )}
      </View>
    </ScrollView>
  );
}

function InboxView({
  role,
  onScroll,
  onChat,
}: {
  role: "Brand" | "Influencer";
  onScroll: ScrollHandler;
  onChat: (name: string, initials: string) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { conversations, isLoading } = useDemoMarketplace();
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.pageRow}>
        <View style={styles.flex}>
          <Text style={styles.pageIntro}>
            {role === "Brand"
              ? "Chat with accepted creators and keep collaboration details together."
              : "Chat with brands after acceptance and keep collaboration details together."}
          </Text>
        </View>
        <View style={styles.creatorDiscoverIcon}>
          <AppIcon
            name="chatbubbles-outline"
            size={20}
            color={theme.colors.primary}
          />
        </View>
      </View>
      {isLoading ? (
        <MarketplaceSkeleton />
      ) : (
        conversations.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onChat(item.name, item.initials)}
            style={styles.conversation}
          >
            <Avatar initials={item.initials} />
            <View style={styles.flex}>
              <View style={styles.conversationTop}>
                <Text style={styles.conversationName}>{item.name}</Text>
                <Text style={styles.time}>{item.time}</Text>
              </View>
              <Text numberOfLines={1} style={styles.message}>
                {item.message}
              </Text>
            </View>
            {item.unread ? (
              <View style={styles.unread}>
                <Text style={styles.unreadText}>{item.unread}</Text>
              </View>
            ) : null}
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

function ProfileView({
  role,
  mode,
  onScroll,
  onTheme,
  onFlow,
  savedLocations,
  profileIsPublic,
  socialAccounts,
  verifiedSocialAccounts,
  onProfileVisibilitySave,
}: {
  role: "Brand" | "Influencer";
  mode: "light" | "dark";
  onScroll: ScrollHandler;
  onTheme: () => void;
  onFlow: (flow: MarketplaceFlow) => void;
  savedLocations: string[];
  profileIsPublic: boolean;
  socialAccounts: SocialAccountMap;
  verifiedSocialAccounts: SocialPlatform[];
  onProfileVisibilitySave: (isPublic: boolean) => void;
}) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const styles = makeStyles(theme);
  const profileSocialLinks = Object.entries(socialAccounts)
    .filter(([, handle]) => Boolean(handle))
    .map(([platform, handle]) => ({
      platform: platform as SocialPlatform,
      handle: handle as string,
      verified: verifiedSocialAccounts.includes(platform as SocialPlatform),
    }));
  const connectedSocialPlatforms = Object.entries(socialAccounts)
    .filter(([, handle]) => Boolean(handle))
    .map(([platform]) => platform as SocialPlatform);
  const socialAccountsReady =
    connectedSocialPlatforms.length > 0 &&
    connectedSocialPlatforms.every((platform) =>
      verifiedSocialAccounts.includes(platform),
    );
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical
      nestedScrollEnabled
      contentContainerStyle={[styles.scroll, styles.profileScroll]}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <AppCard flat style={styles.profileCard}>
        <Avatar initials={role === "Brand" ? "MS" : "AM"} size="large" />
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>
            {role === "Brand" ? "Maya Studio" : "Aarohi Mehta"}
          </Text>
          <Text style={styles.pageIntro}>
            {role === "Brand" ? "Finder account" : "Creator account"} · {savedLocations[0] ?? "India"}
          </Text>
          <Pill label="Phone & email verified" />
          <Pill
            label={
              role === "Brand"
                ? "Private brand account"
                : profileIsPublic
                  ? "Public creator profile"
                  : "Private creator profile"
            }
          />
        </View>
      </AppCard>
      {role === "Influencer" ? (
        <View style={styles.profileVisibilityRow}>
          <View style={styles.profileVisibilityCopy}>
            <Text style={styles.tipTitle}>Profile visibility</Text>
            <Text style={styles.tipBody}>
              {profileIsPublic
                ? "Visible to relevant brands and creators."
                : socialAccountsReady
                  ? "Private until you choose to publish it."
                  : "Verify every added social account before publishing."}
            </Text>
          </View>
          <Toggle
            value={profileIsPublic}
            disabled={!profileIsPublic && !socialAccountsReady}
            onChange={(nextValue) => {
              if (nextValue && !socialAccountsReady) {
                showToast("Verify all added social accounts first");
                return;
              }
              onProfileVisibilitySave(nextValue);
              showToast(nextValue ? "Profile is now public" : "Profile is now private");
            }}
          />
        </View>
      ) : null}
      <SectionTitle
        title={
          role === "Brand"
            ? "Brand workspace"
            : profileIsPublic
              ? "Public creator profile"
              : "Private creator preview"
        }
        action={role === "Influencer" ? "Preview" : undefined}
      />
      <AppCard flat style={styles.publicProfileCard}>
        <View style={styles.publicProfileHeader}>
          <View style={styles.flex}>
            <Text style={styles.tipTitle}>
              {role === "Brand" ? "Maya Studio" : "Aarohi Mehta"}
            </Text>
            <Text style={styles.tipBody}>
              {role === "Brand"
                ? "Beauty & wellness partnerships"
                : "Fashion, beauty and everyday routines"}
            </Text>
          </View>
          <AppIcon
            name={role === "Brand" ? "briefcase-outline" : "eye-outline"}
            size={20}
            color={theme.colors.primary}
          />
        </View>
        {role === "Brand" ? (
          <View style={styles.privateProfileNotice}>
            <AppIcon
              name="lock-closed-outline"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={styles.pageIntro}>
              Your brand account stays private. Creators discover your public campaign briefs instead.
            </Text>
          </View>
        ) : profileIsPublic ? (
          <>
            <SocialLinks links={profileSocialLinks} />
            <View style={styles.profileLocationRow}>
              <AppIcon
                name="location-outline"
                size={18}
                color={theme.colors.primary}
              />
              <Text style={styles.profileLocationText}>
                Available in{" "}
                {savedLocations.length
                  ? savedLocations.join(" · ")
                  : "your selected locations"}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.privateProfileNotice}>
            <AppIcon
              name="lock-closed-outline"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={styles.pageIntro}>
              This profile is private. Brands cannot view it or send new deals.
            </Text>
          </View>
        )}
      </AppCard>
      <ReviewSummary
        rating={role === "Brand" ? 4.8 : 4.9}
        reviewCount={role === "Brand" ? 28 : 86}
        onPress={() => onFlow("reviews-own")}
        note={
          role === "Brand"
            ? "Creators describe this team as clear, respectful and easy to work with."
            : "Brands value clear communication, thoughtful content and reliable delivery."
        }
      />
      <AppCard
        flat
        onPress={() => onFlow("profile-form")}
        style={styles.profileProgress}
      >
        <View style={styles.profileProgressHeader}>
          <View style={styles.flex}>
            <Text style={styles.tipTitle}>Complete your profile</Text>
            <Text style={styles.tipBody}>
              A complete profile helps better matches find you.
            </Text>
          </View>
          <Text style={styles.profileProgressValue}>75%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>
      </AppCard>
      <SectionTitle title="Account" />
      <MenuItem
        label={role === "Brand" ? "Edit brand profile" : "Edit creator profile"}
        icon="create-outline"
        onPress={() => onFlow("profile-form")}
      />
      <MenuItem
        label="Social accounts"
        icon="link-outline"
        onPress={() => onFlow("social-accounts")}
      />
      <MenuItem
        label={role === "Brand" ? "Saved creators" : "Saved campaigns"}
        icon="bookmark-outline"
        onPress={() => onFlow("saved")}
      />
      <MenuItem
        label="Notification settings"
        icon="notifications-outline"
        onPress={() => onFlow("notification-settings")}
      />
      <MenuItem
        label="Your reviews"
        icon="star-outline"
        onPress={() => onFlow("reviews-own")}
      />
      <MenuItem
        label="Review activity"
        icon="list-outline"
        onPress={() => onFlow("activity")}
      />
      <MenuItem
        label="Blocked users"
        icon="ban-outline"
        onPress={() => onFlow("blocked-users")}
      />
      <SectionTitle title="Preferences" />
      <Pressable onPress={onTheme} style={styles.menuItem}>
        <View style={styles.menuIcon}>
          <AppIcon
            name={mode === "light" ? "moon-outline" : "sunny-outline"}
            size={20}
            color={theme.colors.primary}
          />
        </View>
        <Text style={styles.menuLabel}>
          {mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <MenuItem
        label="Privacy & data controls"
        icon="lock-closed-outline"
        onPress={() => onFlow("legal")}
      />
      <MenuItem
        label="Safety & community guidelines"
        icon="shield-checkmark-outline"
        onPress={() => onFlow("safety")}
      />
      <SectionTitle title="Help & support" />
      <MenuItem
        label="Support center"
        icon="help-circle-outline"
        onPress={() => onFlow("support")}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => onFlow("delete-account")}
        style={({ pressed }) => [styles.dangerZone, pressed && styles.pressed]}
      >
        <Text style={styles.dangerText}>Delete account</Text>
        <Text style={styles.pageIntro}>
          You can request deletion of your account and data.
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function DetailView({
  detail,
  role,
  onBack,
  onProposalSubmit,
  proposals,
  onOpenProposal,
  proposalContext: fallbackProposalContext,
  initialLocations,
  onProfileLocationsSave,
  blockedUsers,
  onBlockUser,
  notificationSettings,
  onNotificationSettingsSave,
  onDeleteAccount,
  onOpenChatProfile,
  initialSocialAccounts,
  verifiedSocialAccounts,
  onSocialAccountsSave,
  onCampaignCreate,
  onDealStatusSave,
  onReviewSubmit,
  initialDealStatus,
  profileIsPublic,
  onProfileVisibilitySave,
}: {
  detail: ContentDetail;
  role: "Brand" | "Influencer";
  onBack: () => void;
  onProposalSubmit: (context: ProposalContext, draft: ProposalDraft) => void;
  proposals: DemoProposal[];
  onOpenProposal: (proposal: DemoProposal) => void;
  proposalContext: ProposalContext;
  initialLocations: string[];
  onProfileLocationsSave: (locations: string[]) => void;
  blockedUsers: string[];
  onBlockUser: (name: string) => void;
  notificationSettings: NotificationSettings;
  onNotificationSettingsSave: (settings: NotificationSettings) => void;
  onDeleteAccount: () => void;
  onOpenChatProfile: (name: string, returnTo: ChatReturn) => void;
  initialSocialAccounts: SocialAccountMap;
  verifiedSocialAccounts: SocialPlatform[];
  onSocialAccountsSave: (
    accounts: SocialAccountMap,
    verifiedPlatforms: SocialPlatform[],
  ) => void;
  onCampaignCreate: (draft: CampaignDraft) => void;
  onDealStatusSave: (status: DealStatus) => void;
  onReviewSubmit: (subject: string) => void;
  initialDealStatus?: DealStatus;
  profileIsPublic: boolean;
  onProfileVisibilitySave: (isPublic: boolean) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [flow, setFlow] = useState<MarketplaceFlow | null>(null);
  const flowBackLocked = useRef(false);
  const [isSaved, setIsSaved] = useState(false);
  const [blockTarget, setBlockTarget] = useState<string | null>(null);
  const existingProposal =
    detail.type === "campaign"
      ? proposals.find(
          (proposal) =>
            proposal.campaignId === detail.value.id &&
            proposal.direction === "creator_to_brand" &&
            proposal.status !== "Declined",
        )
      : detail.type === "influencer"
        ? proposals.find(
            (proposal) =>
              proposal.participantName === detail.value.name &&
              proposal.direction === "brand_to_creator" &&
              proposal.status !== "Declined",
          )
        : undefined;
  const blockTargetIsBlocked = blockTarget
    ? blockedUsers.includes(blockTarget)
    : false;
  const confirmBlockAction = () => {
    if (blockTarget) onBlockUser(blockTarget);
    setBlockTarget(null);
  };
  const blockModal = (
    <ConfirmModal
      visible={blockTarget !== null}
      title={blockTargetIsBlocked ? "Unblock this profile?" : "Block this profile?"}
      message={
        blockTargetIsBlocked
          ? "This profile will be allowed to contact you again."
          : "This profile will not be able to start new conversations with you."
      }
      confirmLabel={blockTargetIsBlocked ? "Unblock" : "Block"}
      confirmIcon={blockTargetIsBlocked ? "lock-open-outline" : "ban-outline"}
      destructive={!blockTargetIsBlocked}
      onCancel={() => setBlockTarget(null)}
      onConfirm={confirmBlockAction}
    />
  );
  const closeFlow = () => {
    if (flowBackLocked.current) return;
    flowBackLocked.current = true;
    setFlow(null);
    setTimeout(() => {
      flowBackLocked.current = false;
    }, 450);
  };
  const proposalContext: ProposalContext =
    detail.type === "campaign"
      ? {
          campaignId: detail.value.id,
          campaignTitle: detail.value.title,
          participantName: detail.value.brand,
          participantInitials: detail.value.brand
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
          city: detail.value.city,
          defaultAmount: detail.value.budget,
          defaultDeliverables: "1 reel, 3 story frames, usage for 30 days",
        }
      : detail.type === "influencer"
        ? {
            campaignId: fallbackProposalContext.campaignId,
            campaignTitle: fallbackProposalContext.campaignTitle,
            participantName: detail.value.name,
            participantInitials: detail.value.initials,
            participantAvatarUrl: detail.value.avatarUrl,
            city: detail.value.city,
            defaultAmount: detail.value.price,
            defaultDeliverables: "1 reel, 3 story frames, usage for 30 days",
          }
        : detail.type === "profile"
          ? {
              campaignId: fallbackProposalContext.campaignId,
              campaignTitle: fallbackProposalContext.campaignTitle,
              participantName: detail.value.name,
              participantInitials: detail.value.initials,
              participantAvatarUrl: detail.value.avatarUrl,
              city: detail.value.city,
              defaultAmount: detail.value.price,
              defaultDeliverables: "1 reel, 3 story frames, usage for 30 days",
            }
        : fallbackProposalContext;
  if (flow)
    return (
      <FlowScreen
        flow={flow}
        role={role}
        onBack={closeFlow}
        onProposalSubmit={
          flow === "proposal"
            ? (draft) => onProposalSubmit(proposalContext, draft)
            : undefined
        }
        proposalContext={proposalContext}
        initialLocations={initialLocations}
        onProfileLocationsSave={onProfileLocationsSave}
        blockedUsers={blockedUsers}
        onUnblockUser={onBlockUser}
        notificationSettings={notificationSettings}
        onNotificationSettingsSave={onNotificationSettingsSave}
        onDeleteAccount={onDeleteAccount}
        initialSocialAccounts={initialSocialAccounts}
        verifiedSocialAccounts={verifiedSocialAccounts}
        onSocialAccountsSave={onSocialAccountsSave}
        onCampaignCreate={onCampaignCreate}
        onDealStatusSave={onDealStatusSave}
        onReviewSubmit={onReviewSubmit}
        onReviewRequest={() => setFlow("review")}
        initialDealStatus={initialDealStatus}
      />
    );
  if (detail.type === "chat")
    return (
      <ChatDetail
        name={detail.name}
        initials={detail.initials}
        role={role}
        onBack={onBack}
        onOpenProfile={() => onOpenChatProfile(detail.name, detail.returnTo)}
        blocked={blockedUsers.includes(detail.name)}
      />
    );
  if (detail.type === "campaign")
    return (
    <>
    <ScrollView contentContainerStyle={styles.scroll}>
      <ProposalBack onBack={onBack} />
        <Pill label={initialDealStatus ?? detail.value.status} accent />
        <Text style={styles.detailTitle}>{detail.value.title}</Text>
        <Text style={styles.brand}>{detail.value.brand}</Text>
        <View style={styles.detailFacts}>
          <Fact label="Location" value={detail.value.city} />
          <Fact label="Budget" value={detail.value.budget} />
          <Fact label="Category" value={detail.value.category} />
          <Fact label="Deadline" value={detail.value.deadline} />
        </View>
        {role === "Influencer" ? (
          <>
            <AppCard style={styles.publicProfileCard}>
              <View style={styles.publicProfileHeader}>
                <Avatar
                  initials={detail.value.brand
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                  size="small"
                />
                <View style={styles.flex}>
                  <Text style={styles.tipTitle}>{detail.value.brand}</Text>
                  <Text style={styles.tipBody}>
                    Verified brand profile · {detail.value.category}
                  </Text>
                </View>
                <AppIcon
                  name="business-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <SocialLinks
                links={[
                  {
                    platform: "Instagram",
                    handle: `@${detail.value.brand.toLowerCase().replace(/\s+/g, "")}`,
                    verified: true,
                  },
                  { platform: "LinkedIn", handle: detail.value.brand },
                ]}
              />
            </AppCard>
            <ReviewSummary
              rating={4.8}
              reviewCount={32}
              onPress={() => setFlow("reviews")}
              note="Creators value clear briefs, respectful communication and reliable approvals."
            />
            <AppButton
              label={
                blockedUsers.includes(detail.value.brand)
                  ? "Unblock brand"
                  : "Block brand"
              }
              variant="secondary"
              icon={
                blockedUsers.includes(detail.value.brand)
                  ? "lock-open-outline"
                  : "ban-outline"
              }
              onPress={() => setBlockTarget(detail.value.brand)}
            />
          </>
        ) : null}
        <AppCard>
          <Text style={styles.tipTitle}>Campaign brief</Text>
          <Text style={styles.tipBody}>
            We need an authentic creator-led promotion that feels natural to the
            audience. Share your content approach and final quote.
          </Text>
        </AppCard>
        {role === "Influencer" ? (
          <>
            <AppButton
              label={
                existingProposal
                  ? `View application · ${existingProposal.status}`
                  : "Send proposal for this brief"
              }
              onPress={() =>
                existingProposal
                  ? onOpenProposal(existingProposal)
                  : setFlow("proposal")
              }
              icon="paper-plane-outline"
            />
            <AppButton
              label="Save campaign"
              variant="secondary"
              onPress={() => setIsSaved((current) => !current)}
              icon={isSaved ? "bookmark" : "bookmark-outline"}
            />
            <AppButton
              label="Update collaboration status"
              variant="secondary"
              onPress={() => setFlow("deal")}
              icon="checkmark-circle-outline"
            />
            <AppButton
              label="Leave a review"
              variant="secondary"
              onPress={() => setFlow("review")}
              icon="star-outline"
            />
          </>
        ) : (
          <>
            <AppButton
              label="Review deal status"
              onPress={() => setFlow("deal")}
            />
            <AppButton
              label="Leave a review"
              variant="secondary"
              onPress={() => setFlow("review")}
            />
          </>
        )}
      </ScrollView>
      {blockModal}
    </>
    );
  if (detail.type === "profile") {
    const profile = detail.value;
    return (
      <>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ProposalBack onBack={onBack} />
          <View style={styles.creatorHero}>
            <Avatar initials={profile.initials} uri={profile.avatarUrl} size="large" />
            <View style={styles.flex}>
              <Text style={styles.detailTitle}>{profile.name}</Text>
              <Text style={styles.pageIntro}>
                {profile.kind === "brand" ? "Brand account" : profile.niche} · {profile.city} · {profile.state}
              </Text>
              <View style={styles.ratingRow}>
                <AppIcon name="star" size={15} color={theme.colors.accentText} />
                <Text style={styles.rating}>
                  {profile.rating} ({profile.reviews} reviews)
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.detailFacts}>
            <Fact label="Location" value={`${profile.city}, ${profile.state}`} />
            <Fact label={profile.kind === "brand" ? "Active briefs" : "Audience"} value={profile.followers} />
            <Fact label="Starting price" value={profile.price} />
            <Fact label="Platforms" value={profile.platforms.join(" + ")} />
          </View>
          <AppCard>
            <Text style={styles.tipTitle}>About this profile</Text>
            <Text style={styles.tipBody}>
              {profile.kind === "brand"
                ? "A collaboration-ready brand profile with clear briefs, thoughtful communication and an active marketplace presence."
                : "A collaboration-ready creator profile with clear communication, reliable delivery and platform-native content."}
            </Text>
          </AppCard>
          <SocialLinks
            links={profile.platforms.map((platform) => ({
              platform,
              handle: `${profile.name} · public profile`,
              verified: true,
            }))}
          />
          <ReviewSummary
            rating={profile.rating}
            reviewCount={profile.reviews}
            note="Recent collaboration partners highlight clear communication, reliable delivery and respectful working relationships."
            onPress={() => setFlow("reviews")}
          />
          <AppButton
            label={blockedUsers.includes(profile.name) ? "Unblock user" : "Block user"}
            variant="secondary"
            icon={blockedUsers.includes(profile.name) ? "lock-open-outline" : "ban-outline"}
            onPress={() => setBlockTarget(profile.name)}
          />
        </ScrollView>
        {blockModal}
      </>
    );
  }
  const item = detail.value;
  return (
    <>
    <ScrollView contentContainerStyle={styles.scroll}>
      <ProposalBack onBack={onBack} />
      <View style={styles.creatorHero}>
        <Avatar initials={item.initials} uri={item.avatarUrl} size="large" />
        <View style={styles.flex}>
          <Text style={styles.detailTitle}>{item.name}</Text>
          <Text style={styles.pageIntro}>
            {item.niche} · {item.city}
            {item.state && item.state !== item.city ? ` · ${item.state}` : ""}
          </Text>
          <View style={styles.ratingRow}>
            <AppIcon name="star" size={15} color={theme.colors.accentText} />
            <Text style={styles.rating}>
              {item.rating} ({item.reviews} reviews)
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.detailFacts}>
        <Fact label="Audience" value={item.followers} />
        <Fact label="Starting price" value={item.price} />
        <Fact label="Platforms" value={item.platforms.join(" + ")} />
      </View>
      <AppCard>
        <Text style={styles.tipTitle}>About this creator</Text>
        <Text style={styles.tipBody}>
          Known for clear, relatable content and thoughtful brand
          collaborations. Final pricing is discussed privately after a proposal.
        </Text>
      </AppCard>
      <SectionTitle title="Past work" action="Portfolio" />
      <CreatorPastWork />
      <SocialLinks
        links={[
          {
            platform: "Instagram",
            handle: `@${item.name.toLowerCase().replace(/\s+/g, ".")}`,
            verified: true,
          },
          ...item.platforms
            .filter((platform) => platform !== "Instagram")
            .slice(0, 2)
            .map((platform) => ({
              platform,
              handle: `${item.name} · public profile`,
            })),
        ]}
      />
      <ReviewSummary
        rating={item.rating}
        reviewCount={item.reviews}
        onPress={() => setFlow("reviews")}
        note="Recent partners highlight clear communication, reliable delivery and content that feels native to the platform."
      />
      <AppButton
        label={
          existingProposal
            ? `View proposal · ${existingProposal.status}`
            : "Send campaign proposal"
        }
        onPress={() =>
          existingProposal
            ? onOpenProposal(existingProposal)
            : setFlow("proposal")
        }
        icon="paper-plane-outline"
      />
      <AppButton
        label={blockedUsers.includes(item.name) ? "Unblock user" : "Block user"}
        variant="secondary"
        icon={blockedUsers.includes(item.name) ? "lock-open-outline" : "ban-outline"}
        onPress={() => setBlockTarget(item.name)}
      />
      <AppButton
        label={isSaved ? "Creator saved" : "Save creator"}
        variant="secondary"
        onPress={() => setIsSaved((current) => !current)}
      />
    </ScrollView>
    {blockModal}
    </>
  );
}

function CreatorPastWork() {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const work = [
    {
      icon: "videocam-outline" as const,
      title: "Everyday skincare routine",
      meta: "Short video · Beauty",
    },
    {
      icon: "image-outline" as const,
      title: "Monsoon wardrobe edit",
      meta: "Photo set · Fashion",
    },
    {
      icon: "stats-chart-outline" as const,
      title: "Wellness launch story",
      meta: "Campaign result · 4.8 rating",
    },
  ];
  return (
    <View style={styles.pastWorkList}>
      {work.map((item) => (
        <AppCard key={item.title} flat style={styles.pastWorkRow}>
          <View style={styles.pastWorkIcon}>
            <AppIcon name={item.icon} size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.tipTitle}>
              {item.title}
            </Text>
            <Text numberOfLines={1} style={styles.pageIntro}>
              {item.meta}
            </Text>
          </View>
          <AppIcon
            name="chevron-forward"
            size={18}
            color={theme.colors.textSecondary}
          />
        </AppCard>
      ))}
    </View>
  );
}

function InfluencerCard({
  item,
  compact = false,
  saved,
  onSave,
  onPress,
}: {
  item: Influencer;
  compact?: boolean;
  saved?: boolean;
  onSave?: () => void;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <AppCard
      onPress={onPress}
      style={compact ? styles.creatorCompact : styles.creatorCard}
    >
      <View style={styles.cardTop}>
        <Avatar initials={item.initials} uri={item.avatarUrl} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            saved ? `Remove ${item.name} from saved` : `Save ${item.name}`
          }
          onPress={onSave}
          style={styles.save}
        >
          <AppIcon
            name={saved ? "heart" : "heart-outline"}
            size={21}
            color={theme.colors.primary}
          />
        </Pressable>
      </View>
      <Text style={styles.creatorName}>{item.name}</Text>
      <Text style={styles.creatorMeta}>
        {item.niche} · {item.city}
      </Text>
      <View style={styles.ratingRow}>
        <AppIcon name="star" size={15} color={theme.colors.accentText} />
        <Text style={styles.rating}>
          {item.rating} <Text style={styles.muted}>({item.reviews})</Text>
        </Text>
      </View>
      <View style={styles.pillRow}>
        {item.platforms.map((platform) => (
          <Pill key={platform} label={platform} />
        ))}
      </View>
      <View style={styles.creatorFooter}>
        <Text style={styles.followers}>{item.followers}</Text>
        <Text style={styles.price}>{item.price}</Text>
      </View>
    </AppCard>
  );
}

function CampaignCard({
  item,
  compact = false,
  width,
  onPress,
}: {
  item: Campaign;
  compact?: boolean;
  width?: number;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <AppCard
      onPress={onPress}
      style={[
        styles.campaignCard,
        compact && styles.campaignRailCard,
        compact && width ? { width } : null,
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.campaignBrandRow}>
          <View style={styles.campaignBrandIcon}>
            <AppIcon
              name="briefcase-outline"
              size={18}
              color={theme.colors.primary}
            />
          </View>
          <Text numberOfLines={1} style={styles.brand}>
            {item.brand}
          </Text>
        </View>
        <Pill label={item.status} accent={item.status === "Open"} />
      </View>
      <Text numberOfLines={2} style={styles.campaignTitle}>
        {item.title}
      </Text>
      <Text numberOfLines={2} style={styles.campaignDescription}>
        {item.description}
      </Text>
      <View style={styles.campaignMetaRow}>
        <View style={styles.campaignMeta}>
          <AppIcon
            name="location-outline"
            size={15}
            color={theme.colors.textSecondary}
          />
          <Text numberOfLines={1} style={styles.creatorMeta}>
            {item.city}
          </Text>
        </View>
        <View style={styles.campaignMeta}>
          <AppIcon
            name="pricetag-outline"
            size={15}
            color={theme.colors.textSecondary}
          />
          <Text numberOfLines={1} style={styles.creatorMeta}>
            {item.category}
          </Text>
        </View>
      </View>
      <View style={styles.campaignFooter}>
        <View>
          <Text style={styles.deadlineLabel}>Deadline</Text>
          <Text numberOfLines={1} style={styles.deadline}>
            {item.deadline}
          </Text>
        </View>
        <View style={styles.campaignBudget}>
          <Text style={styles.deadlineLabel}>Budget</Text>
          <Text numberOfLines={1} style={styles.price}>
            {item.budget}
          </Text>
        </View>
      </View>
    </AppCard>
  );
}
function CampaignRail({
  title,
  campaigns,
  width,
  onCampaign,
}: {
  title: string;
  campaigns: Campaign[];
  width: number;
  onCampaign: (item: Campaign) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { width: screenWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const sideInset = Math.max(0, (screenWidth - width) / 2);
  const snapOffsets = campaigns.map(
    (_, index) => index * (width + theme.spacing.sm),
  );
  return (
    <View style={styles.campaignRailSection}>
      <View style={styles.campaignRailHeader}>
        <Text style={styles.campaignRailTitle}>{title}</Text>
        <Text style={styles.campaignRailHint}>Swipe to explore</Text>
      </View>
      <ScrollView
        horizontal
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        disableIntervalMomentum
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        style={styles.campaignRailViewport}
        contentContainerStyle={[
          styles.campaignRailContent,
          { paddingHorizontal: sideInset },
        ]}
        onMomentumScrollEnd={(event) =>
          setActiveIndex(
            Math.min(
              campaigns.length - 1,
              Math.max(
                0,
                Math.round(
                  event.nativeEvent.contentOffset.x /
                    (width + theme.spacing.sm),
                ),
              ),
            ),
          )
        }
      >
        {campaigns.map((campaign, index) => (
          <CampaignRailCard
            key={campaign.id}
            item={campaign}
            width={width}
            active={index === activeIndex}
            onPress={() => onCampaign(campaign)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
function CampaignRailCard({
  item,
  width,
  active,
  onPress,
}: {
  item: Campaign;
  width: number;
  active: boolean;
  onPress: () => void;
}) {
  const styles = makeStyles(useTheme().theme);
  const scale = useRef(new Animated.Value(active ? 1.02 : 0.94)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.02 : 0.94,
      friction: 8,
      tension: 110,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);
  return (
    <Animated.View
      style={[styles.campaignRailItem, { width, transform: [{ scale }] }]}
    >
      <CampaignCard item={item} compact width={width} onPress={onPress} />
    </Animated.View>
  );
}
function createCampaignFeed(campaigns: Campaign[]): CampaignFeedItem[] {
  const feed: CampaignFeedItem[] = [];
  let offset = 0;
  let railNumber = 0;
  while (campaigns.length - offset >= 3) {
    const railCampaigns = campaigns.slice(offset, offset + 3);
    feed.push({
      id: `rail-${railNumber}`,
      kind: "rail",
      title: railNumber === 0 ? "Featured campaigns" : "More opportunities",
      campaigns: railCampaigns,
    });
    offset += railCampaigns.length;
    railNumber += 1;
    const standardCards = campaigns.slice(offset, offset + 2);
    standardCards.forEach((campaign) =>
      feed.push({ id: `card-${campaign.id}`, kind: "card", campaign }),
    );
    offset += standardCards.length;
  }
  campaigns
    .slice(offset)
    .forEach((campaign) =>
      feed.push({ id: `card-${campaign.id}`, kind: "card", campaign }),
    );
  return feed;
}
function CampaignEmptyState({
  hasFilters,
  onCreate,
  onClear,
}: {
  hasFilters: boolean;
  onCreate: () => void;
  onClear: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.campaignEmpty}>
      <View style={styles.emptyIcon}>
        <AppIcon
          name="briefcase-outline"
          size={26}
          color={theme.colors.primary}
        />
      </View>
      <Text style={styles.emptyTitle}>
        {hasFilters ? "No matching campaigns" : "No campaigns yet"}
      </Text>
      <Text style={styles.emptyBody}>
        {hasFilters
          ? "Try a different search or reset the campaign filters."
          : "Create your first brief to start finding the right creators."}
      </Text>
      {hasFilters ? (
        <AppButton
          label="Clear filters"
          onPress={onClear}
          icon="refresh-outline"
        />
      ) : (
        <AppButton label="Create campaign" onPress={onCreate} />
      )}
    </View>
  );
}

function ClearFiltersButton({
  onPress,
  label = "Clear all filters",
}: {
  onPress: () => void;
  label?: string;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.clearFiltersButton,
        pressed && styles.pressed,
      ]}
    >
      <AppIcon
        name="close-circle-outline"
        size={16}
        color={theme.colors.primary}
      />
      <Text style={styles.clearFiltersText}>{label}</Text>
  </Pressable>
  );
}

function NoResultsState({
  onClear,
  clearLabel = "Clear all filters",
}: {
  onClear?: () => void;
  clearLabel?: string;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.noResults}>
      <View style={styles.emptyIcon}>
        <AppIcon
          name="search-outline"
          size={25}
          color={theme.colors.primary}
        />
      </View>
      <Text style={styles.emptyTitle}>No results found</Text>
      <Text style={styles.emptyBody}>
        Try a different search or adjust your filters to see more matches.
      </Text>
      {onClear ? (
        <ClearFiltersButton onPress={onClear} label={clearLabel} />
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <AppCard style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </AppCard>
  );
}
function MenuItem({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: AppIconName;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable onPress={onPress} style={styles.menuItem}>
      <View style={styles.menuIcon}>
        <AppIcon name={icon} size={20} color={theme.colors.primary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <AppIcon
        name="chevron-forward"
        size={18}
        color={theme.colors.textSecondary}
      />
    </Pressable>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}
function MarketplaceSkeleton() {
  return (
    <View>
      {[1, 2, 3].map((item) => (
        <MarketplaceCardSkeleton key={item} />
      ))}
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    app: { flex: 1, backgroundColor: theme.colors.background },
    splash: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.xl,
      backgroundColor: theme.colors.background,
    },
    splashMark: {
      width: 76,
      height: 76,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing.lg,
    },
    splashWordmark: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.hero,
      fontWeight: "900",
      letterSpacing: -1,
    },
    splashCopy: {
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
      fontSize: theme.type.bodyLarge,
    },
    splashLoader: {
      width: 96,
      height: 4,
      borderRadius: theme.radius.pill,
      overflow: "hidden",
      backgroundColor: theme.colors.surfaceMuted,
      marginTop: theme.spacing.xxl,
    },
    splashLoaderFill: {
      width: "64%",
      height: "100%",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primary,
    },
    auth: {
      flexGrow: 1,
      justifyContent: "center",
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      backgroundColor: theme.colors.background,
    },
    authLogo: {
      width: 66,
      height: 66,
      borderRadius: theme.radius.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },
    authTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.hero,
      lineHeight: 44,
      fontWeight: "900",
      letterSpacing: -0.7,
    },
    authBody: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.bodyLarge,
      lineHeight: 24,
      marginBottom: theme.spacing.sm,
    },
    authOptions: { gap: theme.spacing.sm },
    authOption: {
      minHeight: 84,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
    },
    authOptionSelected: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    authOptionTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      fontWeight: "800",
    },
    authOptionText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.body,
      marginTop: theme.spacing.xs,
    },
    authInput: {
      minHeight: 52,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
    },
    authSwitch: {
      color: theme.colors.primary,
      textAlign: "center",
      fontSize: theme.type.body,
      fontWeight: "700",
      padding: theme.spacing.sm,
    },
    authFootnote: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      textAlign: "center",
      lineHeight: 18,
    },
    topbar: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.xxl,
      paddingBottom: theme.spacing.md,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    wordmark: {
      fontSize: theme.type.title,
      fontWeight: "900",
      color: theme.colors.primary,
    },
    tagline: {
      marginTop: 2,
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    notification: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    content: { flex: 1 },
    scroll: {
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.xxl + theme.spacing.xl,
    },
    campaignList: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl + theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    campaignHeader: { gap: theme.spacing.md, paddingBottom: theme.spacing.sm },
    campaignHeaderActions: { alignItems: "flex-start" },
    hero: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    heroTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.display,
      fontWeight: "900",
    },
    heroBody: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.bodyLarge,
      lineHeight: 22,
    },
    horizontal: {
      gap: theme.spacing.md,
      paddingRight: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    creatorCompact: { width: 218, gap: theme.spacing.sm },
    creatorCard: { gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
    cardTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
    save: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    creatorName: {
      color: theme.colors.textPrimary,
      fontWeight: "800",
      fontSize: theme.type.bodyLarge,
    },
    creatorMeta: {
      flexShrink: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    rating: {
      color: theme.colors.accentText,
      fontWeight: "800",
      fontSize: theme.type.caption,
    },
    ratingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    muted: { color: theme.colors.textSecondary, fontWeight: "500" },
    pillRow: { flexDirection: "row", gap: theme.spacing.xs, flexWrap: "wrap" },
    creatorFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: theme.spacing.sm,
      borderTopWidth: 1,
      borderColor: theme.colors.border,
    },
    followers: {
      color: theme.colors.textPrimary,
      fontWeight: "800",
      fontSize: theme.type.body,
    },
    price: {
      color: theme.colors.primary,
      fontWeight: "800",
      fontSize: theme.type.body,
    },
    campaignCard: { gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
    campaignRailCard: { minHeight: 234, marginBottom: 0 },
    campaignRailSection: {
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
    },
    campaignRailHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    campaignRailTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      fontWeight: "800",
    },
    campaignRailHint: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    campaignRail: {
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      paddingRight: theme.spacing.lg,
    },
    campaignBrandRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    campaignBrandIcon: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    brand: {
      flexShrink: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    campaignTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      lineHeight: 22,
      fontWeight: "800",
    },
    campaignDescription: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: 18,
    },
    campaignMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    campaignMeta: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    campaignFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      paddingTop: theme.spacing.sm,
      borderTopWidth: 1,
      borderColor: theme.colors.border,
    },
    campaignBudget: { alignItems: "flex-end", minWidth: 0 },
    deadlineLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    deadline: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.caption,
      fontWeight: "700",
      marginTop: 2,
    },
    categoryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    categoryCard: {
      width: "31%",
      alignItems: "center",
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.xs,
    },
    categoryIcon: { color: theme.colors.accent, fontSize: theme.type.title },
    categoryText: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    pageTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.display,
      fontWeight: "900",
      letterSpacing: -0.4,
    },
    pageIntro: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.body,
      lineHeight: 20,
    },
    discoverHeading: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    filters: {
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      paddingRight: theme.spacing.sm,
    },
    campaignFilterHeader: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    campaignSectionTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      fontWeight: "800",
    },
    campaignFilters: {
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      paddingRight: theme.spacing.lg,
    },
    resultsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    resultText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    clearFiltersButton: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
    },
    clearFiltersText: {
      color: theme.colors.primary,
      fontSize: theme.type.caption,
      fontWeight: "800",
    },
    noResults: {
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
    },
    filterOverlay: { flex: 1, justifyContent: "flex-end" },
    filterBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.colors.overlay,
    },
    filterSheet: {
      maxHeight: "84%",
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      gap: theme.spacing.lg,
      backgroundColor: theme.colors.surface,
    },
    sheetHandle: {
      width: 44,
      height: 4,
      alignSelf: "center",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.border,
    },
    sheetHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    sheetTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      fontWeight: "900",
    },
    sheetSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      marginTop: 2,
    },
    filterGroup: { gap: theme.spacing.sm },
    filterGroupTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "800",
    },
    filterGroupOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    sheetActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
    },
    pageRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    notificationList: {
      width: "100%",
      alignSelf: "stretch",
      gap: theme.spacing.sm,
    },
    notificationRow: {
      width: "100%",
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
    },
    notificationIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    notificationCopy: { flex: 1, minWidth: 0, gap: 2 },
    notificationHeaderActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    notificationActions: {
      alignItems: "flex-end",
      gap: theme.spacing.xs,
    },
    notificationTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "800",
    },
    notificationTitleRead: { fontWeight: "600" },
    notificationBody: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: 18,
    },
    notificationTime: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      marginTop: theme.spacing.xs,
    },
    notificationUnread: {
      width: 8,
      height: 8,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primary,
      marginTop: theme.spacing.xs,
    },
    addButton: {
      width: 48,
      height: 48,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    addButtonText: {
      color: theme.colors.primaryText,
      fontSize: theme.type.title,
    },
    summaryRow: { flexDirection: "row", gap: theme.spacing.sm },
    stat: { flex: 1, padding: theme.spacing.sm, gap: theme.spacing.xs },
    statValue: {
      color: theme.colors.primary,
      fontSize: theme.type.title,
      fontWeight: "900",
    },
    statLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    tipCard: {
      flexDirection: "row",
      gap: theme.spacing.md,
      alignItems: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    tipIcon: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    campaignEmpty: {
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
    },
    campaignEmptyInline: {
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: theme.radius.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    emptyTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      fontWeight: "800",
      textAlign: "center",
    },
    emptyBody: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.body,
      lineHeight: 20,
      textAlign: "center",
    },
    flex: { flex: 1, minWidth: 0 },
    tipTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "800",
    },
    tipBody: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: 18,
      marginTop: 3,
    },
    conversation: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    conversationTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    conversationName: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      fontWeight: "800",
    },
    time: { color: theme.colors.textSecondary, fontSize: theme.type.caption },
    message: {
      color: theme.colors.textSecondary,
      marginTop: 3,
      fontSize: theme.type.body,
    },
    unread: {
      minWidth: 20,
      height: 20,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    unreadText: {
      color: theme.colors.primaryText,
      fontSize: theme.type.caption,
      fontWeight: "800",
    },
    profileCard: {
      flexDirection: "row",
      gap: theme.spacing.md,
      alignItems: "center",
    },
    profileInfo: { flex: 1, gap: theme.spacing.xs },
    publicProfileCard: {
      gap: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    publicProfileHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    profileLocationRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
    profileLocationText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.body,
      lineHeight: 20,
    },
    privateProfileNotice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    pastWorkList: { gap: theme.spacing.sm },
    pastWorkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    pastWorkIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    profileVisibilityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    profileVisibilityCopy: { flex: 1, gap: theme.spacing.xs },
    profileName: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      fontWeight: "900",
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.md,
    },
    menuIcon: {
      width: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    menuLabel: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      flex: 1,
    },
    chevron: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.display,
    },
    dangerZone: {
      marginTop: theme.spacing.md,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.md,
    },
    dangerText: {
      color: theme.colors.danger,
      fontWeight: "800",
      fontSize: theme.type.bodyLarge,
      marginBottom: theme.spacing.xs,
    },
    back: {
      color: theme.colors.primary,
      fontWeight: "800",
      fontSize: theme.type.body,
      minHeight: 44,
      paddingVertical: theme.spacing.sm,
    },
    chatHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    messageBubble: {
      alignSelf: "flex-start",
      maxWidth: "82%",
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    messageBubbleText: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      lineHeight: 20,
    },
    messageBubbleMine: {
      alignSelf: "flex-end",
      maxWidth: "82%",
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
    },
    messageBubbleMineText: {
      color: theme.colors.primaryText,
      fontSize: theme.type.body,
      lineHeight: 20,
    },
    detailTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.display,
      fontWeight: "900",
      marginTop: theme.spacing.sm,
    },
    detailFacts: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    fact: {
      minWidth: "46%",
      flex: 1,
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
    },
    factLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    factValue: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "800",
      marginTop: theme.spacing.xs,
    },
    creatorHero: {
      flexDirection: "row",
      gap: theme.spacing.md,
      alignItems: "center",
    },
    authShell: { flex: 1, backgroundColor: theme.colors.background },
    authBackdrop: { ...StyleSheet.absoluteFill, overflow: "hidden" },
    authOrbPrimary: {
      position: "absolute",
      width: 270,
      height: 270,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accent,
      top: -110,
      right: -80,
      opacity: 0.68,
    },
    authOrbSecondary: {
      position: "absolute",
      width: 190,
      height: 190,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
      bottom: 54,
      left: -80,
      opacity: 0.86,
    },
    authFormIntro: { gap: theme.spacing.sm },
    methodTabs: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      padding: theme.spacing.xs,
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.md,
    },
    methodTab: {
      minHeight: 44,
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      borderRadius: theme.radius.sm,
    },
    methodTabActive: { backgroundColor: theme.colors.surface },
    methodText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.body,
      fontWeight: "700",
    },
    methodTextActive: { color: theme.colors.primary },
    authHint: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: 18,
    },
    authError: {
      color: theme.colors.danger,
      fontSize: theme.type.caption,
      lineHeight: 18,
      fontWeight: "700",
    },
    authLabel: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "800",
    },
    demoOtpHint: {
      color: theme.colors.primary,
      fontSize: theme.type.caption,
      lineHeight: 18,
      fontWeight: "800",
      textAlign: "center",
    },
    otpCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    guestAction: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
    },
    guestText: {
      color: theme.colors.primary,
      fontSize: theme.type.body,
      fontWeight: "700",
    },
    onboarding: {
      flex: 1,
      padding: theme.spacing.lg,
      justifyContent: "space-between",
      backgroundColor: theme.colors.background,
    },
    skipButton: {
      alignSelf: "flex-end",
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.sm,
    },
    skipText: {
      color: theme.colors.primary,
      fontSize: theme.type.body,
      fontWeight: "700",
    },
    onboardingContent: {
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
    },
    onboardingScrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingVertical: theme.spacing.lg,
    },
    onboardingSelector: {
      width: "100%",
      minHeight: 76,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      marginTop: theme.spacing.lg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    onboardingSelectorLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    onboardingSelectorValue: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      lineHeight: 20,
      marginTop: theme.spacing.xs,
    },
    onboardingChoiceGrid: {
      width: "100%",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      justifyContent: "center",
      marginTop: theme.spacing.lg,
    },
    onboardingError: {
      color: theme.colors.danger,
      fontSize: theme.type.caption,
      lineHeight: 18,
      fontWeight: "700",
      textAlign: "center",
      marginTop: theme.spacing.md,
    },
    onboardingIcon: {
      width: 88,
      height: 88,
      borderRadius: theme.radius.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
      marginBottom: theme.spacing.xl,
    },
    onboardingStep: {
      color: theme.colors.primary,
      fontSize: theme.type.caption,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    onboardingTitle: {
      color: theme.colors.textPrimary,
      textAlign: "center",
      fontSize: theme.type.hero,
      fontWeight: "900",
      lineHeight: 44,
      marginTop: theme.spacing.md,
    },
    onboardingBody: {
      color: theme.colors.textSecondary,
      textAlign: "center",
      fontSize: theme.type.bodyLarge,
      lineHeight: 24,
      marginTop: theme.spacing.md,
    },
    progressRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xxl,
    },
    progressDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.border,
    },
    progressDotActive: { width: 24, backgroundColor: theme.colors.primary },
    onboardingActions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      alignItems: "center",
    },
    topbarTitle: { flex: 1, paddingRight: theme.spacing.md },
    topbarOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
      backgroundColor: theme.colors.background,
    },
    detailSafe: { flex: 1, backgroundColor: theme.colors.background },
    chromeSpacer: { flexShrink: 0 },
    bottomChrome: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 10,
    },
    campaignRailViewport: { marginHorizontal: -theme.spacing.lg },
    campaignRailContent: {
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    campaignRailItem: { paddingVertical: theme.spacing.xs },
    profileScroll: {
      flexGrow: 1,
      paddingBottom: theme.spacing.xxl + theme.spacing.xl,
    },
    profileProgress: {
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    profileProgressHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    profileProgressValue: {
      color: theme.colors.primary,
      fontSize: theme.type.title,
      fontWeight: "900",
    },
    proposalSection: { gap: theme.spacing.sm, marginTop: theme.spacing.md },
    campaignProposalList: { gap: theme.spacing.sm },
    proposalDetailHero: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    detailActionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    detailActionPrimary: { flex: 1, minWidth: 180 },
    emptyProposal: {
      alignItems: "center",
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.surfaceMuted,
    },
    creatorDiscoverIcon: {
      width: 42,
      height: 42,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    progressTrack: {
      height: 7,
      borderRadius: theme.radius.pill,
      overflow: "hidden",
      backgroundColor: theme.colors.border,
    },
    progressFill: {
      width: "75%",
      height: "100%",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primary,
    },
    discoveryFeed: { gap: theme.spacing.lg, paddingBottom: theme.spacing.lg },
    discoveryRailSection: { gap: theme.spacing.xs },
    discoveryRailHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: 0,
    },
    discoveryRailTitleGroup: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    discoveryRailTitle: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      fontWeight: "800",
    },
    discoveryRailHintGroup: {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    discoveryRailHint: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    discoveryCarouselSection: {
      gap: theme.spacing.xs,
      paddingBottom: theme.spacing.lg,
    },
    discoveryCarouselViewport: { marginHorizontal: -theme.spacing.lg },
    discoveryCarousel: {
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    discoveryDots: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      paddingTop: theme.spacing.xs,
    },
    discoveryDot: {
      width: 6,
      height: 6,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.border,
    },
    discoveryDotActive: { width: 18, backgroundColor: theme.colors.primary },
    filterContent: {
      flexGrow: 1,
      gap: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
    },
    filterDrawerOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      alignItems: "stretch",
    },
    filterDrawer: {
      width: "100%",
      height: "70%",
      maxHeight: "78%",
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      paddingHorizontal: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    filterSheetHandle: {
      width: 80,
      height: 4,
      alignSelf: "center",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.border,
      marginBottom: theme.spacing.xs,
    },
    filterDrawerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    filterDrawerTitleRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    filterDrawerBody: {
      flex: 1,
      minHeight: 0,
      flexDirection: "row",
      borderRadius: theme.radius.sm,
      overflow: "hidden",
    },
    filterCategoryRail: {
      width: 76,
      flexGrow: 0,
      flexShrink: 0,
      backgroundColor: theme.colors.surfaceMuted,
      paddingVertical: theme.spacing.xs,
    },
    filterCategoryRailScroll: { width: "100%" },
    filterCategoryRailContent: { paddingBottom: theme.spacing.xs },
    filterCategoryItem: {
      minHeight: 58,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      borderLeftWidth: 2,
      borderLeftColor: theme.colors.transparent,
    },
    filterCategoryItemActive: {
      backgroundColor: theme.colors.surface,
      borderLeftColor: theme.colors.primary,
    },
    filterCategoryLabel: {
      display: "flex",
      color: theme.colors.textSecondary,
      fontSize: 10,
      fontWeight: "700",
      lineHeight: 12,
      textAlign: "center",
    },
    filterCategoryLabelActive: { color: theme.colors.primary },
    filterCategoryDot: {
      position: "absolute",
      top: theme.spacing.xs,
      right: theme.spacing.xs,
      width: 6,
      height: 6,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accent,
    },
    filterOptionsPane: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    filterRangeContent: {
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.xs,
    },
    rangeHelperText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: 18,
      fontWeight: "700",
    },
    rangeSuggestions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    filterOptionsHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    filterOptionsTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "800",
    },
    filterOptionsValue: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      marginTop: 2,
    },
    locationSearchBox: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    locationSearchInput: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      paddingVertical: 0,
    },
    filterOptionsList: {
      gap: theme.spacing.xs,
      paddingBottom: theme.spacing.sm,
    },
    filterOptionRow: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    filterOptionRowSelected: {
      backgroundColor: theme.colors.accent,
    },
    filterOptionIcon: {
      width: 28,
      height: 28,
      borderRadius: theme.radius.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    filterOptionIconSelected: { backgroundColor: theme.colors.primary },
    filterOptionLabel: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.textPrimary,
      fontSize: theme.type.caption,
      lineHeight: 18,
    },
    filterOptionLabelSelected: {
      color: theme.colors.accentText,
      fontWeight: "800",
    },
    filterSelectedCheck: {
      width: 22,
      height: 22,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },
    filterEmpty: {
      alignItems: "center",
      gap: theme.spacing.xs,
      padding: theme.spacing.lg,
    },
    filterEmptyTitle: {
      color: theme.colors.textPrimary,
      fontWeight: "800",
      textAlign: "center",
    },
    filterEmptyBody: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: 18,
      textAlign: "center",
    },
    filterDrawerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.xs,
    },
    filterResetButton: {
      minHeight: 48,
      minWidth: 82,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
    },
    filterResetText: { color: theme.colors.primary, fontWeight: "800" },
    pressed: { opacity: 0.78 },
    sheetHeaderCopy: { flex: 1, minWidth: 0 },
    filterTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
  });
