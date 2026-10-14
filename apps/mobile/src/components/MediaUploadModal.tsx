import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { AppIcon } from "./ui";
import { useTheme } from "../providers/ThemeProvider";
import { AppTheme } from "../styles/theme";
import { createThemeStyles } from "../styles/createThemeStyles";
import { clearMediaUploadError, subscribeMediaUpload } from "../services/mediaPicker.service";

type Props = {
  visible: boolean;
  error?: string;
  title?: string;
  onClose?: () => void;
};

export function MediaUploadModal({
  visible,
  error,
  title = "Uploading attachment",
  onClose,
}: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  if (!visible) return null;

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={error ? onClose : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
          <View style={styles.iconWrap}>
            <AppIcon
              name={error ? "alert-circle-outline" : "cloud-upload-outline"}
              size={26}
              color={error ? theme.colors.danger : theme.colors.primary}
            />
          </View>
          <Text style={styles.title}>{error ? "Upload could not finish" : title}</Text>
          <Text style={styles.body} accessibilityLiveRegion="polite">
            {error ?? "Keep this screen open while your file is being prepared."}
          </Text>
          {error ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close upload error"
              onPress={onClose}
              style={styles.closeButton}
            >
              <AppIcon name="close" size={18} color={theme.colors.primaryText} />
              <Text style={styles.closeLabel}>Close</Text>
            </Pressable>
          ) : (
            <ActivityIndicator accessibilityLabel="Upload in progress" color={theme.colors.primary} />
          )}
        </View>
      </View>
    </Modal>
  );
}

export function GlobalMediaUploadModal() {
  const [state, setState] = useState({ isUploading: false, error: "" });
  useEffect(() => subscribeMediaUpload(setState), []);
  return (
    <MediaUploadModal
      visible={state.isUploading || Boolean(state.error)}
      error={state.error || undefined}
      onClose={clearMediaUploadError}
    />
  );
}

const makeStyles = (theme: AppTheme) =>
  createThemeStyles(theme, {
    overlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.overlay,
    },
    card: {
      width: "100%",
      maxWidth: 360,
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
      ...theme.shadows.modal,
    },
    iconWrap: {
      width: 56,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceLilac,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      fontWeight: "900",
      textAlign: "center",
      fontFamily: theme.type.bodyFont,
    },
    body: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      lineHeight: theme.type.lineHeight.caption,
      textAlign: "center",
      fontFamily: theme.type.bodyFont,
    },
    closeButton: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primary,
    },
    closeLabel: {
      color: theme.colors.primaryText,
      fontSize: theme.type.caption,
      fontWeight: "800",
      fontFamily: theme.type.bodyFont,
    },
  });
