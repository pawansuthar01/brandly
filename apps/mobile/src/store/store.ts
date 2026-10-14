import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { mergeChatMessages } from '../lib/chat';
import {
  demoApplications,
  demoBrandBriefs,
  demoCampaigns,
  demoContentIdeas,
  demoMarketplaceBlocks,
  demoMarketplaceConversations,
  demoProjects,
  demoProposals,
} from '../services/demoMarketplace.service';
import { ensureWorkflowSteps, PRODUCTION_STAGES } from '../types/marketplace';
import { getIdeaStageData, getProjectStageData, getStageIndex, validateProductionStage } from '../lib/productionWorkflow';
import type {
  BrandBrief,
  ContentIdea,
  DemoProposal,
  IdeaStageData,
  MarketplaceApplication,
  MarketplaceApplicationStatus,
  MarketplaceConversation,
  MarketplaceBlock,
  MarketplaceMessage,
  ProfileDraft,
  ProductionProject,
  ProductionStage,
  ProductionStageDataByStage,
  ProductionStagePayload,
  ScheduledStageData,
  ProposalStatus,
  Reminder,
  ReminderSettings,
  SocialPlatform,
  TodoTask,
  Campaign,
  AuthoredReview,
} from '../types/marketplace';

export type MobileRole = 'brand' | 'creator' | 'guest' | null;
export type SignupRole = 'Brand' | 'Influencer';
export type AuthOnboardingStep =
  | 'welcome'
  | 'account-type'
  | 'signin'
  | 'signup'
  | 'email-otp'
  | 'signin-otp'
  | 'signup-otp'
  | 'profile'
  | 'details'
  | 'social'
  | 'verifying'
  | 'review'
  | 'creating'
  | 'success';

export interface SignupProfileDraft {
  displayName: string;
  bio: string;
  niche: string;
  brandName: string;
  industry: string;
  teamSize: string;
  website: string;
  location: string;
  audienceLocations: string[];
  audienceSize: string;
  rate: string;
  brandBio: string;
  brandBudget: string;
  languages: string[];
  profileImageUri?: string | null;
  instagramUrl: string;
  youtubeUrl: string;
  twitterUrl: string;
  otherUrl: string;
  linkedinUrl: string;
  socialAccounts: Partial<Record<SocialPlatform, string>>;
}

const emptySignupProfile = (): SignupProfileDraft => ({
  displayName: '', bio: '', niche: '', brandName: '', industry: '', teamSize: '', website: '',
  location: '', audienceLocations: [], audienceSize: '', rate: '', brandBio: '', brandBudget: '', languages: ['English'], profileImageUri: null,
  instagramUrl: '', youtubeUrl: '', twitterUrl: '', otherUrl: '', linkedinUrl: '', socialAccounts: {},
});

export interface DemoMarketplaceState {
  savedIds: string[];
  comparisonIds: string[];
  creatorLocations: string[];
  proposals: DemoProposal[];
  reminders: Reminder[];
  ideas: ContentIdea[];
  projects: ProductionProject[];
  todoTasks: TodoTask[];
  campaigns: Campaign[];
  briefs: BrandBrief[];
  applications: MarketplaceApplication[];
  authoredReviews: AuthoredReview[];
  marketplaceConversations: MarketplaceConversation[];
  marketplaceBlocks: MarketplaceBlock[];
  query: string;
}

export interface AuthState {
  role: MobileRole;
  userId?: string;
  email?: string;
  phone?: string;
  authSource?: 'remote' | 'guest';
  phoneVerified: boolean;
  emailVerified: boolean;
  onboardingComplete: boolean;
  profile?: ProfileDraft;
  signupRole: SignupRole | null;
  signupEmail: string;
  signupPhone: string;
  signupEmailVerified: boolean;
  signupVerifiedEmail: string;
  signupPhoneVerified: boolean;
  signupStep: AuthOnboardingStep;
  signupProfile: SignupProfileDraft;
}

export interface PreferencesState {
  reminderOverrides: Record<string, ReminderSettings>;
  theme: 'light' | 'dark' | 'system';
  notificationsEnabled: boolean;
  reminderSettings: ReminderSettings;
}

const initialDemoState: DemoMarketplaceState = {
  savedIds: ['creator-aarohi-shah', 'creator-meera-nair', 'creator-zoya-khan'],
  comparisonIds: [],
  creatorLocations: ['Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Kolkata', 'Chennai', 'Hyderabad', 'Jaipur', 'Kochi'],
  proposals: demoProposals,
  reminders: [],
  ideas: [],
  projects: [],
  todoTasks: [],
  campaigns: demoCampaigns,
  briefs: demoBrandBriefs,
  applications: demoApplications,
  authoredReviews: [],
  marketplaceConversations: demoMarketplaceConversations,
  marketplaceBlocks: demoMarketplaceBlocks,
  query: '',
};

const mergeSeedRecords = <T extends { id: string }>(stored: T[], seeds: T[]) => {
  const storedIds = new Set(stored.map((record) => record.id));
  return [...stored, ...seeds.filter((record) => !storedIds.has(record.id))];
};

const removeSeedRecords = <T extends { id: string }>(stored: T[], seeds: T[]) => {
  const seedIds = new Set(seeds.map((record) => record.id));
  return stored.filter((record) => !seedIds.has(record.id));
};

