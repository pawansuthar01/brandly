export type SocialPlatform =
  | "Instagram"
  | "YouTube"
  | "Threads"
  | "Snapchat"
  | "Facebook"
  | "LinkedIn"
  | "X"
  | "Pinterest"
  | "Twitch"
  | "Reddit"
  | "Discord"
  | "Medium"
  | "Behance";
export type SocialVerificationStatus = "VERIFIED" | "PENDING" | "UNVERIFIED" | "REJECTED";
export type CreatorContentType =
  | "Reel"
  | "Short video"
  | "Long video"
  | "Photo post"
  | "Story"
  | "Live"
  | "Carousel"
  | "Blog post";
export type TabName =
  | "Home"
  | "Studio"
  | "Market"
  | "Discover"
  | "Campaigns"
  | "Calendar"
  | "Budget"
  | "Proposals"
  | "Profile";
export type TodoTask = {
  id: string;
  kind?: "task" | "video-brief";
  briefId?: string;
  sourceTaskId?: string;
  brandId?: string;
  conversationId?: string;
  senderName?: string;
  sentAt?: string;
  sharedWithCreatorAt?: string;
  sharedWithCreatorIds?: string[];
  title: string;
  owner: string;
  dueDate: string;
  dueTime: string;
  notes: string;
  reminderEnabled: boolean;
  reminderTone: ReminderTone;
  reminderAt?: string | null;
  reminderStatus?: "NONE" | "PENDING" | "SENDING" | "SENT" | "STOPPED" | "FAILED";
  reminderSentAt?: string | null;
  reminderStoppedAt?: string | null;
  reminderNotificationId?: string;
  completed: boolean;
  links?: string[];
  attachments?: DemoAttachment[];
  noteHistory?: { id: string; text: string; createdAt: string }[];
  projectId?: string;
  stage?: ProductionStage;
  campaignId?: string;
  creatorId?: string;
  history?: { id: string; action: string; message?: string | null; details?: unknown; createdAt: string }[];
  createdAt?: string;
  updatedAt?: string;
};
export type TodoTaskDraft = Pick<
  TodoTask,
  "title" | "dueDate" | "dueTime" | "notes" | "reminderEnabled" | "reminderTone"
> & Pick<TodoTask, "links" | "attachments" | "projectId" | "stage" | "campaignId" | "creatorId" | "briefId" | "kind" | "sourceTaskId" | "brandId" | "conversationId" | "senderName" | "sentAt" | "sharedWithCreatorAt" | "sharedWithCreatorIds">;
export type ContentIdeaAttachment = {
  id: string;
  name: string;
  type: "image" | "video" | "file";
  uri: string;
  source?: "upload" | "external";
};
export const PRODUCTION_STAGES = [
  "Idea",
  "Scripting",
  "Shooting",
  "Editing",
  "Thumbnail",
  "Scheduled",
  "Published",
] as const;
export type ProductionStage = typeof PRODUCTION_STAGES[number];
export type ProductionStepStatus = "locked" | "current" | "draft" | "completed";
export type WorkflowStep = {
  stage: ProductionStage;
  completed: boolean;
  status: ProductionStepStatus;
  notes?: string;
};
type LegacyWorkflowStep = {
  index: number;
  title?: string;
  completed?: boolean;
  notes?: string;
};
type WorkflowStepInput = WorkflowStep | LegacyWorkflowStep;

export type IdeaStageData = {
  concept: string;
  title: string;
  description: string;
  notes: string;
  referenceUrl: string;
  budget: string;
  reminderDate: string;
  shootLocation: string;
  equipment: string;
  attachments?: ContentIdeaAttachment[];
};
export type ScriptingStageData = {
  script: string;
  hook: string;
  cta: string;
  caption: string;
  notes: string;
  attachments?: ContentIdeaAttachment[];
};
export type ShootingStageData = {
  shootDate: string;
  shootLocation: string;
  equipment: string;
  shotNotes: string;
  assetsReference: string;
  attachments?: ContentIdeaAttachment[];
};
export type EditingStageData = {
  editingNotes: string;
  editor: string;
  status: string;
  assetUrl: string;
  revisionNotes: string;
  attachments?: ContentIdeaAttachment[];
};
export type ThumbnailStageData = {
  thumbnailUrl: string;
  notes: string;
  revisionInfo: string;
  attachments?: ContentIdeaAttachment[];
};
export type ScheduledStageData = {
  scheduledDate: string;
  scheduledTime: string;
  platform: "Instagram" | "YouTube" | "Other";
  publishingNotes: string;
  attachments?: ContentIdeaAttachment[];
};
export type PublishedStageData = {
  publishedUrl: string;
  publishedDate: string;
  publishedTime: string;
  platform: "Instagram" | "YouTube" | "Other";
  finalNotes: string;
  status: string;
  attachments?: ContentIdeaAttachment[];
};
export type ProductionStageData = {
  Idea: IdeaStageData;
  Scripting: ScriptingStageData;
  Shooting: ShootingStageData;
  Editing: EditingStageData;
  Thumbnail: ThumbnailStageData;
  Scheduled: ScheduledStageData;
  Published: PublishedStageData;
};
export type ProductionStageDataByStage = Partial<ProductionStageData>;
export type ProductionStagePayload = ProductionStageData[ProductionStage];

