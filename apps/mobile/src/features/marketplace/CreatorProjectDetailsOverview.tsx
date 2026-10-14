import { Image as ExpoImage } from "expo-image";
import { useState } from "react";
import { Linking, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton, AppCard, AppIcon, Pill } from "../../components/ui";
import { getProjectStageData, getStageStatus } from "../../lib/productionWorkflow";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import {
  ContentIdeaAttachment,
  EditingStageData,
  IdeaStageData,
  PRODUCTION_STAGES,
  ProductionProject,
  ProductionStage,
  PublishedStageData,
  ScheduledStageData,
  ScriptingStageData,
  ShootingStageData,
  ThumbnailStageData,
} from "../../types/marketplace";
import { CreatorContentBlock } from "./CreatorContentBlock";
import { CreatorAttachmentRow } from "./CreatorAttachmentRow";
import { CreatorAttachmentViewer } from "./CreatorAttachmentViewer";

type Props = {
  project: ProductionProject;
  onBack: () => void;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};
type OverviewField = { label: string; value: string; link?: string };
type StageStatus = ReturnType<typeof getStageStatus>;

const statusLabel: Record<StageStatus, string> = { locked: "Locked", current: "Current", draft: "Draft", completed: "Completed" };

const fieldsForStage = (stage: ProductionStage, value: unknown): OverviewField[] => {
  switch (stage) {
    case "Idea": {
      const data = (value ?? {}) as Partial<IdeaStageData>;
      return [
        { label: "Concept", value: data.concept ?? "" },
        { label: "Title", value: data.title ?? "" },
        { label: "Description", value: data.description ?? "" },
        { label: "Reference / video link", value: data.referenceUrl ?? "", link: data.referenceUrl },
        { label: "Notes", value: data.notes ?? "" },
        { label: "Budget / rate", value: data.budget ?? "" },
        { label: "Reminder date", value: data.reminderDate ?? "" },
        { label: "Shoot location", value: data.shootLocation ?? "" },
        { label: "Equipment", value: data.equipment ?? "" },
      ];
    }
    case "Scripting": {
      const data = (value ?? {}) as Partial<ScriptingStageData>;
      return [
        { label: "Hook", value: data.hook ?? "" },
        { label: "Script", value: data.script ?? "" },
        { label: "CTA", value: data.cta ?? "" },
        { label: "Caption", value: data.caption ?? "" },
        { label: "Notes", value: data.notes ?? "" },
      ];
    }
    case "Shooting": {
      const data = (value ?? {}) as Partial<ShootingStageData>;
      return [
        { label: "Shoot date", value: data.shootDate ?? "" },
        { label: "Shoot location", value: data.shootLocation ?? "" },
        { label: "Equipment", value: data.equipment ?? "" },
        { label: "Shot notes", value: data.shotNotes ?? "" },
        { label: "Assets / reference link", value: data.assetsReference ?? "", link: data.assetsReference },
      ];
    }
    case "Editing": {
      const data = (value ?? {}) as Partial<EditingStageData>;
      return [
        { label: "Editing notes", value: data.editingNotes ?? "" },
        { label: "Editor / status owner", value: data.editor ?? "" },
        { label: "Edit status", value: data.status ?? "" },
        { label: "Edited asset link", value: data.assetUrl ?? "", link: data.assetUrl },
        { label: "Revision notes", value: data.revisionNotes ?? "" },
      ];
    }
    case "Thumbnail": {
      const data = (value ?? {}) as Partial<ThumbnailStageData>;
      return [
        { label: "Thumbnail link", value: data.thumbnailUrl ?? "", link: data.thumbnailUrl },
        { label: "Thumbnail notes", value: data.notes ?? "" },
        { label: "Revision information", value: data.revisionInfo ?? "" },
      ];
    }
    case "Scheduled": {
      const data = (value ?? {}) as Partial<ScheduledStageData>;
      return [
        { label: "Scheduled date", value: data.scheduledDate ?? "" },
        { label: "Scheduled time", value: data.scheduledTime ?? "" },
        { label: "Platform", value: data.platform ?? "" },
        { label: "Publishing notes", value: data.publishingNotes ?? "" },
      ];
    }
    case "Published": {
      const data = (value ?? {}) as Partial<PublishedStageData>;
      return [
        { label: "Published URL", value: data.publishedUrl ?? "", link: data.publishedUrl },
        { label: "Published date", value: data.publishedDate ?? "" },
        { label: "Published time", value: data.publishedTime ?? "" },
        { label: "Platform", value: data.platform ?? "" },
        { label: "Final publish notes", value: data.finalNotes ?? "" },
        { label: "Final status", value: data.status ?? "" },
      ];
    }
  }
};

