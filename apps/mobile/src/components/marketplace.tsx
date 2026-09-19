import {
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
import { useState } from "react";
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
import {
  DemoAttachment,
  DemoProposal,
  SocialPlatform,
} from "../types/marketplace";

export function ProposalCard({
  proposal,
  onPress,
  onAccept,
  onDecline,
  onChat,
  onViewDetails,
}: {
  proposal: DemoProposal;
  onPress?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onChat?: () => void;
  onViewDetails?: () => void;
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
      <Text style={styles.proposalMessage}>
        {proposal.message}
      </Text>
      <View
        style={[
          styles.proposalFooter,
          stackActions && styles.proposalFooterStack,
        ]}
      >
        <Text style={styles.proposalUpdated}>{proposal.updatedAt}</Text>
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
  links: { platform: SocialPlatform; handle: string; verified?: boolean }[];
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const openSocialProfile = (platform: SocialPlatform, handle: string) => {
    const cleanHandle = handle.replace(/^@/, "").split("·")[0].trim();
    const urls: Partial<Record<SocialPlatform, string>> = {
      Instagram: `https://instagram.com/${encodeURIComponent(cleanHandle)}`,
      YouTube: `https://youtube.com/@${encodeURIComponent(cleanHandle)}`,
      LinkedIn: `https://www.linkedin.com/in/${encodeURIComponent(cleanHandle.replace(/\s+/g, "-"))}`,
      Pinterest: `https://pinterest.com/${encodeURIComponent(cleanHandle)}`,
      TikTok: `https://tiktok.com/@${encodeURIComponent(cleanHandle)}`,
      Facebook: `https://facebook.com/${encodeURIComponent(cleanHandle)}`,
      X: `https://x.com/${encodeURIComponent(cleanHandle)}`,
      Snapchat: `https://www.snapchat.com/add/${encodeURIComponent(cleanHandle)}`,
    };
    const url = urls[platform];
    if (url) void Linking.openURL(url).catch(() => undefined);
  };
  return (
    <View style={styles.socialLinks}>
      {links.map((link) => (
        <Pressable
          key={`${link.platform}-${link.handle}`}
          accessibilityRole="link"
          accessibilityLabel={`Open ${link.platform} profile ${link.handle}`}
          onPress={() => openSocialProfile(link.platform, link.handle)}
          style={({ pressed }) => [styles.socialLink, pressed && styles.pressed]}
        >
          <View style={styles.socialIcon}>
            <AppIcon
              name="link-outline"
              size={17}
              color={theme.colors.primary}
            />
          </View>
          <View style={styles.socialCopy}>
            <Text style={styles.socialPlatform}>{link.platform}</Text>
            <Text numberOfLines={1} style={styles.socialHandle}>
              {link.handle}
            </Text>
          </View>
          {link.verified ? <Pill label="Linked" /> : null}
        </Pressable>
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
      <View style={styles.reviewBars}>
        <ReviewBar label="Communication" value="4.9" />
        <ReviewBar label="On-time delivery" value="4.8" />
      </View>
    </AppCard>
  );
}

function ReviewBar({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.reviewBarRow}>
      <Text style={styles.reviewBarLabel}>{label}</Text>
      <View style={styles.reviewBarTrack}>
        <View
          style={[styles.reviewBarFill, { width: `${Number(value) * 20}%` }]}
        />
      </View>
      <Text style={styles.reviewBarValue}>{value}</Text>
    </View>
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
}: {
  visible: boolean;
  locations: string[];
  selected: string[];
  onClose: () => void;
  onApply: (locations: string[]) => void;
  subtitle?: string;
  searchAccessibilityLabel?: string;
  limitWithoutQuery?: number | null;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [draft, setDraft] = useState<string[]>(selected);
  const [query, setQuery] = useState("");
  const uniqueLocations = Array.from(
    new Set(locations.map((location) => location.trim()).filter(Boolean)),
  );
  const matchingLocations = uniqueLocations.filter((location) =>
    location.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const mergedLocations = Array.from(
    new Set([...draft, ...matchingLocations]),
  );
  const options = query.trim() || limitWithoutQuery === null
    ? mergedLocations
    : mergedLocations.slice(0, limitWithoutQuery);
  const toggle = (location: string) =>
    setDraft((current) =>
      current.includes(location)
        ? current.filter((item) => item !== location)
        : [...current, location],
    );
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
        <View style={styles.locationModal}>
          <View style={styles.filterSheetHandle} />
          <View style={styles.locationModalHeader}>
            <View style={styles.flex}>
              <Text style={styles.sheetTitle}>Filter by location</Text>
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
              placeholder="Search city or state"
              placeholderTextColor={theme.colors.textSecondary}
              style={styles.locationSearchInput}
            />
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.locationOptions}
          >
            {options.length ? (
              options.map((location) => {
                const isSelected = draft.includes(location);
                return (
                  <Pressable
                    key={location}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
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
                        name={isSelected ? "checkmark" : "location-outline"}
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
              })
            ) : (
              <View style={styles.mediaEmpty}>
                <AppIcon
                  name="search-outline"
                  size={18}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.mediaEmptyText}>No locations found</Text>
              </View>
            )}
          </ScrollView>
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
                label={`Apply${draft.length ? ` (${draft.length})` : ""}`}
                onPress={() => {
                  onApply(draft);
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
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
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
      gap: theme.spacing.xs,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingTop: theme.spacing.xs,
    },
    proposalFooterStack: { alignItems: "stretch", flexDirection: "column" },
    proposalUpdated: {
      flexShrink: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    proposalActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: theme.spacing.xs,
      flex: 1,
      flexBasis: 200,
      minWidth: 0,
      flexShrink: 1,
    },
    proposalActionsStack: { alignItems: "stretch", width: "100%", flex: 0 },
    proposalActionButton: { width: "100%" },
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
      height: "76%",
      maxHeight: "82%",
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
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
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    locationSearchInput: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
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
    reviewCard: {
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceMuted,
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
    reviewBars: { gap: theme.spacing.xs },
    reviewBarRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    reviewBarLabel: {
      width: 112,
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    reviewBarTrack: {
      flex: 1,
      height: 6,
      overflow: "hidden",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.border,
    },
    reviewBarFill: {
      height: "100%",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primary,
    },
    reviewBarValue: {
      width: 28,
      color: theme.colors.textPrimary,
      fontSize: theme.type.caption,
      fontWeight: "700",
      textAlign: "right",
    },
    pressed: { opacity: 0.8 },
  });
