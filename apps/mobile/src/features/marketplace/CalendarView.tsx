import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AppButton,
  AppCard,
  AppIcon,
  ConfirmModal,
  DateTimeField,
  Pill,
  SearchField,
  Toggle,
} from "../../components/ui";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import {
  Campaign,
  Influencer,
  PRODUCTION_STAGES,
  ProductionProject,
  ProductionStage,
  ReminderSettings,
  TodoTask,
  TodoTaskDraft,
  DemoAttachment,
} from "../../types/marketplace";
import {
  isValidDateInput,
  isValidTimeInput,
} from "../../lib/productionWorkflow";
import { parseReminderDateTime } from "../../lib/reminders";
import {
  selectFileAttachment,
  selectMediaAttachment,
} from "../../services/mediaPicker.service";
import { TodoTaskCard, TodoTaskEmptyState } from "./TodoTask";
import { ReminderSettingsSheet } from "./FlowScreens";
import { ConsistencyChart } from "../../components/TaskInsights";

const pad = (value: number) => String(value).padStart(2, "0");
const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const normalizeDateKey = (value: string) => {
  const datePrefix = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (datePrefix) return datePrefix;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : toDateKey(parsed);
};
const fromDateKey = (value: string) =>
  new Date(`${normalizeDateKey(value)}T12:00:00`);
const formatDateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(fromDateKey(value));
const getCurrentTaskTime = () =>
  new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
const MAX_VISIBLE_TASKS = 6;

