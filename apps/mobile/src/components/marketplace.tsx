import {
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import {
  AppButton,
  AppCard,
  AppIcon,
  Avatar,
  ConfirmModal,
  Pill,
} from "./ui";
import { useTheme } from "../providers/ThemeProvider";
import { AppTheme } from "../styles/theme";
import { createThemeStyles } from "../styles/createThemeStyles";
import { SOCIAL_PLATFORM_REGISTRY } from "../features/marketplace/marketplaceDomain";
import { formatDisplayDateTime } from "../lib/dateTime";
import type { AppIconName } from "../features/marketplace/marketplaceDomain";
import {
  DemoAttachment,
  DemoProposal,
  DeliverySchedule,
  Influencer,
  PublicCreatorProfile,
  SocialPlatform,
  SocialVerificationStatus,
} from "../types/marketplace";

type CreatorProfileCardProps = {
  creator: Influencer | PublicCreatorProfile;
  onPress?: () => void;
  showBio?: boolean;
  showTags?: boolean;
};

export function CreatorProfileCard({ creator, onPress, showBio = false, showTags = true }: CreatorProfileCardProps) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const publicCreator = "bio" in creator ? creator : undefined;
  return (
    <AppCard onPress={onPress} style={styles.creatorProfileCard}>
      <View style={styles.creatorProfileHeader}>
        <Avatar initials={creator.initials} uri={creator.avatarUrl} size="normal" />
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.creatorProfileName}>{creator.name}</Text>
          <Text numberOfLines={2} style={styles.creatorProfileMeta}>{creator.niche} · {creator.city}</Text>
        </View>
        <Pill label={`${creator.rating} rating`} accent />
      </View>
      {showBio && publicCreator?.bio ? <Text style={styles.creatorProfileBio}>{publicCreator.bio}</Text> : null}
      <View style={styles.creatorProfileStats}>
        <View style={[styles.creatorProfileStat, styles.creatorProfileStatSky]}>
          <Text style={styles.creatorProfileValue}>{creator.followers}</Text>
          <Text style={styles.creatorProfileLabel}>Followers</Text>
        </View>
        <View style={[styles.creatorProfileStat, styles.creatorProfileStatMint]}>
          <Text style={styles.creatorProfileValue}>{creator.reviews}</Text>
          <Text style={styles.creatorProfileLabel}>Reviews</Text>
        </View>
        <View style={[styles.creatorProfileStat, styles.creatorProfileStatBlush]}>
          <Text numberOfLines={1} style={styles.creatorProfileValue}>{creator.price}</Text>
          <Text style={styles.creatorProfileLabel}>Starting rate</Text>
        </View>
      </View>
      {showTags ? (
        <View style={styles.creatorProfileTags}>
          {creator.platforms.slice(0, 3).map((platform) => <Pill key={platform} label={platform} />)}
          {creator.contentTypes.slice(0, 2).map((contentType) => <Pill key={contentType} label={contentType} />)}
        </View>
      ) : null}
      {onPress ? (
        <View style={styles.creatorProfileFooter}>
          <Text style={styles.creatorProfileAction}>View public profile</Text>
          <AppIcon name="arrow-forward" size={18} color={theme.colors.primary} />
        </View>
      ) : null}
    </AppCard>
  );
}

