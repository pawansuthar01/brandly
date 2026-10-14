import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton, AppIcon, Skeleton } from "../../components/ui";
import { useState } from "react";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import { Campaign } from "../../types/marketplace";

type Props = {
  visible: boolean;
  campaigns: Campaign[];
  loading?: boolean;
  disabledCampaignIds?: string[];
  subtitle: string;
  actionLabel?: string;
  onClose: () => void;
  onSelect: (campaign: Campaign) => void;
  multiSelect?: boolean;
  onSelectMany?: (campaigns: Campaign[]) => void;
  emptyMessage?: string;
};

export function CampaignSelectionSheet({
  visible,
  campaigns,
  loading = false,
  disabledCampaignIds = [],
  subtitle,
  actionLabel = "Send",
  onClose,
  onSelect,
  multiSelect = false,
  onSelectMany,
  emptyMessage = "Publish a campaign before sending a request.",
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const close = () => {
    setSelectedCampaignIds([]);
    onClose();
  };
  return (
    <Modal transparent visible={visible} animationType="slide" statusBarTranslucent onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close campaign picker" onPress={close} style={styles.backdrop} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>CAMPAIGN REQUEST</Text>
              <Text style={styles.title}>Choose a campaign</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close campaign picker" onPress={close} hitSlop={8} style={styles.closeButton}>
              <AppIcon name="close" size={19} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Published campaigns</Text>
            <Text style={styles.count}>{loading ? "…" : campaigns.length}</Text>
          </View>
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {loading ? [1, 2, 3].map((item) => (
              <View key={item} accessibilityRole="progressbar" style={styles.row}>
                <View style={styles.skeletonIconTile} />
                <View style={styles.rowCopy}>
                  <Skeleton width="58%" height={14} />
                  <Skeleton width="42%" height={11} />
                  <Skeleton width="30%" height={11} />
                </View>
                <Skeleton width={19} height={19} />
              </View>
            )) : campaigns.map((campaign) => {
              const alreadySent = disabledCampaignIds.includes(campaign.id);
              return (
              <Pressable
                key={campaign.id}
                accessibilityRole={multiSelect ? "checkbox" : "button"}
                accessibilityLabel={alreadySent ? `${campaign.title} already sent` : multiSelect && selectedCampaignIds.includes(campaign.id) ? `${campaign.title} selected` : `${actionLabel} ${campaign.title} request`}
                accessibilityState={{ disabled: alreadySent, checked: multiSelect && selectedCampaignIds.includes(campaign.id) }}
                disabled={alreadySent}
                onPress={() => {
                  if (!multiSelect) {
                    onSelect(campaign);
                    close();
                    return;
                  }
                  setSelectedCampaignIds((current) => current.includes(campaign.id) ? current.filter((id) => id !== campaign.id) : [...current, campaign.id]);
                }}
                style={({ pressed }) => [styles.row, multiSelect && selectedCampaignIds.includes(campaign.id) && styles.rowSelected, alreadySent && styles.rowDisabled, pressed && !alreadySent && styles.pressed]}
              >
                <View style={styles.iconTile}><AppIcon name="briefcase-outline" size={18} color={theme.colors.primary} /></View>
                <View style={styles.rowCopy}>
                  <Text style={styles.campaignTitle}>{campaign.title}</Text>
                  <Text style={styles.campaignMeta}>{campaign.category}</Text>
                  <Text style={styles.campaignBudget}>{alreadySent ? "Already sent" : campaign.budget}</Text>
                </View>
                <AppIcon name={alreadySent || (multiSelect && selectedCampaignIds.includes(campaign.id)) ? "checkmark-circle-outline" : multiSelect ? "add-circle-outline" : "chevron-forward"} size={19} color={alreadySent ? theme.colors.textSecondary : theme.colors.primary} />
              </Pressable>
              );
            })}
            {!loading && !campaigns.length ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}><AppIcon name="briefcase-outline" size={22} color={theme.colors.primary} /></View>
                <Text style={styles.emptyTitle}>No published campaigns</Text>
                <Text style={styles.emptyMessage}>{emptyMessage}</Text>
              </View>
            ) : null}
          </ScrollView>
          {multiSelect && onSelectMany ? <AppButton label={`Send ${selectedCampaignIds.length} campaign${selectedCampaignIds.length === 1 ? "" : "s"}`} icon="paper-plane-outline" loading={loading} disabled={loading || !selectedCampaignIds.length} onPress={() => { onSelectMany(campaigns.filter((campaign) => selectedCampaignIds.includes(campaign.id))); close(); }} /> : null}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: AppTheme) => createThemeStyles(theme, {
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.overlay },
  sheet: { maxHeight: "72%", paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm, gap: theme.spacing.md, backgroundColor: theme.colors.surfaceRaised, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg },
  handle: { alignSelf: "center", width: 38, height: 4, borderRadius: 4, backgroundColor: theme.colors.border },
  header: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md },
  headerCopy: { flex: 1, gap: theme.spacing.xs },
  eyebrow: { color: theme.colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  title: { color: theme.colors.textPrimary, fontSize: 23, lineHeight: 28, fontWeight: "800" },
  subtitle: { color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: 20 },
  closeButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceLilac },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: theme.spacing.xs },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: theme.type.body, fontWeight: "800" },
  count: { minWidth: 26, paddingHorizontal: theme.spacing.xs, paddingVertical: 3, borderRadius: theme.radius.pill, textAlign: "center", color: theme.colors.primary, backgroundColor: theme.colors.surfaceLilac, fontSize: theme.type.caption, fontWeight: "800" },
  list: { gap: theme.spacing.sm, paddingBottom: theme.spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, minHeight: 76, padding: theme.spacing.sm, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  rowSelected: { backgroundColor: theme.colors.accent, borderColor: theme.colors.primary },
  rowDisabled: { opacity: 0.58 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  iconTile: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceLilac },
  skeletonIconTile: { width: 42, height: 42, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceLilac },
  campaignTitle: { color: theme.colors.textPrimary, fontSize: theme.type.body, lineHeight: 19, fontWeight: "800", flexShrink: 1 },
  campaignMeta: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: 16 },
  campaignBudget: { color: theme.colors.primary, fontSize: theme.type.caption, lineHeight: 16, fontWeight: "800" },
  emptyState: { alignItems: "center", paddingVertical: theme.spacing.lg, paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm },
  emptyIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceLilac },
  emptyTitle: { color: theme.colors.textPrimary, fontSize: theme.type.body, fontWeight: "800" },
  emptyMessage: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: 18, textAlign: "center" },
  pressed: { opacity: 0.78 },
});
