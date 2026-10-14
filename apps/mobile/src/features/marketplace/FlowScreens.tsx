import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AppButton,
  AppCard,
  AppIcon,
  Avatar,
  DateTimeField,
  ConfirmModal,
  FilterChip,
  IconButton,
  Pill,
  ProfilePhotoPicker,
  SearchField,
  Toggle,
} from "../../components/ui";
import { LocationFilterSheet } from "../../components/marketplace";
import {
  AUDIENCE_SIZE_OPTIONS,
  CAMPAIGN_BUDGET_OPTIONS,
  CREATOR_CATEGORIES,
  CREATOR_RATE_OPTIONS,
  INDIA_LOCATION_OPTIONS,
  INDUSTRY_OPTIONS,
  NATIVE_LANGUAGE_OPTIONS,
  SOCIAL_PLATFORM_REGISTRY,
  TEAM_SIZE_OPTIONS,
} from "./marketplaceDomain";
import { DropdownPickerField, LocationPickerField } from "./auth/AuthPrimitives";
import { useMediaAttachments } from "../../hooks/useMediaAttachments";
import { INDIA_STATES } from "../../lib/indiaLocations";
import { formatReminderDate, formatReminderTime, parseReminderDateTime } from "../../lib/reminders";
import { campaignDeadlineInputs, combineCampaignDeadline, formatDisplayDateTime } from "../../lib/dateTime";
import { getReminderToneLabel, REMINDER_TONES } from "../../lib/reminderTones";
import { useTheme } from "../../providers/ThemeProvider";
import { useToast } from "../../providers/ToastProvider";
import {
  previewReminderSound,
  stopReminderSoundPreview,
} from "../../services/reminders.service";
import { selectFileAttachment, selectMediaAttachment } from "../../services/mediaPicker.service";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import {
  CampaignDraft,
  Campaign,
  DealStatus,
  ProposalContext,
  ProposalDraft,
  DemoAttachment,
  ProfileDraft,
  Reminder,
  ReminderSettings,
  ReminderTone,
  SocialPlatform,
  CreatorReview,
  PublicCreatorProfile,
  AuthoredReview,
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
  | "reminders"
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
  reminders: boolean;
};

type ReviewListItem = Pick<CreatorReview, "id" | "author" | "rating" | "text" | "date" | "tags">;
export type ReviewDraft = { subject: string; rating: number; text: string };

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  newMatches: true,
  proposalRequests: true,
  proposalUpdates: true,
  messages: true,
  profileActivity: true,
  reminders: true,
};

const CAMPAIGN_LOCATION_OPTIONS = Array.from(
  new Set([
    "Pan India",
    ...INDIA_STATES.map((item) => item.state),
    ...INDIA_STATES.flatMap((item) => item.cities.map((city) => city.name)),
  ]),
);
type SocialAccountMap = Partial<Record<SocialPlatform, string>>;

