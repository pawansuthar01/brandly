import { Image as ExpoImage } from "expo-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  StyleProp,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton, AppCard, AppIcon, DateTimeField, IconButton, NATIVE_ANIMATIONS_ENABLED, Pill, ScreenSkeleton, SearchField } from "../../components/ui";
import { selectFileAttachment, selectMediaAttachment } from "../../services/mediaPicker.service";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import {
  ContentIdea,
  ContentIdeaAttachment,
  PRODUCTION_STAGES,
  ProductionProject,
  ProductionStage,
  ProductionStagePayload,
  TodoTask,
} from "../../types/marketplace";
import { TodoTaskCard } from "./TodoTask";
import { CreatorProjectDetailView } from "./CreatorProjectDetailView";
import { CreatorIdeaDetailView } from "./CreatorIdeaDetailView";
import { CREATOR_RATE_OPTIONS, SOCIAL_PLATFORM_REGISTRY } from "./marketplaceDomain";
import { DropdownPickerField } from "./auth/AuthPrimitives";

type StudioSection = "Ideas" | "Workflow" | "Projects" | "Archive";
type WorkflowPlatform = "Instagram" | "YouTube" | "Other";
type ProjectFilter = "All" | ProductionStage;
type StudioTabIcon = keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
type StudioTabItem<T extends string> = { key: T; label: string; icon?: StudioTabIcon };

const pad = (value: number) => String(value).padStart(2, "0");
const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromDateKey = (value: string) => new Date(`${value}T12:00:00`);
const todayDateKey = () => toDateKey(new Date());
const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(fromDateKey(value).getTime());
const creatorPlatforms = [...SOCIAL_PLATFORM_REGISTRY.map(({ key }) => key), "Other"];
type CreatorPlatformOption = typeof creatorPlatforms[number];
const platformIcon = (platform: CreatorPlatformOption): keyof typeof import("@expo/vector-icons").Ionicons.glyphMap =>
  SOCIAL_PLATFORM_REGISTRY.find(({ key }) => key === platform)?.icon ?? "ellipsis-horizontal";
