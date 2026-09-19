import {
  Campaign,
  Conversation,
  DemoProposal,
  Influencer,
} from "../types/marketplace";

export type HomePromo = {
  id: string;
  eyebrow: string;
  title?: string;
  description?: string;
  cta?: {
    kind: "button" | "link" | "icon";
    label?: string;
    position: "bottomLeft" | "bottomRight";
  };
  action: "discover" | "campaigns";
  icon:
    | "search-outline"
    | "briefcase-outline"
    | "bookmark-outline"
    | "location-outline"
    | "sparkles-outline";
  background: "primary" | "accent" | "surfaceMuted";
  layout: "text" | "image" | "split" | "imageOnly";
  audience: "Brand" | "Influencer" | "Both";
  media?: { type: "image"; uri: string };
};

// This mirrors the future admin-managed Home configuration API. For the UI demo,
// it remains local data; the Home screen never owns hard-coded marketing content.
export const demoHomePromos: HomePromo[] = [
  {
    id: "promo-creator-search",
    eyebrow: "CREATOR DISCOVERY",
    title: "Find creators for your next brief",
    description: "Use audience, city and category to narrow the right match.",
    cta: { kind: "icon", position: "bottomRight" },
    action: "discover",
    icon: "search-outline",
    background: "surfaceMuted",
    layout: "image",
    audience: "Brand",
    media: {
      type: "image",
      uri: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=85",
    },
  },
  {
    id: "promo-campaign",
    eyebrow: "CAMPAIGN BRIEFS",
    title: "Your open campaigns, in one place",
    description: "Compare proposals and keep every discussion organised.",
    cta: { kind: "button", label: "View campaigns", position: "bottomRight" },
    action: "campaigns",
    icon: "briefcase-outline",
    background: "accent",
    layout: "image",
    audience: "Both",
    media: {
      type: "image",
      uri: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80",
    },
  },
  {
    id: "promo-shortlist",
    eyebrow: "SAVED CREATORS",
    title: "Build a shortlist before you send a proposal",
    description: "Save profiles and come back when your campaign is ready.",
    cta: { kind: "link", label: "Explore creators", position: "bottomLeft" },
    action: "discover",
    icon: "bookmark-outline",
    background: "surfaceMuted",
    layout: "text",
    audience: "Brand",
  },
  {
    id: "promo-location",
    eyebrow: "LOCATION MATCHING",
    title: "Discover local creators for local campaigns",
    description:
      "Find profiles by city and state, then connect with confidence.",
    cta: { kind: "icon", position: "bottomRight" },
    action: "discover",
    icon: "location-outline",
    background: "accent",
    layout: "split",
    audience: "Influencer",
    media: {
      type: "image",
      uri: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80",
    },
  },
  {
    id: "promo-image-only",
    eyebrow: "CREATOR PORTFOLIO",
    cta: { kind: "icon", position: "bottomRight" },
    action: "discover",
    icon: "bookmark-outline",
    background: "surfaceMuted",
    layout: "imageOnly",
    audience: "Both",
    media: {
      type: "image",
      uri: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
    },
  },
];

