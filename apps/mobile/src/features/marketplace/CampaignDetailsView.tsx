import { useMemo, useState, type ReactNode } from "react";
import { Linking, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton, AppCard, AppIcon, Avatar, Pill, SearchField, Skeleton } from "../../components/ui";
import { BrandPublicProfileView } from "./BrandPublicProfileView";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import type { AuthoredReview, BrandBrief, Campaign, Influencer, MarketplaceApplication, PublicCreatorProfile } from "../../types/marketplace";
import { getCampaignStatusLabel } from "../../lib/marketplace";
import { formatCampaignDeadline, formatDisplayDateTime } from "../../lib/dateTime";

type Props = {
  campaign: Campaign;
  brief: BrandBrief;
  campaigns?: Campaign[];
  authoredReviews?: AuthoredReview[];
  onOpenCampaign?: (campaign: Campaign) => void;
  role: "Brand" | "Influencer";
  application?: MarketplaceApplication;
  currentCreator?: PublicCreatorProfile;
  blocked?: boolean;
  onBack: () => void;
  onApply?: () => void;
  onEdit?: () => void;
  onPublish?: () => void;
  onChangeVisibility?: (visibility: "public" | "private") => void;
  isOwner?: boolean;
  hasAcceptedCollaboration?: boolean;
  eligibleCreators?: Influencer[];
  eligibleCreatorsLoading?: boolean;
  sentCreatorIds?: string[];
  onSendToCreator?: (creatorId: string) => boolean;
  onSendToCreators?: (creatorIds: string[]) => number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  viewerBrandName?: string;
  viewerBrandLogoUrl?: string;
};

