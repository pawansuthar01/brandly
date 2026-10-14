import { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  AppButton,
  AppCard,
  AppIcon,
  Avatar,
  ConfirmModal,
  IconButton,
  Pill,
  SectionTitle,
  Skeleton,
} from "../../components/ui";
import { ReviewSummary, SocialLinks } from "../../components/marketplace";
import { useTheme } from "../../providers/ThemeProvider";
import { formatCampaignDeadline } from "../../lib/dateTime";
import type {
  AuthoredReview,
  Campaign,
  CampaignDraft,
  CreatorReview,
  DealStatus,
  DemoProposal,
  Influencer,
  ProfileDraft,
  ProposalContext,
  ProposalDraft,
  PublicCreatorProfile,
  SocialPlatform,
  SocialVerificationStatus,
} from "../../types/marketplace";
import {
  FlowScreen,
  type MarketplaceFlow,
  type NotificationSettings,
  type ReviewDraft,
} from "./FlowScreens";
import { ChatDetail } from "./ChatDetail";
import {
  type ChatReturn,
  type ContentDetail,
  type SocialAccountMap,
} from "./marketplaceDomain";
import { Fact } from "./MarketplaceCards";
import { ProposalBack } from "./MarketplaceShared";
import { makeStyles } from "./marketplaceStyles";


