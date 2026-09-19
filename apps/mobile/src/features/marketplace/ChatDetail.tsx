import { ComponentProps, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  AppButton,
  AppCard,
  AppIcon,
  Avatar,
  ConfirmModal,
} from "../../components/ui";
import { useMediaAttachments } from "../../hooks/useMediaAttachments";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import { MediaAttachment } from "../../services/mediaPicker.service";

type ChatMessage = {
  id: string;
  text: string;
  mine: boolean;
  time: string;
  status?: "sent" | "delivered" | "seen";
  attachmentName?: string;
  attachments?: MediaAttachment[];
  replyTo?: { author: string; text: string };
  edited?: boolean;
};
type ChatIconName = ComponentProps<typeof AppIcon>["name"];
const REACTION_OPTIONS: {
  key: string;
  label: string;
  icon: ChatIconName;
}[] = [
  { key: "like", label: "Like", icon: "thumbs-up-outline" },
  { key: "love", label: "Love", icon: "heart-outline" },
  { key: "celebrate", label: "Celebrate", icon: "sparkles-outline" },
  { key: "laugh", label: "Funny", icon: "happy-outline" },
  { key: "approve", label: "Approve", icon: "checkmark-circle-outline" },
  { key: "fire", label: "Great", icon: "flame-outline" },
  { key: "star", label: "Star", icon: "star-outline" },
  { key: "idea", label: "Idea", icon: "bulb-outline" },
];

