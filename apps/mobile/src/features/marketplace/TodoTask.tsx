import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { AppCard, AppIcon, NATIVE_ANIMATIONS_ENABLED, Pill } from "../../components/ui";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import { TodoTask } from "../../types/marketplace";
import { taskDateKey, taskDateKeyFromDate } from "../../lib/tasks";
import { parseReminderDateTime } from "../../lib/reminders";
import { getReminderToneLabel } from "../../lib/reminderTones";

export function getTaskReminderLabel(task: Pick<TodoTask, "dueDate" | "dueTime" | "reminderAt" | "reminderEnabled" | "reminderTone">) {
  if (!task.reminderEnabled) return "Off";
  const reminderAt = task.reminderAt ? Date.parse(task.reminderAt) : Number.NaN;
  // Use a fixed early reference so a reminder snoozed after the original due
  // time still compares against the task's original date/time.
  const taskDueAt = parseReminderDateTime(task.dueDate, task.dueTime, 0) ?? Number.NaN;
  if (Number.isFinite(reminderAt) && Number.isFinite(taskDueAt) && Math.abs(reminderAt - taskDueAt) > 1_000) {
    const minutes = Math.max(1, Math.ceil((reminderAt - Date.now()) / 60_000));
    return `Snoozed · ${minutes}m`;
  }
  return getReminderToneLabel(task.reminderTone);
}

