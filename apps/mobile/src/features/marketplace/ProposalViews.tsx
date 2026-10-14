import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
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
  Avatar,
  ConfirmModal,
  IconButton,
  Pill,
  SearchField,
  SectionTitle,
} from "../../components/ui";
import {
  DeliveryScheduleCard,
  ProposalCard,
  ProposalMediaGallery,
} from "../../components/marketplace";
import { useTheme } from "../../providers/ThemeProvider";
import type { DemoProposal, ProposalStatus } from "../../types/marketplace";
import { formatDisplayDateTime } from "../../lib/dateTime";
import {
  DEFAULT_PROPOSAL_FILTERS,
  getProposalAppliedFilterCount,
  toggleValue,
  type ProposalFeedItem,
  type ProposalFilters,
  type ScrollHandler,
} from "./marketplaceDomain";
import { ClearFiltersButton, Fact, NoResultsState, Stat } from "./MarketplaceCards";
import { ProposalBack } from "./MarketplaceShared";
import { makeStyles } from "./marketplaceStyles";


export function ProposalView({
  role,
  proposals,
  onScroll,
  onProposal,
  onProposalStatus,
  onReminderPress,
  onChat,
}: {
  role: "Brand" | "Influencer";
  proposals: DemoProposal[];
  onScroll: ScrollHandler;
  onProposal: (proposal: DemoProposal) => void;
  onProposalStatus: (id: string, status: ProposalStatus) => void;
  onReminderPress: (proposal: DemoProposal) => void;
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
      onReminderPress={() => onReminderPress(proposal)}
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
        style={styles.viewport}
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
  const sideInset = theme.spacing.lg;
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

export function EmptyProposalState({
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

export function ProposalDetailView({
  role,
  proposal,
  onBack,
  onProposalStatus,
  onReminderPress,
  onChat,
}: {
  role: "Brand" | "Influencer";
  proposal: DemoProposal;
  onBack: () => void;
  onProposalStatus: (id: string, status: ProposalStatus) => void;
  onReminderPress: (proposal: DemoProposal) => void;
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
        style={styles.viewport}
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
        <Fact label="Updated" value={formatDisplayDateTime(proposal.updatedAt)} />
      </View>
      <AppCard>
        <Text style={styles.tipTitle}>Deliverables</Text>
        <Text style={styles.tipBody}>{proposal.deliverables}</Text>
      </AppCard>
      <DeliveryScheduleCard
        schedule={proposal.schedule}
        onReminderPress={() => onReminderPress(proposal)}
      />
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