export function ProposalCard({
  proposal,
  onPress,
  onAccept,
  onDecline,
  onChat,
  onViewDetails,
  onReminderPress,
}: {
  proposal: DemoProposal;
  onPress?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onChat?: () => void;
  onViewDetails?: () => void;
  onReminderPress?: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { width } = useWindowDimensions();
  // The rail cards are narrower than the device viewport, so use a slightly
  // wider breakpoint to keep actions readable on small phones and split views.
  const stackActions = width < 520;
  const isPending = proposal.status === "Pending";
  const statusAccent =
    proposal.status === "Accepted" || proposal.status === "Completed";
  const [confirmAction, setConfirmAction] = useState<"accept" | "decline" | null>(
    null,
  );
  const confirmProposalAction = () => {
    if (confirmAction === "accept") onAccept?.();
    if (confirmAction === "decline") onDecline?.();
    setConfirmAction(null);
  };
  return (
    <>
      <AppCard onPress={onPress} style={styles.proposalCard}>
      <View style={styles.proposalHeader}>
        <Avatar
          initials={proposal.participantInitials}
          uri={proposal.participantAvatarUrl}
          size="small"
        />
        <View style={styles.proposalHeaderCopy}>
          <Text numberOfLines={1} style={styles.proposalParticipant}>
            {proposal.participantName}
          </Text>
          <Text numberOfLines={1} style={styles.proposalRoleLabel}>
            Collaboration proposal
          </Text>
        </View>
        <View style={styles.proposalStatusWrap}>
          <Text style={styles.proposalStatusLabel}>Status</Text>
          <Pill label={proposal.status} accent={statusAccent} />
        </View>
      </View>
      <View style={styles.proposalCampaignRow}>
        <View style={styles.proposalCampaignIcon}>
          <AppIcon
            name="briefcase-outline"
            size={16}
            color={theme.colors.primary}
          />
        </View>
        <Text style={styles.proposalCampaignText}>
          {proposal.proposalTitle
            ? `${proposal.proposalTitle} · ${proposal.campaignTitle}`
            : proposal.campaignTitle}
        </Text>
        <AppIcon
          name="chevron-forward"
          size={16}
          color={theme.colors.textSecondary}
        />
      </View>
      <View style={styles.proposalMetaRow}>
        <View style={styles.proposalMetaChip}>
          <Meta icon="location-outline" label={proposal.city} />
        </View>
        <View style={styles.proposalMetaChip}>
          <Meta icon="cash-outline" label={proposal.amount} primary />
        </View>
        {proposal.attachments?.length ? (
          <View style={styles.proposalMetaChip}>
            <Meta
              icon="attach-outline"
              label={`${proposal.attachments.length} attachment${proposal.attachments.length === 1 ? "" : "s"}`}
            />
          </View>
        ) : null}
      </View>
      <View style={styles.proposalDeliverablesBlock}>
        <Text style={styles.proposalSectionLabel}>Deliverables</Text>
        <Text style={styles.proposalDeliverables}>
          {proposal.deliverables}
        </Text>
      </View>
      <DeliveryScheduleCard
        schedule={proposal.schedule}
        onReminderPress={onReminderPress}
      />
      <Text style={styles.proposalMessage}>
        {proposal.message}
      </Text>
      <View
        style={[
          styles.proposalFooter,
          stackActions && styles.proposalFooterStack,
        ]}
      >
        <Text style={styles.proposalUpdated}>{formatDisplayDateTime(proposal.updatedAt)}</Text>
        <View
          style={[styles.proposalActions, stackActions && styles.proposalActionsStack]}
        >
          {onViewDetails ? (
            <AppButton
              label="View details"
              compact
              variant="secondary"
              onPress={onViewDetails}
              icon="document-text-outline"
              style={stackActions && styles.proposalActionButton}
            />
          ) : null}
          {isPending && onDecline ? (
            <AppButton
              label="Decline"
              compact
              variant="secondary"
              onPress={() => setConfirmAction("decline")}
              icon="close"
              style={stackActions && styles.proposalActionButton}
            />
          ) : null}
          {isPending && onAccept ? (
            <AppButton
              label="Accept"
              compact
              onPress={() => setConfirmAction("accept")}
              icon="checkmark"
              style={stackActions && styles.proposalActionButton}
            />
          ) : null}
          {proposal.status === "Accepted" && onChat ? (
            <AppButton
              label="Open chat"
              compact
              icon="chatbubble-ellipses-outline"
              onPress={onChat}
              style={stackActions && styles.proposalActionButton}
            />
          ) : null}
          {proposal.status === "Completed" ? (
            <View style={styles.completedLabel}>
              <AppIcon
                name="checkmark-circle-outline"
                size={16}
                color={theme.colors.success}
              />
              <Text style={styles.completedText}>Work completed</Text>
            </View>
          ) : null}
        </View>
      </View>
      </AppCard>
      <ConfirmModal
        visible={confirmAction !== null}
        title={confirmAction === "decline" ? "Decline proposal?" : "Accept proposal?"}
        message={
          confirmAction === "decline"
            ? "This proposal will be marked as declined for both sides."
            : "Accept this proposal and open the collaboration workflow?"
        }
        confirmLabel={confirmAction === "decline" ? "Decline" : "Accept"}
        confirmIcon={confirmAction === "decline" ? "close" : "checkmark"}
        destructive={confirmAction === "decline"}
        onCancel={() => setConfirmAction(null)}
        onConfirm={confirmProposalAction}
      />
    </>
  );
}

export function DeliveryScheduleCard({
  schedule,
  onReminderPress,
}: {
  schedule?: DeliverySchedule;
  onReminderPress?: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  if (!schedule) return null;
  return (
    <View style={styles.deliverySchedule}>
      <View style={styles.deliveryScheduleCopy}>
        <View style={styles.deliveryScheduleIcon}>
          <AppIcon
            name="calendar-outline"
            size={16}
            color={theme.colors.primary}
          />
        </View>
        <View style={styles.deliveryScheduleText}>
          <Text style={styles.proposalSectionLabel}>{schedule.format}</Text>
          <Text style={styles.deliveryScheduleValue}>
            {schedule.deliveryDate} · {schedule.deliveryTime}
          </Text>
        </View>
      </View>
      {onReminderPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={schedule.reminderSet ? "Edit delivery reminder" : "Set delivery reminder"}
          onPress={onReminderPress}
          style={({ pressed }) => [
            styles.deliveryReminder,
            styles.deliveryReminderAction,
            pressed && styles.pressed,
          ]}
        >
          <AppIcon
            name={schedule.reminderSet ? "notifications-outline" : "alarm-outline"}
            size={15}
            color={schedule.reminderSet ? theme.colors.success : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.deliveryReminderText,
              !schedule.reminderSet && styles.deliveryReminderTextMuted,
            ]}
          >
            {schedule.reminderSet ? "Reminder set" : "Set reminder"}
          </Text>
          <AppIcon name="chevron-forward" size={16} color={theme.colors.textSecondary} />
        </Pressable>
      ) : (
        <View style={styles.deliveryReminder}>
          <AppIcon
            name="notifications-outline"
            size={15}
            color={schedule.reminderSet ? theme.colors.success : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.deliveryReminderText,
              !schedule.reminderSet && styles.deliveryReminderTextMuted,
            ]}
          >
            {schedule.reminderSet ? "Reminder set" : "No reminder"}
          </Text>
        </View>
      )}
    </View>
  );
}

