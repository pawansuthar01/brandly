import { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  AppButton,
  AppCard,
  AppIcon,
  Avatar,
  ConfirmModal,
  Pill,
} from "../../components/ui";
import { LocationFilterSheet } from "../../components/marketplace";
import { useMediaAttachments } from "../../hooks/useMediaAttachments";
import { INDIA_STATES } from "../../lib/indiaLocations";
import { useTheme } from "../../providers/ThemeProvider";
import { useToast } from "../../providers/ToastProvider";
import { AppTheme } from "../../styles/theme";
import {
  CampaignDraft,
  DealStatus,
  ProposalContext,
  ProposalDraft,
  SocialPlatform,
} from "../../types/marketplace";

export type MarketplaceFlow =
  | "proposal"
  | "deal"
  | "review"
  | "safety"
  | "legal"
  | "campaign-form"
  | "profile-form"
  | "social-accounts"
  | "saved"
  | "notification-settings"
  | "reviews"
  | "reviews-own"
  | "activity"
  | "blocked-users"
  | "support"
  | "delete-account";

export type NotificationSettings = {
  newMatches: boolean;
  proposalRequests: boolean;
  proposalUpdates: boolean;
  messages: boolean;
  profileActivity: boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  newMatches: true,
  proposalRequests: true,
  proposalUpdates: true,
  messages: true,
  profileActivity: true,
};

const CAMPAIGN_LOCATION_OPTIONS = Array.from(
  new Set([
    "Pan India",
    ...INDIA_STATES.map((item) => item.state),
    ...INDIA_STATES.flatMap((item) => item.cities.map((city) => city.name)),
  ]),
);
const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "Instagram",
  "YouTube",
  "TikTok",
  "Facebook",
  "Pinterest",
  "LinkedIn",
  "X",
];
type SocialAccountMap = Partial<Record<SocialPlatform, string>>;

