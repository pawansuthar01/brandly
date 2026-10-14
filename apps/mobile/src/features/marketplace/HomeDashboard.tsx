import { useState } from "react";
import { useEffect, useRef } from "react";
import { Image as ExpoImage } from "expo-image";
import {
  AccessibilityInfo,
  Animated,
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
  NATIVE_ANIMATIONS_ENABLED,
  Avatar,
  MarketplaceCardSkeleton,
  Pill,
  SectionTitle,
  Skeleton,
} from "../../components/ui";
import { ProposalCard } from "../../components/marketplace";
import { useDemoMarketplace } from "../../hooks/useDemoMarketplace";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import { HomePromo } from "../../services/demoMarketplace.service";
import { BrandBrief, Campaign, ContentIdea, DemoProposal, Influencer, MarketplaceApplication, TodoTask } from "../../types/marketplace";
import { ConsistencyChart, HomeTaskOverview, WeeklyPlanner } from "../../components/TaskInsights";
import { TodoTaskPanel } from "./TodoTask";
import { brandBriefToCampaign } from "../../lib/marketplace";

const topCategories = [
  {
    label: "Beauty",
    note: "Skincare, makeup & wellness",
    icon: "color-palette-outline",
    tone: "butter",
  },
  {
    label: "Fashion",
    note: "Style-led storytelling",
    icon: "shirt-outline",
    tone: "blush",
  },
  {
    label: "Food",
    note: "Restaurants & product tastings",
    icon: "restaurant-outline",
    tone: "mint",
  },
  {
    label: "Tech",
    note: "Apps, devices & reviews",
    icon: "phone-portrait-outline",
    tone: "sky",
  },
  {
    label: "Fitness",
    note: "Movement & healthy living",
    icon: "barbell-outline",
    tone: "lilac",
  },
  {
    label: "Travel",
    note: "Hotels, stays & local guides",
    icon: "airplane-outline",
    tone: "sky",
  },
  {
    label: "Gaming",
    note: "Live play & creator reviews",
    icon: "game-controller-outline",
    tone: "blush",
  },
  {
    label: "Home",
    note: "Interiors, routines & living",
    icon: "home-outline",
    tone: "mint",
  },
  {
    label: "Family",
    note: "Parenting & everyday life",
    icon: "heart-outline",
    tone: "butter",
  },
  {
    label: "Wellness",
    note: "Mindful routines & self-care",
    icon: "leaf-outline",
    tone: "mint",
  },
  {
    label: "Education",
    note: "Learning, skills & explainers",
    icon: "school-outline",
    tone: "sky",
  },
  {
    label: "Pets",
    note: "Care, products & pet life",
    icon: "paw-outline",
    tone: "lilac",
  },
] as const;

type Props = {
  role: "Brand" | "Influencer";
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onDiscover: (category?: string) => void;
  onInfluencer: (item: Influencer) => void;
  onCampaign: (item?: Campaign) => void;
  onChat: (name: string, initials: string) => void;
  onOpenApplication?: (application: MarketplaceApplication) => void;
  proposals: DemoProposal[];
  onProposal: (proposal: DemoProposal) => void;
  onReminderPress: (proposal: DemoProposal) => void;
  onOpenCampaignVideo: (url: string) => void;
  onProfileEdit: () => void;
  ideas: ContentIdea[];
  tasks: TodoTask[];
  applications?: MarketplaceApplication[];
  profileCompletion?: number;
  onToggleTask: (id: string) => void;
  onOpenTask: (task: TodoTask) => void;
  onOpenCalendar: () => void;
  onCreateTask?: () => void;
  additionalCampaigns?: Campaign[];
  privateCampaignIds?: string[];
  creatorDirectory?: Influencer[];
  loading?: boolean;
};

