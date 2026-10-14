import { VideoView, useVideoPlayer } from "expo-video";
import { Image as ExpoImage } from "expo-image";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "../../components/ui";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import { ContentIdeaAttachment } from "../../types/marketplace";

type Props = {
  attachment?: ContentIdeaAttachment;
  visible: boolean;
  onClose: () => void;
};

const extensionFor = (attachment: ContentIdeaAttachment) =>
  attachment.name.toLowerCase().split(/[?#]/)[0].split(".").pop() ?? "";

function VideoAttachmentPreview({ uri, style }: { uri: string; style: object }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });
  return <VideoView player={player} nativeControls contentFit="contain" style={style} />;
}

export function CreatorAttachmentViewer({ attachment, visible, onClose }: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  if (!attachment) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close attachment viewer" onPress={onClose} style={styles.backdrop} />
        <View style={[styles.viewer, { paddingTop: Math.max(insets.top, theme.spacing.lg), paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]} accessibilityViewIsModal>
          <View style={styles.header}>
            <View style={styles.copy}>
              <Text numberOfLines={2} style={styles.title}>{attachment.name}</Text>
              <Text style={styles.subtitle}>{attachment.type === "image" ? "Image preview" : attachment.type === "video" ? "Video preview" : "File preview"}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close attachment viewer" onPress={onClose} style={styles.closeButton}>
              <AppIcon name="close" size={22} color={theme.colors.primaryText} />
            </Pressable>
          </View>

          {attachment.type === "image" ? (
            <ExpoImage source={attachment.uri} contentFit="contain" style={styles.media} accessibilityLabel={`${attachment.name} preview`} />
          ) : attachment.type === "video" ? (
            <VideoAttachmentPreview uri={attachment.uri} style={styles.media} />
          ) : (
            <WebView
              source={{ uri: attachment.uri }}
              style={styles.document}
              originWhitelist={["*"]}
              startInLoadingState
              renderError={() => <View style={styles.fileFallback}>
                <View style={styles.fileIcon}><AppIcon name="document-text-outline" size={30} color={theme.colors.primary} /></View>
                <Text style={styles.fileTitle}>File saved in Studio</Text>
                <Text style={styles.fileBody}>This file is available inside the app and is attached to this Studio item.</Text>
                <Text style={styles.fileType}>{extensionFor(attachment).toUpperCase() || "FILE"}</Text>
              </View>}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: AppTheme) => createThemeStyles(theme, {
  overlay: { flex: 1, justifyContent: "center", backgroundColor: theme.colors.overlay },
  backdrop: { ...StyleSheet.absoluteFill },
  viewer: { flex: 1, justifyContent: "center", gap: theme.spacing.md, paddingHorizontal: theme.spacing.lg },
  header: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  copy: { flex: 1, minWidth: 0 },
  title: { color: theme.colors.primaryText, fontSize: theme.type.bodyLarge, lineHeight: theme.type.lineHeight.bodyLarge, fontWeight: "900", fontFamily: theme.type.bodyFont },
  subtitle: { marginTop: 2, color: theme.colors.primaryText, opacity: 0.78, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.pill, backgroundColor: theme.colors.primary },
  media: { width: "100%", height: "72%", borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceRaised },
  document: { width: "100%", height: "72%", overflow: "hidden", borderRadius: theme.radius.control, backgroundColor: theme.colors.surface },
  fileFallback: { alignItems: "center", gap: theme.spacing.sm, padding: theme.spacing.xl, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, textAlign: "center" },
  fileIcon: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceLilac },
  fileTitle: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, fontWeight: "900", fontFamily: theme.type.bodyFont, textAlign: "center" },
  fileBody: { color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont, textAlign: "center" },
  fileType: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "900", fontFamily: theme.type.bodyFont },
});
