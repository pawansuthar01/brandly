import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "../../components/ui";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";

export function CreatorContentBlock({ label, value, linkLabel, onOpenLink }: { label: string; value?: string; linkLabel?: string; onOpenLink?: () => void }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      {onOpenLink ? (
        <Pressable accessibilityRole="link" accessibilityLabel={linkLabel ?? `Open ${label}`} onPress={onOpenLink} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
          <AppIcon name="link-outline" size={17} color={theme.colors.primary} />
          <Text style={styles.linkText}>{linkLabel ?? "Open link"}</Text>
        </Pressable>
      ) : <Text selectable style={styles.value}>{value?.trim() || "Not set"}</Text>}
    </View>
  );
}

const makeStyles = (theme: AppTheme) => createThemeStyles(theme, {
  block: { minWidth: 0, gap: theme.spacing.xs },
  label: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
  value: { width: "100%", color: theme.colors.textPrimary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont },
  link: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  linkText: { flexShrink: 1, color: theme.colors.primary, fontSize: theme.type.body, fontWeight: "800", fontFamily: theme.type.bodyFont },
  pressed: { opacity: 0.78 },
});
