import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AppCard, AppIcon, Avatar, NATIVE_ANIMATIONS_ENABLED, OverflowMenu, Pill } from "../../components/ui";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import type { AuthoredReview, BrandBrief, Campaign } from "../../types/marketplace";
import { brandBriefToCampaign, getCampaignStatusLabel, isPublishedCampaign } from "../../lib/marketplace";
import { formatCampaignDeadline, formatDisplayDateTime } from "../../lib/dateTime";

type BrandProfileTab = "Overview" | "Campaigns" | "About" | "Reviews";
type BrandProfileReview = { id: string; creatorName: string; rating: number; text: string; date?: string; tags?: string[] };

type Props = {
  brief: BrandBrief;
  campaigns?: Campaign[];
  authoredReviews?: AuthoredReview[];
  onOpenCampaign?: (campaign: Campaign) => void;
  onBack: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  backLabel?: string;
};

export function BrandPublicProfileView({
  brief,
  campaigns = [],
  authoredReviews = [],
  onOpenCampaign,
  onBack,
  onScroll,
  backLabel = "Back to briefs",
}: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [activeTab, setActiveTab] = useState<BrandProfileTab>("Overview");
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const tabProgress = useRef(new Animated.Value(1)).current;
  const reviews = useMemo<BrandProfileReview[]>(() => [
    ...(brief.brandReviews ?? []),
    ...authoredReviews
      .filter((review) => review.authorRole === "Influencer" && review.subjectName.trim().toLowerCase() === brief.brandName.trim().toLowerCase())
      .map((review) => ({
        id: review.id,
        creatorName: review.author,
        rating: review.rating,
        text: review.text,
        date: review.date,
        tags: review.tags,
      })),
  ].filter((review, index, all) => all.findIndex((item) => item.id === review.id) === index), [authoredReviews, brief.brandName, brief.brandReviews]);
  const relatedCampaigns = useMemo(() => {
    const linked = campaigns.filter((campaign) =>
      (brief.brandId && campaign.brandId === brief.brandId) || campaign.brand === brief.brandName,
    );
    if (brief.campaignId && linked.some((campaign) => campaign.id === brief.campaignId)) return linked;
    return [brandBriefToCampaign(brief), ...linked];
  }, [brief, campaigns]);
  const publicCampaigns = relatedCampaigns.filter(
    (campaign) => campaign.status !== "Draft" && campaign.status !== "Archived" && campaign.visibility !== "private",
  );
  const activeCampaigns = publicCampaigns.filter(isPublishedCampaign).length;
  const rating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;
  const about = brief.brandDescription.trim() || `${brief.brandName} shares creator-led campaign opportunities with a clear brief and defined deliverables.`;
  const tabs = ([
    "Overview",
    publicCampaigns.length ? "Campaigns" : null,
    about ? "About" : null,
    reviews.length ? "Reviews" : null,
  ] as Array<BrandProfileTab | null>).filter((tab): tab is BrandProfileTab => Boolean(tab));

  const switchTab = (tab: BrandProfileTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    tabProgress.setValue(0);
    Animated.timing(tabProgress, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
    }).start();
  };

  const menuActions = [
    publicCampaigns.length
      ? {
          label: "View campaigns",
          icon: "briefcase-outline" as const,
          onPress: () => switchTab("Campaigns"),
        }
      : null,
    brief.brandWebsite
      ? {
          label: "Open brand website",
          icon: "open-outline" as const,
          onPress: () => void Linking.openURL(brief.brandWebsite!).catch(() => undefined),
        }
      : null,
  ].filter((action): action is NonNullable<typeof action> => Boolean(action));

  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.page}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.topbar}>
        <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} style={styles.back}>
          <AppIcon name="chevron-back" size={20} color={theme.colors.primary} />
          <Text style={styles.backText}>{backLabel}</Text>
        </Pressable>
        {menuActions.length ? <OverflowMenu label={`More actions for ${brief.brandName}`} actions={menuActions} /> : null}
      </View>

      <AppCard style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <Avatar initials={brief.brandInitials} uri={brief.brandLogoUrl} size="large" />
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{brief.brandName}</Text>
            <Text style={styles.meta}>{brief.category} · {brief.city}</Text>
            <View style={styles.ratingRow}>
              <AppIcon name="star" size={15} color={theme.colors.accentText} />
              <Text style={styles.rating}>{rating ? rating.toFixed(1) : "New"}</Text>
              <Text style={styles.meta}> · {reviews.length} review{reviews.length === 1 ? "" : "s"}</Text>
            </View>
          </View>
        </View>
        <View style={styles.statsRow}>
          <ProfileStat label="Active campaigns" value={String(activeCampaigns)} />
          <ProfileStat label="Campaigns" value={String(publicCampaigns.length)} />
          <ProfileStat label="Location" value={brief.city} />
        </View>
        <View style={styles.pillRow}>
          <Pill label={brief.category} accent />
          {brief.brandWebsite ? <Pill label="Website available" /> : null}
        </View>
      </AppCard>

      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
            onPress={() => switchTab(tab)}
            style={({ pressed }) => [styles.tab, activeTab === tab && styles.tabActive, pressed && styles.pressed]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </Pressable>
        ))}
      </View>

      <Animated.View style={{ opacity: tabProgress }}>
        {activeTab === "Overview" ? (
          <OverviewSection
            about={about}
            aboutExpanded={aboutExpanded}
            onToggleAbout={() => setAboutExpanded((value) => !value)}
            campaigns={publicCampaigns.slice(0, 3)}
            onOpenCampaign={onOpenCampaign}
            styles={styles}
            theme={theme}
            onViewCampaigns={publicCampaigns.length ? () => switchTab("Campaigns") : undefined}
          />
        ) : activeTab === "Campaigns" ? (
          <CampaignsSection campaigns={publicCampaigns} onOpenCampaign={onOpenCampaign} styles={styles} theme={theme} />
        ) : activeTab === "About" ? (
          <AboutSection brief={brief} about={about} styles={styles} theme={theme} />
        ) : (
          <ReviewsSection reviews={reviews} rating={rating} styles={styles} theme={theme} />
        )}
      </Animated.View>
    </ScrollView>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function OverviewSection({
  about,
  aboutExpanded,
  onToggleAbout,
  campaigns,
  onOpenCampaign,
  onViewCampaigns,
  styles,
  theme,
}: {
  about: string;
  aboutExpanded: boolean;
  onToggleAbout: () => void;
  campaigns: Campaign[];
  onOpenCampaign?: (campaign: Campaign) => void;
  onViewCampaigns?: () => void;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
}) {
  return (
    <View style={styles.sectionStack}>
      <ProfileSection title="About this brand" styles={styles}>
        <Text style={styles.body}>{aboutExpanded || about.length <= 220 ? about : `${about.slice(0, 220)}…`}</Text>
        {about.length > 220 ? <Pressable accessibilityRole="button" onPress={onToggleAbout}><Text style={styles.readMore}>{aboutExpanded ? "Show less" : "Read more"}</Text></Pressable> : null}
      </ProfileSection>
      <ProfileSection title="Collaboration snapshot" styles={styles}>
        <View style={styles.infoRow}><AppIcon name="location-outline" size={17} color={theme.colors.primary} /><Text style={styles.body}>Campaign location: {campaigns[0]?.city ?? "Flexible"}</Text></View>
        <View style={styles.infoRow}><AppIcon name="pricetag-outline" size={17} color={theme.colors.primary} /><Text style={styles.body}>Typical brief: {campaigns[0]?.budget ?? "Discussed per campaign"}</Text></View>
        {campaigns[0]?.deliverables ? <View style={styles.infoRow}><AppIcon name="checkmark-circle-outline" size={17} color={theme.colors.primary} /><Text style={styles.body}>{campaigns[0].deliverables}</Text></View> : null}
      </ProfileSection>
      {campaigns.length ? (
        <ProfileSection title="Campaigns" action={onViewCampaigns ? "View all" : undefined} onAction={onViewCampaigns} styles={styles}>
          <CampaignsSection campaigns={campaigns} onOpenCampaign={onOpenCampaign} styles={styles} theme={theme} />
        </ProfileSection>
      ) : null}
    </View>
  );
}

