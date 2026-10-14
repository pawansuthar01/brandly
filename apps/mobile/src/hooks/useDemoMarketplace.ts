import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createSelector } from "@reduxjs/toolkit";
import {
  demoHomePromos,
  demoInfluencers,
} from "../services/demoMarketplace.service";
import {
  ContentIdea,
  DemoProposal,
  MarketplaceApplication,
  MarketplaceApplicationStatus,
  MarketplaceMessage,
  Campaign,
  ProductionProject,
  ProductionStage,
  ProductionStagePayload,
  ProposalStatus,
  Reminder,
  ReminderSettings,
  TodoTask,
  TodoTaskDraft,
  AuthoredReview,
} from "../types/marketplace";
import {
  addIdea as addIdeaAction,
  updateIdea as updateIdeaAction,
  addTodoTask as addTodoTaskAction,
  archiveIdea as archiveIdeaAction,
  unarchiveIdea as unarchiveIdeaAction,
  addIdeaNote as addIdeaNoteAction,
  updateIdeaNote as updateIdeaNoteAction,
  removeIdeaNote as removeIdeaNoteAction,
  createProjectFromIdea as createProjectFromIdeaAction,
  updateProductionProject as updateProductionProjectAction,
  saveProductionStageDraft as saveProductionStageDraftAction,
  completeProductionStage as completeProductionStageAction,
  createProposal as createProposalAction,
  setQuery as setQueryAction,
  toggleSaved,
  toggleComparison,
  toggleTodoTask as toggleTodoTaskAction,
  updateTodoTask as updateTodoTaskAction,
  addTodoTaskNote as addTodoTaskNoteAction,
  updateTodoTaskNote as updateTodoTaskNoteAction,
  removeTodoTaskNote as removeTodoTaskNoteAction,
  updateCreatorLocations as updateCreatorLocationsAction,
  updateProposalStatus as updateProposalStatusAction,
  updateReminder as updateReminderAction,
  upsertReminder as upsertReminderAction,
  setReminderSettings as setReminderSettingsAction,
  submitMarketplaceApplication as submitMarketplaceApplicationAction,
  toggleMarketplaceBlock as toggleMarketplaceBlockAction,
  updateMarketplaceApplicationStatus as updateMarketplaceApplicationStatusAction,
  declineMarketplaceApplication as declineMarketplaceApplicationAction,
  upsertCampaign as upsertCampaignAction,
  archiveCampaign as archiveCampaignAction,
  toggleMarketplaceApplicationBlock as toggleMarketplaceApplicationBlockAction,
  addMarketplaceMessage as addMarketplaceMessageAction,
  updateMarketplaceMessage as updateMarketplaceMessageAction,
  removeMarketplaceMessage as removeMarketplaceMessageAction,
  addAuthoredReview as addAuthoredReviewAction,
  updateAuthoredReview as updateAuthoredReviewAction,
  type MobileDispatch,
  type MobileRootState,
} from "../store/store";
import { campaignToBrandBrief, isPublishedCampaign } from "../lib/marketplace";

const isRemoteId = (value: string | undefined) => Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

const selectMarketplaceBriefs = createSelector(
  [
    (state: MobileRootState) => state.demo.briefs,
    (state: MobileRootState) => state.demo.campaigns,
    (state: MobileRootState) => state.auth.userId,
  ],
  (allBriefs, allCampaigns, userId) => {
    const briefs = userId ? allBriefs.filter((brief) => isRemoteId(brief.campaignId ?? brief.id)) : allBriefs;
    const campaigns = userId ? allCampaigns.filter((campaign) => isRemoteId(campaign.id)) : allCampaigns;
    const campaignsById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
    const campaignsByIdentity = new Map(campaigns.map((campaign) => [`${campaign.title}\u0000${campaign.brand}`, campaign]));
    const linkedBriefs = briefs
      .map((brief) => {
        const linkedCampaign = (brief.campaignId ? campaignsById.get(brief.campaignId) : undefined) ??
          campaignsByIdentity.get(`${brief.title}\u0000${brief.brandName}`);
        return { brief, linkedCampaign };
      })
      .filter(({ linkedCampaign }) => !linkedCampaign || (isPublishedCampaign(linkedCampaign) && linkedCampaign.visibility !== "private"))
      .map(({ brief, linkedCampaign }) => ({
        ...brief,
        campaignId: brief.campaignId ?? linkedCampaign?.id,
        brandId: brief.brandId ?? linkedCampaign?.brandId,
        deadlineAt: brief.deadlineAt ?? linkedCampaign?.deadlineAt ?? linkedCampaign?.deadline,
      }));
    const seededCampaignIds = new Set(linkedBriefs.map((brief) => brief.campaignId).filter(Boolean));
    return [
      ...linkedBriefs,
      ...campaigns
        .filter((campaign) => isPublishedCampaign(campaign) && campaign.visibility !== "private")
        .filter((campaign) => !seededCampaignIds.has(campaign.id))
        .map(campaignToBrandBrief),
    ];
  },
);

