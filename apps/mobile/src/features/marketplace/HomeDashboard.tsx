import { useState } from "react";
import { Image as ExpoImage } from "expo-image";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  AppButton,
  AppCard,
  AppIcon,
  Avatar,
  MarketplaceCardSkeleton,
  Pill,
  SectionTitle,
} from "../../components/ui";
import { ProposalCard } from "../../components/marketplace";
import { useDemoMarketplace } from "../../hooks/useDemoMarketplace";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { HomePromo } from "../../services/demoMarketplace.service";
import { Campaign, DemoProposal, Influencer } from "../../types/marketplace";

const topCategories = [
  {
    label: "Beauty",
    note: "Skincare, makeup & wellness",
    icon: "sparkles-outline",
    size: "tall",
  },
  {
    label: "Fashion",
    note: "Style-led storytelling",
    icon: "shirt-outline",
    size: "regular",
  },
  {
    label: "Food",
    note: "Restaurants & product tastings",
    icon: "restaurant-outline",
    size: "regular",
  },
  {
    label: "Tech",
    note: "Apps, devices & reviews",
    icon: "phone-portrait-outline",
    size: "tall",
  },
  {
    label: "Fitness",
    note: "Movement & healthy living",
    icon: "barbell-outline",
    size: "regular",
  },
  {
    label: "Travel",
    note: "Hotels, stays & local guides",
    icon: "airplane-outline",
    size: "tall",
  },
  {
    label: "Gaming",
    note: "Live play & creator reviews",
    icon: "game-controller-outline",
    size: "regular",
  },
  {
    label: "Home",
    note: "Interiors, routines & living",
    icon: "home-outline",
    size: "regular",
  },
  {
    label: "Family",
    note: "Parenting & everyday life",
    icon: "heart-outline",
    size: "tall",
  },
] as const;

const homeActions = [
  {
    id: "discover",
    icon: "search-outline",
    title: "Refine your creator search",
    description: "Use audience, category and location to narrow every match.",
  },
  {
    id: "campaigns",
    icon: "briefcase-outline",
    title: "Keep a campaign moving",
    description: "Review active briefs and continue the conversation.",
  },
] as const;

type Props = {
  role: "Brand" | "Influencer";
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onDiscover: () => void;
  onInfluencer: (item: Influencer) => void;
  onCampaign: (item?: Campaign) => void;
  onChat: (name: string, initials: string) => void;
  proposals: DemoProposal[];
  onProposal: (proposal: DemoProposal) => void;
  onProfileEdit: () => void;
  additionalCampaigns?: Campaign[];
  privateCampaignIds?: string[];
};

