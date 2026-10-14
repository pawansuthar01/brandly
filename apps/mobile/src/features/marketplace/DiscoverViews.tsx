import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AppButton,
  AppCard,
  AppIcon,
  Avatar,
  FilterChip,
  IconButton,
  Pill,
  RangeSlider,
  SearchField,
  NATIVE_ANIMATIONS_ENABLED,
} from "../../components/ui";
import { LocationFilterSheet } from "../../components/marketplace";
import { useDemoMarketplace } from "../../hooks/useDemoMarketplace";
import { INDIA_STATES, type IndiaState } from "../../lib/indiaLocations";
import { isPublishedCampaign } from "../../lib/marketplace";
import { useTheme } from "../../providers/ThemeProvider";
import type { Campaign, CreatorContentType, Influencer, SocialPlatform } from "../../types/marketplace";
import { CreatorSpotlight } from "./HomeDashboard";
import {
  type DiscoverFilters,
  type FilterCategory,
  type LocationFilterOption,
  type ScrollHandler,
  DEFAULT_DISCOVER_FILTERS,
  CREATOR_CATEGORIES,
  DEMO_CREATOR_PROFILE_LOCATIONS,
  FILTER_CATEGORIES,
  SUPPORTED_CONTENT_TYPES,
  SUPPORTED_PLATFORMS,
  formatRangeLabel,
  getAppliedFilterCount,
  getFollowerCount,
  getStartingPrice,
  includesAny,
  isLocationFilterOption,
  isWithinRange,
  matchesLocationSelection,
  normaliseLocationSearch,
  normaliseRange,
  toggleValue,
} from "./marketplaceDomain";
import {
  CampaignCard,
  CampaignRail,
  ClearFiltersButton,
  createCampaignFeed,
  InfluencerCard,
  MarketplaceSkeleton,
  NoResultsState,
} from "./MarketplaceCards";
import { ProposalBack } from "./MarketplaceShared";
import { makeStyles } from "./marketplaceStyles";
function CreatorDiscoverView({
  savedLocations,
  onScroll,
  onCampaign,
  additionalCampaigns,
  privateCampaignIds,
  realCampaignsReady,
}: {
  savedLocations: string[];
  onScroll: ScrollHandler;
  onCampaign: (item: Campaign) => void;
  additionalCampaigns: Campaign[];
  privateCampaignIds: string[];
  realCampaignsReady: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { width } = useWindowDimensions();
  const { query, setQuery, isLoading } = useDemoMarketplace();
  const campaigns = useMemo(
    () => (realCampaignsReady ? additionalCampaigns : []),
    [additionalCampaigns, realCampaignsReady],
  );
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [isLocationFilterOpen, setIsLocationFilterOpen] = useState(false);
  const briefCardWidth = Math.min(
    322,
    Math.max(248, width - theme.spacing.lg * 2),
  );
  const visibleCampaigns = useMemo(
    () => campaigns.filter((campaign) => {
      const matchesQuery =
        `${campaign.brand} ${campaign.title} ${campaign.city} ${campaign.category}`
          .toLowerCase()
          .includes(query.toLowerCase());
      return (
        isPublishedCampaign(campaign) &&
        campaign.applicationsOpen !== false &&
        matchesQuery &&
        !privateCampaignIds.includes(campaign.id) &&
        (!selectedLocations.length ||
          selectedLocations.includes("Pan India") ||
          selectedLocations.includes(campaign.city) ||
          campaign.city === "Pan India")
      );
    }),
    [campaigns, privateCampaignIds, query, selectedLocations],
  );
  return (
    <ScrollView
      style={styles.viewport}
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

export function DiscoverView({
  role,
  savedLocations,
  onScroll,
  onInfluencer,
  onCampaign,
  additionalCampaigns = [],
  privateCampaignIds = [],
  realCampaignsReady = false,
  compareCreatorIds,
  onToggleCompare,
  onOpenCompare,
  backendCreators,
  backendAllCreators,
  backendQuery,
  onBackendQueryChange,
  backendSavedIds,
  onBackendSave,
  backendLoading,
  initialFilters,
}: {
  role: "Brand" | "Influencer";
  savedLocations: string[];
  onScroll: ScrollHandler;
  onInfluencer: (item: Influencer) => void;
  onCampaign: (item: Campaign) => void;
  additionalCampaigns?: Campaign[];
  privateCampaignIds?: string[];
  realCampaignsReady?: boolean;
  compareCreatorIds: string[];
  onToggleCompare: (creatorId: string) => void;
  onOpenCompare: () => void;
  backendCreators?: Influencer[];
  backendAllCreators?: Influencer[];
  backendQuery?: string;
  onBackendQueryChange?: (value: string) => void;
  backendSavedIds?: string[];
  onBackendSave?: (creatorId: string) => void;
  backendLoading?: boolean;
  initialFilters?: DiscoverFilters;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { influencers, allInfluencers, query, setQuery, savedIds, toggleSaved, isLoading } =
    useDemoMarketplace();
  const directoryUsesBackend = role === "Brand" && backendCreators !== undefined;
  const directoryInfluencers = directoryUsesBackend ? backendCreators : influencers;
  const directoryAllInfluencers = directoryUsesBackend ? (backendAllCreators ?? backendCreators) : allInfluencers;
  const directoryQuery = directoryUsesBackend ? (backendQuery ?? "") : query;
  const directorySetQuery = directoryUsesBackend ? (onBackendQueryChange ?? (() => undefined)) : setQuery;
  const directorySavedIds = directoryUsesBackend ? (backendSavedIds ?? []) : savedIds;
  const directoryToggleSaved = directoryUsesBackend ? (onBackendSave ?? (() => undefined)) : toggleSaved;
  const directoryLoading = directoryUsesBackend ? Boolean(backendLoading) : isLoading;
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<DiscoverFilters>(
    initialFilters ?? DEFAULT_DISCOVER_FILTERS,
  );
  const [viewMode, setViewMode] = useState<"swipe" | "list">("swipe");
  const viewTransition = useRef(new Animated.Value(1)).current;
  const creatorCardWidth = Math.min(
    360,
    Math.max(280, width - theme.spacing.lg * 2),
  );
  const creatorInset = theme.spacing.lg;
  useEffect(() => {
    if (initialFilters) setFilters(initialFilters);
  }, [initialFilters]);
  const filteredInfluencers = useMemo(
    () => directoryInfluencers.filter(
      (item) =>
        (filters.locations.length === 0 ||
          filters.locations.some(
            (location) => matchesLocationSelection(item, location),
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
    ),
    [directoryInfluencers, filters],
  );
  const appliedCount = getAppliedFilterCount(filters);
  const resetFilters = () => setFilters(DEFAULT_DISCOVER_FILTERS);
  const switchViewMode = (nextMode: "swipe" | "list") => {
    if (nextMode === viewMode) return;
    setViewMode(nextMode);
    viewTransition.setValue(0);
    Animated.timing(viewTransition, {
      toValue: 1,
      duration: 180,
      useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
    }).start();
  };
  if (role === "Influencer") {
    return (
      <CreatorDiscoverView
        savedLocations={savedLocations}
        onScroll={onScroll}
        onCampaign={onCampaign}
        additionalCampaigns={additionalCampaigns}
        privateCampaignIds={privateCampaignIds}
        realCampaignsReady={realCampaignsReady}
      />
    );
  }
  return (
    <>
      <ScrollView
        style={styles.viewport}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          compareCreatorIds.length ? { paddingBottom: theme.spacing.xxl + 120 } : null,
        ]}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.discoverHeading}>
          <View style={styles.flex}>
            <Text style={styles.pageIntro}>
              Search by audience, niche and location.
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
          value={directoryQuery}
          onChangeText={directorySetQuery}
          placeholder="Search creators, city or niche"
          onFilter={() => setIsFilterOpen(true)}
          filterActive={appliedCount > 0}
        />
        <View style={styles.resultsHeader}>
          <Text style={styles.resultText}>
            {directoryLoading
              ? "Finding creator matches…"
              : `${filteredInfluencers.length} creator profiles`}
          </Text>
          {appliedCount ? (
            <ClearFiltersButton onPress={resetFilters} />
          ) : null}
        </View>
        <View style={styles.discoverViewMode}>
          <Text style={styles.viewModeHint}>Browse creators</Text>
          <View style={styles.viewModeControl}>
            {([[
              "swipe",
              "Swipe",
              "swap-horizontal-outline",
            ], ["list", "List", "list-outline"]] as const).map(([value, label, icon]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`${label} creator view`}
                accessibilityState={{ selected: viewMode === value }}
                onPress={() => switchViewMode(value)}
                style={({ pressed }) => [
                  styles.viewModeButton,
                  viewMode === value && styles.viewModeButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <AppIcon name={icon} size={16} color={viewMode === value ? theme.colors.primary : theme.colors.textSecondary} />
                <Text style={[styles.viewModeLabel, viewMode === value && styles.viewModeLabelActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Animated.View style={{ opacity: viewTransition }}>
          {directoryLoading ? (
            <MarketplaceSkeleton />
          ) : filteredInfluencers.length === 0 ? (
            <NoResultsState
              onClear={
                directoryQuery.trim() || appliedCount
                  ? () => {
                      directorySetQuery("");
                      resetFilters();
                    }
                  : undefined
              }
              clearLabel={appliedCount ? "Clear all filters" : "Clear search"}
            />
          ) : (
            viewMode === "list" ? (
              <View style={styles.creatorList}>
                {filteredInfluencers.map((creator) => (
                  <InfluencerCard
                    key={creator.id}
                    item={creator}
                    saved={directorySavedIds.includes(creator.id)}
                    compared={compareCreatorIds.includes(creator.id)}
                    onSave={() => directoryToggleSaved(creator.id)}
                    onToggleCompare={() => onToggleCompare(creator.id)}
                    onPress={() => onInfluencer(creator)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.discoveryFeed}>
                <CreatorRail
                  title="Recommended creators"
                  creators={filteredInfluencers}
                  width={creatorCardWidth}
                  inset={creatorInset}
                  savedIds={directorySavedIds}
                  onSave={directoryToggleSaved}
                  onInfluencer={onInfluencer}
                  compareIds={compareCreatorIds}
                  onToggleCompare={onToggleCompare}
                />
                <MoreCreatorMatches
                  creators={filteredInfluencers.slice(1, 4)}
                  savedIds={directorySavedIds}
                  compareIds={compareCreatorIds}
                  onSave={directoryToggleSaved}
                  onToggleCompare={onToggleCompare}
                  onInfluencer={onInfluencer}
                />
              </View>
            )
          )}
        </Animated.View>
      </ScrollView>
      {compareCreatorIds.length ? (
        <CreatorComparisonBar
          creators={directoryAllInfluencers}
          selectedIds={compareCreatorIds}
          bottomInset={insets.bottom}
          onRemove={onToggleCompare}
          onCompare={onOpenCompare}
        />
      ) : null}
      <DiscoverFilterDrawer
        visible={isFilterOpen}
        value={filters}
        states={INDIA_STATES}
        onClose={() => setIsFilterOpen(false)}
        onApply={(nextFilters) => {
          setFilters(nextFilters);
          setIsFilterOpen(false);
        }}
      />
    </>
  );
}

export function DiscoverFilterDrawer({
  visible,
  value,
  states,
  target = "creators",
  onClose,
  onApply,
}: {
  visible: boolean;
  value: DiscoverFilters;
  states: IndiaState[];
  target?: "creators" | "briefs";
  onClose: () => void;
  onApply: (filters: DiscoverFilters) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
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
  const visibleLocationOptions = useMemo(() => {
    const searchTerm = normaliseLocationSearch(locationQuery);
    if (!searchTerm) {
      const popular = new Set(popularCities);
      const matches: LocationFilterOption[] = [];
      for (const item of states) {
        for (const city of item.cities) {
          if (!popular.has(city.name)) continue;
          matches.push({
            id: `city-${city.id}`,
            label: `${city.name} · ${city.district}, ${item.state}`,
            value: city.name,
            kind: "city",
            state: item.state,
            city: city.name,
            searchValue: normaliseLocationSearch(
              `${city.name} ${city.district} ${item.state}`,
            ),
          });
          if (matches.length === 8) return matches;
        }
      }
      return matches;
    }
    const matches: LocationFilterOption[] = [];
    for (const item of states) {
      const stateSearchValue = normaliseLocationSearch(item.state);
      if (stateSearchValue.includes(searchTerm)) {
        matches.push({
          id: `state-${item.state}`,
          label: item.state,
          value: item.state,
          kind: "state",
          state: item.state,
          city: null,
          searchValue: stateSearchValue,
        });
      }
      for (const city of item.cities) {
        const searchValue = normaliseLocationSearch(
          `${city.name} ${city.district} ${item.state}`,
        );
        if (!searchValue.includes(searchTerm)) continue;
        matches.push({
          id: `city-${city.id}`,
          label: `${city.name} · ${city.district}, ${item.state}`,
          value: city.name,
          kind: "city",
          state: item.state,
          city: city.name,
          searchValue,
        });
      }
    }
    return matches
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
  }, [locationQuery, states]);
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
            label: target === "briefs" ? "Brief budget range" : "Creator price range",
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
                <Text style={styles.sheetTitle}>{target === "briefs" ? "Filter briefs" : "Filter creators"}</Text>
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
                {FILTER_CATEGORIES.filter((item) => target === "creators" || !["audience", "contentType", "rating"].includes(item.key)).map((categoryItem) => {
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
                    placeholderTextColor={theme.colors.inputPlaceholder}
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

function CreatorRail({
  title,
  creators,
  width,
  inset,
  savedIds,
  onSave,
  onInfluencer,
  compareIds,
  onToggleCompare,
}: {
  title: string;
  creators: Influencer[];
  width: number;
  inset: number;
  savedIds: string[];
  onSave: (id: string) => void;
  onInfluencer: (item: Influencer) => void;
  compareIds: string[];
  onToggleCompare: (creatorId: string) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [activeIndex, setActiveIndex] = useState(0);
  const interval = width + theme.spacing.sm;
  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, creators.length - 1)));
  }, [creators.length]);
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
        nestedScrollEnabled
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
        {creators.map((item) => (
          <CreatorSpotlight
            key={item.id}
            item={item}
            width={width}
            saved={savedIds.includes(item.id)}
            onSave={() => onSave(item.id)}
            compared={compareIds.includes(item.id)}
            onToggleCompare={() => onToggleCompare(item.id)}
            onPress={() => onInfluencer(item)}
          />
        ))}
      </ScrollView>
      <View style={styles.discoveryProgress}>
        <Text style={styles.discoveryProgressText}>
          {activeIndex + 1} / {creators.length}
        </Text>
      </View>
    </View>
  );
}

function MoreCreatorMatches({
  creators,
  savedIds,
  compareIds,
  onSave,
  onToggleCompare,
  onInfluencer,
}: {
  creators: Influencer[];
  savedIds: string[];
  compareIds: string[];
  onSave: (creatorId: string) => void;
  onToggleCompare: (creatorId: string) => void;
  onInfluencer: (creator: Influencer) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  if (!creators.length) return null;
  return (
    <View style={styles.moreCreatorMatches}>
      <View style={styles.moreCreatorMatchesHeader}>
        <Text style={styles.moreCreatorMatchesTitle}>More creator matches</Text>
        <Text style={styles.moreCreatorMatchesHint}>Keep exploring</Text>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.moreCreatorMatchesRail}
      >
        {creators.map((creator) => (
          <InfluencerCard
            key={creator.id}
            compact
            item={creator}
            saved={savedIds.includes(creator.id)}
            compared={compareIds.includes(creator.id)}
            onSave={() => onSave(creator.id)}
            onToggleCompare={() => onToggleCompare(creator.id)}
            onPress={() => onInfluencer(creator)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function CreatorComparisonBar({
  creators,
  selectedIds,
  bottomInset,
  onRemove,
  onCompare,
}: {
  creators: Influencer[];
  selectedIds: string[];
  bottomInset: number;
  onRemove: (creatorId: string) => void;
  onCompare: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const selectedCreators = selectedIds
    .map((id) => creators.find((creator) => creator.id === id))
    .filter((creator): creator is Influencer => Boolean(creator));
  return (
    <View style={[styles.comparisonBar, { bottom: 56 + bottomInset + theme.spacing.sm }]}>
      <View style={styles.comparisonAvatars}>
        {selectedCreators.slice(0, 4).map((creator) => (
          <Pressable
            key={creator.id}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${creator.name} from comparison`}
            onPress={() => onRemove(creator.id)}
            style={styles.comparisonAvatar}
          >
            <Avatar initials={creator.initials} uri={creator.avatarUrl} size="small" />
            <View style={styles.comparisonAvatarRemove}>
              <AppIcon name="close" size={10} color={theme.colors.primaryText} />
            </View>
          </Pressable>
        ))}
      </View>
      <View style={styles.comparisonBarCopy}>
        <Text style={styles.comparisonBarTitle}>{selectedIds.length} selected</Text>
        <Text style={styles.comparisonBarHint}>Compare creators</Text>
      </View>
      <AppButton label="Compare now" compact onPress={onCompare} icon="swap-horizontal-outline" />
    </View>
  );
}

export function CompareCreatorsView({
  creators,
  selectedIds,
  onBack,
  onRemove,
  onOpenCreator,
}: {
  creators: Influencer[];
  selectedIds: string[];
  onBack: () => void;
  onRemove: (creatorId: string) => void;
  onOpenCreator: (creator: Influencer) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const selectedCreators = selectedIds
    .map((id) => creators.find((creator) => creator.id === id))
    .filter((creator): creator is Influencer => Boolean(creator));
  const comparisonRows: Array<{ label: string; value: (creator: Influencer) => string }> = [
    { label: "Name", value: (creator) => creator.name },
    { label: "Followers", value: (creator) => creator.followers },
    { label: "Rating", value: (creator) => creator.rating.toFixed(1) },
    { label: "Reviews", value: (creator) => String(creator.reviews) },
    { label: "Engagement", value: (creator) => creator.engagementRate ?? "—" },
    { label: "Starting price", value: (creator) => creator.price },
    { label: "Platforms", value: (creator) => creator.platforms.join(" · ") },
    { label: "Category", value: (creator) => creator.niche },
    { label: "Location", value: (creator) => `${creator.city}${creator.state && creator.state !== creator.city ? ` · ${creator.state}` : ""}` },
    { label: "Content", value: (creator) => creator.contentTypes.join(" · ") },
  ];
  const comparisonWidth = 112 + selectedCreators.length * 132;
  return (
    <ScrollView style={styles.viewport} contentContainerStyle={styles.compareScreen} showsVerticalScrollIndicator={false}>
      <ProposalBack onBack={onBack} />
      <Pill label="CREATOR SHORTLIST" accent />
      <Text style={styles.detailTitle}>Compare creators</Text>
      <Text style={styles.pageIntro}>Review the people you shortlisted before sending a campaign request.</Text>
      <Text style={styles.compareSelectionCount}>Compare creators ({selectedCreators.length})</Text>
      {selectedCreators.length === 0 ? (
        <AppCard>
          <Text style={styles.tipTitle}>No creators selected</Text>
          <Text style={styles.tipBody}>Return to Discover and add creators to compare their available profile details.</Text>
        </AppCard>
      ) : null}
      {selectedCreators.length ? (
        <AppCard style={styles.compareTableShell}>
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator contentContainerStyle={styles.compareTableScroll}>
            <View style={[styles.compareTable, { width: comparisonWidth }]}>
              <View style={styles.compareTableRow}>
                <View style={[styles.compareLabelCell, styles.compareHeaderCell]}>
                  <Text style={styles.compareRowLabel}>Creator</Text>
                </View>
                {selectedCreators.map((creator) => (
                  <View key={creator.id} style={[styles.compareValueCell, styles.compareHeaderCell, styles.compareCreatorCell]}>
                    <View style={styles.compareCreatorCellTop}>
                      <Avatar initials={creator.initials} uri={creator.avatarUrl} size="small" />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${creator.name} from comparison`}
                        onPress={() => onRemove(creator.id)}
                        hitSlop={10}
                        style={styles.compareRemoveButton}
                      >
                        <AppIcon name="close" size={14} color={theme.colors.primary} />
                      </Pressable>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${creator.name} profile`} onPress={() => onOpenCreator(creator)} hitSlop={8}>
                      <Text style={styles.compareTableCreatorName}>{creator.name}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${creator.name} profile`} onPress={() => onOpenCreator(creator)} hitSlop={8}>
                      <Text style={styles.compareProfileLink}>View profile</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
              {comparisonRows.map((row) => (
                <View key={row.label} style={styles.compareTableRow}>
                  <View style={styles.compareLabelCell}>
                    <Text style={styles.compareRowLabel}>{row.label}</Text>
                  </View>
                  {selectedCreators.map((creator) => (
                    <View key={`${creator.id}-${row.label}`} style={styles.compareValueCell}>
                      <Text style={styles.compareCellText}>{row.value(creator)}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </AppCard>
      ) : null}
    </ScrollView>
  );
}
