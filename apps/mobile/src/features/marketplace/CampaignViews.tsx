import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AppButton,
  AppCard,
  AppIcon,
  IconButton,
  SearchField,
  SectionTitle,
} from "../../components/ui";
import { ProposalCard } from "../../components/marketplace";
import { useDemoMarketplace } from "../../hooks/useDemoMarketplace";
import { useTheme } from "../../providers/ThemeProvider";
import type { Campaign, DemoProposal } from "../../types/marketplace";
import { isPublishedCampaign, parseCampaignBudgetValue } from "../../lib/marketplace";
import {
  DEFAULT_CAMPAIGN_FILTERS,
  formatIncome,
  getAmount,
  getCampaignAppliedFilterCount,
  getCampaignFilterStatus,
  type CampaignFilters,
  toggleValue,
  type ScrollHandler,
} from "./marketplaceDomain";
import {
  CampaignCard,
  CampaignEmptyState,
  CampaignRail,
  ClearFiltersButton,
  createCampaignFeed,
  MarketplaceSkeleton,
  NoResultsState,
  Stat,
} from "./MarketplaceCards";
import { makeStyles } from "./marketplaceStyles";


export function CampaignsView({
  role,
  onScroll,
  onCampaign,
  onCreate,
  additionalCampaigns = [],
  privateCampaignIds = [],
  acceptedCampaignIds = [],
  proposals,
  onProposal,
  onReminderPress,
  onEditCampaign,
  onPublishCampaign,
  onArchiveCampaign,
  onChangeVisibility,
  currentBrandId,
  currentBrandName,
  loading = false,
}: {
  role: "Brand" | "Influencer";
  onScroll: ScrollHandler;
  onCampaign: (item: Campaign) => void;
  onCreate: () => void;
  additionalCampaigns?: Campaign[];
  privateCampaignIds?: string[];
  acceptedCampaignIds?: string[];
  proposals: DemoProposal[];
  onProposal: (proposal: DemoProposal) => void;
  onReminderPress: (proposal: DemoProposal) => void;
  onEditCampaign?: (campaign: Campaign) => void;
  onPublishCampaign?: (campaign: Campaign) => void;
  onArchiveCampaign?: (campaign: Campaign) => void;
  onChangeVisibility?: (campaign: Campaign, visibility: "public" | "private") => void;
  currentBrandId?: string;
  currentBrandName?: string;
  loading?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { width } = useWindowDimensions();
  const { campaigns: demoCampaigns, isLoading } = useDemoMarketplace();
  const campaignsLoading = isLoading || loading;
  const campaigns = useMemo(
    () => [...additionalCampaigns, ...demoCampaigns].filter((campaign) =>
      role !== "Brand" ||
      !currentBrandId ||
      campaign.brandId === currentBrandId ||
      campaign.brand === currentBrandName,
    ),
    [additionalCampaigns, currentBrandId, currentBrandName, demoCampaigns, role],
  );
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
      active: campaigns.filter((item) => item.status === "Open" || item.status === "Published").length,
      progress: campaigns.filter(
        (item) => item.status === "Proposal sent" || item.status === "Accepted",
      ).length,
      closed: campaigns.filter((item) => item.status === "Completed" || item.status === "Closed").length,
    }),
    [campaigns],
  );
  const totalCampaignValue = useMemo(
    () =>
      campaigns
        .filter((campaign) => campaign.status !== "Archived")
        .reduce((total, campaign) => total + parseCampaignBudgetValue(campaign.budget), 0),
    [campaigns],
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
        onReminderPress={onReminderPress}
        loading={campaignsLoading}
      />
    );
  }
  return (
    <>
      <FlatList
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={campaignsLoading ? [] : campaignFeed}
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
              moreActions={role === "Brand" ? [
                { label: "View campaign", icon: "eye-outline" as const, onPress: () => onCampaign(item.campaign) },
                { label: "Edit campaign", icon: "create-outline" as const, onPress: () => onEditCampaign?.(item.campaign) },
                ...(item.campaign.status === "Draft" ? [{ label: "Publish campaign", icon: "megaphone-outline" as const, onPress: () => onPublishCampaign?.(item.campaign) }] : []),
                ...(item.campaign.status !== "Draft" && item.campaign.status !== "Archived" && onChangeVisibility && (item.campaign.visibility === "private" || !acceptedCampaignIds.includes(item.campaign.id)) ? [{ label: item.campaign.visibility === "private" ? "Make public" : "Make private", icon: item.campaign.visibility === "private" ? "globe-outline" as const : "lock-closed-outline" as const, onPress: () => onChangeVisibility(item.campaign, item.campaign.visibility === "private" ? "public" : "private") }] : []),
                ...(item.campaign.status !== "Archived" ? [{ label: "Archive campaign", icon: "archive-outline" as const, destructive: true, onPress: () => onArchiveCampaign?.(item.campaign) }] : []),
              ] : undefined}
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
          <View style={styles.campaignStatsGrid}>
            <Stat label="Open" value={`${counts.active}`} icon="megaphone-outline" centered style={[styles.campaignStat, styles.campaignStatSky]} />
            <Stat label="In progress" value={`${counts.progress}`} icon="time-outline" centered style={[styles.campaignStat, styles.campaignStatMint]} />
            <Stat label="Closed" value={`${counts.closed}`} icon="checkmark-circle-outline" centered style={[styles.campaignStat, styles.campaignStatButter]} />
            <Stat label="Total value" value={formatIncome(totalCampaignValue)} icon="wallet-outline" centered style={[styles.campaignStat, styles.campaignStatLilac]} />
          </View>
          <View style={styles.campaignFilterHeader}>
            <View>
              <Text style={styles.campaignSectionTitle}>
                Your campaign flow
              </Text>
              <Text style={styles.resultText}>
                {campaignsLoading
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
          {campaignsLoading ? <MarketplaceSkeleton /> : null}
        </View>
        }
        ListEmptyComponent={
          campaignsLoading ? null : (
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
  onReminderPress,
  loading = false,
}: {
  onScroll: ScrollHandler;
  onCampaign: (item: Campaign) => void;
  additionalCampaigns: Campaign[];
  privateCampaignIds: string[];
  proposals: DemoProposal[];
  onProposal: (proposal: DemoProposal) => void;
  onReminderPress: (proposal: DemoProposal) => void;
  loading?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { campaigns: demoCampaigns, isLoading } = useDemoMarketplace();
  const campaignsLoading = isLoading || loading;
  const campaigns = useMemo(
    () => [...additionalCampaigns, ...demoCampaigns],
    [additionalCampaigns, demoCampaigns],
  );
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
  const publicBriefs = visibleCampaigns
    .filter(isPublishedCampaign)
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
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
  const totalIncome = activeCollaborations.reduce(
    (total, proposal) => total + getAmount(proposal.amount),
    0,
  );
  const renderApplication = (proposal: DemoProposal) => (
    <ProposalCard
      key={proposal.id}
      proposal={proposal}
      onViewDetails={() => onProposal(proposal)}
      onReminderPress={() => onReminderPress(proposal)}
    />
  );
  return (
    <>
      <ScrollView
        style={styles.viewport}
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
            {campaignsLoading
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
        <View style={styles.summaryRow}>
          <Stat label="Open briefs" value={`${publicBriefs.length}`} />
          <Stat label="Active collabs" value={`${activeCollaborations.length}`} />
          <Stat label="Total income" value={formatIncome(totalIncome)} />
        </View>
        <SectionTitle
          title="Public briefs"
          action={publicBriefs.length ? `${publicBriefs.length} open` : undefined}
        />
        {campaignsLoading ? (
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