export function CampaignDetailsView({
  campaign,
  brief,
  campaigns = [],
  authoredReviews = [],
  onOpenCampaign,
  role,
  application,
  blocked = false,
  onBack,
  onApply,
  onEdit,
  onPublish,
  onChangeVisibility,
  isOwner = role === "Brand",
  hasAcceptedCollaboration = false,
  eligibleCreators = [],
  eligibleCreatorsLoading = false,
  sentCreatorIds = [],
  onSendToCreator,
  onSendToCreators,
  onScroll,
  viewerBrandName,
  viewerBrandLogoUrl,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const [showBrand, setShowBrand] = useState(false);
  const [creatorPickerOpen, setCreatorPickerOpen] = useState(false);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<string[]>([]);
  const [creatorQuery, setCreatorQuery] = useState("");
  const isIdentifier = (value?: string) => Boolean(value && (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value) || /^brand-[0-9a-f-]{20,}$/i.test(value)));
  const brandName = [isOwner ? viewerBrandName : undefined, brief.brandName, campaign.brand]
    .map((value) => value?.trim())
    .find((value) => Boolean(value) && !isIdentifier(value)) || "Brand";
  const brandInitials = [brief.brandInitials, campaign.brandInitials]
    .map((value) => value?.trim())
    .find((value) => Boolean(value) && !isIdentifier(value))
    || brandName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const resolvedBrief = brandName === brief.brandName && brandInitials === brief.brandInitials && (brief.brandLogoUrl || campaign.brandLogoUrl) === brief.brandLogoUrl
    ? brief
    : { ...brief, brandName, brandInitials, brandLogoUrl: (isOwner ? viewerBrandLogoUrl : undefined) || brief.brandLogoUrl || campaign.brandLogoUrl };
  const filteredEligibleCreators = useMemo(() => {
    const query = creatorQuery.trim().toLowerCase();
    if (!query) return eligibleCreators;
    return eligibleCreators.filter((creator) => [creator.name, creator.niche, creator.city, ...(creator.platforms ?? [])].some((value) => value.toLowerCase().includes(query)));
  }, [creatorQuery, eligibleCreators]);
  const openCreatorPicker = () => {
    setSelectedCreatorIds([]);
    setCreatorQuery("");
    setCreatorPickerOpen(true);
  };
  if (showBrand) {
    return <BrandPublicProfileView brief={resolvedBrief} campaigns={campaigns} authoredReviews={authoredReviews} onOpenCampaign={onOpenCampaign} onBack={() => setShowBrand(false)} onScroll={onScroll ?? (() => undefined)} backLabel="Back to campaign" />;
  }
  const media = campaign.media ?? [];
  const imageMedia = media.filter((item) => item.type === "image" && item.uri);
  const cover = imageMedia[0];
  const additionalMedia = cover ? media.filter((item) => item.id !== cover.id) : media;
  const requirements = campaign.requirements ?? brief.requirements.map((item) => item.label);
  const visibility = campaign.visibility ?? "public";
  const canManageCampaign = role === "Brand" && isOwner;
  const statusLabel = application?.status === "Declined"
    ? "Rejected"
    : application?.status ?? getCampaignStatusLabel(campaign.status);
  const displayStatusLabel = !application && visibility === "private" ? "Private" : statusLabel;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.page, { paddingBottom: Math.max(insets.bottom, theme.spacing.xxl) }]}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Back to marketplace" onPress={onBack} style={styles.backButton}>
        <AppIcon name="chevron-back" size={20} color={theme.colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      {cover?.uri ? <View style={styles.campaignHero}>
        <ExpoImage source={{ uri: cover.uri }} contentFit="cover" style={styles.campaignBanner} accessibilityLabel={`${campaign.title} banner`} />
        {imageMedia.length > 1 ? <View style={styles.campaignPhotoCount}><AppIcon name="images-outline" size={14} color={theme.colors.textPrimary} /><Text style={styles.campaignPhotoCountText}>{imageMedia.length} photos</Text></View> : null}
      </View> : null}
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>{role === "Brand" ? "CAMPAIGN" : "BRIEF"}</Text>
          <Text style={styles.title}>{campaign.title}</Text>
          <Text style={styles.meta}>{campaign.category} · {campaign.city}</Text>
        </View>
        <Pill label={displayStatusLabel} accent={visibility !== "private" && (campaign.status === "Published" || campaign.status === "Open")} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${brandName} profile and reviews`} onPress={() => setShowBrand(true)} style={styles.brandLink}>
        <Avatar initials={brandInitials} uri={resolvedBrief.brandLogoUrl} size="small" />
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{brandName}</Text>
           <Text style={styles.meta}>{canManageCampaign ? "View your brand profile and reviews" : "View brand profile and reviews"}</Text>
        </View>
        <AppIcon name="chevron-forward" size={18} color={theme.colors.primary} />
      </Pressable>
      <Text style={styles.body}>{campaign.description}</Text>
      {role === "Influencer" && campaign.matchScore !== undefined ? <AppCard style={styles.statusCard}>
        <View style={styles.matchHeader}><AppIcon name="sparkles-outline" size={18} color={theme.colors.primary} /><Text style={styles.cardTitle}>{campaign.matchScore}% match for you</Text></View>
        {campaign.matchReasons?.map((reason) => <View key={reason} style={styles.matchReason}><AppIcon name="checkmark-circle-outline" size={15} color={theme.colors.primary} /><Text style={styles.meta}>{reason}</Text></View>)}
      </AppCard> : null}
      {campaign.applicationCount !== undefined || campaign.applicationLimit || campaign.minimumFollowers || campaign.approvalLimit ? <AppCard style={styles.limitCard}>
        {campaign.applicationCount !== undefined || campaign.applicationLimit ? <View style={styles.limitRow}><AppIcon name="people-outline" size={17} color={theme.colors.primary} /><Text style={styles.meta}>Creators applied: {campaign.applicationCount ?? 0}{campaign.applicationLimit ? ` / ${campaign.applicationLimit}` : ""}</Text></View> : null}
        {campaign.minimumFollowers ? <View style={styles.limitRow}><AppIcon name="people-circle-outline" size={17} color={theme.colors.primary} /><Text style={styles.meta}>Minimum audience: {campaign.minimumFollowers.toLocaleString()} followers</Text></View> : null}
        {campaign.approvalLimit ? <View style={styles.limitRow}><AppIcon name="checkmark-circle-outline" size={17} color={theme.colors.primary} /><Text style={styles.meta}>Approved creators: {campaign.approvedCount ?? 0}/{campaign.approvalLimit}</Text></View> : null}
      </AppCard> : null}
      <View style={styles.facts}>
        {[
          ["Budget", campaign.budget],
          ["Location", campaign.city],
          ["Deadline", formatCampaignDeadline(campaign.deadlineAt ?? campaign.deadline)],
          ["Category", campaign.category],
        ].map(([label, value], index) => <Fact key={label} label={label} value={value} tone={index} styles={styles} />)}
      </View>
      {campaign.platforms?.length ? <Section title="Platforms" styles={styles}><View style={styles.tagRow}>{campaign.platforms.map((platform) => <Pill key={platform} label={platform} />)}</View></Section> : null}
      <Section title="Deliverables" styles={styles}><Text style={styles.body}>{campaign.deliverables ?? brief.deliverables}</Text></Section>
      {campaign.creatorRequirements ? <Section title="Creator requirements" styles={styles}><Text style={styles.body}>{campaign.creatorRequirements}</Text></Section> : null}
      {requirements.length ? <Section title="Requirements" styles={styles}><View style={styles.stack}>{requirements.map((requirement) => <View key={requirement} style={styles.bullet}><AppIcon name="checkmark-circle-outline" size={17} color={theme.colors.primary} /><Text style={styles.body}>{requirement}</Text></View>)}</View></Section> : null}
      {additionalMedia.length ? <Section title="More campaign media" styles={styles}><View style={styles.stack}>{additionalMedia.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Open ${item.name}`} onPress={() => item.uri ? void Linking.openURL(item.uri).catch(() => undefined) : undefined} style={styles.mediaRow}>{item.type === "image" && item.uri ? <ExpoImage source={{ uri: item.uri }} contentFit="cover" style={styles.mediaImage} /> : <AppIcon name={item.type === "video" ? "videocam-outline" : "document-outline"} size={18} color={theme.colors.primary} />}<Text style={styles.body}>{item.name}</Text></Pressable>)}</View></Section> : null}
      {campaign.collaborationVideoUrl ? <Section title={campaign.collaborationVideoLabel ?? "Video brief"} styles={styles}><AppButton label="Open video brief" icon="play-circle-outline" variant="secondary" onPress={() => void Linking.openURL(campaign.collaborationVideoUrl!).catch(() => undefined)} /></Section> : null}
      {canManageCampaign ? <AppCard style={styles.visibilityCard}><View style={styles.flex}><Text style={styles.cardTitle}>Visibility</Text><Text style={styles.meta}>{hasAcceptedCollaboration ? "Accepted creator collaborations keep this campaign public." : visibility === "public" ? "Creators can discover this published campaign in Market." : "Only direct campaign requests can share this campaign."}</Text></View><View style={styles.visibilityChoices}>{(["public", "private"] as const).map((value) => { const disabled = value === "private" && hasAcceptedCollaboration; return <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`Make campaign ${value}`} accessibilityState={{ selected: visibility === value, disabled }} disabled={disabled} onPress={() => onChangeVisibility?.(value)} style={[styles.visibilityChoice, visibility === value && styles.visibilityChoiceActive, disabled && styles.visibilityChoiceDisabled]}><AppIcon name={value === "public" ? "globe-outline" : "lock-closed-outline"} size={14} color={visibility === value ? theme.colors.primaryText : disabled ? theme.colors.disabled : theme.colors.textSecondary} /><Text style={[styles.visibilityChoiceText, visibility === value && styles.visibilityChoiceTextActive, disabled && styles.visibilityChoiceTextDisabled]}>{value === "public" ? "Public" : "Private"}</Text></Pressable>; })}</View></AppCard> : null}
      {application ? <AppCard style={styles.statusCard}>
        <Text style={styles.cardTitle}>Application status</Text>
        <Pill label={application.status === "Declined" ? "Rejected" : application.status} accent={application.status === "Accepted"} />
        <View style={styles.statusBlock}><Text style={styles.statusLabel}>Campaign</Text><Text style={styles.statusValue}>{campaign.title}</Text></View>
        <View style={styles.statusBlock}><Text style={styles.statusLabel}>Brand</Text><Text style={styles.statusValue}>{campaign.brand}</Text></View>
        <View style={styles.statusBlock}><Text style={styles.statusLabel}>Applied</Text><Text style={styles.statusValue}>{formatDisplayDateTime(application.submittedAt)}</Text></View>
        {application.message ? <View style={styles.statusBlock}><Text style={styles.statusLabel}>Message</Text><Text style={styles.statusValue}>{application.message}</Text></View> : null}
        {application.rejectionReason ? <View style={styles.statusBlock}><Text style={styles.statusLabel}>Rejection reason</Text><Text style={styles.statusValue}>{application.rejectionReason}</Text></View> : null}
        {application.status === "Declined" ? <Text style={styles.meta}>{application.canReapply ? "You can apply again." : "Reapply is disabled for this campaign."}</Text> : null}
        {application.status === "Blocked" ? <Text style={styles.meta}>This campaign is unavailable because the relationship is blocked.</Text> : null}
      </AppCard> : null}
       {canManageCampaign ? <View style={styles.actions}><AppButton label="Send campaign" icon="paper-plane-outline" onPress={openCreatorPicker} /><AppButton label="Edit campaign" icon="create-outline" variant="secondary" onPress={onEdit} />{campaign.status === "Draft" ? <AppButton label="Publish campaign" icon="megaphone-outline" onPress={onPublish} /> : null}</View> : role === "Brand" ? null : blocked || application?.status === "Blocked" ? <AppCard style={styles.statusCard}><Text style={styles.cardTitle}>Application unavailable</Text><Text style={styles.meta}>You cannot apply to this campaign.</Text></AppCard> : application?.status === "Pending" || application?.status === "Accepted" ? null : application?.status === "Declined" && !application.canReapply ? null : campaign.minimumFollowers && campaign.minimumFollowersMet === false && !application ? <AppCard style={styles.statusCard}><Text style={styles.cardTitle}>Follower count needs an update</Text><Text style={styles.meta}>Refresh and verify a connected social account in Profile before applying. Only verified counts updated within the last 7 hours qualify.</Text></AppCard> : campaign.applicationsOpen === false && !application ? <AppCard style={styles.statusCard}><Text style={styles.cardTitle}>Applications are closed</Text><Text style={styles.meta}>{campaign.approvalLimitReached ? "This campaign has filled its approved creator slots." : "This campaign has reached its application limit."}</Text></AppCard> : <AppButton label={application ? "Apply again" : "Apply to campaign"} icon="paper-plane-outline" onPress={onApply} />}
       {canManageCampaign ? <Modal visible={creatorPickerOpen} transparent animationType="slide" onRequestClose={() => setCreatorPickerOpen(false)}><View style={styles.modalOverlay}><Pressable accessibilityRole="button" accessibilityLabel="Close creator selection" onPress={() => setCreatorPickerOpen(false)} style={styles.modalBackdrop} /><View style={[styles.creatorPicker, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}><View style={styles.pickerHeader}><View style={styles.flex}><Text style={styles.cardTitle}>Send campaign</Text><Text style={styles.meta}>Matched creators and active collaboration partners appear here.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close creator selection" onPress={() => setCreatorPickerOpen(false)} style={styles.pickerClose}><AppIcon name="close" size={18} color={theme.colors.textSecondary} /></Pressable></View><SearchField value={creatorQuery} onChangeText={setCreatorQuery} placeholder="Search creator, niche or city" accessibilityLabel="Search creators for campaign" />{eligibleCreatorsLoading ? <View accessibilityRole="progressbar" accessibilityLabel="Loading matched creators" style={styles.creatorPickerList}>{[1, 2, 3].map((item) => <View key={item} style={styles.creatorPickerRow}><View style={styles.creatorSkeletonAvatar} /><View style={styles.flex}><Skeleton width="54%" height={14} /><Skeleton width="78%" height={11} /><Skeleton width="42%" height={11} /></View><Skeleton width={18} height={18} /></View>)}</View> : filteredEligibleCreators.length ? <><ScrollView contentContainerStyle={styles.creatorPickerList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{filteredEligibleCreators.map((creator) => { const alreadySent = sentCreatorIds.includes(creator.id); const selected = selectedCreatorIds.includes(creator.id); return <Pressable key={creator.id} accessibilityRole="checkbox" accessibilityLabel={`${alreadySent ? "Campaign already sent to" : selected ? "Remove" : "Select"} ${creator.name}`} accessibilityState={{ checked: selected || alreadySent, disabled: alreadySent }} disabled={alreadySent} onPress={() => setSelectedCreatorIds((current) => selected ? current.filter((id) => id !== creator.id) : [...current, creator.id])} style={({ pressed }) => [styles.creatorPickerRow, selected && styles.creatorPickerRowSelected, alreadySent && styles.creatorPickerRowDisabled, pressed && styles.pressed]}><Avatar initials={creator.initials} uri={creator.avatarUrl} size="small" /><View style={styles.flex}><Text style={styles.cardTitle}>{creator.name}</Text><Text style={styles.meta}>{creator.niche} · {creator.city}</Text>{creator.matchScore !== undefined ? <Text style={styles.meta}>{creator.matchScore}% match{creator.matchReasons?.[0] ? ` · ${creator.matchReasons[0]}` : ""}</Text> : null}<Text style={styles.meta}>{alreadySent ? "Campaign already sent" : selected ? "Selected" : "Tap to select"}</Text></View><AppIcon name={alreadySent || selected ? "checkmark-circle-outline" : "add-circle-outline"} size={18} color={alreadySent ? theme.colors.textSecondary : theme.colors.primary} /></Pressable>; })}</ScrollView><AppButton label={`Send to ${selectedCreatorIds.length} creator${selectedCreatorIds.length === 1 ? "" : "s"}`} icon="paper-plane-outline" disabled={!selectedCreatorIds.length} onPress={() => { const sent = onSendToCreators ? onSendToCreators(selectedCreatorIds) : selectedCreatorIds.reduce((count, creatorId) => count + (onSendToCreator?.(creatorId) ? 1 : 0), 0); if (sent) { setSelectedCreatorIds([]); setCreatorPickerOpen(false); } }} /></> : <View style={styles.creatorPickerEmpty}><AppIcon name="search-outline" size={24} color={theme.colors.primary} /><Text style={styles.cardTitle}>{creatorQuery.trim() ? "No creators found" : "No matches yet"}</Text><Text style={styles.meta}>{creatorQuery.trim() ? "Try another name, niche or city." : "Complete creator profiles or use an active collaboration partner to send this campaign."}</Text></View>}</View></View></Modal> : null}
    </ScrollView>
  );
}