export const demoInfluencers: Influencer[] = [
  {
    id: "i1",
    name: "Aarohi Mehta",
    initials: "AM",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
    city: "Mumbai",
    state: "Maharashtra",
    niche: "Fashion & Beauty",
    rating: 4.9,
    reviews: 86,
    followers: "128K",
    price: "₹8K – ₹15K",
    platforms: ["Instagram", "YouTube", "Pinterest"],
    contentTypes: ["Reel", "Photo post", "Carousel", "Long video"],
    featured: true,
  },
  {
    id: "i2",
    name: "Rohan Kapoor",
    initials: "RK",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80",
    city: "Delhi",
    state: "Delhi NCR",
    niche: "Food & Lifestyle",
    rating: 4.8,
    reviews: 64,
    followers: "84K",
    price: "₹6K – ₹12K",
    platforms: ["Instagram", "Facebook", "Snapchat"],
    contentTypes: ["Reel", "Story", "Live", "Photo post"],
    featured: true,
  },
  {
    id: "i3",
    name: "Nisha Iyer",
    initials: "NI",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80",
    city: "Bengaluru",
    state: "Karnataka",
    niche: "Tech & Apps",
    rating: 4.9,
    reviews: 42,
    followers: "96K",
    price: "₹10K – ₹20K",
    platforms: ["YouTube", "Instagram", "LinkedIn"],
    contentTypes: ["Long video", "Short video", "Carousel", "Blog post"],
  },
  {
    id: "i4",
    name: "Kabir Singh",
    initials: "KS",
    avatarUrl:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=240&q=80",
    city: "Pune",
    state: "Maharashtra",
    niche: "Fitness",
    rating: 4.7,
    reviews: 31,
    followers: "57K",
    price: "₹5K – ₹9K",
    platforms: ["Instagram", "TikTok"],
    contentTypes: ["Reel", "Short video", "Live"],
  },
  {
    id: "i5",
    name: "Meera Shah",
    initials: "MS",
    avatarUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=240&q=80",
    city: "Ahmedabad",
    state: "Gujarat",
    niche: "Home & Lifestyle",
    rating: 4.8,
    reviews: 52,
    followers: "71K",
    price: "₹7K – ₹13K",
    platforms: ["Instagram", "YouTube", "Pinterest"],
    contentTypes: ["Photo post", "Carousel", "Reel", "Long video"],
  },
  {
    id: "i6",
    name: "Arjun Rao",
    initials: "AR",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=240&q=80",
    city: "Hyderabad",
    state: "Telangana",
    niche: "Gaming & Tech",
    rating: 4.9,
    reviews: 48,
    followers: "142K",
    price: "₹14K – ₹24K",
    platforms: ["YouTube", "X", "TikTok"],
    contentTypes: ["Long video", "Short video", "Live"],
  },
  {
    id: "i7",
    name: "Sana Ali",
    initials: "SA",
    avatarUrl:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=240&q=80",
    city: "Kolkata",
    state: "West Bengal",
    niche: "Travel & Food",
    rating: 4.8,
    reviews: 39,
    followers: "63K",
    price: "₹6K – ₹11K",
    platforms: ["Instagram", "Facebook", "Pinterest"],
    contentTypes: ["Reel", "Story", "Photo post", "Carousel"],
  },
];

export const demoCampaigns: Campaign[] = [
  {
    id: "c1",
    brand: "Mellow Skincare",
    title: "Monsoon glow routine",
    description:
      "Share a simple three-step skincare routine through a warm, everyday reel.",
    city: "Mumbai",
    category: "Beauty",
    budget: "₹10K – ₹18K",
    deadline: "Apply by 24 Sep",
    status: "Open",
  },
  {
    id: "c2",
    brand: "FreshBite",
    title: "Weekend café discovery",
    description:
      "Visit a new café and create an honest short-form food discovery post.",
    city: "Delhi NCR",
    category: "Food",
    budget: "₹7K – ₹12K",
    deadline: "Apply by 28 Sep",
    status: "Open",
  },
  {
    id: "c3",
    brand: "PocketPay",
    title: "Creator app walkthrough",
    description:
      "Show how a quick payment flow fits naturally into a busy creator day.",
    city: "Pan India",
    category: "Tech",
    budget: "₹12K – ₹22K",
    deadline: "Proposal sent",
    status: "Proposal sent",
  },
  {
    id: "c4",
    brand: "Stride Studio",
    title: "New activewear drop",
    description:
      "Style the new training collection in a high-energy gym or outdoor routine.",
    city: "Bengaluru",
    category: "Fitness",
    budget: "₹9K – ₹16K",
    deadline: "Apply by 30 Sep",
    status: "Open",
  },
  {
    id: "c5",
    brand: "Natura Table",
    title: "Weekend recipe series",
    description:
      "Create a relaxed recipe reel featuring the brand’s pantry essentials.",
    city: "Pan India",
    category: "Food",
    budget: "₹8K – ₹14K",
    deadline: "Apply by 2 Oct",
    status: "Open",
  },
  {
    id: "c6",
    brand: "Roamly Stays",
    title: "City stay guide",
    description:
      "Document a thoughtful weekend stay with local recommendations for travellers.",
    city: "Jaipur",
    category: "Travel",
    budget: "₹11K – ₹19K",
    deadline: "Apply by 4 Oct",
    status: "Open",
  },
  {
    id: "c7",
    brand: "Nook Living",
    title: "Small-space refresh",
    description:
      "Show practical ways to refresh a compact home using the new décor edit.",
    city: "Pan India",
    category: "Home",
    budget: "₹8K – ₹15K",
    deadline: "Apply by 6 Oct",
    status: "Open",
  },
  {
    id: "c8",
    brand: "Playverse",
    title: "Co-op game launch",
    description:
      "Create a first-play reaction and invite your community to join the launch.",
    city: "Hyderabad",
    category: "Gaming",
    budget: "₹13K – ₹24K",
    deadline: "Apply by 9 Oct",
    status: "Open",
  },
];

