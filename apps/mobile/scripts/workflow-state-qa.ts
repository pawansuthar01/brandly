import {
  addIdea,
  addTodoTask,
  completeProductionStage,
  createProjectFromIdea,
  hydrateDemo,
  mobileStore,
  saveProductionStageDraft,
  toggleTodoTask,
  updateTodoTask,
} from "../src/store/store";
import { getCompletedStageCount, isValidDateInput, isValidTimeInput, validateProductionStage } from "../src/lib/productionWorkflow";
import type {
  ContentIdea,
  ProductionProject,
  ProductionStagePayload,
  TodoTask,
} from "../src/types/marketplace";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const idea = (title: string, complete = true): Omit<ContentIdea, "id"> => ({
  title,
  concept: complete ? `${title} concept` : "",
  description: complete ? `${title} description` : "",
  platform: "YouTube",
  archived: false,
});

const project = (id: string): ProductionProject => {
  const value = mobileStore.getState().demo.projects.find((item) => item.id === id);
  assert(value, `Project ${id} was not found.`);
  return value;
};

const complete = (id: string, stage: ProductionProject["currentStage"], data: ProductionStagePayload) => {
  mobileStore.dispatch(completeProductionStage({ id, stage, data }));
};

mobileStore.dispatch(hydrateDemo({ ideas: [], projects: [], todoTasks: [] }));

mobileStore.dispatch(addIdea(idea("Project A")));
mobileStore.dispatch(addIdea(idea("Project B", false)));
mobileStore.dispatch(addIdea(idea("Project C")));
const ideas = mobileStore.getState().demo.ideas;
assert(new Set(ideas.map((item) => item.id)).size === 3, "Idea IDs must be unique.");

for (const item of ideas) mobileStore.dispatch(createProjectFromIdea(item.id));
const projects = mobileStore.getState().demo.projects;
assert(projects.length === 3, "Three independent projects must be created.");
assert(new Set(projects.map((item) => item.id)).size === 3, "Project IDs must be unique.");

const projectAId = projects.find((item) => item.title === "Project A")?.id;
const projectBId = projects.find((item) => item.title === "Project B")?.id;
const projectCId = projects.find((item) => item.title === "Project C")?.id;
assert(projectAId && projectBId && projectCId, "Projects A, B, and C must exist.");

complete(projectBId, "Idea", project(projectBId).stageData.Idea!);
assert(project(projectBId).currentStage === "Idea", "Invalid Idea data must not unlock Scripting.");
assert(Boolean(project(projectBId).validationErrors.Idea?.concept), "Idea validation errors must persist.");

complete(projectAId, "Idea", project(projectAId).stageData.Idea!);
assert(project(projectAId).currentStage === "Scripting", "Completing Idea must unlock Scripting.");
assert(project(projectAId).workflowSteps[2].status === "locked", "Shooting must remain locked.");
assert(getCompletedStageCount(project(projectAId)) === 1, "Idea completion progress must equal one stage.");

const scriptingDraft = { script: "", hook: "Opening hook", cta: "", caption: "", notes: "Draft" };
mobileStore.dispatch(saveProductionStageDraft({ id: projectAId, stage: "Scripting", data: scriptingDraft }));
assert(project(projectAId).workflowSteps[1].status === "draft", "Scripting must remain a draft.");
assert(project(projectAId).stageData.Scripting?.hook === "Opening hook", "Scripting draft data must persist.");
complete(projectAId, "Shooting", { shootDate: "2026-10-01", shootLocation: "Studio", equipment: "Phone", shotNotes: "", assetsReference: "" });
assert(project(projectAId).currentStage === "Scripting", "Locked Shooting must not be bypassed.");

complete(projectCId, "Idea", project(projectCId).stageData.Idea!);
complete(projectCId, "Scripting", { script: "Full script", hook: "Hook", cta: "Follow", caption: "Caption", notes: "" });
assert(project(projectCId).currentStage === "Shooting", "Project C must advance independently to Shooting.");
assert(project(projectAId).currentStage === "Scripting", "Project A must remain at Scripting.");
assert(project(projectBId).currentStage === "Idea", "Project B must remain at Idea.");
assert(getCompletedStageCount(project(projectAId)) === 1 && getCompletedStageCount(project(projectBId)) === 0 && getCompletedStageCount(project(projectCId)) === 2, "Project progress must remain independent.");

complete(projectAId, "Scripting", { script: "Full script", hook: "Hook", cta: "Follow", caption: "Caption", notes: "" });
complete(projectAId, "Shooting", { shootDate: "2026-10-01", shootLocation: "Studio", equipment: "Phone, tripod", shotNotes: "Wide and close shots", assetsReference: "https://example.com/shots" });
complete(projectAId, "Editing", { editingNotes: "Tight first cut", editor: "You", status: "Final cut", assetUrl: "https://example.com/edit", revisionNotes: "" });
complete(projectAId, "Thumbnail", { thumbnailUrl: "https://example.com/thumb.jpg", notes: "High contrast", revisionInfo: "Approved" });
complete(projectAId, "Scheduled", { scheduledDate: "2026-10-05", scheduledTime: "18:30", platform: "YouTube", publishingNotes: "Use final caption" });
complete(projectAId, "Published", { publishedUrl: "https://example.com/video", publishedDate: "2026-10-05", publishedTime: "18:35", platform: "YouTube", finalNotes: "Published successfully", status: "Live" });
assert(project(projectAId).currentStage === "Published", "Project A must finish at Published.");
assert(getCompletedStageCount(project(projectAId)) === 7, "Published project must report seven completed stages.");
assert(project(projectAId).stageData.Published?.status === "Live", "Published result data must be stored.");
assert(project(projectBId).currentStage === "Idea" && project(projectCId).currentStage === "Shooting", "Completing A must not modify B or C.");

