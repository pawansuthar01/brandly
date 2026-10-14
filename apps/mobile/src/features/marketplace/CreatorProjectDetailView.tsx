import { Image as ExpoImage } from "expo-image";
import { useEffect, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton, AppCard, AppIcon, DateTimeField, Pill } from "../../components/ui";
import { getCompletedStageCount, getNextStage, getProjectStageData, getStageStatus } from "../../lib/productionWorkflow";
import { formatDisplayDate } from "../../lib/dateTime";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import {
  IdeaStageData,
  PRODUCTION_STAGES,
  ProductionProject,
  ProductionStage,
  ProductionStagePayload,
  PublishedStageData,
  ScheduledStageData,
} from "../../types/marketplace";
import { ProductionStageForm } from "./ProductionStageForm";
import { CreatorProjectDetailsOverview } from "./CreatorProjectDetailsOverview";
import { CreatorContentBlock } from "./CreatorContentBlock";
import { CreatorProjectMediaView } from "./CreatorProjectMediaView";
import { TodoCompletionCheckbox } from "./TodoTask";

const statusLabel: Record<ReturnType<typeof getStageStatus>, string> = {
  locked: "Locked",
  current: "Current",
  draft: "Draft",
  completed: "Completed",
};

type Props = {
  project: ProductionProject;
  isSaving?: boolean;
  onBack: () => void;
  onSaveStageDraft: (id: string, stage: ProductionStage, data: ProductionStagePayload) => void;
  onCompleteStage: (id: string, stage: ProductionStage, data: ProductionStagePayload) => void;
  onUpdateProject: (id: string, changes: Partial<Omit<ProductionProject, "id" | "ideaId" | "workflowSteps" | "stageData" | "validationErrors" | "currentStage" | "createdAt">>) => void;
};