export function ChatDetail({
  name,
  initials,
  role = "Brand",
  onBack,
  onOpenProfile,
  blocked = false,
}: {
  name: string;
  initials: string;
  role?: "Brand" | "Influencer";
  onBack: () => void;
  onOpenProfile: () => void;
  blocked?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const backLocked = useRef(false);
  const handleBack = () => {
    if (backLocked.current) return;
    backLocked.current = true;
    onBack();
    setTimeout(() => {
      backLocked.current = false;
    }, 450);
  };
  const [draft, setDraft] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(
    null,
  );
  const [messageActionMode, setMessageActionMode] = useState<
    "actions" | "reactions" | null
  >(null);
  const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(
    null,
  );
  const [attachmentToRemove, setAttachmentToRemove] =
    useState<MediaAttachment | null>(null);
  const [reactions, setReactions] = useState<Record<string, string | undefined>>(
    {},
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "m1",
      text:
        role === "Influencer"
          ? "Hi Aarohi! I would love to know more about your content approach."
          : "Hi Maya! I would love to know more about the deliverables.",
      mine: false,
      time: "10:41 AM",
    },
    {
      id: "m2",
      text:
        role === "Influencer"
          ? "Thanks for connecting. I have shared the campaign brief here."
          : "Thanks for connecting. I have shared the campaign brief here.",
      mine: true,
      time: "10:43 AM",
      status: "seen",
      attachments: [
        {
          id: "demo-chat-image-1",
          name: "Campaign moodboard",
          type: "image",
          uri: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=640&q=80",
        },
        {
          id: "demo-chat-image-2",
          name: "Product reference",
          type: "image",
          uri: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=640&q=80",
        },
      ],
    },
  ]);
  const { attachments, addFile, addMedia, removeAttachment } =
    useMediaAttachments();
  const send = () => {
    if (blocked) return;
    const content = draft.trim();
    if (!content && attachments.length === 0) return;
    if (editingMessageId) {
      setMessages((current) =>
        current.map((message) =>
          message.id === editingMessageId
            ? { ...message, text: content || message.text, edited: true }
            : message,
        ),
      );
      setEditingMessageId(null);
      setDraft("");
      attachments.forEach((item) => removeAttachment(item.id));
      return;
    }
    const attachmentName = attachments.map((item) => item.name).join(", ");
    const sharedAttachments = attachments.length ? [...attachments] : undefined;
    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}`,
        text:
          content ||
          (attachments.length
            ? `${attachments.length} attachment${attachments.length === 1 ? "" : "s"} shared`
            : "Attachment shared"),
        mine: true,
        time: "Now",
        status: "sent",
        attachmentName,
        attachments: sharedAttachments,
        replyTo: replyingTo
          ? { author: replyingTo.mine ? "You" : name, text: replyingTo.text }
          : undefined,
      },
    ]);
    setDraft("");
    setReplyingTo(null);
    attachments.forEach((item) => removeAttachment(item.id));
  };
  const closeMessageActions = () => {
    setSelectedMessage(null);
    setMessageActionMode(null);
  };
  const chooseReaction = (reaction: string) => {
    if (!selectedMessage) return;
    setReactions((current) => ({
      ...current,
      [selectedMessage.id]:
        current[selectedMessage.id] === reaction ? undefined : reaction,
    }));
    closeMessageActions();
  };
  const startReply = () => {
    if (!selectedMessage) return;
    setReplyingTo(selectedMessage);
    closeMessageActions();
  };
  const startEdit = () => {
    if (!selectedMessage?.mine) return;
    setEditingMessageId(selectedMessage.id);
    setDraft(selectedMessage.text);
    setReplyingTo(null);
    closeMessageActions();
  };
  const confirmDeleteMessage = () => {
    if (!messageToDelete) return;
    setMessages((current) =>
      current.filter((message) => message.id !== messageToDelete.id),
    );
    if (replyingTo?.id === messageToDelete.id) setReplyingTo(null);
    setMessageToDelete(null);
  };
  const confirmRemoveAttachment = () => {
    if (attachmentToRemove) removeAttachment(attachmentToRemove.id);
    setAttachmentToRemove(null);
  };
  return (
    <KeyboardAvoidingView
      style={[styles.page, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={handleBack}
          style={styles.iconButton}
        >
          <AppIcon name="chevron-back" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${name} profile`}
          onPress={onOpenProfile}
          hitSlop={6}
        >
          <Avatar initials={initials} size="small" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${name} profile`}
          onPress={onOpenProfile}
          style={styles.headerInfo}
        >
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.status}>
            {blocked ? "Messaging blocked" : "Accepted collaboration"}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.thread}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.encryptionNote}>
          <AppIcon name="lock-closed-outline" size={15} color={theme.colors.primary} />
          <Text style={styles.encryptionText}>
            Private collaboration chat. Keep proposals and files inside this conversation.
          </Text>
        </View>
        {messages.map((message) => (
          <Pressable
            key={message.id}
            accessibilityRole="button"
            accessibilityLabel={`Message from ${message.mine ? "you" : name}`}
            onLongPress={() => {
              setSelectedMessage(message);
              setMessageActionMode("actions");
            }}
            delayLongPress={350}
            style={[
              styles.bubble,
              message.mine ? styles.bubbleMine : styles.bubbleOther,
            ]}
          >
            {message.replyTo ? (
              <View style={styles.replyPreview}>
                <AppIcon
                  name="return-down-forward-outline"
                  size={15}
                  color={message.mine ? theme.colors.primaryText : theme.colors.primary}
                />
                <View style={styles.replyPreviewCopy}>
                  <Text
                    numberOfLines={1}
                    style={[styles.replyAuthor, message.mine && styles.bubbleMineText]}
                  >
                    {message.replyTo.author}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.replyText, message.mine && styles.bubbleMineText]}
                  >
                    {message.replyTo.text}
                  </Text>
                </View>
              </View>
            ) : null}
            {message.attachments?.length ? (
              <View style={styles.messageMediaList}>
                {message.attachments.map((attachment) =>
                  attachment.type === "image" ? (
                    <Pressable
                      key={attachment.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open shared image ${attachment.name}`}
                      onPress={() => setSelectedImage(attachment.uri)}
                    >
                      <ExpoImage
                        accessibilityLabel={`Shared image ${attachment.name}`}
                        source={attachment.uri}
                        contentFit="cover"
                        transition={120}
                        style={styles.messageMediaImage}
                      />
                    </Pressable>
                  ) : (
                    <View key={attachment.id} style={styles.messageMediaFile}>
                      <AppIcon
                        name={
                          attachment.type === "video"
                            ? "videocam-outline"
                            : "document-outline"
                        }
                        size={18}
                        color={
                          message.mine
                            ? theme.colors.primaryText
                            : theme.colors.primary
                        }
                      />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.attachmentText,
                          message.mine && styles.bubbleMineText,
                        ]}
                      >
                        {attachment.name}
                      </Text>
                    </View>
                  ),
                )}
              </View>
            ) : null}
            {message.attachmentName && !message.attachments?.length ? (
              <View style={styles.attachment}>
                <AppIcon
                  name="document-text-outline"
                  color={
                    message.mine
                      ? theme.colors.primaryText
                      : theme.colors.primary
                  }
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.attachmentText,
                    message.mine && styles.bubbleMineText,
                  ]}
                >
                  {message.attachmentName}
                </Text>
              </View>
            ) : null}
            <Text
              style={[
                styles.messageText,
                message.mine && styles.bubbleMineText,
              ]}
            >
              {message.text}
            </Text>
            <View style={styles.messageFooter}>
              <Text style={[styles.time, message.mine && styles.bubbleMineTime]}>
                {message.time}{message.edited ? " · edited" : ""}
              </Text>
              {message.mine ? (
                <AppIcon
                  name={
                    message.status === "seen"
                      ? "checkmark-done"
                      : message.status === "delivered"
                        ? "checkmark-done-outline"
                        : "checkmark"
                  }
                  size={15}
                  color={theme.colors.primaryText}
                />
              ) : null}
              {reactions[message.id] ? (
                <View style={styles.reactionBadge}>
                  <AppIcon
                    name={
                      REACTION_OPTIONS.find(
                        (reaction) => reaction.key === reactions[message.id],
                      )?.icon ?? "thumbs-up-outline"
                    }
                    size={14}
                    color={message.mine ? theme.colors.primaryText : theme.colors.primary}
                  />
                </View>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {blocked ? (
        <View style={styles.blockedNotice}>
          <AppIcon name="ban-outline" size={18} color={theme.colors.danger} />
          <Text style={styles.blockedNoticeText}>
            Messaging is blocked for this profile. Unblock them from their profile to send a message.
          </Text>
        </View>
      ) : null}
      {!blocked && (replyingTo || editingMessageId) ? (
        <View style={styles.composerContext}>
          <AppIcon
            name={editingMessageId ? "create-outline" : "return-down-forward-outline"}
            size={17}
            color={theme.colors.primary}
          />
          <View style={styles.composerContextCopy}>
            <Text style={styles.composerContextTitle}>
              {editingMessageId ? "Editing message" : `Replying to ${replyingTo?.mine ? "your message" : name}`}
            </Text>
            {!editingMessageId && replyingTo ? (
              <Text numberOfLines={1} style={styles.composerContextText}>
                {replyingTo.text}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editingMessageId ? "Cancel editing" : "Cancel reply"}
            onPress={() => {
              setReplyingTo(null);
              setEditingMessageId(null);
              setDraft("");
            }}
            style={styles.contextClose}
          >
            <AppIcon name="close" size={18} color={theme.colors.textSecondary} />
          </Pressable>
        </View>
      ) : null}
      {!blocked && attachments.length ? (
        <ScrollView
          horizontal
          contentContainerStyle={[
            styles.attachments,
            { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) },
          ]}
        >
          {attachments.map((item) => (
            <AppCard key={item.id} style={styles.attachmentChip}>
              <AppIcon
                name={
                  item.type === "file"
                    ? "document-outline"
                    : item.type === "video"
                      ? "videocam-outline"
                      : "image-outline"
                }
              />
              <Text numberOfLines={1} style={styles.attachmentName}>
                {item.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.name} from attachments`}
                onPress={() => setAttachmentToRemove(item)}
                hitSlop={8}
              >
                <AppIcon name="close-circle" color={theme.colors.danger} />
              </Pressable>
            </AppCard>
          ))}
        </ScrollView>
      ) : null}
      {!blocked ? <View
        style={[
          styles.composer,
          { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) },
        ]}
      >
        <Pressable
          accessibilityLabel="Add media"
          onPress={addMedia}
          style={styles.iconButton}
        >
          <AppIcon name="image-outline" />
        </Pressable>
        <Pressable
          accessibilityLabel="Attach file"
          onPress={addFile}
          style={styles.iconButton}
        >
          <AppIcon name="attach-outline" />
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={
            editingMessageId
              ? "Edit your message"
              : replyingTo
                ? "Write a reply"
                : role === "Influencer"
                  ? "Reply to the brand"
                  : "Write a message"
          }
          placeholderTextColor={theme.colors.textSecondary}
          style={styles.input}
          multiline
        />
        <Pressable
          accessibilityLabel="Send message"
          onPress={send}
          style={styles.send}
        >
          <AppIcon name="send" color={theme.colors.primaryText} />
        </Pressable>
      </View> : null}
      <Modal
        transparent
        visible={Boolean(selectedImage)}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close image preview"
          onPress={() => setSelectedImage(null)}
          style={styles.mediaViewer}
        >
          {selectedImage ? (
            <ExpoImage
              accessibilityLabel="Expanded shared image"
              source={selectedImage}
              contentFit="contain"
              style={styles.mediaViewerImage}
            />
          ) : null}
          <View style={styles.mediaViewerClose}>
            <AppIcon name="close" color={theme.colors.primaryText} />
          </View>
        </Pressable>
      </Modal>
      <Modal
        transparent
        visible={Boolean(selectedMessage && messageActionMode)}
        animationType="fade"
        onRequestClose={closeMessageActions}
      >
        <View style={styles.messageActionOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close message actions"
            onPress={closeMessageActions}
            style={styles.messageActionBackdrop}
          />
          <View style={styles.messageActionSheet}>
            <View style={styles.messageActionHeader}>
              <View style={styles.flex}>
                <Text style={styles.messageActionTitle}>
                  {messageActionMode === "reactions" ? "React to message" : "Message actions"}
                </Text>
                <Text numberOfLines={1} style={styles.messageActionPreview}>
                  {selectedMessage?.text}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close message actions"
                onPress={closeMessageActions}
                style={styles.contextClose}
              >
                <AppIcon name="close" color={theme.colors.textSecondary} />
              </Pressable>
            </View>
            {messageActionMode === "reactions" ? (
              <View style={styles.reactionOptions}>
                {REACTION_OPTIONS.map((reaction) => (
                  <Pressable
                    key={reaction.key}
                    accessibilityRole="button"
                    accessibilityLabel={reaction.label}
                    onPress={() => chooseReaction(reaction.key)}
                    style={styles.reactionOption}
                  >
                    <AppIcon
                      name={reaction.icon}
                      size={22}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.messageActionLabel}>{reaction.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.messageActionList}>
                <MessageAction
                  icon="return-down-forward-outline"
                  label="Reply"
                  onPress={startReply}
                />
                <MessageAction
                  icon="heart-outline"
                  label="Add reaction"
                  onPress={() => setMessageActionMode("reactions")}
                />
                {selectedMessage?.mine ? (
                  <MessageAction
                    icon="create-outline"
                    label="Edit message"
                    onPress={startEdit}
                  />
                ) : null}
                {selectedMessage?.mine ? (
                  <MessageAction
                    icon="trash-outline"
                    label="Delete message"
                    destructive
                    onPress={() => {
                      setMessageToDelete(selectedMessage);
                      closeMessageActions();
                    }}
                  />
                ) : null}
              </View>
            )}
          </View>
        </View>
      </Modal>
      <ConfirmModal
        visible={Boolean(messageToDelete)}
        title="Delete this message?"
        message="This message will be removed from this conversation in the demo."
        confirmLabel="Delete"
        confirmIcon="trash-outline"
        destructive
        onCancel={() => setMessageToDelete(null)}
        onConfirm={confirmDeleteMessage}
      />
      <ConfirmModal
        visible={attachmentToRemove !== null}
        title="Remove this attachment?"
        message="This file will be removed from the message composer before sending."
        confirmLabel="Remove"
        confirmIcon="trash-outline"
        destructive
        onCancel={() => setAttachmentToRemove(null)}
        onConfirm={confirmRemoveAttachment}
      />
    </KeyboardAvoidingView>
  );
}

function MessageAction({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: ChatIconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.messageAction, pressed && styles.pressed]}
    >
      <AppIcon
        name={icon}
        size={20}
        color={destructive ? theme.colors.danger : theme.colors.primary}
      />
      <Text
        style={[
          styles.messageActionLabel,
          destructive && styles.messageActionDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerInfo: { flex: 1 },
    name: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      fontWeight: "800",
    },
    status: {
      color: theme.colors.success,
      fontSize: theme.type.caption,
      marginTop: 2,
    },
    blockedNotice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceMuted,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    blockedNoticeText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: 18,
    },
    encryptionNote: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
    },
    encryptionText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      textAlign: "center",
    },
    iconButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
    },
    thread: {
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.xl,
    },
    bubble: {
      maxWidth: "82%",
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
    },
    bubbleOther: {
      alignSelf: "flex-start",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    bubbleMine: {
      alignSelf: "flex-end",
      backgroundColor: theme.colors.primary,
    },
    messageText: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      lineHeight: 20,
    },
    bubbleMineText: { color: theme.colors.primaryText },
    time: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      alignSelf: "flex-end",
      marginTop: 4,
    },
    bubbleMineTime: { color: theme.colors.primaryText },
    flex: { flex: 1, minWidth: 0 },
    replyPreview: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      padding: theme.spacing.xs,
      marginBottom: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    replyPreviewCopy: { flex: 1, minWidth: 0, gap: 2 },
    replyAuthor: {
      color: theme.colors.primary,
      fontSize: theme.type.caption,
      fontWeight: "800",
    },
    replyText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    messageFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: theme.spacing.xs,
    },
    reactionBadge: {
      minWidth: 24,
      height: 24,
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    attachment: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      alignItems: "center",
      paddingBottom: theme.spacing.xs,
      marginBottom: theme.spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    messageMediaList: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.xs,
    },
    messageMediaImage: {
      width: 132,
      height: 132,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    messageMediaFile: {
      minWidth: 160,
      maxWidth: "100%",
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      padding: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    mediaViewer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.overlay,
    },
    mediaViewerImage: { width: "100%", height: "72%" },
    mediaViewerClose: {
      position: "absolute",
      top: theme.spacing.xl,
      right: theme.spacing.lg,
      width: 44,
      height: 44,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },
    attachmentText: {
      color: theme.colors.primary,
      flex: 1,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    attachments: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    attachmentChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    attachmentName: {
      maxWidth: 150,
      color: theme.colors.textPrimary,
      fontSize: theme.type.caption,
    },
    composerContext: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    composerContextCopy: { flex: 1, minWidth: 0, gap: 2 },
    composerContextTitle: {
      color: theme.colors.primary,
      fontSize: theme.type.caption,
      fontWeight: "800",
    },
    composerContextText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
    },
    contextClose: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.pill,
    },
    composer: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 100,
      paddingHorizontal: theme.spacing.md,
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.pill,
    },
    send: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },
    messageActionOverlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "flex-end",
    },
    messageActionBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.colors.overlay,
    },
    messageActionSheet: {
      width: "100%",
      maxWidth: 520,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
    },
    messageActionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    messageActionTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      fontWeight: "900",
    },
    messageActionPreview: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      marginTop: 2,
    },
    messageActionList: { gap: theme.spacing.xs },
    messageAction: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.md,
    },
    messageActionLabel: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "700",
    },
    messageActionDanger: { color: theme.colors.danger },
    reactionOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    reactionOption: {
      minWidth: 120,
      flexGrow: 1,
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    pressed: { opacity: 0.78 },
  });