const studioSectionTabs: StudioTabItem<StudioSection>[] = [
  { key: "Ideas", label: "Ideas", icon: "bulb-outline" },
  { key: "Workflow", label: "Workflow", icon: "git-branch-outline" },
  { key: "Projects", label: "Projects", icon: "briefcase-outline" },
  { key: "Archive", label: "Archive", icon: "archive-outline" },
];
const workflowPlatformTabs: StudioTabItem<WorkflowPlatform>[] = [
  { key: "Instagram", label: "Instagram", icon: "logo-instagram" },
  { key: "YouTube", label: "YouTube", icon: "logo-youtube" },
  { key: "Other", label: "Other", icon: "ellipsis-horizontal" },
];
const studioSectionOrder: StudioSection[] = ["Ideas", "Workflow", "Projects", "Archive"];
const isHttpUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());
export function StudioView({
  ideas,
  projects,
  tasks,
  isLoading = false,
  isSaving = false,
  onAddIdea,
  onUpdateIdea,
  onCreateProject,
  onAddIdeaNote,
  onUpdateIdeaNote,
  onRemoveIdeaNote,
  onArchiveIdea,
  onUnarchiveIdea,
  onToggleTask,
  onOpenTask,
  onOpenCalendar,
  onSaveStageDraft,
  onCompleteStage,
  onUpdateProject,
  onScroll,
  openComposer = false,
  onComposerOpened,
}: {
  ideas: ContentIdea[];
  projects: ProductionProject[];
  tasks: TodoTask[];
  isLoading?: boolean;
  isSaving?: boolean;
  onAddIdea: (idea: Omit<ContentIdea, "id">) => void;
  onUpdateIdea: (id: string, changes: Partial<Omit<ContentIdea, "id">>) => void;
  onCreateProject: (ideaId: string) => void;
  onAddIdeaNote: (id: string, note: string) => void;
  onUpdateIdeaNote: (id: string, noteId: string, note: string) => void;
  onRemoveIdeaNote: (id: string, noteId: string) => void;
  onArchiveIdea: (id: string) => void;
  onUnarchiveIdea: (id: string) => void;
  onToggleTask: (id: string) => void;
  onOpenTask?: (task: TodoTask) => void;
  onOpenCalendar: () => void;
  onSaveStageDraft: (id: string, stage: ProductionStage, data: ProductionStagePayload) => void;
  onCompleteStage: (id: string, stage: ProductionStage, data: ProductionStagePayload) => void;
  onUpdateProject: (id: string, changes: Partial<Omit<ProductionProject, "id" | "ideaId" | "workflowSteps" | "stageData" | "validationErrors" | "currentStage" | "createdAt">>) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  openComposer?: boolean;
  onComposerOpened?: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<StudioSection>("Ideas");
  const [sectionTransition] = useState(() => new Animated.Value(0));
  const [sectionOpacity] = useState(() => new Animated.Value(1));
  const sectionChangeLocked = useRef(false);
  const sectionAnimationFrame = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const [query, setQuery] = useState("");
  const [workflowPlatform, setWorkflowPlatform] = useState<WorkflowPlatform>("Instagram");
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("All");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [concept, setConcept] = useState("");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [ideaNotes, setIdeaNotes] = useState("");
  const [reminderDate, setReminderDate] = useState(todayDateKey);
  const [shootLocation, setShootLocation] = useState("");
  const [equipment, setEquipment] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [attachment, setAttachment] = useState<ContentIdeaAttachment>();
  const [platform, setPlatform] = useState<ContentIdea["platform"]>("Instagram");
  const [platformHint, setPlatformHint] = useState<CreatorPlatformOption | null>(null);
  const [error, setError] = useState("");
  const activeIdeas = ideas.filter((idea) => !idea.archived);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedIdea = ideas.find((idea) => idea.id === selectedIdeaId);
  const visibleIdeas = useMemo(() => {
    const source = section === "Archive" ? ideas.filter((idea) => idea.archived) : activeIdeas;
    const search = query.trim().toLowerCase();
    return source.filter((idea) =>
      !search || `${idea.title} ${idea.description} ${idea.platform} ${(idea.notes ?? []).map((note) => note.text).join(" ")}`.toLowerCase().includes(search),
    );
  }, [activeIdeas, ideas, query, section]);
  const visibleProjects = projects.filter((project) =>
    !project.archived && (projectFilter === "All" || project.currentStage === projectFilter),
  );
  const workflowProjects = projects.filter((project) => !project.archived && project.platform === workflowPlatform);
  const completedTasks = tasks.filter((task) => task.completed).length;
  const openTasks = tasks.length - completedTasks;

  const resetIdeaForm = useCallback(() => {
    setModalOpen(false);
    setEditingIdeaId(null);
    setTitle("");
    setConcept("");
    setBudget("");
    setDescription("");
    setIdeaNotes("");
    setReminderDate(todayDateKey());
    setShootLocation("");
    setEquipment("");
    setSourceUrl("");
    setAttachment(undefined);
    setPlatform("Instagram");
    setPlatformHint(null);
    setError("");
  }, []);
  const openNewIdea = useCallback(() => {
    resetIdeaForm();
    setModalOpen(true);
  }, [resetIdeaForm]);
  useEffect(() => {
    if (!openComposer) return;
    openNewIdea();
    onComposerOpened?.();
  }, [onComposerOpened, openComposer, openNewIdea]);
  useEffect(() => () => {
    if (sectionAnimationFrame.current !== null) cancelAnimationFrame(sectionAnimationFrame.current);
    sectionTransition.stopAnimation();
    sectionOpacity.stopAnimation();
  }, [sectionOpacity, sectionTransition]);
  const changeSection = useCallback((next: StudioSection) => {
    if (next === section || sectionChangeLocked.current) return;
    const currentIndex = studioSectionOrder.indexOf(section);
    const nextIndex = studioSectionOrder.indexOf(next);
    const direction = nextIndex > currentIndex ? 1 : -1;
    sectionChangeLocked.current = true;
    sectionTransition.stopAnimation();
    sectionOpacity.stopAnimation();
    Animated.timing(sectionOpacity, {
      toValue: 0,
      duration: 90,
      easing: Easing.in(Easing.quad),
      useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
    }).start(({ finished }) => {
      if (!finished) {
        sectionChangeLocked.current = false;
        return;
      }
      setSection(next);
      sectionAnimationFrame.current = requestAnimationFrame(() => {
        sectionAnimationFrame.current = null;
        sectionTransition.setValue(direction > 0 ? -16 : 16);
        sectionOpacity.setValue(0);
        Animated.parallel([
          Animated.timing(sectionTransition, {
            toValue: 0,
            duration: 240,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
          }),
          Animated.timing(sectionOpacity, {
            toValue: 1,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
          }),
        ]).start(() => {
          sectionChangeLocked.current = false;
        });
      });
    });
  }, [section, sectionOpacity, sectionTransition]);
  const openEditIdea = (idea: ContentIdea) => {
    setSelectedIdeaId(null);
    setEditingIdeaId(idea.id);
    setTitle(idea.title);
    setConcept(idea.concept ?? idea.description);
    setBudget(idea.budget ?? "");
    setDescription(idea.description);
    setIdeaNotes(idea.ideaNotes ?? "");
    setReminderDate(idea.reminderDate && isDateKey(idea.reminderDate) ? idea.reminderDate : todayDateKey());
    setShootLocation(idea.shootLocation ?? "");
    setEquipment(idea.equipment ?? "");
    setSourceUrl(idea.sourceUrl ?? "");
    setAttachment(idea.attachment);
    setPlatform(idea.platform);
    setPlatformHint(null);
    setError("");
    setModalOpen(true);
  };
  const saveIdea = () => {
    if (!title.trim()) return setError("Add a short title for this idea.");
    if (sourceUrl.trim() && !isHttpUrl(sourceUrl)) return setError("Use a complete link starting with http:// or https://.");
    const nextIdea: Omit<ContentIdea, "id"> = {
      title: title.trim(),
      concept: concept.trim(),
      description: description.trim(),
      ideaNotes: ideaNotes.trim(),
      platform,
      archived: false,
      ...(budget.trim() ? { budget: budget.trim() } : {}),
      ...(reminderDate.trim() ? { reminderDate: reminderDate.trim() } : {}),
      ...(shootLocation.trim() ? { shootLocation: shootLocation.trim() } : {}),
      ...(equipment.trim() ? { equipment: equipment.trim() } : {}),
      ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}),
      ...(attachment ? { attachment } : {}),
    };
    if (editingIdeaId) onUpdateIdea(editingIdeaId, nextIdea);
    else onAddIdea(nextIdea);
    resetIdeaForm();
  };
  const attachMedia = async () => {
    try { const selected = await selectMediaAttachment(); if (selected[0]) setAttachment(selected[0]); }
    catch { setError("Media could not be attached. Please try again."); }
  };
  const attachFile = async () => {
    try { const selected = await selectFileAttachment(); if (selected) setAttachment(selected); }
    catch { setError("File could not be attached. Please try again."); }
  };

  if (selectedProject) {
    return (
      <CreatorProjectDetailView
        project={selectedProject}
        isSaving={isSaving}
        onBack={() => setSelectedProjectId(null)}
        onSaveStageDraft={onSaveStageDraft}
        onCompleteStage={onCompleteStage}
        onUpdateProject={onUpdateProject}
      />
    );
  }

  if (selectedIdea) {
    const ideaProject = projects.find((project) => project.ideaId === selectedIdea.id);
    return (
      <CreatorIdeaDetailView
        idea={selectedIdea}
        project={ideaProject}
        onBack={() => setSelectedIdeaId(null)}
        isSaving={isSaving}
        onEdit={() => openEditIdea(selectedIdea)}
        onOpenProject={ideaProject ? () => { setSelectedIdeaId(null); setSelectedProjectId(ideaProject.id); } : undefined}
        onCreateProject={() => { setSelectedIdeaId(null); onCreateProject(selectedIdea.id); }}
        onArchive={() => { onArchiveIdea(selectedIdea.id); setSelectedIdeaId(null); }}
        onUnarchive={() => { onUnarchiveIdea(selectedIdea.id); setSelectedIdeaId(null); }}
        onAddNote={(note) => onAddIdeaNote(selectedIdea.id, note)}
        onUpdateNote={(noteId, note) => onUpdateIdeaNote(selectedIdea.id, noteId, note)}
        onRemoveNote={(noteId) => onRemoveIdeaNote(selectedIdea.id, noteId)}
        onScroll={onScroll}
      />
    );
  }

  return (
    <>
      <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.page} onScroll={onScroll} scrollEventThrottle={16}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={styles.tabScroller} contentContainerStyle={styles.tabScrollerContent}>
          <StudioTabBar items={studioSectionTabs} value={section} onChange={changeSection} label="Studio sections" bordered motion="section" />
        </ScrollView>

        <Animated.View style={[styles.sectionContent, { opacity: sectionOpacity, transform: [{ translateX: sectionTransition }] }]}>
        {isLoading ? <ScreenSkeleton count={4} /> : null}
        {!isLoading && (section === "Ideas" || section === "Archive") ? (
          <>
            <View style={styles.actionRow}><View style={styles.searchSlot}><SearchField value={query} onChangeText={setQuery} placeholder="Search ideas" accessibilityLabel="Search content ideas" /></View><IconButton name="add" label="New idea" variant="primary" onPress={openNewIdea} /></View>
            <View style={styles.sectionHeader}><View style={styles.flex}><Text style={styles.sectionTitle}>{section === "Archive" ? "Archived ideas" : "Ideas"}</Text><Text style={styles.sectionSubtitle}>{visibleIdeas.length} saved idea{visibleIdeas.length === 1 ? "" : "s"}</Text></View><Pill label={section === "Archive" ? "Past" : "Ready"} accent={section !== "Archive"} /></View>
            {visibleIdeas.length ? visibleIdeas.map((idea, index) => {
              const project = projects.find((item) => item.ideaId === idea.id);
              const ideaTone = [styles.ideaCardSky, styles.ideaCardMint, styles.ideaCardBlush, styles.ideaCardButter][index % 4];
              return <AppCard key={idea.id} onPress={() => setSelectedIdeaId(idea.id)} style={[styles.ideaCard, ideaTone]}>
                <View style={styles.ideaHeader}>{idea.attachment?.type === "image" && idea.attachment.uri ? <ExpoImage source={idea.attachment.uri} contentFit="cover" style={styles.ideaThumbnail} accessibilityLabel={`${idea.title} reference`} /> : <View style={styles.ideaIcon}><AppIcon name={idea.attachment?.type === "video" ? "videocam-outline" : idea.attachment?.type === "file" ? "document-text-outline" : "bulb-outline"} size={19} color={theme.colors.primary} /></View>}<View style={styles.flex}><Text style={styles.ideaTitle}>{idea.title}</Text><Text numberOfLines={2} style={styles.ideaDescription}>{idea.description || "No brief added yet."}</Text></View><AppIcon name="chevron-forward" size={18} color={theme.colors.textSecondary} /></View>
                <View style={styles.ideaSummary}><Pill label={idea.platform} /><Pill label={idea.archived ? "Archived" : project ? "Project" : "Idea"} accent={!idea.archived} />{idea.budget ? <Text style={styles.ideaBudget}>{idea.budget}</Text> : null}</View>
              </AppCard>;
            }) : <AppCard style={styles.emptyCard}><View style={styles.emptyIcon}><AppIcon name="bulb-outline" size={24} color={theme.colors.primary} /></View><Text style={styles.emptyTitle}>{section === "Archive" ? "Nothing archived" : "Start with one useful idea"}</Text><Text style={styles.emptyBody}>Save a hook, content angle, or collaboration thought here so it is ready when you are.</Text>{section !== "Archive" ? <AppButton label="Save an idea" icon="add" onPress={openNewIdea} /> : null}</AppCard>}
          </>
        ) : null}

        {!isLoading && section === "Projects" ? (
          <>
            <View style={styles.sectionHeader}><View style={styles.flex}><Text style={styles.sectionTitle}>Projects</Text><Text style={styles.sectionSubtitle}>Manage your video production pipeline.</Text></View><Pill label={`${visibleProjects.length}`} accent /></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={styles.tabScroller} contentContainerStyle={styles.tabScrollerContent}><StudioTabBar items={[{ key: "All", label: "All" }, ...PRODUCTION_STAGES.map((stage) => ({ key: stage, label: stage }))]} value={projectFilter} onChange={setProjectFilter} label="Project status filters" motion="filter" /></ScrollView>
            {visibleProjects.length ? visibleProjects.map((project, index) => <ProjectCard key={project.id} project={project} tone={[styles.ideaCardSky, styles.ideaCardMint, styles.ideaCardBlush, styles.ideaCardButter][index % 4]} onPress={() => setSelectedProjectId(project.id)} />) : <AppCard style={styles.emptyCard}><View style={styles.emptyIcon}><AppIcon name="briefcase-outline" size={24} color={theme.colors.primary} /></View><Text style={styles.emptyTitle}>{projects.length ? "No projects in this stage" : "Create your first project"}</Text><Text style={styles.emptyBody}>{projects.length ? "Choose another production status to see matching projects." : "Open Ideas, then promote an idea into a real production workflow."}</Text><AppButton label="Open ideas" icon="bulb-outline" onPress={() => changeSection("Ideas")} /></AppCard>}
          </>
        ) : null}

        {!isLoading && section === "Workflow" ? (
          <>
            <View style={styles.sectionHeader}><View style={styles.flex}><Text style={styles.sectionTitle}>Workflow</Text><Text style={styles.sectionSubtitle}>Move creator projects through seven production stages.</Text></View><Pill label={`${openTasks} tasks open`} accent={openTasks > 0} /></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={styles.tabScroller} contentContainerStyle={styles.tabScrollerContent}><StudioTabBar items={workflowPlatformTabs} value={workflowPlatform} onChange={setWorkflowPlatform} label="Workflow platform filters" motion="filter" /></ScrollView>
            {workflowProjects.length ? workflowProjects.map((project, index) => <ProjectCard key={project.id} project={project} tone={[styles.ideaCardSky, styles.ideaCardMint, styles.ideaCardBlush, styles.ideaCardButter][index % 4]} onPress={() => setSelectedProjectId(project.id)} />) : <AppCard style={styles.emptyCard}><View style={styles.emptyIcon}><AppIcon name="git-branch-outline" size={24} color={theme.colors.primary} /></View><Text style={styles.emptyTitle}>No {workflowPlatform} projects yet</Text><Text style={styles.emptyBody}>Create a project from Ideas to open its seven-stage production workflow.</Text><AppButton label="Open ideas" icon="bulb-outline" onPress={() => changeSection("Ideas")} /></AppCard>}
            <View style={styles.taskSection}><View style={styles.taskHeader}><Text style={styles.sectionTitle}>Next steps</Text><Pressable accessibilityRole="button" accessibilityLabel="Open calendar" onPress={onOpenCalendar} style={styles.calendarLink}><Text style={styles.calendarLinkText}>Calendar</Text><AppIcon name="arrow-forward" size={15} color={theme.colors.primary} /></Pressable></View><View style={styles.taskList}>{tasks.slice(0, 6).length ? tasks.slice(0, 6).map((task, index) => <TodoTaskCard key={task.id} task={task} index={index + 1} variant="workflow" onToggle={() => onToggleTask(task.id)} onOpen={onOpenTask ? () => onOpenTask(task) : undefined} />) : <View style={styles.emptyTask}><AppIcon name="checkmark-circle-outline" size={24} color={theme.colors.primary} /><Text style={styles.emptyBody}>Your workflow is clear. Add a task in Calendar when you are ready.</Text></View>}</View></View>
            <AppButton label="Open full calendar" icon="calendar-outline" onPress={onOpenCalendar} />
          </>
        ) : null}
        </Animated.View>
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={resetIdeaForm}>
        <View style={styles.modalOverlay}><Pressable style={styles.modalBackdrop} onPress={resetIdeaForm} /><View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}><View style={styles.modalHeader}><View style={styles.flex}><Text style={styles.modalTitle}>{editingIdeaId ? "Edit idea" : "New idea"}</Text><Text style={styles.sectionSubtitle}>Save the context you will need when it becomes a project.</Text></View><Pressable accessibilityRole="button" accessibilityLabel={editingIdeaId ? "Close edit idea" : "Close new idea"} onPress={resetIdeaForm} style={styles.closeButton}><AppIcon name="close" size={20} color={theme.colors.textPrimary} /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalForm}>
          <Text style={styles.fieldLabel}>Platform</Text><View style={styles.platformRow}>{creatorPlatforms.map((item) => { const selected = item === platform; return <Pressable key={item} accessibilityRole="radio" accessibilityLabel={`${item} platform`} accessibilityState={{ selected }} onPress={() => { setPlatform(item as ContentIdea["platform"]); setPlatformHint(null); }} onLongPress={() => setPlatformHint(item)} delayLongPress={400} style={[styles.platformChip, selected && styles.platformChipActive]}><AppIcon name={platformIcon(item)} size={18} color={selected ? theme.colors.primary : theme.colors.textSecondary} /></Pressable>; })}</View>{platformHint ? <Text style={styles.platformHint}>Platform: {platformHint}</Text> : null}
          <Text style={styles.fieldLabel}>Idea / concept</Text><TextInput accessibilityLabel="Idea concept" value={concept} onChangeText={(value) => { setConcept(value); setError(""); }} placeholder="e.g. Three desk resets that save time" placeholderTextColor={theme.colors.inputPlaceholder} multiline textAlignVertical="top" style={[styles.input, styles.textarea]} />
          <Text style={styles.fieldLabel}>Title / caption</Text><TextInput accessibilityLabel="Idea title" value={title} onChangeText={(value) => { setTitle(value); setError(""); }} placeholder="Give the idea a working title" placeholderTextColor={theme.colors.inputPlaceholder} style={styles.input} />
          <Text style={styles.fieldLabel}>Description</Text><TextInput accessibilityLabel="Idea description" value={description} onChangeText={setDescription} placeholder="Add the hook, angle, or useful context" placeholderTextColor={theme.colors.inputPlaceholder} multiline textAlignVertical="top" style={[styles.input, styles.textarea]} />
          <Text style={styles.fieldLabel}>Notes</Text><TextInput accessibilityLabel="Idea notes" value={ideaNotes} onChangeText={setIdeaNotes} placeholder="Optional production notes" placeholderTextColor={theme.colors.inputPlaceholder} multiline textAlignVertical="top" style={[styles.input, styles.textarea]} />
          <Text style={styles.fieldLabel}>Budget / rate</Text><DropdownPickerField label="Budget / rate" value={budget} placeholder="Select budget / rate" icon="cash-outline" options={CREATOR_RATE_OPTIONS} onSelect={setBudget} />
          <Text style={styles.fieldLabel}>Video / link</Text><TextInput accessibilityLabel="Idea source URL" value={sourceUrl} onChangeText={(value) => { setSourceUrl(value); setError(""); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://..." placeholderTextColor={theme.colors.inputPlaceholder} style={styles.input} />
          <DateTimeField label="Reminder date" value={reminderDate} onChange={setReminderDate} mode="date" placeholder="Choose reminder date" />
          <Text style={styles.fieldLabel}>Shoot location</Text><TextInput accessibilityLabel="Idea shoot location" value={shootLocation} onChangeText={setShootLocation} placeholder="e.g. Home studio" placeholderTextColor={theme.colors.inputPlaceholder} style={styles.input} />
          <Text style={styles.fieldLabel}>Equipment</Text><TextInput accessibilityLabel="Idea equipment" value={equipment} onChangeText={setEquipment} placeholder="e.g. Phone, tripod, softbox" placeholderTextColor={theme.colors.inputPlaceholder} style={styles.input} />
          <View style={styles.attachmentButtons}><AppButton label="Attach media" icon="image-outline" variant="secondary" onPress={() => void attachMedia()} style={styles.attachmentButton} /><AppButton label="Attach file" icon="document-outline" variant="secondary" onPress={() => void attachFile()} style={styles.attachmentButton} /></View>
          {attachment ? <View style={styles.selectedAttachment}><AppIcon name="attach-outline" size={16} color={theme.colors.primary} /><Text numberOfLines={1} style={styles.referenceText}>{attachment.name}</Text></View> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}<AppButton label={editingIdeaId ? "Save changes" : "Save idea"} icon="checkmark" loading={isSaving} onPress={saveIdea} />
        </ScrollView></View></View>
      </Modal>
    </>
  );
}

