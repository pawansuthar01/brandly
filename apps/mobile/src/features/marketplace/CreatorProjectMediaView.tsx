import { useMemo, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton, AppCard, AppIcon, Pill } from "../../components/ui";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import { ContentIdeaAttachment, PRODUCTION_STAGES, ProductionProject, ProductionStage } from "../../types/marketplace";
import { CreatorAttachmentRow } from "./CreatorAttachmentRow";
import { CreatorAttachmentViewer } from "./CreatorAttachmentViewer";

type Props = {
  project: ProductionProject;
  onBack: () => void;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};
type ProjectMediaItem = { attachment: ContentIdeaAttachment; stage: ProductionStage };

export function CreatorProjectMediaView({ project, onBack, onScroll }: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [selectedAttachment, setSelectedAttachment] = useState<ContentIdeaAttachment>();
  const media = useMemo<ProjectMediaItem[]>(() => {
    const items: ProjectMediaItem[] = [];
    const seen = new Set<string>();
    const ideaAttachments = (project.stageData?.Idea as { attachments?: ContentIdeaAttachment[] } | undefined)?.attachments;
    if (project.attachment && !ideaAttachments?.some((attachment) => attachment.id === project.attachment?.id)) {
      items.push({ attachment: project.attachment, stage: "Idea" });
      seen.add(`Idea:${project.attachment.id}`);
    }
    PRODUCTION_STAGES.forEach((stage) => {
      const attachments = (project.stageData?.[stage] as { attachments?: ContentIdeaAttachment[] } | undefined)?.attachments ?? [];
      attachments.forEach((attachment) => {
        const key = `${stage}:${attachment.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        items.push({ attachment, stage });
      });
    });
    return items;
  }, [project]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to project details" onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <AppIcon name="arrow-back" size={19} color={theme.colors.textPrimary} />
        <Text style={styles.backText}>Project details</Text>
      </Pressable>

      <View style={styles.header}><View style={styles.flex}><Text style={styles.title}>Project media</Text><Text style={styles.subtitle}>{media.length} attached item{media.length === 1 ? "" : "s"} across this production pipeline.</Text></View><Pill label={project.title} accent /></View>
      {media.length ? media.map(({ attachment, stage }) => <AppCard key={`${stage}-${attachment.id}`} style={styles.mediaCard}><View style={styles.mediaHeader}><Text style={styles.stageName}>{stage}</Text><Pill label={attachment.type === "file" ? "File" : attachment.type === "video" ? "Video" : "Image"} /></View><CreatorAttachmentRow attachment={attachment} onOpen={() => setSelectedAttachment(attachment)} /></AppCard>) : <AppCard style={styles.emptyCard}><View style={styles.emptyIcon}><AppIcon name="folder-open-outline" size={24} color={theme.colors.primary} /></View><Text style={styles.emptyTitle}>No project media yet</Text><Text style={styles.emptyBody}>Add media or files while editing any production stage. They will appear here with the stage they belong to.</Text></AppCard>}
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
  header: { flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  title: { color: theme.colors.textPrimary, fontSize: theme.type.title, lineHeight: theme.type.lineHeight.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  subtitle: { marginTop: theme.spacing.xs, color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
  mediaCard: { gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceSky, borderWidth: 0 },
  mediaHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  stageName: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, fontWeight: "900", fontFamily: theme.type.bodyFont },
  emptyCard: { gap: theme.spacing.sm, alignItems: "flex-start", backgroundColor: theme.colors.surfaceSky, borderWidth: 0 },
  emptyIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceRaised },
  emptyTitle: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  emptyBody: { color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont },
  pressed: { opacity: 0.78 },
});