const normalizeProductionProject = (project: ProductionProject): ProductionProject => {
  const stageData = getProjectStageData(project);
  return {
    ...project,
    stageData,
    validationErrors: project.validationErrors ?? {},
    workflowSteps: ensureWorkflowSteps(project.workflowSteps, project.currentStage, stageData),
  };
};

const applyStageSummary = (
  project: ProductionProject,
  stage: ProductionStage,
  data: ProductionStagePayload,
): ProductionProject => {
  if (stage === 'Idea') {
    const value = data as IdeaStageData;
    return {
      ...project,
      title: value.title,
      description: value.description,
      budget: value.budget || undefined,
      sourceUrl: value.referenceUrl || undefined,
      ...(Array.isArray(value.attachments) ? { attachment: value.attachments[0] } : {}),
      reminderDate: value.reminderDate || undefined,
      dueDate: value.reminderDate || project.dueDate,
      shootLocation: value.shootLocation || undefined,
      equipment: value.equipment || undefined,
    };
  }
  if (stage === 'Scheduled') {
    const value = data as ScheduledStageData;
    return {
      ...project,
      platform: value.platform,
      dueDate: value.scheduledDate,
    };
  }
  if (stage === 'Published') {
    return { ...project, platform: (data as ProductionStagePayload & { platform: ProductionProject['platform'] }).platform };
  }
  return project;
};

const syncLinkedIdea = (state: DemoMarketplaceState, project: ProductionProject) => {
  const value = project.stageData.Idea;
  if (!value) return;
  state.ideas = state.ideas.map((idea) => idea.id === project.ideaId ? {
    ...idea,
    title: value.title,
    concept: value.concept,
    description: value.description,
    ideaNotes: value.notes,
    platform: project.platform,
    budget: value.budget || undefined,
    reminderDate: value.reminderDate || undefined,
    shootLocation: value.shootLocation || undefined,
    equipment: value.equipment || undefined,
    sourceUrl: value.referenceUrl || undefined,
    ...(Array.isArray(value.attachments) ? { attachment: value.attachments[0] } : {}),
  } : idea);
};