function AboutSection({ brief, about, styles, theme }: { brief: BrandBrief; about: string; styles: ReturnType<typeof makeStyles>; theme: AppTheme }) {
  return (
    <View style={styles.sectionStack}>
      <ProfileSection title="About this brand" styles={styles}><Text style={styles.body}>{about}</Text></ProfileSection>
      <ProfileSection title="Brand information" styles={styles}>
        <InfoLine label="Industry" value={brief.category} styles={styles} />
        <InfoLine label="Location" value={brief.city} styles={styles} />
        {brief.brandWebsite ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(brief.brandWebsite!).catch(() => undefined)} style={styles.infoLine}><Text style={styles.infoLabel}>Website</Text><Text style={styles.linkValue}>{brief.brandWebsite}</Text></Pressable> : null}
      </ProfileSection>
      {brief.publicDetails.length ? <ProfileSection title="Collaboration information" styles={styles}>{brief.publicDetails.map((detail) => <View key={detail} style={styles.infoRow}><AppIcon name="checkmark-circle-outline" size={17} color={theme.colors.primary} /><Text style={styles.body}>{detail}</Text></View>)}</ProfileSection> : null}
    </View>
  );
}

function CampaignsSection({ campaigns, onOpenCampaign, styles, theme }: { campaigns: Campaign[]; onOpenCampaign?: (campaign: Campaign) => void; styles: ReturnType<typeof makeStyles>; theme: AppTheme }) {
  return campaigns.length ? (
    <View style={styles.sectionStack}>
      {campaigns.map((campaign) => (
        <AppCard key={campaign.id} onPress={onOpenCampaign ? () => onOpenCampaign(campaign) : undefined} style={styles.campaignCard}>
          <View style={styles.campaignHeader}>
            <View style={styles.flex}>
              <Text style={styles.campaignTitle}>{campaign.title}</Text>
              <Text style={styles.meta}>{campaign.category} · {campaign.city}</Text>
            </View>
            <Pill label={getCampaignStatusLabel(campaign.status)} accent={isPublishedCampaign(campaign)} />
          </View>
          <Text style={styles.body}>{campaign.description}</Text>
          <View style={styles.campaignFacts}>
            <InfoLine label="Budget" value={campaign.budget} styles={styles} />
            <InfoLine label="Deadline" value={formatCampaignDeadline(campaign.deadlineAt ?? campaign.deadline)} styles={styles} />
          </View>
          {campaign.platforms?.length ? <View style={styles.pillRow}>{campaign.platforms.map((platform) => <Pill key={platform} label={platform} />)}</View> : null}
          {onOpenCampaign ? <View style={styles.openHintRow}><Text style={styles.openHint}>Open campaign details</Text><AppIcon name="arrow-forward" size={14} color={theme.colors.primary} /></View> : null}
        </AppCard>
      ))}
    </View>
  ) : <AppCard><Text style={styles.body}>No public campaigns are available yet.</Text></AppCard>;
}