export function ProposalMediaGallery({
  attachments = [],
}: {
  attachments?: DemoAttachment[];
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  if (!attachments.length) {
    return (
      <AppCard style={styles.mediaEmpty}>
        <AppIcon
          name="folder-open-outline"
          size={20}
          color={theme.colors.textSecondary}
        />
        <Text style={styles.mediaEmptyText}>
          No media attached to this proposal.
        </Text>
      </AppCard>
    );
  }
  return (
    <View style={styles.mediaGallery}>
      {attachments.map((attachment) =>
        attachment.uri && attachment.type === "image" ? (
          <View key={attachment.id} style={styles.mediaPreview}>
            <ExpoImage
              accessibilityLabel={`${attachment.type} attachment ${attachment.name}`}
              source={attachment.uri}
              contentFit="cover"
              transition={120}
              style={styles.mediaImage}
            />
            <View style={styles.mediaLabel}>
              <AppIcon
                name="image-outline"
                size={15}
                color={theme.colors.primaryText}
              />
              <Text numberOfLines={1} style={styles.mediaLabelText}>
                {attachment.name}
              </Text>
            </View>
          </View>
        ) : (
          <AppCard key={attachment.id} style={styles.mediaFile}>
            <AppIcon
              name={
                attachment.type === "video"
                  ? "videocam-outline"
                  : "document-text-outline"
              }
              size={20}
              color={theme.colors.primary}
            />
            <View style={styles.mediaFileCopy}>
              <Text numberOfLines={1} style={styles.mediaFileName}>
                {attachment.name}
              </Text>
              <Text style={styles.mediaFileType}>
                {attachment.type === "video"
                  ? "Video attachment"
                  : "Document attachment"}
              </Text>
            </View>
            <AppIcon
              name={attachment.uri ? "open-outline" : "download-outline"}
              size={18}
              color={theme.colors.textSecondary}
            />
          </AppCard>
        ),
      )}
    </View>
  );
}

function Meta({
  icon,
  label,
  primary = false,
}: {
  icon: "location-outline" | "cash-outline" | "attach-outline";
  label: string;
  primary?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.meta}>
      <AppIcon
        name={icon}
        size={15}
        color={primary ? theme.colors.primary : theme.colors.textSecondary}
      />
      <Text
        numberOfLines={1}
        style={[styles.metaText, primary && styles.metaPrimary]}
      >
        {label}
      </Text>
    </View>
  );
}

