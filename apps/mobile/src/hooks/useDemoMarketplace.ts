import { useEffect, useMemo, useState } from "react";
import { Image as ExpoImage } from "expo-image";
import {
  demoCampaigns,
  demoConversations,
  demoHomePromos,
  demoInfluencers,
  demoProposals,
} from "../services/demoMarketplace.service";
import { DemoProposal, ProposalStatus } from "../types/marketplace";

export function useDemoMarketplace() {
  const [savedIds, setSavedIds] = useState<string[]>(["i1"]);
  const [creatorLocations, setCreatorLocations] = useState<string[]>([
    "Mumbai",
    "Delhi",
    "Bengaluru",
    "Pan India",
  ]);
  const [proposals, setProposals] = useState<DemoProposal[]>(demoProposals);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 650);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    const imageUris = [
      ...demoInfluencers.map((item) => item.avatarUrl),
      ...demoHomePromos.map((item) => item.media?.uri),
    ].filter((uri): uri is string => Boolean(uri));
    void ExpoImage.prefetch(imageUris, { cachePolicy: "memory-disk" }).catch(
      () => false,
    );
  }, []);
  const influencers = useMemo(
    () =>
      demoInfluencers.filter((item) =>
        `${item.name} ${item.city} ${item.niche}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query],
  );
  const toggleSaved = (id: string) =>
    setSavedIds((current) =>
      current.includes(id)
        ? current.filter((saved) => saved !== id)
        : [...current, id],
    );
  const updateProposalStatus = (id: string, status: ProposalStatus) => {
    setProposals((current) =>
      current.map((proposal) =>
        proposal.id === id
          ? { ...proposal, status, updatedAt: "Just now" }
          : proposal,
      ),
    );
  };
  const createProposal = (proposal: Omit<DemoProposal, "id" | "updatedAt">) => {
    setProposals((current) => [
      { ...proposal, id: `proposal-${Date.now()}`, updatedAt: "Just now" },
      ...current,
    ]);
  };
  const updateCreatorLocations = (locations: string[]) => {
    setCreatorLocations(
      Array.from(
        new Set(locations.map((location) => location.trim()).filter(Boolean)),
      ),
    );
  };
  return {
    influencers,
    campaigns: demoCampaigns,
    conversations: demoConversations,
    proposals,
    homePromos: demoHomePromos,
    query,
    setQuery,
    savedIds,
    toggleSaved,
    updateProposalStatus,
    createProposal,
    creatorLocations,
    updateCreatorLocations,
    isLoading,
  };
}
