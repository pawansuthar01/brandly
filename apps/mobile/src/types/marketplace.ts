export type SocialPlatform =
  | "Instagram"
  | "YouTube"
  | "TikTok"
  | "Facebook"
  | "Pinterest"
  | "LinkedIn"
  | "Snapchat"
  | "X";
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
  | "Discover"
  | "Campaigns"
  | "Proposals"
  | "Profile";
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
  platforms: SocialPlatform[];
  contentTypes: CreatorContentType[];
  featured?: boolean;
};
export type Campaign = {
  id: string;
  brand: string;
  title: string;
  description: string;
  city: string;
  category: string;
  budget: string;
  deadline: string;
  status: "Open" | "Proposal sent" | "Accepted" | "Completed";
};
export type CampaignDraft = {
  title: string;
  city: string;
  category: string;
  budget: string;
  description: string;
};
export type Conversation = {
  id: string;
  name: string;
  initials: string;
  message: string;
  time: string;
  unread?: number;
};

export type ProposalStatus = "Pending" | "Accepted" | "Declined" | "Completed";
export type DealStatus = "Completed" | "Cancelled" | "Reported";
export type ProposalDirection = "brand_to_creator" | "creator_to_brand";
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