const editedIdea = { ...project(projectAId).stageData.Idea!, title: "Project A edited" };
complete(projectAId, "Idea", editedIdea);
assert(project(projectAId).currentStage === "Published", "Editing a completed Idea must preserve final workflow state.");
assert(project(projectAId).title === "Project A edited", "Edited Idea summary must update its project only.");
assert(project(projectBId).title === "Project B", "Editing A must not modify B.");

assert(!validateProductionStage("Thumbnail", { thumbnailUrl: "bad-url", notes: "", revisionInfo: "" }).valid, "Invalid thumbnail URL must fail.");
assert(!validateProductionStage("Scheduled", { scheduledDate: "2026-02-30", scheduledTime: "25:70", platform: "YouTube", publishingNotes: "" }).valid, "Invalid scheduled date/time must fail.");
assert(!validateProductionStage("Published", { publishedUrl: "bad-url", publishedDate: "2026-10-05", publishedTime: "18:35", platform: "YouTube", finalNotes: "", status: "Live" }).valid, "Invalid published URL must fail.");
assert(!validateProductionStage("Scheduled", { scheduledDate: "2026-10-05", scheduledTime: "18:35", platform: "BannedPlatform", publishingNotes: "" } as never).valid, "Unsupported platform must fail.");
assert(isValidDateInput("2026-10-05") && !isValidDateInput("2026-02-30"), "Calendar date validation must reject impossible dates.");
assert(isValidTimeInput("11:00 AM") && !isValidTimeInput("25:70"), "Calendar time validation must reject malformed times.");

mobileStore.dispatch(addTodoTask({
  title: "Write Project A script",
  owner: "You",
  dueDate: "2026-10-02",
  dueTime: "10:00 AM",
  notes: "Linked production task",
  reminderEnabled: false,
  reminderTone: "default",
  completed: false,
  projectId: projectAId,
  stage: "Scripting",
}));
const taskId = mobileStore.getState().demo.todoTasks.at(-1)?.id;
assert(taskId, "Linked Todo must be created.");
mobileStore.dispatch(updateTodoTask({ id: taskId, changes: { dueTime: "11:00 AM" } }));
let task = mobileStore.getState().demo.todoTasks.find((item) => item.id === taskId) as TodoTask;
assert(task.projectId === projectAId && task.stage === "Scripting", "Editing Todo must preserve project and stage links.");
mobileStore.dispatch(toggleTodoTask(taskId));
task = mobileStore.getState().demo.todoTasks.find((item) => item.id === taskId) as TodoTask;
assert(task.completed && task.projectId === projectAId, "Todo completion must preserve its project link.");

mobileStore.dispatch(addTodoTask({
  title: "Refine Project B idea",
  owner: "You",
  dueDate: "2026-10-03",
  dueTime: "2:30 PM",
  notes: "Calendar-linked task",
  reminderEnabled: false,
  reminderTone: "default",
  completed: false,
  projectId: projectBId,
  stage: "Idea",
}));
const calendarTaskId = mobileStore.getState().demo.todoTasks.at(-1)?.id;
assert(calendarTaskId && calendarTaskId !== taskId, "Calendar-linked task must have an independent ID.");
mobileStore.dispatch(updateTodoTask({ id: calendarTaskId, changes: { dueDate: "2026-10-04", dueTime: "3:00 PM" } }));
const calendarTask = mobileStore.getState().demo.todoTasks.find((item) => item.id === calendarTaskId);
assert(calendarTask?.projectId === projectBId && calendarTask.stage === "Idea", "Calendar task edits must preserve Project B and Idea links.");

const snapshot = JSON.parse(JSON.stringify(mobileStore.getState().demo));
mobileStore.dispatch(hydrateDemo({ ideas: [], projects: [], todoTasks: [] }));
mobileStore.dispatch(hydrateDemo(snapshot));
assert(project(projectAId).stageData.Published?.publishedUrl === "https://example.com/video", "Hydration must restore stage data.");
assert(project(projectAId).workflowSteps.every((step) => step.status === "completed"), "Hydration must restore workflow status.");
assert(Boolean(project(projectBId).validationErrors.Idea?.concept), "Hydration must restore persisted validation errors.");
task = mobileStore.getState().demo.todoTasks.find((item) => item.id === taskId) as TodoTask;
assert(task.projectId === projectAId && task.stage === "Scripting", "Hydration must restore Todo project and stage links.");
const restoredCalendarTask = mobileStore.getState().demo.todoTasks.find((item) => item.id === calendarTaskId);
assert(restoredCalendarTask?.projectId === projectBId && restoredCalendarTask.stage === "Idea", "Hydration must restore Calendar project and stage links.");

console.log("Creator workflow state QA passed: 3 projects, 7 stages, validation, isolation, Todo links, and hydration.");