export const ensureWorkflowSteps = (
  steps?: WorkflowStepInput[],
  currentStage: ProductionStage = "Idea",
  stageData?: ProductionStageDataByStage,
): WorkflowStep[] => {
  const currentIndex = Math.max(0, PRODUCTION_STAGES.indexOf(currentStage));
  return PRODUCTION_STAGES.map((stage, index) => {
    const saved = steps?.find((step) =>
      "stage" in step ? step.stage === stage : step.index === index,
    );
    const savedStatus = saved && "status" in saved ? saved.status : undefined;
    const hasDraft = Boolean(stageData?.[stage]) && !saved?.completed;
    const status: ProductionStepStatus = index < currentIndex
      ? "completed"
      : index > currentIndex
        ? "locked"
        : saved?.completed || savedStatus === "completed"
          ? "completed"
          : savedStatus === "draft" || savedStatus === "current"
            ? savedStatus
            : hasDraft ? "draft" : "current";
    return {
      stage,
      completed: status === "completed" || Boolean(saved?.completed && status !== "draft"),
      status,
      ...(saved?.notes ? { notes: saved.notes } : {}),
    };
  });
};

export type ContentIdea = {
  id: string;
  title: string;
  description: string;
  concept?: string;
  ideaNotes?: string;
  platform: SocialPlatform | "Other";
  archived: boolean;
  projectId?: string;
  budget?: string;
  reminderDate?: string;
  shootLocation?: string;
  equipment?: string;
  sourceUrl?: string;
  attachment?: ContentIdeaAttachment;
  notes?: { id: string; text: string; createdAt: string }[];
};
export type ProductionProject = {
  id: string;
  ideaId: string;
  title: string;
  description: string;
  platform: "Instagram" | "YouTube" | "Other";
  budget?: string;
  sourceUrl?: string;
  attachment?: ContentIdeaAttachment;
  reminderDate?: string;
  shootLocation?: string;
  equipment?: string;
  dueDate?: string;
  assignedTo: string;
  currentStage: ProductionStage;
  workflowSteps: WorkflowStep[];
  stageData: ProductionStageDataByStage;
  validationErrors: Partial<Record<ProductionStage, Record<string, string>>>;
  createdAt: string;
  archived?: boolean;
};
export type Influencer = {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string;
  city: string;
  state?: string;
  niche: string;
  rating: number;
  reviews: number;
  followers: string;
  price: string;
  engagementRate?: string;
  platforms: SocialPlatform[];
  contentTypes: CreatorContentType[];
  featured?: boolean;
  matchScore?: number;
  matchReasons?: string[];
};
export type CreatorWorkHistory = {
  id: string;
  brandName: string;
  brandInitials: string;
  title: string;
  deliverables: string;
  period: string;
  summary: string;
  category?: string;
  platform?: SocialPlatform;
  caption?: string;
  date?: string;
  views?: string;
  engagement?: string;
  media?: DemoAttachment[];
};
export type CreatorReview = {
  id: string;
  author: string;
  rating: number;
  text: string;
  date?: string;
  tags?: string[];
};
export type AuthoredReview = CreatorReview & {
  subjectName: string;
  campaignId: string;
  authorRole: "Brand" | "Influencer";
};
export type PublicCreatorProfile = Influencer & {
  bio?: string;
  publicEmail?: string;
  publicPhone?: string;
  contactEnabled?: boolean;
  workHistory?: CreatorWorkHistory[];
  reviewItems?: CreatorReview[];
  socialAccounts?: Partial<Record<SocialPlatform, string>>;
  socialVerification?: Partial<Record<SocialPlatform, SocialVerificationStatus>>;
};
export type MarketFilters = {
  locations: { state: string; city: string | null }[];
  platforms: SocialPlatform[];
  priceRange: { min: string; max: string };
  ratingRange: { min: string; max: string };
  followersRange: { min: string; max: string };
  categories: string[];
  contentTypes: CreatorContentType[];
};
export type BriefRequirement = {
  id: string;
  label: string;
  type: "text" | "url" | "file";
  required: boolean;
};
export type BrandBrief = {
  id: string;
  campaignId?: string;
  brandId?: string;
  brandName: string;
  brandInitials: string;
  title: string;
  description: string;
  brandDescription: string;
  city: string;
  category: string;
  budget: string;
  deliverables: string;
  preferredPlatforms: SocialPlatform[];
  requirements: BriefRequirement[];
  publicDetails: string[];
  deadlineAt?: string | null;
  matchScore?: number;
  active: boolean;
  brandLogoUrl?: string;
  brandWebsite?: string;
  brandReviews?: { id: string; creatorName: string; rating: number; text: string; date: string }[];
};
export type MarketplaceApplicationStatus = "Pending" | "Accepted" | "Declined" | "Blocked";
export type MarketplaceApplicationHistory = {
  id: string;
  status: Exclude<MarketplaceApplicationStatus, "Blocked">;
  actorId: string;
  actorRole: "Brand" | "Influencer";
  invitedByBrand: boolean;
  rejectionReason?: string;
  occurredAt: string;
};
export type MarketplaceApplication = {
  id: string;
  briefId: string;
  campaignId?: string;
  brandId?: string;
  requestId?: string;
  briefTitle: string;
  brandName: string;
  brandInitials: string;
  creatorId: string;
  creatorName: string;
  creatorInitials: string;
  creatorProfile: PublicCreatorProfile;
  contactShared: boolean;
  responses: Record<string, string>;
  attachments: DemoAttachment[];
  status: MarketplaceApplicationStatus;
  submittedAt: string;
  conversationId: string;
  message: string;
  rejectionReason?: string;
  canReapply?: boolean;
  direction?: "creator-to-brand" | "brand-to-creator";
  history?: MarketplaceApplicationHistory[];
  completedAt?: string | null;
  completionConfirmedBy?: { brand: boolean; creator: boolean };
  payment?: { amount: string; paidAt: string | null; updatedAt: string } | null;
  reviews?: { id: string; authorId: string; author: string; subjectId: string; subject: string; rating: number; text: string; createdAt: string }[];
};
export type MarketplaceConversationStatus = "Pending" | "Accepted" | "Declined" | "Blocked";
export type MarketplaceMessage = {
  id: string;
  text: string;
  mine: boolean;
  senderRole?: "Brand" | "Influencer";
  time: string;
  status?: "sent" | "delivered" | "seen" | "failed";
  senderId?: string;
  clientMessageId?: string;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
  replyToId?: string;
  attachmentName?: string;
  attachments?: DemoAttachment[];
  replyTo?: { author: string; text: string };
  edited?: boolean;
  videoBriefId?: string;
  taskId?: string;
  campaignRequestId?: string;
};
export type MarketplaceConversation = {
  id: string;
  requestId?: string;
  applicationId: string;
  campaignId?: string;
  brandId?: string;
  creatorId?: string;
  participantName: string;
  participantInitials: string;
  participantAvatarUrl?: string;
  briefTitle: string;
  preview: string;
  status: MarketplaceConversationStatus;
  blockedBy: Array<"brand" | "creator">;
  updatedAt: string;
  unreadCount?: number;
  online?: boolean;
  favorite?: boolean;
  muted?: boolean;
  messages?: MarketplaceMessage[];
  messagesSyncedAt?: number;
  messageCursor?: string;
  direction?: "creator-to-brand" | "brand-to-creator";
  adminChat?: boolean;
};
export type MarketplaceBlock = {
  id: string;
  campaignId?: string;
  brandId: string;
  creatorId: string;
  createdAt: string;
};
export type CampaignStatus =
  | "Draft"
  | "Published"
  | "Open"
  | "Proposal sent"
  | "Accepted"
  | "Completed"
  | "Closed"
  | "Archived";