function StudioTabBar<T extends string>({
  items,
  value,
  onChange,
  label,
  bordered = false,
  motion = "filter",
}: {
  items: StudioTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  bordered?: boolean;
  motion?: "section" | "filter";
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const progress = useRef<Record<string, Animated.Value>>({});
  const previousValue = useRef(value);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;
  const layouts = useRef<Record<string, { x: number; width: number }>>({});
  const itemKeys = items.map((item) => item.key).join("|");

  items.forEach((item) => {
    progress.current[item.key] ??= new Animated.Value(item.key === value ? 1 : 0);
  });

  useEffect(() => {
    const animations: Animated.CompositeAnimation[] = motion === "filter" ? items.map((item) =>
        Animated.spring(progress.current[item.key], {
          toValue: item.key === value ? 1 : 0,
          useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
          damping: 26,
          stiffness: 340,
          mass: 0.6,
        }),
    ) : [];
    if (previousValue.current !== value) {
      if (motion === "section") {
        const target = layouts.current[value];
        if (target) {
          animations.push(Animated.parallel([
            Animated.timing(indicatorX, { toValue: target.x, duration: 220, useNativeDriver: false }),
            Animated.timing(indicatorWidth, { toValue: target.width, duration: 220, useNativeDriver: false }),
          ]));
        }
      }
      previousValue.current = value;
    }
    if (animations.length) Animated.parallel(animations).start();
  }, [indicatorWidth, indicatorX, itemKeys, motion, value]);

  return (
    <View accessibilityLabel={label} style={[styles.studioTabBar, bordered && styles.studioTabBarBordered]}>
      {motion === "section" ? <Animated.View pointerEvents="none" style={[styles.studioTabIndicator, { width: indicatorWidth, transform: [{ translateX: indicatorX }] }]}><View style={styles.studioTabIndicatorLine} /></Animated.View> : null}
      {items.map((item) => {
        const selected = item.key === value;
        const activeProgress = progress.current[item.key];
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(item.key)}
            onLayout={(event) => {
              const { x, width } = event.nativeEvent.layout;
              layouts.current[item.key] = { x, width };
              if (motion === "section" && selected) {
                indicatorX.setValue(x);
                indicatorWidth.setValue(width);
              }
            }}
            style={({ pressed }) => [styles.studioTab, pressed && styles.pressed]}
          >
            {motion === "filter" ? <Animated.View pointerEvents="none" style={[styles.studioTabActiveSurface, { opacity: activeProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }), transform: [{ scale: activeProgress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]} /> : null}
            <View style={styles.studioTabContent}>
              {item.icon ? <AppIcon name={item.icon} size={16} color={selected ? theme.colors.primary : theme.colors.textSecondary} /> : null}
              <Text style={[styles.studioTabText, selected && styles.studioTabTextActive]}>{item.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function ProjectCard({ project, tone, onPress }: { project: ProductionProject; tone?: StyleProp<ViewStyle>; onPress: () => void }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const completed = project.workflowSteps.filter((step) => step.status === "completed").length;
  const progress = Math.round((completed / PRODUCTION_STAGES.length) * 100);
  return <AppCard onPress={onPress} style={[styles.projectCard, tone]}><View style={styles.projectIcon}>{project.attachment?.type === "image" && project.attachment.uri ? <ExpoImage source={project.attachment.uri} contentFit="cover" style={styles.projectThumbnail} accessibilityLabel={`${project.title} project thumbnail`} /> : <AppIcon name={project.attachment?.type === "video" ? "videocam-outline" : project.attachment?.type === "file" ? "document-text-outline" : "videocam-outline"} size={22} color={theme.colors.primary} />}</View><View style={styles.flex}><View style={styles.projectTitleRow}><Text numberOfLines={1} style={styles.projectTitle}>{project.title}</Text><Pill label={project.currentStage} accent /></View><Text numberOfLines={2} style={styles.projectDescription}>{project.description || "No description added yet."}</Text><Text style={styles.projectMeta}>{project.platform} · {progress}% complete{project.dueDate ? ` · Due ${project.dueDate}` : ""}</Text></View><AppIcon name="chevron-forward" size={18} color={theme.colors.textSecondary} /></AppCard>;
}

const makeStyles = (theme: AppTheme) => createThemeStyles(theme, {
  screen: { flex: 1 }, page: { gap: theme.spacing.md, paddingTop: theme.spacing.md, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }, flex: { flex: 1, minWidth: 0 }, pressed: { opacity: 0.78 },
  ideaSummary: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: theme.spacing.sm },
  tabScroller: { flexGrow: 0 }, tabScrollerContent: { paddingRight: theme.spacing.lg }, studioTabBar: { alignSelf: "flex-start", flexDirection: "row", gap: theme.spacing.xs, padding: theme.spacing.xs, borderRadius: theme.radius.pill, overflow: "hidden" }, studioTabBarBordered: { borderWidth: 1, borderColor: theme.colors.border }, studioTab: { minHeight: 48, justifyContent: "center", paddingHorizontal: theme.spacing.sm, borderRadius: theme.radius.pill, overflow: "hidden" }, studioTabIndicator: { position: "absolute", left: 0, bottom: theme.spacing.xs, height: 48, zIndex: 0, backgroundColor: theme.colors.accent, borderTopLeftRadius: theme.radius.control, borderTopRightRadius: theme.radius.control }, studioTabIndicatorLine: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: theme.colors.primary }, studioTabActiveSurface: { ...StyleSheet.absoluteFill, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceRaised }, studioTabContent: { minHeight: 46, zIndex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.xs }, studioTabText: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont }, studioTabTextActive: { color: theme.colors.primary }, sectionContent: { gap: theme.spacing.md },
  actionRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }, searchSlot: { flex: 1, minWidth: 0 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.sm }, sectionTitle: { color: theme.colors.textPrimary, fontSize: theme.type.title, lineHeight: theme.type.lineHeight.title, fontWeight: "900", fontFamily: theme.type.displayFont }, sectionSubtitle: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
  ideaCard: { gap: theme.spacing.sm, borderWidth: 0 }, ideaCardSky: { backgroundColor: theme.colors.surfaceSky }, ideaCardMint: { backgroundColor: theme.colors.surfaceMint }, ideaCardBlush: { backgroundColor: theme.colors.surfaceBlush }, ideaCardButter: { backgroundColor: theme.colors.surfaceButter }, ideaHeader: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm }, ideaIcon: { width: 40, height: 40, borderRadius: theme.radius.control, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceRaised }, ideaThumbnail: { width: 40, height: 40, borderRadius: theme.radius.control }, ideaTitle: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, fontWeight: "900", fontFamily: theme.type.bodyFont }, ideaDescription: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont }, ideaBudget: { color: theme.colors.primary, fontSize: theme.type.body, fontWeight: "900", fontFamily: theme.type.bodyFont }, referenceText: { flexShrink: 1, color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
  emptyCard: { gap: theme.spacing.sm, alignItems: "flex-start", backgroundColor: theme.colors.surfaceSky, borderWidth: 0 }, emptyIcon: { width: 46, height: 46, borderRadius: theme.radius.control, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceRaised }, emptyTitle: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.displayFont }, emptyBody: { color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont },
  projectCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceMint, borderWidth: 0 }, projectIcon: { width: 52, height: 52, borderRadius: theme.radius.control, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceRaised }, projectThumbnail: { width: 52, height: 52, borderRadius: theme.radius.control }, projectTitleRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }, projectTitle: { flex: 1, color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, fontWeight: "900", fontFamily: theme.type.bodyFont }, projectDescription: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont }, projectMeta: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontWeight: "700", fontFamily: theme.type.bodyFont },
  taskSection: { gap: theme.spacing.sm, marginTop: theme.spacing.sm }, taskHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, calendarLink: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }, calendarLinkText: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "900", fontFamily: theme.type.bodyFont }, taskList: { gap: theme.spacing.sm }, emptyTask: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceRaised },
  modalOverlay: { flex: 1, justifyContent: "flex-end" }, modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.overlay }, modalCard: { maxHeight: "92%", gap: theme.spacing.md, padding: theme.spacing.lg, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, backgroundColor: theme.colors.surface }, modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md }, modalTitle: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.displayFont }, closeButton: { width: 44, height: 44, borderRadius: theme.radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceMuted }, modalForm: { gap: theme.spacing.sm, paddingBottom: theme.spacing.xl }, fieldLabel: { marginTop: theme.spacing.xs, color: theme.colors.textPrimary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont }, input: { minHeight: 46, paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.inputBackground, color: theme.colors.textPrimary, fontSize: theme.type.body, fontFamily: theme.type.bodyFont }, textarea: { minHeight: 92, paddingTop: theme.spacing.sm }, datePicker: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 2 }, datePickerField: { flex: 1, minWidth: 0 }, dateAdjust: { width: 32, height: 48, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceMuted }, readOnlyField: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceMuted }, readOnlyText: { flex: 1, color: theme.colors.textPrimary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont }, platformRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }, platformChip: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border }, platformChipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.primary }, platformHint: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont }, attachmentButtons: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.sm }, attachmentButton: { flex: 1 }, selectedAttachment: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, paddingHorizontal: theme.spacing.sm, borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceMuted }, errorText: { color: theme.colors.danger, fontSize: theme.type.caption, fontWeight: "700", fontFamily: theme.type.bodyFont },
});