function Section({ title, children, styles }: { title: string; children: ReactNode; styles: ReturnType<typeof makeStyles> }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function Fact({ label, value, tone, styles }: { label: string; value: string; tone: number; styles: ReturnType<typeof makeStyles> }) {
  const toneStyle = [styles.factSky, styles.factMint, styles.factBlush, styles.factButter][tone % 4];
  return <View style={[styles.fact, toneStyle]}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value || "Not specified"}</Text></View>;
}

const makeStyles = (theme: AppTheme) => createThemeStyles(theme, {
  screen: { flex: 1, backgroundColor: theme.colors.transparent },
  page: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  campaignHero: { height: 210, width: "100%", position: "relative", overflow: "hidden", borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceMuted },
  campaignBanner: { width: "100%", height: "100%" },
  campaignPhotoCount: { position: "absolute", right: theme.spacing.sm, bottom: theme.spacing.sm, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceRaised },
  campaignPhotoCountText: { color: theme.colors.textPrimary, fontSize: theme.type.caption, fontWeight: "800" },
  flex: { flex: 1, minWidth: 0 },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: theme.spacing.xs },
  backText: { color: theme.colors.primary, fontSize: theme.type.body, fontWeight: "800", fontFamily: theme.type.bodyFont },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  eyebrow: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "900", letterSpacing: 1, fontFamily: theme.type.bodyFont },
  title: { color: theme.colors.textPrimary, fontSize: theme.type.display, lineHeight: theme.type.display + 4, fontWeight: "900", fontFamily: theme.type.displayFont },
  meta: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
  body: { color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont, flexShrink: 1 },
  brandLink: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceRaised, borderWidth: 1, borderColor: theme.colors.border },
  cardTitle: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, fontWeight: "800", fontFamily: theme.type.bodyFont },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  fact: { flexBasis: "47%", flexGrow: 1, gap: theme.spacing.xs, padding: theme.spacing.md, borderRadius: theme.radius.md },
  factSky: { backgroundColor: theme.colors.surfaceSky },
  factMint: { backgroundColor: theme.colors.surfaceMint },
  factBlush: { backgroundColor: theme.colors.surfaceBlush },
  factButter: { backgroundColor: theme.colors.surfaceButter },
  factLabel: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont },
  factValue: { color: theme.colors.textPrimary, fontSize: theme.type.body, fontWeight: "800", fontFamily: theme.type.bodyFont },
  section: { gap: theme.spacing.sm },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
  stack: { gap: theme.spacing.sm },
  bullet: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  mediaRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
  mediaImage: { width: 64, height: 64, borderRadius: theme.radius.sm },
  statusCard: { gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceMint },
  limitCard: { gap: theme.spacing.xs, backgroundColor: theme.colors.surfaceSky },
  limitRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  matchHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  matchReason: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  visibilityCard: { gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceSky },
  visibilityChoices: { flexDirection: "row", gap: theme.spacing.xs },
  visibilityChoice: { minHeight: 40, flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: theme.spacing.sm, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceRaised },
  visibilityChoiceActive: { backgroundColor: theme.colors.primary },
  visibilityChoiceDisabled: { opacity: 0.5 },
  visibilityChoiceText: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
  visibilityChoiceTextActive: { color: theme.colors.primaryText },
  visibilityChoiceTextDisabled: { color: theme.colors.disabled },
  statusBlock: { gap: theme.spacing.xs },
  statusLabel: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontWeight: "700", fontFamily: theme.type.bodyFont },
  statusValue: { color: theme.colors.textPrimary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont, flexShrink: 1 },
  actions: { gap: theme.spacing.sm },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.overlay },
  creatorPicker: { maxHeight: "70%", padding: theme.spacing.md, gap: theme.spacing.sm, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceRaised },
  pickerHeader: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  pickerClose: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceMuted },
  creatorPickerList: { gap: theme.spacing.xs, paddingBottom: theme.spacing.xs },
  creatorPickerRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, padding: theme.spacing.sm, borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceMuted },
  creatorPickerRowSelected: { backgroundColor: theme.colors.accent, borderWidth: 1, borderColor: theme.colors.primary },
  creatorPickerRowDisabled: { opacity: 0.56 },
  creatorSkeletonAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.surfaceLilac },
  creatorPickerEmpty: { alignItems: "center", gap: theme.spacing.xs, paddingVertical: theme.spacing.lg },
  pressed: { opacity: 0.78 },
});
