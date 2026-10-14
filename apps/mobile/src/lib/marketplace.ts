import type {
  BrandBrief,
  Campaign,
  CampaignStatus,
  PublicCreatorProfile,
} from "../types/marketplace";
import { formatCampaignDeadline } from "./dateTime";

export const slugifyMarketplaceIdentity = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "current";

export const getMarketplaceIdentityId = (
  role: "Brand" | "Influencer",
  name: string,
) => `${role === "Brand" ? "brand" : "creator"}-${slugifyMarketplaceIdentity(name)}`;

export const isPublishedCampaign = (campaign: Campaign) =>
  campaign.status === "Published" || campaign.status === "Open";

export const campaignToBrandBrief = (campaign: Campaign): BrandBrief => ({
  id: `brief-${campaign.id}`,
  campaignId: campaign.id,
  brandId: campaign.brandId,
  brandName: campaign.brand,
  brandInitials: campaign.brandInitials ?? campaign.brand.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
  title: campaign.title,
  description: campaign.description,
  brandDescription: campaign.brandDescription ?? "No public brand description has been added yet.",
  city: campaign.city,
  category: campaign.category,
  budget: campaign.budget,
  deadlineAt: campaign.deadlineAt ?? campaign.deadline,
  deliverables: campaign.deliverables ?? "Not specified",
  preferredPlatforms: campaign.platforms ?? [],
  requirements: (campaign.requirements ?? []).map((label, index) => ({
    id: `${campaign.id}-requirement-${index + 1}`,
    label,
    type: "text" as const,
    required: true,
  })),
  publicDetails: [
    campaign.deadline ? `Deadline: ${formatCampaignDeadline(campaign.deadlineAt ?? campaign.deadline)}` : "Flexible deadline",
    campaign.creatorRequirements ?? "No creator requirements have been added yet.",
  ],
  matchScore: undefined,
  active: isPublishedCampaign(campaign) && campaign.visibility !== "private",
  brandLogoUrl: campaign.brandLogoUrl,
  brandReviews: campaign.brandReviews,
});

export const brandBriefToCampaign = (brief: BrandBrief): Campaign => ({
  id: brief.campaignId ?? brief.id,
  brandId: brief.brandId,
  brandInitials: brief.brandInitials,
  brand: brief.brandName,
  title: brief.title,
  description: brief.description,
  city: brief.city,
  category: brief.category,
  budget: brief.budget,
  deadline: "Flexible",
  status: "Published",
  platforms: brief.preferredPlatforms,
  deliverables: brief.deliverables,
  requirements: brief.requirements.map((requirement) => requirement.label),
  brandDescription: brief.brandDescription,
  brandLogoUrl: brief.brandLogoUrl,
  brandReviews: brief.brandReviews,
});

export const getCampaignStatusLabel = (status: CampaignStatus) => {
  if (status === "Open") return "Published";
  if (status === "Proposal sent") return "In progress";
  return status;
};

export const parseCampaignBudgetValue = (value: string) => {
  const values = (value.match(/[\d,.]+\s*[KLM]?/gi) ?? []).map((part) => {
    const normalized = part.replace(/,/g, "").trim().toUpperCase();
    const multiplier = normalized.endsWith("M") ? 1_000_000 : normalized.endsWith("L") ? 100_000 : normalized.endsWith("K") ? 1_000 : 1;
    return Number.parseFloat(normalized.replace(/[KLM]/g, "")) * multiplier;
  }).filter((amount) => Number.isFinite(amount));
  if (!values.length) return 0;
  return values.reduce((total, amount) => total + amount, 0) / values.length;
};

export const calculateCampaignMatchScore = (
  brief: BrandBrief,
  creator?: PublicCreatorProfile,
) => {
  if (!creator) return undefined;
  const checks: boolean[] = [];
  if (brief.preferredPlatforms.length && creator.platforms.length) {
    checks.push(brief.preferredPlatforms.some((platform) => creator.platforms.includes(platform)));
  }
  if (brief.category && creator.niche) {
    checks.push(`${creator.niche} ${creator.contentTypes.join(" ")}`.toLowerCase().includes(brief.category.toLowerCase()));
  }
  if (brief.city && creator.city) {
    checks.push(brief.city.toLowerCase() === creator.city.toLowerCase() || brief.city.toLowerCase() === "pan india");
  }
  if (!checks.length) return undefined;
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};