export type Campaign = {
  id: string;
  brandId?: string;
  brandInitials?: string;
  brand: string;
  title: string;
  description: string;
  city: string;
  targetLocations?: string[];
  category: string;
  budget: string;
  deadline: string;
  deadlineAt?: string | null;
  status: CampaignStatus;
  platforms?: SocialPlatform[];
  deliverables?: string;
  requirements?: string[];
  creatorRequirements?: string;
  media?: DemoAttachment[];
  brandDescription?: string;
  brandLogoUrl?: string;
  brandReviews?: BrandBrief["brandReviews"];
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  archived?: boolean;
  promoted?: boolean;
  collaborationVideoUrl?: string;
  collaborationVideoLabel?: string;
  visibility?: "public" | "private";
  applicationCount?: number;
  applicationLimit?: number | null;
  approvalLimit?: number | null;
  approvedCount?: number;
  applicationsOpen?: boolean;
  applicationLimitReached?: boolean;
  approvalLimitReached?: boolean;
  closeOnApplicationLimit?: boolean;
  closeOnApprovalLimit?: boolean;
  applicationStatus?: MarketplaceApplicationStatus;
  matchScore?: number;
  matchReasons?: string[];
};
export type CampaignDraft = {
  id?: string;
  title: string;
  city: string;
  category: string;
  budget: string;
  description: string;
  platforms?: SocialPlatform[];
  deadline?: string;
  deliverables?: string;
  requirements?: string[];
  creatorRequirements?: string;
  collaborationVideoUrl?: string;
  collaborationVideoLabel?: string;
  media?: DemoAttachment[];
  applicationLimit?: number | null;
  approvalLimit?: number | null;
  closeOnApplicationLimit?: boolean;
  closeOnApprovalLimit?: boolean;
};
export type Conversation = {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string;
  message: string;
  time: string;
  unread?: number;
};

