import type { ComponentProps } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { AppIcon } from "../../components/ui";
import { INDIA_STATES } from "../../lib/indiaLocations";
import type { ApiUser } from "../../services/authApi.service";
import type {
  BrandBrief,
  Campaign,
  CreatorContentType,
  CreatorReview,
  CreatorWorkHistory,
  DemoAttachment,
  DemoProposal,
  Influencer,
  MarketplaceConversationStatus,
  ProfileDraft,
  ProposalStatus,
  PublicCreatorProfile,
  SocialPlatform,
  TabName,
} from "../../types/marketplace";
import type { MarketplaceFlow, NotificationSettings } from "./FlowScreens";

export type Detail =
  | { type: "todo"; taskId: string }
  | { type: "influencer"; value: PublicCreatorProfile; returnTo?: "compare" }
  | { type: "creatorWork"; creator: PublicCreatorProfile; work: CreatorWorkHistory; returnTo?: "compare" }
  | { type: "compareCreators" }
  | {
      type: "profile";
      value: ChatProfile;
      returnTo?: { type: "chat"; name: string; initials: string; returnTo: ChatReturn };
      readOnly?: boolean;
    }
  | { type: "brandProfile"; brief: BrandBrief; returnTo?: ChatReturn }
  | { type: "campaign"; value: Campaign }
  | {
      type: "application";
      campaign: Campaign;
      brief: BrandBrief;
      returnToChat?: {
        name: string;
        initials: string;
        returnTo: ChatReturn;
        applicationId?: string;
        conversationId?: string;
        conversationStatus?: MarketplaceConversationStatus;
      };
    }
  | {
      type: "chat";
      name: string;
      initials: string;
      returnTo: ChatReturn;
      applicationId?: string;
      conversationId?: string;
      conversationStatus?: MarketplaceConversationStatus;
      adminChat?: boolean;
      initialMessage?: string;
      initialMessageMine?: boolean;
      initialAttachments?: DemoAttachment[];
    }
  | { type: "proposal"; value: DemoProposal }
  | {
      type: "flow";
      flow: MarketplaceFlow;
      returnTo?: { type: "chat"; name: string; initials: string; returnTo: ChatReturn; applicationId?: string };
      campaign?: Campaign;
      reminderId?: string;
      applicationId?: string;
    }
  | null;
export type ChatProfile = {
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
  bio?: string;
  socialAccounts?: Partial<Record<SocialPlatform, string>>;
  socialVerification?: Partial<Record<SocialPlatform, string>>;
};
export type ChatReturn =
  | { type: "utility"; page: "Chats" }
  | { type: "tab"; tab: TabName }
  | { type: "proposal"; value: DemoProposal };
