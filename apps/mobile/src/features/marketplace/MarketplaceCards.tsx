import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";
import { Animated, ImageStyle, Pressable, ScrollView, StyleProp, Text, View, ViewStyle } from "react-native";
import { Image as ExpoImage } from "expo-image";
import {
  AppButton,
  AppCard,
  AppIcon,
  Avatar,
  NATIVE_ANIMATIONS_ENABLED,
  MarketplaceCardSkeleton,
  OverflowMenu,
  Pill,
} from "../../components/ui";
import { useTheme } from "../../providers/ThemeProvider";
import type { Campaign, Influencer } from "../../types/marketplace";
import {
  type AppIconName,
  type CampaignFeedItem,
} from "./marketplaceDomain";
import { getCampaignStatusLabel } from "../../lib/marketplace";
import { formatCampaignDeadline } from "../../lib/dateTime";
import { makeStyles } from "./marketplaceStyles";

export function InfluencerCard({
  item,
  compact = false,
  saved,
  onSave,
  compared,
  onToggleCompare,
  onPress,
}: {
  item: Influencer;
  compact?: boolean;
  saved?: boolean;
  onSave?: () => void;
  compared?: boolean;
  onToggleCompare?: () => void;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const creatorTone = [styles.creatorToneSky, styles.creatorToneMint, styles.creatorToneBlush, styles.creatorToneButter][item.id.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % 4];
  const actions = (
    <View style={styles.creatorListActions}>
      {onSave ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? `Remove ${item.name} from saved` : `Save ${item.name}`}
          onPress={(event) => {
            event.stopPropagation();
            onSave();
          }}
          style={compact ? styles.save : styles.creatorListSave}
        >
          <AppIcon name={saved ? "heart" : "heart-outline"} size={20} color={theme.colors.primary} />
        </Pressable>
      ) : null}
      {onToggleCompare ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={compared ? `Remove ${item.name} from comparison` : `Add ${item.name} to comparison`}
          onPress={(event) => {
            event.stopPropagation();
            onToggleCompare();
          }}
          style={[compact ? styles.compareButton : styles.creatorListCompare, compared && styles.compareButtonActive]}
        >
          <AppIcon name={compared ? "checkmark" : "add"} size={18} color={theme.colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
  if (!compact) {
    return (
      <AppCard onPress={onPress} style={[styles.creatorListCard, creatorTone]}>
        <View style={styles.creatorListHeader}>
          <Avatar initials={item.initials} uri={item.avatarUrl} size="normal" />
          <View style={styles.creatorListCopy}>
            <Text style={styles.creatorName}>{item.name}</Text>
            <Text style={styles.creatorMeta}>{item.niche}</Text>
            <View style={styles.creatorListLocation}>
              <AppIcon name="location-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={styles.creatorMeta}>{item.city}{item.state && item.state !== item.city ? ` · ${item.state}` : ""}</Text>
            </View>
          </View>
          {actions}
        </View>
        <View style={styles.creatorListMetrics}>
          <View style={styles.creatorListMetric}>
            <Text style={styles.creatorListMetricValue}>{item.followers}</Text>
            <Text style={styles.creatorListMetricLabel}>Followers</Text>
          </View>
          <View style={styles.creatorListMetric}>
            <View style={styles.creatorListRatingValue}>
              <AppIcon name="star" size={14} color={theme.colors.accentText} />
              <Text style={styles.creatorListMetricValue}>{item.rating}</Text>
            </View>
            <Text style={styles.creatorListMetricLabel}>{item.reviews} reviews</Text>
          </View>
          {item.engagementRate ? (
            <View style={styles.creatorListMetric}>
              <Text style={styles.creatorListMetricValue}>{item.engagementRate}</Text>
              <Text style={styles.creatorListMetricLabel}>Engagement</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.creatorListFooter}>
          <View style={styles.creatorListPlatforms}>
            <View style={styles.pillRow}>
            {item.platforms.map((platform) => <Pill key={platform} label={platform} />)}
            </View>
          </View>
          <Text style={styles.price}>{item.price}</Text>
        </View>
      </AppCard>
    );
  }
  return (
    <AppCard
      onPress={onPress}
      style={[compact ? styles.creatorCompact : styles.creatorCard, creatorTone]}
    >
      <View style={styles.cardTop}>
        <Avatar initials={item.initials} uri={item.avatarUrl} />
        {actions}
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
      {item.engagementRate ? <Text style={styles.creatorMeta}>Engagement {item.engagementRate}</Text> : null}
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

export function CampaignCard({
  item,
  compact = false,
  width,
  onPress,
  moreActions,
}: {
  item: Campaign;
  compact?: boolean;
  width?: number;
  onPress?: () => void;
  moreActions?: Array<{ label: string; onPress: () => void; destructive?: boolean; icon?: ComponentProps<typeof AppIcon>["name"] }>;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const campaignToneStyles = [
    styles.campaignCardSky,
    styles.campaignCardMint,
    styles.campaignCardButter,
    styles.campaignCardBlush,
  ] as const;
  const tone = getCampaignTone(item.id);
  const cover = item.media?.find((media) => media.type === "image" && media.uri);
  const imageCount = item.media?.filter((media) => media.type === "image" && media.uri).length ?? 0;
  return (
    <AppCard
      onPress={onPress}
      style={[
        styles.campaignCard,
        campaignToneStyles[tone],
        cover?.uri && styles.campaignCardWithCover,
        compact && (cover?.uri ? styles.campaignRailCardWithCover : styles.campaignRailCard),
        compact && width ? { width } : null,
      ]}
    >
      {cover?.uri ? <View style={styles.campaignCoverWrap}>
        <ExpoImage source={{ uri: cover.uri }} contentFit="cover" style={[styles.campaignCover as ImageStyle, compact && { height: 104 }]} accessibilityLabel={`${item.title} campaign banner`} />
        {imageCount > 1 ? <View style={styles.campaignImageCount}><AppIcon name="images-outline" size={13} color={theme.colors.textPrimary} /><Text style={styles.campaignImageCountText}>{imageCount}</Text></View> : null}
      </View> : null}
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
          <View style={styles.campaignStatusActions}>
          {item.matchScore !== undefined ? <Pill style={styles.campaignStatusPill} label={`${item.matchScore}% match`} accent /> : null}
          <Pill style={styles.campaignStatusPill} label={item.visibility === "private" ? "Private" : getCampaignStatusLabel(item.status)} accent={item.visibility !== "private" && (item.status === "Open" || item.status === "Published")} />
          {moreActions?.length ? <OverflowMenu label={`More actions for ${item.title}`} actions={moreActions} /> : null}
        </View>
      </View>
      <Text numberOfLines={2} style={styles.campaignTitle}>
        {item.title}
      </Text>
      <Text numberOfLines={2} style={styles.campaignDescription}>
        {item.description}
      </Text>
      {item.applicationCount !== undefined ? <View style={styles.campaignAppliedRow}>
        <AppIcon name="people-outline" size={15} color={theme.colors.textSecondary} />
        <Text style={styles.creatorMeta}>{item.applicationCount} {item.applicationCount === 1 ? "creator applied" : "creators applied"}</Text>
        {item.applicationLimit ? <Text style={styles.creatorMeta}>· {item.applicationCount}/{item.applicationLimit}</Text> : null}
      </View> : null}
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
        <View style={styles.campaignDeadline}>
          <Text style={styles.deadlineLabel}>Deadline</Text>
          <Text numberOfLines={2} style={styles.deadline}>
            {formatCampaignDeadline(item.deadlineAt ?? item.deadline)}
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

function getCampaignTone(id: string): 0 | 1 | 2 | 3 {
  const hash = Array.from(id).reduce((total, character) => total + character.charCodeAt(0), 0);
  return (hash % 4) as 0 | 1 | 2 | 3;
}

export function CampaignRail({
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
  const [activeIndex, setActiveIndex] = useState(0);
  const sideInset = theme.spacing.lg;
  const snapOffsets = campaigns.map(
    (_, index) => index * (width + theme.spacing.sm),
  );
  return (
    <View style={styles.campaignRailSection}>
      <View style={styles.campaignRailHeader}>
        <View style={styles.campaignRailTitleCopy}>
          <Text style={styles.campaignRailTitle}>{title}</Text>
          {title === "More opportunities" ? (
            <Text style={styles.campaignRailSubtitle}>
              Brands looking for creator collaborations and fresh budgets.
            </Text>
          ) : null}
        </View>
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
export function CampaignRailCard({
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
      useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
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
export function createCampaignFeed(campaigns: Campaign[]): CampaignFeedItem[] {
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
export function CampaignEmptyState({
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

export function ClearFiltersButton({
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

export function NoResultsState({
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

export function Stat({ label, value, style, icon, centered = false }: { label: string; value: string; style?: StyleProp<ViewStyle>; icon?: ComponentProps<typeof AppIcon>["name"]; centered?: boolean }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const tone = label.length % 3 === 0 ? styles.statSky : label.length % 3 === 1 ? styles.statMint : styles.statBlush;
  return (
    <AppCard style={[styles.stat, tone, centered && styles.statCentered, style]}>
      {icon ? <View style={styles.statIconWrap}><AppIcon name={icon} size={17} color={theme.colors.primary} /></View> : null}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </AppCard>
  );
}
export function MenuItem({
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
export function Fact({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}
export function MarketplaceSkeleton() {
  return (
    <View>
      {[1, 2, 3].map((item) => (
        <MarketplaceCardSkeleton key={item} />
      ))}
    </View>
  );
}