export function CreatorProjectDetailsOverview({ project, onBack, onScroll }: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const stageData = getProjectStageData(project);
  const [message, setMessage] = useState("");
  const [selectedAttachment, setSelectedAttachment] = useState<ContentIdeaAttachment>();

  const openLink = async (url: string) => {
    setMessage("");
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
      else setMessage("This link is unavailable right now.");
    } catch {
      setMessage("This link is unavailable right now.");
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to project details" onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <AppIcon name="arrow-back" size={19} color={theme.colors.textPrimary} />
        <Text style={styles.backText}>Project details</Text>
      </Pressable>

      <AppCard style={styles.heroCard}>
        <View style={styles.heroRow}>
          {project.attachment?.type === "image" && project.attachment.uri ? <ExpoImage source={project.attachment.uri} contentFit="contain" style={styles.thumbnail} accessibilityLabel={`${project.title} project image`} /> : <View style={styles.thumbnailPlaceholder}><AppIcon name={project.attachment?.type === "video" ? "videocam-outline" : project.attachment?.type === "file" ? "document-text-outline" : "videocam-outline"} size={24} color={theme.colors.primary} /></View>}
          <View style={styles.flex}><View style={styles.metaRow}><Pill label={project.currentStage} accent /><Pill label={project.platform} /></View><Text style={styles.title}>{project.title}</Text><Text style={styles.description}>{project.description || "No description added yet."}</Text></View>
        </View>
      </AppCard>

      <View style={styles.sectionHeader}><View style={styles.flex}><Text style={styles.sectionTitle}>All project details</Text><Text style={styles.sectionSubtitle}>Every stage is shown vertically so long content can grow naturally.</Text></View></View>
      <AppCard style={styles.projectContext}>
        <CreatorContentBlock label="Project title" value={project.title} />
        <CreatorContentBlock label="Project description" value={project.description} />
        <CreatorContentBlock label="Platform" value={project.platform} />
        <CreatorContentBlock label="Due date" value={project.dueDate ?? project.reminderDate ?? ""} />
        <CreatorContentBlock label="Assigned to" value={project.assignedTo} />
        {project.sourceUrl ? <CreatorContentBlock label="Project source link" linkLabel="Open project source link" onOpenLink={() => void openLink(project.sourceUrl!)} /> : null}
      </AppCard>

      {PRODUCTION_STAGES.map((stage) => {
        const status = getStageStatus(project, stage);
        const attachments = (stageData[stage] as { attachments?: ContentIdeaAttachment[] } | undefined)?.attachments ?? [];
        return <AppCard key={stage} style={styles.stageCard}>
          <View style={styles.stageHeader}><View style={styles.flex}><Text style={styles.stageTitle}>{stage}</Text><Text style={styles.stageState}>{statusLabel[status]}</Text></View><Pill label={statusLabel[status]} accent={status === "completed" || status === "current"} /></View>
          <View style={styles.stageContent}>{fieldsForStage(stage, stageData[stage]).map((field) => field.link && field.value ? <CreatorContentBlock key={field.label} label={field.label} linkLabel={`Open ${field.label.toLowerCase()}`} onOpenLink={() => void openLink(field.link!)} /> : <CreatorContentBlock key={field.label} label={field.label} value={field.value} />)}</View>
          {attachments.length ? <View style={styles.stageMedia}><Text style={styles.mediaTitle}>Stage media</Text>{attachments.map((attachment) => <CreatorAttachmentRow key={attachment.id} attachment={attachment} onOpen={() => setSelectedAttachment(attachment)} />)}</View> : null}
        </AppCard>;
      })}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{message}</Text> : null}
      <AppButton label="Back to workflow" icon="git-branch-outline" variant="secondary" onPress={onBack} />
      <CreatorAttachmentViewer attachment={selectedAttachment} visible={Boolean(selectedAttachment)} onClose={() => setSelectedAttachment(undefined)} />
    </ScrollView>
  );
}

const makeStyles = (theme: AppTheme) => createThemeStyles(theme, {
  screen: { flex: 1 },
  page: { gap: theme.spacing.md, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  backText: { color: theme.colors.textPrimary, fontSize: theme.type.body, fontWeight: "800", fontFamily: theme.type.bodyFont },
  flex: { flex: 1, minWidth: 0 },
  heroCard: { gap: theme.spacing.md, backgroundColor: theme.colors.surfaceLilac, borderWidth: 0 },
  heroRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md },
  thumbnail: { width: 76, height: 76, borderRadius: theme.radius.control },
  thumbnailPlaceholder: { width: 76, height: 76, borderRadius: theme.radius.control, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceRaised },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: theme.spacing.xs },
  title: { marginTop: theme.spacing.xs, color: theme.colors.textPrimary, fontSize: theme.type.title, lineHeight: theme.type.lineHeight.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  description: { marginTop: theme.spacing.xs, color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: theme.type.title, lineHeight: theme.type.lineHeight.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  sectionSubtitle: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
  projectContext: { gap: theme.spacing.md, backgroundColor: theme.colors.surfaceButter, borderWidth: 0 },
  stageCard: { gap: theme.spacing.md, backgroundColor: theme.colors.surfaceSky, borderWidth: 0 },
  stageHeader: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  stageTitle: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, fontWeight: "900", fontFamily: theme.type.bodyFont },
  stageState: { marginTop: 2, color: theme.colors.textSecondary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont },
  stageContent: { gap: theme.spacing.md },
  stageMedia: { gap: theme.spacing.sm, paddingTop: theme.spacing.xs },
  mediaTitle: { color: theme.colors.textPrimary, fontSize: theme.type.caption, fontWeight: "900", fontFamily: theme.type.bodyFont },
  errorText: { color: theme.colors.danger, fontSize: theme.type.caption, fontWeight: "700", fontFamily: theme.type.bodyFont },
  pressed: { opacity: 0.78 },
});