export const demoConversations: Conversation[] = [
  {
    id: "m1",
    name: "Aarohi Mehta",
    initials: "AM",
    message: "I would love to know more about the deliverables.",
    time: "10:42 AM",
    unread: 2,
  },
  {
    id: "m2",
    name: "Mellow Skincare",
    initials: "MS",
    message: "Your proposal has been accepted.",
    time: "Yesterday",
  },
  {
    id: "m3",
    name: "Rohan Kapoor",
    initials: "RK",
    message: "Thanks for reaching out!",
    time: "Mon",
  },
];

export const demoProposals: DemoProposal[] = [
  {
    id: "p1",
    direction: "brand_to_creator",
    status: "Accepted",
    campaignId: "c1",
    campaignTitle: "Monsoon glow routine",
    participantName: "Aarohi Mehta",
    participantInitials: "AM",
    participantAvatarUrl: demoInfluencers[0]?.avatarUrl,
    city: "Mumbai",
    amount: "₹12,000",
    deliverables: "1 reel, 3 story frames, usage for 30 days",
    message: "A warm, useful routine that feels natural for your audience.",
    updatedAt: "Today, 10:43 AM",
    attachments: [
      { id: "a1", name: "Monsoon-campaign-brief.pdf", type: "file" },
      {
        id: "a2",
        name: "Routine-reference.jpg",
        type: "image",
        uri: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=80",
      },
    ],
  },
  {
    id: "p2",
    direction: "creator_to_brand",
    status: "Pending",
    campaignId: "c2",
    campaignTitle: "Weekend café discovery",
    participantName: "FreshBite",
    participantInitials: "FB",
    city: "Delhi",
    amount: "₹9,500",
    deliverables: "1 short video, 5 story frames, location tag",
    message: "I can cover the café visit with a balanced, local-first review.",
    updatedAt: "Yesterday",
    attachments: [
      {
        id: "a3",
        name: "Cafe-concept.mp4",
        type: "video",
        uri: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
      },
    ],
  },
  {
    id: "p3",
    direction: "creator_to_brand",
    status: "Completed",
    campaignId: "c3",
    campaignTitle: "Creator app walkthrough",
    participantName: "PocketPay",
    participantInitials: "PP",
    city: "Pan India",
    amount: "₹18,000",
    deliverables: "1 long video, 2 short clips, pinned comment",
    message: "The walkthrough is live and the agreed files have been shared.",
    updatedAt: "18 Sep",
    attachments: [{ id: "a4", name: "Walkthrough-final.mp4", type: "video" }],
  },
  {
    id: "p4",
    direction: "brand_to_creator",
    status: "Pending",
    campaignId: "c4",
    campaignTitle: "New activewear drop",
    participantName: "Kabir Singh",
    participantInitials: "KS",
    participantAvatarUrl: demoInfluencers[3]?.avatarUrl,
    city: "Pune",
    amount: "₹12,500",
    deliverables: "1 training reel, 4 story frames",
    message: "Please share your availability and preferred shoot location.",
    updatedAt: "17 Sep",
    attachments: [{ id: "a5", name: "Activewear-brief.pdf", type: "file" }],
  },
];