function ReviewsSection({ reviews, rating, styles, theme }: { reviews: BrandProfileReview[]; rating: number; styles: ReturnType<typeof makeStyles>; theme: AppTheme }) {
  return (
    <View style={styles.sectionStack}>
      <ProfileSection title="Reviews" styles={styles}>
        <View style={styles.reviewSummary}><AppIcon name="star" size={22} color={theme.colors.accentText} /><Text style={styles.reviewRating}>{rating ? rating.toFixed(1) : "New"}</Text><Text style={styles.body}>from {reviews.length} review{reviews.length === 1 ? "" : "s"}</Text></View>
      </ProfileSection>
      {reviews.map((review) => <BrandReviewCard key={review.id} review={review} styles={styles} />)}
    </View>
  );
}

function BrandReviewCard({ review, styles }: { review: BrandProfileReview; styles: ReturnType<typeof makeStyles> }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = review.text.length > 180;
  return (
    <AppCard flat style={styles.reviewCard}>
      <View style={styles.reviewHeader}><View style={styles.flex}><Text style={styles.cardTitle}>{review.creatorName}</Text><Text style={styles.meta}>{formatDisplayDateTime(review.date)}</Text></View><Pill label={`${review.rating}/5`} accent /></View>
      <Text style={styles.body}>{isLong && !expanded ? `${review.text.slice(0, 180)}…` : review.text}</Text>
      {isLong ? <Pressable accessibilityRole="button" onPress={() => setExpanded((value) => !value)}><Text style={styles.readMore}>{expanded ? "Show less" : "Read more"}</Text></Pressable> : null}
      {review.tags?.length ? <View style={styles.pillRow}>{review.tags.map((tag) => <Pill key={tag} label={tag} />)}</View> : null}
    </AppCard>
  );
}