export function HomeDashboard({
  role,
  onScroll,
  onDiscover,
  onInfluencer,
  onCampaign,
  onChat,
  onOpenApplication,
  proposals,
  onProposal,
  onReminderPress,
  onOpenCampaignVideo,
  onProfileEdit,
  ideas,
  tasks,
  applications: scopedApplications,
  profileCompletion = 0,
  onToggleTask,
  onOpenTask,
  onOpenCalendar,
  onCreateTask,
  additionalCampaigns = [],
  privateCampaignIds = [],
  creatorDirectory,
  loading = false,
}: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { allInfluencers, applications: storedApplications, isLoading } =
    useDemoMarketplace();
  const brandCreators = creatorDirectory ?? allInfluencers;
  const applications = scopedApplications ?? storedApplications;
  const { width } = useWindowDimensions();
  const campaignCardWidth = Math.min(
    322,
    Math.max(248, Math.round(width * 0.8)),
  );
  const campaignCompactWidth = Math.min(
    300,
    Math.max(232, Math.round(width * 0.76)),
  );
  if (loading) {
    return (
      <ScrollView
        style={styles.screen}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <HomeLoadingSkeleton />
      </ScrollView>
    );
  }
  if (role === "Influencer") {
    return (
      <CreatorHomeDashboard
        onScroll={onScroll}
        onDiscover={onDiscover}
        onCampaign={onCampaign}
        onChat={onChat}
        onOpenApplication={onOpenApplication}
        proposals={proposals}
        onProposal={onProposal}
        onReminderPress={onReminderPress}
        onOpenCampaignVideo={onOpenCampaignVideo}
        onProfileEdit={onProfileEdit}
        ideas={ideas}
        tasks={tasks}
        applications={applications}
        profileCompletion={profileCompletion}
        onToggleTask={onToggleTask}
        onOpenTask={onOpenTask}
        onOpenCalendar={onOpenCalendar}
        onCreateTask={onCreateTask}
        additionalCampaigns={additionalCampaigns}
        privateCampaignIds={privateCampaignIds}
      />
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.page}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <HomeHeroCard role="Brand" matchCount={brandCreators.length} secondaryCount={applications.filter((application) => application.status === "Pending").length} onPress={() => onDiscover()} />

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
            <View style={styles.creatorList}>
              {brandCreators.map((item) => (
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
          title="Campaign overview"
          action="Manage"
          onAction={() => onCampaign()}
        />
        {additionalCampaigns.slice(0, 2).map((campaign, index) => (
          <AppCard key={campaign.id} onPress={() => onCampaign(campaign)} style={[styles.briefPreviewCard, [styles.briefToneSky, styles.briefToneMint, styles.briefToneButter, styles.briefToneBlush][index % 4]]}>
            <View style={styles.feedHeader}>
              <View style={styles.feedIcon}><Text style={styles.feedIconText}>{campaign.brandInitials ?? campaign.brand.slice(0, 2).toUpperCase()}</Text></View>
              <View style={styles.feedCopy}><Text style={styles.feedTitle}>{campaign.title}</Text><Text style={styles.feedMeta}>{campaign.category} · {campaign.city}</Text></View>
              <Pill label={campaign.visibility === "private" ? "Private" : campaign.status} accent={campaign.visibility !== "private" && (campaign.status === "Published" || campaign.status === "Open")} />
            </View>
            <Text numberOfLines={2} style={styles.feedMeta}>{campaign.description}</Text>
          </AppCard>
        ))}
        {!additionalCampaigns.length ? <Text style={styles.feedMeta}>Create a campaign to start tracking your brand workspace.</Text> : null}
      </View>

      <View style={styles.contentSection}>
        <HomeSectionHeading
          icon="grid-outline"
          title="Browse by niche"
          action="See all"
          onAction={onDiscover}
        />
        <View style={styles.categoryRail}>
          {topCategories.slice(0, 7).map((item, index) => (
            <CategoryTile
              key={item.label}
              item={item}
              index={index}
              onPress={() => onDiscover(item.label)}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explore more creator categories"
            onPress={() => onDiscover()}
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
              More niches
            </Text>
            <Text numberOfLines={2} style={styles.moreCategoryDescription}>
              See every creator category.
            </Text>
            <View style={styles.moreCategoryFooter}>
              <Text style={styles.moreCategoryLink}>See all</Text>
              <AppIcon
                name="arrow-forward"
                size={17}
                color={theme.colors.primary}
              />
            </View>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function HomeLoadingSkeleton() {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading home" style={styles.homeSkeleton}>
      <AppCard style={[styles.homeHero, styles.homeSkeletonHero]}>
        <Skeleton width="34%" height={12} />
        <Skeleton width="70%" height={28} />
        <Skeleton width="92%" height={12} />
        <Skeleton width="68%" height={12} />
        <View style={styles.homeSkeletonStats}>
          {[1, 2].map((item) => (
            <View key={item} style={styles.homeSkeletonStat}>
              <Skeleton width="42%" height={24} />
              <Skeleton width="76%" height={10} />
            </View>
          ))}
        </View>
      </AppCard>
      {[1, 2, 3].map((section) => (
        <View key={section} style={styles.contentSection}>
          <View style={styles.homeSkeletonHeading}>
            <Skeleton width={36} height={36} />
            <View style={styles.homeSkeletonHeadingCopy}>
              <Skeleton width="46%" height={16} />
              <Skeleton width="24%" height={10} />
            </View>
          </View>
          <View style={styles.skeletons}>
            <MarketplaceCardSkeleton />
            <MarketplaceCardSkeleton />
          </View>
        </View>
      ))}
    </View>
  );
}

function HomeHeroCard({ role, matchCount, secondaryCount, onPress }: { role: "Brand" | "Influencer"; matchCount: number; secondaryCount: number; onPress: () => void }) {
  const { theme, text } = useTheme();
  const styles = makeStyles(theme);
  const isBrand = role === "Brand";
  const headingFallback = isBrand ? "Find your next creator." : "Find briefs made for you.";
  const heading = text(isBrand ? "home.brand.heading" : "home.creator.heading", headingFallback);
  const description = text(isBrand ? "home.brand.description" : "home.creator.description", isBrand
    ? "Browse a few strong matches and move the right brief forward."
    : "See your best matches, then keep every application moving.");
  const buttonLabel = text(isBrand ? "home.brand.buttonLabel" : "home.creator.buttonLabel", isBrand ? "Explore creators" : "Explore briefs");
  const heroProgress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (cancelled) return;
        Animated.timing(heroProgress, {
          toValue: 1,
          duration: reduceMotion ? 0 : 420,
          useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
        }).start();
      })
      .catch(() => {
        if (!cancelled) Animated.timing(heroProgress, { toValue: 1, duration: 280, useNativeDriver: NATIVE_ANIMATIONS_ENABLED }).start();
      });
    return () => {
      cancelled = true;
      heroProgress.stopAnimation();
    };
  }, [heroProgress]);
  return (
    <AppCard style={[styles.homeHero, isBrand ? styles.homeHeroBrand : styles.homeHeroCreator]}>
      <View pointerEvents="none" style={styles.heroDecoration}>
        <View style={[styles.heroBlob, isBrand ? styles.heroBlobBrand : styles.heroBlobCreator]} />
        <View style={[styles.heroBlobSecondary, isBrand ? styles.heroBlobBrandSecondary : styles.heroBlobCreatorSecondary]} />
      </View>
        <View style={styles.heroTopline}>
          <View style={[styles.heroIcon, isBrand ? styles.heroIconBrand : styles.heroIconCreator]}>
            <AppIcon
              name={isBrand ? "people-outline" : "videocam-outline"}
              size={20}
              color={isBrand ? theme.colors.secondaryText : theme.colors.tertiaryText}
            />
          </View>
          <View style={styles.heroToplineCopy}>
            <Text style={styles.homeHeroEyebrow}>{isBrand ? "Brand workspace" : "Creator workspace"}</Text>
            <Text style={styles.homeHeroToday}>Today</Text>
          </View>
          <Animated.Text style={[styles.heroScriptText, isBrand ? styles.heroScriptBrand : styles.heroScriptCreator, { opacity: heroProgress }]}>{isBrand ? "Build · Connect · Grow" : "Create · Grow · Earn"}</Animated.Text>
        </View>
        <Text style={styles.homeHeroTitle}>{heading === headingFallback ? <><Text>{isBrand ? "Find your next " : "Find briefs "}</Text><Text style={isBrand ? styles.homeHeroTitleAccentBrand : styles.homeHeroTitleAccentCreator}>{isBrand ? "creator." : "made for you."}</Text></> : heading}</Text>
        <Text style={styles.homeHeroBody}>{description}</Text>
        <View style={styles.homeHeroStats}>
          <View style={[styles.homeHeroStat, styles.homeHeroStatMatch]}>
            <Text style={styles.homeHeroValue}>{matchCount}</Text>
            <Text style={styles.homeHeroLabel}>{isBrand ? "Creator matches" : "Matched briefs"}</Text>
          </View>
          <View style={[styles.homeHeroStat, styles.homeHeroStatSecondary]}>
            <Text style={styles.homeHeroValue}>{secondaryCount}</Text>
            <Text style={styles.homeHeroLabel}>{isBrand ? "To review" : "Open tasks"}</Text>
          </View>
        </View>
        <AppButton
          label={buttonLabel}
          icon="arrow-forward"
          onPress={onPress}
          tone={isBrand ? "secondary" : "tertiary"}
          style={styles.homeHeroButton}
        />
    </AppCard>
  );
}

function CreatorHomeDashboard({
  onScroll,
  onDiscover,
  onCampaign,
  onChat,
  onOpenApplication,
  proposals,
  onProposal,
  onReminderPress,
  onOpenCampaignVideo,
  onProfileEdit,
  ideas,
  tasks,
  applications,
  profileCompletion,
  onToggleTask,
  onOpenTask,
  onOpenCalendar,
  onCreateTask,
  additionalCampaigns,
  privateCampaignIds,
}: {
  onScroll: Props["onScroll"];
  onDiscover: () => void;
  onCampaign: (item?: Campaign) => void;
  onChat: (name: string, initials: string) => void;
  onOpenApplication?: (application: MarketplaceApplication) => void;
  proposals: DemoProposal[];
  onProposal: (proposal: DemoProposal) => void;
  onReminderPress: (proposal: DemoProposal) => void;
  onOpenCampaignVideo: (url: string) => void;
  onProfileEdit: () => void;
  ideas: ContentIdea[];
  tasks: TodoTask[];
  applications: MarketplaceApplication[];
  profileCompletion: number;
  onToggleTask: (id: string) => void;
  onOpenTask: (task: TodoTask) => void;
  onOpenCalendar: () => void;
  onCreateTask?: () => void;
  additionalCampaigns: Campaign[];
  privateCampaignIds: string[];
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { briefs, isLoading } = useDemoMarketplace();
  const { width: screenWidth } = useWindowDimensions();
  const applicationCardWidth = Math.min(
    320,
    Math.max(260, screenWidth - theme.spacing.lg * 3),
  );
  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.page}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <HomeHeroCard role="Influencer" matchCount={briefs.filter((brief) => brief.active).length} secondaryCount={tasks.filter((task) => !task.completed).length} onPress={() => onDiscover()} />
      <TodoTaskPanel
        tasks={tasks}
        onToggleTask={onToggleTask}
        onOpenTask={onOpenTask}
        onOpenCalendar={onOpenCalendar}
        onCreateTask={onCreateTask}
      />
      <HomeTaskOverview tasks={tasks} ideas={ideas} proposals={proposals} />
      <WeeklyPlanner tasks={tasks} onOpenTask={onOpenTask} />
      <ConsistencyChart tasks={tasks} onPress={onOpenCalendar} />
      <View style={styles.contentSection}>
        <HomeSectionHeading
          icon="briefcase-outline"
          title="Matched briefs"
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
          <PublicBriefRail
            briefs={briefs.slice(0, 4)}
            onOpenBrief={(brief) => {
              const campaign = additionalCampaigns.find((item) => item.id === brief.campaignId) ?? brandBriefToCampaign(brief);
              onCampaign(campaign);
            }}
          />
        )}
      </View>
      <View style={styles.contentSection}>
        <HomeSectionHeading
          icon="paper-plane-outline"
          title="Application status"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          disableIntervalMomentum
          snapToInterval={applicationCardWidth + theme.spacing.sm}
          snapToAlignment="start"
          contentContainerStyle={styles.applicationStatusRail}
        >
          {applications.slice(0, 2).map((application) => (
            <AppCard
              key={application.id}
              style={[
                styles.applicationStatusCard,
                { width: applicationCardWidth },
              ]}
            >
              <View style={[styles.feedHeader, styles.applicationStatusHeader]}>
                <View style={styles.feedIcon}><AppIcon name="paper-plane-outline" size={18} color={theme.colors.primary} /></View>
                <View style={styles.feedCopy}>
                  <Text style={styles.feedTitle}>{application.briefTitle}</Text>
                  <Text style={styles.feedMeta}>{application.brandName} · {application.status}</Text>
                </View>
                <Pill label={application.status} accent={application.status === "Accepted"} />
              </View>
              <Text style={styles.feedMeta}>{application.message || "Application submitted for review."}</Text>
              {application.status === "Accepted" ? <AppButton label="Open chat" icon="chatbubble-ellipses-outline" variant="secondary" onPress={() => onOpenApplication ? onOpenApplication(application) : onChat(application.brandName, application.brandInitials)} /> : <Text style={styles.feedMeta}>Chat opens after the brand accepts.</Text>}
            </AppCard>
          ))}
        </ScrollView>
      </View>
      <View style={styles.contentSection}>
        <HomeSectionHeading icon="checkmark-done-outline" title="Creator readiness" />
        <AppCard onPress={onProfileEdit} style={styles.readinessCard}>
          <View style={styles.readinessIcon}>
            <AppIcon
              name="checkmark-circle-outline"
              size={22}
              color={theme.colors.primary}
            />
          </View>
          <View style={styles.homeActionCopy}>
            <Text style={styles.homeActionTitle}>Profile is {profileCompletion}% complete</Text>
            <Text style={styles.homeActionDescription}>
              {profileCompletion >= 80
                ? "Your profile is ready for more relevant matches."
                : "Add your latest portfolio media, rates and preferred cities to improve matching."}
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
          { paddingHorizontal: theme.spacing.lg },
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

function PublicBriefRail({
  briefs,
  onOpenBrief,
}: {
  briefs: BrandBrief[];
  onOpenBrief: (brief: BrandBrief) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.briefPreviewList}>
      {briefs.map((brief, index) => (
        <AppCard key={brief.id} onPress={() => onOpenBrief(brief)} style={[styles.briefPreviewCard, [styles.briefToneSky, styles.briefToneMint, styles.briefToneButter, styles.briefToneBlush][index % 4]]}>
          <View style={styles.feedHeader}>
            <View style={styles.feedIcon}><Text style={styles.feedIconText}>{brief.brandInitials}</Text></View>
            <View style={styles.feedCopy}>
              <Text style={styles.feedTitle}>{brief.title}</Text>
              <Text style={styles.feedMeta}>{brief.brandName} · {brief.city}</Text>
            </View>
            {brief.matchScore !== undefined ? <Pill label={`${brief.matchScore}%`} accent /> : null}
          </View>
          <Text numberOfLines={2} style={styles.feedMeta}>{brief.description}</Text>
        </AppCard>
      ))}
    </View>
  );
}

function RecommendedBriefRail({
  campaigns,
  onPress,
  onOpenVideo,
}: {
  campaigns: Campaign[];
  onPress: (item?: Campaign) => void;
  onOpenVideo: (url: string) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(322, Math.max(248, screenWidth - theme.spacing.lg * 2));
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
          { paddingHorizontal: theme.spacing.lg },
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
            onOpenVideo={onOpenVideo}
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
  compared,
  onToggleCompare,
  onPress,
}: {
  item: Influencer;
  width: number;
  saved?: boolean;
  onSave?: () => void;
  compared?: boolean;
  onToggleCompare?: () => void;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const creatorTone = [styles.creatorToneSky, styles.creatorToneMint, styles.creatorToneBlush, styles.creatorToneButter][item.id.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % 4];
  return (
    <View style={[styles.railItem, { width }]}> 
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${item.name}`}
        onPress={onPress}
        style={({ pressed }) => [styles.creatorCard, creatorTone, pressed && styles.pressed]}
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
              onPress={(event) => {
                event.stopPropagation();
                onSave();
              }}
              style={styles.creatorSave}
              hitSlop={6}
            >
              <AppIcon
                name={saved ? "bookmark" : "bookmark-outline"}
                size={18}
                color={theme.colors.primary}
              />
              <Text style={styles.creatorSaveText}>{saved ? "Saved" : "Save"}</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.creatorCopy}>
          <Text
            numberOfLines={2}
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
              name="pricetag-outline"
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
              <AppIcon name="star" size={14} color={theme.colors.tertiaryText} />
              <Text numberOfLines={1} style={styles.ratingText}>
                {item.rating}
              </Text>
            </View>
            <Text style={styles.creatorMetricLabel}>Rating</Text>
          </View>
          {item.engagementRate ? (
            <View style={styles.creatorStat}>
              <Text numberOfLines={1} style={styles.creatorMetric}>
                {item.engagementRate}
              </Text>
              <Text style={styles.creatorMetricLabel}>Engagement</Text>
            </View>
          ) : null}
          <View style={styles.creatorStat}>
            <Text numberOfLines={1} style={styles.creatorMetric}>
              {item.reviews}
            </Text>
            <Text style={styles.creatorMetricLabel}>Reviews</Text>
          </View>
        </View>
        <View style={styles.creatorPlatformRow}>
          {item.platforms.slice(0, 3).map((platform) => (
            <Pill key={platform} label={platform} />
          ))}
        </View>
        <View style={styles.creatorFooter}>
          <View style={styles.creatorMetricRow}>
            <AppIcon
              name="cash-outline"
              size={16}
              color={theme.colors.secondaryText}
            />
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.price}>
              {item.price}
            </Text>
          </View>
        </View>
        <View style={styles.creatorActionRow}>
          {compared !== undefined && onToggleCompare ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={compared ? `Remove ${item.name} from comparison` : `Add ${item.name} to comparison`}
              accessibilityState={{ selected: compared }}
              onPress={(event) => {
                event.stopPropagation();
                onToggleCompare();
              }}
              hitSlop={4}
              style={({ pressed }) => [
                styles.creatorCompareAction,
                compared && styles.creatorCompareActionActive,
                pressed && styles.pressed,
              ]}
            >
              <AppIcon name={compared ? "checkmark" : "add"} size={17} color={theme.colors.primary} />
              <Text style={styles.creatorCompareActionText}>{compared ? "Compared" : "Compare"}</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.name} profile`}
            onPress={(event) => {
              event.stopPropagation();
              onPress();
            }}
            hitSlop={4}
            style={({ pressed }) => [styles.creatorOpenProfileAction, pressed && styles.pressed]}
          >
            <Text style={styles.creatorOpenProfileActionText}>Open profile</Text>
            <AppIcon name="arrow-forward" size={17} color={theme.colors.primaryText} />
          </Pressable>
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
    | "checkmark-done-outline";
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
  const creatorTone = [styles.creatorToneSky, styles.creatorToneMint, styles.creatorToneBlush, styles.creatorToneButter][item.id.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % 4];
  return (
    <View style={[styles.creatorListCard, creatorTone]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${item.name}`}
        onPress={onPress}
        style={({ pressed }) => [styles.creatorListPress, pressed && styles.pressed]}
      >
        <Avatar initials={item.initials} uri={item.avatarUrl} size="small" />
        <View style={styles.creatorListCopy}>
          <Text numberOfLines={1} style={styles.creatorName}>{item.name}</Text>
          <Text numberOfLines={1} style={styles.creatorNiche}>{item.niche} · {item.city}</Text>
        </View>
        <View style={styles.creatorListMetric}>
          <View style={styles.creatorMetricRow}>
            <AppIcon name="people-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={styles.creatorMetric}>{item.followers}</Text>
          </View>
        </View>
        <AppIcon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
      </Pressable>
    </View>
  );
}

function CampaignQuickCard({
  item,
  width,
  onPress,
  onOpenVideo,
}: {
  item: Campaign;
  width: number;
  onPress: () => void;
  onOpenVideo?: (url: string) => void;
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
          <View style={styles.campaignBrandCopy}>
            <Text numberOfLines={1} style={styles.campaignBrand}>
              {item.brand}
            </Text>
            {item.promoted ? <Pill label="Promoted" accent /> : null}
          </View>
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
        {item.collaborationVideoUrl && onOpenVideo ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={item.collaborationVideoLabel ?? "Watch collaboration video"}
            onPress={(event) => {
              event.stopPropagation();
              onOpenVideo(item.collaborationVideoUrl!);
            }}
            style={({ pressed }) => [styles.campaignVideoLink, pressed && styles.pressed]}
          >
            <AppIcon name="videocam-outline" size={16} color={theme.colors.primary} />
            <Text numberOfLines={1} style={styles.campaignVideoLabel}>
              {item.collaborationVideoLabel ?? "Watch collaboration video"}
            </Text>
            <AppIcon name="open-outline" size={15} color={theme.colors.primary} />
          </Pressable>
        ) : null}
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
  index,
  onPress,
}: {
  item: (typeof topCategories)[number];
  index: number;
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
        index % 3 === 0 && styles.categoryTileTall,
        index % 3 === 1 && styles.categoryTileShort,
        item.tone === "butter" && styles.categoryTileButter,
        item.tone === "blush" && styles.categoryTileBlush,
        item.tone === "mint" && styles.categoryTileMint,
        item.tone === "sky" && styles.categoryTileSky,
        item.tone === "lilac" && styles.categoryTileLilac,
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
  if (visual)
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
              size={16}
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
      <AppButton label={cta.label ?? "Open"} onPress={onPress} />
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  createThemeStyles(theme, {
    screen: { flex: 1, backgroundColor: theme.colors.transparent },
    page: {
      backgroundColor: theme.colors.transparent,
      width: "100%",
      maxWidth: 640,
      alignSelf: "center",
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xxl + theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    homeHero: { position: "relative", overflow: "hidden", marginHorizontal: theme.spacing.lg, borderRadius: theme.radius.lg, gap: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.cardBorder, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.lg },
    homeHeroBrand: { backgroundColor: theme.colors.surfaceHero },
    homeHeroCreator: { backgroundColor: theme.colors.surfaceHero },
    heroTopline: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
    heroIcon: { width: 44, height: 44, borderRadius: theme.radius.pill, alignItems: "center", justifyContent: "center" },
    heroIconBrand: { backgroundColor: theme.colors.surfaceBlush },
    heroIconCreator: { backgroundColor: theme.colors.surfaceSky },
    heroToplineCopy: { flex: 1, minWidth: 0, gap: 1 },
    homeHeroEyebrow: { color: theme.colors.textPrimary, fontSize: theme.type.body, fontWeight: "800", fontFamily: theme.type.bodyFont },
    homeHeroToday: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont },
    homeHeroTitle: { maxWidth: "78%", color: theme.colors.textPrimary, fontSize: theme.type.display, lineHeight: theme.type.lineHeight.display, fontWeight: "900", fontFamily: theme.type.displayFont },
    homeHeroTitleAccentBrand: { color: theme.colors.secondaryText },
    homeHeroTitleAccentCreator: { color: theme.colors.tertiaryText },
    homeHeroBody: { color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont },
    homeHeroStats: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.xs },
    homeHeroStat: { flex: 1, gap: theme.spacing.xs, padding: theme.spacing.sm, borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceRaised },
    homeHeroStatMatch: { backgroundColor: theme.colors.surfaceSky },
    homeHeroStatSecondary: { backgroundColor: theme.colors.surfaceMint },
    homeHeroValue: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.displayFont },
    homeHeroLabel: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont },
    homeHeroButton: { marginTop: theme.spacing.xs },
    heroDecoration: { ...StyleSheet.absoluteFill },
    heroBlob: { position: "absolute", top: -54, right: -42, width: 176, height: 140, borderRadius: theme.radius.pill, opacity: 0.62 },
    heroBlobBrand: { backgroundColor: theme.colors.surfaceSky },
    heroBlobCreator: { backgroundColor: theme.colors.accent },
    heroBlobSecondary: { position: "absolute", right: -18, bottom: -62, width: 142, height: 112, borderRadius: theme.radius.pill, opacity: 0.6 },
    heroBlobBrandSecondary: { backgroundColor: theme.colors.surfaceBlush },
    heroBlobCreatorSecondary: { backgroundColor: theme.colors.surfaceBlush },
    heroScriptText: { maxWidth: 112, marginLeft: "auto", textAlign: "right", fontSize: 10, lineHeight: 14, fontStyle: "italic", fontFamily: theme.type.displayFont, opacity: 0.72 },
    heroScriptBrand: { color: theme.colors.secondaryText },
    heroScriptCreator: { color: theme.colors.tertiaryText },
    promoSection: { gap: theme.spacing.xs },
    promoViewport: { backgroundColor: theme.colors.transparent },
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
      backgroundColor: theme.colors.surfaceSky,
    },
    mediaCta: { position: "absolute", bottom: theme.spacing.md },
    mediaCtaLeft: { left: theme.spacing.md },
    mediaCtaRight: { right: theme.spacing.md },
    ctaLeft: { alignSelf: "flex-start" },
    ctaRight: { alignSelf: "flex-end" },
    iconCta: {
      ...theme.shadows.floating,
      width: 56,
      height: 56,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },
    linkCta: {
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    linkCtaText: {
      color: theme.colors.primary,
      fontSize: theme.type.body,
      lineHeight: theme.type.lineHeight.body,
      fontWeight: "500",
      fontFamily: theme.type.bodyFont,
    },
    promoMedia: { ...StyleSheet.absoluteFill },
    promoImageFallback: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceLilac,
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
      fontFamily: theme.type.displayFont,
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
    homeSkeleton: { gap: theme.spacing.lg },
    homeSkeletonHero: { gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceHero },
    homeSkeletonStats: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.xs },
    homeSkeletonStat: { flex: 1, gap: theme.spacing.xs, padding: theme.spacing.sm, borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceRaised },
    homeSkeletonHeading: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg },
    homeSkeletonHeadingCopy: { flex: 1, gap: theme.spacing.xs },
    applicationStatusRail: {
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    applicationStatusCard: {
      gap: theme.spacing.md,
      backgroundColor: theme.colors.surfaceSky,
    },
    applicationStatusHeader: { alignItems: "flex-start" },
    readinessCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      marginHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.surfaceLilac,
    },
    readinessIcon: {
      width: 42,
      height: 42,
      borderRadius: theme.radius.control,
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
      backgroundColor: theme.colors.surfaceLilac,
    },
    sectionHeadingCopy: { flex: 1, minWidth: 0 },
    skeletons: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm },
    creatorCarousel: {
      paddingVertical: theme.spacing.xs,
      gap: theme.spacing.sm,
    },
    railItem: { paddingVertical: theme.spacing.xs },
    creatorCard: {
      minHeight: 0,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      gap: theme.spacing.sm,
    },
    creatorToneSky: { backgroundColor: theme.colors.surfaceSky },
    creatorToneMint: { backgroundColor: theme.colors.surfaceMint },
    creatorToneBlush: { backgroundColor: theme.colors.surfaceBlush },
    creatorToneButter: { backgroundColor: theme.colors.surfaceButter },
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
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
    },
    creatorSaveText: {
      color: theme.colors.primary,
      fontSize: theme.type.caption,
      fontWeight: "800",
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
      flexWrap: "wrap",
      justifyContent: "space-around",
      alignItems: "center",
      paddingVertical: theme.spacing.xs,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
    },
    creatorStat: {
      width: "50%",
      minWidth: 0,
      alignItems: "center",
      gap: 1,
      paddingVertical: theme.spacing.xs,
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
      alignItems: "center",
      paddingTop: theme.spacing.sm,
      borderTopWidth: 1,
      borderColor: theme.colors.border,
    },
    creatorPlatformRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    creatorActionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    creatorCompareAction: {
      flex: 1,
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      borderRadius: theme.radius.control,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceMuted,
    },
    creatorCompareActionActive: { backgroundColor: theme.colors.accent },
    creatorCompareActionText: {
      color: theme.colors.primary,
      fontSize: theme.type.caption,
      fontWeight: "800",
    },
    creatorOpenProfileAction: {
      flex: 1,
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      borderRadius: theme.radius.control,
      backgroundColor: theme.colors.primary,
    },
    creatorOpenProfileActionText: {
      color: theme.colors.primaryText,
      fontSize: theme.type.caption,
      fontWeight: "800",
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
      borderRadius: theme.radius.control,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    creatorListPress: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
    creatorListCopy: { flex: 1, gap: 2 },
    creatorListMetric: { alignItems: "flex-end", gap: 1 },
    campaignRail: { paddingVertical: theme.spacing.xs, gap: theme.spacing.sm },
    campaignRailCard: {
      height: 248,
      justifyContent: "space-between",
      borderRadius: theme.radius.md,
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceSky,
    },
    campaignTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    campaignBrandCopy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xs,
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
    campaignVideoLink: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
    },
    campaignVideoLabel: {
      flex: 1,
      color: theme.colors.primary,
      fontSize: theme.type.caption,
      fontWeight: "700",
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
    categoryRail: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    categoryTile: {
      width: "47%",
      minWidth: 0,
      minHeight: 148,
      justifyContent: "space-between",
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    categoryTileTall: { minHeight: 172 },
    categoryTileShort: { minHeight: 132 },
    categoryTileButter: { backgroundColor: theme.colors.surfaceBlush },
    categoryTileBlush: { backgroundColor: theme.colors.surfaceLilac },
    categoryTileMint: { backgroundColor: theme.colors.surfaceSky },
    categoryTileSky: { backgroundColor: theme.colors.surface },
    categoryTileLilac: { backgroundColor: theme.colors.surfaceRaised },
    categoryHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    categoryIcon: {
      width: 52,
      height: 52,
      borderRadius: theme.radius.control,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceRaised,
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
      backgroundColor: theme.colors.surfaceRaised,
    },
    moreCategory: {
      width: "47%",
      minWidth: 0,
      minHeight: 148,
      justifyContent: "space-between",
      gap: theme.spacing.xs,
      padding: theme.spacing.sm + theme.spacing.xs,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surfaceLilac,
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
    briefPreviewList: { gap: theme.spacing.sm },
    briefPreviewCard: { gap: theme.spacing.sm, marginHorizontal: theme.spacing.lg, backgroundColor: theme.colors.surfaceLilac, borderWidth: 0 },
    briefToneSky: { backgroundColor: theme.colors.surfaceSky },
    briefToneMint: { backgroundColor: theme.colors.surfaceMint },
    briefToneButter: { backgroundColor: theme.colors.surfaceButter },
    briefToneBlush: { backgroundColor: theme.colors.surfaceBlush },
    feedHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
    feedIcon: { width: 38, height: 38, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.accent },
    feedIconText: { color: theme.colors.accentText, fontSize: theme.type.caption, fontWeight: "900", fontFamily: theme.type.bodyFont },
    feedCopy: { flex: 1, minWidth: 0, gap: 2 },
    feedTitle: { color: theme.colors.textPrimary, fontSize: theme.type.body, fontWeight: "800", fontFamily: theme.type.bodyFont },
    feedMeta: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
    pressed: { opacity: 0.78 },
  });
