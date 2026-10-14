import { Image as ExpoImage } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "../../components/ui";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import { ContentIdeaAttachment } from "../../types/marketplace";

type Props = {
  attachment: ContentIdeaAttachment;
  onOpen?: () => void;
  onRemove?: () => void;
};

export function CreatorAttachmentRow({ attachment, onOpen, onRemove }: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const content = (
    <>
      {attachment.type === "image" ? <ExpoImage source={attachment.uri} contentFit="cover" style={styles.thumbnail} accessibilityLabel={`${attachment.name} preview`} /> : <View style={styles.fileIcon}><AppIcon name={attachment.type === "video" ? "videocam-outline" : "document-outline"} size={20} color={theme.colors.primary} /></View>}
      <View style={styles.copy}><Text numberOfLines={2} style={styles.name}>{attachment.name}</Text><Text style={styles.type}>{attachment.type === "image" ? "Image" : attachment.type === "video" ? "Video" : "File"}</Text></View>
      {onRemove ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${attachment.name}`} onPress={onRemove} style={styles.action}><AppIcon name="trash-outline" size={18} color={theme.colors.danger} /></Pressable> : onOpen ? <AppIcon name="chevron-forward" size={18} color={theme.colors.textSecondary} /> : null}
    </>
  );
  return onOpen ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${attachment.name}`} onPress={onOpen} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>{content}</Pressable> : <View style={styles.row}>{content}</View>;
}

const makeStyles = (theme: AppTheme) => createThemeStyles(theme, {
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, padding: theme.spacing.sm, borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceRaised },
  thumbnail: { width: 48, height: 48, borderRadius: theme.radius.sm },
  fileIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceMuted },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: theme.colors.textPrimary, fontSize: theme.type.body, fontWeight: "800", fontFamily: theme.type.bodyFont },
  type: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont },
  action: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.78 },
});