export function DetailView({
  detail,
  role,
  onBack,
  onProposalSubmit,
  proposals,
  onOpenProposal,
  proposalContext: fallbackProposalContext,
  savedCreatorIds,
  onToggleCreatorSaved,
  initialLocations,
  onProfileLocationsSave,
  blockedUsers,
  onBlockUser,
  notificationSettings,
  onNotificationSettingsSave,
  onDeleteAccount,
  onOpenChatProfile,
  campaigns,
  reviewItems,
  savedCreators,
  brandId,
  onSendCreatorRequest,
  onSendCreatorRequests,
  sentCampaignIds = [],
  campaignsLoading = false,
  initialSocialAccounts,
  verifiedSocialAccounts,
  pendingSocialAccounts,
  socialAccountErrors,
  onSocialVerificationRequest,
  onSocialAccountsSave,
  onCampaignCreate,
  onApplyToCampaign,
  onDealStatusSave,
  onReviewSubmit,
  authoredReviews,
  onReviewUpdate,
  initialDealStatus,
  profileIsPublic,
  onProfileVisibilitySave,
  liveData = false,
}: {
  detail: ContentDetail;
  role: "Brand" | "Influencer";
  onBack: () => void;
  onProposalSubmit: (context: ProposalContext, draft: ProposalDraft) => void;
  proposals: DemoProposal[];
  onOpenProposal: (proposal: DemoProposal) => void;
  proposalContext: ProposalContext;
  savedCreatorIds: string[];
  onToggleCreatorSaved: (creatorId: string) => void;
  initialLocations: string[];
  onProfileLocationsSave: (locations: string[]) => void;
  blockedUsers: string[];
  onBlockUser: (name: string, userId?: string) => void;
  notificationSettings: NotificationSettings;
  onNotificationSettingsSave: (settings: NotificationSettings) => void;
  onDeleteAccount: () => void;
  onOpenChatProfile: (name: string, returnTo: ChatReturn) => void;
  campaigns: Campaign[];
  reviewItems: Array<Pick<CreatorReview, "id" | "author" | "rating" | "text" | "date" | "tags">>;
  savedCreators: PublicCreatorProfile[];
  brandId?: string;
  onSendCreatorRequest: (creator: Influencer, campaign: Campaign) => void;
  onSendCreatorRequests?: (creator: Influencer, campaigns: Campaign[]) => number;
  sentCampaignIds?: string[];
  campaignsLoading?: boolean;
  initialSocialAccounts: SocialAccountMap;
  verifiedSocialAccounts: SocialPlatform[];
  pendingSocialAccounts?: SocialPlatform[];
  socialAccountErrors?: Partial<Record<SocialPlatform, string>>;
  onSocialVerificationRequest?: (
    platform: SocialPlatform,
    handle: string,
  ) => Promise<void> | void;
  onSocialAccountsSave: (
    accounts: SocialAccountMap,
    verifiedPlatforms: SocialPlatform[],
  ) => void;
  onCampaignCreate: (draft: CampaignDraft) => void;
  onApplyToCampaign?: (campaign: Campaign) => void;
  onDealStatusSave: (status: DealStatus) => void;
  onReviewSubmit: (draft: ReviewDraft) => boolean | void | Promise<boolean | void>;
  authoredReviews: AuthoredReview[];
  onReviewUpdate: (id: string, changes: Pick<AuthoredReview, "rating" | "text" | "tags">) => void;
  initialDealStatus?: DealStatus;
  profileIsPublic: boolean;
  onProfileVisibilitySave: (isPublic: boolean) => void;
  liveData?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [flow, setFlow] = useState<MarketplaceFlow | null>(null);
  const flowBackLocked = useRef(false);
  const [blockTarget, setBlockTarget] = useState<string | null>(null);
  const [blockTargetId, setBlockTargetId] = useState<string | undefined>(undefined);
  const [requestCampaignOpen, setRequestCampaignOpen] = useState(false);
  const [selectedRequestCampaignIds, setSelectedRequestCampaignIds] = useState<string[]>([]);
  const availableRequestCampaigns = campaigns.filter((campaign) =>
    (campaign.status === "Published" || campaign.status === "Open") &&
    (!campaign.brandId || campaign.brandId === brandId),
  );
  const closeRequestCampaignPicker = () => {
    setSelectedRequestCampaignIds([]);
    setRequestCampaignOpen(false);
  };
  const existingProposal =
    detail.type === "campaign"
      ? proposals.find(
          (proposal) =>
            proposal.campaignId === detail.value.id &&
            proposal.direction === "creator_to_brand" &&
            proposal.status !== "Declined",
        )
      : detail.type === "influencer"
        ? proposals.find(
            (proposal) =>
              proposal.participantName === detail.value.name &&
              proposal.direction === "brand_to_creator" &&
              proposal.status !== "Declined",
          )
        : undefined;
  const blockTargetIsBlocked = blockTarget
    ? blockedUsers.includes(blockTarget)
    : false;
  const confirmBlockAction = () => {
    if (blockTarget) onBlockUser(blockTarget, blockTargetId);
    setBlockTarget(null);
    setBlockTargetId(undefined);
  };
  const blockModal = (
    <ConfirmModal
      visible={blockTarget !== null}
      title={blockTargetIsBlocked ? "Unblock this profile?" : "Block this profile?"}
      message={
        blockTargetIsBlocked
          ? "This profile will be allowed to contact you again."
          : "This profile will not be able to start new conversations with you."
      }
      confirmLabel={blockTargetIsBlocked ? "Unblock" : "Block"}
      confirmIcon={blockTargetIsBlocked ? "lock-open-outline" : "ban-outline"}
      destructive={!blockTargetIsBlocked}
      onCancel={() => { setBlockTarget(null); setBlockTargetId(undefined); }}
      onConfirm={confirmBlockAction}
    />
  );
  const closeFlow = () => {
    if (flowBackLocked.current) return;
    flowBackLocked.current = true;
    setFlow(null);
    setTimeout(() => {
      flowBackLocked.current = false;
    }, 450);
  };
  const proposalContext: ProposalContext =
    detail.type === "campaign"
      ? {
          campaignId: detail.value.id,
          campaignTitle: detail.value.title,
          participantName: detail.value.brand,
          participantInitials: detail.value.brand
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
          city: detail.value.city,
          defaultAmount: detail.value.budget,
          defaultDeliverables: "1 reel, 3 story frames, usage for 30 days",
        }
      : detail.type === "influencer"
        ? {
            campaignId: fallbackProposalContext.campaignId,
            campaignTitle: fallbackProposalContext.campaignTitle,
            participantName: detail.value.name,
            participantInitials: detail.value.initials,
            participantAvatarUrl: detail.value.avatarUrl,
            city: detail.value.city,
            defaultAmount: detail.value.price,
            defaultDeliverables: "1 reel, 3 story frames, usage for 30 days",
          }
        : detail.type === "profile"
          ? {
              campaignId: fallbackProposalContext.campaignId,
              campaignTitle: fallbackProposalContext.campaignTitle,
              participantName: detail.value.name,
              participantInitials: detail.value.initials,
              participantAvatarUrl: detail.value.avatarUrl,
              city: detail.value.city,
              defaultAmount: detail.value.price,
              defaultDeliverables: "1 reel, 3 story frames, usage for 30 days",
            }
        : fallbackProposalContext;
  if (flow)
    return (
      <FlowScreen
        flow={flow}
        role={role}
        onBack={closeFlow}
        onProposalSubmit={
          flow === "proposal"
            ? (draft) => onProposalSubmit(proposalContext, draft)
            : undefined
        }
        proposalContext={proposalContext}
        initialLocations={initialLocations}
        onProfileLocationsSave={onProfileLocationsSave}
        blockedUsers={blockedUsers}
        onUnblockUser={onBlockUser}
        notificationSettings={notificationSettings}
        onNotificationSettingsSave={onNotificationSettingsSave}
        onDeleteAccount={onDeleteAccount}
        initialSocialAccounts={initialSocialAccounts}
        verifiedSocialAccounts={verifiedSocialAccounts}
        pendingSocialAccounts={pendingSocialAccounts}
        socialAccountErrors={socialAccountErrors}
        onSocialVerificationRequest={onSocialVerificationRequest}
        onSocialAccountsSave={onSocialAccountsSave}
        onCampaignCreate={onCampaignCreate}
        onDealStatusSave={onDealStatusSave}
         onReviewSubmit={onReviewSubmit}
         reviewItems={reviewItems}
         onReviewRequest={() => setFlow("review")}
        authoredReviews={authoredReviews}
        onReviewUpdate={onReviewUpdate}
        savedCreators={savedCreators}
        initialDealStatus={initialDealStatus}
      />
    );
  if (detail.type === "chat")
    return (
      <ChatDetail
        name={detail.name}
        initials={detail.initials}
        role={role}
        onBack={onBack}
        onOpenProfile={() => onOpenChatProfile(detail.name, detail.returnTo)}
        blocked={blockedUsers.includes(detail.name)}
      />
    );
  if (detail.type === "campaign") {
    const campaignReviews = detail.value.brandReviews ?? [];
    return (
    <>
    <ScrollView style={styles.viewport} contentContainerStyle={styles.scroll}>
      <ProposalBack onBack={onBack} />
        <Pill label={initialDealStatus ?? detail.value.status} accent />
        <Text style={styles.detailTitle}>{detail.value.title}</Text>
        <Text style={styles.brand}>{detail.value.brand}</Text>
        <View style={styles.detailFacts}>
          <Fact label="Location" value={detail.value.city} />
          <Fact label="Budget" value={detail.value.budget} />
          <Fact label="Category" value={detail.value.category} />
          <Fact label="Deadline" value={formatCampaignDeadline(detail.value.deadlineAt ?? detail.value.deadline)} />
        </View>
        {role === "Influencer" ? (
          <>
            <AppCard style={styles.publicProfileCard}>
              <View style={styles.publicProfileHeader}>
                <Avatar
                  initials={detail.value.brand
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                  size="small"
                />
                <View style={styles.flex}>
                  <Text style={styles.tipTitle}>{detail.value.brand}</Text>
                  <Text style={styles.tipBody}>
                    {liveData ? "Brand profile" : `Verified brand profile · ${detail.value.category}`}
                  </Text>
                </View>
                <AppIcon
                  name="business-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              {!liveData ? (
                <SocialLinks
                  links={[
                    {
                      platform: "Instagram",
                      handle: `@${detail.value.brand.toLowerCase().replace(/\s+/g, "")}`,
                      verified: true,
                    },
                    { platform: "LinkedIn", handle: detail.value.brand },
                  ]}
                />
              ) : null}
            </AppCard>
            <ReviewSummary
              rating={campaignReviews.length ? campaignReviews.reduce((sum, review) => sum + review.rating, 0) / campaignReviews.length : 0}
              reviewCount={campaignReviews.length}
              onPress={() => setFlow("reviews")}
              note={campaignReviews.length ? "Creators value clear briefs, respectful communication and reliable approvals." : "No completed collaboration reviews are available yet."}
            />
            <AppButton
              label={
                blockedUsers.includes(detail.value.brand)
                  ? "Unblock brand"
                  : "Block brand"
              }
              variant="secondary"
              icon={
                blockedUsers.includes(detail.value.brand)
                  ? "lock-open-outline"
                  : "ban-outline"
              }
              onPress={() => setBlockTarget(detail.value.brand)}
            />
          </>
        ) : null}
        <AppCard>
          <Text style={styles.tipTitle}>Campaign brief</Text>
          <Text style={styles.tipBody}>
            {detail.value.description || "The campaign brief will appear here once the brand adds its details."}
          </Text>
        </AppCard>
        {role === "Influencer" ? (
          <>
            <AppButton
              label={liveData ? "Apply to this campaign" : existingProposal ? `View application · ${existingProposal.status}` : "Send proposal for this brief"}
              onPress={() => {
                if (liveData) onApplyToCampaign?.(detail.value);
                else if (existingProposal) onOpenProposal(existingProposal);
                else setFlow("proposal");
              }}
              icon="paper-plane-outline"
            />
            {!liveData ? <>
              <AppButton
                label="Update collaboration status"
                variant="secondary"
                onPress={() => setFlow("deal")}
                icon="checkmark-circle-outline"
              />
              <AppButton
                label="Leave a review"
                variant="secondary"
                onPress={() => setFlow("review")}
                icon="star-outline"
              />
            </> : null}
          </>
        ) : !liveData ? (
          <>
            <AppButton
              label="Review deal status"
              onPress={() => setFlow("deal")}
            />
            <AppButton
              label="Leave a review"
              variant="secondary"
              onPress={() => setFlow("review")}
            />
          </>
        ) : null}
      </ScrollView>
      {blockModal}
    </>
    );
  }
  if (detail.type === "profile") {
    const profile = detail.value;
    const creatorSaved = profile.kind === "creator" && savedCreatorIds.includes(profile.id);
    return (
      <>
        <ScrollView style={styles.viewport} contentContainerStyle={styles.scroll}>
          <ProposalBack onBack={onBack} />
          <View style={styles.creatorHero}>
            <Avatar initials={profile.initials} uri={profile.avatarUrl} size="large" />
            <View style={styles.flex}>
              <Text style={styles.detailTitle}>{profile.name}</Text>
              <Text style={styles.pageIntro}>
                {[profile.kind === "brand" ? "Brand account" : profile.niche, profile.city, profile.state].filter(Boolean).join(" · ")}
              </Text>
              <View style={styles.ratingRow}>
                <AppIcon name="star" size={15} color={theme.colors.accentText} />
                <Text style={styles.rating}>
                  {profile.rating} ({profile.reviews} reviews)
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.detailFacts}>
            <Fact label="Location" value={[profile.city, profile.state].filter(Boolean).join(", ") || "Not added"} />
            <Fact label={profile.kind === "brand" ? "Active briefs" : "Audience"} value={profile.followers} />
            <Fact label="Starting price" value={profile.price} />
            <Fact label="Platforms" value={profile.platforms.join(" + ")} />
          </View>
          <AppCard>
            <Text style={styles.tipTitle}>About this profile</Text>
            <Text style={styles.tipBody}>
              {liveData
                ? profile.bio || "No public bio has been added yet."
                : profile.kind === "brand"
                  ? "A collaboration-ready brand profile with clear briefs, thoughtful communication and an active marketplace presence."
                  : "A collaboration-ready creator profile with clear communication, reliable delivery and platform-native content."}
            </Text>
          </AppCard>
          <SocialLinks
            links={profile.platforms.map((platform) => ({
              platform,
              handle: liveData ? profile.socialAccounts?.[platform] || "Not added" : `${profile.name} · public profile`,
              verificationStatus: liveData
                ? (profile.socialVerification?.[platform] ?? "PENDING") as SocialVerificationStatus
                : verifiedSocialAccounts.includes(platform) ? "VERIFIED" : "PENDING",
            }))}
          />
          <ReviewSummary
            rating={profile.rating}
            reviewCount={profile.reviews}
            note="Recent collaboration partners highlight clear communication, reliable delivery and respectful working relationships."
            onPress={detail.readOnly ? undefined : () => setFlow("reviews")}
          />
          {!detail.readOnly ? (
            <AppButton
              label={blockedUsers.includes(profile.name) ? "Unblock user" : "Block user"}
              variant="secondary"
              icon={blockedUsers.includes(profile.name) ? "lock-open-outline" : "ban-outline"}
              onPress={() => { setBlockTarget(profile.name); setBlockTargetId(profile.id); }}
            />
          ) : null}
          {!detail.readOnly && role === "Brand" && profile.kind === "creator" ? (
            <AppButton
              label={creatorSaved ? "Creator saved" : "Save creator"}
              variant="secondary"
              icon={creatorSaved ? "bookmark" : "bookmark-outline"}
              onPress={() => onToggleCreatorSaved(profile.id)}
            />
          ) : null}
        </ScrollView>
        {blockModal}
      </>
    );
  }
  const item = detail.value;
  return (
    <>
    <ScrollView style={styles.viewport} contentContainerStyle={styles.scroll}>
      <ProposalBack onBack={onBack} />
      <View style={styles.creatorHero}>
        <Avatar initials={item.initials} uri={item.avatarUrl} size="large" />
        <View style={styles.flex}>
          <Text style={styles.detailTitle}>{item.name}</Text>
          <Text style={styles.pageIntro}>
            {item.niche} · {item.city}
            {item.state && item.state !== item.city ? ` · ${item.state}` : ""}
          </Text>
          <View style={styles.ratingRow}>
            <AppIcon name="star" size={15} color={theme.colors.accentText} />
            <Text style={styles.rating}>
              {item.rating} ({item.reviews} reviews)
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.detailFacts}>
        <Fact label="Audience" value={item.followers} />
        <Fact label="Starting price" value={item.price} />
        <Fact label="Platforms" value={item.platforms.join(" + ")} />
      </View>
      <AppCard>
        <Text style={styles.tipTitle}>About this creator</Text>
        <Text style={styles.tipBody}>
          Known for clear, relatable content and thoughtful brand
          collaborations. Final pricing is discussed privately after a proposal.
        </Text>
      </AppCard>
      <SectionTitle title="Past work" action="Portfolio" />
      {item.workHistory?.length ? (
        <View style={styles.pastWorkList}>
          {item.workHistory.map((work) => (
            <AppCard key={work.id} flat style={styles.pastWorkRow}>
              <View style={styles.pastWorkIcon}>
                <AppIcon name={work.media?.[0]?.type === "video" ? "videocam-outline" : work.media?.[0]?.type === "image" ? "image-outline" : "briefcase-outline"} size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.tipTitle}>{work.title}</Text>
                <Text style={styles.pageIntro}>{work.deliverables}</Text>
              </View>
            </AppCard>
          ))}
        </View>
      ) : <Text style={styles.tipBody}>No public work history has been added yet.</Text>}
      <SocialLinks
        links={item.platforms.map((platform) => ({
          platform,
          handle: item.socialAccounts?.[platform] ?? "Not added",
          verificationStatus: item.socialVerification?.[platform] ?? "PENDING",
        }))}
      />
      <ReviewSummary
        rating={item.rating}
        reviewCount={item.reviews}
        onPress={() => setFlow("reviews")}
        note="Recent partners highlight clear communication, reliable delivery and content that feels native to the platform."
      />
      <AppButton
        label={
          existingProposal
            ? `View proposal · ${existingProposal.status}`
            : "Send campaign proposal"
        }
        onPress={() =>
          existingProposal
            ? onOpenProposal(existingProposal)
            : setFlow("proposal")
        }
        icon="paper-plane-outline"
      />
      <AppButton
        label={blockedUsers.includes(item.name) ? "Unblock user" : "Block user"}
        variant="secondary"
        icon={blockedUsers.includes(item.name) ? "lock-open-outline" : "ban-outline"}
        onPress={() => { setBlockTarget(item.name); setBlockTargetId(item.id); }}
      />
      <AppButton
        label={savedCreatorIds.includes(item.id) ? "Creator saved" : "Save creator"}
        variant="secondary"
        icon={savedCreatorIds.includes(item.id) ? "bookmark" : "bookmark-outline"}
        onPress={() => onToggleCreatorSaved(item.id)}
      />
      {role === "Brand" ? (
        <AppButton
          label="Send campaign request"
          icon="paper-plane-outline"
          onPress={() => { setSelectedRequestCampaignIds([]); setRequestCampaignOpen(true); }}
        />
      ) : null}
    </ScrollView>
    {blockModal}
    <Modal visible={requestCampaignOpen} transparent animationType="slide" onRequestClose={closeRequestCampaignPicker}>
      <View style={styles.filterDrawerOverlay}>
        <Pressable style={styles.filterBackdrop} onPress={closeRequestCampaignPicker} />
        <View style={[styles.filterDrawer, { paddingBottom: theme.spacing.lg }]}>
          <View style={styles.filterSheetHandle} />
          <View style={styles.filterDrawerHeader}>
            <View style={styles.flex}>
              <Text style={styles.sheetTitle}>Choose a campaign</Text>
              <Text style={styles.sheetSubtitle}>Send this creator a request for a published campaign.</Text>
            </View>
            <IconButton name="close" label="Close campaign picker" onPress={closeRequestCampaignPicker} />
          </View>
          <ScrollView contentContainerStyle={styles.filterContent}>
            {campaignsLoading ? [1, 2, 3].map((item) => (
              <View key={item} style={styles.pageRow} accessibilityRole="progressbar">
                <View style={styles.flex}><Skeleton width="58%" height={14} /><Skeleton width="42%" height={11} /></View>
                <Skeleton width={18} height={18} />
              </View>
            )) : availableRequestCampaigns.map((campaign) => {
              const alreadySent = sentCampaignIds.includes(campaign.id);
              const selected = selectedRequestCampaignIds.includes(campaign.id);
              return <Pressable key={campaign.id} accessibilityRole="checkbox" accessibilityLabel={`${alreadySent ? "Campaign already sent" : selected ? "Remove" : "Select"} ${campaign.title}`} accessibilityState={{ checked: selected || alreadySent, disabled: alreadySent }} disabled={alreadySent} onPress={() => setSelectedRequestCampaignIds((current) => selected ? current.filter((id) => id !== campaign.id) : [...current, campaign.id])} style={[styles.pageRow, selected && styles.requestCampaignSelected, alreadySent && styles.requestCampaignDisabled]}>
                <View style={styles.flex}><Text style={styles.campaignRailTitle}>{campaign.title}</Text><Text style={styles.resultText}>{campaign.category} · {campaign.budget}</Text></View>
                <AppIcon name={alreadySent || selected ? "checkmark-circle-outline" : "add-circle-outline"} size={18} color={alreadySent ? theme.colors.textSecondary : theme.colors.primary} />
              </Pressable>;
            })}
            {!campaignsLoading && (availableRequestCampaigns.length ? <AppButton label={`Send ${selectedRequestCampaignIds.length} campaign${selectedRequestCampaignIds.length === 1 ? "" : "s"}`} icon="paper-plane-outline" disabled={!selectedRequestCampaignIds.length} onPress={() => { const selectedCampaigns = availableRequestCampaigns.filter((campaign) => selectedRequestCampaignIds.includes(campaign.id)); const sent = onSendCreatorRequests ? onSendCreatorRequests(detail.value, selectedCampaigns) : selectedCampaigns.forEach((campaign) => onSendCreatorRequest(detail.value, campaign)); if (sent || !onSendCreatorRequests) closeRequestCampaignPicker(); }} /> : <Text style={styles.sheetSubtitle}>Publish a campaign before sending a creator request.</Text>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
    </>
  );
}