export function CalendarView({
  tasks,
  projects,
  campaigns = [],
  creators = [],
  role = "Influencer",
  onToggleTask,
  onOpenTask,
  onAddTask,
  onUpdateTask,
  onRequestTasks,
  openComposerOnMount = false,
  onComposerOpened,
  onScroll,
}: {
  tasks: TodoTask[];
  projects: ProductionProject[];
  campaigns?: Campaign[];
  creators?: Influencer[];
  role?: "Brand" | "Influencer";
  onToggleTask: (id: string) => void;
  onOpenTask?: (task: TodoTask) => void;
  onAddTask: (draft: TodoTaskDraft) => void;
  onUpdateTask: (id: string, changes: Partial<TodoTask>) => void;
  onRequestTasks?: (range: { from: string; to: string }) => void;
  openComposerOnMount?: boolean;
  onComposerOpened?: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const todayKey = toDateKey(new Date());
  const [cursor, setCursor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState(todayKey);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTime, setDraftTime] = useState(() => getCurrentTaskTime());
  const [draftTimeBaseline, setDraftTimeBaseline] = useState(() => getCurrentTaskTime());
  const [draftNotes, setDraftNotes] = useState("");
  const [draftLink, setDraftLink] = useState("");
  const [draftAttachments, setDraftAttachments] = useState<DemoAttachment[]>(
    [],
  );
  const [draftReminder, setDraftReminder] = useState(false);
  const [draftReminderSettings, setDraftReminderSettings] =
    useState<ReminderSettings>({
      soundEnabled: true,
      vibrationEnabled: true,
      soundTone: "default",
    });
  const [reminderSettingsOpen, setReminderSettingsOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [draftProjectId, setDraftProjectId] = useState<string | undefined>();
  const [draftStage, setDraftStage] = useState<ProductionStage | undefined>();
  const [draftCampaignId, setDraftCampaignId] = useState<string | undefined>();
  const [draftCreatorId, setDraftCreatorId] = useState<string | undefined>();
  const [draftKind, setDraftKind] = useState<"task" | "video-brief">("task");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [taskFilter, setTaskFilter] = useState<"all" | "open" | "done">("all");
  const [taskQuery, setTaskQuery] = useState("");
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long" }).format(
    cursor,
  );
  useEffect(() => {
    onRequestTasks?.({
      from: `${year}-${pad(month + 1)}-01`,
      to: `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`,
    });
  }, [month, year]);
  const taskDates = useMemo(
    () => new Set(tasks.map((task) => normalizeDateKey(task.dueDate))),
    [tasks],
  );
  const calendarDays = useMemo(() => {
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstDay }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [month, year]);
  const monthTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const date = fromDateKey(task.dueDate);
        return date.getFullYear() === year && date.getMonth() === month;
      }),
    [month, tasks, year],
  );
  const filteredTasks = tasks.filter((task) => {
    const matchesStatus =
      taskFilter === "all"
        ? true
        : taskFilter === "done"
          ? task.completed
          : !task.completed;
    const searchValue =
      `${task.title} ${task.owner} ${task.notes}`.toLowerCase();
    return (
      matchesStatus &&
      (!taskQuery.trim() ||
        searchValue.includes(taskQuery.trim().toLowerCase()))
    );
  });
  const selectedTasks = filteredTasks
    .filter((task) => normalizeDateKey(task.dueDate) === selectedDate)
    .slice(0, MAX_VISIBLE_TASKS);
  const completedCount = tasks.filter((task) => task.completed).length;
  const openCount = tasks.length - completedCount;
  const upcomingTasks = [...filteredTasks]
    .filter((task) => normalizeDateKey(task.dueDate) >= todayKey)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, MAX_VISIBLE_TASKS);
  const moveMonth = (delta: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = new Date(year, month + delta, 1);
    setCursor(next);
    setSelectedDate(toDateKey(next));
  };
  const selectDate = (date: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedDate(date);
  };
  const openTaskComposer = (kind: "task" | "video-brief" = "task") => {
    setEditingTaskId(null);
    setDraftDate(selectedDate);
    setDraftTitle("");
    const currentTime = getCurrentTaskTime();
    setDraftTime(currentTime);
    setDraftTimeBaseline(currentTime);
    setDraftNotes("");
    setDraftLink("");
    setDraftAttachments([]);
    setDraftReminder(false);
    setDraftReminderSettings({
      soundEnabled: true,
      vibrationEnabled: true,
      soundTone: "default",
    });
    setDraftProjectId(undefined);
    setDraftStage(undefined);
    setDraftCampaignId(undefined);
    setDraftCreatorId(undefined);
    setDraftKind(kind);
    setFormError("");
    setComposerOpen(true);
  };
  useEffect(() => {
    if (!openComposerOnMount) return;
    const frame = requestAnimationFrame(() => {
      openTaskComposer("task");
      onComposerOpened?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [openComposerOnMount, onComposerOpened]);
  const openTaskEditor = (task: TodoTask) => {
    setEditingTaskId(task.id);
    const taskDate = normalizeDateKey(task.dueDate);
    setSelectedDate(taskDate);
    setDraftDate(taskDate);
    setDraftTitle(task.title);
    setDraftTime(task.dueTime);
    setDraftTimeBaseline(task.dueTime);
    setDraftNotes(task.notes);
    setDraftLink(task.links?.[0] ?? "");
    setDraftAttachments(task.attachments ?? []);
    setDraftReminder(task.reminderEnabled);
    setDraftReminderSettings({
      soundEnabled: task.reminderTone !== "silent",
      vibrationEnabled: true,
      soundTone: task.reminderTone,
    });
    setDraftProjectId(task.projectId);
    setDraftStage(task.stage);
    setDraftCampaignId(task.campaignId);
    setDraftCreatorId(task.creatorId);
    setDraftKind(task.kind ?? "task");
    setFormError("");
    setComposerOpen(true);
  };
  const closeTaskComposer = () => {
    setCloseConfirmOpen(false);
    setComposerOpen(false);
    setFormError("");
  };
  const openReminderSettings = () => {
    setReminderSettingsOpen(true);
  };
  const toggleDraftReminder = (enabled: boolean) => {
    setDraftReminder(enabled);
  };
  const hasTaskDraftData = Boolean(
    editingTaskId ||
      draftTitle.trim() ||
      draftNotes.trim() ||
      draftLink.trim() ||
      draftAttachments.length ||
      draftReminder ||
      draftProjectId ||
      draftStage ||
      draftCampaignId ||
      draftCreatorId ||
      draftDate !== selectedDate ||
      draftTime !== draftTimeBaseline,
  );
  const requestCloseTaskComposer = () => {
    if (hasTaskDraftData) {
      setCloseConfirmOpen(true);
      return;
    }
    closeTaskComposer();
  };
  const addTaskMedia = async () => {
    try {
      const items = await selectMediaAttachment();
      if (items[0]) setDraftAttachments((current) => [...current, items[0]]);
    } catch {
      setFormError("Media could not be attached. Please try again.");
    }
  };
  const addTaskFile = async () => {
    try {
      const item = await selectFileAttachment();
      if (item) setDraftAttachments((current) => [...current, item]);
    } catch {
      setFormError("File could not be attached. Please try again.");
    }
  };
  const submitTask = () => {
    const title = draftTitle.trim();
    const dueTime = draftTime.trim();
    if (!title) {
      setFormError("Add a title so this task is easy to find.");
      return;
    }
    if (!dueTime) {
      setFormError("Add a time or use Anytime.");
      return;
    }
    if (!isValidDateInput(draftDate)) {
      setFormError("Choose a valid task date.");
      return;
    }
    if (dueTime.toLowerCase() !== "anytime" && !isValidTimeInput(dueTime)) {
      setFormError("Use HH:MM, h:MM AM/PM, or Anytime.");
      return;
    }
    if (draftReminder && dueTime.toLowerCase() !== "anytime") {
      const reminderAt = parseReminderDateTime(draftDate, dueTime);
      if (!reminderAt || reminderAt <= Date.now()) {
        setFormError("Choose a future time before enabling this reminder.");
        return;
      }
    }
    const link = draftLink.trim();
    if (link && !/^https?:\/\/\S+$/i.test(link)) {
      setFormError("Enter a complete link starting with http:// or https://.");
      return;
    }
    const draft: TodoTaskDraft = {
      title,
      dueDate: draftDate,
      dueTime,
      notes: draftNotes.trim(),
      links: link ? [link] : [],
      attachments: draftAttachments,
      reminderEnabled: draftReminder,
      reminderTone: draftReminderSettings.soundTone,
      projectId: draftProjectId,
      stage: draftStage,
      campaignId: draftCampaignId,
      creatorId: draftCreatorId,
      kind: draftKind,
    };
    setSelectedDate(draftDate);
    if (editingTaskId) onUpdateTask(editingTaskId, draft);
    else onAddTask(draft);
    closeTaskComposer();
  };
  const confirmSaveAndClose = () => {
    setCloseConfirmOpen(false);
    submitTask();
  };

  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.page}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.calendarSection}>
        <AppCard style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <View style={styles.monthCopy}>
              <Text style={styles.monthTitle}>{monthLabel}</Text>
              <Text style={styles.monthYear}>{year}</Text>
            </View>
            <Pill
              label={`${monthTasks.length} task${monthTasks.length === 1 ? "" : "s"}`}
              accent
            />
          </View>
          <View style={styles.monthControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => moveMonth(-1)}
              style={({ pressed }) => [
                styles.monthArrow,
                pressed && styles.pressed,
              ]}
            >
              <AppIcon
                name="chevron-back"
                size={18}
                color={theme.colors.primary}
              />
            </Pressable>
            <Text style={styles.monthHint}>Tap a date to view tasks</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() => moveMonth(1)}
              style={({ pressed }) => [
                styles.monthArrow,
                pressed && styles.pressed,
              ]}
            >
              <AppIcon
                name="chevron-forward"
                size={18}
                color={theme.colors.primary}
              />
            </Pressable>
          </View>
          <View style={styles.calendarContent}>
            <>
              <View style={styles.weekdayRow}>
                {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                  <Text key={`${day}-${index}`} style={styles.weekday}>
                    {day}
                  </Text>
                ))}
              </View>
              <View style={styles.calendarGrid}>
                {calendarDays.map((day, index) => {
                  if (!day)
                    return (
                      <View
                        key={`empty-${index}`}
                        style={styles.dayCellPlaceholder}
                      />
                    );
                  const date = `${year}-${pad(month + 1)}-${pad(day)}`;
                  const hasTasks = taskDates.has(date);
                  const selected = selectedDate === date;
                  const today = todayKey === date;
                  const dayBackgroundColor = selected
                    ? theme.colors.accent
                    : hasTasks
                      ? theme.colors.primary
                      : today
                        ? theme.colors.surfaceSky
                        : theme.colors.surfaceRaised;
                  const darkTaskDate = !selected && hasTasks;
                  return (
                    <Pressable
                      key={date}
                      accessibilityRole="button"
                      accessibilityLabel={`${formatDateLabel(date)}${hasTasks ? ", has tasks" : ""}${today ? ", today" : ""}`}
                      accessibilityState={{ selected }}
                      onPress={() => selectDate(date)}
                      style={({ pressed }) => [
                        styles.dayCell,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.dayCircle,
                          {
                            backgroundColor: dayBackgroundColor,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumber,
                            darkTaskDate
                              ? styles.dayNumberOnPrimary
                              : (today || selected || hasTasks) &&
                                styles.dayNumberEmphasis,
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          </View>
        </AppCard>
      </View>

      <View style={styles.contentSection}>
        <ConsistencyChart
          tasks={tasks}
          inset={false}
          onPress={() => selectDate(todayKey)}
        />
      </View>

      <AppCard style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View style={styles.sectionCopy}>
            <Text style={styles.progressTitle}>Task progress</Text>
            <Text style={styles.progressSubtitle}>
              {openCount
                ? `${openCount} open task${openCount === 1 ? "" : "s"}`
                : "Everything is complete"}
            </Text>
          </View>
          <Pill label={`${completedCount}/${tasks.length}`} accent />
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0}%`,
              },
            ]}
          />
        </View>
      </AppCard>

      <View style={styles.contentSection}>
        <SearchField
          value={taskQuery}
          onChangeText={setTaskQuery}
          placeholder="Search tasks, notes or owner"
          accessibilityLabel="Search tasks"
        />
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>
              Tasks for {formatDateLabel(selectedDate)}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {selectedTasks.length
                ? `${selectedTasks.length} planned task${selectedTasks.length === 1 ? "" : "s"}`
                : "Nothing scheduled yet"}
            </Text>
          </View>
          {selectedDate === todayKey ? <Pill label="Today" accent /> : null}
        </View>
        <View style={styles.taskList}>
          {selectedTasks.length ? (
            selectedTasks.map((task, index) => (
              <TodoTaskCard
                key={task.id}
                task={task}
                index={index}
                onToggle={() => onToggleTask(task.id)}
                onOpen={onOpenTask ? () => onOpenTask(task) : undefined}
                onEdit={() => openTaskEditor(task)}
              />
            ))
          ) : (
            <TodoTaskEmptyState title="No tasks for this date" message="Choose another date or add a task." />
          )}
        </View>
      </View>

      <View style={styles.contentSection}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Upcoming tasks</Text>
            <Text style={styles.sectionSubtitle}>
              Keep the next steps visible.
            </Text>
          </View>
          <Pill
            label={`${upcomingTasks.length}${upcomingTasks.length === MAX_VISIBLE_TASKS ? "+" : ""} shown`}
          />
        </View>
        <View style={styles.filterRow}>
          {(
            [
              ["all", "All"],
              ["open", "Open"],
              ["done", "Done"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`Show ${label.toLowerCase()} tasks`}
              accessibilityState={{ selected: taskFilter === value }}
              onPress={() => setTaskFilter(value)}
              style={({ pressed }) => [
                styles.filterChip,
                taskFilter === value && styles.filterChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  taskFilter === value && styles.filterChipTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.upcomingList}>
          {upcomingTasks.length ? (
            upcomingTasks.map((task, index) => (
              <TodoTaskCard
                key={task.id}
                task={task}
                index={index}
                showDate
                onToggle={() => onToggleTask(task.id)}
                onOpen={onOpenTask ? () => onOpenTask(task) : undefined}
                onEdit={() => openTaskEditor(task)}
              />
            ))
          ) : (
            <TodoTaskEmptyState title="No matching tasks" message="Try another filter or add a task." icon="time-outline" />
          )}
        </View>
      </View>
      <Modal
        visible={composerOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={requestCloseTaskComposer}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={requestCloseTaskComposer} />
          <View
            style={[
              styles.taskModal,
              { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.sectionCopy}>
                <Text style={styles.modalTitle}>
                  {editingTaskId
                    ? draftKind === "video-brief"
                      ? "Edit video brief"
                      : "Edit task"
                    : draftKind === "video-brief"
                      ? "New video brief"
                      : "New task"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {formatDateLabel(draftDate)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close task editor"
                onPress={requestCloseTaskComposer}
                style={({ pressed }) => [
                  styles.modalClose,
                  pressed && styles.pressed,
                ]}
              >
                <AppIcon
                  name="close"
                  size={20}
                  color={theme.colors.textPrimary}
                />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalContent}
            >
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Title</Text>
                <TextInput
                  accessibilityLabel="Task title"
                  value={draftTitle}
                  onChangeText={(value) => {
                    setDraftTitle(value);
                    setFormError("");
                  }}
                  onFocus={() => setFocusedField("title")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="What needs to get done?"
                  placeholderTextColor={theme.colors.inputPlaceholder}
                  returnKeyType="next"
                  style={[
                    styles.formInput,
                    focusedField === "title" && styles.formInputFocused,
                  ]}
                />
              </View>
              <View style={styles.formRow}>
                <DateTimeField
                  label="Date"
                  value={draftDate}
                  mode="date"
                  onChange={(value) => {
                    setDraftDate(value);
                    setFormError("");
                  }}
                  style={styles.formHalf}
                />
                <DateTimeField
                  label="Time"
                  value={draftTime}
                  mode="time"
                  onChange={(value) => {
                    setDraftTime(value);
                    setFormError("");
                  }}
                  placeholder="Choose time"
                  style={styles.formHalf}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {draftKind === "video-brief" ? "Brief notes" : "Task notes"}
                </Text>
                <TextInput
                  accessibilityLabel="Task notes"
                  value={draftNotes}
                  onChangeText={setDraftNotes}
                  onFocus={() => setFocusedField("notes")}
                  onBlur={() => setFocusedField(null)}
                  placeholder={
                    draftKind === "video-brief"
                      ? "Add creative direction, references, and deliverables"
                      : "Add task context and completion notes"
                  }
                  placeholderTextColor={theme.colors.inputPlaceholder}
                  multiline
                  textAlignVertical="top"
                  style={[
                    styles.formInput,
                    styles.notesInput,
                    focusedField === "notes" && styles.formInputFocused,
                  ]}
                />
              </View>
              {projects.length ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Production project</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.choiceRow}
                  >
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityLabel="No linked project"
                      accessibilityState={{ selected: !draftProjectId }}
                      onPress={() => {
                        setDraftProjectId(undefined);
                        setDraftStage(undefined);
                      }}
                      style={[
                        styles.choiceChip,
                        !draftProjectId && styles.choiceChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          !draftProjectId && styles.choiceTextActive,
                        ]}
                      >
                        No project
                      </Text>
                    </Pressable>
                    {projects
                      .filter((project) => !project.archived)
                      .map((project) => (
                        <Pressable
                          key={project.id}
                          accessibilityRole="radio"
                          accessibilityLabel={`Link task to ${project.title}`}
                          accessibilityState={{
                            selected: draftProjectId === project.id,
                          }}
                          onPress={() => {
                            setDraftProjectId(project.id);
                            setDraftStage(project.currentStage);
                          }}
                          style={[
                            styles.choiceChip,
                            draftProjectId === project.id &&
                              styles.choiceChipActive,
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.choiceText,
                              draftProjectId === project.id &&
                                styles.choiceTextActive,
                            ]}
                          >
                            {project.title}
                          </Text>
                        </Pressable>
                      ))}
                  </ScrollView>
                  {draftProjectId ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.choiceRow}
                    >
                      {PRODUCTION_STAGES.map((stage) => (
                        <Pressable
                          key={stage}
                          accessibilityRole="radio"
                          accessibilityLabel={`Assign task to ${stage} stage`}
                          accessibilityState={{
                            selected: draftStage === stage,
                          }}
                          onPress={() => setDraftStage(stage)}
                          style={[
                            styles.choiceChip,
                            draftStage === stage && styles.choiceChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.choiceText,
                              draftStage === stage && styles.choiceTextActive,
                            ]}
                          >
                            {stage}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
              ) : null}
              {role === "Brand" && campaigns.length ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Campaign</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.choiceRow}
                  >
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityLabel="No linked campaign"
                      accessibilityState={{ selected: !draftCampaignId }}
                      onPress={() => setDraftCampaignId(undefined)}
                      style={[
                        styles.choiceChip,
                        !draftCampaignId && styles.choiceChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          !draftCampaignId && styles.choiceTextActive,
                        ]}
                      >
                        No campaign
                      </Text>
                    </Pressable>
                    {campaigns
                      .filter((campaign) => !campaign.archived)
                      .map((campaign) => (
                        <Pressable
                          key={campaign.id}
                          accessibilityRole="radio"
                          accessibilityLabel={`Link brief to ${campaign.title}`}
                          accessibilityState={{
                            selected: draftCampaignId === campaign.id,
                          }}
                          onPress={() => setDraftCampaignId(campaign.id)}
                          style={[
                            styles.choiceChip,
                            draftCampaignId === campaign.id &&
                              styles.choiceChipActive,
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.choiceText,
                              draftCampaignId === campaign.id &&
                                styles.choiceTextActive,
                            ]}
                          >
                            {campaign.title}
                          </Text>
                        </Pressable>
                      ))}
                  </ScrollView>
                </View>
              ) : null}
              {role === "Brand" && creators.length ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Creator</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.choiceRow}
                  >
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityLabel="No linked creator"
                      accessibilityState={{ selected: !draftCreatorId }}
                      onPress={() => setDraftCreatorId(undefined)}
                      style={[
                        styles.choiceChip,
                        !draftCreatorId && styles.choiceChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          !draftCreatorId && styles.choiceTextActive,
                        ]}
                      >
                        No creator
                      </Text>
                    </Pressable>
                    {creators.map((creator) => (
                      <Pressable
                        key={creator.id}
                        accessibilityRole="radio"
                        accessibilityLabel={`Link brief to ${creator.name}`}
                        accessibilityState={{
                          selected: draftCreatorId === creator.id,
                        }}
                        onPress={() => setDraftCreatorId(creator.id)}
                        style={[
                          styles.choiceChip,
                          draftCreatorId === creator.id &&
                            styles.choiceChipActive,
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.choiceText,
                            draftCreatorId === creator.id &&
                              styles.choiceTextActive,
                          ]}
                        >
                          {creator.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Link</Text>
                <TextInput
                  accessibilityLabel="Task link"
                  value={draftLink}
                  onChangeText={setDraftLink}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder="https://..."
                  placeholderTextColor={theme.colors.inputPlaceholder}
                  style={styles.formInput}
                />
              </View>
              <View style={styles.formRow}>
                <AppButton
                  label="Add media"
                  icon="image-outline"
                  variant="secondary"
                  onPress={() => void addTaskMedia()}
                  style={styles.formHalf}
                />
                <AppButton
                  label="Add file"
                  icon="document-outline"
                  variant="secondary"
                  onPress={() => void addTaskFile()}
                  style={styles.formHalf}
                />
              </View>
              {draftAttachments.length ? (
                <Text style={styles.reminderHint}>
                  {draftAttachments.map((item) => item.name).join(" · ")}
                </Text>
              ) : null}
              <View style={styles.reminderCard}>
                <View style={styles.reminderCopy}>
                  <View style={styles.reminderTitleRow}>
                    <AppIcon
                      name="alarm-outline"
                      size={18}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.fieldLabel}>Reminder</Text>
                  </View>
                  <Text style={styles.reminderHint}>
                    {draftReminder
                      ? "Use settings to choose sound and vibration."
                      : "Add an alert to this task."}
                  </Text>
                </View>
                <View style={styles.reminderActions}>
                  {draftReminder ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Open reminder sound and vibration settings"
                      hitSlop={8}
                      onPress={openReminderSettings}
                      style={({ pressed }) => [
                        styles.reminderSettingsButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <AppIcon
                        name="settings-outline"
                        size={14}
                        color={theme.colors.primary}
                      />
                    </Pressable>
                  ) : null}
                  <Toggle
                    value={draftReminder}
                    onChange={toggleDraftReminder}
                    accessibilityLabel="Enable task reminder"
                  />
                </View>
              </View>
              {formError ? (
                <Text style={styles.formError}>{formError}</Text>
              ) : null}
              <View style={styles.modalActions}>
                <AppButton
                  label="Cancel"
                  variant="secondary"
                  onPress={requestCloseTaskComposer}
                  style={styles.modalAction}
                />
                <AppButton
                  label={editingTaskId ? "Update task" : "Save task"}
                  icon="checkmark"
                  onPress={submitTask}
                  style={styles.modalAction}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <ReminderSettingsSheet
        visible={reminderSettingsOpen}
        title="Task reminder"
        detail="Choose the alert sound and vibration for this task."
        campaignTitle={draftTitle.trim() || "New task"}
        participantName="This task"
        deliveryDate={draftDate}
        deliveryTime={draftTime}
        settings={draftReminderSettings}
        onChange={setDraftReminderSettings}
        onClose={() => setReminderSettingsOpen(false)}
        onSave={() => {
          setReminderSettingsOpen(false);
        }}
        enabled={draftReminder}
        onEnabledChange={setDraftReminder}
      />
      <ConfirmModal
        visible={closeConfirmOpen}
        title="Save before closing?"
        message="You have task details filled in. Save this task before leaving?"
        confirmLabel={editingTaskId ? "Save changes" : "Save task"}
        cancelLabel="Keep editing"
        onCancel={() => setCloseConfirmOpen(false)}
        onConfirm={confirmSaveAndClose}
        tertiaryLabel="Discard changes"
        tertiaryIcon="trash-outline"
        tertiaryDestructive
        onTertiary={closeTaskComposer}
      />
    </ScrollView>
  );
}

const makeStyles = (theme: AppTheme) =>
  createThemeStyles(theme, {
    screen: { flex: 1, backgroundColor: theme.colors.transparent },
    page: {
      backgroundColor: theme.colors.transparent,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xxl + theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    calendarSection: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
    },
    calendarCard: {
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceSky,
    },
    calendarHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    monthCopy: { flex: 1, gap: 2 },
    monthTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      lineHeight: theme.type.lineHeight.title,
      fontWeight: "900",
      fontFamily: theme.type.displayFont,
    },
    monthYear: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.body,
      fontFamily: theme.type.bodyFont,
    },
    monthControls: {
      height: 32,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    monthArrow: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.control,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    monthHint: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      textAlign: "center",
      fontFamily: theme.type.bodyFont,
    },
    calendarContent: { gap: theme.spacing.sm },
    weekdayRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.xs,
    },
    weekday: {
      width: "14.2857%",
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontWeight: "800",
      textAlign: "center",
      fontFamily: theme.type.bodyFont,
    },
    calendarGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 2,
    },
    dayCell: {
      width: "14.2857%",
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    dayCellPlaceholder: { width: "14.2857%", height: 32 },
    dayCircle: {
      width: 30,
      height: 30,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceRaised,
    },
    dayNumber: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.body,
      fontWeight: "700",
      fontFamily: theme.type.bodyFont,
    },
    dayNumberEmphasis: { color: theme.colors.primary },
    dayNumberOnPrimary: { color: theme.colors.primaryText },
    progressCard: {
      marginHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceLilac,
    },
    progressHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    progressTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "800",
      fontFamily: theme.type.bodyFont,
    },
    progressSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontFamily: theme.type.bodyFont,
    },
    progressTrack: {
      height: 8,
      borderRadius: theme.radius.pill,
      overflow: "hidden",
      backgroundColor: theme.colors.border,
    },
    progressFill: {
      height: "100%",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.secondary,
    },
    filterRow: {
      flexDirection: "row",
      gap: theme.spacing.xs,
    },
    filterChip: {
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceRaised,
    },
    filterChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.accent,
    },
    filterChipText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontWeight: "700",
      fontFamily: theme.type.bodyFont,
    },
    filterChipTextActive: { color: theme.colors.primary },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.colors.overlay,
    },
    taskModal: {
      maxHeight: "92%",
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      backgroundColor: theme.colors.surfaceRaised,
      ...theme.shadows.modal,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    modalTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      fontWeight: "900",
      fontFamily: theme.type.displayFont,
    },
    modalSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontFamily: theme.type.bodyFont,
    },
    modalClose: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    modalContent: {
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    fieldGroup: { gap: theme.spacing.xs },
    fieldLabel: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.caption,
      fontWeight: "800",
      fontFamily: theme.type.bodyFont,
    },
    formRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    formHalf: { flex: 1, minWidth: 0 },
    choiceRow: { gap: theme.spacing.xs, paddingRight: theme.spacing.sm },
    choiceChip: {
      minHeight: 40,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surfaceMuted,
    },
    choiceChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.accent,
    },
    choiceText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontWeight: "700",
      fontFamily: theme.type.bodyFont,
    },
    choiceTextActive: { color: theme.colors.primary },
    datePicker: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    datePickerField: { flex: 1, minWidth: 0 },
    dateAdjust: {
      width: 32,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.control,
      backgroundColor: theme.colors.surfaceMuted,
    },
    formInput: {
      minHeight: 48,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.inputBackground,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.control,
      paddingHorizontal: theme.spacing.md,
      fontSize: theme.type.body,
      fontFamily: theme.type.bodyFont,
    },
    formInputFocused: {
      borderColor: theme.colors.focus,
      backgroundColor: theme.colors.surfaceRaised,
    },
    notesInput: {
      minHeight: 82,
      paddingTop: theme.spacing.sm,
    },
    readOnlyField: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      borderRadius: theme.radius.control,
      backgroundColor: theme.colors.surfaceMuted,
    },
    readOnlyText: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.type.caption,
      fontFamily: theme.type.bodyFont,
    },
    reminderCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    reminderCopy: { flex: 1, minWidth: 0, gap: theme.spacing.xs },
    reminderTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    reminderSettingsButton: {
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceRaised,
    },
    reminderActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    reminderHint: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontFamily: theme.type.bodyFont,
    },
    formError: {
      color: theme.colors.danger,
      fontSize: theme.type.caption,
      fontWeight: "700",
      fontFamily: theme.type.bodyFont,
    },
    modalActions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    modalAction: { flex: 1 },
    contentSection: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    sectionCopy: { flex: 1, minWidth: 0, gap: 2 },
    sectionTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      lineHeight: theme.type.lineHeight.title,
      fontWeight: "800",
      fontFamily: theme.type.displayFont,
    },
    sectionSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontFamily: theme.type.bodyFont,
    },
    taskList: { gap: theme.spacing.sm },
    streakCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceLilac,
    },
    streakIcon: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.accent,
    },
    streakCopy: { flex: 1, minWidth: 0, gap: 2 },
    streakTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "800",
      fontFamily: theme.type.bodyFont,
    },
    streakBody: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: theme.type.lineHeight.caption,
      fontFamily: theme.type.bodyFont,
    },
    streakValue: {
      color: theme.colors.primary,
      fontSize: theme.type.display,
      fontWeight: "900",
      fontFamily: theme.type.displayFont,
    },
    upcomingList: { gap: theme.spacing.sm },
    pressed: { opacity: 0.78 },
  });