function ProfileSection({ title, action, onAction, children, styles }: { title: string; action?: string; onAction?: () => void; children: ReactNode; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action && onAction ? <Pressable accessibilityRole="button" onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>
      {children}
    </View>
  );
}

function InfoLine({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) {
  return <View style={styles.infoLine}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value || "Not specified"}</Text></View>;
}

const makeStyles = (theme: AppTheme) => createThemeStyles(theme, {
  screen: { flex: 1, backgroundColor: theme.colors.transparent },
  page: { backgroundColor: theme.colors.transparent, padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl + theme.spacing.xl, gap: theme.spacing.lg },
  topbar: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  back: { minHeight: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: theme.spacing.xs },
  backText: { color: theme.colors.primary, fontSize: theme.type.body, fontWeight: "800", fontFamily: theme.type.bodyFont },
  profileCard: { gap: theme.spacing.lg, backgroundColor: theme.colors.surfaceRaised },
  profileHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  profileCopy: { flex: 1, minWidth: 0, gap: theme.spacing.xs },
  flex: { flex: 1, minWidth: 0 },
  name: { color: theme.colors.textPrimary, fontSize: theme.type.display, lineHeight: theme.type.display + 4, fontWeight: "900", fontFamily: theme.type.displayFont, flexShrink: 1 },
  meta: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont, flexShrink: 1 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, flexWrap: "wrap" },
  rating: { color: theme.colors.textPrimary, fontSize: theme.type.body, fontWeight: "800", fontFamily: theme.type.bodyFont },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  stat: { flex: 1, minWidth: 88, gap: theme.spacing.xs },
  statValue: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, fontWeight: "900", fontFamily: theme.type.bodyFont, flexShrink: 1 },
  statLabel: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs, borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingBottom: theme.spacing.xs },
  tab: { minHeight: 40, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.radius.md, justifyContent: "center" },
  tabActive: { backgroundColor: theme.colors.surfaceLilac },
  tabText: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
  tabTextActive: { color: theme.colors.primary },
  pressed: { opacity: 0.78 },
  sectionStack: { gap: theme.spacing.lg },
  section: { gap: theme.spacing.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.displayFont, flexShrink: 1 },
  sectionAction: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
  body: { color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont, flexShrink: 1 },
  readMore: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  infoLine: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: theme.spacing.md },
  infoLabel: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontWeight: "700", fontFamily: theme.type.bodyFont },
  infoValue: { color: theme.colors.textPrimary, fontSize: theme.type.body, fontWeight: "800", fontFamily: theme.type.bodyFont, flex: 1, minWidth: 0, textAlign: "right" },
  linkValue: { color: theme.colors.primary, fontSize: theme.type.body, fontFamily: theme.type.bodyFont, flex: 1, minWidth: 0, textAlign: "right" },
  campaignCard: { gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceRaised },
  campaignHeader: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  campaignTitle: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, lineHeight: theme.type.lineHeight.bodyLarge, fontWeight: "900", fontFamily: theme.type.bodyFont, flexShrink: 1 },
  campaignFacts: { gap: theme.spacing.xs },
  openHintRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  openHint: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
  reviewSummary: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: theme.spacing.xs },
  reviewRating: { color: theme.colors.textPrimary, fontSize: theme.type.display, fontWeight: "900", fontFamily: theme.type.bodyFont },
  reviewCard: { gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceRaised },
  reviewHeader: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  cardTitle: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, lineHeight: theme.type.lineHeight.bodyLarge, fontWeight: "800", fontFamily: theme.type.bodyFont, flexShrink: 1 },
});
