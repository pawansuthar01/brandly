import { useState } from "react";
import {
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AppButton,
  AppCard,
  AppIcon,
  Avatar,
  ConfirmModal,
  Pill,
  Toggle,
} from "../../components/ui";
import { selectFileAttachment, selectMediaAttachment } from "../../services/mediaPicker.service";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import { formatCampaignDeadline } from "../../lib/dateTime";
import type {
  BrandBrief,
  Campaign,
  DemoAttachment,
  MarketplaceApplication,
  PublicCreatorProfile,
} from "../../types/marketplace";

type Props = {
  campaign: Campaign;
  brief: BrandBrief;
  currentCreator: PublicCreatorProfile;
  onBack: () => void;
  onSubmitted: (application: MarketplaceApplication) => void;
  onSubmitApplication: (
    draft: Omit<MarketplaceApplication, "id" | "status" | "submittedAt" | "conversationId">,
  ) => Promise<{ application: MarketplaceApplication; conversationId: string }> | { application: MarketplaceApplication; conversationId: string };
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  modal?: boolean;
};

const isHttpUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());

export function CampaignApplicationView({
  campaign,
  brief,
  currentCreator,
  onBack,
  onSubmitted,
  onSubmitApplication,
  onScroll,
  modal = false,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<DemoAttachment[]>([]);
  const [shareContact, setShareContact] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setResponse = (id: string, value: string) => {
    setResponses((current) => ({ ...current, [id]: value }));
    setFormError("");
  };
  const addMedia = async (requirementId?: string) => {
    try {
      const selected = await selectMediaAttachment();
      if (!selected.length) return;
      setAttachments((current) => [...current, ...selected]);
      if (requirementId) setResponse(requirementId, selected[0].name);
    } catch {
      setFormError("Media could not be attached. Please try again.");
    }
  };
  const addFile = async (requirementId?: string) => {
    try {
      const selected = await selectFileAttachment();
      if (!selected) return;
      setAttachments((current) => [...current, selected]);
      if (requirementId) setResponse(requirementId, selected.name);
    } catch {
      setFormError("File could not be attached. Please try again.");
    }
  };
  const reviewApplication = () => {
    const missing = brief.requirements.find((requirement) =>
      requirement.required &&
      (requirement.type === "file"
        ? attachments.length === 0
        : !responses[requirement.id]?.trim()),
    );
    if (missing) {
      setFormError(`Please complete: ${missing.label}`);
      return;
    }
    const invalidUrl = brief.requirements.find((requirement) =>
      requirement.type === "url" &&
      responses[requirement.id] &&
      !isHttpUrl(responses[requirement.id]),
    );
    if (invalidUrl) {
      setFormError(`${invalidUrl.label} must start with http:// or https://.`);
      return;
    }
    setConfirmOpen(true);
  };
  const submitApplication = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setFormError("");
    const publicProfile: PublicCreatorProfile = shareContact
      ? { ...currentCreator, contactEnabled: true }
      : {
          ...currentCreator,
          contactEnabled: false,
          publicEmail: undefined,
          publicPhone: undefined,
        };
    const responseSummary = Object.entries(responses)
      .map(([id, value]) => `${brief.requirements.find((requirement) => requirement.id === id)?.label ?? id}: ${value}`)
      .join("\n");
    try {
      const result = await onSubmitApplication({
        briefId: brief.id,
        campaignId: campaign.id,
        brandId: campaign.brandId ?? brief.brandId,
        briefTitle: campaign.title,
        brandName: campaign.brand,
        brandInitials: campaign.brandInitials ?? brief.brandInitials,
        creatorId: currentCreator.id,
        creatorName: currentCreator.name,
        creatorInitials: currentCreator.initials,
        creatorProfile: publicProfile,
        contactShared: shareContact,
        responses,
        attachments,
        direction: "creator-to-brand",
        message: `Application for ${campaign.title}${responseSummary ? `\n${responseSummary}` : ""}`,
      });
      setConfirmOpen(false);
      if (result.application.status === "Blocked") {
        setFormError("You cannot apply to this campaign.");
        return;
      }
      onSubmitted(result.application);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Application could not be saved. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.shell, modal && styles.modalShell]}
    >
      <View style={[styles.header, !modal && styles.pageInset]}>
        <Pressable accessibilityRole="button" accessibilityLabel={modal ? "Close application" : "Back to campaign details"} onPress={onBack} style={styles.backButton}>
          <AppIcon name={modal ? "close" : "chevron-back"} size={20} color={theme.colors.primary} />
          <Text style={styles.backText}>{modal ? "Close" : "Back"}</Text>
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.title}>Apply to campaign</Text>
          <Text style={styles.subtitle}>Keep your application focused and easy to review.</Text>
        </View>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.form, !modal && styles.pageInset, { paddingBottom: Math.max(insets.bottom, theme.spacing.xl) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <AppCard style={styles.contextCard}>
          <Text style={styles.label}>Applying for</Text>
          <Text style={styles.contextTitle}>{campaign.title}</Text>
          <Text style={styles.meta}>Brand · {campaign.brand}</Text>
          <View style={styles.contextFacts}>
            <View style={styles.contextFact}>
              <AppIcon name="calendar-outline" size={16} color={theme.colors.primary} />
              <View style={styles.flex}>
                <Text style={styles.factLabel}>Campaign deadline</Text>
                <Text style={styles.meta}>{formatCampaignDeadline(campaign.deadlineAt ?? campaign.deadline)}</Text>
              </View>
            </View>
            <View style={styles.contextFact}>
              <AppIcon name="location-outline" size={16} color={theme.colors.primary} />
              <View style={styles.flex}>
                <Text style={styles.factLabel}>Location</Text>
                <Text style={styles.meta}>{campaign.city || "Not specified"}</Text>
              </View>
            </View>
          </View>
          <View style={styles.contextMeta}>
            <Pill label={campaign.category} />
            <Pill label={campaign.budget} />
          </View>
        </AppCard>
        <AppCard style={styles.publicInfoCard}>
          <View style={styles.row}>
            <Avatar initials={currentCreator.initials} uri={currentCreator.avatarUrl} size="small" />
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{currentCreator.name}</Text>
              <Text style={styles.meta}>{currentCreator.niche} · {currentCreator.city}</Text>
            </View>
            <Pill label="Public info" accent />
          </View>
          <Text style={styles.helper}>Only your public profile details are shared with this application.</Text>
          <View style={styles.toggleRow}>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>Share contact details</Text>
              {shareContact ? <Text style={styles.meta}>Email and phone will be visible to this brand.</Text> : null}
            </View>
            <Toggle value={shareContact} onChange={setShareContact} accessibilityLabel="Share contact details with this brand" />
          </View>
        </AppCard>
        {brief.requirements.map((requirement) => (
          <View key={requirement.id} style={styles.fieldGroup}>
            <Text style={styles.label}>{requirement.label}{requirement.required ? " *" : ""}</Text>
            {requirement.type === "file" ? (
              <AppButton label={responses[requirement.id] || "Attach file or media"} icon="attach-outline" variant="secondary" onPress={() => void addFile(requirement.id)} />
            ) : (
              <TextInput
                accessibilityLabel={requirement.label}
                value={responses[requirement.id] ?? ""}
                onChangeText={(value) => setResponse(requirement.id, value)}
                autoCapitalize="none"
                autoCorrect={requirement.type !== "url"}
                keyboardType={requirement.type === "url" ? "url" : "default"}
                placeholder={requirement.type === "url" ? "https://..." : "Add your response"}
                placeholderTextColor={theme.colors.inputPlaceholder}
                multiline={requirement.type === "text"}
                textAlignVertical={requirement.type === "text" ? "top" : "center"}
                style={[styles.input, requirement.type === "text" && styles.textarea]}
              />
            )}
          </View>
        ))}
        <View style={styles.attachmentRow}>
          <AppButton label="Add media" icon="image-outline" variant="secondary" onPress={() => void addMedia()} style={styles.flex} />
          <AppButton label="Add file" icon="document-outline" variant="secondary" onPress={() => void addFile()} style={styles.flex} />
        </View>
        {attachments.length ? <Text style={styles.helper}>{attachments.map((attachment) => attachment.name).join(" · ")}</Text> : null}
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <View style={styles.actions}>
          <AppButton label="Review application" icon="arrow-forward" onPress={reviewApplication} style={styles.fullWidth} />
          <AppButton label="Cancel" variant="secondary" onPress={onBack} style={styles.fullWidth} />
        </View>
      </ScrollView>
      <ConfirmModal
        visible={confirmOpen}
        title="Send this application?"
        message="Your public profile, selected answers, and attachments will be sent to the brand."
        confirmLabel="Send application"
        confirmIcon="paper-plane-outline"
        onCancel={() => { if (!isSubmitting) setConfirmOpen(false); }}
        onConfirm={() => { void submitApplication(); }}
        confirmLoading={isSubmitting}
      />
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme: AppTheme) => createThemeStyles(theme, {
  shell: { flex: 1, width: "100%", minWidth: 0, backgroundColor: theme.colors.transparent },
  modalShell: { width: "100%", maxHeight: "94%", paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: 0, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceRaised },
  header: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm, marginBottom: theme.spacing.sm, paddingBottom: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.cardBorder },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  backText: { color: theme.colors.primary, fontSize: theme.type.body, fontWeight: "800", fontFamily: theme.type.bodyFont },
  flex: { flex: 1, minWidth: 0 },
  title: { color: theme.colors.textPrimary, fontSize: theme.type.title, lineHeight: theme.type.lineHeight.title, fontWeight: "900", fontFamily: theme.type.displayFont, flexShrink: 1 },
  subtitle: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
  scroll: { flex: 1, width: "100%" },
  form: { gap: theme.spacing.sm, width: "100%", paddingBottom: theme.spacing.xl },
  pageInset: { paddingHorizontal: theme.spacing.lg },
  contextCard: { gap: theme.spacing.xs, backgroundColor: theme.colors.surfaceSky },
  contextTitle: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, lineHeight: theme.type.lineHeight.bodyLarge, fontWeight: "900", fontFamily: theme.type.bodyFont },
  contextFacts: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  contextFact: { flex: 1, minWidth: 132, flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.xs },
  factLabel: { color: theme.colors.textSecondary, fontSize: 11, lineHeight: 15, fontWeight: "700", fontFamily: theme.type.bodyFont },
  contextMeta: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs, marginTop: theme.spacing.xs },
  publicInfoCard: { gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceSky },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  cardTitle: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, fontWeight: "800", fontFamily: theme.type.bodyFont },
  meta: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont, flexShrink: 1 },
  helper: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont, flexShrink: 1 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder },
  fieldGroup: { gap: theme.spacing.xs, width: "100%", minWidth: 0 },
  label: { color: theme.colors.textPrimary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
  input: { width: "100%", minWidth: 0, minHeight: 48, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, color: theme.colors.textPrimary, backgroundColor: theme.colors.inputBackground, fontSize: theme.type.body, fontFamily: theme.type.bodyFont, flexShrink: 1 },
  textarea: { minHeight: 84, paddingTop: theme.spacing.sm },
  attachmentRow: { flexDirection: "row", gap: theme.spacing.sm },
  error: { color: theme.colors.danger, fontSize: theme.type.caption, fontWeight: "700", fontFamily: theme.type.bodyFont },
  actions: { gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  fullWidth: { width: "100%" },
});
