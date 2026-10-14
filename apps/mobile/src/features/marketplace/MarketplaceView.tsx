import { useMemo, useState } from "react";
import {
  Modal,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AppButton,
  AppCard,
  AppIcon,
  Avatar,
  OverflowMenu,
  Pill,
  SearchField,
} from "../../components/ui";
import { CreatorProfileCard } from "../../components/marketplace";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import { INDIA_STATES } from "../../lib/indiaLocations";
import { BrandPublicProfileView } from "./BrandPublicProfileView";
import { CampaignApplicationView } from "./CampaignApplicationView";
import {
  BrandBrief,
  Campaign,
  AuthoredReview,
  MarketFilters,
  MarketplaceApplication,
  PublicCreatorProfile,
} from "../../types/marketplace";
import { calculateCampaignMatchScore } from "../../lib/marketplace";

export type MarketplaceChatRequest = {
  application: MarketplaceApplication;
  messageMine: boolean;
};

type Props = {
  role: "Brand" | "Influencer";
  filters: MarketFilters;
  onChangeFilters: (filters: MarketFilters) => void;
  onOpenFilters: () => void;
  onClearFilters: () => void;
  filterCount: number;
  briefs: BrandBrief[];
  campaigns: Campaign[];
  authoredReviews?: AuthoredReview[];
  creators: PublicCreatorProfile[];
  applications: MarketplaceApplication[];
  currentCreator?: PublicCreatorProfile;
  blockedCampaignIds?: string[];
  onOpenCampaign?: (campaignId: string) => void;
  onSubmitApplication: (
    draft: Omit<MarketplaceApplication, "id" | "status" | "submittedAt" | "conversationId">,
  ) => Promise<{ application: MarketplaceApplication; conversationId: string }> | { application: MarketplaceApplication; conversationId: string };
  onOpenChat: (request: MarketplaceChatRequest) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  loading?: boolean;
};

const canApplyAgain = (application?: MarketplaceApplication) => application?.status === "Declined" && application.canReapply === true;
const categorySearchTerms: Record<string, string[]> = {
  Beauty: ["beauty", "skincare", "makeup", "wellness"], Fashion: ["fashion", "style", "lifestyle"], Food: ["food", "restaurant", "culinary"],
  Tech: ["tech", "device", "app", "gaming"], Fitness: ["fitness", "movement", "wellness"], Travel: ["travel", "city", "stay", "guide"],
  Gaming: ["gaming", "game", "tech"], Home: ["home", "interior", "routine", "lifestyle"], Family: ["family", "parent", "everyday"],
  Wellness: ["wellness", "mindful", "health", "self-care"], Education: ["education", "learning", "skills"], Pets: ["pet", "animal"],
};
const homeCategories = Object.keys(categorySearchTerms);
const compactNumber = (value: string) => {
  const match = value.match(/([\d.]+)\s*([KM]?)/i);
  return match ? Number(match[1]) * (match[2].toUpperCase() === "M" ? 1000000 : match[2].toUpperCase() === "K" ? 1000 : 1) : 0;
};
const withinRange = (value: number, range: MarketFilters["priceRange"]) =>
  (!range.min || value >= Number(range.min)) && (!range.max || value <= Number(range.max));
const locationMatches = (city: string, state: string | undefined, locations: MarketFilters["locations"]) =>
  !locations.length || locations.some((location) => location.city
    ? location.city.toLowerCase() === city.toLowerCase()
    : state?.toLowerCase() === location.state.toLowerCase() || INDIA_STATES.some((item) => item.state === location.state && item.cities.some((option) => option.name.toLowerCase() === city.toLowerCase())));