const demoSlice = createSlice({
  name: 'demoMarketplace',
  initialState: initialDemoState,
  reducers: {
    setQuery: (state, action: PayloadAction<string>) => { state.query = action.payload; },
    toggleSaved: (state, action: PayloadAction<string>) => {
      state.savedIds = state.savedIds.includes(action.payload)
        ? state.savedIds.filter((id) => id !== action.payload)
        : [...state.savedIds, action.payload];
    },
    toggleComparison: (state, action: PayloadAction<string>) => {
      state.comparisonIds = state.comparisonIds.includes(action.payload)
        ? state.comparisonIds.filter((id) => id !== action.payload)
        : [...state.comparisonIds, action.payload];
    },
    updateProposalStatus: (state, action: PayloadAction<{ id: string; status: ProposalStatus }>) => {
      state.proposals = state.proposals.map((proposal) => proposal.id === action.payload.id
        ? { ...proposal, status: action.payload.status, updatedAt: 'Just now' }
        : proposal);
    },
    createProposal: (state, action: PayloadAction<Omit<DemoProposal, 'id' | 'updatedAt'>>) => {
      state.proposals.unshift({ ...action.payload, id: `proposal-${Date.now()}`, updatedAt: 'Just now' });
    },
    addIdea: (state, action: PayloadAction<Omit<ContentIdea, 'id'>>) => {
      state.ideas.unshift({
        ...action.payload,
        id: `idea-${Date.now()}-${state.ideas.length}`,
      });
    },
    updateIdea: (
      state,
      action: PayloadAction<{ id: string; changes: Partial<Omit<ContentIdea, 'id'>> }>,
    ) => {
      const nextIdea = state.ideas.find((idea) => idea.id === action.payload.id);
      if (!nextIdea) return;
      const updatedIdea = { ...nextIdea, ...action.payload.changes, id: nextIdea.id };
      state.ideas = state.ideas.map((idea) => idea.id === updatedIdea.id ? updatedIdea : idea);
      if (updatedIdea.projectId) {
        state.projects = state.projects.map((project) => {
          if (project.id !== updatedIdea.projectId) return project;
          const stageData = { ...getProjectStageData(project), Idea: getIdeaStageData(updatedIdea) };
          const nextProject = applyStageSummary(project, 'Idea', stageData.Idea);
          return {
            ...nextProject,
            platform: updatedIdea.platform === 'Instagram' || updatedIdea.platform === 'YouTube' ? updatedIdea.platform : 'Other',
            stageData,
            currentStage: project.currentStage,
            workflowSteps: ensureWorkflowSteps(project.workflowSteps, project.currentStage, stageData),
          };
        });
      }
    },
    createProjectFromIdea: (state, action: PayloadAction<string>) => {
      const idea = state.ideas.find((item) => item.id === action.payload);
      if (!idea || idea.archived || state.projects.some((project) => project.ideaId === idea.id)) return;
      const projectId = `project-${Date.now()}-${state.projects.length}`;
      const stageData: ProductionStageDataByStage = { Idea: getIdeaStageData(idea) };
      state.projects.unshift({
        id: projectId,
        ideaId: idea.id,
        title: idea.title,
        description: idea.description,
        platform: idea.platform === 'Instagram' || idea.platform === 'YouTube' ? idea.platform : 'Other',
        ...(idea.budget ? { budget: idea.budget } : {}),
        ...(idea.sourceUrl ? { sourceUrl: idea.sourceUrl } : {}),
        ...(idea.attachment ? { attachment: idea.attachment } : {}),
        ...(idea.reminderDate ? { reminderDate: idea.reminderDate, dueDate: idea.reminderDate } : {}),
        ...(idea.shootLocation ? { shootLocation: idea.shootLocation } : {}),
        ...(idea.equipment ? { equipment: idea.equipment } : {}),
        assignedTo: 'You',
        currentStage: 'Idea',
        stageData,
        validationErrors: {},
        workflowSteps: ensureWorkflowSteps(undefined, 'Idea', stageData),
        createdAt: new Date().toISOString(),
      });
      state.ideas = state.ideas.map((item) => item.id === idea.id ? { ...item, projectId } : item);
    },
    updateProductionProject: (
      state,
      action: PayloadAction<{ id: string; changes: Partial<Omit<ProductionProject, 'id' | 'ideaId' | 'workflowSteps' | 'stageData' | 'validationErrors' | 'currentStage' | 'createdAt'>> }>,
    ) => {
      state.projects = state.projects.map((project) =>
        project.id === action.payload.id
          ? { ...project, ...action.payload.changes, id: project.id, ideaId: project.ideaId, workflowSteps: project.workflowSteps }
          : project,
      );
    },
    saveProductionStageDraft: (
      state,
      action: PayloadAction<{ id: string; stage: ProductionStage; data: ProductionStagePayload }>,
    ) => {
      state.projects = state.projects.map((project) => {
        if (project.id !== action.payload.id) return project;
        const targetIndex = getStageIndex(action.payload.stage);
        const currentIndex = getStageIndex(project.currentStage);
        if (targetIndex > currentIndex) return project;
        const stageData: ProductionStageDataByStage = {
          ...getProjectStageData(project),
          [action.payload.stage]: action.payload.data,
        };
        const validation = validateProductionStage(action.payload.stage, action.payload.data);
        const validationErrors = { ...(project.validationErrors ?? {}) };
        if (Object.keys(validation.errors).length) validationErrors[action.payload.stage] = validation.errors;
        else delete validationErrors[action.payload.stage];
        const nextProject = applyStageSummary({
          ...project,
          stageData,
          validationErrors,
          currentStage: project.currentStage,
          workflowSteps: ensureWorkflowSteps(project.workflowSteps, project.currentStage, stageData),
        }, action.payload.stage, action.payload.data);
        syncLinkedIdea(state, nextProject);
        return nextProject;
      });
    },
    completeProductionStage: (
      state,
      action: PayloadAction<{ id: string; stage: ProductionStage; data: ProductionStagePayload }>,
    ) => {
      state.projects = state.projects.map((project) => {
        if (project.id !== action.payload.id) return project;
        const targetIndex = getStageIndex(action.payload.stage);
        const currentIndex = getStageIndex(project.currentStage);
        if (targetIndex > currentIndex) return project;
        const validation = validateProductionStage(action.payload.stage, action.payload.data);
        if (!validation.valid) {
          return {
            ...project,
            validationErrors: { ...(project.validationErrors ?? {}), [action.payload.stage]: validation.errors },
          };
        }
        const stageData: ProductionStageDataByStage = {
          ...getProjectStageData(project),
          [action.payload.stage]: action.payload.data,
        };
        const validationErrors = { ...(project.validationErrors ?? {}) };
        delete validationErrors[action.payload.stage];
        const nextIndex = Math.min(targetIndex + 1, PRODUCTION_STAGES.length - 1);
        const isFinalStage = targetIndex === PRODUCTION_STAGES.length - 1;
        const nextStage = isFinalStage ? action.payload.stage : PRODUCTION_STAGES[nextIndex];
        const currentStep = project.workflowSteps.find((step) => step.stage === project.currentStage);
        const editingCompletedStage = targetIndex < currentIndex && project.currentStage !== action.payload.stage;
        const preservedCurrentStage = editingCompletedStage ? project.currentStage : nextStage;
        const preservedCurrentIndex = getStageIndex(preservedCurrentStage);
        const nextProject = applyStageSummary({
          ...project,
          stageData,
          validationErrors,
          currentStage: preservedCurrentStage,
          workflowSteps: ensureWorkflowSteps(project.workflowSteps, preservedCurrentStage, stageData).map((step, index) => ({
            ...step,
            completed: editingCompletedStage ? index < preservedCurrentIndex || (preservedCurrentIndex === PRODUCTION_STAGES.length - 1 && index === preservedCurrentIndex && currentStep?.status === 'completed') : index <= targetIndex,
            status: editingCompletedStage
              ? index < preservedCurrentIndex || (index === preservedCurrentIndex && currentStep?.status === 'completed') ? 'completed' : index === preservedCurrentIndex ? currentStep?.status ?? 'current' : 'locked'
              : index <= targetIndex ? 'completed' : index === nextIndex ? 'current' : 'locked',
          })),
        }, action.payload.stage, action.payload.data);
        syncLinkedIdea(state, nextProject);
        return nextProject;
      });
    },
    archiveIdea: (state, action: PayloadAction<string>) => {
      state.ideas = state.ideas.map((idea) =>
        idea.id === action.payload ? { ...idea, archived: true } : idea,
      );
    },
    unarchiveIdea: (state, action: PayloadAction<string>) => {
      state.ideas = state.ideas.map((idea) =>
        idea.id === action.payload ? { ...idea, archived: false } : idea,
      );
    },
    addIdeaNote: (state, action: PayloadAction<{ id: string; text: string }>) => {
      state.ideas = state.ideas.map((idea) => idea.id === action.payload.id
        ? { ...idea, notes: [...(idea.notes ?? []), { id: `${idea.id}-note-${(idea.notes?.length ?? 0) + 1}`, text: action.payload.text, createdAt: new Date().toLocaleString() }] }
        : idea);
    },
    updateIdeaNote: (state, action: PayloadAction<{ id: string; noteId: string; text: string }>) => {
      state.ideas = state.ideas.map((idea) => idea.id === action.payload.id
        ? { ...idea, notes: (idea.notes ?? []).map((note) => note.id === action.payload.noteId ? { ...note, text: action.payload.text } : note) }
        : idea);
    },
    removeIdeaNote: (state, action: PayloadAction<{ id: string; noteId: string }>) => {
      state.ideas = state.ideas.map((idea) => idea.id === action.payload.id
        ? { ...idea, notes: (idea.notes ?? []).filter((note) => note.id !== action.payload.noteId) }
        : idea);
    },
    replaceStudioIdea: (state, action: PayloadAction<ContentIdea>) => {
      const index = state.ideas.findIndex((idea) => idea.id === action.payload.id);
      if (index === -1) state.ideas.unshift(action.payload);
      else state.ideas[index] = action.payload;
    },
    replaceStudioProject: (state, action: PayloadAction<ProductionProject>) => {
      const project = normalizeProductionProject(action.payload);
      const index = state.projects.findIndex((item) => item.id === project.id);
      if (index === -1) state.projects.unshift(project);
      else state.projects[index] = project;
      state.ideas = state.ideas.map((idea) => idea.id === project.ideaId ? { ...idea, projectId: project.id } : idea);
      syncLinkedIdea(state, project);
    },
    hydrateStudio: (state, action: PayloadAction<{ ideas: ContentIdea[]; projects: ProductionProject[] }>) => {
      state.ideas = action.payload.ideas;
      state.projects = action.payload.projects.map(normalizeProductionProject);
      const projectByIdea = new Map(state.projects.map((project) => [project.ideaId, project.id]));
      state.ideas = state.ideas.map((idea) => ({ ...idea, ...(projectByIdea.has(idea.id) ? { projectId: projectByIdea.get(idea.id) } : {}) }));
    },
    clearStudio: (state) => {
      state.ideas = [];
      state.projects = [];
    },
    addTodoTask: (state, action: PayloadAction<Omit<TodoTask, 'id'> & { id?: string }>) => {
      if (action.payload.sourceTaskId && state.todoTasks.some((task) =>
        task.sourceTaskId === action.payload.sourceTaskId && task.creatorId === action.payload.creatorId,
      )) return;
      const id = action.payload.id ?? `todo-${Date.now()}-${state.todoTasks.length}`;
      state.todoTasks.push({
        ...action.payload,
        id,
        briefId: action.payload.briefId ?? (action.payload.campaignId ? `brief-${id}` : undefined),
      });
    },
    toggleTodoTask: (state, action: PayloadAction<string>) => {
      state.todoTasks = state.todoTasks.map((task) =>
        task.id === action.payload ? { ...task, completed: !task.completed } : task,
      );
    },
    updateTodoTask: (state, action: PayloadAction<{ id: string; changes: Partial<TodoTask> }>) => {
      state.todoTasks = state.todoTasks.map((task) =>
        task.id === action.payload.id ? { ...task, ...action.payload.changes, id: task.id } : task,
      );
    },
    addTodoTaskNote: (state, action: PayloadAction<{ id: string; text: string }>) => {
      state.todoTasks = state.todoTasks.map((task) => task.id === action.payload.id
        ? { ...task, noteHistory: [...(task.noteHistory ?? []), { id: `${task.id}-note-${(task.noteHistory?.length ?? 0) + 1}`, text: action.payload.text, createdAt: new Date().toLocaleString() }] }
        : task);
    },
    updateTodoTaskNote: (state, action: PayloadAction<{ id: string; noteId: string; text: string }>) => {
      state.todoTasks = state.todoTasks.map((task) => task.id === action.payload.id
        ? { ...task, noteHistory: (task.noteHistory ?? []).map((note) => note.id === action.payload.noteId ? { ...note, text: action.payload.text } : note) }
        : task);
    },
    removeTodoTaskNote: (state, action: PayloadAction<{ id: string; noteId: string }>) => {
      state.todoTasks = state.todoTasks.map((task) => task.id === action.payload.id
        ? { ...task, noteHistory: (task.noteHistory ?? []).filter((note) => note.id !== action.payload.noteId) }
        : task);
    },
    upsertCampaign: (state, action: PayloadAction<Campaign>) => {
      const index = state.campaigns.findIndex((campaign) => campaign.id === action.payload.id);
      if (index === -1) state.campaigns.unshift(action.payload);
      else state.campaigns[index] = { ...state.campaigns[index], ...action.payload, id: action.payload.id };
    },
    archiveCampaign: (state, action: PayloadAction<string>) => {
      state.campaigns = state.campaigns.map((campaign) => campaign.id === action.payload
        ? { ...campaign, archived: true, status: "Archived", updatedAt: new Date().toISOString() }
        : campaign);
    },
    submitMarketplaceApplication: (
      state,
      action: PayloadAction<{ application: MarketplaceApplication; conversation: MarketplaceConversation }>,
    ) => {
      const existingApplication = state.applications.find((application) =>
        application.creatorId === action.payload.application.creatorId &&
        application.brandId === action.payload.application.brandId &&
        application.campaignId === action.payload.application.campaignId,
      );
      const creatorCanReapply = action.payload.application.direction === "creator-to-brand" && existingApplication?.status === "Declined" && existingApplication.canReapply === true;
      if (existingApplication && !creatorCanReapply) return;
      state.applications.unshift(action.payload.application);
      const existingIndex = state.marketplaceConversations.findIndex((conversation) => conversation.id === action.payload.conversation.id);
      if (existingIndex === -1) state.marketplaceConversations.unshift(action.payload.conversation);
      else {
        const existing = state.marketplaceConversations[existingIndex];
        state.marketplaceConversations[existingIndex] = {
          ...existing,
          ...action.payload.conversation,
          status: existing.status === "Accepted" ? "Accepted" : action.payload.conversation.status,
          messages: action.payload.conversation.messages?.length ? action.payload.conversation.messages : existing.messages,
        };
      }
    },
    upsertMarketplaceApplication: (state, action: PayloadAction<MarketplaceApplication>) => {
      const match = (application: MarketplaceApplication) => application.id === action.payload.id
        || (application.campaignId === action.payload.campaignId
          && application.creatorId === action.payload.creatorId
          && application.brandId === action.payload.brandId);
      const index = state.applications.findIndex(match);
      if (index === -1) state.applications.unshift(action.payload);
      else state.applications[index] = { ...state.applications[index], ...action.payload };
    },
    updateMarketplaceApplicationStatus: (
      state,
      action: PayloadAction<{ id: string; status: MarketplaceApplicationStatus }>,
    ) => {
      state.applications = state.applications.map((application) =>
        application.id === action.payload.id
          ? { ...application, status: action.payload.status }
          : application,
      );
      state.marketplaceConversations = state.marketplaceConversations.map((conversation) => {
        const application = state.applications.find((item) => item.id === conversation.applicationId);
        return application && conversation.status !== "Accepted"
          ? { ...conversation, status: application.status }
          : conversation;
      });
    },
    declineMarketplaceApplication: (
      state,
      action: PayloadAction<{ id: string; reason: string; canReapply: boolean }>,
    ) => {
      state.applications = state.applications.map((application) =>
        application.id === action.payload.id
          ? { ...application, status: "Declined", rejectionReason: action.payload.reason, canReapply: action.payload.canReapply }
          : application,
      );
      state.marketplaceConversations = state.marketplaceConversations.map((conversation) =>
        conversation.applicationId === action.payload.id
          ? { ...conversation, status: "Declined", preview: `Application declined: ${action.payload.reason}`, updatedAt: "Just now" }
          : conversation,
      );
    },
    toggleMarketplaceApplicationBlock: (
      state,
      action: PayloadAction<Pick<MarketplaceBlock, "campaignId" | "brandId" | "creatorId"> & { applicationId: string }>,
    ) => {
      const blockId = `${action.payload.brandId}:${action.payload.creatorId}:${action.payload.campaignId ?? "global"}`;
      const existing = state.marketplaceBlocks.some((block) => block.id === blockId);
      if (existing) {
        state.marketplaceBlocks = state.marketplaceBlocks.filter((block) => block.id !== blockId);
        state.applications = state.applications.map((application) => application.id === action.payload.applicationId
          ? { ...application, status: "Declined", canReapply: false }
          : application);
        state.marketplaceConversations = state.marketplaceConversations.map((conversation) => conversation.applicationId === action.payload.applicationId
          ? { ...conversation, status: "Declined", blockedBy: conversation.blockedBy.filter((actor) => actor !== "brand") }
          : conversation);
        return;
      }
      state.marketplaceBlocks.push({
        id: blockId,
        campaignId: action.payload.campaignId,
        brandId: action.payload.brandId,
        creatorId: action.payload.creatorId,
        createdAt: new Date().toISOString(),
      });
      state.applications = state.applications.map((application) => application.id === action.payload.applicationId
        ? { ...application, status: "Blocked", canReapply: false }
        : application);
      state.marketplaceConversations = state.marketplaceConversations.map((conversation) => conversation.applicationId === action.payload.applicationId
        ? { ...conversation, status: "Blocked", blockedBy: conversation.blockedBy.includes("brand") ? conversation.blockedBy : [...conversation.blockedBy, "brand"] }
        : conversation);
    },
    addMarketplaceMessage: (
      state,
      action: PayloadAction<{ conversationId: string; message: MarketplaceMessage }>,
    ) => {
      state.marketplaceConversations = state.marketplaceConversations.map((conversation) => conversation.id === action.payload.conversationId
        ? {
            ...conversation,
            messages: mergeChatMessages(conversation.messages ?? [], [action.payload.message]),
            preview: action.payload.message.text || conversation.preview,
            updatedAt: action.payload.message.createdAt ?? new Date().toISOString(),
            unreadCount: action.payload.message.mine || conversation.messages?.some((message) => message.id === action.payload.message.id || Boolean(message.clientMessageId && message.clientMessageId === action.payload.message.clientMessageId)) ? conversation.unreadCount : (conversation.unreadCount ?? 0) + 1,
          }
        : conversation);
    },
    updateMarketplaceMessage: (
      state,
      action: PayloadAction<{ conversationId: string; messageId: string; changes: Partial<MarketplaceMessage> }>,
    ) => {
      state.marketplaceConversations = state.marketplaceConversations.map((conversation) => conversation.id === action.payload.conversationId
        ? { ...conversation, messages: (conversation.messages ?? []).map((message) => message.id === action.payload.messageId ? { ...message, ...action.payload.changes } : message) }
        : conversation);
    },
    removeMarketplaceMessage: (
      state,
      action: PayloadAction<{ conversationId: string; messageId: string }>,
    ) => {
      state.marketplaceConversations = state.marketplaceConversations.map((conversation) => conversation.id === action.payload.conversationId
        ? { ...conversation, messages: (conversation.messages ?? []).filter((message) => message.id !== action.payload.messageId) }
        : conversation);
    },
    markMarketplaceConversationRead: (state, action: PayloadAction<string>) => {
      state.marketplaceConversations = state.marketplaceConversations.map((conversation) => conversation.id === action.payload
        ? { ...conversation, unreadCount: 0 }
        : conversation);
    },
    updateMarketplaceConversationPreferences: (
      state,
      action: PayloadAction<{ id: string; changes: Pick<MarketplaceConversation, "favorite" | "muted"> }>,
    ) => {
      state.marketplaceConversations = state.marketplaceConversations.map((conversation) => conversation.id === action.payload.id
        ? { ...conversation, ...action.payload.changes }
        : conversation);
    },
    setMarketplaceConversationBlocked: (
      state,
      action: PayloadAction<{ id: string; actor: "brand" | "creator"; blocked: boolean }>,
    ) => {
      state.marketplaceConversations = state.marketplaceConversations.map((conversation) => {
        if (conversation.id !== action.payload.id) return conversation;
        const blockedBy = action.payload.blocked
          ? conversation.blockedBy.includes(action.payload.actor) ? conversation.blockedBy : [...conversation.blockedBy, action.payload.actor]
          : conversation.blockedBy.filter((actor) => actor !== action.payload.actor);
        return { ...conversation, blockedBy };
      });
    },
    addAuthoredReview: (state, action: PayloadAction<AuthoredReview>) => {
      state.authoredReviews.unshift(action.payload);
    },
    updateAuthoredReview: (state, action: PayloadAction<{ id: string; changes: Pick<AuthoredReview, 'rating' | 'text' | 'tags'> }>) => {
      state.authoredReviews = state.authoredReviews.map((review) => review.id === action.payload.id
        ? { ...review, ...action.payload.changes, id: review.id }
        : review);
    },
    toggleMarketplaceBlock: (
      state,
      action: PayloadAction<{ conversationId: string; actor: "brand" | "creator" }>,
    ) => {
      state.marketplaceConversations = state.marketplaceConversations.map((conversation) => {
        if (conversation.id !== action.payload.conversationId) return conversation;
        const blockedBy = conversation.blockedBy.includes(action.payload.actor)
          ? conversation.blockedBy.filter((actor) => actor !== action.payload.actor)
          : [...conversation.blockedBy, action.payload.actor];
        return { ...conversation, blockedBy };
      });
    },
    upsertReminder: (state, action: PayloadAction<Reminder>) => {
      const index = state.reminders.findIndex((reminder) => reminder.id === action.payload.id);
      if (index === -1) state.reminders.unshift(action.payload);
      else state.reminders[index] = action.payload;
      const proposal = state.proposals.find((item) => item.id === action.payload.proposalId);
      if (proposal?.schedule) proposal.schedule.reminderSet = action.payload.enabled;
    },
    updateReminder: (state, action: PayloadAction<Partial<Reminder> & Pick<Reminder, 'id'>>) => {
      const current = state.reminders.find((reminder) => reminder.id === action.payload.id);
      if (!current) return;
      const next = { ...current, ...action.payload };
      state.reminders = state.reminders.map((reminder) =>
        reminder.id === action.payload.id ? next : reminder,
      );
      const proposal = state.proposals.find((item) => item.id === next.proposalId);
      if (proposal?.schedule) proposal.schedule.reminderSet = next.enabled;
    },
    updateCreatorLocations: (state, action: PayloadAction<string[]>) => {
      state.creatorLocations = Array.from(new Set(action.payload.map((location) => location.trim()).filter(Boolean)));
    },
    hydrateDemo: (state, action: PayloadAction<Partial<DemoMarketplaceState>>) => {
      if (Array.isArray(action.payload.savedIds)) state.savedIds = action.payload.savedIds;
      if (Array.isArray(action.payload.creatorLocations)) state.creatorLocations = action.payload.creatorLocations;
      if (Array.isArray(action.payload.proposals)) state.proposals = action.payload.proposals;
      if (Array.isArray(action.payload.reminders)) state.reminders = action.payload.reminders;
      if (Array.isArray(action.payload.ideas)) state.ideas = removeSeedRecords(action.payload.ideas, demoContentIdeas);
      if (Array.isArray(action.payload.projects)) {
        state.projects = removeSeedRecords(action.payload.projects, demoProjects).map(normalizeProductionProject);
      }
      // Tasks are server-owned. Do not resurrect legacy demo/local task records.
      state.todoTasks = [];
      if (Array.isArray(action.payload.campaigns)) state.campaigns = mergeSeedRecords(action.payload.campaigns, demoCampaigns);
      if (Array.isArray(action.payload.briefs)) state.briefs = mergeSeedRecords(action.payload.briefs, demoBrandBriefs);
      if (Array.isArray(action.payload.applications)) state.applications = mergeSeedRecords(action.payload.applications, demoApplications);
      if (Array.isArray(action.payload.authoredReviews)) state.authoredReviews = mergeSeedRecords(action.payload.authoredReviews, []);
      if (Array.isArray(action.payload.marketplaceConversations)) {
        state.marketplaceConversations = mergeSeedRecords(action.payload.marketplaceConversations, demoMarketplaceConversations);
      }
      if (Array.isArray(action.payload.marketplaceBlocks)) state.marketplaceBlocks = mergeSeedRecords(action.payload.marketplaceBlocks, demoMarketplaceBlocks);
      if (Array.isArray(action.payload.comparisonIds)) state.comparisonIds = action.payload.comparisonIds;
      if (typeof action.payload.query === 'string') state.query = action.payload.query;
    },
    hydrateCampaignMarketplace: (state, action: PayloadAction<{ campaigns: Campaign[]; applications: MarketplaceApplication[] }>) => {
      state.campaigns = action.payload.campaigns;
      state.briefs = [];
      state.applications = action.payload.applications;
    },
    hydrateMarketplaceConversations: (state, action: PayloadAction<MarketplaceConversation[]>) => {
      const previous = new Map(state.marketplaceConversations.map((conversation) => [conversation.id, conversation]));
      const incomingIds = new Set(action.payload.map((conversation) => conversation.id));
    state.marketplaceConversations = [...action.payload.map((conversation) => ({
        ...conversation,
        favorite: conversation.favorite ?? previous.get(conversation.id)?.favorite,
        muted: conversation.muted ?? previous.get(conversation.id)?.muted,
        messages: conversation.messages?.length ? conversation.messages : previous.get(conversation.id)?.messages ?? [],
        messagesSyncedAt: previous.get(conversation.id)?.messagesSyncedAt,
        messageCursor: previous.get(conversation.id)?.messageCursor,
      })), ...state.marketplaceConversations.filter((conversation) => !incomingIds.has(conversation.id))];
      if (!action.payload.length) state.marketplaceConversations = [];
    },
    hydrateMarketplaceConversationMessages: (
      state,
      action: PayloadAction<{ conversationId: string; messages: MarketplaceMessage[]; syncedAt?: number; nextCursor?: string; older?: boolean }>,
    ) => {
      const lastMessage = action.payload.messages[action.payload.messages.length - 1];
      const conversation = state.marketplaceConversations.find((item) => item.id === action.payload.conversationId);
      if (!conversation) return;
      const oldestIncoming = action.payload.messages[0]?.createdAt;
      const latestCached = conversation.messages?.at(-1)?.createdAt;
      const gap = Boolean(oldestIncoming && latestCached && oldestIncoming > latestCached);
      if (action.payload.older || !conversation.messagesSyncedAt || gap) conversation.messageCursor = action.payload.nextCursor;
      conversation.messages = mergeChatMessages(conversation.messages ?? [], action.payload.messages);
      conversation.messagesSyncedAt = action.payload.syncedAt ?? conversation.messagesSyncedAt;
      if (!action.payload.older) {
        conversation.preview = lastMessage?.text || conversation.preview;
        conversation.updatedAt = lastMessage?.createdAt ?? conversation.updatedAt;
      }
    },
    resetCampaignMarketplace: (state) => {
      state.campaigns = demoCampaigns;
      state.briefs = demoBrandBriefs;
      state.applications = demoApplications;
    },
  },
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    role: null,
    phoneVerified: false,
    emailVerified: false,
    onboardingComplete: false,
    signupRole: null,
    signupEmail: '',
    signupPhone: '',
    signupEmailVerified: false,
    signupVerifiedEmail: '',
    signupPhoneVerified: false,
    signupStep: 'welcome',
    signupProfile: emptySignupProfile(),
  } as AuthState,
  reducers: {
    setRole: (state, action: PayloadAction<Exclude<MobileRole, null>>) => { state.role = action.payload; },
    setVerification: (state, action: PayloadAction<{ phoneVerified?: boolean; emailVerified?: boolean }>) => Object.assign(state, action.payload),
    setOnboardingComplete: (state, action: PayloadAction<boolean>) => { state.onboardingComplete = action.payload; },
    setProfile: (state, action: PayloadAction<ProfileDraft>) => { state.profile = action.payload; },
    setUserIdentity: (state, action: PayloadAction<Pick<AuthState, 'userId' | 'email' | 'phone' | 'authSource'>>) => Object.assign(state, action.payload),
    setSignupRole: (state, action: PayloadAction<SignupRole | null>) => { state.signupRole = action.payload; },
    setSignupContact: (state, action: PayloadAction<{ email?: string; phone?: string }>) => {
      if (action.payload.email !== undefined) {
        const nextEmail = action.payload.email.trim().toLowerCase();
        if (state.signupEmailVerified && nextEmail !== state.signupVerifiedEmail) {
          state.signupEmailVerified = false;
          state.signupVerifiedEmail = '';
        }
        state.signupEmail = action.payload.email;
      }
      if (action.payload.phone !== undefined) state.signupPhone = action.payload.phone;
    },
    setSignupVerification: (state, action: PayloadAction<{ emailVerified?: boolean; phoneVerified?: boolean }>) => {
      if (action.payload.emailVerified !== undefined) {
        state.signupEmailVerified = action.payload.emailVerified;
        state.signupVerifiedEmail = action.payload.emailVerified ? state.signupEmail.trim().toLowerCase() : '';
      }
      if (action.payload.phoneVerified !== undefined) state.signupPhoneVerified = action.payload.phoneVerified;
    },
    setSignupStep: (state, action: PayloadAction<AuthOnboardingStep>) => { state.signupStep = action.payload; },
    setSignupProfile: (state, action: PayloadAction<Partial<SignupProfileDraft>>) => {
      state.signupProfile = { ...state.signupProfile, ...action.payload };
    },
    resetSignup: (state) => {
      state.signupRole = null;
      state.signupEmail = '';
      state.signupPhone = '';
      state.signupEmailVerified = false;
      state.signupVerifiedEmail = '';
      state.signupPhoneVerified = false;
      state.signupStep = 'welcome';
      state.signupProfile = emptySignupProfile();
    },
    clearSession: (state) => {
      state.role = null;
      state.phoneVerified = false;
      state.emailVerified = false;
      state.onboardingComplete = false;
      state.userId = undefined;
      state.email = undefined;
      state.phone = undefined;
      state.authSource = undefined;
      state.profile = undefined;
      state.signupRole = null;
      state.signupEmail = '';
      state.signupPhone = '';
      state.signupEmailVerified = false;
      state.signupVerifiedEmail = '';
      state.signupPhoneVerified = false;
      state.signupStep = 'welcome';
      state.signupProfile = emptySignupProfile();
    },
    hydrateAuth: (state, action: PayloadAction<Partial<AuthState>>) => {
      const previousProfile = state.signupProfile;
      Object.assign(state, action.payload);
      state.signupProfile = {
        ...emptySignupProfile(),
        ...(previousProfile ?? {}),
        ...(action.payload.signupProfile ?? {}),
      };
    },
  },
});

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState: {
    theme: 'light',
    notificationsEnabled: true,
    reminderSettings: { soundEnabled: true, vibrationEnabled: true, soundTone: 'default', snoozeMinutes: 5 },
    reminderOverrides: {},
  } as PreferencesState,
  reducers: {
    setTheme: (state, action: PayloadAction<PreferencesState['theme']>) => { state.theme = action.payload; },
    setNotificationsEnabled: (state, action: PayloadAction<boolean>) => { state.notificationsEnabled = action.payload; },
    setReminderOverride: (state, action: PayloadAction<{ key: string; settings: ReminderSettings }>) => { state.reminderOverrides[action.payload.key] = action.payload.settings; },
    setReminderSettings: (state, action: PayloadAction<ReminderSettings>) => { state.reminderSettings = action.payload; },
    hydratePreferences: (state, action: PayloadAction<Partial<PreferencesState>>) => Object.assign(state, action.payload),
  },
});

