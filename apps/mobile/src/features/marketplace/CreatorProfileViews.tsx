import { useState } from "react";
import {
  ImageStyle,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import {
  AppButton,
  AppCard,
  AppIcon,
  Avatar,
  Pill,
  SectionTitle,
} from "../../components/ui";
import { ReviewSummary, SocialLinks } from "../../components/marketplace";
import { useTheme } from "../../providers/ThemeProvider";
import type {
  Campaign,
  CreatorReview,
  CreatorWorkHistory,
  Influencer,
  PublicCreatorProfile,
} from "../../types/marketplace";
import { type ScrollHandler } from "./marketplaceDomain";
import { Fact } from "./MarketplaceCards";
import { ProposalBack } from "./MarketplaceShared";
import { makeStyles } from "./marketplaceStyles";
import { formatDisplayDateTime } from "../../lib/dateTime";
import { CampaignSelectionSheet } from "./CampaignSelectionSheet";



export function BrandCreatorProfileView({
  creator,
  campaigns,
  saved,
  compared,
  onBack,
  onToggleSaved,
  onToggleCompare,
  sentCampaignIds = [],
  campaignsLoading = false,
  onOpenWork,
  onSendCreatorRequest,
  onSendCreatorRequests,
  onScroll,
}: {
  creator: PublicCreatorProfile;
  campaigns: Campaign[];
  saved: boolean;
  compared: boolean;
  sentCampaignIds?: string[];
  campaignsLoading?: boolean;
  onBack: () => void;
  onToggleSaved: () => void;
  onToggleCompare: () => void;
  onOpenWork: (work: CreatorWorkHistory) => void;
  onSendCreatorRequest: (creator: Influencer, campaign: Campaign) => void;
  onSendCreatorRequests?: (creator: Influencer, campaigns: Campaign[]) => number;
  onScroll: ScrollHandler;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false);
  const workHistory = creator.workHistory ?? [];
  const reviewItems = creator.reviewItems ?? [];
  const reviewCount = reviewItems.length || creator.reviews;
  const availableCampaigns = campaigns.filter((campaign) => campaign.status === "Published" || campaign.status === "Open");
  return (
    <>
      <ScrollView style={styles.viewport} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
        <ProposalBack onBack={onBack} />
        <View style={styles.brandCreatorHero}>
          <Avatar initials={creator.initials} uri={creator.avatarUrl} size="large" />
          <View style={styles.flex}>
            <Text style={styles.detailTitle}>{creator.name}</Text>
            <Text style={styles.pageIntro}>{creator.niche}</Text>
            <View style={styles.creatorProfileLocation}>
              <AppIcon name="location-outline" size={15} color={theme.colors.textSecondary} />
              <Text style={styles.creatorProfileLocationText}>{creator.city}{creator.state && creator.state !== creator.city ? ` · ${creator.state}` : ""}</Text>
            </View>
            <View style={styles.ratingRow}>
              <AppIcon name="star" size={15} color={theme.colors.accentText} />
            <Text style={styles.rating}>{creator.rating} · {reviewCount} reviews</Text>
            </View>
          </View>
        </View>
        <View style={styles.detailFacts}>
          <Fact label="Audience" value={creator.followers} />
          <Fact label="Starting price" value={creator.price} />
          <Fact label="Platforms" value={creator.platforms.join(" · ")} />
          {"engagementRate" in creator && creator.engagementRate ? <Fact label="Engagement" value={creator.engagementRate} /> : null}
        </View>
        <View style={styles.pillRow}>{creator.platforms.map((platform) => <Pill key={platform} label={platform} />)}</View>
        <SectionTitle title="Social accounts" />
        <SocialLinks
          links={creator.platforms.map((platform) => ({
            platform,
            handle: creator.socialAccounts?.[platform] ?? "Not added",
            verificationStatus: creator.socialVerification?.[platform] ?? "PENDING",
          }))}
        />
        <AppCard style={styles.publicProfileCard}>
          <Text style={styles.tipTitle}>About this creator</Text>
          <Text style={styles.tipBody}>{creator.bio || "No public bio has been added yet."}</Text>
        </AppCard>
        <SectionTitle title="Past work & portfolio" />
        {workHistory.length ? (
          <View style={styles.pastWorkList}>
            {workHistory.map((work) => (
              <AppCard key={work.id} onPress={() => onOpenWork(work)} flat style={styles.pastWorkRow}>
                <View style={styles.pastWorkIcon}>
                  <AppIcon name={work.media?.[0]?.type === "video" ? "videocam-outline" : work.media?.[0]?.type === "image" ? "image-outline" : "briefcase-outline"} size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.tipTitle}>{work.title}</Text>
                  <Text style={styles.pageIntro}>{[work.category, work.platform, work.period].filter(Boolean).join(" · ") || work.deliverables}</Text>
                </View>
                <AppIcon name="chevron-forward" size={18} color={theme.colors.textSecondary} />
              </AppCard>
            ))}
          </View>
        ) : (
          <AppCard><Text style={styles.tipBody}>No public work history has been added yet.</Text></AppCard>
        )}
        <SectionTitle title="Reviews" />
        <ReviewSummary rating={creator.rating} reviewCount={reviewCount} note={reviewItems.length ? "Read feedback from completed creator collaborations." : "Public review text is not available for this creator yet."} />
        {reviewItems.map((review) => <CreatorReviewCard key={review.id} review={review} />)}
        <View style={styles.creatorProfileActions}>
          <AppButton label={compared ? "Remove from compare" : "Add to compare"} variant="secondary" icon={compared ? "checkmark" : "add"} onPress={onToggleCompare} />
          <AppButton label={saved ? "Creator saved" : "Save creator"} variant="secondary" icon={saved ? "bookmark" : "bookmark-outline"} onPress={onToggleSaved} />
          <AppButton label="Send campaign request" icon="paper-plane-outline" onPress={() => setCampaignPickerOpen(true)} />
        </View>
      </ScrollView>
      <CampaignSelectionSheet
        visible={campaignPickerOpen}
        campaigns={availableCampaigns}
        loading={campaignsLoading}
        disabledCampaignIds={sentCampaignIds}
        subtitle={`Send ${creator.name} a request from one of your published campaigns.`}
        onClose={() => setCampaignPickerOpen(false)}
        onSelect={(campaign) => onSendCreatorRequest(creator, campaign)}
        multiSelect={Boolean(onSendCreatorRequests)}
        onSelectMany={(selectedCampaigns) => onSendCreatorRequests?.(creator, selectedCampaigns)}
      />
    </>
  );
}