export type AppNotification = {
  id: string;
  icon:
    | "paper-plane-outline"
    | "chatbubble-ellipses-outline"
    | "checkmark-circle-outline"
    | "briefcase-outline"
    | "alarm-outline";
  title: string;
  body: string;
  brandName?: string;
  actionLabel?: string;
  actionUrl?: string;
  time: string;
  read: boolean;
  category: keyof NotificationSettings | "reminders";
  taskId?: string;
  reminderId?: string;
  campaignId?: string;
  screen?: string;
  applicationId?: string;
  conversationId?: string;
  adminChat?: boolean;
  socialPlatform?: string;
  verificationStatus?: string;
  mediaUri?: string;
  mediaName?: string;
  mediaType?: "image" | "video" | "file";
};
export type AccountDeletionRequest = {
  requestedAt: number;
  expiresAt: number;
};
export type SocialAccountMap = Partial<Record<SocialPlatform, string>>;
export const DEFAULT_SOCIAL_ACCOUNTS: SocialAccountMap = {};
export type SocialPlatformConfig = {
  key: SocialPlatform;
  label: string;
  icon: AppIconName;
  color: string;
  surface: string;
  hosts: string[];
  placeholder: string;
};
export const SOCIAL_PLATFORM_REGISTRY: SocialPlatformConfig[] = [
  { key: "Instagram", label: "Instagram", icon: "logo-instagram", color: "#DB2777", surface: "#FCE7F3", hosts: ["instagram.com"], placeholder: "https://instagram.com/your-profile" },
  { key: "YouTube", label: "YouTube", icon: "logo-youtube", color: "#DC2626", surface: "#FEE2E2", hosts: ["youtube.com", "youtu.be"], placeholder: "https://youtube.com/@your-channel" },
  { key: "Threads", label: "Threads", icon: "logo-threads", color: "#111827", surface: "#F3F4F6", hosts: ["threads.net"], placeholder: "https://threads.net/@your-profile" },
  { key: "Snapchat", label: "Snapchat", icon: "logo-snapchat", color: "#CA8A04", surface: "#FEF9C3", hosts: ["snapchat.com"], placeholder: "https://snapchat.com/add/your-profile" },
  { key: "Facebook", label: "Facebook", icon: "logo-facebook", color: "#2563EB", surface: "#DBEAFE", hosts: ["facebook.com"], placeholder: "https://facebook.com/your-profile" },
  { key: "LinkedIn", label: "LinkedIn", icon: "logo-linkedin", color: "#0284C7", surface: "#E0F2FE", hosts: ["linkedin.com"], placeholder: "https://linkedin.com/in/your-profile" },
  { key: "X", label: "X", icon: "logo-twitter", color: "#111827", surface: "#F3F4F6", hosts: ["x.com", "twitter.com"], placeholder: "https://x.com/your-profile" },
  { key: "Pinterest", label: "Pinterest", icon: "logo-pinterest", color: "#DC2626", surface: "#FEE2E2", hosts: ["pinterest.com"], placeholder: "https://pinterest.com/your-profile" },
  { key: "Twitch", label: "Twitch", icon: "logo-twitch", color: "#7C3AED", surface: "#EDE9FE", hosts: ["twitch.tv"], placeholder: "https://twitch.tv/your-channel" },
  { key: "Reddit", label: "Reddit", icon: "logo-reddit", color: "#EA580C", surface: "#FFEDD5", hosts: ["reddit.com"], placeholder: "https://reddit.com/u/your-profile" },
  { key: "Discord", label: "Discord", icon: "logo-discord", color: "#4F46E5", surface: "#E0E7FF", hosts: ["discord.com", "discord.gg"], placeholder: "https://discord.com/users/your-profile" },
  { key: "Medium", label: "Medium", icon: "logo-medium", color: "#111827", surface: "#F3F4F6", hosts: ["medium.com"], placeholder: "https://medium.com/@your-profile" },
  { key: "Behance", label: "Behance", icon: "logo-behance", color: "#2563EB", surface: "#DBEAFE", hosts: ["behance.net"], placeholder: "https://behance.net/your-profile" },
];
export const NATIVE_LANGUAGE_OPTIONS = [
  "Hindi", "English", "Bengali", "Telugu", "Marathi", "Tamil", "Gujarati", "Kannada", "Malayalam", "Punjabi",
  "Odia", "Urdu", "Assamese", "Maithili", "Konkani", "Nepali", "Sanskrit", "Sindhi", "Kashmiri", "Manipuri",
  "Bodo", "Santali",
] as const;
export const createDefaultProfile = (role: "Brand" | "Influencer"): ProfileDraft =>
  role === "Brand"
    ? {
        name: "",
        city: "",
        focus: "",
        bio: "",
      }
    : {
        name: "",
        city: "",
        focus: "",
        bio: "",
      };
export const getProfileInitials = (name: string) =>
  name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
export const AUTH_SOCIAL_PLATFORMS: SocialPlatform[] = SOCIAL_PLATFORM_REGISTRY.map(({ key }) => key);
const remoteString = (value: unknown) => typeof value === "string" ? value : "";
const remoteStringArray = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
  : undefined;
export const mapRemoteUserProfile = (user: ApiUser): ProfileDraft => ({
  name: remoteString(user.profile?.displayName),
  city: remoteString(user.profile?.city),
  focus: remoteString(user.profile?.focus),
  bio: remoteString(user.profile?.bio),
  avatarUri: typeof user.profile?.avatarUrl === "string" ? user.profile.avatarUrl : undefined,
  websiteUrl: typeof user.profile?.websiteUrl === "string" ? user.profile.websiteUrl : undefined,
  audienceSize: typeof user.profile?.audienceSize === "string" ? user.profile.audienceSize : undefined,
  rateRange: typeof user.profile?.rateRange === "string" ? user.profile.rateRange : undefined,
  teamSize: typeof user.profile?.teamSize === "string" ? user.profile.teamSize : undefined,
  languages: remoteStringArray(user.profile?.languages),
  locations: remoteStringArray(user.profile?.locations),
  isPublic: user.profile?.visibility === "PUBLIC",
});
export const getProfileCompletion = (
  profile: ProfileDraft,
  role: "Brand" | "Influencer",
  socialAccounts: SocialAccountMap,
) => {
  const fields = [profile.name, profile.city, profile.focus, profile.bio];
  if (role === "Influencer") fields.push(Object.keys(socialAccounts).join(","));
  return Math.round((fields.filter((value) => typeof value === "string" && value.trim()).length / fields.length) * 100);
};
export const DEFAULT_NOTIFICATIONS: AppNotification[] = [];
export type ContentDetail = Exclude<
  Detail,
  | { type: "todo"; taskId: string }
  | { type: "flow"; flow: MarketplaceFlow }
  | { type: "proposal"; value: DemoProposal }
  | { type: "application"; campaign: Campaign; brief: BrandBrief }
  | { type: "brandProfile"; brief: BrandBrief; returnTo?: ChatReturn }
  | { type: "creatorWork"; creator: PublicCreatorProfile; work: CreatorWorkHistory; returnTo?: "compare" }
  | { type: "compareCreators" }
  | null
