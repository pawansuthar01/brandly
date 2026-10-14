import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Linking, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton, AppCard, AppIcon, Avatar, NATIVE_ANIMATIONS_ENABLED, Pill } from "../../components/ui";
import { formatDisplayDateTime } from "../../lib/dateTime";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import { Influencer, TodoTask } from "../../types/marketplace";
import { getTaskReminderLabel, TodoCompletionCheckbox } from "./TodoTask";

export function TodoTaskDetail({
  task,
  onBack,
  onToggle,
  onDelete,
  onAddNote,
  onUpdateNote,
  onRemoveNote,
  onOpenCalendar,
  onOpenChat,
  onScroll,
  eligibleRecipients = [],
  onSendToCreator,
  onSendToCreators,
}: {
  task: TodoTask;
  onBack: () => void;
  onToggle: () => void;
  onDelete?: () => void;
  onAddNote: (note: string) => void;
  onUpdateNote: (noteId: string, note: string) => void;
  onRemoveNote: (noteId: string) => void;
  onOpenCalendar: () => void;
  onOpenChat?: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  eligibleRecipients?: Array<{ creator: Influencer; relationship: string }>;
  onSendToCreator?: (creatorId: string) => boolean | Promise<boolean>;
  onSendToCreators?: (creatorIds: string[]) => number | Promise<number>;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const [noteDraft, setNoteDraft] = useState("");
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<string[]>([]);
  const [sendingTask, setSendingTask] = useState(false);
  const completionScale = useRef(new Animated.Value(1)).current;
  const isVideoBrief = task.kind === "video-brief";
  const isAlreadySentToCreator = (creatorId: string) => Boolean(
    task.sharedWithCreatorIds?.includes(creatorId) ||
    (task.creatorId === creatorId && task.sharedWithCreatorAt),
  );
  const availableRecipients = eligibleRecipients.filter(({ creator }) => !isAlreadySentToCreator(creator.id));
  useEffect(() => {
    if (!task.completed) return;
    completionScale.setValue(0.9);
    Animated.spring(completionScale, { toValue: 1, useNativeDriver: NATIVE_ANIMATIONS_ENABLED, damping: 15, stiffness: 240 }).start();
  }, [completionScale, task.completed]);
  const openLink = (url: string) => { void Linking.openURL(url).catch(() => undefined); };
  const openNoteEditor = (note?: { id: string; text: string }) => {
    setEditingNoteId(note?.id ?? null);
    setNoteDraft(note?.text ?? "");
    setNoteEditorOpen(true);
  };
  const saveNote = () => {
    const note = noteDraft.trim();
    if (!note) return;
    if (editingNoteId) onUpdateNote(editingNoteId, note);
    else onAddNote(note);
    setNoteDraft("");
    setEditingNoteId(null);
    setNoteEditorOpen(false);
  };
  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.page, { paddingTop: Math.max(insets.top, theme.spacing.lg), paddingBottom: Math.max(insets.bottom + theme.spacing.lg, theme.spacing.xxl) }]}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to tasks" onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <AppIcon name="chevron-back" size={21} color={theme.colors.textPrimary} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>{isVideoBrief ? "VIDEO BRIEF" : "TASK DETAILS"}</Text>
          <Text style={styles.title}>{isVideoBrief ? "Video brief" : "Your task"}</Text>
        </View>
        <Pill label={task.completed ? "Done" : "Open"} accent={!task.completed} />
      </View>
      <AppCard style={styles.heroCard}>
        {isVideoBrief ? <Animated.View style={[styles.statusIcon, { transform: [{ scale: completionScale }] }]}><AppIcon name="videocam-outline" size={25} color={theme.colors.primary} /></Animated.View> : <Animated.View style={{ transform: [{ scale: completionScale }] }}><TodoCompletionCheckbox completed={task.completed} label={`Mark ${task.title} ${task.completed ? "open" : "complete"}`} onPress={onToggle} /></Animated.View>}
        <Text style={[styles.taskTitle, task.completed && styles.taskTitleDone]}>{task.title}</Text>
        <Text style={styles.taskMeta}>{task.owner} · {task.dueDate} · {task.dueTime}</Text>
        {task.notes ? <Text style={styles.notes}>{task.notes}</Text> : <Text style={styles.notes}>No additional notes for this task.</Text>}
      </AppCard>
      <AppCard style={styles.infoCard}>
        <View style={styles.infoRow}><AppIcon name="calendar-outline" size={18} color={theme.colors.primary} /><View style={styles.flex}><Text style={styles.infoLabel}>Due</Text><Text style={styles.infoValue}>{task.dueDate} at {task.dueTime}</Text></View></View>
        <View style={styles.infoRow}><AppIcon name="person-outline" size={18} color={theme.colors.primary} /><View style={styles.flex}><Text style={styles.infoLabel}>Owner</Text><Text style={styles.infoValue}>{task.owner}</Text></View></View>
        {task.senderName ? <View style={styles.infoRow}><AppIcon name="business-outline" size={18} color={theme.colors.primary} /><View style={styles.flex}><Text style={styles.infoLabel}>Sent by</Text><Text style={styles.infoValue}>{task.senderName}</Text></View></View> : null}
        {task.campaignId ? <View style={styles.infoRow}><AppIcon name="briefcase-outline" size={18} color={theme.colors.primary} /><View style={styles.flex}><Text style={styles.infoLabel}>Campaign</Text><Text style={styles.infoValue}>Linked collaboration task</Text></View></View> : null}
        <View style={styles.infoRow}><AppIcon name="alarm-outline" size={18} color={theme.colors.primary} /><View style={styles.flex}><Text style={styles.infoLabel}>Reminder</Text><Text style={styles.infoValue}>{task.reminderEnabled ? getTaskReminderLabel(task) : task.reminderStatus === "SENT" ? "Due" : task.reminderStatus === "STOPPED" ? "Stopped" : "Off"}</Text></View></View>
      </AppCard>
      {task.links?.length ? <AppCard style={styles.infoCard}><Text style={styles.infoLabel}>Links</Text>{task.links.map((url) => <Pressable key={url} accessibilityRole="link" accessibilityLabel={`Open task link ${url}`} onPress={() => openLink(url)}><Text style={styles.link}>{url}</Text></Pressable>)}</AppCard> : null}
      {task.attachments?.length ? <AppCard style={styles.infoCard}><Text style={styles.infoLabel}>Attachments</Text>{task.attachments.map((attachment) => <Pressable key={attachment.id} accessibilityRole="button" accessibilityLabel={`Open ${attachment.type} ${attachment.name}`} onPress={() => attachment.uri ? openLink(attachment.uri) : undefined} style={styles.attachmentRow}>{attachment.type === "image" && attachment.uri ? <ExpoImage source={attachment.uri} contentFit="cover" style={styles.thumbnail} /> : <AppIcon name={attachment.type === "video" ? "videocam-outline" : "document-outline"} size={21} color={theme.colors.primary} />}<Text numberOfLines={2} style={styles.infoValue}>{attachment.name}</Text><AppIcon name="open-outline" size={18} color={theme.colors.primary} /></Pressable>)}</AppCard> : null}
      <AppCard style={styles.infoCard}>
        <View style={styles.notesHeader}><Text style={styles.sectionTitle}>Notes</Text><AppButton label="Add note" icon="add" compact variant="secondary" onPress={() => openNoteEditor()} /></View>
      {(task.noteHistory ?? []).map((note) => <View key={note.id} style={styles.noteItem}><View style={styles.flex}><Text style={styles.notes}>{note.text}</Text><Text style={styles.infoLabel}>{formatDisplayDateTime(note.createdAt)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Edit task note" onPress={() => openNoteEditor(note)} style={styles.noteAction}><AppIcon name="create-outline" size={17} color={theme.colors.primary} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Remove task note" onPress={() => onRemoveNote(note.id)} style={styles.noteAction}><AppIcon name="trash-outline" size={17} color={theme.colors.danger} /></Pressable></View>)}
      </AppCard>
      {task.history?.length ? <AppCard style={styles.infoCard}><Text style={styles.sectionTitle}>Activity history</Text>{task.history.slice().reverse().slice(0, 8).map((activity) => <View key={activity.id} style={styles.historyRow}><AppIcon name={activity.action === "REMINDER_SENT" ? "notifications-outline" : activity.action === "COMPLETED" ? "checkmark-circle-outline" : "time-outline"} size={17} color={theme.colors.primary} /><View style={styles.flex}><Text style={styles.infoValue}>{activity.action.replaceAll("_", " ")}</Text>{activity.message ? <Text style={styles.infoLabel}>{activity.message}</Text> : null}<Text style={styles.infoLabel}>{formatDisplayDateTime(activity.createdAt)}</Text></View></View>)}</AppCard> : null}
      {!isVideoBrief && (onSendToCreator || onSendToCreators) ? <AppButton label={availableRecipients.length ? "Send to creators" : "Sent to all eligible creators"} icon="paper-plane-outline" variant="secondary" disabled={!availableRecipients.length} onPress={() => { setSelectedCreatorIds([]); setRecipientPickerOpen(true); }} /> : null}
      <AppButton label={task.completed ? "Mark as open" : "Mark as complete"} icon={task.completed ? "refresh-outline" : "checkmark-circle-outline"} onPress={onToggle} />
      {onDelete ? <AppButton label="Delete task" icon="trash-outline" variant="secondary" onPress={() => Alert.alert("Delete task?", "This cancels its reminder and permanently removes the task.", [
        { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: onDelete },
      ])} /> : null}
      <AppButton label="Open calendar" icon="calendar-outline" variant="secondary" onPress={onOpenCalendar} />
      {task.conversationId && onOpenChat ? <AppButton label="Open chat" icon="chatbubble-ellipses-outline" variant="secondary" onPress={onOpenChat} /> : null}
      <Modal visible={noteEditorOpen} transparent animationType="slide" onRequestClose={() => setNoteEditorOpen(false)}>
        <View style={styles.modalOverlay}><Pressable accessibilityRole="button" accessibilityLabel="Close note editor" onPress={() => setNoteEditorOpen(false)} style={styles.modalBackdrop} /><View style={[styles.noteSheet, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}><View style={styles.notesHeader}><View style={styles.flex}><Text style={styles.sectionTitle}>{editingNoteId ? "Edit note" : "Add note"}</Text><Text style={styles.infoLabel}>Keep the task context up to date.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close note editor" onPress={() => setNoteEditorOpen(false)} style={styles.noteAction}><AppIcon name="close" size={20} color={theme.colors.textPrimary} /></Pressable></View><TextInput accessibilityLabel={editingNoteId ? "Edit task note" : "Add task note"} value={noteDraft} onChangeText={setNoteDraft} placeholder="Add a note or progress update" placeholderTextColor={theme.colors.inputPlaceholder} multiline style={styles.noteInput} /><View style={styles.noteEditorActions}><AppButton label="Cancel" compact variant="secondary" onPress={() => setNoteEditorOpen(false)} /><AppButton label={editingNoteId ? "Save" : "Add note"} compact icon="checkmark" disabled={!noteDraft.trim()} onPress={saveNote} /></View></View></View>
      </Modal>
      <Modal visible={recipientPickerOpen} transparent animationType="slide" onRequestClose={() => setRecipientPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close creator picker" onPress={() => setRecipientPickerOpen(false)} style={styles.modalBackdrop} />
          <View style={[styles.noteSheet, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
            <View style={styles.notesHeader}>
              <View style={styles.flex}><Text style={styles.sectionTitle}>Send task to creator</Text><Text style={styles.infoLabel}>Choose a creator from your active collaborations.</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close creator picker" onPress={() => setRecipientPickerOpen(false)} style={styles.noteAction}><AppIcon name="close" size={20} color={theme.colors.textPrimary} /></Pressable>
            </View>
            {eligibleRecipients.length ? <>
              <ScrollView contentContainerStyle={styles.recipientList} showsVerticalScrollIndicator={false}>{eligibleRecipients.map(({ creator, relationship }) => { const alreadySent = isAlreadySentToCreator(creator.id); const selected = selectedCreatorIds.includes(creator.id); return <Pressable key={creator.id} accessibilityRole="checkbox" accessibilityLabel={`${alreadySent ? "Task already sent to" : selected ? "Remove" : "Select"} ${creator.name}`} accessibilityState={{ checked: selected || alreadySent, disabled: alreadySent }} disabled={alreadySent} onPress={() => setSelectedCreatorIds((current) => selected ? current.filter((id) => id !== creator.id) : [...current, creator.id])} style={({ pressed }) => [styles.recipientRow, selected && styles.recipientRowSelected, alreadySent && styles.recipientRowDisabled, pressed && styles.pressed]}><Avatar initials={creator.initials} uri={creator.avatarUrl} size="small" /><View style={styles.flex}><Text style={styles.infoValue}>{creator.name}</Text><Text style={styles.infoLabel}>{creator.niche} · {relationship}</Text><Text style={styles.infoLabel}>{alreadySent ? "Already sent" : selected ? "Selected" : "Tap to select"}</Text></View><AppIcon name={alreadySent || selected ? "checkmark-circle" : "add-circle-outline"} size={20} color={alreadySent ? theme.colors.textSecondary : selected ? theme.colors.primary : theme.colors.primary} /></Pressable>; })}</ScrollView>
              {onSendToCreators ? <AppButton label={sendingTask ? "Sending…" : `Send to ${selectedCreatorIds.length} creator${selectedCreatorIds.length === 1 ? "" : "s"}`} icon="paper-plane-outline" loading={sendingTask} disabled={!selectedCreatorIds.length} onPress={async () => {
                setSendingTask(true);
                try {
                  const sent = await onSendToCreators(selectedCreatorIds);
                  if (sent) { setSelectedCreatorIds([]); setRecipientPickerOpen(false); }
                } finally {
                  setSendingTask(false);
                }
              }} /> : null}
            </> : <View style={styles.emptyRecipient}><AppIcon name="people-outline" size={24} color={theme.colors.primary} /><Text style={styles.infoValue}>No available creators</Text><Text style={styles.notes}>An accepted collaboration chat is required before you can send a task.</Text></View>}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (theme: AppTheme) => createThemeStyles(theme, {
  screen: { flex: 1, backgroundColor: theme.colors.transparent },
  page: { backgroundColor: theme.colors.transparent, padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl + theme.spacing.xl, gap: theme.spacing.lg },
  headerRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  backButton: { width: 44, height: 44, borderRadius: theme.radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceMuted },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "800", letterSpacing: 0.8, fontFamily: theme.type.bodyFont },
  title: { color: theme.colors.textPrimary, fontSize: theme.type.display, fontWeight: "900", fontFamily: theme.type.displayFont },
  heroCard: { alignItems: "flex-start", gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceRaised },
  statusIcon: { width: 52, height: 52, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.accent },
  statusIconDone: { backgroundColor: theme.colors.primary },
  taskTitle: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.displayFont },
  taskTitleDone: { color: theme.colors.textSecondary, textDecorationLine: "line-through" },
  taskMeta: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont },
  notes: { color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, fontWeight: "800", fontFamily: theme.type.bodyFont },
  notesHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  noteItem: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  historyRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
  noteAction: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  noteInput: { minHeight: 80, padding: theme.spacing.md, borderRadius: theme.radius.md, color: theme.colors.textPrimary, backgroundColor: theme.colors.inputBackground, borderWidth: 1, borderColor: theme.colors.border, textAlignVertical: "top", fontSize: theme.type.body, fontFamily: theme.type.bodyFont },
  noteEditorActions: { flexDirection: "row", justifyContent: "flex-end", gap: theme.spacing.sm },
  recipientList: { gap: theme.spacing.xs, maxHeight: 320 },
  recipientRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, padding: theme.spacing.sm, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted },
  recipientRowSelected: { backgroundColor: theme.colors.accent, borderWidth: 1, borderColor: theme.colors.primary },
  recipientRowDisabled: { opacity: 0.58 },
  emptyRecipient: { alignItems: "center", gap: theme.spacing.xs, paddingVertical: theme.spacing.lg },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.overlay },
  noteSheet: { gap: theme.spacing.md, padding: theme.spacing.lg, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, backgroundColor: theme.colors.surface },
  infoCard: { gap: theme.spacing.md },
  infoRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  infoLabel: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont },
  infoValue: { color: theme.colors.textPrimary, fontSize: theme.type.body, fontWeight: "700", fontFamily: theme.type.bodyFont },
  link: { color: theme.colors.primary, fontSize: theme.type.body, textDecorationLine: "underline", fontFamily: theme.type.bodyFont },
  attachmentRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
  thumbnail: { width: 56, height: 56, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceMuted },
  pressed: { opacity: 0.78 },
});
