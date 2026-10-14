import {
  ContentIdea,
  IdeaStageData,
  ProductionProject,
  ProductionStage,
  ProductionStageDataByStage,
  ProductionStagePayload,
  ProductionStepStatus,
  PRODUCTION_STAGES,
  ScriptingStageData,
  ShootingStageData,
  EditingStageData,
  ThumbnailStageData,
  ScheduledStageData,
  PublishedStageData,
} from "../types/marketplace";

export type StageValidationResult = {
  valid: boolean;
  errors: Record<string, string>;
  message?: string;
};

export const getStageIndex = (stage: ProductionStage) => PRODUCTION_STAGES.indexOf(stage);

export const getNextStage = (stage: ProductionStage): ProductionStage | undefined => {
  const nextIndex = getStageIndex(stage) + 1;
  return PRODUCTION_STAGES[nextIndex];
};

export const isHttpUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());

export const isValidDateInput = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export const isValidTimeInput = (value: string) =>
  /^(?:(?:[01]\d|2[0-3]):[0-5]\d|(?:0?[1-9]|1[0-2]):[0-5]\d\s?(?:AM|PM))$/i.test(value.trim());

const required = (errors: Record<string, string>, key: string, value: string, label: string) => {
  if (!value.trim()) errors[key] = `${label} is required.`;
};

const validateUrl = (errors: Record<string, string>, key: string, value: string, label: string) => {
  if (value.trim() && !isHttpUrl(value)) errors[key] = `${label} must start with http:// or https://.`;
};

const validatePlatform = (errors: Record<string, string>, value: string) => {
  if (value && !["Instagram", "YouTube", "Other"].includes(value)) errors.platform = "Choose Instagram, YouTube, or Other.";
};

const result = (errors: Record<string, string>): StageValidationResult => ({
  valid: Object.keys(errors).length === 0,
  errors,
  ...(Object.keys(errors).length ? { message: "Complete the highlighted fields before marking this stage complete." } : {}),
});

export function validateProductionStage(
  stage: ProductionStage,
  data: ProductionStagePayload | undefined,
): StageValidationResult {
  const errors: Record<string, string> = {};
  if (!data) return result({ stage: "Add this stage's data before marking it complete." });

  switch (stage) {
    case "Idea": {
      const value = data as IdeaStageData;
      required(errors, "concept", value.concept, "Idea / concept");
      required(errors, "title", value.title, "Title");
      required(errors, "description", value.description, "Description");
      validateUrl(errors, "referenceUrl", value.referenceUrl, "Reference link");
      break;
    }
    case "Scripting": {
      const value = data as ScriptingStageData;
      required(errors, "hook", value.hook, "Hook");
      required(errors, "script", value.script, "Script");
      break;
    }
    case "Shooting": {
      const value = data as ShootingStageData;
      required(errors, "shootDate", value.shootDate, "Shoot date");
      required(errors, "shootLocation", value.shootLocation, "Shoot location");
      required(errors, "equipment", value.equipment, "Equipment");
      if (value.shootDate.trim() && !isValidDateInput(value.shootDate)) errors.shootDate = "Use a real date in YYYY-MM-DD format.";
      validateUrl(errors, "assetsReference", value.assetsReference, "Assets/reference link");
      break;
    }
    case "Editing": {
      const value = data as EditingStageData;
      required(errors, "editingNotes", value.editingNotes, "Editing notes");
      required(errors, "editor", value.editor, "Editor / status owner");
      validateUrl(errors, "assetUrl", value.assetUrl, "Edited asset link");
      break;
    }
    case "Thumbnail": {
      const value = data as ThumbnailStageData;
      required(errors, "thumbnailUrl", value.thumbnailUrl, "Thumbnail link");
      validateUrl(errors, "thumbnailUrl", value.thumbnailUrl, "Thumbnail link");
      break;
    }
    case "Scheduled": {
      const value = data as ScheduledStageData;
      required(errors, "scheduledDate", value.scheduledDate, "Scheduled date");
      required(errors, "scheduledTime", value.scheduledTime, "Scheduled time");
      required(errors, "platform", value.platform, "Platform");
      validatePlatform(errors, value.platform);
      if (value.scheduledDate.trim() && !isValidDateInput(value.scheduledDate)) errors.scheduledDate = "Use a real date in YYYY-MM-DD format.";
      if (value.scheduledTime.trim() && !isValidTimeInput(value.scheduledTime)) errors.scheduledTime = "Use HH:MM or h:MM AM/PM.";
      break;
    }
    case "Published": {
      const value = data as PublishedStageData;
      required(errors, "publishedUrl", value.publishedUrl, "Published URL");
      required(errors, "publishedDate", value.publishedDate, "Published date");
      required(errors, "publishedTime", value.publishedTime, "Published time");
      required(errors, "platform", value.platform, "Platform");
      validatePlatform(errors, value.platform);
      validateUrl(errors, "publishedUrl", value.publishedUrl, "Published URL");
      if (value.publishedDate.trim() && !isValidDateInput(value.publishedDate)) errors.publishedDate = "Use a real date in YYYY-MM-DD format.";
      if (value.publishedTime.trim() && !isValidTimeInput(value.publishedTime)) errors.publishedTime = "Use HH:MM or h:MM AM/PM.";
      break;
    }
  }

  return result(errors);
}

export const getStageStatus = (project: ProductionProject, stage: ProductionStage): ProductionStepStatus =>
  project.workflowSteps.find((step) => step.stage === stage)?.status
  ?? (getStageIndex(stage) < getStageIndex(project.currentStage) ? "completed" : getStageIndex(stage) === getStageIndex(project.currentStage) ? "current" : "locked");

export const getCompletedStageCount = (project: ProductionProject) =>
  project.workflowSteps.filter((step) => step.status === "completed" || step.completed).length;

export const getIdeaStageData = (idea: ContentIdea): IdeaStageData => ({
  concept: idea.concept ?? idea.description,
  title: idea.title,
  description: idea.description,
  notes: idea.ideaNotes ?? (idea.notes ?? []).map((note) => note.text).join("\n"),
  referenceUrl: idea.sourceUrl ?? "",
  budget: idea.budget ?? "",
  reminderDate: idea.reminderDate ?? "",
  shootLocation: idea.shootLocation ?? "",
  equipment: idea.equipment ?? "",
  attachments: idea.attachment ? [idea.attachment] : [],
});

export const getProjectStageData = (project: ProductionProject): ProductionStageDataByStage => ({
  ...(project.stageData ?? {}),
  Idea: project.stageData?.Idea ?? {
    concept: project.description,
    title: project.title,
    description: project.description,
    notes: "",
    referenceUrl: project.sourceUrl ?? "",
    budget: project.budget ?? "",
    reminderDate: project.reminderDate ?? "",
    shootLocation: project.shootLocation ?? "",
    equipment: project.equipment ?? "",
    attachments: project.attachment ? [project.attachment] : [],
  },
});