export function FlowScreen({
  flow,
  role = "Brand",
  onBack,
  onProposalSubmit,
  onCampaignCreate,
  onCampaignSave,
  initialCampaign,
  onDealStatusSave,
  onReviewSubmit,
  authoredReviews = [],
  onReviewUpdate,
  reviewItems: reviewItemsProp,
  onReviewRequest,
  initialDealStatus,
  proposalContext,
  initialLocations,
  onProfileLocationsSave,
  initialProfile,
  profileEmail,
  profilePhone,
  onProfileSave,
  onOpenCreator,
  savedCreators = [],
  initialSocialAccounts,
  verifiedSocialAccounts = [],
  pendingSocialAccounts = [],
  socialAccountErrors = {},
  onSocialAccountsSave,
  onSocialVerificationRequest,
  blockedUsers = [],
  onUnblockUser,
  notificationSettings = DEFAULT_NOTIFICATION_SETTINGS,
  onNotificationSettingsSave,
  reminders = [],
  initialReminderId,
  reminderSettings = { soundEnabled: true, vibrationEnabled: true, soundTone: "default" },
  onReminderToggle,
  onReminderSettingsSave,
  onReminderItemSettingsSave,
  onDeleteAccount,
  onSupportSubmit,
}: {
  flow: MarketplaceFlow;
  role?: "Brand" | "Influencer";
  onBack: () => void;
  onProposalSubmit?: (draft: ProposalDraft) => void;
  onCampaignCreate?: (draft: CampaignDraft) => void;
  onCampaignSave?: (draft: CampaignDraft, publish: boolean) => void;
  initialCampaign?: Campaign;
  onDealStatusSave?: (status: DealStatus) => void;
  onReviewSubmit?: (draft: ReviewDraft) => boolean | void | Promise<boolean | void>;
  authoredReviews?: AuthoredReview[];
  onReviewUpdate?: (id: string, changes: Pick<AuthoredReview, "rating" | "text" | "tags">) => void;
  reviewItems?: ReviewListItem[];
  onReviewRequest?: () => void;
  initialDealStatus?: DealStatus;
  proposalContext?: ProposalContext;
  initialLocations?: string[];
  onProfileLocationsSave?: (locations: string[]) => void;
  initialProfile?: ProfileDraft;
  profileEmail?: string;
  profilePhone?: string;
  onProfileSave?: (profile: ProfileDraft) => Promise<void> | void;
  onOpenCreator?: (creator: PublicCreatorProfile) => void;
  savedCreators?: PublicCreatorProfile[];
  initialSocialAccounts?: SocialAccountMap;
  verifiedSocialAccounts?: SocialPlatform[];
  pendingSocialAccounts?: SocialPlatform[];
  socialAccountErrors?: Partial<Record<SocialPlatform, string>>;
  onSocialAccountsSave?: (
    accounts: SocialAccountMap,
    verifiedPlatforms: SocialPlatform[],
  ) => void;
  onSocialVerificationRequest?: (
    platform: SocialPlatform,
    handle: string,
  ) => Promise<void> | void;
  blockedUsers?: string[];
  onUnblockUser?: (name: string) => void;
  notificationSettings?: NotificationSettings;
  onNotificationSettingsSave?: (settings: NotificationSettings) => void;
  reminders?: Reminder[];
  initialReminderId?: string;
  reminderSettings?: ReminderSettings;
  onReminderToggle?: (id: string, enabled: boolean) => void;
  onReminderSettingsSave?: (settings: ReminderSettings) => void;
  onReminderItemSettingsSave?: (
    id: string,
    settings: ReminderSettings,
    schedule?: {
      deliveryDate: string;
      deliveryTime: string;
      dueAt: number;
      enabled?: boolean;
    },
  ) => void;
  onDeleteAccount?: () => void;
  onSupportSubmit?: (topic: string, message: string) => Promise<void> | void;
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
  const [deliveryDate, setDeliveryDate] = useState("30 Sep");
  const [deliveryTime, setDeliveryTime] = useState("6:00 PM");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [proposalReminderSettings, setProposalReminderSettings] =
    useState<ReminderSettings>(reminderSettings);
  const [proposalReminderModalOpen, setProposalReminderModalOpen] = useState(false);
  const [profileLocations, setProfileLocations] = useState<string[]>(
    initialLocations ?? [],
  );
  const [profileLanguages, setProfileLanguages] = useState<string[]>(
    initialProfile?.languages?.length ? initialProfile.languages : ["English"],
  );
  const [profileName, setProfileName] = useState(
    initialProfile?.name ?? (role === "Influencer" ? "Aarohi Mehta" : "Maya Studio"),
  );
  const [profileCity, setProfileCity] = useState(initialProfile?.city ?? "Mumbai");
  const [profileFocus, setProfileFocus] = useState(
    initialProfile?.focus ?? (role === "Influencer"
      ? "Fashion, beauty, routines · Reels, photos"
      : "Beauty & wellness partnerships"),
  );
  const [profileBio, setProfileBio] = useState(
    initialProfile?.bio ?? (role === "Influencer"
      ? "Fashion and beauty creator focused on useful, relatable routines."
      : "Building thoughtful brand collaborations."),
  );
  const [profileImageUri, setProfileImageUri] = useState(initialProfile?.avatarUri);
  const [profileWebsite, setProfileWebsite] = useState(initialProfile?.websiteUrl ?? "");
  const [profileAudienceSize, setProfileAudienceSize] = useState(initialProfile?.audienceSize ?? "");
  const [profileRateRange, setProfileRateRange] = useState(initialProfile?.rateRange ?? "");
  const [profileTeamSize, setProfileTeamSize] = useState(initialProfile?.teamSize ?? "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountMap>(
    initialSocialAccounts ?? {
      Instagram: role === "Influencer" ? "@aarohi.mehta" : "@mayastudio",
      YouTube: role === "Influencer" ? "Aarohi Mehta" : "",
      LinkedIn: role === "Brand" ? "Maya Studio" : "",
    },
  );
  const [verifiedSocials, setVerifiedSocials] =
    useState<SocialPlatform[]>(verifiedSocialAccounts);
  const [verificationPending, setVerificationPending] = useState<SocialPlatform[]>(pendingSocialAccounts);
  const [verificationErrors, setVerificationErrors] = useState<Partial<Record<SocialPlatform, string>>>(socialAccountErrors);
  useEffect(() => {
    setVerifiedSocials(verifiedSocialAccounts);
    setVerificationPending(pendingSocialAccounts);
    setVerificationErrors(socialAccountErrors);
  }, [pendingSocialAccounts, socialAccountErrors, verifiedSocialAccounts]);
  const [supportTopic, setSupportTopic] = useState("Help with a collaboration");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [unblockTarget, setUnblockTarget] = useState<string | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const [localNotificationSettings, setLocalNotificationSettings] =
    useState<NotificationSettings>(notificationSettings);
  const [reviewLimit, setReviewLimit] = useState(3);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewDraft, setReviewDraft] = useState("Professional, clear communication and a smooth collaboration.");
  const [editingActivityReview, setEditingActivityReview] = useState<string | null>(null);
  const [activityReviewDraft, setActivityReviewDraft] = useState("");
  const [attachmentToRemove, setAttachmentToRemove] = useState<string | null>(
    null,
  );
  const [campaignLocations, setCampaignLocations] = useState<string[]>([
    ...(initialCampaign?.city ? [initialCampaign.city] : ["Mumbai"]),
  ]);
  const [campaignTitle, setCampaignTitle] = useState(initialCampaign?.title ?? "New creator campaign");
  const [campaignCategory, setCampaignCategory] = useState(initialCampaign?.category ?? "Beauty");
  const [campaignBudget, setCampaignBudget] = useState(initialCampaign?.budget ?? "₹8,000 – ₹15,000");
  const [campaignDescription, setCampaignDescription] = useState(
    initialCampaign?.description ?? "Share goals, deliverables and preferred content format.",
  );
  const initialCampaignDeadline = campaignDeadlineInputs(initialCampaign?.deadlineAt ?? initialCampaign?.deadline);
  const [campaignDeadline, setCampaignDeadline] = useState(initialCampaignDeadline.date);
  const [campaignDeadlineTime, setCampaignDeadlineTime] = useState(initialCampaignDeadline.time);
  const [campaignDeliverables, setCampaignDeliverables] = useState(initialCampaign?.deliverables ?? "");
  const [campaignRequirements, setCampaignRequirements] = useState((initialCampaign?.requirements ?? []).join("\n"));
  const [campaignCreatorRequirements, setCampaignCreatorRequirements] = useState(initialCampaign?.creatorRequirements ?? "");
  const [campaignPlatforms, setCampaignPlatforms] = useState<SocialPlatform[]>(initialCampaign?.platforms ?? []);
  const [campaignVideoUrl, setCampaignVideoUrl] = useState(initialCampaign?.collaborationVideoUrl ?? "");
  const [campaignMedia, setCampaignMedia] = useState<DemoAttachment[]>(initialCampaign?.media ?? []);
  const [campaignApplicationLimit, setCampaignApplicationLimit] = useState(initialCampaign?.applicationLimit ? String(initialCampaign.applicationLimit) : "");
  const [campaignApprovalLimit, setCampaignApprovalLimit] = useState(initialCampaign?.approvalLimit ? String(initialCampaign.approvalLimit) : "");
  const [closeOnApplicationLimit, setCloseOnApplicationLimit] = useState(initialCampaign?.closeOnApplicationLimit ?? true);
  const [closeOnApprovalLimit, setCloseOnApprovalLimit] = useState(initialCampaign?.closeOnApprovalLimit ?? true);
  const [isCampaignLocationOpen, setIsCampaignLocationOpen] = useState(false);
  const [dealStatus, setDealStatus] = useState<DealStatus>(
    initialDealStatus ?? "Completed",
  );
  const [successStep, setSuccessStep] = useState<
    "proposal" | "deal" | "review" | null
  >(null);
  const { attachments, addFile, addMedia, removeAttachment, uploadAttachments, isBusy } =
    useMediaAttachments("campaign");
  const addCampaignMedia = async () => {
    const selected = await selectMediaAttachment();
    if (selected.length) setCampaignMedia((current) => [...current, ...selected]);
  };
  const addCampaignFile = async () => {
    const selected = await selectFileAttachment();
    if (selected) setCampaignMedia((current) => [...current, selected]);
  };
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
      <ScrollView style={styles.viewport} contentContainerStyle={styles.screen}>
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
        <DateTimeField
          label="Content delivery date"
          value={deliveryDate}
          format="short"
          onChange={setDeliveryDate}
          mode="date"
        />
        <DateTimeField
          label="Content delivery time"
          value={deliveryTime}
          onChange={setDeliveryTime}
          mode="time"
        />
        <View style={styles.reminderSetupButton}>
          <View style={styles.reminderSetupIcon}>
            <AppIcon name="alarm-outline" size={21} color={theme.colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.value}>Delivery reminder</Text>
            <Text style={styles.body}>
              {reminderEnabled
                ? `${deliveryDate} · ${deliveryTime} · ${getReminderToneLabel(proposalReminderSettings.soundTone)}`
                : "Reminder off · tap to configure"}
            </Text>
          </View>
          <AppButton
            compact
            variant="secondary"
            icon={reminderEnabled ? "checkmark-circle-outline" : "alarm-outline"}
            label={reminderEnabled ? "Reminder set" : "Set reminder"}
            onPress={() => setProposalReminderModalOpen(true)}
            style={styles.reminderSetupAction}
          />
        </View>
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
          loading={isBusy}
          disabled={isBusy}
          onPress={() => {
            const reminderAt = parseReminderDateTime(deliveryDate, deliveryTime);
            if (!reminderAt) {
              showToast("Enter a future delivery date and time, for example 30 Sep · 6:00 PM.");
              return;
            }
            void uploadAttachments().then((uploadedAttachments) => {
              onProposalSubmit?.({
                title: proposalTitle,
                amount,
                deliverables,
                message,
                attachments: uploadedAttachments,
                deliveryDate: formatReminderDate(reminderAt),
                deliveryTime: formatReminderTime(reminderAt),
                reminderAt,
                reminderEnabled,
                reminderSettings: proposalReminderSettings,
              });
              setSuccessStep("proposal");
            }).catch((error) => {
              showToast(error instanceof Error ? error.message : "Attachment upload failed. Please try again.");
            });
          }}
        />
      </ScrollView>
      {attachmentRemoveModal}
      <ReminderSettingsSheet
        visible={proposalReminderModalOpen}
        title="Set delivery reminder"
        campaignTitle={proposalContext?.campaignTitle ?? "Campaign delivery"}
        participantName={proposalContext?.participantName ?? "Collaboration partner"}
        deliveryDate={deliveryDate}
        deliveryTime={deliveryTime}
        settings={proposalReminderSettings}
        onChange={setProposalReminderSettings}
        onClose={() => setProposalReminderModalOpen(false)}
        onSave={() => {
          setProposalReminderModalOpen(false);
          showToast("Delivery reminder details saved");
        }}
        enabled={reminderEnabled}
        onEnabledChange={setReminderEnabled}
      />
      </>
    );
  if (flow === "deal")
    return (
      <ScrollView style={styles.viewport} contentContainerStyle={styles.screen}>
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
      <ScrollView style={styles.viewport} contentContainerStyle={styles.screen}>
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
          value={reviewDraft}
          multiline
          onChangeText={setReviewDraft}
        />
        <AppButton
          label="Publish review"
          icon="star-outline"
          onPress={async () => {
            if (reviewDraft.trim().length < 10) {
              showToast("Add a little more detail to your feedback.");
              return;
            }
            try {
              const saved = await onReviewSubmit?.({
                subject: proposalContext?.participantName ??
                  (role === "Brand" ? "your creator partner" : "your brand partner"),
                rating: reviewRating,
                text: reviewDraft.trim(),
              });
              if (saved === false) return;
              setSuccessStep("review");
            } catch {
              showToast("Review could not be saved. Please try again.");
            }
          }}
        />
      </ScrollView>
    );
  if (flow === "campaign-form") {
    const saveCampaign = (publish: boolean) => {
      const title = campaignTitle.trim();
      if (!title) {
        showToast("Add a campaign title first");
        return;
      }
      if (publish && !campaignDescription.trim()) {
        showToast("Add a campaign description before publishing");
        return;
      }
      if (publish && !campaignPlatforms.length) {
        showToast("Choose at least one platform before publishing");
        return;
      }
      if (publish && !campaignDeadline.trim()) {
        showToast("Choose a future campaign deadline before publishing");
        return;
      }
      if (campaignVideoUrl.trim() && !/^https?:\/\/\S+$/i.test(campaignVideoUrl.trim())) {
        showToast("Video brief link must start with http:// or https://");
        return;
      }
      const applicationLimit = campaignApplicationLimit.trim() ? Number(campaignApplicationLimit) : undefined;
      const approvalLimit = campaignApprovalLimit.trim() ? Number(campaignApprovalLimit) : undefined;
      if ((applicationLimit !== undefined && (!Number.isInteger(applicationLimit) || applicationLimit < 1)) || (approvalLimit !== undefined && (!Number.isInteger(approvalLimit) || approvalLimit < 1))) {
        showToast("Application and approval limits must be whole numbers greater than zero.");
        return;
      }
      const requirements = campaignRequirements.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
      const deadline = combineCampaignDeadline(campaignDeadline, campaignDeadlineTime);
      onCampaignSave?.({
        id: initialCampaign?.id,
        title,
        city: campaignLocations[0] ?? "Pan India",
        category: campaignCategory.trim() || "General",
        budget: campaignBudget.trim() || "Flexible budget",
        description: campaignDescription.trim() || "Share goals, deliverables and preferred content format.",
        platforms: campaignPlatforms,
        deadline,
        deliverables: campaignDeliverables.trim(),
        requirements,
        creatorRequirements: campaignCreatorRequirements.trim(),
        collaborationVideoUrl: campaignVideoUrl.trim(),
        media: campaignMedia,
        applicationLimit: applicationLimit ?? null,
        approvalLimit: approvalLimit ?? null,
        closeOnApplicationLimit,
        closeOnApprovalLimit,
      }, publish);
      if (!onCampaignSave) onCampaignCreate?.({
        id: initialCampaign?.id,
        title,
        city: campaignLocations[0] ?? "Pan India",
        category: campaignCategory.trim() || "General",
        budget: campaignBudget.trim() || "Flexible budget",
        description: campaignDescription.trim() || "Share goals, deliverables and preferred content format.",
      });
      showToast(publish ? "Campaign published" : "Campaign draft saved");
      onBack();
    };
    return (
      <ScrollView style={styles.viewport} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <Back onBack={onBack} />
        <Pill label={initialCampaign ? "EDIT CAMPAIGN" : "NEW CAMPAIGN"} accent />
        <Text style={styles.title}>{initialCampaign ? "Edit campaign brief" : "Create a clear brief"}</Text>
        <Text style={styles.body}>Give creators enough context to understand the opportunity and apply with confidence.</Text>
        <Field label="Campaign title" value={campaignTitle} onChangeText={setCampaignTitle} />
        <Text style={styles.label}>Category</Text>
        <DropdownPickerField
          label="Category"
          value={campaignCategory}
          placeholder="Select campaign category"
          icon="pricetag-outline"
          options={Array.from(new Set([campaignCategory, ...CREATOR_CATEGORIES]))}
          onSelect={setCampaignCategory}
        />
        <View style={styles.locationFieldGroup}>
          <Text style={styles.label}>Target cities / states</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Select campaign target locations" onPress={() => setIsCampaignLocationOpen(true)} style={({ pressed }) => [styles.locationField, pressed && styles.locationFieldPressed]}>
            <AppIcon name="location-outline" size={20} color={theme.colors.primary} />
            <Text numberOfLines={3} style={styles.locationFieldText}>{campaignLocations.length ? campaignLocations.join(" · ") : "Choose one or more locations"}</Text>
            <AppIcon name="chevron-forward" size={18} color={theme.colors.textSecondary} />
          </Pressable>
          <LocationFilterSheet visible={isCampaignLocationOpen} locations={CAMPAIGN_LOCATION_OPTIONS} selected={campaignLocations} subtitle="Select one or more campaign target locations" searchAccessibilityLabel="Search campaign target locations" onClose={() => setIsCampaignLocationOpen(false)} onApply={setCampaignLocations} />
        </View>
        <Text style={styles.label}>Budget range</Text>
        <DropdownPickerField
          label="Budget range"
          value={campaignBudget}
          placeholder="Select campaign budget"
          icon="cash-outline"
          options={Array.from(new Set([campaignBudget, ...CAMPAIGN_BUDGET_OPTIONS]))}
          onSelect={setCampaignBudget}
        />
        <View style={styles.dateTimeFields}>
          <DateTimeField label="Deadline date" value={campaignDeadline} onChange={setCampaignDeadline} mode="date" />
          <DateTimeField label="Deadline time" value={campaignDeadlineTime} onChange={setCampaignDeadlineTime} mode="time" />
          <Text style={styles.body}>Time uses your device’s local timezone.</Text>
        </View>
        <Text style={styles.label}>Platforms</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
          {SOCIAL_PLATFORM_REGISTRY.map(({ key: platform }) => {
            const selected = campaignPlatforms.includes(platform);
            return <Pressable key={platform} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setCampaignPlatforms((current) => selected ? current.filter((item) => item !== platform) : [...current, platform])} style={[styles.choiceChip, selected && styles.choiceChipActive]}><Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{platform}</Text></Pressable>;
          })}
        </ScrollView>
        <Field label="Deliverables" value={campaignDeliverables} onChangeText={setCampaignDeliverables} multiline />
        <Field label="Creator requirements" value={campaignCreatorRequirements} onChangeText={setCampaignCreatorRequirements} multiline />
        <Field label="What do you need?" value={campaignDescription} multiline onChangeText={setCampaignDescription} />
        <Field label="Application requirements" value={campaignRequirements} multiline onChangeText={setCampaignRequirements} placeholder="One requirement per line" />
        <Field label="Maximum applications (optional)" value={campaignApplicationLimit} onChangeText={setCampaignApplicationLimit} placeholder="Example: 100" />
        <Field label="Maximum approved creators (optional)" value={campaignApprovalLimit} onChangeText={setCampaignApprovalLimit} placeholder="Example: 10" />
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceCopy}><Text style={styles.label}>Hide from discovery when application limit is reached</Text><Text style={styles.body}>Creators who already applied can still see their application status.</Text></View>
          <Toggle value={closeOnApplicationLimit} onChange={setCloseOnApplicationLimit} accessibilityLabel="Hide campaign when application limit is reached" />
        </View>
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceCopy}><Text style={styles.label}>Hide from discovery when approval limit is reached</Text><Text style={styles.body}>New applications stop appearing when all approved creator slots are filled.</Text></View>
          <Toggle value={closeOnApprovalLimit} onChange={setCloseOnApprovalLimit} accessibilityLabel="Hide campaign when approval limit is reached" />
        </View>
        <Field label="Video brief link" value={campaignVideoUrl} onChangeText={setCampaignVideoUrl} placeholder="https://..." />
        <View style={styles.attachmentActions}>
          <AppButton label="Add media" icon="image-outline" variant="secondary" compact onPress={() => void addCampaignMedia()} style={styles.attachmentButton} />
          <AppButton label="Attach file" icon="attach-outline" variant="secondary" compact onPress={() => void addCampaignFile()} style={styles.attachmentButton} />
        </View>
        {campaignMedia.length ? <View style={styles.attachmentList}>{campaignMedia.map((item) => <View key={item.id} style={styles.attachmentRow}><AppIcon name={item.type === "image" ? "image-outline" : item.type === "video" ? "videocam-outline" : "document-outline"} size={18} color={theme.colors.primary} /><Text numberOfLines={1} style={styles.attachmentName}>{item.name}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.name} from campaign`} onPress={() => setCampaignMedia((current) => current.filter((asset) => asset.id !== item.id))}><AppIcon name="close-circle-outline" size={18} color={theme.colors.danger} /></Pressable></View>)}</View> : null}
        <View style={styles.formActions}>
          <AppButton label="Save draft" icon="save-outline" variant="secondary" onPress={() => saveCampaign(false)} />
          <AppButton label={initialCampaign?.status === "Published" ? "Save published changes" : "Publish campaign"} icon="megaphone-outline" onPress={() => saveCampaign(true)} />
        </View>
      </ScrollView>
    );
  }
  if (flow === "profile-form")
    return (
      <ScrollView style={styles.viewport} contentContainerStyle={styles.screen}>
        <Back onBack={onBack} />
        <Pill
          label={role === "Influencer" ? "CREATOR PROFILE" : "BRAND PROFILE"}
          accent
        />
        <Text style={styles.title}>Edit your profile</Text>
        <Text style={styles.body}>
          Keep your public profile complete so relevant matches can find you.
        </Text>
        <ProfilePhotoPicker
          initials={profileName
            .trim()
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() || "U"}
          uri={profileImageUri}
          onChange={setProfileImageUri}
        />
        <Field
          label="Display name"
          value={profileName}
          onChangeText={setProfileName}
        />
        <View style={styles.locationFieldGroup}>
          <Text style={styles.label}>Your location</Text>
          <LocationPickerField
            selected={profileCity ? [profileCity] : []}
            locations={INDIA_LOCATION_OPTIONS}
            onApply={(locations) => setProfileCity(locations[0] ?? "")}
            title="Choose your location"
            subtitle="Select one location for your profile"
            searchAccessibilityLabel="Search your location"
            single
            placeholder="Select your city or state"
          />
        </View>
        <View style={styles.locationFieldGroup}>
          <Text style={styles.label}>{role === "Influencer" ? "Audience locations" : "Profile locations"}</Text>
          <LocationPickerField
            selected={profileLocations}
            locations={INDIA_LOCATION_OPTIONS}
            onApply={setProfileLocations}
            title={role === "Influencer" ? "Choose audience locations" : "Choose profile locations"}
            subtitle="Select one or more cities or states"
            searchAccessibilityLabel="Search profile locations"
            placeholder="Select one or more locations"
          />
        </View>
        <View style={styles.locationFieldGroup}>
          <Text style={styles.label}>Languages you speak</Text>
          <LocationPickerField
            selected={profileLanguages}
            locations={[...NATIVE_LANGUAGE_OPTIONS]}
            onApply={setProfileLanguages}
            title="Choose languages"
            subtitle="Select every language you can speak with brands and creators"
            searchAccessibilityLabel="Search Indian languages"
            searchPlaceholder="Search languages"
            emptyLabel="No languages found"
            placeholder="Select one or more languages"
            icon="globe-outline"
            optionIcon="globe-outline"
          />
        </View>
        <Field label="Email" value={profileEmail ?? "Not available"} editable={false} />
        <Field label="Phone" value={profilePhone ?? "Not available"} editable={false} />
        <Text style={styles.label}>{role === "Influencer" ? "Niche / Category" : "Industry"}</Text>
        <DropdownPickerField
          label={role === "Influencer" ? "Niche / Category" : "Industry"}
          value={profileFocus}
          placeholder={role === "Influencer" ? "Select category" : "Select industry"}
          icon="pricetag-outline"
          options={role === "Influencer" ? CREATOR_CATEGORIES : INDUSTRY_OPTIONS}
          onSelect={setProfileFocus}
        />
        <Field
          label="Bio"
          value={profileBio}
          multiline
          onChangeText={setProfileBio}
        />
        <Field label="Website" value={profileWebsite} onChangeText={setProfileWebsite} placeholder="https://" />
        {role === "Influencer" ? (
          <>
            <Text style={styles.label}>Audience size</Text>
            <DropdownPickerField
              label="Audience size"
              value={profileAudienceSize}
              placeholder="Select audience size"
              icon="people-outline"
              options={AUDIENCE_SIZE_OPTIONS}
              onSelect={setProfileAudienceSize}
            />
            <Text style={styles.label}>Rate range</Text>
            <DropdownPickerField
              label="Rate range"
              value={profileRateRange}
              placeholder="Select your rate"
              icon="cash-outline"
              options={CREATOR_RATE_OPTIONS}
              onSelect={setProfileRateRange}
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>Team size</Text>
            <DropdownPickerField
              label="Team size"
              value={profileTeamSize}
              placeholder="Select team size"
              icon="people-outline"
              options={TEAM_SIZE_OPTIONS}
              onSelect={setProfileTeamSize}
            />
            <Text style={styles.label}>Campaign budget</Text>
            <DropdownPickerField
              label="Campaign budget"
              value={profileRateRange}
              placeholder="Select campaign budget"
              icon="cash-outline"
              options={CAMPAIGN_BUDGET_OPTIONS}
              onSelect={setProfileRateRange}
            />
          </>
        )}
        <AppButton
          label={isSavingProfile ? "Saving profile" : "Save profile"}
          loading={isSavingProfile}
          onPress={async () => {
            if (isSavingProfile) return;
            setIsSavingProfile(true);
            try {
              await onProfileSave?.({
                name: profileName.trim(),
                city: profileCity.trim(),
                focus: profileFocus.trim(),
                bio: profileBio.trim(),
                avatarUri: profileImageUri,
                websiteUrl: profileWebsite.trim() || undefined,
                audienceSize: profileAudienceSize.trim() || undefined,
                rateRange: profileRateRange.trim() || undefined,
                teamSize: profileTeamSize.trim() || undefined,
                languages: profileLanguages,
                locations: profileLocations,
              });
              showToast("Profile details saved");
            } catch (error) {
              showToast(error instanceof Error ? error.message : "Profile could not be saved");
            } finally {
              setIsSavingProfile(false);
            }
          }}
        />
      </ScrollView>
    );
  if (flow === "social-accounts") {
    const linkedPlatforms = SOCIAL_PLATFORM_REGISTRY.map(({ key }) => key).filter((platform) =>
      Boolean(socialAccounts[platform]),
    );
    const allLinkedAccountsVerified =
      linkedPlatforms.length > 0 &&
      linkedPlatforms.every((platform) =>
        verifiedSocials.includes(platform) || verificationPending.includes(platform) || Boolean(verificationErrors[platform]),
      );
    return (
      <ScrollView style={styles.viewport} contentContainerStyle={styles.screen}>
        <Back onBack={onBack} />
        <Pill label="SOCIAL ACCOUNTS" accent />
        <Text style={styles.title}>Add and verify accounts</Text>
        <Text style={styles.body}>
          Add the public accounts you want people to review. Verification confirms ownership; it does not imply endorsement by the platform.
        </Text>
        {SOCIAL_PLATFORM_REGISTRY.map((config) => {
          const platform = config.key;
          const value = socialAccounts[platform] ?? "";
          const isVerified = verifiedSocials.includes(platform);
          const error = verificationErrors[platform];
          return (
            <View key={platform} style={styles.socialAccountRow}>
              <View style={styles.socialPlatformHeader}>
                <View style={[styles.socialPlatformIcon, { backgroundColor: config.surface }]}>
                  <AppIcon name={config.icon} size={18} color={config.color} />
                </View>
                <Text style={styles.label}>{config.label}</Text>
              </View>
              <Field
                label="Profile URL"
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
                      setVerificationPending((current) =>
                        current.filter((item) => item !== platform),
                      );
                    }
                  }
                }
              />
              {error ? <Text style={styles.body}>{error}</Text> : null}
              <AppButton
                label={isVerified ? "Verified" : verificationPending.includes(platform) ? "Checking profile…" : error ? "Review required" : value ? "Check profile automatically" : "Add account"}
                compact
                variant={isVerified || verificationPending.includes(platform) ? "secondary" : error ? "secondary" : "ghost"}
                icon={isVerified ? "checkmark-circle-outline" : error ? "alert-circle-outline" : "sync-outline"}
                disabled={!value || isVerified || verificationPending.includes(platform) || Boolean(error)}
                onPress={async () => {
                  if (!value) return;
                  setVerificationErrors((current) => ({ ...current, [platform]: undefined }));
                  if (onSocialVerificationRequest) {
                    setVerificationPending((current) => current.includes(platform) ? current : [...current, platform]);
                    try {
                      await onSocialVerificationRequest(platform, value);
                      showToast(`${platform} profile check started`);
                    } catch (error) {
                      setVerificationPending((current) => current.filter((item) => item !== platform));
                      setVerificationErrors((current) => ({ ...current, [platform]: error instanceof Error ? error.message : `${platform} profile check failed` }));
                      showToast(error instanceof Error ? error.message : `${platform} verification could not be submitted`);
                    }
                    return;
                  }
                  setVerifiedSocials((current) => current.includes(platform) ? current : [...current, platform]);
                  showToast(`${platform} verification complete`);
                }}
              />
            </View>
          );
        })}
        <AppButton
          label={Object.keys(verificationErrors).length ? "Save for admin review" : "Save social accounts"}
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
        <ScrollView style={styles.viewport} contentContainerStyle={styles.screen}>
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
  if (flow === "reminders")
    return (
      <ReminderView
        reminders={reminders}
        initialReminderId={initialReminderId}
        reminderSettings={reminderSettings}
        onReminderToggle={onReminderToggle}
        onReminderSettingsSave={onReminderSettingsSave}
        onReminderItemSettingsSave={onReminderItemSettingsSave}
        onBack={onBack}
      />
    );
  if (flow === "notification-settings")
    return (
      <ScrollView style={styles.viewport} contentContainerStyle={styles.screen}>
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
        <PreferenceToggle
          label="Delivery reminders"
          description="Show incoming delivery reminders in your Brandly inbox."
          value={localNotificationSettings.reminders}
          onChange={(value) =>
            setLocalNotificationSettings((current) => ({
              ...current,
              reminders: value,
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
    const reviewItems = reviewItemsProp ?? [];
    return (
      <ScrollView style={styles.viewport} contentContainerStyle={styles.screen}>
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
        {reviewItems.slice(0, reviewLimit).map((item) => (
          <AppCard flat key={item.id} style={styles.reviewItem}>
            <View style={styles.reviewItemHeader}>
              <Avatar initials={item.author.split(" ").map((part) => part[0]).join("").slice(0, 2)} size="small" />
              <View style={styles.flex}>
                <Text style={styles.value}>{item.author}</Text>
                <View style={styles.reviewItemRating}>
                  <AppIcon name="star" size={15} color={theme.colors.accent} />
                  <Text style={styles.body}>{item.rating} / 5</Text>
                </View>
              </View>
            </View>
            <Text style={styles.body}>{item.text}</Text>
            {item.date ? <Text style={styles.body}>{formatDisplayDateTime(item.date)}</Text> : null}
            {item.tags?.length ? <View style={styles.reviewTags}>{item.tags.map((tag) => <Pill key={tag} label={tag} />)}</View> : null}
          </AppCard>
        ))}
        {!reviewItems.length ? <AppCard flat style={styles.emptyState}><Text style={styles.value}>No reviews yet</Text><Text style={styles.body}>Reviews will appear after a completed collaboration.</Text></AppCard> : null}
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
    return (
      <ScrollView style={styles.viewport} contentContainerStyle={styles.screen}>
        <Back onBack={onBack} />
        <Pill label="YOUR ACTIVITY" accent />
        <Text style={styles.title}>Reviews you have written</Text>
        <Text style={styles.body}>Reviews you publish after a completed collaboration will appear here.</Text>
        {authoredReviews.length ? authoredReviews.map((review) => (
          <AppCard flat key={review.id} style={styles.activityReview}>
            <View style={styles.activityReviewHeader}>
              <View style={styles.flex}>
                <Text style={styles.value}>{review.subjectName}</Text>
                <Text style={styles.body}>{review.rating} / 5 · {formatDisplayDateTime(review.date ?? "Published")}</Text>
              </View>
              <AppButton
                label="Edit"
                compact
                variant="ghost"
                icon="create-outline"
                onPress={() => {
                  setEditingActivityReview(review.id);
                  setActivityReviewDraft(review.text);
                }}
              />
            </View>
            {editingActivityReview === review.id ? (
              <>
                <Field label="Review" value={activityReviewDraft} multiline onChangeText={setActivityReviewDraft} />
                <AppButton
                  label="Save review"
                  compact
                  onPress={() => {
                    const text = activityReviewDraft.trim();
                    if (text.length < 10) {
                      showToast("Add a little more detail to your feedback.");
                      return;
                    }
                    onReviewUpdate?.(review.id, { rating: review.rating, text, tags: review.tags });
                    setEditingActivityReview(null);
                    showToast("Review updated");
                  }}
                />
              </>
            ) : <Text style={styles.body}>{review.text}</Text>}
          </AppCard>
        )) : (
          <AppCard flat style={styles.emptyState}>
            <AppIcon name="star-outline" size={24} color={theme.colors.textSecondary} />
            <Text style={styles.value}>No published review activity</Text>
            <Text style={styles.body}>Complete a collaboration and publish feedback to manage it here.</Text>
          </AppCard>
        )}
      </ScrollView>
    );
  }
  if (flow === "support")
    return (
      <ScrollView style={styles.viewport} contentContainerStyle={styles.screen}>
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
          placeholder="Describe what you need help with"
          onChangeText={setSupportMessage}
        />
        <AppButton
          label={supportSubmitting ? "Sending…" : "Send support request"}
          icon="paper-plane-outline"
          disabled={supportSubmitting}
          onPress={async () => {
            const topic = supportTopic.trim();
            const text = supportMessage.trim();
            if (!topic || !text) { showToast("Add a topic and message before sending.", "error"); return; }
            if (topic.length > 120) { showToast("Keep the support topic under 120 characters.", "error"); return; }
            if (text.length > 4500) { showToast("Keep the support message under 4,500 characters.", "error"); return; }
            if (!onSupportSubmit) { showToast("Support messaging is unavailable. Please try again.", "error"); return; }
            setSupportSubmitting(true);
            try {
              await onSupportSubmit(topic, text);
              setSupportTopic("");
              setSupportMessage("");
              showToast("Message sent to Brandly Support.");
            } catch (error) {
              showToast(error instanceof Error ? error.message : "Support message could not be sent.", "error");
            } finally {
              setSupportSubmitting(false);
            }
          }}
        />
      </ScrollView>
    );
  if (flow === "delete-account")
    return (
      <>
        <ScrollView style={styles.viewport} contentContainerStyle={styles.screen}>
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
      <ScrollView style={styles.viewport} contentContainerStyle={styles.screen}>
        <Back onBack={onBack} />
        <Pill label="SAVED PROFILES" accent />
        <Text style={styles.title}>Your shortlists</Text>
        <Text style={styles.body}>
          Save profiles to compare them before sending a proposal.
        </Text>
        {savedCreators.length ? savedCreators.map((creator) => (
          <AppCard key={creator.id} flat onPress={() => onOpenCreator?.(creator)}>
            <View style={styles.savedProfileRow}>
              <Avatar initials={creator.initials} uri={creator.avatarUrl} size="small" />
              <View style={styles.flex}>
                <Text style={styles.value}>{creator.name}</Text>
                <Text style={styles.body}>
                  {creator.city} · {creator.niche} · {creator.followers} followers · {creator.price}
                </Text>
              </View>
              <AppIcon name="chevron-forward" size={18} color={theme.colors.textSecondary} />
            </View>
          </AppCard>
        )) : (
          <AppCard flat style={styles.emptyState}>
            <Text style={styles.value}>No saved profiles yet</Text>
            <Text style={styles.body}>Save a creator from Discover to build a shortlist.</Text>
          </AppCard>
        )}
      </ScrollView>
    );
  return (
    <ScrollView style={styles.viewport} contentContainerStyle={styles.screen}>
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

function ReminderView({
  reminders,
  initialReminderId,
  reminderSettings,
  onReminderToggle,
  onReminderSettingsSave,
  onReminderItemSettingsSave,
  onBack,
}: {
  reminders: Reminder[];
  initialReminderId?: string;
  reminderSettings: ReminderSettings;
  onReminderToggle?: (id: string, enabled: boolean) => void;
  onReminderSettingsSave?: (settings: ReminderSettings) => void;
  onReminderItemSettingsSave?: (
    id: string,
    settings: ReminderSettings,
    schedule?: {
      deliveryDate: string;
      deliveryTime: string;
      dueAt: number;
      enabled?: boolean;
    },
  ) => void;
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const styles = makeStyles(theme);
  const [filter, setFilter] = useState<"all" | "active" | "off" | "history">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftSettings, setDraftSettings] = useState<ReminderSettings>({
    ...reminderSettings,
    soundTone: reminderSettings.soundTone ?? "default",
  });
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [draftReminderSettings, setDraftReminderSettings] =
    useState<ReminderSettings>(draftSettings);
  const [reschedulingReminder, setReschedulingReminder] = useState(false);
  const [draftDeliveryDate, setDraftDeliveryDate] = useState("");
  const [draftDeliveryTime, setDraftDeliveryTime] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const isPastReminder = (reminder: Reminder) => reminder.dueAt <= now;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleReminders = reminders
    .filter((reminder) => {
      if (filter === "active") return reminder.enabled && !isPastReminder(reminder);
      if (filter === "off") return !reminder.enabled && !isPastReminder(reminder);
      if (filter === "history") return isPastReminder(reminder);
      return true;
    })
    .filter((reminder) => {
      if (!normalizedQuery) return true;
      return `${reminder.title} ${reminder.campaignTitle} ${reminder.participantName} ${reminder.deliveryDate} ${reminder.deliveryTime}`
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort((a, b) => {
      const aPast = isPastReminder(a);
      const bPast = isPastReminder(b);
      if (aPast !== bPast) return aPast ? 1 : -1;
      return aPast ? b.dueAt - a.dueAt : a.dueAt - b.dueAt;
    });
  const activeReminderCount = reminders.filter(
    (reminder) => reminder.enabled && !isPastReminder(reminder),
  ).length;
  const offReminderCount = reminders.filter(
    (reminder) => !reminder.enabled && !isPastReminder(reminder),
  ).length;
  const historyReminderCount = reminders.filter(isPastReminder).length;
  const openReminderSettings = (reminder: Reminder, reschedule = false) => {
    setSelectedReminder(reminder);
    setReschedulingReminder(reschedule);
    setDraftDeliveryDate(reminder.deliveryDate);
    setDraftDeliveryTime(reminder.deliveryTime);
    setScheduleError("");
    setDraftReminderSettings({
      soundEnabled: reminder.soundEnabled ?? reminderSettings.soundEnabled,
      vibrationEnabled: reminder.vibrationEnabled ?? reminderSettings.vibrationEnabled,
      soundTone: reminder.soundTone ?? reminderSettings.soundTone ?? "default",
    });
  };
  useEffect(() => {
    if (!initialReminderId) return;
    const reminder = reminders.find((item) => item.id === initialReminderId);
    if (!reminder) return;
    setSelectedReminder(reminder);
    setReschedulingReminder(false);
    setDraftDeliveryDate(reminder.deliveryDate);
    setDraftDeliveryTime(reminder.deliveryTime);
    setScheduleError("");
    setDraftReminderSettings({
      soundEnabled: reminder.soundEnabled ?? reminderSettings.soundEnabled,
      vibrationEnabled: reminder.vibrationEnabled ?? reminderSettings.vibrationEnabled,
      soundTone: reminder.soundTone ?? reminderSettings.soundTone ?? "default",
    });
  }, [initialReminderId, reminders, reminderSettings]);
  const closeReminderSettings = () => {
    setSelectedReminder(null);
    setReschedulingReminder(false);
    setScheduleError("");
  };
  const handleReminderToggle = (reminder: Reminder, enabled: boolean) => {
    if (enabled && isPastReminder(reminder)) {
      openReminderSettings(reminder, true);
      return;
    }
    onReminderToggle?.(reminder.id, enabled);
  };
  return (
    <>
      <ScrollView
        style={styles.viewport}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.reminderHeader}>
          <View style={styles.flex}>
            <Back onBack={onBack} />
            <Pill label="REMINDERS" accent />
            <Text style={styles.reminderPageTitle}>Delivery reminders</Text>
            <Text style={styles.body}>
              Keep every agreed delivery time visible and get a native alert when it is due.
            </Text>
          </View>
          <IconButton
            name="settings-outline"
            label="Open default reminder settings"
            selected={settingsOpen}
            onPress={() => {
              setDraftSettings({
                ...reminderSettings,
                soundTone: reminderSettings.soundTone ?? "default",
              });
              setSettingsOpen(true);
            }}
          />
        </View>
        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search saved reminders"
          accessibilityLabel="Search saved delivery reminders"
        />
        <View style={styles.reminderFilters}>
          <FilterChip label={`All ${reminders.length}`} selected={filter === "all"} onPress={() => setFilter("all")} />
          <FilterChip label={`Active ${activeReminderCount}`} selected={filter === "active"} onPress={() => setFilter("active")} />
          <FilterChip label={`Off ${offReminderCount}`} selected={filter === "off"} onPress={() => setFilter("off")} />
          <FilterChip label={`History ${historyReminderCount}`} selected={filter === "history"} onPress={() => setFilter("history")} />
        </View>
        <View style={styles.reminderListHeader}>
          <Text style={styles.reminderListTitle}>
            {filter === "all" ? "All saved reminders" : filter === "active" ? "Active reminders" : filter === "history" ? "Reminder history" : "Paused reminders"}
          </Text>
          <Text style={styles.reminderListCount}>{visibleReminders.length} total</Text>
        </View>
        {visibleReminders.length ? (
          visibleReminders.map((reminder) => {
            const past = isPastReminder(reminder);
            const reminderSound = reminder.soundEnabled === false
              ? "Silent"
              : getReminderToneLabel(reminder.soundTone ?? reminderSettings.soundTone);
            const reminderVibration = reminder.vibrationEnabled ?? reminderSettings.vibrationEnabled;
            const reminderStatus = past ? "History" : reminder.enabled ? "Active" : "Off";
            return (
              <AppCard key={reminder.id} flat style={[styles.reminderCard, past && styles.reminderCardHistory]}>
                <View style={styles.reminderCardHeader}>
                  <View style={styles.reminderIcon}>
                    <AppIcon name="alarm-outline" size={21} color={theme.colors.primary} />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${reminder.title} reminder details`}
                    onPress={() => openReminderSettings(reminder)}
                    style={({ pressed }) => [styles.flex, pressed && styles.pressed]}
                  >
                    <Text numberOfLines={2} style={styles.reminderCardTitle}>{reminder.title}</Text>
                    <Text numberOfLines={2} style={styles.reminderCardSubtitle}>
                      {reminder.campaignTitle} · {reminder.participantName}
                    </Text>
                  </Pressable>
                  <Toggle
                    value={reminder.enabled}
                    accessibilityLabel={`${reminder.enabled ? "Turn off" : "Turn on"} ${reminder.title} reminder`}
                    onChange={(value) => handleReminderToggle(reminder, value)}
                  />
                  <IconButton
                    name="settings-outline"
                    label={`Edit ${reminder.title} sound and vibration`}
                    onPress={() => openReminderSettings(reminder)}
                  />
                </View>
                <View style={styles.reminderMeta}>
                  <View style={styles.reminderMetaItem}>
                    <AppIcon name="calendar-outline" size={17} color={theme.colors.primary} />
                    <Text style={styles.reminderMetaText}>{reminder.deliveryDate}</Text>
                  </View>
                  <View style={styles.reminderMetaItem}>
                    <AppIcon name="time-outline" size={17} color={theme.colors.primary} />
                    <Text style={styles.reminderMetaText}>{reminder.deliveryTime}</Text>
                  </View>
                  <View style={styles.reminderPreferenceItem}>
                    <AppIcon name={reminderSound === "Silent" ? "volume-mute-outline" : "volume-high-outline"} size={16} color={theme.colors.textSecondary} />
                    <Text style={styles.reminderPreferenceText}>{reminderSound}</Text>
                  </View>
                  {reminderVibration ? (
                    <View style={styles.reminderPreferenceItem}>
                      <AppIcon name="phone-portrait-outline" size={16} color={theme.colors.textSecondary} />
                      <Text style={styles.reminderPreferenceText}>Vibration</Text>
                    </View>
                  ) : null}
                  <Pill
                    label={reminderStatus}
                    icon={past ? "time-outline" : reminder.enabled ? "alarm-outline" : "pause-circle-outline"}
                    accent={reminderStatus === "Active"}
                  />
                </View>
              </AppCard>
            );
          })
        ) : (
          <AppCard flat style={styles.emptyState}>
            <AppIcon name="alarm-outline" size={24} color={theme.colors.primary} />
            <Text style={styles.value}>
              {normalizedQuery
                ? "No matching reminders"
                : filter === "all"
                  ? "No saved reminders yet"
                  : filter === "history"
                    ? "No reminder history"
                    : filter === "active"
                      ? "No active reminders"
                      : "No paused reminders"}
            </Text>
            <Text style={styles.body}>
              Only reminders you save will appear here. Past reminders stay in History.
            </Text>
          </AppCard>
        )}
      </ScrollView>
      <ReminderSettingsSheet
        visible={settingsOpen}
        title="Reminder settings"
        allowSnoozeDuration
        detail="These defaults apply when a reminder does not have personal settings."
        campaignTitle="Default notification preferences"
        participantName="All delivery reminders"
        settings={draftSettings}
        onChange={setDraftSettings}
        onClose={() => setSettingsOpen(false)}
        onSave={() => {
          onReminderSettingsSave?.(draftSettings);
          setSettingsOpen(false);
          showToast("Default reminder settings saved");
        }}
      />
      <ReminderSettingsSheet
        visible={selectedReminder !== null}
        title={reschedulingReminder ? "Set a new reminder time" : selectedReminder?.title ?? "Reminder details"}
        detail={
          reschedulingReminder
            ? "This reminder has passed. Choose a future date and time before turning it on."
            : undefined
        }
        campaignTitle={selectedReminder?.campaignTitle ?? ""}
        participantName={selectedReminder?.participantName ?? ""}
        deliveryDate={reschedulingReminder ? draftDeliveryDate : selectedReminder?.deliveryDate}
        deliveryTime={reschedulingReminder ? draftDeliveryTime : selectedReminder?.deliveryTime}
        editableSchedule={reschedulingReminder}
        onScheduleChange={({ deliveryDate, deliveryTime }) => {
          setDraftDeliveryDate(deliveryDate);
          setDraftDeliveryTime(deliveryTime);
          setScheduleError("");
        }}
        scheduleError={scheduleError}
        settings={draftReminderSettings}
        onChange={setDraftReminderSettings}
        onClose={closeReminderSettings}
        onSave={() => {
          if (selectedReminder) {
            if (reschedulingReminder) {
              const dueAt = parseReminderDateTime(draftDeliveryDate, draftDeliveryTime);
              if (!dueAt || dueAt <= Date.now()) {
                setScheduleError("Choose a valid date and time in the future.");
                return;
              }
              onReminderItemSettingsSave?.(selectedReminder.id, draftReminderSettings, {
                deliveryDate: formatReminderDate(dueAt),
                deliveryTime: formatReminderTime(dueAt),
                dueAt,
                enabled: true,
              });
            } else {
              onReminderItemSettingsSave?.(selectedReminder.id, draftReminderSettings);
            }
          }
          closeReminderSettings();
          showToast(reschedulingReminder ? "Reminder scheduled" : "Reminder details saved");
        }}
      />
    </>
  );
}

