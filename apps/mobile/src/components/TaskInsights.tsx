import { useEffect, useRef, useState } from "react";
import { Image as ExpoImage } from "expo-image";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon, NATIVE_ANIMATIONS_ENABLED } from "./ui";
import { useTheme } from "../providers/ThemeProvider";
import { AppTheme } from "../styles/theme";
import { createThemeStyles } from "../styles/createThemeStyles";
import { ContentIdea, DemoProposal, TodoTask } from "../types/marketplace";
import { getDailyStreak } from "../lib/streak";

const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const addDays = (source: Date, amount: number) => {
  const next = new Date(source);
  next.setDate(source.getDate() + amount);
  return next;
};

const shortDay = new Intl.DateTimeFormat("en-IN", { weekday: "short" });

export function HomeTaskOverview({
  tasks,
  ideas,
  proposals,
}: {
  tasks: TodoTask[];
  ideas: ContentIdea[];
  proposals: DemoProposal[];
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const today = new Date();
  const todayKey = dateKey(today);
  const openTasks = tasks.filter((task) => !task.completed);
  const activeIdeas = ideas.filter((idea) => !idea.archived);
  const readyIdeas = activeIdeas.filter((idea) => Boolean(idea.sourceUrl || idea.attachment));
  const paidIdeas = proposals.filter((proposal) => proposal.status === "Completed");
  const inProgress = openTasks.filter((task) => task.dueDate <= todayKey).length;
  const pendingTasks = openTasks.filter((task) => task.dueDate > todayKey).length;

  return (
    <View style={[styles.section, styles.sectionInset]}>
      <View style={styles.sectionHeader}>
        <View style={styles.copy}>
          <Text style={styles.title}>Saved Ideas to Paid Ideas</Text>
          <Text style={styles.subtitle}>Keep inspiration moving toward finished work.</Text>
        </View>
        <Text style={styles.metric}>{activeIdeas.length}</Text>
      </View>
      <View style={styles.ideaRow}>
        <View style={[styles.ideaStep, styles.ideaStepSaved]}>
          <Text style={styles.stepValue}>{activeIdeas.length}</Text>
          <Text style={styles.stepLabel}>Saved ideas</Text>
        </View>
        <AppIcon name="arrow-forward" size={18} color={theme.colors.primary} />
        <View style={[styles.ideaStep, styles.ideaStepPaid]}>
          <Text style={styles.stepValue}>{paidIdeas.length}</Text>
          <Text style={styles.stepLabel}>Paid work</Text>
        </View>
      </View>
      <View style={styles.statusRow}>
        <StatusCell label="In progress" value={inProgress} tone="lilac" styles={styles} />
        <StatusCell label="Ready to publish" value={readyIdeas.length} tone="sky" styles={styles} />
        <StatusCell label="Pending tasks" value={pendingTasks} tone="blush" styles={styles} />
      </View>
    </View>
  );
}

function StatusCell({
  label,
  value,
  tone,
  styles,
}: {
  label: string;
  value: number;
  tone: "lilac" | "sky" | "blush";
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={[styles.statusCell, tone === "lilac" ? styles.statusLilac : tone === "sky" ? styles.statusSky : styles.statusBlush]}>
      <Text style={styles.statusValue}>{value}</Text>
      <Text numberOfLines={2} style={styles.statusLabel}>{label}</Text>
    </View>
  );
}

export function WeeklyPlanner({ tasks, onOpenTask }: { tasks: TodoTask[]; onOpenTask?: (task: TodoTask) => void }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const days = Array.from({ length: 7 }, (_, index) => addDays(new Date(), index));
  return (
    <View style={[styles.section, styles.sectionInset, styles.plannerPanel]}>
      <View style={styles.sectionHeader}>
        <View style={styles.copy}>
          <Text style={styles.title}>Weekly planner</Text>
          <Text style={styles.subtitle}>Your next seven days from Calendar.</Text>
        </View>
        <Text style={styles.metric}>{tasks.filter((task) => !task.completed).length}</Text>
      </View>
      <View style={styles.weekRow}>
        {days.map((day, index) => {
          const key = dateKey(day);
          const dayTasks = tasks.filter((task) => task.dueDate === key);
          const completed = dayTasks.filter((task) => task.completed).length;
          const isToday = key === dateKey(new Date());
          return (
            <Pressable
              key={key}
              accessibilityRole={dayTasks.length ? "button" : undefined}
              accessibilityLabel={dayTasks.length ? `Open tasks for ${shortDay.format(day)}` : undefined}
              disabled={!dayTasks.length || !onOpenTask}
              onPress={() => dayTasks[0] && onOpenTask?.(dayTasks[0])}
              style={({ pressed }) => [styles.weekCell, isToday && styles.weekCellToday, pressed && styles.pressed]}
            >
              <Text style={[styles.weekDay, isToday && styles.weekDayToday]}>{shortDay.format(day).slice(0, 2)}</Text>
              <Text style={[styles.weekDate, isToday && styles.weekDateToday]}>{day.getDate()}</Text>
              <View style={styles.weekDotRow}>
                {dayTasks.length ? <View style={[styles.weekDot, completed === dayTasks.length && styles.weekDotDone]} /> : <View style={styles.weekDotEmpty} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ConsistencyChart({ tasks, onPress, inset = true }: { tasks: TodoTask[]; onPress?: () => void; inset?: boolean }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const days = Array.from({ length: 7 }, (_, index) => addDays(new Date(), index - 6));
  const streak = getDailyStreak(tasks);
  const completedDays = days.filter((day) => streak.completedDays.has(dateKey(day))).length;
  const content = (
    <>
      <View style={styles.sectionHeader}>
        <View style={styles.copy}>
          <Text style={styles.title}>Consistency chart</Text>
          <Text style={styles.subtitle}>{completedDays}/7 days with a completed task.</Text>
        </View>
        <StreakMetric value={streak.current} styles={styles} useDownloadedFlame />
      </View>
      <View style={styles.chartRow}>
        {days.map((day) => {
          const completed = streak.completedDays.has(dateKey(day));
          return (
            <View key={dateKey(day)} style={styles.chartColumn}>
              <View style={styles.chartTrack}>
                <View style={[styles.chartBar, completed ? styles.chartBarMint : styles.chartBarLilac, { height: completed ? "100%" : "8%" }]} />
              </View>
              <Text style={styles.chartLabel}>{shortDay.format(day).slice(0, 1)}</Text>
            </View>
          );
        })}
      </View>
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel="Open consistency activity in Calendar" onPress={onPress} style={({ pressed }) => [styles.section, inset && styles.sectionInset, styles.chartPanel, pressed && styles.pressed]}>
      {content}
    </Pressable>
  ) : <View style={[styles.section, inset && styles.sectionInset, styles.chartPanel]}>{content}</View>;
}

function StreakMetric({
  value,
  styles,
  useDownloadedFlame,
}: {
  value: number;
  styles: ReturnType<typeof makeStyles>;
  useDownloadedFlame: boolean;
}) {
  const { theme } = useTheme();
  const flameFlicker = useRef(new Animated.Value(0)).current;
  const igniteMotion = useRef(new Animated.Value(0)).current;
  const countMotion = useRef(new Animated.Value(0)).current;
  const previousValue = useRef<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      flameFlicker.stopAnimation();
      flameFlicker.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(flameFlicker, {
          toValue: 1,
          duration: 360,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
        }),
        Animated.timing(flameFlicker, {
          toValue: -0.45,
          duration: 180,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
        }),
        Animated.timing(flameFlicker, {
          toValue: 0.7,
          duration: 150,
          easing: Easing.out(Easing.quad),
          useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
        }),
        Animated.timing(flameFlicker, {
          toValue: -0.8,
          duration: 190,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
        }),
        Animated.timing(flameFlicker, {
          toValue: 0,
          duration: 290,
          easing: Easing.out(Easing.quad),
          useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [flameFlicker, reduceMotion]);

  useEffect(() => {
    const previous = previousValue.current;
    previousValue.current = value;
    if (previous === null || reduceMotion) return;

    countMotion.stopAnimation();
    countMotion.setValue(0);
    const countAnimation = Animated.sequence([
      Animated.timing(countMotion, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
      }),
      Animated.timing(countMotion, {
        toValue: 0,
        duration: 180,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
      }),
    ]);
    countAnimation.start();

    if (value <= previous) {
      return () => countAnimation.stop();
    }

    igniteMotion.stopAnimation();
    igniteMotion.setValue(0);
    const igniteAnimation = Animated.sequence([
      Animated.timing(igniteMotion, {
        toValue: -0.35,
        duration: 70,
        easing: Easing.in(Easing.quad),
        useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
      }),
      Animated.timing(igniteMotion, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
      }),
      Animated.timing(igniteMotion, {
        toValue: 0,
        duration: 260,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
      }),
    ]);
    igniteAnimation.start();
    return () => {
      countAnimation.stop();
      igniteAnimation.stop();
    };
  }, [countMotion, igniteMotion, reduceMotion, value]);

  const flickerIntensity = value > 0 ? 1 : 0.25;

  return (
    <View style={styles.streakMetric} accessibilityLabel={`${value} day consistency streak`}>
      <Animated.Text
        style={[
          styles.streakMetricValue,
          {
            opacity: countMotion.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
            transform: [{ scale: countMotion.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] }) }],
          },
        ]}
      >
        {value}
      </Animated.Text>
      <View style={styles.streakFlame}>
        {useDownloadedFlame ? <ExpoImage source={require("../../assets/fire-streak.gif")} contentFit="contain" style={styles.streakFlameAsset} accessibilityLabel="Fire streak" /> : <Animated.View
          style={{
            transform: [
              { translateX: flameFlicker.interpolate({ inputRange: [-1, 0, 1], outputRange: [-1 * flickerIntensity, 0, flickerIntensity] }) },
              { translateY: flameFlicker.interpolate({ inputRange: [-1, 0, 1], outputRange: [1 * flickerIntensity, 0, -3 * flickerIntensity] }) },
              { rotate: flameFlicker.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-2deg", "0deg", "2deg"] }) },
              { scale: flameFlicker.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.94, 1, 1.05] }) },
            ],
            opacity: flameFlicker.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.72 + (0.16 * flickerIntensity), 0.82 + (0.18 * flickerIntensity), 0.78 + (0.18 * flickerIntensity)] }),
          }}
        >
          <Animated.View
            style={{
              transform: [
                { translateY: igniteMotion.interpolate({ inputRange: [-0.35, 0, 1], outputRange: [0, 0, -3] }) },
                { scale: igniteMotion.interpolate({ inputRange: [-0.35, 0, 1], outputRange: [0.94, 1, 1.18] }) },
              ],
            }}
          >
            <AppIcon name="flame-sharp" size={20} color={theme.colors.warning} />
          </Animated.View>
        </Animated.View>
        }
      </View>
    </View>
  );
}