export type ProfileDraft = {
  name: string;
  city: string;
  focus: string;
  bio: string;
  audienceSize?: string;
  rateRange?: string;
  teamSize?: string;
  avatarUri?: string;
  websiteUrl?: string;
  languages?: string[];
  /** Creator audience locations; city remains the creator's own location. */
  locations?: string[];
  isPublic?: boolean;
};

export type ProposalStatus = "Pending" | "Accepted" | "Declined" | "Completed";
export type DealStatus = "Completed" | "Cancelled" | "Reported";
export type ProposalDirection = "brand_to_creator" | "creator_to_brand";
export type DeliverySchedule = {
  format: string;
  deliveryDate: string;
  deliveryTime: string;
  reminderSet: boolean;
  dueAt?: number;
};
export type ReminderTone =
  | "default"
  | "silent"
  | "soft-chime"
  | "bright-bell"
  | "focus-pulse"
  | "morning-rise"
  | "warm-double"
  | "clear-triangle"
  | "gentle-wave"
  | "short-alert"
  | "deep-note"
  | "sparkle-sequence"
  | "akx-alarmed"
  | "akx-beeper"
  | "akx-belligerent"
  | "akx-calm"
  | "akx-chord"
  | "akx-chord2"
  | "akx-cloud"
  | "akx-glass"
  | "akx-glisten"
  | "akx-polite"
  | "akx-sharp"
  | "akx-whistleronic";
export type ReminderSettings = {
  snoozeMinutes?: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  soundTone: ReminderTone;
};
export type Reminder = {
  ownerId?: string;
  completed?: boolean;
  id: string;
  proposalId?: string;
  taskId?: string;
  title: string;
  campaignTitle: string;
  participantName: string;
  deliveryDate: string;
  deliveryTime: string;
  dueAt: number;
  enabled: boolean;
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
  soundTone?: ReminderTone;
  notificationId?: string;
};
export type DemoProposal = {
  id: string;
  proposalTitle?: string;
  direction: ProposalDirection;
  status: ProposalStatus;
  campaignId: string;
  campaignTitle: string;
  participantName: string;
  participantInitials: string;
  participantAvatarUrl?: string;
  city: string;
  amount: string;
  deliverables: string;
  message: string;
  updatedAt: string;
  attachments?: DemoAttachment[];
  schedule?: DeliverySchedule;
};
export type DemoAttachment = {
  id: string;
  name: string;
  type: "image" | "video" | "file";
  uri?: string;
};
export type ProposalDraft = {
  title: string;
  amount: string;
  deliverables: string;
  message: string;
  attachments: DemoAttachment[];
  deliveryDate?: string;
  deliveryTime?: string;
  reminderAt?: number;
  reminderEnabled?: boolean;
  reminderSettings?: ReminderSettings;
};
export type ProposalContext = {
  campaignId: string;
  campaignTitle: string;
  participantName: string;
  participantInitials: string;
  participantAvatarUrl?: string;
  city: string;
  defaultAmount: string;
  defaultDeliverables: string;
};