export function SocialLinks({
  links,
}: {
  links: {
    platform: SocialPlatform;
    handle: string;
    verified?: boolean;
    verificationStatus?: SocialVerificationStatus;
  }[];
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const openSocialProfile = (platform: SocialPlatform, handle: string) => {
    if (/^https?:\/\//i.test(handle.trim())) {
      void Linking.openURL(handle.trim()).catch(() => undefined);
      return;
    }
    const cleanHandle = handle.replace(/^@/, "").split("·")[0].trim();
    const urls: Partial<Record<SocialPlatform, string>> = {
      Instagram: `https://instagram.com/${encodeURIComponent(cleanHandle)}`,
      YouTube: `https://youtube.com/@${encodeURIComponent(cleanHandle)}`,
      Threads: `https://www.threads.net/@${encodeURIComponent(cleanHandle)}`,
      LinkedIn: `https://www.linkedin.com/in/${encodeURIComponent(cleanHandle.replace(/\s+/g, "-"))}`,
      Pinterest: `https://pinterest.com/${encodeURIComponent(cleanHandle)}`,
      Facebook: `https://facebook.com/${encodeURIComponent(cleanHandle)}`,
      X: `https://x.com/${encodeURIComponent(cleanHandle)}`,
      Snapchat: `https://www.snapchat.com/add/${encodeURIComponent(cleanHandle)}`,
      Twitch: `https://www.twitch.tv/${encodeURIComponent(cleanHandle)}`,
      Reddit: `https://www.reddit.com/user/${encodeURIComponent(cleanHandle)}`,
      Discord: `https://discord.com/users/${encodeURIComponent(cleanHandle)}`,
      Medium: `https://medium.com/@${encodeURIComponent(cleanHandle)}`,
      Behance: `https://www.behance.net/${encodeURIComponent(cleanHandle)}`,
    };
    const url = urls[platform];
    if (url) void Linking.openURL(url).catch(() => undefined);
  };
  return (
    <View style={styles.socialLinks}>
      {links.map((link) => (
        (() => {
          const config = SOCIAL_PLATFORM_REGISTRY.find((item) => item.key === link.platform);
          const isVerified = link.verificationStatus
            ? link.verificationStatus === "VERIFIED"
            : Boolean(link.verified);
          return (
        <Pressable
          key={`${link.platform}-${link.handle}`}
          accessibilityRole="link"
          accessibilityLabel={`Open ${link.platform} profile ${link.handle}`}
          onPress={() => openSocialProfile(link.platform, link.handle)}
          style={({ pressed }) => [styles.socialLink, pressed && styles.pressed]}
        >
          <View style={styles.socialIcon}>
            <AppIcon
              name={config?.icon ?? "link-outline"}
              size={17}
              color={config?.color ?? theme.colors.primary}
            />
          </View>
          <View style={styles.socialCopy}>
            <Text style={styles.socialPlatform}>{link.platform}</Text>
            <Text numberOfLines={1} style={styles.socialHandle}>
              {link.handle}
            </Text>
          </View>
          <View style={styles.socialStatus}>
            <AppIcon
              name={isVerified ? "checkmark-circle" : "time-outline"}
              size={15}
              color={isVerified ? "#2563EB" : theme.colors.warning}
            />
            <Text style={[styles.socialStatusText, isVerified ? styles.socialStatusVerified : styles.socialStatusReview]}>
              {isVerified ? "Verified" : "Review"}
            </Text>
          </View>
        </Pressable>
          );
        })()
      ))}
    </View>
  );
}

export function ReviewSummary({
  rating,
  reviewCount,
  note,
  onPress,
}: {
  rating: number;
  reviewCount: number;
  note: string;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <AppCard onPress={onPress} style={styles.reviewCard}>
      <View style={styles.reviewScore}>
        <AppIcon name="star" size={20} color={theme.colors.accent} />
        <Text style={styles.reviewRating}>{rating.toFixed(1)}</Text>
        <Text style={styles.reviewCount}>from {reviewCount} reviews</Text>
      </View>
      <Text style={styles.reviewNote}>{note}</Text>
    </AppCard>
  );
}

export function LocationFilterSheet({
  visible,
  locations,
  selected,
  onClose,
  onApply,
  subtitle = "Use your saved creator locations",
  searchAccessibilityLabel = "Search locations",
  limitWithoutQuery = 24,
  single = false,
  title = "Filter by location",
  optionIcon = "location-outline",
  searchPlaceholder = "Search city or state",
  emptyLabel = "No locations found",
}: {
  visible: boolean;
  locations: string[];
  selected: string[];
  onClose: () => void;
  onApply: (locations: string[]) => void;
  subtitle?: string;
  searchAccessibilityLabel?: string;
  limitWithoutQuery?: number | null;
  single?: boolean;
  title?: string;
  optionIcon?: AppIconName;
  searchPlaceholder?: string;
  emptyLabel?: string;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<string[]>(selected);
  const [query, setQuery] = useState("");
  const uniqueLocations = useMemo(
    () => Array.from(new Set(locations.map((location) => location.trim()).filter(Boolean))),
    [locations],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const matchingLocations = useMemo(
    () => uniqueLocations.filter((location) => location.toLowerCase().includes(normalizedQuery)),
    [normalizedQuery, uniqueLocations],
  );
  const options = useMemo(() => {
    const resultLimit = normalizedQuery ? 60 : limitWithoutQuery;
    const visibleMatches = resultLimit === null
      ? matchingLocations
      : matchingLocations.slice(0, resultLimit);
    return Array.from(new Set([...draft, ...visibleMatches]));
  }, [draft, limitWithoutQuery, matchingLocations, normalizedQuery]);
  const toggle = (location: string) =>
    setDraft((current) => {
      if (single) return current.includes(location) ? [] : [location];
      return current.includes(location)
        ? current.filter((item) => item !== location)
        : [...current, location];
    });
  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onShow={() => {
        setDraft(selected);
        setQuery("");
      }}
      onRequestClose={onClose}
    >
      <View style={styles.locationModalOverlay}>
        <Pressable style={styles.locationModalBackdrop} onPress={onClose} />
        <View style={[styles.locationModal, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
          <View style={styles.filterSheetHandle} />
          <View style={styles.locationModalHeader}>
            <View style={styles.flex}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Text style={styles.sheetSubtitle}>{subtitle}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close location filters"
              onPress={onClose}
              style={styles.locationClose}
            >
              <AppIcon
                name="close"
                size={19}
                color={theme.colors.textPrimary}
              />
            </Pressable>
          </View>
          <View style={styles.locationSearch}>
            <AppIcon
              name="search-outline"
              size={18}
              color={theme.colors.textSecondary}
            />
            <TextInput
              accessibilityLabel={searchAccessibilityLabel}
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={theme.colors.inputPlaceholder}
              style={styles.locationSearchInput}
            />
          </View>
          <FlatList
            data={options}
            keyExtractor={(location) => location}
            renderItem={({ item: location }) => {
              const isSelected = draft.includes(location);
              return (
                <Pressable
                  accessibilityRole={single ? "radio" : "checkbox"}
                  accessibilityState={{ checked: isSelected, selected: isSelected }}
                  onPress={() => toggle(location)}
                  style={({ pressed }) => [
                    styles.locationOption,
                    isSelected && styles.locationOptionSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.locationOptionIcon,
                      isSelected && styles.locationOptionIconSelected,
                    ]}
                  >
                    <AppIcon
                      name={isSelected ? "checkmark" : optionIcon}
                      size={17}
                      color={
                        isSelected
                          ? theme.colors.primaryText
                          : theme.colors.primary
                      }
                    />
                  </View>
                  <Text style={styles.locationOptionText}>{location}</Text>
                  {isSelected ? (
                    <AppIcon
                      name="checkmark-circle"
                      size={19}
                      color={theme.colors.primary}
                    />
                  ) : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.mediaEmpty}>
                <AppIcon
                  name="search-outline"
                  size={18}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.mediaEmptyText}>{emptyLabel}</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={styles.locationOptions}
          />
          <View style={styles.locationActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDraft([])}
              style={styles.locationReset}
            >
              <AppIcon
                name="refresh-outline"
                size={17}
                color={theme.colors.primary}
              />
              <Text style={styles.locationResetText}>Reset</Text>
            </Pressable>
            <View style={styles.flex}>
              <AppButton
                label={single ? "Select" : `Apply${draft.length ? ` (${draft.length})` : ""}`}
                onPress={() => {
                  onApply(single ? draft.slice(0, 1) : draft);
                  onClose();
                }}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: AppTheme) =>
  createThemeStyles(theme, {
    flex: { flex: 1, minWidth: 0 },
    creatorProfileCard: { gap: theme.spacing.md, marginBottom: theme.spacing.sm, backgroundColor: theme.colors.surfaceLilac },
    creatorProfileHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
    creatorProfileName: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, fontWeight: "800", fontFamily: theme.type.bodyFont },
    creatorProfileMeta: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
    creatorProfileBio: { color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont },
    creatorProfileStats: { flexDirection: "row", gap: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border },
    creatorProfileStat: { flex: 1, minWidth: 0, gap: 2, padding: theme.spacing.sm, borderRadius: theme.radius.control },
    creatorProfileStatSky: { backgroundColor: theme.colors.surfaceSky },
    creatorProfileStatMint: { backgroundColor: theme.colors.surfaceMint },
    creatorProfileStatBlush: { backgroundColor: theme.colors.surfaceBlush },
    creatorProfileValue: { color: theme.colors.textPrimary, fontSize: theme.type.body, fontWeight: "800", fontFamily: theme.type.bodyFont },
    creatorProfileLabel: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont },
    creatorProfileTags: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
    creatorProfileFooter: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    creatorProfileAction: { color: theme.colors.primary, fontSize: theme.type.body, fontWeight: "800", fontFamily: theme.type.bodyFont },
    filterSheetHandle: {
      width: 80,
      height: 4,
      alignSelf: "center",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.border,
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
    proposalCard: {
      width: "100%",
      minWidth: 0,
      gap: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceSky,
    },
    proposalHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingBottom: 0,
    },
    proposalHeaderCopy: { flex: 1, minWidth: 0, gap: 3 },
    proposalParticipant: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "800",
    },
    proposalRoleLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    proposalStatusWrap: {
      alignItems: "flex-end",
      gap: 3,
    },
    proposalStatusLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    proposalCampaignRow: {
      width: "100%",
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    proposalCampaignIcon: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    proposalCampaignText: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "800",
      lineHeight: 19,
    },
    proposalMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    proposalMetaChip: {
      maxWidth: "100%",
      flexShrink: 1,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
    },
    meta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      maxWidth: "100%",
      flexShrink: 1,
    },
    metaText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      flexShrink: 1,
    },
    metaPrimary: { color: theme.colors.primary, fontWeight: "800" },
    proposalDeliverablesBlock: { gap: theme.spacing.xs },
    proposalSectionLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    proposalDeliverables: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "700",
      lineHeight: 20,
    },
    deliverySchedule: {
      gap: theme.spacing.sm,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.accent,
    },
    deliveryScheduleCopy: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    deliveryScheduleIcon: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    deliveryScheduleText: { flex: 1, minWidth: 0, gap: 2 },
    deliveryScheduleValue: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "800",
    },
    deliveryReminder: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingLeft: 40,
    },
    deliveryReminderAction: {
      flex: 1,
      minWidth: 0,
      paddingRight: theme.spacing.xs,
      borderRadius: theme.radius.sm,
    },
    deliveryReminderText: {
      color: theme.colors.success,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    deliveryReminderTextMuted: { color: theme.colors.textSecondary },
    proposalMessage: {
      width: "100%",
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: 17,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    proposalFooter: {
      gap: theme.spacing.sm,
      flexDirection: "column",
      alignItems: "stretch",
      paddingTop: theme.spacing.xs,
    },
    proposalFooterStack: { flexDirection: "column" },
    proposalUpdated: {
      flexShrink: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    proposalActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-start",
      gap: theme.spacing.sm,
      width: "100%",
      flex: 0,
      flexBasis: "auto",
      minWidth: 0,
    },
    proposalActionsStack: {
      alignItems: "stretch",
      flexDirection: "column",
      width: "100%",
      flex: 0,
    },
    proposalActionButton: { width: "100%", flexGrow: 0 },
    completedLabel: { flexDirection: "row", alignItems: "center", gap: 4 },
    completedText: {
      color: theme.colors.success,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    mediaGallery: { gap: theme.spacing.sm },
    mediaPreview: {
      height: 174,
      overflow: "hidden",
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    mediaImage: { width: "100%", height: "100%" },
    mediaLabel: {
      position: "absolute",
      left: theme.spacing.sm,
      right: theme.spacing.sm,
      bottom: theme.spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      padding: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.overlay,
    },
    mediaLabelText: {
      flex: 1,
      color: theme.colors.primaryText,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    mediaFile: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    mediaFileCopy: { flex: 1, minWidth: 0, gap: 2 },
    mediaFileName: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "700",
    },
    mediaFileType: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    mediaEmpty: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    mediaEmptyText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    locationModalOverlay: { flex: 1, justifyContent: "flex-end" },
    locationModalBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.colors.overlay,
    },
    locationModal: {
      ...theme.shadows.modal,
      height: "76%",
      maxHeight: "82%",
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      backgroundColor: theme.colors.surfaceRaised,
    },
    locationModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    locationClose: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
    },
    locationSearch: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    locationSearchInput: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      fontFamily: theme.type.bodyFont,
    },
    locationOptions: {
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
    },
    locationOption: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
    },
    locationOptionSelected: { backgroundColor: theme.colors.surfaceMuted },
    locationOptionIcon: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
    },
    locationOptionIconSelected: { backgroundColor: theme.colors.primary },
    locationOptionText: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "700",
    },
    locationActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.xs,
    },
    locationReset: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
    },
    locationResetText: {
      color: theme.colors.primary,
      fontSize: theme.type.body,
      fontWeight: "700",
    },
    socialLinks: { gap: theme.spacing.xs },
    socialLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      minHeight: 52,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    socialIcon: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    socialCopy: { flex: 1, minWidth: 0, gap: 1 },
    socialPlatform: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "700",
    },
    socialHandle: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    socialStatus: {
      minWidth: 72,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 4,
    },
    socialStatusText: { fontSize: 11, fontWeight: "800" },
    socialStatusVerified: { color: "#2563EB" },
    socialStatusReview: { color: theme.colors.warning },
    reviewCard: {
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
    },
    reviewScore: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    reviewRating: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      fontWeight: "900",
    },
    reviewCount: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    reviewNote: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.body,
      lineHeight: 20,
    },
    pressed: { opacity: 0.8 },
  });