export function TodoTaskRow({
  task,
  onToggle,
  onOpen,
  onEdit,
  showDate = false,
  variant = "default",
  index,
}: {
  task: TodoTask;
  onToggle: () => void;
  onOpen?: () => void;
  onEdit?: () => void;
  showDate?: boolean;
  variant?: "default" | "workflow";
  index?: number;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [rowWidth, setRowWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const cardProgress = useRef(new Animated.Value(task.completed ? 1 : 0)).current;
  const strikeProgress = useRef(new Animated.Value(task.completed ? 1 : 0)).current;
  const contentProgress = useRef(new Animated.Value(task.completed ? 1 : 0)).current;
  const sweepProgress = useRef(new Animated.Value(0)).current;
  const sweepOpacity = useRef(new Animated.Value(0)).current;
  const rippleProgress = useRef(new Animated.Value(0)).current;
  const previousCompleted = useRef(task.completed);
  const taskToneStyles = [styles.taskToneSky, styles.taskToneMint, styles.taskToneBlush, styles.taskToneButter];
  const taskTone = taskToneStyles[(index ?? 0) % taskToneStyles.length];

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (previousCompleted.current === task.completed) return;
    previousCompleted.current = task.completed;

    if (reduceMotion) {
      cardProgress.setValue(task.completed ? 1 : 0);
      strikeProgress.setValue(task.completed ? 1 : 0);
      contentProgress.setValue(task.completed ? 1 : 0);
      sweepProgress.setValue(0);
      sweepOpacity.setValue(0);
      rippleProgress.setValue(0);
      return;
    }

    if (!task.completed) {
      sweepProgress.setValue(0);
      sweepOpacity.setValue(0);
      rippleProgress.setValue(0);
      const animation = Animated.parallel([
        Animated.timing(cardProgress, { toValue: 0, duration: 220, useNativeDriver: NATIVE_ANIMATIONS_ENABLED }),
        Animated.timing(strikeProgress, { toValue: 0, duration: 180, useNativeDriver: false }),
        Animated.timing(contentProgress, { toValue: 0, duration: 220, useNativeDriver: NATIVE_ANIMATIONS_ENABLED }),
      ]);
      animation.start();
      return () => animation.stop();
    }

    cardProgress.setValue(0);
    strikeProgress.setValue(0);
    contentProgress.setValue(0);
    sweepProgress.setValue(0);
    sweepOpacity.setValue(0);
    rippleProgress.setValue(0);

    const animation = Animated.parallel([
      Animated.sequence([
        Animated.delay(60),
        Animated.timing(cardProgress, { toValue: 1, duration: 420, useNativeDriver: NATIVE_ANIMATIONS_ENABLED }),
      ]),
      Animated.sequence([
        Animated.delay(155),
        Animated.timing(strikeProgress, { toValue: 1, duration: 240, useNativeDriver: false }),
      ]),
      Animated.sequence([
        Animated.delay(55),
        Animated.timing(contentProgress, { toValue: 1, duration: 500, useNativeDriver: NATIVE_ANIMATIONS_ENABLED }),
      ]),
      Animated.sequence([
        Animated.delay(70),
        Animated.timing(sweepOpacity, { toValue: 0.55, duration: 120, useNativeDriver: NATIVE_ANIMATIONS_ENABLED }),
        Animated.parallel([
          Animated.timing(sweepProgress, { toValue: 1, duration: 340, useNativeDriver: NATIVE_ANIMATIONS_ENABLED }),
          Animated.timing(sweepOpacity, { toValue: 0, duration: 250, useNativeDriver: NATIVE_ANIMATIONS_ENABLED }),
        ]),
      ]),
      Animated.sequence([
        Animated.timing(rippleProgress, { toValue: 1, duration: 110, useNativeDriver: NATIVE_ANIMATIONS_ENABLED }),
        Animated.timing(rippleProgress, { toValue: 0, duration: 230, useNativeDriver: NATIVE_ANIMATIONS_ENABLED }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [cardProgress, contentProgress, reduceMotion, rippleProgress, strikeProgress, sweepOpacity, sweepProgress, task.completed]);

  const sweepWidth = Math.max(rowWidth * 0.72, 180);
  const sweepDistance = Math.max(rowWidth, 320);
  const contentOpacity = contentProgress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [1, 0.92, 0.97],
  });
  const contentOffset = contentProgress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 1, 0],
  });
  const completionLayers = (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.taskCompletionTint,
          { opacity: cardProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.14] }) },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.taskCompletionSweep,
          {
            width: sweepWidth,
            opacity: sweepOpacity,
            transform: [
              {
                translateX: sweepProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-sweepWidth, sweepDistance],
                }),
              },
            ],
          },
        ]}
      />
    </>
  );
  const checkControl = (
    <TodoCompletionCheckbox
      completed={task.completed}
      label={`Mark ${task.title} ${task.completed ? "open" : "complete"}`}
      onPress={onToggle}
      rippleProgress={rippleProgress}
    />
  );

  if (variant === "workflow") {
    return (
      <Animated.View
        onLayout={(event) => {
          const nextWidth = Math.round(event.nativeEvent.layout.width);
          if (nextWidth !== rowWidth) setRowWidth(nextWidth);
        }}
        style={[styles.workflowRow, taskTone, { opacity: contentOpacity, transform: [{ translateY: contentOffset }] }]}
      >
        {completionLayers}
        <View style={[styles.workflowNumber, task.completed && styles.workflowNumberDone]}>
          <Text style={styles.workflowNumberText}>{index ?? 1}</Text>
        </View>
        <Pressable
          accessibilityRole={onOpen ? "button" : undefined}
          accessibilityLabel={onOpen ? `Open task ${task.title}` : task.title}
          onPress={onOpen}
          style={({ pressed }) => [styles.workflowCopy, pressed && styles.pressed]}
        >
          <TodoAnimatedTitle title={task.title} completed={task.completed} strikeProgress={strikeProgress} styles={styles} />
          <Text style={styles.taskMeta}>{task.owner} · Due {task.dueTime}</Text>
        </Pressable>
        <Pill label={task.completed ? "Done" : "Open"} accent={task.completed} />
        {checkControl}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth !== rowWidth) setRowWidth(nextWidth);
      }}
      style={[styles.taskRow, taskTone, { opacity: contentOpacity, transform: [{ translateY: contentOffset }] }]}
    >
      {completionLayers}
      {showDate ? (
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeText}>{Number(task.dueDate.slice(-2))}</Text>
        </View>
      ) : (
        checkControl
      )}
      <Pressable accessibilityRole={onOpen ? "button" : "checkbox"} accessibilityLabel={onOpen ? `Open task ${task.title}` : `${task.title}, ${task.owner}, ${task.dueTime}`} accessibilityState={onOpen ? undefined : { checked: task.completed }} onPress={onOpen ?? onToggle} style={({ pressed }) => [styles.taskCopy, pressed && styles.pressed]}>
        <TodoAnimatedTitle title={task.title} completed={task.completed} strikeProgress={strikeProgress} styles={styles} />
        <Text style={styles.taskMeta}>{task.owner} · {task.dueTime}{task.reminderEnabled ? ` · ${getTaskReminderLabel(task)}` : ""}</Text>
        {task.notes ? <Text numberOfLines={1} style={styles.taskNotes}>{task.notes}</Text> : null}
      </Pressable>
      <View style={styles.taskActions}>
        {onEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit task ${task.title}`}
            onPress={onEdit}
            hitSlop={6}
            style={({ pressed }) => [styles.taskEditButton, pressed && styles.pressed]}
          >
            <AppIcon name="create-outline" size={16} color={theme.colors.textSecondary} />
          </Pressable>
        ) : null}
        {task.reminderEnabled ? (
          <View style={styles.reminderBadge}>
            <AppIcon name="alarm-outline" size={14} color={theme.colors.primary} />
          </View>
        ) : null}
        {onOpen ? <AppIcon name="chevron-forward" size={18} color={theme.colors.textSecondary} /> : null}
        {showDate ? checkControl : null}
      </View>
    </Animated.View>
  );
}

export function TodoTaskCard({
  task,
  onToggle,
  onOpen,
  onEdit,
  showDate = false,
  variant = "default",
  index,
}: {
  task: TodoTask;
  onToggle: () => void;
  onOpen?: () => void;
  onEdit?: () => void;
  showDate?: boolean;
  variant?: "default" | "workflow";
  index?: number;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const taskToneStyles = [styles.todoCardSky, styles.todoCardMint, styles.todoCardBlush, styles.todoCardButter];
  return (
    <AppCard style={[styles.todoCard, taskToneStyles[(index ?? 0) % taskToneStyles.length]]}>
      <TodoTaskRow
        task={task}
        onToggle={onToggle}
        onOpen={onOpen}
        onEdit={onEdit}
        showDate={showDate}
        variant={variant}
        index={index}
      />
    </AppCard>
  );
}

export function TodoTaskEmptyState({
  title,
  message,
  icon = "calendar-outline",
}: {
  title: string;
  message: string;
  icon?: "calendar-outline" | "time-outline" | "checkmark-circle-outline";
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <AppCard style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <AppIcon name={icon} size={18} color={theme.colors.primary} />
      </View>
      <View style={styles.emptyCopy}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.emptyText}>{message}</Text>
      </View>
    </AppCard>
  );
}

export function TodoCompletionCheckbox({
  completed,
  label,
  onPress,
  rippleProgress,
  interactive = true,
}: {
  completed: boolean;
  label: string;
  onPress?: () => void;
  rippleProgress?: Animated.Value;
  interactive?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const completionProgress = useRef(new Animated.Value(completed ? 1 : 0)).current;
  const checkProgress = useRef(new Animated.Value(completed ? 1 : 0)).current;
  const previousCompleted = useRef(completed);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (previousCompleted.current === completed) return;
    previousCompleted.current = completed;

    if (reduceMotion) {
      completionProgress.setValue(completed ? 1 : 0);
      checkProgress.setValue(completed ? 1 : 0);
      return;
    }

    if (!completed) {
      const animation = Animated.parallel([
        Animated.timing(checkProgress, { toValue: 0, duration: 90, useNativeDriver: NATIVE_ANIMATIONS_ENABLED }),
        Animated.timing(completionProgress, { toValue: 0, duration: 150, useNativeDriver: NATIVE_ANIMATIONS_ENABLED }),
      ]);
      animation.start();
      return () => animation.stop();
    }

    completionProgress.setValue(0);
    checkProgress.setValue(0);
    const animation = Animated.parallel([
      Animated.spring(completionProgress, {
        toValue: 1,
        mass: 0.7,
        damping: 16,
        stiffness: 260,
        useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
      }),
      Animated.sequence([
        Animated.delay(45),
        Animated.spring(checkProgress, {
          toValue: 1,
          mass: 0.55,
          damping: 13,
          stiffness: 300,
          useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
        }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [checkProgress, completed, completionProgress, reduceMotion]);

  const checkContents = (
    <>
      {rippleProgress ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.taskCheckRipple,
            {
              opacity: rippleProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.24] }),
              transform: [{ scale: rippleProgress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.34] }) }],
            },
          ]}
        />
      ) : null}
      <View style={styles.taskCheck}>
        <Animated.View pointerEvents="none" style={styles.taskCheckShape}>
          <TodoOrganicShape color={theme.colors.accent} styles={styles} />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.taskCheckShape,
            {
              opacity: completionProgress,
              transform: [{ scale: completionProgress.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) }],
            },
          ]}
        >
          <TodoOrganicShape color={theme.colors.success} styles={styles} />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.taskCheckMark,
            {
              opacity: checkProgress,
              transform: [
                { scale: checkProgress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.taskCheckStroke,
              styles.taskCheckStrokeShort,
              { transform: [{ rotate: "45deg" }, { scaleX: checkProgress }] },
            ]}
          />
          <Animated.View
            style={[
              styles.taskCheckStroke,
              styles.taskCheckStrokeLong,
              { transform: [{ rotate: "-45deg" }, { scaleX: checkProgress }] },
            ]}
          />
        </Animated.View>
      </View>
    </>
  );

  if (!interactive) {
    return <View accessibilityRole="image" accessibilityLabel={label} style={styles.taskCheckReadOnly}>{checkContents}</View>;
  }

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: completed }}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.taskCheckHit, pressed && styles.pressed]}
    >
      {checkContents}
    </Pressable>
  );
}

function TodoOrganicShape({
  color,
  styles,
}: {
  color: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  const blob = { backgroundColor: color };
  return (
    <>
      <View style={[styles.taskCheckBlob, styles.taskCheckBlobCore, blob]} />
      <View style={[styles.taskCheckBlob, styles.taskCheckBlobTop, blob]} />
      <View style={[styles.taskCheckBlob, styles.taskCheckBlobUpperRight, blob]} />
      <View style={[styles.taskCheckBlob, styles.taskCheckBlobRight, blob]} />
      <View style={[styles.taskCheckBlob, styles.taskCheckBlobLowerRight, blob]} />
      <View style={[styles.taskCheckBlob, styles.taskCheckBlobBottom, blob]} />
      <View style={[styles.taskCheckBlob, styles.taskCheckBlobLowerLeft, blob]} />
      <View style={[styles.taskCheckBlob, styles.taskCheckBlobLeft, blob]} />
      <View style={[styles.taskCheckBlob, styles.taskCheckBlobUpperLeft, blob]} />
    </>
  );
}

function TodoAnimatedTitle({
  title,
  completed,
  strikeProgress,
  styles,
}: {
  title: string;
  completed: boolean;
  strikeProgress: Animated.Value;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [titleWidth, setTitleWidth] = useState(0);
  return (
    <View style={styles.taskTitleWrap}>
      <Text
        numberOfLines={1}
        onTextLayout={(event) => {
          const nextWidth = event.nativeEvent.lines[0]?.width ?? 0;
          if (nextWidth !== titleWidth) setTitleWidth(nextWidth);
        }}
        style={[styles.taskTitle, completed && styles.taskTitleCompleted]}
      >
        {title}
      </Text>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.taskTitleStrikeClip,
          {
            width: strikeProgress.interpolate({ inputRange: [0, 1], outputRange: [0, titleWidth] }),
          },
        ]}
      >
        <View style={styles.taskTitleStrikeLine} />
      </Animated.View>
    </View>
  );
}

export function TodoTaskPanel({
  tasks,
  onToggleTask,
  onOpenTask,
  onOpenCalendar,
  onCreateTask,
}: {
  tasks: TodoTask[];
  onToggleTask: (id: string) => void;
  onOpenTask?: (task: TodoTask) => void;
  onOpenCalendar: () => void;
  onCreateTask?: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const todayTasks = tasks.filter((task) => taskDateKey(task.dueDate) === taskDateKeyFromDate(new Date()));
  const visibleTasks = todayTasks.slice(0, 3);
  const remaining = todayTasks.filter((task) => !task.completed).length;
  return (
    <View style={styles.panelSection}>
      <View style={styles.panelHeader}>
        <View style={styles.panelTitleCopy}>
          <Text numberOfLines={1} style={styles.panelTitle}>Today&apos;s tasks</Text>
          <Text numberOfLines={1} style={styles.panelSubtitle}>
            {todayTasks.length ? (remaining ? "Continue your tasks" : "All tasks complete") : "No tasks planned for today"}
          </Text>
        </View>
        <View style={styles.panelActions}>
          <Pill label={`${todayTasks.length} tasks`} accent style={styles.taskCountPill} />
          {onCreateTask ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create task"
              onPress={onCreateTask}
              style={({ pressed }) => [styles.panelIconButton, pressed && styles.pressed]}
            >
              <AppIcon name="add" size={18} color={theme.colors.primary} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open calendar"
            onPress={onOpenCalendar}
            style={({ pressed }) => [styles.panelLink, pressed && styles.pressed]}
          >
            <Text style={styles.panelLinkText}>Calendar</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.taskList}>
        {visibleTasks.length ? (
          visibleTasks.map((task, index) => (
            <TodoTaskCard
              key={task.id}
              task={task}
              index={index}
              onToggle={() => onToggleTask(task.id)}
              onOpen={onOpenTask ? () => onOpenTask(task) : undefined}
            />
          ))
        ) : (
          <TodoTaskEmptyState title="Your day is clear" message="No tasks planned for today." />
          )}
      </View>
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  createThemeStyles(theme, {
    panelSection: {
      gap: theme.spacing.sm,
      marginHorizontal: theme.spacing.lg,
    },
    panelHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    panelTitleCopy: { flex: 1, minWidth: 0, justifyContent: "center", gap: 2 },
    panelTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      fontWeight: "800",
      fontFamily: theme.type.bodyFont,
    },
    panelSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontFamily: theme.type.bodyFont,
    },
    panelActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      flexShrink: 0,
      height: 36,
    },
    panelIconButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceRaised,
    },
    panelLink: {
      minHeight: 36,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceRaised,
    },
    taskCountPill: {
      width: 72,
      height: 36,
      minHeight: 36,
      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 0,
    },
    panelLinkText: {
      color: theme.colors.primary,
      fontSize: theme.type.caption,
      fontWeight: "700",
      fontFamily: theme.type.bodyFont,
    },
    taskList: { gap: theme.spacing.sm },
    emptyCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      minHeight: 58,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceSky,
      borderWidth: 0,
    },
    emptyIcon: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceRaised,
    },
    emptyCopy: { flex: 1, minWidth: 0, gap: 2 },
    emptyTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "800",
      fontFamily: theme.type.bodyFont,
    },
    todoCard: { padding: 0, overflow: "hidden", backgroundColor: theme.colors.surfaceRaised },
    todoCardSky: { backgroundColor: theme.colors.surfaceSky },
    todoCardMint: { backgroundColor: theme.colors.surfaceMint },
    todoCardBlush: { backgroundColor: theme.colors.surfaceBlush },
    todoCardButter: { backgroundColor: theme.colors.surfaceButter },
    taskToneSky: { backgroundColor: theme.colors.surfaceSky },
    taskToneMint: { backgroundColor: theme.colors.surfaceMint },
    taskToneBlush: { backgroundColor: theme.colors.surfaceBlush },
    taskToneButter: { backgroundColor: theme.colors.surfaceButter },
    taskCompletionTint: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: theme.colors.surfaceMint,
    },
    taskCompletionSweep: {
      position: "absolute",
      top: 0,
      bottom: 0,
      backgroundColor: theme.colors.surfaceMint,
    },
    taskRow: {
      minHeight: 68,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surfaceRaised,
      overflow: "hidden",
      position: "relative",
    },
    taskCopy: { flex: 1, minWidth: 0, gap: 2 },
    taskTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "700",
      fontFamily: theme.type.bodyFont,
    },
    taskTitleCompleted: {
      color: theme.colors.textSecondary,
    },
    taskTitleWrap: {
      width: "100%",
      position: "relative",
    },
    taskTitleStrikeClip: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      overflow: "hidden",
    },
    taskTitleStrikeLine: {
      position: "absolute",
      top: "56%",
      left: 0,
      right: 0,
      height: 2,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.textSecondary,
    },
    taskMeta: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: theme.type.lineHeight.caption,
      fontFamily: theme.type.bodyFont,
    },
    taskNotes: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: theme.type.lineHeight.caption,
      fontFamily: theme.type.bodyFont,
    },
    taskActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: theme.spacing.xs,
    },
    taskEditButton: {
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    taskCheckHit: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    taskCheckReadOnly: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    taskCheckRipple: {
      position: "absolute",
      width: 32,
      height: 32,
      borderRadius: theme.radius.pill,
      borderWidth: 2,
      borderColor: theme.colors.success,
      backgroundColor: theme.colors.surfaceMint,
    },
    reminderBadge: {
      width: 28,
      height: 28,
      borderRadius: theme.radius.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.accent,
    },
    taskCheck: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    taskCheckShape: {
      position: "absolute",
      top: 0,
      left: 0,
      width: 32,
      height: 32,
    },
    taskCheckBlob: {
      position: "absolute",
      borderRadius: theme.radius.pill,
    },
    taskCheckBlobCore: {
      left: 3,
      top: 3,
      width: 26,
      height: 26,
      borderRadius: 0,
      borderTopLeftRadius: 11,
      borderTopRightRadius: 10,
      borderBottomRightRadius: 12,
      borderBottomLeftRadius: 10,
    },
    taskCheckBlobTop: {
      left: 10,
      top: 0,
      width: 12,
      height: 9,
    },
    taskCheckBlobUpperRight: {
      right: 3,
      top: 3,
      width: 9,
      height: 9,
    },
    taskCheckBlobRight: {
      right: 0,
      top: 11,
      width: 9,
      height: 10,
    },
    taskCheckBlobLowerRight: {
      right: 3,
      bottom: 3,
      width: 9,
      height: 9,
    },
    taskCheckBlobBottom: {
      left: 10,
      bottom: 0,
      width: 12,
      height: 9,
    },
    taskCheckBlobLowerLeft: {
      left: 3,
      bottom: 3,
      width: 9,
      height: 9,
    },
    taskCheckBlobLeft: {
      left: 0,
      top: 11,
      width: 9,
      height: 10,
    },
    taskCheckBlobUpperLeft: {
      left: 3,
      top: 3,
      width: 9,
      height: 9,
    },
    taskCheckMark: {
      width: 22,
      height: 22,
      marginTop: 2,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    taskCheckStroke: {
      position: "absolute",
      height: 3,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.successText,
    },
    taskCheckStrokeShort: {
      width: 8,
      left: 2,
      top: 10,
    },
    taskCheckStrokeLong: {
      width: 13,
      left: 7,
      top: 6,
    },
    workflowRow: {
      minHeight: 76,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surfaceRaised,
      overflow: "hidden",
      position: "relative",
    },
    workflowNumber: {
      width: 34,
      height: 34,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceButter,
    },
    workflowNumberDone: { backgroundColor: theme.colors.surfaceMint },
    workflowNumberText: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "800",
      fontFamily: theme.type.bodyFont,
    },
    workflowCopy: { flex: 1, minWidth: 0, gap: 2 },
    taskAccent: {
      width: 8,
      height: 8,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accent,
    },
    dateBadge: {
      width: 34,
      height: 34,
      borderRadius: theme.radius.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.accent,
    },
    dateBadgeText: {
      color: theme.colors.accentText,
      fontSize: theme.type.body,
      fontWeight: "800",
      fontFamily: theme.type.bodyFont,
    },
    emptyText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: theme.type.lineHeight.caption,
      fontFamily: theme.type.bodyFont,
    },
    pressed: { opacity: 0.78 },
  });