export function HomeDashboard({
  role,
  onScroll,
  onDiscover,
  onInfluencer,
  onCampaign,
  onChat,
  proposals,
  onProposal,
  onProfileEdit,
  additionalCampaigns = [],
  privateCampaignIds = [],
}: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { influencers, campaigns: demoCampaigns, homePromos, isLoading } =
    useDemoMarketplace();
  const campaigns = [...additionalCampaigns, ...demoCampaigns];
  const rolePromos = homePromos.filter(
    (promo) => promo.audience === "Both" || promo.audience === role,
  );
  const { width } = useWindowDimensions();
  const promoWidth = Math.min(
    360,
    Math.max(240, width - theme.spacing.lg * 2),
  );
  const creatorCardWidth = Math.min(
    258,
    Math.max(224, Math.round(width * 0.68)),
  );
  const campaignCardWidth = Math.min(
    322,
    Math.max(248, Math.round(width * 0.8)),
  );
  const campaignCompactWidth = Math.min(
    300,
    Math.max(232, Math.round(width * 0.76)),
  );
  const promoInset = Math.max(0, (width - promoWidth) / 2);
  const creatorInset = Math.max(0, (width - creatorCardWidth) / 2);
  const campaignInset = Math.max(0, (width - campaignCardWidth) / 2);
  const compactCampaignInset = Math.max(0, (width - campaignCompactWidth) / 2);
  const [promoIndex, setPromoIndex] = useState(0);
  const openPromo = (action: "discover" | "campaigns") =>
    action === "discover" ? onDiscover() : onCampaign();
  if (role === "Influencer") {
    return (
      <CreatorHomeDashboard
        onScroll={onScroll}
        onDiscover={onDiscover}
        onCampaign={onCampaign}
        onChat={onChat}
        proposals={proposals}
        promos={rolePromos}
        onProposal={onProposal}
        onProfileEdit={onProfileEdit}
        additionalCampaigns={additionalCampaigns}
        privateCampaignIds={privateCampaignIds}
      />
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.page}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.promoSection}>
        <View style={styles.promoViewport}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            disableIntervalMomentum
            snapToOffsets={rolePromos.map(
              (_, index) => index * (promoWidth + theme.spacing.sm),
            )}
            snapToAlignment="start"
            contentContainerStyle={[
              styles.promoCarousel,
              { paddingHorizontal: promoInset },
            ]}
            onMomentumScrollEnd={(event) => {
              setPromoIndex(
                Math.min(
                  rolePromos.length - 1,
                  Math.max(
                    0,
                    Math.round(
                      event.nativeEvent.contentOffset.x /
                        (promoWidth + theme.spacing.sm),
                    ),
                  ),
                ),
              );
            }}
            scrollEventThrottle={16}
          >
            {rolePromos.map((promo) => (
              <DynamicPromoSlide
                key={promo.id}
                promo={promo}
                width={promoWidth}
                onPress={() => openPromo(promo.action)}
              />
            ))}
          </ScrollView>
        </View>
        <View
          accessibilityRole="adjustable"
          accessibilityValue={{
            min: 1,
            max: rolePromos.length,
            now: promoIndex + 1,
          }}
          style={styles.dots}
        >
          {rolePromos.map((promo, index) => (
            <PromoDot key={promo.id} active={index === promoIndex} />
          ))}
        </View>
      </View>

      <View style={styles.contentSection}>
        <HomeSectionHeading
          icon="people-outline"
          title="Creator picks"
          action="See all"
          onAction={onDiscover}
        />
        {isLoading ? (
          <View style={styles.skeletons}>
            {[1, 2].map((item) => (
              <MarketplaceCardSkeleton key={item} />
            ))}
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              disableIntervalMomentum
              snapToOffsets={influencers
                .slice(0, 4)
                .map(
                  (_, index) => index * (creatorCardWidth + theme.spacing.sm),
                )}
              snapToAlignment="start"
              contentContainerStyle={[
                styles.creatorCarousel,
                { paddingHorizontal: creatorInset },
              ]}
            >
              {influencers.slice(0, 4).map((item) => (
                <CreatorSpotlight
                  key={item.id}
                  item={item}
                  width={creatorCardWidth}
                  onPress={() => onInfluencer(item)}
                />
              ))}
            </ScrollView>
            <View style={styles.creatorList}>
              {influencers.slice(4).map((item) => (
                <CreatorListItem
                  key={item.id}
                  item={item}
                  onPress={() => onInfluencer(item)}
                />
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.contentSection}>
        <HomeSectionHeading
          icon="briefcase-outline"
          title="Your campaigns"
          action="Manage"
          onAction={onCampaign}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          disableIntervalMomentum
          snapToOffsets={campaigns
            .slice(0, 3)
            .map((_, index) => index * (campaignCardWidth + theme.spacing.sm))}
          snapToAlignment="start"
          contentContainerStyle={[
            styles.campaignRail,
            { paddingHorizontal: campaignInset },
          ]}
        >
          {campaigns.slice(0, 3).map((item) => (
            <CampaignQuickCard
              key={item.id}
              item={item}
              width={campaignCardWidth}
              onPress={() => onCampaign(item)}
            />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          disableIntervalMomentum
          snapToOffsets={campaigns
            .slice(3)
            .map(
              (_, index) => index * (campaignCompactWidth + theme.spacing.sm),
            )}
          snapToAlignment="start"
          contentContainerStyle={[
            styles.campaignCompactRail,
            { paddingHorizontal: compactCampaignInset },
          ]}
        >
          {campaigns.slice(3).map((item) => (
            <CampaignQuickCard
              key={item.id}
              item={item}
              width={campaignCompactWidth}
              onPress={() => onCampaign(item)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.contentSection}>
        <HomeSectionHeading icon="compass-outline" title="Keep moving" />
        <View style={styles.actionList}>
          {homeActions.map((item) => (
            <HomeAction
              key={item.id}
              item={item}
              role={role}
              onPress={item.id === "discover" ? onDiscover : onCampaign}
            />
          ))}
        </View>
      </View>

      <View style={styles.contentSection}>
        <HomeSectionHeading
          icon="grid-outline"
          title="Browse top categories"
          action="Explore"
          onAction={onDiscover}
        />
        <View style={styles.categoryMasonry}>
          <View style={styles.categoryColumn}>
            {topCategories
              .filter((_, index) => index % 2 === 0)
              .map((item) => (
                <CategoryTile
                  key={item.label}
                  item={item}
                  onPress={onDiscover}
                />
              ))}
          </View>
          <View style={styles.categoryColumn}>
            {topCategories
              .filter((_, index) => index % 2 !== 0)
              .map((item) => (
                <CategoryTile
                  key={item.label}
                  item={item}
                  onPress={onDiscover}
                />
              ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Explore more creator categories"
              onPress={onDiscover}
              style={({ pressed }) => [
                styles.moreCategory,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.moreCategoryIcon}>
                <AppIcon
                  name="grid-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <Text numberOfLines={1} style={styles.moreCategoryTitle}>
                More categories
              </Text>
              <Text numberOfLines={2} style={styles.moreCategoryDescription}>
                Find the right creator for every brief.
              </Text>
              <View style={styles.moreCategoryFooter}>
                <Text style={styles.moreCategoryLink}>Explore all</Text>
                <AppIcon
                  name="arrow-forward"
                  size={17}
                  color={theme.colors.primary}
                />
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function CreatorHomeDashboard({
  onScroll,
  onDiscover,
  onCampaign,
  onChat,
  proposals,
  promos,
  onProposal,
  onProfileEdit,
  additionalCampaigns,
  privateCampaignIds,
}: {
  onScroll: Props["onScroll"];
  onDiscover: () => void;
  onCampaign: (item?: Campaign) => void;
  onChat: (name: string, initials: string) => void;
  proposals: DemoProposal[];
  promos: HomePromo[];
  onProposal: (proposal: DemoProposal) => void;
  onProfileEdit: () => void;
  additionalCampaigns: Campaign[];
  privateCampaignIds: string[];
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { campaigns: demoCampaigns, isLoading } = useDemoMarketplace();
  const campaigns = [...additionalCampaigns, ...demoCampaigns];
  const openCampaigns = campaigns.filter(
    (campaign) =>
      campaign.status === "Open" && !privateCampaignIds.includes(campaign.id),
  );
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.page}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <RolePromoCarousel
        promos={promos}
        onDiscover={onDiscover}
        onCampaign={onCampaign}
      />
      <View style={styles.contentSection}>
        <HomeSectionHeading
          icon="briefcase-outline"
          title="Recommended briefs"
          action="View all"
          onAction={onDiscover}
        />
        {isLoading ? (
          <View style={styles.skeletons}>
            {[1, 2].map((item) => (
              <MarketplaceCardSkeleton key={item} />
            ))}
          </View>
        ) : (
          <RecommendedBriefRail
            campaigns={openCampaigns.slice(0, 4)}
            onPress={onCampaign}
          />
        )}
      </View>
      <View style={styles.contentSection}>
        <HomeSectionHeading
          icon="paper-plane-outline"
          title="Your proposal activity"
        />
        <View style={styles.proposalList}>
          {proposals.slice(0, 2).map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onViewDetails={() => onProposal(proposal)}
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
          ))}
        </View>
      </View>
      <View style={styles.contentSection}>
        <HomeSectionHeading icon="sparkles-outline" title="Creator readiness" />
        <AppCard onPress={onProfileEdit} style={styles.readinessCard}>
          <View style={styles.readinessIcon}>
            <AppIcon
              name="checkmark-circle-outline"
              size={22}
              color={theme.colors.primary}
            />
          </View>
          <View style={styles.homeActionCopy}>
            <Text style={styles.homeActionTitle}>Profile is 75% complete</Text>
            <Text style={styles.homeActionDescription}>
              Add your latest portfolio media, rates and preferred cities to
              improve matching.
            </Text>
          </View>
          <AppIcon
            name="chevron-forward"
            size={19}
            color={theme.colors.primary}
          />
        </AppCard>
      </View>
    </ScrollView>
  );
}

function RolePromoCarousel({
  promos,
  onDiscover,
  onCampaign,
}: {
  promos: HomePromo[];
  onDiscover: () => void;
  onCampaign: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(
    360,
    Math.max(240, width - theme.spacing.lg * 2),
  );
  const inset = Math.max(0, (width - cardWidth) / 2);
  const [activeIndex, setActiveIndex] = useState(0);
  if (!promos.length) return null;
  return (
    <View style={styles.promoSection}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        disableIntervalMomentum
        snapToOffsets={promos.map(
          (_, index) => index * (cardWidth + theme.spacing.sm),
        )}
        snapToAlignment="start"
        contentContainerStyle={[
          styles.promoCarousel,
          { paddingHorizontal: inset },
        ]}
        onMomentumScrollEnd={(event) =>
          setActiveIndex(
            Math.min(
              promos.length - 1,
              Math.max(
                0,
                Math.round(
                  event.nativeEvent.contentOffset.x /
                    (cardWidth + theme.spacing.sm),
                ),
              ),
            ),
          )
        }
      >
        {promos.map((promo) => (
          <DynamicPromoSlide
            key={promo.id}
            promo={promo}
            width={cardWidth}
            onPress={() =>
              promo.action === "discover" ? onDiscover() : onCampaign()
            }
          />
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {promos.map((promo, index) => (
          <PromoDot key={promo.id} active={index === activeIndex} />
        ))}
      </View>
    </View>
  );
}

function RecommendedBriefRail({
  campaigns,
  onPress,
}: {
  campaigns: Campaign[];
  onPress: (item?: Campaign) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(322, Math.max(248, screenWidth - theme.spacing.lg * 2));
  const inset = Math.max(0, (screenWidth - width) / 2);
  const [activeIndex, setActiveIndex] = useState(0);
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        disableIntervalMomentum
        snapToOffsets={campaigns.map(
          (_, index) => index * (width + theme.spacing.sm),
        )}
        snapToAlignment="start"
        contentContainerStyle={[
          styles.campaignRail,
          { paddingHorizontal: inset },
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
        {campaigns.map((campaign) => (
          <CampaignQuickCard
            key={campaign.id}
            item={campaign}
            width={width}
            onPress={() => onPress(campaign)}
          />
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {campaigns.map((campaign, index) => (
          <PromoDot key={campaign.id} active={index === activeIndex} />
        ))}
      </View>
    </View>
  );
}

export function CreatorSpotlight({
  item,
  width,
  saved,
  onSave,
  onPress,
}: {
  item: Influencer;
  width: number;
  saved?: boolean;
  onSave?: () => void;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={[styles.railItem, { width }]}> 
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${item.name}`}
        onPress={onPress}
        style={({ pressed }) => [styles.creatorCard, pressed && styles.pressed]}
      >
        <View style={styles.creatorPhotoFrame}>
          <Avatar initials={item.initials} uri={item.avatarUrl} size="large" />
          {saved !== undefined && onSave ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                saved
                  ? `Remove ${item.name} from saved creators`
                  : `Save ${item.name}`
              }
              onPress={onSave}
              style={styles.creatorSave}
            >
              <AppIcon
                name={saved ? "bookmark" : "bookmark-outline"}
                size={18}
                color={theme.colors.primary}
              />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.creatorCopy}>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.creatorName}
          >
            {item.name}
          </Text>
          <View style={styles.creatorLocation}>
            <AppIcon
              name="location-outline"
              size={13}
              color={theme.colors.textSecondary}
            />
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.creatorLocationText}
            >
              {item.state && item.state !== item.city
                ? `${item.city} · ${item.state}`
                : item.city}
            </Text>
          </View>
          <View style={styles.creatorNicheRow}>
            <AppIcon
              name="sparkles-outline"
              size={13}
              color={theme.colors.textSecondary}
            />
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.creatorNiche}
            >
              {item.niche}
            </Text>
          </View>
        </View>
        <View style={styles.creatorDetails}>
          <View style={styles.creatorStat}>
            <View style={styles.creatorMetricRow}>
              <AppIcon
                name="people-outline"
                size={14}
                color={theme.colors.textSecondary}
              />
              <Text numberOfLines={1} style={styles.creatorMetric}>
                {item.followers}
              </Text>
            </View>
            <Text style={styles.creatorMetricLabel}>Followers</Text>
          </View>
          <View style={styles.creatorStat}>
            <View style={styles.creatorRating}>
              <AppIcon name="star" size={14} color={theme.colors.primary} />
              <Text numberOfLines={1} style={styles.ratingText}>
                {item.rating}
              </Text>
            </View>
            <Text style={styles.creatorMetricLabel}>Rating</Text>
          </View>
        </View>
        <View style={styles.creatorFooter}>
          <View style={styles.creatorMetricRow}>
            <AppIcon
              name="cash-outline"
              size={16}
              color={theme.colors.primary}
            />
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.price}>
              {item.price}
            </Text>
          </View>
          <AppIcon
            name="arrow-forward"
            size={18}
            color={theme.colors.primary}
          />
        </View>
      </Pressable>
    </View>
  );
}

function HomeSectionHeading({
  icon,
  title,
  action,
  onAction,
}: {
  icon:
    | "people-outline"
    | "briefcase-outline"
    | "compass-outline"
    | "grid-outline"
    | "paper-plane-outline"
    | "sparkles-outline";
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingIcon}>
        <AppIcon name={icon} size={19} color={theme.colors.primary} />
      </View>
      <View style={styles.sectionHeadingCopy}>
        <SectionTitle title={title} action={action} onAction={onAction} />
      </View>
    </View>
  );
}

function CreatorListItem({
  item,
  onPress,
}: {
  item: Influencer;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${item.name}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.creatorListCard,
        pressed && styles.pressed,
      ]}
    >
      <Avatar initials={item.initials} uri={item.avatarUrl} size="small" />
      <View style={styles.creatorListCopy}>
        <Text numberOfLines={1} style={styles.creatorName}>
          {item.name}
        </Text>
        <Text numberOfLines={1} style={styles.creatorNiche}>
          {item.niche} · {item.city}
        </Text>
      </View>
      <View style={styles.creatorListMetric}>
        <View style={styles.creatorMetricRow}>
          <AppIcon
            name="people-outline"
            size={14}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.creatorMetric}>{item.followers}</Text>
        </View>
      </View>
      <AppIcon
        name="chevron-forward"
        size={20}
        color={theme.colors.textSecondary}
      />
    </Pressable>
  );
}

function CampaignQuickCard({
  item,
  width,
  onPress,
}: {
  item: Campaign;
  width: number;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={[styles.railItem, { width }]}> 
      <AppCard onPress={onPress} style={styles.campaignRailCard}>
        <View style={styles.campaignTop}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>{item.brand.slice(0, 1)}</Text>
          </View>
          <Text numberOfLines={1} style={styles.campaignBrand}>
            {item.brand}
          </Text>
        </View>
        <View style={styles.campaignTitleRow}>
          <AppIcon
            name="briefcase-outline"
            size={17}
            color={theme.colors.primary}
          />
          <Text
            numberOfLines={2}
            style={[styles.campaignTitle, styles.campaignTitleInRow]}
          >
            {item.title}
          </Text>
        </View>
        <Text numberOfLines={2} style={styles.campaignDescription}>
          {item.description}
        </Text>
        <View style={styles.campaignRailFooter}>
          <Pill label={item.status} accent={item.status === "Accepted"} />
          <Text style={styles.campaignBudget}>{item.budget}</Text>
        </View>
      </AppCard>
    </View>
  );
}

function CategoryTile({
  item,
  onPress,
}: {
  item: (typeof topCategories)[number];
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Browse ${item.label} creators`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.categoryTile,
        item.size === "tall" && styles.categoryTileTall,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.categoryHeader}>
        <View style={styles.categoryIcon}>
          <AppIcon name={item.icon} size={21} color={theme.colors.primary} />
        </View>
        <View style={styles.categoryArrow}>
          <AppIcon
            name="arrow-forward"
            size={16}
            color={theme.colors.primary}
          />
        </View>
      </View>
      <View style={styles.categoryCopy}>
        <Text numberOfLines={1} style={styles.categoryTitle}>
          {item.label}
        </Text>
        <Text numberOfLines={2} style={styles.categoryDescription}>
          {item.note}
        </Text>
      </View>
    </Pressable>
  );
}

function HomeAction({
  item,
  role,
  onPress,
}: {
  item: (typeof homeActions)[number];
  role: Props["role"];
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const label =
    item.id === "discover" && role === "Influencer"
      ? "Explore briefs"
      : item.title;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.homeAction, pressed && styles.pressed]}
    >
      <View style={styles.homeActionIcon}>
        <AppIcon name={item.icon} size={22} color={theme.colors.primary} />
      </View>
      <View style={styles.homeActionCopy}>
        <Text numberOfLines={1} style={styles.homeActionTitle}>
          {label}
        </Text>
        <Text numberOfLines={2} style={styles.homeActionDescription}>
          {item.description}
        </Text>
      </View>
      <AppIcon name="arrow-forward" size={19} color={theme.colors.primary} />
    </Pressable>
  );
}

function PromoDot({ active }: { active: boolean }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return <View
    style={[
      styles.dot,
      {
        width: active ? 18 : 6,
        backgroundColor: active ? theme.colors.primary : theme.colors.border,
      },
    ]}
  />;
}

function DynamicPromoSlide({
  promo,
  width,
  onPress,
}: {
  promo: ReturnType<typeof useDemoMarketplace>["homePromos"][number];
  width: number;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const contentText =
    promo.background === "primary"
      ? theme.colors.primaryText
      : theme.colors.textPrimary;
  const contentSecondary =
    promo.background === "primary"
      ? theme.colors.primaryText
      : theme.colors.textSecondary;
  const height = Math.max(178, Math.round(width * 0.59));
  const visual = promo.media ? <PromoImage uri={promo.media.uri} /> : null;
  if ((promo.layout === "image" || promo.layout === "imageOnly") && visual)
    return (
      <View>
        <View style={[styles.mediaOnlyCard, { width, height }]}>
          {visual}
          <View
            style={[
              styles.mediaCta,
              promo.cta?.position === "bottomRight"
                ? styles.mediaCtaRight
                : styles.mediaCtaLeft,
            ]}
          >
            <PromoCta cta={promo.cta} onPress={onPress} />
          </View>
        </View>
      </View>
    );
  if (promo.layout === "text")
    return (
      <View>
        <View
          style={[
            styles.promoCard,
            styles.textOnlyCard,
            { width, height, backgroundColor: theme.colors[promo.background] },
          ]}
        >
          <View style={styles.textOnlyContent}>
            <Text style={[styles.promoEyebrow, { color: contentSecondary }]}>
              {promo.eyebrow}
            </Text>
            <Text
              numberOfLines={2}
              style={[styles.promoTitle, { color: contentText }]}
            >
              {promo.title}
            </Text>
            <Text
              numberOfLines={2}
              style={[styles.promoDescription, { color: contentSecondary }]}
            >
              {promo.description}
            </Text>
          </View>
          <PromoCta cta={promo.cta} onPress={onPress} />
        </View>
      </View>
    );
  return (
    <View>
      <View
        style={[
          styles.promoCard,
          styles.promoSplit,
          { width, height, backgroundColor: theme.colors.surface },
        ]}
      >
        <View style={styles.splitMedia}>{visual}</View>
        <View style={styles.splitContent}>
          <Text style={styles.promoEyebrow}>{promo.eyebrow}</Text>
          <Text numberOfLines={2} style={styles.promoTitle}>
            {promo.title}
          </Text>
          <Text numberOfLines={2} style={styles.promoDescription}>
            {promo.description}
          </Text>
          <PromoCta cta={promo.cta} onPress={onPress} />
        </View>
      </View>
    </View>
  );
}

function PromoImage({ uri }: { uri: string }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [hasFailed, setHasFailed] = useState(false);
  if (hasFailed)
    return (
      <View style={styles.promoImageFallback}>
        <AppIcon
          name="image-outline"
          size={28}
          color={theme.colors.textSecondary}
        />
      </View>
    );
  return (
    <ExpoImage
      accessibilityLabel="Campaign promotion image"
      source={uri}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={160}
      style={styles.promoMedia}
      onError={() => setHasFailed(true)}
    />
  );
}

function PromoCta({
  cta,
  onPress,
}: {
  cta?: ReturnType<typeof useDemoMarketplace>["homePromos"][number]["cta"];
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  if (!cta) return null;
  const position =
    cta.position === "bottomRight" ? styles.ctaRight : styles.ctaLeft;
  if (cta.kind === "icon")
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open promotion"
        onPress={onPress}
        style={[styles.iconCta, position]}
      >
        <AppIcon
          name="arrow-forward"
          size={19}
          color={theme.colors.primaryText}
        />
      </Pressable>
    );
  if (cta.kind === "link")
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cta.label ?? "Open promotion"}
        onPress={onPress}
        style={[styles.linkCta, position]}
      >
        <Text style={styles.linkCtaText}>{cta.label}</Text>
        <AppIcon name="arrow-forward" size={16} color={theme.colors.primary} />
      </Pressable>
    );
  return (
    <View style={position}>
      <AppButton label={cta.label ?? "Open"} compact onPress={onPress} />
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    page: {
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xxl + theme.spacing.xl,
      gap: theme.spacing.xl,
    },
    promoSection: { gap: theme.spacing.xs },
    promoViewport: { backgroundColor: theme.colors.background },
    promoCarousel: {
      paddingLeft: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    promoCard: {
      overflow: "hidden",
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      justifyContent: "flex-end",
      gap: theme.spacing.xs,
    },
    textOnlyCard: { justifyContent: "space-between" },
    textOnlyContent: { gap: theme.spacing.xs },
    visualCard: { justifyContent: "flex-end" },
    mediaOnlyCard: {
      overflow: "hidden",
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surfaceMuted,
    },
    mediaCta: { position: "absolute", bottom: theme.spacing.md },
    mediaCtaLeft: { left: theme.spacing.md },
    mediaCtaRight: { right: theme.spacing.md },
    ctaLeft: { alignSelf: "flex-start" },
    ctaRight: { alignSelf: "flex-end" },
    iconCta: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },
    linkCta: {
      minHeight: 34,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    linkCtaText: {
      color: theme.colors.primary,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    promoMedia: { ...StyleSheet.absoluteFill },
    promoImageFallback: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    promoScrim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.colors.overlay,
    },
    promoIcon: {
      position: "absolute",
      top: theme.spacing.md,
      right: theme.spacing.md,
      width: 36,
      height: 36,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    promoIconVisual: { backgroundColor: theme.colors.overlay },
    promoEyebrow: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      letterSpacing: 0.7,
      fontWeight: "700",
      opacity: 0.86,
    },
    promoTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      lineHeight: 26,
      fontWeight: "700",
      letterSpacing: -0.1,
      maxWidth: "88%",
    },
    promoDescription: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: 16,
      opacity: 0.9,
      maxWidth: "92%",
    },
    promoTextLink: {
      minHeight: 40,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    promoTextLinkLabel: { fontSize: theme.type.body, fontWeight: "700" },
    promoSplit: {
      flexDirection: "row",
      padding: 0,
      justifyContent: "flex-start",
      gap: 0,
    },
    splitMedia: {
      width: "42%",
      height: "100%",
      overflow: "hidden",
      backgroundColor: theme.colors.surfaceMuted,
    },
    splitContent: {
      flex: 1,
      padding: theme.spacing.md,
      justifyContent: "flex-end",
      gap: theme.spacing.xs,
    },
    videoBadge: {
      position: "absolute",
      top: theme.spacing.lg,
      left: theme.spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      backgroundColor: theme.colors.overlay,
    },
    videoBadgeText: {
      color: theme.colors.primaryText,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.6,
    },
    dots: {
      flexDirection: "row",
      justifyContent: "center",
      gap: theme.spacing.xs,
      marginTop: -theme.spacing.xs,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.border,
    },
    dotActive: { width: 18, backgroundColor: theme.colors.primary },
    contentSection: { gap: theme.spacing.sm },
    proposalList: {
      marginHorizontal: theme.spacing.lg,
    },
    readinessCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      marginHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.surfaceMuted,
    },
    readinessIcon: {
      width: 42,
      height: 42,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    sectionHeading: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
    },
    sectionHeadingIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    sectionHeadingCopy: { flex: 1, minWidth: 0 },
    skeletons: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm },
    creatorCarousel: {
      paddingVertical: theme.spacing.xs,
      gap: theme.spacing.sm,
    },
    railItem: { paddingVertical: theme.spacing.xs },
    creatorCard: {
      minHeight: 244,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      gap: theme.spacing.sm,
    },
    creatorPhotoFrame: {
      width: "100%",
      height: 76,
      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    creatorSave: {
      position: "absolute",
      top: 0,
      right: 0,
      width: 34,
      height: 34,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    creatorLocation: {
      maxWidth: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
    },
    creatorLocationText: {
      flexShrink: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    creatorCopy: { width: "100%", alignItems: "center", gap: 2 },
    creatorName: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      fontWeight: "700",
      textAlign: "center",
    },
    creatorNicheRow: {
      maxWidth: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
    },
    creatorNiche: {
      flexShrink: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      textAlign: "center",
    },
    creatorDetails: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      paddingVertical: theme.spacing.sm,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
    },
    creatorStat: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      gap: 2,
    },
    creatorMetricLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    creatorMetric: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "700",
    },
    creatorMetricRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    creatorRating: { flexDirection: "row", alignItems: "center", gap: 3 },
    ratingText: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    creatorFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    price: {
      flexShrink: 1,
      maxWidth: "82%",
      color: theme.colors.primary,
      fontSize: theme.type.body,
      fontWeight: "700",
    },
    creatorList: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm },
    creatorListCard: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.sm,
      paddingRight: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    creatorListCopy: { flex: 1, gap: 2 },
    creatorListMetric: { alignItems: "flex-end", gap: 1 },
    campaignRail: { paddingVertical: theme.spacing.xs, gap: theme.spacing.sm },
    campaignRailCard: {
      minHeight: 158,
      borderRadius: theme.radius.md,
      gap: theme.spacing.sm,
    },
    campaignTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    brandMark: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    brandMarkText: {
      color: theme.colors.accentText,
      fontSize: theme.type.bodyLarge,
      fontWeight: "700",
    },
    campaignBrand: {
      flexShrink: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    campaignTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      fontWeight: "700",
    },
    campaignTitleInRow: { flex: 1 },
    campaignTitleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.xs,
    },
    campaignDescription: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: 17,
    },
    campaignBudget: {
      color: theme.colors.primary,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    campaignRailFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.xs,
    },
    campaignCompactRail: {
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    actionList: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm },
    homeAction: {
      minHeight: 84,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    homeActionIcon: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    homeActionCopy: { flex: 1, minWidth: 0, gap: 3 },
    homeActionTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "700",
    },
    homeActionDescription: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: 17,
    },
    categoryMasonry: {
      width: "100%",
      flexDirection: "row",
      alignItems: "flex-start",
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    categoryColumn: {
      flexGrow: 1,
      flexBasis: 0,
      minWidth: 0,
      gap: theme.spacing.sm,
    },
    categoryTile: {
      width: "100%",
      minHeight: 128,
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    categoryTileTall: { minHeight: 172 },
    categoryHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    categoryIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    categoryCopy: { minWidth: 0, gap: 2 },
    categoryTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "700",
    },
    categoryDescription: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: 17,
    },
    categoryArrow: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    moreCategory: {
      width: "100%",
      minHeight: 188,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.accent,
    },
    moreCategoryIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    moreCategoryTitle: {
      color: theme.colors.accentText,
      fontSize: theme.type.body,
      fontWeight: "700",
    },
    moreCategoryDescription: {
      color: theme.colors.accentText,
      fontSize: theme.type.caption,
      lineHeight: 17,
    },
    moreCategoryFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    moreCategoryLink: {
      color: theme.colors.primary,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    pressed: { opacity: 0.78 },
  });
