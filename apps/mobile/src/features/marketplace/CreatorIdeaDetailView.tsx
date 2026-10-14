import { Image as ExpoImage } from "expo-image";
import { useState } from "react";
import { Linking, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton, AppCard, AppIcon, IconButton, OverflowMenu, Pill } from "../../components/ui";
import { formatDisplayDateTime } from "../../lib/dateTime";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import { ContentIdea, ProductionProject } from "../../types/marketplace";
import { CreatorAttachmentViewer } from "./CreatorAttachmentViewer";
import { CreatorContentBlock } from "./CreatorContentBlock";

type Props = {
  idea: ContentIdea;
  project?: ProductionProject;
  isSaving?: boolean;
  onBack: () => void;
  onEdit: () => void;
  onOpenProject?: () => void;
  onCreateProject: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onAddNote: (text: string) => void;
  onUpdateNote: (noteId: string, text: string) => void;
  onRemoveNote: (noteId: string) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const isHttpUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());

export function CreatorIdeaDetailView({
  idea,
  project,
  isSaving = false,
  onBack,
  onEdit,
  onOpenProject,
  onCreateProject,
  onArchive,
  onUnarchive,
  onAddNote,
  onUpdateNote,
  onRemoveNote,
  onScroll,
}: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [attachmentViewerOpen, setAttachmentViewerOpen] = useState(false);
  const [linkError, setLinkError] = useState("");

  const openLink = async (url: string) => {
    setLinkError("");
    try {
      if (isHttpUrl(url) && await Linking.canOpenURL(url)) await Linking.openURL(url);
      else setLinkError("This link is unavailable right now.");
    } catch {
      setLinkError("This link is unavailable right now.");
    }
  };

  const startNote = (note?: { id: string; text: string }) => {
    setEditingNoteId(note?.id ?? null);
    setNoteDraft(note?.text ?? "");
    setNoteEditorOpen(true);
  };

  const saveNote = () => {
    const text = noteDraft.trim();
    if (!text) return;
    if (editingNoteId) onUpdateNote(editingNoteId, text);
    else onAddNote(text);
    setEditingNoteId(null);
    setNoteDraft("");
    setNoteEditorOpen(false);
  };

  const closeNoteEditor = () => {
    setEditingNoteId(null);
    setNoteDraft("");
    setNoteEditorOpen(false);
  };

  const openAttachment = () => {
    if (idea.attachment) setAttachmentViewerOpen(true);
  };

  const actions = [
    { label: "Edit idea", icon: "create-outline" as const, onPress: onEdit },
    { label: project ? "Open project" : "Create project", icon: project ? "briefcase-outline" as const : "add" as const, onPress: project ? onOpenProject! : onCreateProject },
    { label: idea.archived ? "Unarchive idea" : "Archive idea", icon: "archive-outline" as const, onPress: idea.archived ? onUnarchive : onArchive, destructive: !idea.archived },
  ];

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to ideas" onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <AppIcon name="arrow-back" size={19} color={theme.colors.textPrimary} />
          <Text style={styles.backText}>Ideas</Text>
        </Pressable>
        <OverflowMenu label="Idea actions" actions={actions} />
      </View>

      <AppCard style={styles.heroCard}>
        <View style={styles.heroRow}>
          {idea.attachment?.type === "image" && idea.attachment.uri ? <ExpoImage source={idea.attachment.uri} contentFit="cover" style={styles.thumbnail} accessibilityLabel={`${idea.title} reference`} /> : <View style={styles.thumbnailPlaceholder}><AppIcon name={idea.attachment?.type === "video" ? "videocam-outline" : idea.attachment?.type === "file" ? "document-text-outline" : "bulb-outline"} size={24} color={theme.colors.primary} /></View>}
          <View style={styles.flex}>
            <View style={styles.metaRow}><Pill label={idea.platform} /><Pill label={idea.archived ? "Archived" : project ? "Project" : "Idea"} accent={!idea.archived} /></View>
            <Text style={styles.title}>{idea.title}</Text>
            <Text style={styles.description}>{idea.concept || idea.description || "No concept added yet."}</Text>
          </View>
        </View>
      </AppCard>

      <View style={styles.sectionHeader}><View style={styles.flex}><Text style={styles.sectionTitle}>Idea details</Text><Text style={styles.sectionSubtitle}>Full content is grouped vertically so long descriptions and notes can grow naturally.</Text></View></View>
      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>Basic information</Text>
        <CreatorContentBlock label="Concept" value={idea.concept} />
        <CreatorContentBlock label="Title" value={idea.title} />
        <CreatorContentBlock label="Description" value={idea.description} />
        {idea.sourceUrl ? <CreatorContentBlock label="Reference / video link" linkLabel="Open reference link" onOpenLink={() => void openLink(idea.sourceUrl!)} /> : <CreatorContentBlock label="Reference / video link" />}
      </View>
      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>Planning</Text>
        <CreatorContentBlock label="Budget / rate" value={idea.budget} />
        <CreatorContentBlock label="Reminder date" value={idea.reminderDate} />
        <CreatorContentBlock label="Shoot location" value={idea.shootLocation} />
        <CreatorContentBlock label="Equipment" value={idea.equipment} />
      </View>
      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>Additional notes</Text>
        <CreatorContentBlock label="Idea notes" value={idea.ideaNotes} />
        {idea.attachment?.type === "image" ? <Pressable accessibilityRole="imagebutton" accessibilityLabel={`View ${idea.title} image attachment`} onPress={openAttachment} style={({ pressed }) => [styles.imagePreviewFrame, pressed && styles.pressed]}><ExpoImage source={idea.attachment.uri} contentFit="contain" style={styles.imagePreview} accessibilityLabel={`${idea.title} attachment preview`} /><Text style={styles.previewHint}>Tap to view image</Text></Pressable> : null}
        {idea.attachment && idea.attachment.type !== "image" ? <CreatorContentBlock label="Attachment" value={idea.attachment.name} linkLabel={`Open ${idea.attachment.name}`} onOpenLink={openAttachment} /> : null}
        {linkError ? <Text style={styles.errorText}>{linkError}</Text> : null}
      </View>

      <View style={styles.sectionHeader}><View style={styles.flex}><Text style={styles.sectionTitle}>Notes</Text><Text style={styles.sectionSubtitle}>Add, edit, or remove notes without expanding the list card.</Text></View><IconButton name="add" label="Add note" onPress={() => startNote()} /></View>
      {(idea.notes ?? []).map((note) => <View key={note.id} style={styles.noteCard}><CreatorContentBlock label={formatDisplayDateTime(note.createdAt)} value={note.text} /><View style={styles.noteActionRow}><Pressable accessibilityRole="button" accessibilityLabel="Edit idea note" onPress={() => startNote(note)} style={styles.noteAction}><AppIcon name="create-outline" size={17} color={theme.colors.primary} /><Text style={styles.noteActionText}>Edit</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Remove idea note" onPress={() => onRemoveNote(note.id)} style={styles.noteAction}><AppIcon name="trash-outline" size={17} color={theme.colors.danger} /><Text style={styles.noteActionTextDanger}>Remove</Text></Pressable></View></View>)}
      {!(idea.notes ?? []).length ? <AppCard flat style={styles.emptyNotes}><AppIcon name="document-text-outline" size={20} color={theme.colors.textSecondary} /><Text style={styles.emptyText}>No notes added yet.</Text></AppCard> : null}

      <AppButton label={project ? "Open project workflow" : "Create project from idea"} icon={project ? "briefcase-outline" : "add"} onPress={project ? onOpenProject : onCreateProject} />
      </ScrollView>
      <Modal visible={noteEditorOpen} transparent animationType="slide" onRequestClose={closeNoteEditor}>
        <View style={styles.noteModalOverlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close note editor" onPress={closeNoteEditor} style={styles.noteModalBackdrop} />
          <View style={[styles.noteSheet, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
            <View style={styles.noteHeader}><View style={styles.flex}><Text style={styles.noteTitle}>{editingNoteId ? "Edit note" : "Add note"}</Text><Text style={styles.sectionSubtitle}>Keep a small update with this idea.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close note editor" onPress={closeNoteEditor} style={styles.closeButton}><AppIcon name="close" size={20} color={theme.colors.textPrimary} /></Pressable></View>
            <TextInput accessibilityLabel={editingNoteId ? "Edit idea note" : "New idea note"} value={noteDraft} onChangeText={setNoteDraft} placeholder="Add a note or progress update" placeholderTextColor={theme.colors.inputPlaceholder} multiline scrollEnabled textAlignVertical="top" style={styles.noteInput} />
            <View style={styles.noteActions}><AppButton label="Cancel" compact variant="secondary" onPress={closeNoteEditor} /><AppButton label={editingNoteId ? "Save" : "Add note"} compact icon="checkmark" disabled={!noteDraft.trim()} loading={isSaving} onPress={saveNote} /></View>
          </View>
        </View>
      </Modal>
      <CreatorAttachmentViewer attachment={idea.attachment} visible={attachmentViewerOpen} onClose={() => setAttachmentViewerOpen(false)} />
    </>
  );
}

const makeStyles = (theme: AppTheme) => createThemeStyles(theme, {
  screen: { flex: 1 },
  page: { gap: theme.spacing.md, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  backText: { color: theme.colors.textPrimary, fontSize: theme.type.body, fontWeight: "800", fontFamily: theme.type.bodyFont },
  heroCard: { gap: theme.spacing.md, backgroundColor: theme.colors.surfaceLilac, borderWidth: 0 },
  heroRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md },
  thumbnail: { width: 76, height: 76, borderRadius: theme.radius.control },
  thumbnailPlaceholder: { width: 76, height: 76, borderRadius: theme.radius.control, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceRaised },
  flex: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: theme.spacing.xs },
  title: { marginTop: theme.spacing.xs, color: theme.colors.textPrimary, fontSize: theme.type.title, lineHeight: theme.type.lineHeight.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  description: { marginTop: theme.spacing.xs, color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: theme.type.title, lineHeight: theme.type.lineHeight.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  sectionSubtitle: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
  detailSection: { gap: theme.spacing.md, padding: theme.spacing.md, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceButter },
  detailSectionTitle: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, fontWeight: "900", fontFamily: theme.type.bodyFont },
  errorText: { color: theme.colors.danger, fontSize: theme.type.caption, fontWeight: "700", fontFamily: theme.type.bodyFont },
  imagePreviewFrame: { gap: theme.spacing.xs, alignItems: "center", padding: theme.spacing.sm, borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceRaised },
  imagePreview: { width: "100%", height: 220, borderRadius: theme.radius.control },
  previewHint: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont },
  noteCard: { gap: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceRaised },
  noteActionRow: { flexDirection: "row", gap: theme.spacing.md },
  noteAction: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, paddingHorizontal: theme.spacing.xs },
  noteActionText: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
  noteActionTextDanger: { color: theme.colors.danger, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
  emptyNotes: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingHorizontal: 0 },
  emptyText: { color: theme.colors.textSecondary, fontSize: theme.type.body, fontFamily: theme.type.bodyFont },
  noteInput: { minHeight: 120, maxHeight: 240, padding: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.inputBackground, color: theme.colors.textPrimary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont },
  noteActions: { flexDirection: "row", justifyContent: "flex-end", gap: theme.spacing.sm },
  noteModalOverlay: { flex: 1, justifyContent: "flex-end" },
  noteModalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.overlay },
  noteSheet: { gap: theme.spacing.md, padding: theme.spacing.lg, paddingBottom: theme.spacing.xl, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, backgroundColor: theme.colors.surface },
  noteHeader: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md },
  noteTitle: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceMuted },
  pressed: { opacity: 0.78 },
});