export const {
  setQuery,
  toggleSaved,
  toggleComparison,
  updateProposalStatus,
  createProposal,
  addIdea,
  updateIdea,
  createProjectFromIdea,
  updateProductionProject,
  saveProductionStageDraft,
  completeProductionStage,
  archiveIdea,
  unarchiveIdea,
  addIdeaNote,
  updateIdeaNote,
  removeIdeaNote,
  replaceStudioIdea,
  replaceStudioProject,
  hydrateStudio,
  clearStudio,
  addTodoTask,
  toggleTodoTask,
  updateTodoTask,
  addTodoTaskNote,
  updateTodoTaskNote,
  removeTodoTaskNote,
  upsertCampaign,
  archiveCampaign,
  submitMarketplaceApplication,
  upsertMarketplaceApplication,
  updateMarketplaceApplicationStatus,
  declineMarketplaceApplication,
  toggleMarketplaceBlock,
  toggleMarketplaceApplicationBlock,
  addMarketplaceMessage,
  updateMarketplaceMessage,
  removeMarketplaceMessage,
  markMarketplaceConversationRead,
  updateMarketplaceConversationPreferences,
  setMarketplaceConversationBlocked,
  addAuthoredReview,
  updateAuthoredReview,
  upsertReminder,
  updateReminder,
  updateCreatorLocations,
  hydrateDemo,
  hydrateCampaignMarketplace,
  hydrateMarketplaceConversations,
  hydrateMarketplaceConversationMessages,
  resetCampaignMarketplace,
} = demoSlice.actions;
export const {
  setRole,
  setVerification,
  setOnboardingComplete,
  setProfile,
  setUserIdentity,
  setSignupRole,
  setSignupContact,
  setSignupVerification,
  setSignupStep,
  setSignupProfile,
  resetSignup,
  clearSession,
  hydrateAuth,
} = authSlice.actions;
export const { setTheme, setNotificationsEnabled, setReminderSettings, setReminderOverride, hydratePreferences } = preferencesSlice.actions;

export const mobileStore = configureStore({
  reducer: {
    demo: demoSlice.reducer,
    auth: authSlice.reducer,
    preferences: preferencesSlice.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    serializableCheck: { warnAfter: 100 },
  }),
});
export type MobileRootState = ReturnType<typeof mobileStore.getState>;
export type MobileDispatch = typeof mobileStore.dispatch;