export function MarketplaceView({
  role,
  filters,
  onChangeFilters,
  onOpenFilters,
  onClearFilters,
  filterCount,
  briefs,
  campaigns,
  authoredReviews = [],
  creators,
  applications,
  currentCreator,
  blockedCampaignIds = [],
  onOpenCampaign,
  onSubmitApplication,
  onOpenChat,
  onScroll,
  loading = false,
}: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const clearFilters = () => { setQuery(""); onClearFilters(); };
  const [selectedBrief, setSelectedBrief] = useState<BrandBrief | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<BrandBrief | null>(null);
  const [selectedCreator, setSelectedCreator] = useState<PublicCreatorProfile | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const platforms = useMemo(() => [...new Set(briefs.flatMap((brief) => brief.preferredPlatforms))], [briefs]);
  const platformOptions: Array<"" | MarketFilters["platforms"][number]> = ["", ...platforms];
  const categoryMatches = (category: string, text: string) =>
    (categorySearchTerms[category] ?? [category.toLowerCase()]).some((term) => text.toLowerCase().includes(term));
  const displayBriefs = useMemo(() => briefs.map((brief) => ({
    ...brief,
    matchScore: calculateCampaignMatchScore(brief, currentCreator),
  })), [briefs, currentCreator]);
  const visibleBriefs = useMemo(() => {
    const search = query.trim().toLowerCase();
    return displayBriefs.filter((brief) => {
      if (!brief.active) return false;
      const text = `${brief.brandName} ${brief.title} ${brief.category} ${brief.city} ${brief.description} ${brief.deliverables} ${brief.preferredPlatforms.join(" ")}`;
      return (!search || text.toLowerCase().includes(search))
        && (!filters.categories.length || filters.categories.some((category) => categoryMatches(category, text)))
        && (!filters.platforms.length || filters.platforms.some((platform) => brief.preferredPlatforms.includes(platform)))
        && locationMatches(brief.city, undefined, filters.locations)
        && withinRange(compactNumber(brief.budget), filters.priceRange);
    });
  }, [displayBriefs, query, filters]);
  const getApplication = (brief: BrandBrief) => applications.find((application) =>
    application.creatorId === currentCreator?.id &&
    (application.campaignId ?? application.briefId) === (brief.campaignId ?? brief.id),
  );
  const closeBrief = () => {
    setSelectedBrief(null);
    setApplyOpen(false);
  };
  const openApply = (brief: BrandBrief) => {
    setSelectedBrief(brief);
    setApplyOpen(true);
  };

  if (selectedBrand) return <BrandPublicProfileView brief={selectedBrand} campaigns={campaigns} authoredReviews={authoredReviews} onOpenCampaign={onOpenCampaign ? (campaign) => { setSelectedBrand(null); onOpenCampaign(campaign.id); } : undefined} onBack={() => setSelectedBrand(null)} onScroll={onScroll} backLabel="Back to briefs" />;

  return (
    <>
      <ScrollView
        style={styles.screen}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={role === "Brand" ? "Search creators, niche or city" : "Search brands, briefs or city"}
          accessibilityLabel="Search marketplace"
          onFilter={onOpenFilters}
          filterActive={filterCount > 0}
        />
        <View style={styles.filterActions}><AppButton label={filterCount ? `Filters (${filterCount})` : "Filters"} icon="funnel-outline" variant="secondary" compact onPress={onOpenFilters} />{filterCount || query ? <AppButton label="Clear all" variant="secondary" compact onPress={clearFilters} /> : null}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {["", ...homeCategories].map((category) => (
            <Pressable key={category || "all-categories"} accessibilityRole="button" accessibilityLabel={category || "All categories"} accessibilityState={{ selected: category ? filters.categories.includes(category) : filters.categories.length === 0 }} onPress={() => onChangeFilters({ ...filters, categories: category ? [category] : [] })} style={({ pressed }) => [styles.filterChip, (category ? filters.categories.includes(category) : filters.categories.length === 0) && styles.filterChipActive, pressed && styles.pressed]}>
              <Text style={[styles.filterText, (category ? filters.categories.includes(category) : filters.categories.length === 0) && styles.filterTextActive]}>{category || "All categories"}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {platformOptions.map((platform) => (
            <Pressable key={platform || "all-platforms"} accessibilityRole="button" accessibilityLabel={platform || "All platforms"} accessibilityState={{ selected: platform ? filters.platforms.includes(platform) : filters.platforms.length === 0 }} onPress={() => onChangeFilters({ ...filters, platforms: platform ? [platform] : [] })} style={({ pressed }) => [styles.filterChip, (platform ? filters.platforms.includes(platform) : filters.platforms.length === 0) && styles.filterChipActive, pressed && styles.pressed]}>
              <Text style={[styles.filterText, (platform ? filters.platforms.includes(platform) : filters.platforms.length === 0) && styles.filterTextActive]}>{platform || "All platforms"}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {role === "Brand" ? (
          <>
            <SectionHeading title="Offers" subtitle={`${visibleBriefs.length} live offer${visibleBriefs.length === 1 ? "" : "s"}`} styles={styles} />
            {visibleBriefs.map((brief, index) => (
              <BriefCard key={brief.id} brief={brief} toneIndex={index} onPress={() => brief.campaignId && onOpenCampaign ? onOpenCampaign(brief.campaignId) : setSelectedBrief(brief)} styles={styles} theme={theme} />
            ))}
            {!visibleBriefs.length ? <AppCard style={styles.applicationCard}>{loading ? <View style={styles.loadingRow}><ActivityIndicator color={theme.colors.primary} /><Text style={styles.cardBody}>Loading offers…</Text></View> : <><Text style={styles.cardBody}>{briefs.some((brief) => brief.active) ? "No offers match these filters." : "New brand offers will appear here when available."}</Text>{filterCount || query ? <AppButton label="Clear filters" variant="secondary" onPress={clearFilters} /> : null}</>}</AppCard> : null}
          </>
        ) : (
          <>
            <SectionHeading title="Offers" subtitle={`${visibleBriefs.length} matching offer${visibleBriefs.length === 1 ? "" : "s"}`} styles={styles} />
            {visibleBriefs.map((brief, index) => {
              const existingApplication = getApplication(brief);
              const blocked = blockedCampaignIds.includes(brief.campaignId ?? brief.id) || existingApplication?.status === "Blocked";
              return <BriefCard key={brief.id} brief={brief} toneIndex={index} application={existingApplication} blocked={blocked} onPress={() => brief.campaignId && onOpenCampaign ? onOpenCampaign(brief.campaignId) : setSelectedBrief(brief)} styles={styles} theme={theme} />;
            })}
            {!visibleBriefs.length ? <AppCard style={styles.applicationCard}><Text style={styles.cardBody}>No offers match these filters.</Text><AppButton label="Clear filters" variant="secondary" onPress={clearFilters} /></AppCard> : null}
          </>
        )}
      </ScrollView>
      <Modal visible={Boolean(selectedBrief) && !applyOpen} transparent animationType="slide" onRequestClose={closeBrief}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeBrief} />
          {selectedBrief ? <BriefDetail brief={selectedBrief} application={getApplication(selectedBrief)} canApply={role === "Influencer" && !blockedCampaignIds.includes(selectedBrief.campaignId ?? selectedBrief.id) && getApplication(selectedBrief)?.status !== "Blocked"} onClose={closeBrief} onOpenBrand={() => { const brief = selectedBrief; closeBrief(); setSelectedBrand(brief); }} onApply={() => { const existing = getApplication(selectedBrief); if (existing && !canApplyAgain(existing)) onOpenChat({ application: existing, messageMine: true }); else setApplyOpen(true); }} styles={styles} theme={theme} bottomInset={insets.bottom} /> : null}
        </View>
      </Modal>
      <Modal visible={applyOpen} transparent animationType="slide" onRequestClose={closeBrief}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeBrief} />
          {selectedBrief && currentCreator ? (
            <CampaignApplicationView
              campaign={{
                id: selectedBrief.campaignId ?? selectedBrief.id,
                brandId: selectedBrief.brandId,
                brand: selectedBrief.brandName,
                brandInitials: selectedBrief.brandInitials,
                title: selectedBrief.title,
                description: selectedBrief.description,
                city: selectedBrief.city,
                category: selectedBrief.category,
                budget: selectedBrief.budget,
                deadline: selectedBrief.deadlineAt ?? "Flexible",
                deadlineAt: selectedBrief.deadlineAt,
                status: "Published",
                platforms: selectedBrief.preferredPlatforms,
                deliverables: selectedBrief.deliverables,
                requirements: selectedBrief.requirements.map((requirement) => requirement.label),
              }}
              brief={selectedBrief}
              currentCreator={currentCreator}
              modal
              onBack={closeBrief}
              onSubmitted={closeBrief}
              onSubmitApplication={onSubmitApplication}
            />
          ) : null}
        </View>
      </Modal>
      <Modal visible={Boolean(selectedCreator)} transparent animationType="slide" onRequestClose={() => setSelectedCreator(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedCreator(null)} />
          {selectedCreator ? <CreatorDetail creator={selectedCreator} onClose={() => setSelectedCreator(null)} styles={styles} theme={theme} bottomInset={insets.bottom} /> : null}
        </View>
      </Modal>
    </>
  );
}

function SectionHeading({ title, subtitle, styles }: { title: string; subtitle: string; styles: ReturnType<typeof makeStyles> }) {
  return <View style={styles.sectionHeading}><View style={styles.flex}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSubtitle}>{subtitle}</Text></View></View>;
}

function BriefCard({ brief, toneIndex = 0, application, blocked = false, onPress, styles, theme }: { brief: BrandBrief; toneIndex?: number; application?: MarketplaceApplication; blocked?: boolean; onPress: () => void; styles: ReturnType<typeof makeStyles>; theme: AppTheme }) {
  const tones = [styles.briefCardSky, styles.briefCardMint, styles.briefCardButter, styles.briefCardBlush] as const;
  return <AppCard style={[styles.briefCard, tones[toneIndex % tones.length]]}>
    <View style={styles.offerHeaderRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${brief.title}`} onPress={onPress} style={({ pressed }) => [styles.pressArea, styles.flex, pressed && styles.pressed]}>
        <View style={styles.row}><View style={styles.brandMark}><Text style={styles.brandMarkText}>{brief.brandInitials}</Text></View><View style={styles.flex}><Text style={styles.cardTitle}>{brief.brandName}</Text><Text style={styles.cardMeta}>{brief.city} · {brief.category}</Text></View>{brief.matchScore !== undefined ? <Pill label={`${brief.matchScore}% match`} accent /> : null}</View>
      </Pressable>
      <OverflowMenu label={`More actions for ${brief.brandName}`} actions={[{ label: "View offer details", icon: "eye-outline", onPress }]} />
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={`View offer ${brief.title}`} onPress={onPress} style={({ pressed }) => [styles.pressArea, pressed && styles.pressed]}>
      <Text style={styles.briefTitle}>{brief.title}</Text><Text numberOfLines={3} style={styles.cardBody}>{brief.description}</Text><View style={styles.tagRow}>{brief.preferredPlatforms.map((platform) => <Pill key={platform} label={platform} />)}<Pill label={brief.budget} /></View>
    </Pressable>
    <AppButton label={blocked ? "View details" : application ? "View status" : "View details"} icon="arrow-forward" variant="secondary" onPress={onPress} />
  </AppCard>;
}

function BriefDetail({ brief, application, canApply, onClose, onApply, onOpenBrand, styles, theme, bottomInset }: { brief: BrandBrief; application?: MarketplaceApplication; canApply: boolean; onClose: () => void; onApply: () => void; onOpenBrand: () => void; styles: ReturnType<typeof makeStyles>; theme: AppTheme; bottomInset: number }) {
  const applyAvailable = !application || canApplyAgain(application);
  return <View style={[styles.modalCard, { paddingBottom: Math.max(bottomInset, theme.spacing.lg) }]}>
    <View style={styles.modalHeader}><View style={styles.flex}><Text style={styles.modalTitle}>{brief.title}</Text><Text style={styles.sectionSubtitle}>{brief.city} · {brief.category}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close brief" onPress={onClose} style={styles.closeButton}><AppIcon name="close" size={20} color={theme.colors.textPrimary} /></Pressable></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.form}>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${brief.brandName} public profile and reviews`} onPress={onOpenBrand} style={styles.brandProfileLink}><Avatar initials={brief.brandInitials} uri={brief.brandLogoUrl} size="small" /><View style={styles.flex}><Text style={styles.cardTitle}>{brief.brandName}</Text><Text style={styles.cardMeta}>View public profile and reviews</Text></View><AppIcon name="chevron-forward" size={18} color={theme.colors.primary} /></Pressable>
      <Text style={styles.cardBody}>{brief.description}</Text>
      <View style={styles.tagRow}>{brief.matchScore !== undefined ? <Pill label={`${brief.matchScore}% match`} accent /> : null}<Pill label={brief.budget} />{brief.preferredPlatforms.map((platform) => <Pill key={platform} label={platform} />)}</View>
      <Text style={styles.fieldLabel}>About this brief</Text>
      <View style={styles.detailRow}><AppIcon name="location-outline" size={16} color={theme.colors.primary} /><Text style={styles.cardMeta}>{brief.city}</Text></View>
      <View style={styles.detailRow}><AppIcon name="videocam-outline" size={16} color={theme.colors.primary} /><Text style={styles.cardMeta}>{brief.deliverables}</Text></View>
      {brief.publicDetails.map((detail) => <View key={detail} style={styles.bulletRow}><AppIcon name="checkmark-circle-outline" size={16} color={theme.colors.primary} /><Text style={styles.cardBody}>{detail}</Text></View>)}
      <Text style={styles.fieldLabel}>Application requirements</Text>
      {brief.requirements.map((requirement) => <View key={requirement.id} style={styles.bulletRow}><AppIcon name={requirement.type === "file" ? "document-outline" : requirement.type === "url" ? "link-outline" : "create-outline"} size={16} color={theme.colors.primary} /><Text style={styles.cardBody}>{requirement.label}{requirement.required ? " · Required" : " · Optional"}</Text></View>)}
      {application ? <Pill label={application.status === "Pending" ? "Waiting for review" : application.status === "Declined" ? "Rejected" : application.status === "Blocked" ? "Unavailable" : "Accepted"} accent={application.status === "Accepted"} /> : null}
      {application?.status === "Declined" ? <Text style={styles.cardBody}>{application.rejectionReason}{application.canReapply ? " · You may apply again." : " · Another application is not available."}</Text> : null}
      {canApply ? <AppButton label={applyAvailable ? application ? "Apply again" : "Apply to this offer" : "Open application chat"} icon={applyAvailable ? "paper-plane-outline" : "chatbubble-ellipses-outline"} variant={applyAvailable ? "primary" : "secondary"} onPress={onApply} /> : null}
      <AppButton label="Close" variant="secondary" onPress={onClose} />
    </ScrollView>
  </View>;
}

function CreatorDetail({ creator, onClose, styles, theme, bottomInset }: { creator: PublicCreatorProfile; onClose: () => void; styles: ReturnType<typeof makeStyles>; theme: AppTheme; bottomInset: number }) {
  return <View style={[styles.modalCard, { paddingBottom: Math.max(bottomInset, theme.spacing.lg) }]}><View style={styles.modalHeader}><View style={styles.flex}><Text style={styles.modalTitle}>{creator.name}</Text><Text style={styles.sectionSubtitle}>{creator.niche} · {creator.city}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close creator profile" onPress={onClose} style={styles.closeButton}><AppIcon name="close" size={20} color={theme.colors.textPrimary} /></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.form}><CreatorProfileCard creator={creator} showBio showTags={false} />{creator.socialAccounts ? <View style={styles.tagRow}>{creator.platforms.map((platform) => { const url = creator.socialAccounts?.[platform]; return url ? <Pressable key={platform} accessibilityRole="link" accessibilityLabel={`Open ${platform} profile`} onPress={() => void Linking.openURL(url).catch(() => undefined)}><Pill label={`Open ${platform}`} /></Pressable> : <Pill key={platform} label={platform} />; })}</View> : null}{creator.contactEnabled && (creator.publicEmail || creator.publicPhone) ? <Text style={styles.cardMeta}>{[creator.publicEmail, creator.publicPhone].filter(Boolean).join(" · ")}</Text> : null}<Text style={styles.fieldLabel}>Public work history</Text>{(creator.workHistory ?? []).map((work) => <AppCard key={work.id} style={styles.historyCard}><View style={styles.row}><View style={styles.brandMark}><Text style={styles.brandMarkText}>{work.brandInitials}</Text></View><View style={styles.flex}><Text style={styles.cardTitle}>{work.brandName}</Text><Text style={styles.cardMeta}>{work.title} · {work.period}</Text></View></View><Text style={styles.cardBody}>{work.deliverables}</Text><Text style={styles.helperText}>{work.summary}</Text></AppCard>)}</ScrollView></View>;
}

const makeStyles = (theme: AppTheme) => createThemeStyles(theme, {
  screen: { flex: 1, backgroundColor: theme.colors.transparent },
  page: { backgroundColor: theme.colors.transparent, width: "100%", maxWidth: 640, alignSelf: "center", padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl + theme.spacing.xl, gap: theme.spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  sectionSubtitle: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont },
  filterActions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  filterRow: { flexDirection: "row", gap: theme.spacing.xs, paddingVertical: theme.spacing.xs },
  filterChip: { minHeight: 44, justifyContent: "center", paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border },
  filterChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterText: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontWeight: "700", fontFamily: theme.type.bodyFont },
  filterTextActive: { color: theme.colors.primaryText },
  briefCard: { gap: theme.spacing.md, backgroundColor: theme.colors.surfaceSky },
  briefCardSky: { backgroundColor: theme.colors.surfaceSky },
  briefCardMint: { backgroundColor: theme.colors.surfaceMint },
  briefCardButter: { backgroundColor: theme.colors.surfaceButter },
  briefCardBlush: { backgroundColor: theme.colors.surfaceBlush },
  offerHeaderRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  applicationCard: { gap: theme.spacing.sm },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  pressArea: { gap: theme.spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  brandMark: { width: 42, height: 42, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.accent },
  brandMarkText: { color: theme.colors.accentText, fontSize: theme.type.body, fontWeight: "900", fontFamily: theme.type.bodyFont },
  cardTitle: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, fontWeight: "800", fontFamily: theme.type.bodyFont },
  cardMeta: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
  cardBody: { color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont },
  briefTitle: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  detailRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  brandProfileLink: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, padding: theme.spacing.sm, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
  helperText: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.overlay },
  modalCard: { maxHeight: "92%", gap: theme.spacing.md, padding: theme.spacing.lg, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceRaised },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  modalTitle: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  closeButton: { width: 44, height: 44, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceMuted },
  form: { gap: theme.spacing.md, paddingBottom: theme.spacing.xl },
  publicInfoCard: { gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceSky },
  fieldGroup: { gap: theme.spacing.xs },
  fieldLabel: { color: theme.colors.textPrimary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
  input: { minHeight: 48, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, color: theme.colors.textPrimary, backgroundColor: theme.colors.inputBackground, fontSize: theme.type.body, fontFamily: theme.type.bodyFont },
  textarea: { minHeight: 84, paddingTop: theme.spacing.sm },
  attachmentRow: { flexDirection: "row", gap: theme.spacing.sm },
  modalActions: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  error: { color: theme.colors.danger, fontSize: theme.type.caption, fontWeight: "700", fontFamily: theme.type.bodyFont },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  historyCard: { gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceLilac },
  pressed: { opacity: 0.78 },
});