>;
export type CampaignFeedItem =
  | { id: string; kind: "rail"; title: string; campaigns: Campaign[] }
  | { id: string; kind: "card"; campaign: Campaign };
export type ProposalFeedItem =
  | { id: string; kind: "rail"; title: string; proposals: DemoProposal[] }
  | { id: string; kind: "card"; proposal: DemoProposal };
export type CampaignFilters = {
  statuses: ("Open" | "In progress" | "Closed")[];
  categories: string[];
};
export type ProposalFilters = {
  status: ProposalStatus[];
  direction: ("incoming" | "sent")[];
  cities: string[];
};
export type DiscoverFilters = {
  locations: LocationSelection[];
  platforms: SocialPlatform[];
  priceRange: NumericRange;
  ratingRange: NumericRange;
  followersRange: NumericRange;
  categories: string[];
  contentTypes: CreatorContentType[];
};
export type NumericRange = { min: string; max: string };
export type LocationSelection = { state: string; city: string | null };
export type FilterCategory =
  | "city"
  | "price"
  | "audience"
  | "category"
  | "platform"
  | "contentType"
  | "rating";
export type AppIconName = ComponentProps<typeof AppIcon>["name"];
export type LocationFilterOption = {
  id: string;
  label: string;
  value: string;
  kind: "state" | "city";
  state: string;
  city: string | null;
  searchValue: string;
};
export const DEFAULT_DISCOVER_FILTERS: DiscoverFilters = {
  locations: [],
  platforms: [],
  priceRange: { min: "", max: "" },
  ratingRange: { min: "", max: "" },
  followersRange: { min: "", max: "" },
  categories: [],
  contentTypes: [],
};
export const DEFAULT_CAMPAIGN_FILTERS: CampaignFilters = {
  statuses: [],
  categories: [],
};
export const DEFAULT_PROPOSAL_FILTERS: ProposalFilters = {
  status: [],
  direction: [],
  cities: [],
};
export const FILTER_CATEGORIES: {
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
export const CREATOR_CATEGORIES = [
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
  "Wellness",
  "Family",
  "Pets",
  "Health",
  "Beauty & Skincare",
  "Home & Interiors",
  "Business",
  "Automotive",
  "Photography",
  "Music",
  "Sports",
  "Books",
  "DIY & Crafts",
  "Sustainability",
];
export const INDUSTRY_OPTIONS = [
  "Travel & Lifestyle",
  "Fashion & Apparel",
  "Beauty & Personal Care",
  "Tech & SaaS",
  "Food & Beverage",
  "Health & Wellness",
  "E-commerce",
  "Media & Entertainment",
  "Home & Interiors",
  "Finance & Fintech",
  "Education",
  "Sports & Fitness",
  "Automotive",
  "Consumer Services",
];
export const AUDIENCE_SIZE_OPTIONS = [
  "Under 10K",
  "10K - 50K",
  "50K - 100K",
  "100K - 500K",
  "500K - 1M",
  "1M+",
];
export const CREATOR_RATE_OPTIONS = [
  "₹2,000 - ₹5,000",
  "₹5,000 - ₹10,000",
  "₹10,000 - ₹25,000",
  "₹25,000 - ₹50,000",
  "₹50,000 - ₹1,00,000",
  "₹1,00,000+",
];
export const CAMPAIGN_BUDGET_OPTIONS = [
  "Under ₹25,000",
  "₹25,000 - ₹50,000",
  "₹50,000 - ₹1,00,000",
  "₹1,00,000 - ₹2,50,000",
  "₹2,50,000 - ₹5,00,000",
  "₹5,00,000+",
];
export const TEAM_SIZE_OPTIONS = ["1 - 10", "11 - 50", "51 - 200", "201+"];
export const INDIA_LOCATION_OPTIONS = Array.from(new Set([
  "Pan India",
  ...INDIA_STATES.map((item) => item.state),
  ...INDIA_STATES.flatMap((item) => item.cities.map((city) => `${city.name}, ${item.state}`)),
]));
export const DEMO_CREATOR_PROFILE_LOCATIONS = [
  "Mumbai",
  "Delhi",
  "Bengaluru",
  "Pune",
  "Hyderabad",
  "Pan India",
];
export const SUPPORTED_PLATFORMS: SocialPlatform[] = AUTH_SOCIAL_PLATFORMS;
export const SUPPORTED_CONTENT_TYPES: CreatorContentType[] = [
  "Reel",
  "Short video",
  "Long video",
  "Photo post",
  "Story",
  "Live",
  "Carousel",
  "Blog post",
];
export const normaliseLocationSearch = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("en-IN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
export const LOCATION_STATE_ALIASES: Record<string, string> = {
  delhincr: "delhi",
  nctofdelhi: "delhi",
  orissa: "odisha",
  pondicherry: "puducherry",
};
export const normaliseLocationState = (value: string) => {
  const normalized = normaliseLocationSearch(value);
  return LOCATION_STATE_ALIASES[normalized] ?? normalized;
};
export const matchesLocationSelection = (
  item: Pick<Influencer, "city" | "state">,
  selection: LocationSelection,
) => {
  const sameState =
    normaliseLocationState(item.state ?? "") ===
    normaliseLocationState(selection.state);
  if (!sameState) return false;
  return (
    selection.city === null ||
    normaliseLocationSearch(item.city) === normaliseLocationSearch(selection.city)
  );
};
export const getAppliedFilterCount = (filters: DiscoverFilters) =>
  [
    filters.locations.length > 0,
    filters.platforms.length > 0,
    filters.priceRange.min !== "" || filters.priceRange.max !== "",
    filters.ratingRange.min !== "" || filters.ratingRange.max !== "",
    filters.followersRange.min !== "" || filters.followersRange.max !== "",
    filters.categories.length > 0,
    filters.contentTypes.length > 0,
  ].filter(Boolean).length;
export const getCampaignAppliedFilterCount = (filters: CampaignFilters) =>
  [filters.statuses.length > 0, filters.categories.length > 0].filter(Boolean)
    .length;
export const getProposalAppliedFilterCount = (filters: ProposalFilters) =>
  [
    filters.status.length > 0,
    filters.direction.length > 0,
    filters.cities.length > 0,
  ].filter(Boolean).length;
export const getCampaignFilterStatus = (status: Campaign["status"]) =>
  status === "Open" || status === "Published"
    ? "Open"
    : status === "Completed" || status === "Closed" || status === "Archived"
      ? "Closed"
      : "In progress";
export const isLocationFilterOption = (
  option: unknown,
): option is LocationFilterOption =>
  typeof option === "object" &&
  option !== null &&
  "kind" in option &&
  ((option as { kind?: unknown }).kind === "state" ||
    (option as { kind?: unknown }).kind === "city") &&
  "state" in option;
export const getStartingPrice = (price: string) => {
  const value = Number.parseFloat(price.match(/[\d.]+/)?.[0] ?? "0");
  return price.includes("K") ? value * 1000 : value;
};
export const getAmount = (amount: string) =>
  Number.parseFloat(amount.replace(/[^\d.]/g, "")) || 0;
export const formatIncome = (amount: number) =>
  amount >= 1000 ? `₹${Math.round(amount / 1000)}K` : `₹${amount}`;
export const getFollowerCount = (followers: string) => {
  const value = Number.parseFloat(followers.match(/[\d.]+/)?.[0] ?? "0");
  return followers.includes("M") ? value * 1000000 : value * 1000;
};
export const formatCompactNumber = (value: string, prefix = "") => {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  if (number >= 1000000) return `${prefix}${number / 1000000}M`;
  if (number >= 1000) return `${prefix}${number / 1000}K`;
  return `${prefix}${number}`;
};
export const formatRangeLabel = (
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
export const isWithinRange = (value: number, range: NumericRange) => {
  const min = Number(range.min);
  const max = Number(range.max);
  return (
    (!range.min || (Number.isFinite(min) && value >= min)) &&
    (!range.max || (Number.isFinite(max) && value <= max))
  );
};
export const normaliseRange = (
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
export const includesAny = <T,>(values: T[], selected: T[]) =>
  selected.length === 0 || selected.some((value) => values.includes(value));
export const toggleValue = <T,>(values: T[], value: T) =>
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
export type ScrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