function CreatorReviewCard({ review }: { review: CreatorReview }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [expanded, setExpanded] = useState(false);
  const needsExpansion = review.text.length > 180;
  const text = needsExpansion && !expanded ? `${review.text.slice(0, 180)}…` : review.text;
  return (
    <AppCard flat style={styles.creatorReviewCard}>
      <View style={styles.creatorReviewHeader}>
        <View style={styles.flex}><Text style={styles.tipTitle}>{review.author}</Text><Text style={styles.pageIntro}>{formatDisplayDateTime(review.date ?? "Completed collaboration")}</Text></View>
        <Pill label={`${review.rating}/5`} accent />
      </View>
      <Text style={styles.tipBody}>{text}</Text>
      {needsExpansion ? <Pressable accessibilityRole="button" onPress={() => setExpanded((value) => !value)}><Text style={styles.reviewReadMore}>{expanded ? "Show less" : "Read more"}</Text></Pressable> : null}
      {review.tags?.length ? <View style={styles.pillRow}>{review.tags.map((tag) => <Pill key={tag} label={tag} />)}</View> : null}
    </AppCard>
  );
}

export function CreatorWorkDetailView({
  creator,
  work,
  onBack,
  onScroll,
}: {
  creator: PublicCreatorProfile;
  work: CreatorWorkHistory;
  onBack: () => void;
  onScroll: ScrollHandler;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <ScrollView style={styles.viewport} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
      <ProposalBack onBack={onBack} />
      <View style={styles.workDetailHeader}>
        <Avatar initials={creator.initials} uri={creator.avatarUrl} size="small" />
        <View style={styles.flex}><Text style={styles.detailTitle}>{work.title}</Text><Text style={styles.pageIntro}>{creator.name} · {work.period}</Text></View>
      </View>
      <View style={styles.detailFacts}>
        {work.category ? <Fact label="Category" value={work.category} /> : null}
        {work.platform ? <Fact label="Platform" value={work.platform} /> : null}
        {work.views ? <Fact label="Views" value={work.views} /> : null}
        {work.engagement ? <Fact label="Engagement" value={work.engagement} /> : null}
      </View>
      {work.media?.length ? <View style={styles.workMediaList}>{work.media.map((attachment) => attachment.type === "image" && attachment.uri ? <ExpoImage key={attachment.id} source={attachment.uri} contentFit="contain" style={styles.workMediaImage as ImageStyle} accessibilityLabel={`${attachment.name} preview`} /> : <Pressable key={attachment.id} accessibilityRole="link" accessibilityLabel={`Open ${attachment.name}`} onPress={() => attachment.uri && void Linking.openURL(attachment.uri).catch(() => undefined)} style={styles.workAttachment}><AppIcon name={attachment.type === "video" ? "videocam-outline" : "document-text-outline"} size={22} color={theme.colors.primary} /><Text style={styles.tipBody}>{attachment.name}</Text><AppIcon name="open-outline" size={18} color={theme.colors.primary} /></Pressable>)}</View> : <AppCard><AppIcon name="images-outline" size={22} color={theme.colors.textSecondary} /><Text style={styles.tipBody}>No media preview is attached to this work item.</Text></AppCard>}
      <AppCard style={styles.publicProfileCard}><Text style={styles.tipTitle}>Deliverables</Text><Text style={styles.tipBody}>{work.deliverables}</Text></AppCard>
      <AppCard style={styles.publicProfileCard}><Text style={styles.tipTitle}>Description</Text><Text style={styles.tipBody}>{work.caption || work.summary}</Text></AppCard>
    </ScrollView>
  );
}