function ReminderTonePicker({
  value,
  onChange,
}: {
  value: ReminderTone;
  onChange: (tone: ReminderTone) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.reminderToneGrid}>
      {REMINDER_TONES.map((tone) => {
        const selected = value === tone.id;
        const icon =
          tone.id === "silent"
            ? "volume-mute-outline"
            : tone.id === "default"
              ? "phone-portrait-outline"
              : "musical-notes-outline";
        return (
          <Pressable
            key={tone.id}
            accessibilityRole="radio"
            accessibilityLabel={`${tone.label}, ${tone.duration}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(tone.id)}
            style={({ pressed }) => [
              styles.reminderToneOption,
              selected && styles.reminderToneOptionSelected,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.reminderToneIcon, selected && styles.reminderToneIconSelected]}>
              <AppIcon
                name={icon}
                size={17}
                color={selected ? theme.colors.primaryText : theme.colors.primary}
              />
            </View>
            <View style={styles.flex}>
              <Text numberOfLines={1} style={styles.reminderToneLabel}>
                {tone.shortLabel}
              </Text>
              <Text style={styles.reminderToneDuration}>{tone.duration}</Text>
            </View>
            {selected ? (
              <AppIcon name="checkmark-circle" size={18} color={theme.colors.primary} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function ReminderSettingsSheet({
  visible,
  title,
  detail,
  campaignTitle,
  participantName,
  deliveryDate,
  deliveryTime,
  editableSchedule = false,
  allowSnoozeDuration = false,
  onScheduleChange,
  scheduleError,
  settings,
  onChange,
  onClose,
  onSave,
  enabled,
  onEnabledChange,
}: {
  visible: boolean;
  title: string;
  detail?: string;
  campaignTitle: string;
  participantName: string;
  deliveryDate?: string;
  deliveryTime?: string;
  editableSchedule?: boolean;
  allowSnoozeDuration?: boolean;
  onScheduleChange?: (schedule: { deliveryDate: string; deliveryTime: string }) => void;
  scheduleError?: string;
  settings: ReminderSettings;
  onChange: (settings: ReminderSettings) => void;
  onClose: () => void;
  onSave: () => void;
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const soundTone = settings.soundTone ?? "default";
  const soundEnabled = settings.soundEnabled && soundTone !== "silent";
  const chooseTone = (tone: ReminderTone) => {
    const nextSettings = {
      ...settings,
      soundTone: tone,
      soundEnabled: tone !== "silent",
    };
    onChange(nextSettings);
    if (tone === "silent") {
      void stopReminderSoundPreview();
      return;
    }
    void previewReminderSound(nextSettings).catch(() => undefined);
  };
  const handleClose = () => {
    void stopReminderSoundPreview();
    onClose();
  };
  const handleSave = () => {
    void stopReminderSoundPreview();
    onSave();
  };
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.reminderModalOverlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close reminder settings"
          onPress={handleClose}
          style={styles.reminderModalBackdrop}
        />
        <ScrollView
          style={styles.reminderModalSheet}
          contentContainerStyle={[
            styles.reminderModalContent,
            { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.reminderModalHandle} />
          <View style={styles.reminderModalHeader}>
            <View style={styles.flex}>
              <Text style={styles.reminderModalTitle}>{title}</Text>
              <Text style={styles.reminderModalSubtitle}>Tap a sound to preview it before saving.</Text>
            </View>
            <IconButton name="close" label="Close reminder settings" onPress={handleClose} />
          </View>
          <AppCard flat style={styles.reminderDetailCard}>
            <View style={styles.reminderDetailRow}>
              <AppIcon name="briefcase-outline" size={18} color={theme.colors.primary} />
              <View style={styles.flex}>
                <Text style={styles.label}>Campaign</Text>
                <Text style={styles.value}>{campaignTitle}</Text>
              </View>
            </View>
            <View style={styles.reminderDetailRow}>
              <AppIcon name="person-outline" size={18} color={theme.colors.primary} />
              <View style={styles.flex}>
                <Text style={styles.label}>With</Text>
                <Text style={styles.value}>{participantName}</Text>
              </View>
            </View>
            {deliveryDate && deliveryTime ? (
              <View style={styles.reminderDetailRow}>
                <AppIcon name="time-outline" size={18} color={theme.colors.primary} />
                <View style={styles.flex}>
                  <Text style={styles.label}>Delivery time</Text>
                  <Text style={styles.value}>{deliveryDate} · {deliveryTime}</Text>
                </View>
              </View>
            ) : null}
            {detail ? <Text style={styles.body}>{detail}</Text> : null}
          </AppCard>
          {editableSchedule ? (
            <View style={styles.reminderScheduleSection}>
              <View style={styles.reminderToneHeader}>
                <Text style={styles.label}>New reminder time</Text>
                <AppIcon name="calendar-outline" size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.reminderScheduleFields}>
                <DateTimeField
                  label="Date"
                  value={deliveryDate ?? ""}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={(value) => onScheduleChange?.({ deliveryDate: value, deliveryTime: deliveryTime ?? "" })}
                  style={styles.reminderScheduleField}
                />
                <DateTimeField
                  label="Time"
                  value={deliveryTime ?? ""}
                  mode="time"
                  onChange={(value) => onScheduleChange?.({ deliveryDate: deliveryDate ?? "", deliveryTime: value })}
                  style={styles.reminderScheduleField}
                />
              </View>
              {scheduleError ? <Text style={styles.reminderScheduleError}>{scheduleError}</Text> : null}
            </View>
          ) : null}
          {enabled !== undefined && onEnabledChange ? (
            <PreferenceToggle
              label="Enable this reminder"
              description="Keep this alert active when the proposal is sent."
              value={enabled}
              onChange={onEnabledChange}
            />
          ) : null}
          <View style={styles.reminderToneHeader}>
            <Text style={styles.label}>Alert sound</Text>
            <Text style={styles.reminderToneCount}>{REMINDER_TONES.length - 2} tones</Text>
          </View>
          <ReminderTonePicker
            value={soundEnabled ? soundTone : "silent"}
            onChange={chooseTone}
          />
          <PreferenceToggle
            label="Vibration"
            description="Vibrate with this reminder on supported devices."
            value={settings.vibrationEnabled}
            onChange={(value) => onChange({ ...settings, vibrationEnabled: value })}
          />
          {allowSnoozeDuration ? <View style={styles.reminderScheduleSection}>
            <Text style={styles.label}>Snooze duration</Text>
            <View style={styles.reminderScheduleFields}>{[5, 10, 15].map((minutes) =>
              <AppButton key={minutes} label={`${minutes} min`} compact
                variant={(settings.snoozeMinutes ?? 5) === minutes ? "primary" : "secondary"}
                onPress={() => onChange({ ...settings, snoozeMinutes: minutes })} />
            )}</View>
          </View> : null}
          <AppButton label="Save reminder" icon="checkmark" onPress={handleSave} />
        </ScrollView>
      </View>
    </Modal>
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
      style={styles.viewport}
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
  placeholder,
  editable = true,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...(onChangeText ? { value, onChangeText } : { defaultValue: value })}
        editable={editable}
        multiline={multiline}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && styles.inputFocused, multiline && styles.textarea, !editable && styles.inputReadOnly]}
        placeholderTextColor={theme.colors.inputPlaceholder}
      />
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  createThemeStyles(theme, {
    screen: {
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
      backgroundColor: theme.colors.transparent,
      flexGrow: 1,
    },
    viewport: {
      flex: 1,
      backgroundColor: theme.colors.transparent,
    },
    successScreen: {
      minHeight: "100%",
      padding: theme.spacing.xl,
      paddingBottom: theme.spacing.xxl,
      justifyContent: "center",
      gap: theme.spacing.lg,
      backgroundColor: theme.colors.transparent,
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
      fontFamily: theme.type.displayFont,
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
      fontFamily: theme.type.displayFont,
    },
    body: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.body,
      fontFamily: theme.type.bodyFont,
      lineHeight: theme.type.lineHeight.body,
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
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      fontFamily: theme.type.bodyFont,
      lineHeight: theme.type.lineHeight.bodyLarge,
    },
    inputReadOnly: {
      color: theme.colors.textSecondary,
      backgroundColor: theme.colors.surfaceMuted,
    },
    inputFocused: { borderColor: theme.colors.focus, backgroundColor: theme.colors.surfaceRaised },
    blockedUserRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    reminderHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
    reminderPageTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.display,
      lineHeight: 34,
      fontWeight: "900",
      letterSpacing: -0.3,
    },
    reminderSetupButton: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    reminderSetupAction: {
      minWidth: 124,
    },
    reminderSetupIcon: {
      width: 42,
      height: 42,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.accent,
    },
    reminderFilters: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    reminderListHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.xs,
    },
    reminderListTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      fontWeight: "900",
    },
    reminderListCount: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    reminderCard: {
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surfaceRaised,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    reminderCardHistory: {
      backgroundColor: theme.colors.surfaceMuted,
      borderColor: theme.colors.border,
    },
    reminderCardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
    reminderIcon: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.accent,
    },
    reminderMeta: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.control,
      backgroundColor: theme.colors.surfaceMuted,
    },
    reminderMetaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    reminderMetaText: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    reminderPreferenceItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    reminderPreferenceText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    reminderCardTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      lineHeight: 21,
      fontWeight: "900",
    },
    reminderCardSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.body,
      lineHeight: 19,
      marginTop: theme.spacing.xs,
    },
    reminderToneHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    reminderToneCount: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    reminderToneGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    reminderToneOption: {
      width: "48%",
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    reminderToneOptionSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surfaceMuted,
    },
    reminderToneIcon: {
      width: 30,
      height: 30,
      borderRadius: theme.radius.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    reminderToneIconSelected: {
      backgroundColor: theme.colors.primary,
    },
    reminderToneLabel: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.caption,
      fontWeight: "800",
    },
    reminderToneDuration: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      marginTop: 2,
    },
    reminderModalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
    },
    reminderModalBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.colors.overlay,
    },
    reminderModalSheet: {
      width: "100%",
      minHeight: 280,
      flexGrow: 0,
      maxHeight: "92%",
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      backgroundColor: theme.colors.surfaceRaised,
    },
    reminderModalContent: {
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    reminderModalHandle: {
      width: 44,
      height: 4,
      alignSelf: "center",
      marginBottom: 0,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.border,
    },
    reminderModalHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      marginBottom: 0,
    },
    reminderModalTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      lineHeight: 26,
      fontWeight: "900",
    },
    reminderModalSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.body,
      lineHeight: 20,
      marginTop: theme.spacing.xs,
    },
    reminderDetailCard: {
      gap: theme.spacing.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    reminderDetailRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
    reminderScheduleSection: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.control,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surfaceMuted,
    },
    reminderScheduleFields: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    reminderScheduleField: {
      flex: 1,
      minWidth: 0,
    },
    reminderScheduleError: {
      color: theme.colors.danger,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    emptyState: { gap: theme.spacing.sm },
    savedProfileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
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
    choiceRow: { flexDirection: "row", gap: theme.spacing.xs, paddingVertical: theme.spacing.xs },
    choiceChip: { minHeight: 44, justifyContent: "center", paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
    choiceChipActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
    choiceText: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
    choiceTextActive: { color: theme.colors.primaryText },
    formActions: { gap: theme.spacing.sm, paddingTop: theme.spacing.sm },
    socialAccountRow: { gap: theme.spacing.xs },
    socialPlatformHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
    socialPlatformIcon: { width: 34, height: 34, borderRadius: theme.radius.sm, alignItems: "center", justifyContent: "center" },
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
    reviewTags: {
      flexDirection: "row",
      flexWrap: "wrap",
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
    dateTimeFields: { gap: theme.spacing.sm },
    preferenceCopy: { flex: 1, minWidth: 0, gap: theme.spacing.xs },
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