export function FlowScreen({
  flow,
  role = "Brand",
  onBack,
  onProposalSubmit,
  onCampaignCreate,
  onDealStatusSave,
  onReviewSubmit,
  onReviewRequest,
  initialDealStatus,
  proposalContext,
  initialLocations,
  onProfileLocationsSave,
  onOpenCreator,
  initialSocialAccounts,
  verifiedSocialAccounts = [],
  onSocialAccountsSave,
  blockedUsers = [],
  onUnblockUser,
  notificationSettings = DEFAULT_NOTIFICATION_SETTINGS,
  onNotificationSettingsSave,
  onDeleteAccount,
}: {
  flow: MarketplaceFlow;
  role?: "Brand" | "Influencer";
  onBack: () => void;
  onProposalSubmit?: (draft: ProposalDraft) => void;
  onCampaignCreate?: (draft: CampaignDraft) => void;
  onDealStatusSave?: (status: DealStatus) => void;
  onReviewSubmit?: (subject: string) => void;
  onReviewRequest?: () => void;
  initialDealStatus?: DealStatus;
  proposalContext?: ProposalContext;
  initialLocations?: string[];
  onProfileLocationsSave?: (locations: string[]) => void;
  onOpenCreator?: (name: string) => void;
  initialSocialAccounts?: SocialAccountMap;
  verifiedSocialAccounts?: SocialPlatform[];
  onSocialAccountsSave?: (
    accounts: SocialAccountMap,
    verifiedPlatforms: SocialPlatform[],
  ) => void;
  blockedUsers?: string[];
  onUnblockUser?: (name: string) => void;
  notificationSettings?: NotificationSettings;
  onNotificationSettingsSave?: (settings: NotificationSettings) => void;
  onDeleteAccount?: () => void;
}) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const styles = makeStyles(theme);
  const [message, setMessage] = useState(
    "I would love to collaborate. My content approach will feel natural and useful for my audience.",
  );
  const [proposalTitle, setProposalTitle] = useState(
    role === "Influencer"
      ? "Creator application for this campaign"
      : "Creator collaboration proposal",
  );
  const [amount, setAmount] = useState(
    proposalContext?.defaultAmount ??
      (role === "Influencer" ? "₹14,000" : "₹12,000"),
  );
  const [deliverables, setDeliverables] = useState(
    proposalContext?.defaultDeliverables ??
      (role === "Influencer"
        ? "1 reel, 3 story frames, 30-day usage"
        : "1 reel, 3 story frames, usage for 30 days"),
  );
  const [profileLocations, setProfileLocations] = useState<string[]>(
    initialLocations?.length
      ? initialLocations
      : ["Mumbai", "Delhi", "Bengaluru", "Pan India"],
  );
  const [isProfileLocationOpen, setIsProfileLocationOpen] = useState(false);
  const [profileName, setProfileName] = useState(
    role === "Influencer" ? "Aarohi Mehta" : "Maya Studio",
  );
  const [profileCity, setProfileCity] = useState("Mumbai");
  const [profileFocus, setProfileFocus] = useState(
    role === "Influencer"
      ? "Fashion, beauty, routines · Reels, photos"
      : "Beauty & wellness partnerships",
  );
  const [profileBio, setProfileBio] = useState(
    role === "Influencer"
      ? "Fashion and beauty creator focused on useful, relatable routines."
      : "Building thoughtful brand collaborations.",
  );
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountMap>(
    initialSocialAccounts ?? {
      Instagram: role === "Influencer" ? "@aarohi.mehta" : "@mayastudio",
      YouTube: role === "Influencer" ? "Aarohi Mehta" : "",
      LinkedIn: role === "Brand" ? "Maya Studio" : "",
    },
  );
  const [verifiedSocials, setVerifiedSocials] =
    useState<SocialPlatform[]>(verifiedSocialAccounts);
  const [supportTopic, setSupportTopic] = useState("Help with a collaboration");
  const [supportMessage, setSupportMessage] = useState(
    "Please share the details so the support team can help.",
  );
  const [unblockTarget, setUnblockTarget] = useState<string | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const [localNotificationSettings, setLocalNotificationSettings] =
    useState<NotificationSettings>(notificationSettings);
  const [reviewLimit, setReviewLimit] = useState(3);
  const [reviewRating, setReviewRating] = useState(5);
  const [editingActivityReview, setEditingActivityReview] = useState<string | null>(null);
  const [activityReviewDraft, setActivityReviewDraft] = useState(
    "Clear communication and a smooth collaboration.",
  );
  const [attachmentToRemove, setAttachmentToRemove] = useState<string | null>(
    null,
  );
  const [campaignLocations, setCampaignLocations] = useState<string[]>([
    "Mumbai",
    "Bengaluru",
    "Pan India",
  ]);
  const [campaignTitle, setCampaignTitle] = useState("New creator campaign");
  const [campaignCategory, setCampaignCategory] = useState("Beauty");
  const [campaignBudget, setCampaignBudget] = useState("₹8,000 – ₹15,000");
  const [campaignDescription, setCampaignDescription] = useState(
    "Share goals, deliverables and preferred content format.",
  );
  const [isCampaignLocationOpen, setIsCampaignLocationOpen] = useState(false);
  const [dealStatus, setDealStatus] = useState<DealStatus>(
    initialDealStatus ?? "Completed",
  );
  const [successStep, setSuccessStep] = useState<
    "proposal" | "deal" | "review" | null
  >(null);
  const { attachments, addFile, addMedia, removeAttachment } =
    useMediaAttachments();
  const confirmUnblock = () => {
    if (unblockTarget) onUnblockUser?.(unblockTarget);
    setUnblockTarget(null);
  };
  const unblockModal = (
    <ConfirmModal
      visible={unblockTarget !== null}
      title="Unblock this user?"
      message="They will be allowed to contact you again if they meet the collaboration rules."
      confirmLabel="Unblock"
      confirmIcon="lock-open-outline"
      onCancel={() => setUnblockTarget(null)}
      onConfirm={confirmUnblock}
    />
  );
  const deleteModal = (
    <ConfirmModal
      visible={deleteConfirmVisible}
      title="Request account deletion?"
      message="You will be signed out now. You can cancel this request by signing in within 14 days; after that recovery is no longer available."
      confirmLabel="Request deletion"
      confirmIcon="trash-outline"
      destructive
      onCancel={() => setDeleteConfirmVisible(false)}
      onConfirm={() => {
        setDeleteConfirmVisible(false);
        onDeleteAccount?.();
        if (!onDeleteAccount) showToast("Deletion request recorded");
      }}
    />
  );
  const attachmentRemoveModal = (
    <ConfirmModal
      visible={attachmentToRemove !== null}
      title="Remove this attachment?"
      message="This file will be removed from the proposal before it is sent."
      confirmLabel="Remove"
      confirmIcon="trash-outline"
      destructive
      onCancel={() => setAttachmentToRemove(null)}
      onConfirm={() => {
        if (attachmentToRemove) removeAttachment(attachmentToRemove);
        setAttachmentToRemove(null);
      }}
    />
  );
  if (successStep) {
    const successCopy =
      successStep === "proposal"
        ? {
            icon: "paper-plane-outline" as const,
            title: role === "Influencer" ? "Application sent" : "Proposal sent",
            description:
              role === "Influencer"
                ? "Your application is now with the brand for review."
                : "Your proposal is now with the creator for review.",
            note: "We’ll notify you as soon as the other side responds.",
            primaryLabel: "Done",
          }
        : successStep === "deal"
          ? {
              icon: "checkmark-circle-outline" as const,
              title: "Collaboration status updated",
              description: `This collaboration is marked as ${dealStatus.toLowerCase()}.`,
              note: "The other participant will be notified about this update.",
              primaryLabel: "Leave a review",
            }
          : {
              icon: "star-outline" as const,
              title: "Review published",
              description: "Your feedback has been added to this collaboration.",
              note: "The other participant will be notified if review notifications are enabled.",
              primaryLabel: "Done",
            };
    return (
      <SuccessScreen
        icon={successCopy.icon}
        title={successCopy.title}
        description={successCopy.description}
        note={successCopy.note}
        primaryLabel={successCopy.primaryLabel}
        onPrimary={() => {
          if (successStep === "deal") {
            setSuccessStep(null);
            if (onReviewRequest) onReviewRequest();
            else onBack();
            return;
          }
          setSuccessStep(null);
          onBack();
        }}
        secondaryLabel={successStep === "deal" ? "Back" : undefined}
        onSecondary={
          successStep === "deal"
            ? () => {
                setSuccessStep(null);
                onBack();
              }
            : undefined
        }
      />
    );
  }
  if (flow === "proposal")
    return (
      <>
      <ScrollView contentContainerStyle={styles.screen}>
        <Back onBack={onBack} />
        <Pill
          label={
            role === "Influencer" ? "CAMPAIGN APPLICATION" : "CAMPAIGN PROPOSAL"
          }
          accent
        />
        <Text style={styles.title}>
          {role === "Influencer"
            ? "Apply with a clear quote"
            : "Send a clear proposal"}
        </Text>
        <Text style={styles.body}>
          {role === "Influencer"
            ? "Share your fit, deliverables and quote with the brand. Your profile and selected files stay attached to this application."
            : "The final quote and deliverables stay private between both parties."}
        </Text>
        <AppCard style={styles.summary}>
          <Text style={styles.label}>Campaign</Text>
          <Text style={styles.value}>
            {proposalContext?.campaignTitle ?? "Monsoon glow routine"}
          </Text>
          <Text style={styles.label}>
            {role === "Influencer" ? "Brand" : "Creator"}
          </Text>
          <Text style={styles.value}>
            {`${proposalContext?.participantName ?? (role === "Influencer" ? "Mellow Skincare" : "Aarohi Mehta")} · ${proposalContext?.city ?? "Mumbai"}`}
          </Text>
        </AppCard>
        <Field
          label="Proposal title"
          value={proposalTitle}
          onChangeText={setProposalTitle}
        />
        <Field
          label={role === "Influencer" ? "Your quote" : "Your proposed budget"}
          value={amount}
          onChangeText={setAmount}
        />
        <Field
          label="Deliverables"
          value={deliverables}
          multiline
          onChangeText={setDeliverables}
        />
        <Field
          label="Message"
          value={message}
          multiline
          onChangeText={setMessage}
        />
        <View style={styles.attachmentActions}>
          <View style={styles.attachmentAction}>
            <AppButton
              label="Add media"
              variant="secondary"
              compact
              icon="image-outline"
              onPress={addMedia}
              style={styles.attachmentButton}
            />
          </View>
          <View style={styles.attachmentAction}>
            <AppButton
              label="Attach file"
              variant="secondary"
              compact
              icon="attach-outline"
              onPress={addFile}
              style={styles.attachmentButton}
            />
          </View>
        </View>
        {attachments.length ? (
          <View style={styles.attachmentList}>
            {attachments.map((item) => (
              <AppCard key={item.id} style={styles.attachmentRow}>
                <AppIcon
                  name={
                    item.type === "file"
                      ? "document-outline"
                      : item.type === "video"
                        ? "videocam-outline"
                        : "image-outline"
                  }
                  size={18}
                  color={theme.colors.primary}
                />
                <Text numberOfLines={1} style={styles.attachmentName}>
                  {item.name}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name} from proposal`}
                  onPress={() => setAttachmentToRemove(item.id)}
                  hitSlop={8}
                >
                  <AppIcon
                    name="close-circle-outline"
                    size={18}
                    color={theme.colors.danger}
                  />
                </Pressable>
              </AppCard>
            ))}
          </View>
        ) : null}
        <AppButton
          label={role === "Influencer" ? "Send application" : "Send proposal"}
          onPress={() => {
            onProposalSubmit?.({
              title: proposalTitle,
              amount,
              deliverables,
              message,
              attachments,
            });
            setSuccessStep("proposal");
          }}
        />
      </ScrollView>
      {attachmentRemoveModal}
      </>
    );
  if (flow === "deal")
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <Back onBack={onBack} />
        <Pill label="COLLABORATION STATUS" accent />
        <Text style={styles.title}>Update this deal</Text>
        <Text style={styles.body}>
          Only completed collaborations can receive ratings and reviews.
        </Text>
        <Choice
          label="Mark as completed"
          description="Content and agreed deliverables are complete."
          selected={dealStatus === "Completed"}
          onPress={() => setDealStatus("Completed")}
        />
        <Choice
          label="Cancel collaboration"
          description="Use if both parties decided not to proceed."
          selected={dealStatus === "Cancelled"}
          onPress={() => setDealStatus("Cancelled")}
        />
        <Choice
          label="Report a dispute"
          description="Keep the conversation open and ask admin for support."
          selected={dealStatus === "Reported"}
          onPress={() => setDealStatus("Reported")}
        />
        <AppButton
          label="Update collaboration status"
          icon="checkmark-circle-outline"
          onPress={() => {
            onDealStatusSave?.(dealStatus);
            setSuccessStep("deal");
          }}
        />
      </ScrollView>
    );
  if (flow === "review")
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <Back onBack={onBack} />
        <Pill label="COMPLETED DEAL" accent />
        <Text style={styles.title}>Leave honest feedback</Text>
        <Text style={styles.body}>
          Your review helps people make better collaboration decisions.
        </Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              accessibilityRole="button"
              accessibilityLabel={`${star} star${star === 1 ? "" : "s"}`}
              accessibilityState={{ selected: reviewRating === star }}
              hitSlop={8}
              onPress={() => setReviewRating(star)}
              style={({ pressed }) => [
                styles.starButton,
                pressed && styles.pressed,
              ]}
            >
              <AppIcon
                name={reviewRating >= star ? "star" : "star-outline"}
                size={26}
                color={theme.colors.accentText}
              />
            </Pressable>
          ))}
        </View>
        <Field
          label="Your feedback"
          value="Professional, clear communication and a smooth collaboration."
          multiline
          onChangeText={() => undefined}
        />
        <AppButton
          label="Publish review"
          icon="star-outline"
          onPress={() => {
            onReviewSubmit?.(
              proposalContext?.participantName ??
                (role === "Brand" ? "your creator partner" : "your brand partner"),
            );
            setSuccessStep("review");
          }}
        />
      </ScrollView>
    );
  if (flow === "campaign-form")
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <Back onBack={onBack} />
        <Pill label="NEW CAMPAIGN" accent />
        <Text style={styles.title}>Create a clear brief</Text>
        <Text style={styles.body}>
          Better detail makes matching more useful for both sides.
        </Text>
        <Field
          label="Campaign title"
          value={campaignTitle}
          onChangeText={setCampaignTitle}
        />
        <Field
          label="Category"
          value={campaignCategory}
          onChangeText={setCampaignCategory}
        />
        <View style={styles.locationFieldGroup}>
          <Text style={styles.label}>Target cities / states</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select campaign target locations"
            onPress={() => setIsCampaignLocationOpen(true)}
            style={({ pressed }) => [
              styles.locationField,
              pressed && styles.locationFieldPressed,
            ]}
          >
            <AppIcon
              name="location-outline"
              size={20}
              color={theme.colors.primary}
            />
            <Text numberOfLines={3} style={styles.locationFieldText}>
              {campaignLocations.length
                ? campaignLocations.join(" · ")
                : "Choose one or more locations"}
            </Text>
            <AppIcon
              name="chevron-forward"
              size={18}
              color={theme.colors.textSecondary}
            />
          </Pressable>
          <LocationFilterSheet
            visible={isCampaignLocationOpen}
            locations={CAMPAIGN_LOCATION_OPTIONS}
            selected={campaignLocations}
            subtitle="Select one or more campaign target locations"
            searchAccessibilityLabel="Search campaign target locations"
            onClose={() => setIsCampaignLocationOpen(false)}
            onApply={setCampaignLocations}
          />
        </View>
        <Field
          label="Budget range"
          value={campaignBudget}
          onChangeText={setCampaignBudget}
        />
        <Field
          label="What do you need?"
          value={campaignDescription}
          multiline
          onChangeText={setCampaignDescription}
        />
        <AppButton
          label="Create campaign"
          icon="briefcase-outline"
          onPress={() => {
            const title = campaignTitle.trim();
            const category = campaignCategory.trim() || "General";
            const city = campaignLocations[0] ?? "Pan India";
            if (!title) {
              showToast("Add a campaign title first");
              return;
            }
            onCampaignCreate?.({
              title,
              city,
              category,
              budget: campaignBudget.trim() || "Flexible budget",
              description:
                campaignDescription.trim() ||
                "Share goals, deliverables and preferred content format.",
            });
            showToast("Campaign created and ready for creator matches");
            onBack();
          }}
        />
      </ScrollView>
    );
  if (flow === "profile-form")
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <Back onBack={onBack} />
        <Pill
          label={role === "Influencer" ? "CREATOR PROFILE" : "BRAND PROFILE"}
          accent
        />
        <Text style={styles.title}>Edit your profile</Text>
        <Text style={styles.body}>
          Keep your public profile complete so relevant matches can find you.
        </Text>
        <Field
          label="Display name"
          value={profileName}
          onChangeText={setProfileName}
        />
        <Field label="City" value={profileCity} onChangeText={setProfileCity} />
        <View style={styles.locationFieldGroup}>
          <Text style={styles.label}>Profile locations</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select profile locations"
            onPress={() => setIsProfileLocationOpen(true)}
            style={({ pressed }) => [
              styles.locationField,
              pressed && styles.locationFieldPressed,
            ]}
          >
            <AppIcon
              name="location-outline"
              size={20}
              color={theme.colors.primary}
            />
            <Text numberOfLines={3} style={styles.locationFieldText}>
              {profileLocations.length
                ? profileLocations.join(" · ")
                : "Choose one or more locations"}
            </Text>
            <AppIcon
              name="chevron-forward"
              size={18}
              color={theme.colors.textSecondary}
            />
          </Pressable>
          <LocationFilterSheet
            visible={isProfileLocationOpen}
            locations={CAMPAIGN_LOCATION_OPTIONS}
            selected={profileLocations}
            subtitle="Select one or more cities or states"
            searchAccessibilityLabel="Search profile locations"
            onClose={() => setIsProfileLocationOpen(false)}
            onApply={setProfileLocations}
          />
        </View>
        <Field label="Email" value="maya@example.com" editable={false} />
        <Field label="Phone" value="+91 98••••••42" editable={false} />
        <Field
          label={
            role === "Influencer" ? "Niche & content style" : "Company focus"
          }
          value={profileFocus}
          multiline
          onChangeText={setProfileFocus}
        />
        <Field
          label="Bio"
          value={profileBio}
          multiline
          onChangeText={setProfileBio}
        />
        <AppButton
          label="Save profile"
          onPress={() => {
            onProfileLocationsSave?.(profileLocations);
            showToast("Profile details saved");
          }}
        />
      </ScrollView>
    );
  if (flow === "social-accounts") {
    const linkedPlatforms = SOCIAL_PLATFORMS.filter((platform) =>
      Boolean(socialAccounts[platform]),
    );
    const allLinkedAccountsVerified =
      linkedPlatforms.length > 0 &&
      linkedPlatforms.every((platform) => verifiedSocials.includes(platform));
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <Back onBack={onBack} />
        <Pill label="SOCIAL ACCOUNTS" accent />
        <Text style={styles.title}>Add and verify accounts</Text>
        <Text style={styles.body}>
          Add the public accounts you want people to review. Verification confirms ownership; it does not imply endorsement by the platform.
        </Text>
        {SOCIAL_PLATFORMS.map((platform) => {
          const value = socialAccounts[platform] ?? "";
          const isVerified = verifiedSocials.includes(platform);
          return (
            <View key={platform} style={styles.socialAccountRow}>
              <Field
                label={platform}
                value={value}
                onChangeText={(nextValue) =>
                  {
                    setSocialAccounts((current) => ({
                      ...current,
                      [platform]: nextValue,
                    }));
                    if (nextValue !== value) {
                      setVerifiedSocials((current) =>
                        current.filter((item) => item !== platform),
                      );
                    }
                  }
                }
              />
              <AppButton
                label={isVerified ? "Verified" : value ? "Verify" : "Add account"}
                compact
                variant={isVerified ? "secondary" : "ghost"}
                icon={isVerified ? "checkmark-circle-outline" : "link-outline"}
                disabled={!value && !isVerified}
                onPress={() => {
                  if (!value) return;
                  setVerifiedSocials((current) =>
                    current.includes(platform) ? current : [...current, platform],
                  );
                  showToast(`${platform} verification complete`);
                }}
              />
            </View>
          );
        })}
        <AppButton
          label="Save social accounts"
          icon="checkmark"
          disabled={!allLinkedAccountsVerified}
          onPress={() => {
            onSocialAccountsSave?.(socialAccounts, verifiedSocials);
            showToast("Social accounts saved");
          }}
        />
      </ScrollView>
    );
  }
  if (flow === "blocked-users")
    return (
      <>
        <ScrollView contentContainerStyle={styles.screen}>
          <Back onBack={onBack} />
          <Pill label="ACCOUNT CONTROL" accent />
          <Text style={styles.title}>Blocked users</Text>
          <Text style={styles.body}>
            People you block cannot start new conversations with you in the app.
          </Text>
          {blockedUsers.length ? (
            blockedUsers.map((name) => (
              <AppCard key={name} flat style={styles.blockedUserRow}>
                <Avatar
                  initials={name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                  size="small"
                />
                <View style={styles.flex}>
                  <Text style={styles.value}>{name}</Text>
                  <Text style={styles.body}>Blocked from your account</Text>
                </View>
                <AppButton
                  label="Unblock"
                  compact
                  variant="secondary"
                  icon="lock-open-outline"
                  onPress={() => setUnblockTarget(name)}
                />
              </AppCard>
            ))
          ) : (
            <AppCard flat style={styles.emptyState}>
              <AppIcon
                name="shield-checkmark-outline"
                size={24}
                color={theme.colors.primary}
              />
              <Text style={styles.value}>No blocked users</Text>
              <Text style={styles.body}>
                Profiles you block will appear here for easy management.
              </Text>
            </AppCard>
          )}
        </ScrollView>
        {unblockModal}
      </>
    );
  if (flow === "notification-settings")
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <Back onBack={onBack} />
        <Pill label="NOTIFICATION SETTINGS" accent />
        <Text style={styles.title}>Choose what reaches you</Text>
        <Text style={styles.body}>
          Turn off any update you do not want. Unread notifications are the only
          ones shown in your notification inbox.
        </Text>
        <PreferenceToggle
          label="New campaign matches"
          description="Relevant briefs, creators and brands in your preferred categories or locations."
          value={localNotificationSettings.newMatches}
          onChange={(value) =>
            setLocalNotificationSettings((current) => ({
              ...current,
              newMatches: value,
            }))
          }
        />
        <PreferenceToggle
          label="Proposal requests"
          description="When someone sends you a new proposal or application."
          value={localNotificationSettings.proposalRequests}
          onChange={(value) =>
            setLocalNotificationSettings((current) => ({
              ...current,
              proposalRequests: value,
            }))
          }
        />
        <PreferenceToggle
          label="Proposal status changes"
          description="Accepts, declines and updates to proposals you sent or received."
          value={localNotificationSettings.proposalUpdates}
          onChange={(value) =>
            setLocalNotificationSettings((current) => ({
              ...current,
              proposalUpdates: value,
            }))
          }
        />
        <PreferenceToggle
          label="Messages and attachments"
          description="New chat messages and files shared in accepted collaborations."
          value={localNotificationSettings.messages}
          onChange={(value) =>
            setLocalNotificationSettings((current) => ({
              ...current,
              messages: value,
            }))
          }
        />
        <PreferenceToggle
          label="Profile and review activity"
          description="Profile visibility, reviews and account activity updates."
          value={localNotificationSettings.profileActivity}
          onChange={(value) =>
            setLocalNotificationSettings((current) => ({
              ...current,
              profileActivity: value,
            }))
          }
        />
        <AppButton
          label="Save notification settings"
          icon="checkmark"
          onPress={() => {
            onNotificationSettingsSave?.(localNotificationSettings);
            showToast("Notification settings saved");
          }}
        />
      </ScrollView>
    );
  if (flow === "reviews" || flow === "reviews-own") {
    const reviewItems =
      role === "Brand"
        ? [
            ["Aarohi Mehta", "5.0", "Clear brief, quick approvals and respectful communication."],
            ["Rohan Kapoor", "4.8", "Reliable delivery and content that felt native to our audience."],
            ["Neha Arora", "4.7", "Easy to coordinate with and thoughtful about the campaign goals."],
            ["Ishita Shah", "4.6", "Kind feedback and a well-scoped collaboration brief."],
            ["Kabir Jain", "4.5", "A smooth process with clear expectations from the start."],
          ]
        : [
            ["Mellow Skincare", "4.9", "A dependable creator with clear communication and strong execution."],
            ["Northstar Living", "4.8", "Delivered on time and adapted the content naturally for the brief."],
            ["Kindred Coffee", "4.8", "Professional collaboration from proposal through final delivery."],
            ["Luma Wellness", "4.7", "A clear campaign brief and a respectful working relationship."],
            ["Field Notes Co.", "4.6", "Good planning, timely communication and thoughtful approvals."],
          ];
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <Back onBack={onBack} />
        <Pill label="REVIEWS" accent />
        <Text style={styles.title}>
          {flow === "reviews-own"
            ? "Your reviews"
            : role === "Brand"
              ? "Creator reviews"
              : "Brand reviews"}
        </Text>
        <Text style={styles.body}>
          Read feedback from people who completed a collaboration with this profile.
        </Text>
        {reviewItems.slice(0, reviewLimit).map(([name, rating, note]) => (
          <AppCard flat key={name} style={styles.reviewItem}>
            <View style={styles.reviewItemHeader}>
              <Avatar initials={name.split(" ").map((part) => part[0]).join("").slice(0, 2)} size="small" />
              <View style={styles.flex}>
                <Text style={styles.value}>{name}</Text>
                <View style={styles.reviewItemRating}>
                  <AppIcon name="star" size={15} color={theme.colors.accent} />
                  <Text style={styles.body}>{rating} / 5</Text>
                </View>
              </View>
            </View>
            <Text style={styles.body}>{note}</Text>
          </AppCard>
        ))}
        {reviewItems.length > 3 ? (
          <AppButton
            label={reviewLimit >= reviewItems.length ? "Show fewer reviews" : "Show more reviews"}
            variant="secondary"
            icon={reviewLimit >= reviewItems.length ? "chevron-up" : "chevron-down"}
            onPress={() =>
              setReviewLimit((current) =>
                current >= reviewItems.length ? 3 : reviewItems.length,
              )
            }
          />
        ) : null}
      </ScrollView>
    );
  }
  if (flow === "activity") {
    const ownReviews =
      role === "Brand"
        ? [
            ["Aarohi Mehta", "5.0", "Clear brief, quick approvals and respectful communication."],
            ["Rohan Kapoor", "4.8", "Reliable delivery and content that felt native to our audience."],
          ]
        : [
            ["Mellow Skincare", "5.0", "A thoughtful team with a clear brief and fast feedback."],
            ["Northstar Living", "4.7", "Professional approvals and a well-organised campaign."],
          ];
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <Back onBack={onBack} />
        <Pill label="YOUR ACTIVITY" accent />
        <Text style={styles.title}>Reviews you have written</Text>
        <Text style={styles.body}>
          Keep your feedback accurate. You can edit your review after a completed collaboration.
        </Text>
        {ownReviews.map(([name, rating, note]) => (
          <AppCard flat key={name} style={styles.activityReview}>
            <View style={styles.activityReviewHeader}>
              <View style={styles.flex}>
                <Text style={styles.value}>{name}</Text>
                <Text style={styles.body}>{rating} / 5 · Published</Text>
              </View>
              <AppButton
                label="Edit"
                compact
                variant="ghost"
                icon="create-outline"
                onPress={() => {
                  setEditingActivityReview(name);
                  setActivityReviewDraft(note);
                }}
              />
            </View>
            {editingActivityReview === name ? (
              <>
                <Field
                  label="Review"
                  value={activityReviewDraft}
                  multiline
                  onChangeText={setActivityReviewDraft}
                />
                <AppButton
                  label="Save review"
                  compact
                  onPress={() => {
                    setEditingActivityReview(null);
                    showToast("Review updated");
                  }}
                />
              </>
            ) : (
              <Text style={styles.body}>{note}</Text>
            )}
          </AppCard>
        ))}
      </ScrollView>
    );
  }
  if (flow === "support")
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <Back onBack={onBack} />
        <Pill label="SUPPORT CENTER" accent />
        <Text style={styles.title}>How can we help?</Text>
        <Text style={styles.body}>
          Tell us what you need help with. Keep collaboration details inside the app so the right team can respond.
        </Text>
        <Field
          label="What do you need help with?"
          value={supportTopic}
          onChangeText={setSupportTopic}
        />
        <Field
          label="Message"
          value={supportMessage}
          multiline
          onChangeText={setSupportMessage}
        />
        <AppButton
          label="Send support request"
          icon="paper-plane-outline"
          onPress={() => {
            setSupportTopic("");
            setSupportMessage("");
            showToast("Support received. Our team will contact you within 24 hours.");
          }}
        />
      </ScrollView>
    );
  if (flow === "delete-account")
    return (
      <>
        <ScrollView contentContainerStyle={styles.screen}>
          <Back onBack={onBack} />
          <Pill label="ACCOUNT CONTROL" accent />
          <Text style={styles.title}>Request account deletion</Text>
          <Text style={styles.body}>
            This removes your marketplace profile and starts the account deletion review. Some records may be retained where legally required.
          </Text>
          <AppCard flat style={styles.notice}>
            <Text style={styles.noticeTitle}>14-day recovery window</Text>
            <Text style={styles.body}>
              Your session ends immediately after confirmation. Sign in within 14 days to cancel deletion; after the window, the account is permanently removed.
            </Text>
          </AppCard>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: deleteAcknowledged }}
            onPress={() => setDeleteAcknowledged((current) => !current)}
            style={({ pressed }) => [styles.checkboxRow, pressed && styles.pressed]}
          >
            <View style={[styles.checkbox, deleteAcknowledged && styles.checkboxSelected]}>
              {deleteAcknowledged ? (
                <AppIcon name="checkmark" size={17} color={theme.colors.primaryText} />
              ) : null}
            </View>
            <View style={styles.flex}>
              <Text style={styles.value}>I understand the 14-day recovery window</Text>
              <Text style={styles.body}>
                You will be signed out immediately. Sign in within 14 days to cancel the request; after that, the account cannot be restored.
              </Text>
            </View>
          </Pressable>
          <AppButton
            label="Request account deletion"
            variant="secondary"
            icon="trash-outline"
            disabled={!deleteAcknowledged}
            onPress={() => setDeleteConfirmVisible(true)}
          />
        </ScrollView>
        {deleteModal}
      </>
    );
  if (flow === "saved")
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <Back onBack={onBack} />
        <Pill label="SAVED PROFILES" accent />
        <Text style={styles.title}>Your shortlists</Text>
        <Text style={styles.body}>
          Save profiles to compare them before sending a proposal.
        </Text>
        <AppCard flat onPress={() => onOpenCreator?.("Aarohi Mehta")}>
          <Text style={styles.value}>
            Aarohi Mehta · Fashion & Beauty
          </Text>
          <Text style={styles.body}>
            Mumbai · 128K followers · ₹8K – ₹15K
          </Text>
        </AppCard>
        <AppCard flat onPress={() => onOpenCreator?.("Rohan Kapoor")}>
          <Text style={styles.value}>
            Rohan Kapoor · Food & Lifestyle
          </Text>
          <Text style={styles.body}>
            Delhi · 84K followers · ₹6K – ₹12K
          </Text>
        </AppCard>
      </ScrollView>
    );
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Back onBack={onBack} />
      <Pill label="POLICIES" accent />
      <Text style={styles.title}>Privacy and community policies</Text>
      <Text style={styles.body}>
        Review the rules and privacy controls that apply to every account and collaboration.
      </Text>
      <AppCard flat>
        <Text style={styles.value}>Privacy Policy</Text>
        <Text style={styles.body}>
          How profile details, social links, messages and account deletion are handled.
        </Text>
      </AppCard>
      <AppCard flat>
        <Text style={styles.value}>Terms & Community Guidelines</Text>
        <Text style={styles.body}>
          Keep proposals respectful, report abuse and use block controls when needed.
        </Text>
      </AppCard>
    </ScrollView>
    );
}

function SuccessScreen({
  icon,
  title,
  description,
  note,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  icon:
    | "paper-plane-outline"
    | "checkmark-circle-outline"
    | "star-outline";
  title: string;
  description: string;
  note: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <ScrollView
      contentContainerStyle={styles.successScreen}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.successIcon}>
        <AppIcon name={icon} size={36} color={theme.colors.primary} />
      </View>
      <Text style={styles.successTitle}>{title}</Text>
      <Text style={styles.successDescription}>{description}</Text>
      <AppCard flat style={styles.successNote}>
        <AppIcon
          name="information-circle-outline"
          size={20}
          color={theme.colors.primary}
        />
        <Text style={styles.successNoteText}>{note}</Text>
      </AppCard>
      <AppButton
        label={primaryLabel}
        icon="arrow-forward"
        onPress={onPrimary}
      />
      {secondaryLabel && onSecondary ? (
        <AppButton
          label={secondaryLabel}
          variant="secondary"
          icon="chevron-back"
          onPress={onSecondary}
        />
      ) : null}
    </ScrollView>
  );
}

function Back({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const locked = useRef(false);
  const handlePress = () => {
    if (locked.current) return;
    locked.current = true;
    onBack();
    setTimeout(() => {
      locked.current = false;
    }, 450);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
      onPress={handlePress}
    >
      <Text style={styles.back}>‹ Back</Text>
    </Pressable>
  );
}
function Choice({
  label,
  description,
  selected = false,
  flat = false,
  onPress,
}: {
  label: string;
  description: string;
  selected?: boolean;
  flat?: boolean;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <AppCard flat={flat} onPress={onPress} style={styles.choice}>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <Text style={styles.radioTick}>✓</Text> : null}
      </View>
      <View style={styles.flex}>
        <Text style={styles.value}>{label}</Text>
        <Text style={styles.body}>{description}</Text>
      </View>
    </AppCard>
  );
}

function PreferenceToggle({
  label,
  description,
  initialValue = false,
  value,
  onChange,
}: {
  label: string;
  description: string;
  initialValue?: boolean;
  value?: boolean;
  onChange?: (value: boolean) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [internalEnabled, setInternalEnabled] = useState(initialValue);
  const enabled = value ?? internalEnabled;
  const toggle = () => {
    const nextValue = !enabled;
    if (value === undefined) setInternalEnabled(nextValue);
    onChange?.(nextValue);
  };
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      onPress={toggle}
      style={({ pressed }) => [styles.preferenceRow, pressed && styles.pressed]}
    >
      <View style={styles.flex}>
        <Text style={styles.value}>{label}</Text>
        <Text style={styles.body}>{description}</Text>
      </View>
      <View style={[styles.toggle, enabled && styles.toggleEnabled]}>
        <View style={[styles.toggleThumb, enabled && styles.toggleThumbEnabled]} />
      </View>
    </Pressable>
  );
}
function Field({
  label,
  value,
  multiline = false,
  onChangeText,
  editable = true,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onChangeText?: (text: string) => void;
  editable?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...(onChangeText ? { value, onChangeText } : { defaultValue: value })}
        editable={editable}
        multiline={multiline}
        style={[styles.input, multiline && styles.textarea, !editable && styles.inputReadOnly]}
        placeholderTextColor={theme.colors.textSecondary}
      />
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    screen: {
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
      backgroundColor: theme.colors.background,
      flexGrow: 1,
    },
    successScreen: {
      minHeight: "100%",
      padding: theme.spacing.xl,
      paddingBottom: theme.spacing.xxl,
      justifyContent: "center",
      gap: theme.spacing.lg,
      backgroundColor: theme.colors.background,
    },
    successIcon: {
      width: 76,
      height: 76,
      borderRadius: theme.radius.lg,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      backgroundColor: theme.colors.accent,
    },
    successTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.display,
      lineHeight: 36,
      fontWeight: "900",
      textAlign: "center",
    },
    successDescription: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.bodyLarge,
      lineHeight: 24,
      textAlign: "center",
    },
    successNote: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    successNoteText: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      lineHeight: 21,
    },
    back: {
      color: theme.colors.primary,
      fontSize: theme.type.body,
      fontWeight: "800",
      minHeight: 44,
      paddingVertical: theme.spacing.sm,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.display,
      fontWeight: "900",
    },
    body: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.body,
      lineHeight: 21,
    },
    summary: { gap: theme.spacing.xs },
    label: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontWeight: "700",
      marginTop: theme.spacing.xs,
    },
    value: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      fontWeight: "800",
    },
    input: {
      minHeight: 50,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
    },
    inputReadOnly: {
      color: theme.colors.textSecondary,
      backgroundColor: theme.colors.surfaceMuted,
    },
    blockedUserRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    emptyState: { gap: theme.spacing.sm },
    textarea: {
      minHeight: 120,
      paddingTop: theme.spacing.md,
      textAlignVertical: "top",
    },
    locationFieldGroup: { gap: theme.spacing.xs },
    locationField: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    locationFieldPressed: { backgroundColor: theme.colors.surfaceMuted },
    locationFieldText: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      lineHeight: 20,
    },
    socialAccountRow: { gap: theme.spacing.xs },
    choice: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    checkboxRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    reviewItem: { gap: theme.spacing.sm },
    reviewItemHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    reviewItemRating: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    activityReview: { gap: theme.spacing.sm },
    activityReviewHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    radioSelected: {
      backgroundColor: theme.colors.primary,
    },
    radioTick: { color: theme.colors.primaryText, fontWeight: "900" },
    flex: { flex: 1 },
    preferenceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    toggle: {
      width: 48,
      height: 28,
      padding: 3,
      justifyContent: "center",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.border,
    },
    toggleEnabled: { backgroundColor: theme.colors.primary },
    toggleThumb: {
      width: 22,
      height: 22,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surface,
    },
    toggleThumbEnabled: { alignSelf: "flex-end" },
    pressed: { opacity: 0.78 },
    notice: { backgroundColor: theme.colors.surfaceMuted },
    noticeTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      fontWeight: "800",
      marginBottom: theme.spacing.xs,
    },
    stars: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
    },
    starButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    attachmentActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    attachmentAction: {
      flexGrow: 1,
      flexBasis: 140,
      minWidth: 132,
    },
    attachmentButton: { width: "100%" },
    attachmentList: { gap: theme.spacing.xs },
    attachmentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    attachmentName: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
  });