const selectMarketplaceInfluencers = createSelector(
  [(state: MobileRootState) => state.demo.query, (state: MobileRootState) => state.auth.userId],
  (query, userId) => {
    if (userId) return [];
    const normalizedQuery = query.toLowerCase();
    return demoInfluencers.filter((item) =>
      `${item.name} ${item.city} ${item.niche}`.toLowerCase().includes(normalizedQuery),
    );
  },
);

const selectAllMarketplaceInfluencers = (state: MobileRootState) => state.auth.userId ? [] : demoInfluencers;

export function useDemoMarketplace() {
  const dispatch = useDispatch<MobileDispatch>();
  const demoState = useSelector((state: MobileRootState) => state.demo);
  const isAuthenticated = useSelector((state: MobileRootState) => Boolean(state.auth.userId));
  const {
    savedIds,
    comparisonIds,
    creatorLocations,
    proposals,
    reminders,
    ideas,
    projects,
    todoTasks,
    campaigns,
    applications,
    marketplaceConversations,
    marketplaceBlocks,
    query,
  } = demoState;
  const authoredReviews = useSelector((state: MobileRootState) => state.demo.authoredReviews);
  const campaignsForSession = useMemo(() => isAuthenticated ? campaigns.filter((campaign) => isRemoteId(campaign.id)) : campaigns, [campaigns, isAuthenticated]);
  const applicationsForSession = useMemo(() => isAuthenticated ? applications.filter((application) => isRemoteId(application.id)) : applications, [applications, isAuthenticated]);
  const conversationsForSession = useMemo(() => isAuthenticated ? marketplaceConversations.filter((conversation) => isRemoteId(conversation.id)) : marketplaceConversations, [marketplaceConversations, isAuthenticated]);
  const proposalsForSession = isAuthenticated ? [] : proposals;
  const remindersForSession = isAuthenticated ? [] : reminders;
  const blocksForSession = isAuthenticated ? [] : marketplaceBlocks;
  const savedIdsForSession = isAuthenticated ? [] : savedIds;
  const comparisonIdsForSession = isAuthenticated ? [] : comparisonIds;
  const authoredReviewsForSession = isAuthenticated ? [] : authoredReviews;
  const reminderSettings = useSelector((state: MobileRootState) => state.preferences.reminderSettings);
  const isLoading = false;
  const marketplaceBriefs = useSelector(selectMarketplaceBriefs);
  const influencers = useSelector(selectMarketplaceInfluencers);
  const allInfluencers = useSelector(selectAllMarketplaceInfluencers);
  const updateQuery = (value: string) => dispatch(setQueryAction(value));
  const toggleSavedItem = (id: string) => dispatch(toggleSaved(id));
  const toggleComparisonItem = (id: string) => dispatch(toggleComparison(id));
  const updateProposalStatus = (id: string, status: ProposalStatus) => dispatch(updateProposalStatusAction({ id, status }));
  const createProposal = (proposal: Omit<DemoProposal, "id" | "updatedAt">) => {
    dispatch(createProposalAction(proposal));
  };
  const addIdea = (idea: Omit<ContentIdea, "id">) => dispatch(addIdeaAction(idea));
  const updateIdea = (id: string, changes: Partial<Omit<ContentIdea, "id">>) => dispatch(updateIdeaAction({ id, changes }));
  const archiveIdea = (id: string) => dispatch(archiveIdeaAction(id));
  const unarchiveIdea = (id: string) => dispatch(unarchiveIdeaAction(id));
  const addIdeaNote = (id: string, text: string) => dispatch(addIdeaNoteAction({ id, text }));
  const updateIdeaNote = (id: string, noteId: string, text: string) => dispatch(updateIdeaNoteAction({ id, noteId, text }));
  const removeIdeaNote = (id: string, noteId: string) => dispatch(removeIdeaNoteAction({ id, noteId }));
  const createProjectFromIdea = (ideaId: string) => dispatch(createProjectFromIdeaAction(ideaId));
  const updateProductionProject = (
    id: string,
    changes: Partial<Omit<ProductionProject, "id" | "ideaId" | "workflowSteps" | "stageData" | "validationErrors" | "currentStage" | "createdAt">>,
  ) => dispatch(updateProductionProjectAction({ id, changes }));
  const saveProductionStageDraft = (id: string, stage: ProductionStage, data: ProductionStagePayload) =>
    dispatch(saveProductionStageDraftAction({ id, stage, data }));
  const completeProductionStage = (id: string, stage: ProductionStage, data: ProductionStagePayload) =>
    dispatch(completeProductionStageAction({ id, stage, data }));
  const addTodoTask = (draft: TodoTaskDraft) => {
    if (draft.sourceTaskId && todoTasks.some((task) =>
      task.sourceTaskId === draft.sourceTaskId && task.creatorId === draft.creatorId,
    )) return false;
    const id = `todo-${Date.now()}-${todoTasks.length}`;
    dispatch(addTodoTaskAction({ ...draft, id, owner: "You", completed: false }));
    return id;
  };
  const toggleTodoTask = (id: string) => dispatch(toggleTodoTaskAction(id));
  const updateTodoTask = (id: string, changes: Partial<TodoTask>) =>
    dispatch(updateTodoTaskAction({ id, changes }));
  const addTodoTaskNote = (id: string, text: string) => dispatch(addTodoTaskNoteAction({ id, text }));
  const updateTodoTaskNote = (id: string, noteId: string, text: string) => dispatch(updateTodoTaskNoteAction({ id, noteId, text }));
  const removeTodoTaskNote = (id: string, noteId: string) => dispatch(removeTodoTaskNoteAction({ id, noteId }));
  const upsertCampaign = (campaign: Campaign) => dispatch(upsertCampaignAction(campaign));
  const archiveCampaign = (id: string) => dispatch(archiveCampaignAction(id));
  const submitApplication = (
    draft: Omit<MarketplaceApplication, "id" | "status" | "submittedAt" | "conversationId"> & { conversationId?: string },
  ) => {
    const relationshipId = draft.campaignId ?? draft.briefId;
    const existing = applicationsForSession.find((item) =>
      item.creatorId === draft.creatorId &&
      item.brandId === draft.brandId &&
      (item.campaignId ?? item.briefId) === relationshipId,
    );
    const canCreatorReapply = draft.direction === "creator-to-brand" && existing?.status === "Declined" && existing.canReapply === true;
    if (existing && !canCreatorReapply) {
      return {
        application: existing,
        conversationId: existing.conversationId,
        created: false,
      };
    }
    const blocked = blocksForSession.some((block) =>
      block.creatorId === draft.creatorId &&
      block.brandId === (draft.brandId ?? "") &&
      (!block.campaignId || block.campaignId === draft.campaignId),
    );
    if (blocked) {
      const blockedApplication: MarketplaceApplication = {
        ...draft,
        id: `application-blocked-${Date.now()}`,
        status: "Blocked",
        submittedAt: "Blocked",
        conversationId: `market-chat-blocked-${Date.now()}`,
      };
      return { application: blockedApplication, conversationId: blockedApplication.conversationId, created: false };
    }
    const stamp = Date.now();
    const applicationId = `application-${stamp}`;
    const conversationId = draft.conversationId ?? `market-chat-${stamp}`;
    const requestId = `request-${stamp}`;
    const application: MarketplaceApplication = {
      ...draft,
      id: applicationId,
      status: "Pending",
      submittedAt: "Just now",
      conversationId,
      requestId,
    };
    const existingConversation = draft.conversationId
      ? conversationsForSession.find((conversation) => conversation.id === draft.conversationId)
      : undefined;
    const requestMessage = {
      id: `${conversationId}-request-${applicationId}`,
      campaignRequestId: applicationId,
      text: draft.message,
      mine: true,
      senderRole: draft.direction === "brand-to-creator" ? "Brand" as const : "Influencer" as const,
      time: "Just now",
      status: "delivered" as const,
      attachments: draft.attachments,
    };
    dispatch(submitMarketplaceApplicationAction({
      application,
      conversation: existingConversation ? {
        ...existingConversation,
        requestId,
        applicationId,
        campaignId: draft.campaignId,
        briefTitle: draft.briefTitle,
        preview: draft.message,
        updatedAt: "Just now",
        messages: [...(existingConversation.messages ?? []), requestMessage],
      } : {
        id: conversationId,
        requestId,
        applicationId,
        campaignId: draft.campaignId,
        brandId: draft.brandId,
        creatorId: draft.creatorId,
        participantName: draft.creatorName,
        participantInitials: draft.creatorInitials,
        briefTitle: draft.briefTitle,
        preview: draft.message,
        status: "Pending",
        blockedBy: [],
        updatedAt: "Just now",
        direction: draft.direction,
        messages: [requestMessage],
      },
    }));
    return { application, conversationId, created: true };
  };
  const updateApplicationStatus = (id: string, status: MarketplaceApplicationStatus) =>
    dispatch(updateMarketplaceApplicationStatusAction({ id, status }));
  const declineApplication = (id: string, reason: string, canReapply: boolean) =>
    dispatch(declineMarketplaceApplicationAction({ id, reason, canReapply }));
  const toggleMarketplaceBlock = (conversationId: string, actor: "brand" | "creator") =>
    dispatch(toggleMarketplaceBlockAction({ conversationId, actor }));
  const toggleMarketplaceApplicationBlock = (payload: Parameters<typeof toggleMarketplaceApplicationBlockAction>[0]) =>
    dispatch(toggleMarketplaceApplicationBlockAction(payload));
  const addMarketplaceMessage = (conversationId: string, message: MarketplaceMessage) =>
    dispatch(addMarketplaceMessageAction({ conversationId, message }));
  const updateMarketplaceMessage = (conversationId: string, messageId: string, changes: Partial<MarketplaceMessage>) =>
    dispatch(updateMarketplaceMessageAction({ conversationId, messageId, changes }));
  const removeMarketplaceMessage = (conversationId: string, messageId: string) =>
    dispatch(removeMarketplaceMessageAction({ conversationId, messageId }));
  const addAuthoredReview = (review: AuthoredReview) => dispatch(addAuthoredReviewAction(review));
  const updateAuthoredReview = (id: string, changes: Pick<AuthoredReview, 'rating' | 'text' | 'tags'>) => dispatch(updateAuthoredReviewAction({ id, changes }));
  const updateCreatorLocations = (locations: string[]) => dispatch(updateCreatorLocationsAction(locations));
  const upsertReminder = (reminder: Reminder) => dispatch(upsertReminderAction(reminder));
  const updateReminder = (reminder: Partial<Reminder> & Pick<Reminder, "id">) => dispatch(updateReminderAction(reminder));
  const setReminderSettings = (settings: ReminderSettings) => dispatch(setReminderSettingsAction(settings));
  return {
    influencers,
    allInfluencers,
    campaigns: campaignsForSession,
    proposals: proposalsForSession,
    reminders: remindersForSession,
    ideas,
    projects,
    todoTasks,
    briefs: marketplaceBriefs,
    applications: applicationsForSession,
    authoredReviews: authoredReviewsForSession,
    marketplaceConversations: conversationsForSession,
    marketplaceBlocks: blocksForSession,
    reminderSettings,
    homePromos: isAuthenticated ? [] : demoHomePromos,
    query,
    setQuery: updateQuery,
    savedIds: savedIdsForSession,
    toggleSaved: toggleSavedItem,
    comparisonIds: comparisonIdsForSession,
    toggleComparison: toggleComparisonItem,
    updateProposalStatus,
    createProposal,
    addIdea,
    updateIdea,
    archiveIdea,
    unarchiveIdea,
    addIdeaNote,
    updateIdeaNote,
    removeIdeaNote,
    createProjectFromIdea,
    updateProductionProject,
    saveProductionStageDraft,
    completeProductionStage,
    addTodoTask,
    toggleTodoTask,
    updateTodoTask,
    addTodoTaskNote,
    updateTodoTaskNote,
    removeTodoTaskNote,
    upsertCampaign,
    archiveCampaign,
    submitApplication,
    updateApplicationStatus,
    declineApplication,
    toggleMarketplaceBlock,
    toggleMarketplaceApplicationBlock,
    addMarketplaceMessage,
    updateMarketplaceMessage,
    removeMarketplaceMessage,
    addAuthoredReview,
    updateAuthoredReview,
    creatorLocations,
    updateCreatorLocations,
    upsertReminder,
    updateReminder,
    setReminderSettings,
    isLoading,
  };
}