export function CreatorProjectDetailView({ project, isSaving = false, onBack, onSaveStageDraft, onCompleteStage, onUpdateProject }: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const [selectedStage, setSelectedStage] = useState<ProductionStage>(project.currentStage);
  const [stageFormOpen, setStageFormOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [stageMessage, setStageMessage] = useState("");
  const [dueDate, setDueDate] = useState(project.dueDate ?? "");
  const [assignedTo, setAssignedTo] = useState(project.assignedTo);
  const stageData = getProjectStageData(project);
  const completedCount = getCompletedStageCount(project);
  const progress = Math.round((completedCount / PRODUCTION_STAGES.length) * 100);
  const selectedStatus = getStageStatus(project, selectedStage);
  const scheduledData = project.stageData?.Scheduled as ScheduledStageData | undefined;
  const publishedData = project.stageData?.Published as PublishedStageData | undefined;

  useEffect(() => {
    setDueDate(project.dueDate ?? "");
    setAssignedTo(project.assignedTo);
  }, [project.assignedTo, project.dueDate, project.id]);

  const openSource = async () => {
    const source = project.sourceUrl ?? (stageData.Idea as IdeaStageData | undefined)?.referenceUrl;
    if (!source) return;
    try {
      if (await Linking.canOpenURL(source)) await Linking.openURL(source);
    } catch {
      setStageMessage("This source link is unavailable right now.");
    }
  };

  const selectStage = (stage: ProductionStage) => {
    const status = getStageStatus(project, stage);
    if (status === "locked") {
      const previous = PRODUCTION_STAGES[Math.max(0, PRODUCTION_STAGES.indexOf(stage) - 1)];
      setStageMessage(`Complete ${previous} first.`);
      return;
    }
    setSelectedStage(stage);
    setStageFormOpen(true);
    setStageMessage("");
  };

  const handleComplete = (data: ProductionStagePayload) => {
    onCompleteStage(project.id, selectedStage, data);
    const next = getNextStage(selectedStage);
    setSelectedStage(next ?? selectedStage);
    setStageFormOpen(false);
    setStageMessage(next ? `${selectedStage} completed. ${next} is now unlocked.` : "Published information saved. This project is complete.");
  };

  if (overviewOpen) {
    return <CreatorProjectDetailsOverview project={project} onBack={() => setOverviewOpen(false)} />;
  }
  if (mediaOpen) {
    return <CreatorProjectMediaView project={project} onBack={() => setMediaOpen(false)} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to projects" onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <AppIcon name="arrow-back" size={19} color={theme.colors.textPrimary} />
        <Text style={styles.backText}>Projects</Text>
      </Pressable>

      <AppCard style={styles.heroCard}>
        <View style={styles.heroRow}>
          {project.attachment?.type === "image" && project.attachment.uri ? (
            <ExpoImage source={project.attachment.uri} contentFit="cover" style={styles.thumbnail} accessibilityLabel={`${project.title} thumbnail`} />
          ) : (
            <View style={styles.thumbnailPlaceholder}><AppIcon name={project.attachment?.type === "video" ? "videocam-outline" : project.attachment?.type === "file" ? "document-text-outline" : "videocam-outline"} size={24} color={theme.colors.primary} /></View>
          )}
          <View style={styles.heroCopy}>
            <View style={styles.metaRow}><Pill label={project.currentStage} accent /><Pill label={`${progress}% complete`} /></View>
            <Text style={styles.title}>{project.title}</Text>
            <Text style={styles.description}>{project.description || "No description added yet."}</Text>
            <View style={styles.metaRow}><Pill label={project.platform} /><Text style={styles.metaText}>Created {formatDisplayDate(project.createdAt)}</Text></View>
          </View>
        </View>
      </AppCard>

      <View style={styles.summaryGrid}>
        <AppCard style={styles.summaryCard}><Text style={styles.label}>Due date</Text><Text style={styles.summaryValue}>{scheduledData?.scheduledDate || project.dueDate || project.reminderDate || "Not set"}</Text></AppCard>
        <AppCard style={styles.summaryCard}><Text style={styles.label}>Assigned to</Text><Text style={styles.summaryValue}>{project.assignedTo || "Not assigned"}</Text></AppCard>
      </View>

      <View style={styles.sectionHeader}>
        <View style={styles.flex}><Text style={styles.sectionTitle}>Production timeline</Text><Text style={styles.sectionSubtitle}>{completedCount} of {PRODUCTION_STAGES.length} stages complete</Text></View>
        <Text style={styles.progressText}>{progress}%</Text>
      </View>
      <View style={styles.quickActions}>
        <AppButton label="View all details" icon="document-text-outline" compact variant="secondary" onPress={() => setOverviewOpen(true)} style={styles.quickAction} />
        <AppButton label="Project media" icon="images-outline" compact variant="secondary" onPress={() => setMediaOpen(true)} style={styles.quickAction} />
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
      <AppCard style={styles.timelineCard}>
        {PRODUCTION_STAGES.map((stage, index) => {
          const status = getStageStatus(project, stage);
          const locked = status === "locked";
          const isCurrent = status === "current" || status === "draft";
          return (
            <Pressable
              key={stage}
              accessibilityRole="button"
              accessibilityLabel={`${stage} production stage${locked ? ", locked" : `, ${statusLabel[status].toLowerCase()}`}`}
              accessibilityState={{ disabled: locked, selected: selectedStage === stage }}
              onPress={() => selectStage(stage)}
              style={({ pressed }) => [styles.timelineRow, index < PRODUCTION_STAGES.length - 1 && styles.timelineRowBorder, locked && styles.timelineRowLocked, pressed && !locked && styles.pressed]}
            >
              <View style={[styles.timelineMarker, status === "completed" && styles.timelineMarkerCompleted, isCurrent && styles.timelineMarkerCurrent, locked && styles.timelineMarkerLocked]}>
                {status === "completed" ? <TodoCompletionCheckbox completed label={`${stage} completed`} interactive={false} /> : <AppIcon name={isCurrent ? "play" : "lock-closed-outline"} size={15} color={isCurrent ? theme.colors.primaryText : theme.colors.textSecondary} />}
              </View>
              <View style={styles.flex}><Text style={[styles.stageTitle, isCurrent && styles.stageTitleCurrent, locked && styles.stageTitleLocked]}>{stage}</Text><Text style={styles.stageState}>{statusLabel[status]}</Text></View>
              {selectedStage === stage && !locked ? <Pill label="Open" accent={isCurrent} /> : null}
            </Pressable>
          );
        })}
      </AppCard>
      {stageMessage ? <Text accessibilityLiveRegion="polite" style={styles.stageMessage}>{stageMessage}</Text> : null}

      <View style={styles.sectionHeader}><View style={styles.flex}><Text style={styles.sectionTitle}>Project details</Text><Text style={styles.sectionSubtitle}>Shared context and saved information, shown as readable content blocks.</Text></View></View>
      <View style={styles.detailsSection}>
        <Text style={styles.detailSectionTitle}>Project context</Text>
        <CreatorContentBlock label="Platform" value={project.platform} />
        <CreatorContentBlock label="Current stage" value={project.currentStage} />
        <CreatorContentBlock label="Budget / rate" value={project.budget} />
        <CreatorContentBlock label="Reminder date" value={project.reminderDate} />
        <CreatorContentBlock label="Shoot location" value={project.shootLocation} />
        <CreatorContentBlock label="Equipment" value={project.equipment} />
        {project.sourceUrl || (stageData.Idea as IdeaStageData | undefined)?.referenceUrl ? <CreatorContentBlock label="Video / source link" linkLabel="Open video / source link" onOpenLink={() => void openSource()} /> : <CreatorContentBlock label="Video / source link" />}
      </View>
      {publishedData ? <View style={styles.detailsSection}>
        <Text style={styles.detailSectionTitle}>Published result</Text>
        <CreatorContentBlock label="Published status" value={publishedData.status || "Published"} />
        <CreatorContentBlock label="Published date and time" value={`${publishedData.publishedDate} · ${publishedData.publishedTime}`} />
        <CreatorContentBlock label="Final platform" value={publishedData.platform} />
        <CreatorContentBlock label="Final notes" value={publishedData.finalNotes} />
        {publishedData.publishedUrl ? <CreatorContentBlock label="Published URL" linkLabel="Open published result" onOpenLink={() => void Linking.openURL(publishedData.publishedUrl).catch(() => undefined)} /> : null}
      </View> : null}

      <Modal visible={stageFormOpen && selectedStatus !== "locked"} transparent animationType="slide" onRequestClose={() => setStageFormOpen(false)}>
        <View style={styles.stageModalOverlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close stage details" onPress={() => setStageFormOpen(false)} style={styles.stageModalBackdrop} />
          <View style={[styles.stageSheet, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
            <View style={styles.stageModalHeader}>
              <View style={styles.flex}><Text style={styles.stageModalTitle}>{selectedStage}</Text><Text style={styles.sectionSubtitle}>Edit this stage, save a draft, or complete it to unlock the next step.</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close stage details" onPress={() => setStageFormOpen(false)} style={({ pressed }) => [styles.stageClose, pressed && styles.pressed]}><AppIcon name="close" size={20} color={theme.colors.textPrimary} /></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.stageModalContent}>
              <ProductionStageForm
                key={`${project.id}-${selectedStage}-${selectedStatus}`}
                stage={selectedStage}
                data={stageData[selectedStage]}
                validationErrors={project.validationErrors?.[selectedStage]}
                isSaving={isSaving}
                onSaveDraft={(data) => {
                  onSaveStageDraft(project.id, selectedStage, data);
                  setStageMessage(`${selectedStage} draft saved.`);
                }}
                onComplete={handleComplete}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={styles.sectionHeader}><View style={styles.flex}><Text style={styles.sectionTitle}>Edit assignment</Text><Text style={styles.sectionSubtitle}>Due date and ownership stay independent from stage data.</Text></View></View>
      <AppCard style={styles.editCard}>
        <DateTimeField label="Due date" value={dueDate} onChange={setDueDate} mode="date" placeholder="Choose due date" />
        <Text style={styles.fieldLabel}>Assigned to</Text>
        <TextInput accessibilityLabel="Project assigned to" value={assignedTo} onChangeText={setAssignedTo} placeholder="e.g. You" placeholderTextColor={theme.colors.inputPlaceholder} style={styles.input} />
        <AppButton label="Save project details" icon="save-outline" loading={isSaving} onPress={() => onUpdateProject(project.id, { dueDate: dueDate.trim() || undefined, assignedTo: assignedTo.trim() || "You" })} />
      </AppCard>
    </ScrollView>
  );
}

const makeStyles = (theme: AppTheme) => createThemeStyles(theme, {
  screen: { flex: 1 },
  page: { gap: theme.spacing.md, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  backText: { color: theme.colors.textPrimary, fontSize: theme.type.body, fontWeight: "800", fontFamily: theme.type.bodyFont },
  heroCard: { gap: theme.spacing.md, backgroundColor: theme.colors.surfaceLilac, borderWidth: 0 },
  heroRow: { flexDirection: "row", gap: theme.spacing.md, alignItems: "flex-start" },
  thumbnail: { width: 76, height: 76, borderRadius: theme.radius.control },
  thumbnailPlaceholder: { width: 76, height: 76, borderRadius: theme.radius.control, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceRaised },
  heroCopy: { flex: 1, gap: theme.spacing.xs },
  title: { color: theme.colors.textPrimary, fontSize: theme.type.title, lineHeight: theme.type.lineHeight.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  description: { color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont },
  metaRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" },
  metaText: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont },
  summaryGrid: { flexDirection: "row", gap: theme.spacing.sm },
  summaryCard: { flex: 1, minHeight: 82, justifyContent: "center", gap: theme.spacing.xs, backgroundColor: theme.colors.surfaceRaised, borderWidth: 0 },
  label: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontWeight: "700", fontFamily: theme.type.bodyFont },
  summaryValue: { color: theme.colors.textPrimary, fontSize: theme.type.body, fontWeight: "900", fontFamily: theme.type.bodyFont },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  quickActions: { flexDirection: "row", gap: theme.spacing.sm },
  quickAction: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: theme.type.title, lineHeight: theme.type.lineHeight.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  sectionSubtitle: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
  progressText: { color: theme.colors.primary, fontSize: theme.type.body, fontWeight: "900", fontFamily: theme.type.bodyFont },
  progressTrack: { height: 7, overflow: "hidden", borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceMuted },
  progressFill: { height: "100%", borderRadius: theme.radius.pill, backgroundColor: theme.colors.secondary },
  timelineCard: { padding: 0, overflow: "hidden", borderWidth: 0, backgroundColor: theme.colors.surfaceRaised },
  timelineRow: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md },
  timelineRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  timelineRowLocked: { opacity: 0.58 },
  timelineMarker: { width: 32, height: 32, borderRadius: theme.radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceMuted },
  timelineMarkerCompleted: { backgroundColor: theme.colors.transparent },
  timelineMarkerCurrent: { backgroundColor: theme.colors.tertiary },
  timelineMarkerLocked: { backgroundColor: theme.colors.surfaceMuted },
  stageTitle: { color: theme.colors.textPrimary, fontSize: theme.type.body, fontWeight: "800", fontFamily: theme.type.bodyFont },
  stageTitleCurrent: { color: theme.colors.primary },
  stageTitleLocked: { color: theme.colors.textSecondary },
  stageState: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont },
  stageMessage: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
  detailsSection: { gap: theme.spacing.md, padding: theme.spacing.md, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceButter },
  detailSectionTitle: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, fontWeight: "900", fontFamily: theme.type.bodyFont },
  stageModalOverlay: { flex: 1, justifyContent: "flex-end" },
  stageModalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.overlay },
  stageSheet: { maxHeight: "92%", gap: theme.spacing.md, padding: theme.spacing.lg, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, backgroundColor: theme.colors.surface },
  stageModalHeader: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md },
  stageModalTitle: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  stageClose: { width: 44, height: 44, borderRadius: theme.radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceMuted },
  stageModalContent: { paddingBottom: theme.spacing.xl },
  editCard: { gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceSky, borderWidth: 0 },
  fieldLabel: { color: theme.colors.textPrimary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
  input: { minHeight: 46, paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceRaised, color: theme.colors.textPrimary, fontSize: theme.type.body, fontFamily: theme.type.bodyFont },
  pressed: { opacity: 0.78 },
});