const makeStyles = (theme: AppTheme) => createThemeStyles(theme, {
  section: {
    gap: Math.min(theme.spacing.sm, 12),
    minWidth: 0,
    alignSelf: "stretch",
    padding: Math.min(theme.spacing.md, 16),
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    backgroundColor: theme.colors.surfaceLilac,
  },
  sectionInset: { marginHorizontal: Math.min(theme.spacing.lg, 24) },
  plannerPanel: { backgroundColor: theme.colors.surfaceSky },
  chartPanel: { backgroundColor: theme.colors.surfaceBlush, overflow: "hidden" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: Math.min(theme.spacing.sm, 12), minWidth: 0 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, fontWeight: "800", fontFamily: theme.type.bodyFont },
  subtitle: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
  metric: { color: theme.colors.primary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  streakMetric: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, minWidth: 50, flexShrink: 0, justifyContent: "flex-end" },
  streakMetricValue: { minWidth: 22, color: theme.colors.warning, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.displayFont, textAlign: "right" },
  streakFlame: { width: 32, height: 32, borderRadius: theme.radius.pill, alignItems: "center", justifyContent: "center" },
  streakFlameAsset: { width: 30, height: 30, shadowColor: theme.colors.textPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 3, elevation: 3 },
  ideaRow: { width: "100%", minWidth: 0, flexDirection: "row", alignItems: "center", gap: Math.min(theme.spacing.xs, 4) },
  ideaStep: { flex: 1, flexBasis: 0, minWidth: 0, minHeight: 56, justifyContent: "center", gap: 2, paddingHorizontal: Math.min(theme.spacing.sm, 12), borderRadius: theme.radius.control },
  ideaStepSaved: { backgroundColor: theme.colors.surfaceRaised },
  ideaStepPaid: { backgroundColor: theme.colors.surfaceSky },
  stepValue: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  stepLabel: { flexShrink: 1, color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
  statusRow: { width: "100%", minWidth: 0, flexDirection: "row", gap: Math.min(theme.spacing.xs, 4) },
  statusCell: { flex: 1, flexBasis: 0, minWidth: 0, minHeight: 62, justifyContent: "center", gap: 2, padding: Math.min(theme.spacing.sm, 8), borderRadius: theme.radius.control },
  statusLilac: { backgroundColor: theme.colors.surfaceLilac },
  statusSky: { backgroundColor: theme.colors.surfaceSky },
  statusBlush: { backgroundColor: theme.colors.surfaceBlush },
  statusValue: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  statusLabel: { flexShrink: 1, color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
  weekRow: { width: "100%", minWidth: 0, flexDirection: "row", gap: Math.min(theme.spacing.xs, 4) },
  weekCell: { flex: 1, flexBasis: 0, minWidth: 0, minHeight: 72, alignItems: "center", justifyContent: "center", gap: 2, borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceRaised },
  weekCellToday: { backgroundColor: theme.colors.accent },
  weekDay: { color: theme.colors.textSecondary, fontSize: 10, fontWeight: "700" },
  weekDayToday: { color: theme.colors.primary },
  weekDate: { color: theme.colors.textPrimary, fontSize: theme.type.body, fontWeight: "800" },
  weekDateToday: { color: theme.colors.primary },
  weekDotRow: { height: 8, justifyContent: "center" },
  weekDot: { width: 7, height: 7, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primary },
  weekDotDone: { backgroundColor: theme.colors.success },
  weekDotEmpty: { width: 5, height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.border },
  chartRow: { width: "100%", minWidth: 0, height: 80, flexDirection: "row", alignItems: "flex-end", gap: Math.min(theme.spacing.xs, 4) },
  chartColumn: { flex: 1, flexBasis: 0, minWidth: 0, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: Math.min(theme.spacing.xs, 4) },
  chartTrack: { width: "100%", maxWidth: 28, height: 56, justifyContent: "flex-end", overflow: "hidden", borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceRaised },
  chartBar: { width: "100%", minHeight: 6, borderRadius: theme.radius.pill },
  chartBarSky: { backgroundColor: theme.colors.secondary },
  chartBarMint: { backgroundColor: theme.colors.success },
  chartBarLilac: { backgroundColor: theme.colors.primary },
  chartLabel: { color: theme.colors.textSecondary, fontSize: 10, fontWeight: "700" },
  pressed: { opacity: 0.82 },
});
