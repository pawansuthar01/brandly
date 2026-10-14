import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { selectFileAttachment, selectMediaAttachment } from "../../services/mediaPicker.service";
import { AppButton, AppCard, AppIcon, DateTimeField } from "../../components/ui";
import { validateProductionStage } from "../../lib/productionWorkflow";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import {
  EditingStageData,
  IdeaStageData,
  ProductionStage,
  ProductionStagePayload,
  PublishedStageData,
  ScheduledStageData,
  ScriptingStageData,
  ShootingStageData,
  ThumbnailStageData,
  ContentIdeaAttachment,
} from "../../types/marketplace";
import { CreatorAttachmentRow } from "./CreatorAttachmentRow";

type FormValues = Record<string, string>;
type FieldDefinition = {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
  multiline?: boolean;
  keyboardType?: "default" | "url" | "numbers-and-punctuation";
};

type Props = {
  stage: ProductionStage;
  data?: ProductionStagePayload;
  validationErrors?: Record<string, string>;
  isSaving?: boolean;
  onSaveDraft: (data: ProductionStagePayload) => void;
  onComplete: (data: ProductionStagePayload) => void;
};

const platformOptions = ["Instagram", "YouTube", "Other"] as const;

const fieldsForStage = (stage: ProductionStage): FieldDefinition[] => {
  switch (stage) {
    case "Idea":
      return [
        { key: "concept", label: "Idea / concept", placeholder: "What is the content idea?", required: true, multiline: true },
        { key: "title", label: "Title", placeholder: "Give the project a clear title", required: true },
        { key: "description", label: "Description", placeholder: "Describe the angle and intended audience", required: true, multiline: true },
        { key: "referenceUrl", label: "Reference / video link", placeholder: "https://...", keyboardType: "url" },
        { key: "notes", label: "Notes", placeholder: "Add context or approval notes", multiline: true },
        { key: "budget", label: "Budget / rate", placeholder: "e.g. Under ₹5K" },
        { key: "reminderDate", label: "Reminder date", placeholder: "e.g. 2026-09-30 18:00" },
        { key: "shootLocation", label: "Shoot location", placeholder: "e.g. Home studio" },
        { key: "equipment", label: "Equipment", placeholder: "e.g. Phone, tripod, softbox" },
      ];
    case "Scripting":
      return [
        { key: "hook", label: "Hook", placeholder: "What earns attention in the first seconds?", required: true, multiline: true },
        { key: "script", label: "Script", placeholder: "Write the spoken or visual sequence", required: true, multiline: true },
        { key: "cta", label: "CTA", placeholder: "What should the audience do next?", multiline: true },
        { key: "caption", label: "Caption", placeholder: "Draft the post caption", multiline: true },
        { key: "notes", label: "Notes", placeholder: "Add feedback or approval notes", multiline: true },
      ];
    case "Shooting":
      return [
        { key: "shootDate", label: "Shoot date", placeholder: "YYYY-MM-DD", required: true },
        { key: "shootLocation", label: "Shoot location", placeholder: "Where will this be recorded?", required: true },
        { key: "equipment", label: "Equipment", placeholder: "List the equipment you need", required: true, multiline: true },
        { key: "shotNotes", label: "Shot notes", placeholder: "List shots, framing, or continuity notes", multiline: true },
        { key: "assetsReference", label: "Assets / reference link", placeholder: "https://...", keyboardType: "url" },
      ];
    case "Editing":
      return [
        { key: "editingNotes", label: "Editing notes", placeholder: "Describe the cut, pacing, and sound direction", required: true, multiline: true },
        { key: "editor", label: "Editor / status owner", placeholder: "Who owns the edit?", required: true },
        { key: "status", label: "Edit status", placeholder: "e.g. First cut, review, final" },
        { key: "assetUrl", label: "Edited asset link", placeholder: "https://...", keyboardType: "url" },
        { key: "revisionNotes", label: "Revision notes", placeholder: "Track requested changes", multiline: true },
      ];
    case "Thumbnail":
      return [
        { key: "thumbnailUrl", label: "Thumbnail link", placeholder: "https://...", required: true, keyboardType: "url" },
        { key: "notes", label: "Thumbnail notes", placeholder: "Describe the visual direction", multiline: true },
        { key: "revisionInfo", label: "Revision information", placeholder: "Track review or revision details", multiline: true },
      ];
    case "Scheduled":
      return [
        { key: "scheduledDate", label: "Scheduled date", placeholder: "YYYY-MM-DD", required: true },
        { key: "scheduledTime", label: "Scheduled time", placeholder: "HH:MM or h:MM AM/PM", required: true },
        { key: "platform", label: "Platform", placeholder: "Choose a platform", required: true },
        { key: "publishingNotes", label: "Publishing notes", placeholder: "Add final publishing instructions", multiline: true },
      ];
    case "Published":
      return [
        { key: "publishedUrl", label: "Published URL", placeholder: "https://...", required: true, keyboardType: "url" },
        { key: "publishedDate", label: "Published date", placeholder: "YYYY-MM-DD", required: true },
        { key: "publishedTime", label: "Published time", placeholder: "HH:MM or h:MM AM/PM", required: true },
        { key: "platform", label: "Platform", placeholder: "Choose a platform", required: true },
        { key: "finalNotes", label: "Final publish notes", placeholder: "Add the final result or handoff notes", multiline: true },
        { key: "status", label: "Final status", placeholder: "e.g. Live" },
      ];
  }
};

const stageTitle = (stage: ProductionStage) => {
  switch (stage) {
    case "Idea": return "Shape the idea";
    case "Scripting": return "Write the story";
    case "Shooting": return "Prepare the shoot";
    case "Editing": return "Move the edit forward";
    case "Thumbnail": return "Prepare the thumbnail";
    case "Scheduled": return "Plan the release";
    case "Published": return "Record the result";
  }
};

const valuesFromData = (stage: ProductionStage, data?: ProductionStagePayload): FormValues => {
  switch (stage) {
    case "Idea": {
      const value = (data ?? {}) as Partial<IdeaStageData>;
      return { concept: value.concept ?? "", title: value.title ?? "", description: value.description ?? "", notes: value.notes ?? "", referenceUrl: value.referenceUrl ?? "", budget: value.budget ?? "", reminderDate: value.reminderDate ?? "", shootLocation: value.shootLocation ?? "", equipment: value.equipment ?? "" };
    }
    case "Scripting": {
      const value = (data ?? {}) as Partial<ScriptingStageData>;
      return { hook: value.hook ?? "", script: value.script ?? "", cta: value.cta ?? "", caption: value.caption ?? "", notes: value.notes ?? "" };
    }
    case "Shooting": {
      const value = (data ?? {}) as Partial<ShootingStageData>;
      return { shootDate: value.shootDate ?? "", shootLocation: value.shootLocation ?? "", equipment: value.equipment ?? "", shotNotes: value.shotNotes ?? "", assetsReference: value.assetsReference ?? "" };
    }
    case "Editing": {
      const value = (data ?? {}) as Partial<EditingStageData>;
      return { editingNotes: value.editingNotes ?? "", editor: value.editor ?? "", status: value.status ?? "", assetUrl: value.assetUrl ?? "", revisionNotes: value.revisionNotes ?? "" };
    }
    case "Thumbnail": {
      const value = (data ?? {}) as Partial<ThumbnailStageData>;
      return { thumbnailUrl: value.thumbnailUrl ?? "", notes: value.notes ?? "", revisionInfo: value.revisionInfo ?? "" };
    }
    case "Scheduled": {
      const value = (data ?? {}) as Partial<ScheduledStageData>;
      return { scheduledDate: value.scheduledDate ?? "", scheduledTime: value.scheduledTime ?? "", platform: value.platform ?? "Instagram", publishingNotes: value.publishingNotes ?? "" };
    }
    case "Published": {
      const value = (data ?? {}) as Partial<PublishedStageData>;
      return { publishedUrl: value.publishedUrl ?? "", publishedDate: value.publishedDate ?? "", publishedTime: value.publishedTime ?? "", platform: value.platform ?? "Instagram", finalNotes: value.finalNotes ?? "", status: value.status ?? "Live" };
    }
  }
};

const dataFromValues = (stage: ProductionStage, values: FormValues): ProductionStagePayload => {
  switch (stage) {
    case "Idea": return { concept: values.concept ?? "", title: values.title ?? "", description: values.description ?? "", notes: values.notes ?? "", referenceUrl: values.referenceUrl ?? "", budget: values.budget ?? "", reminderDate: values.reminderDate ?? "", shootLocation: values.shootLocation ?? "", equipment: values.equipment ?? "" };
    case "Scripting": return { script: values.script ?? "", hook: values.hook ?? "", cta: values.cta ?? "", caption: values.caption ?? "", notes: values.notes ?? "" };
    case "Shooting": return { shootDate: values.shootDate ?? "", shootLocation: values.shootLocation ?? "", equipment: values.equipment ?? "", shotNotes: values.shotNotes ?? "", assetsReference: values.assetsReference ?? "" };
    case "Editing": return { editingNotes: values.editingNotes ?? "", editor: values.editor ?? "", status: values.status ?? "", assetUrl: values.assetUrl ?? "", revisionNotes: values.revisionNotes ?? "" };
    case "Thumbnail": return { thumbnailUrl: values.thumbnailUrl ?? "", notes: values.notes ?? "", revisionInfo: values.revisionInfo ?? "" };
    case "Scheduled": return { scheduledDate: values.scheduledDate ?? "", scheduledTime: values.scheduledTime ?? "", platform: (values.platform === "YouTube" || values.platform === "Other" ? values.platform : "Instagram"), publishingNotes: values.publishingNotes ?? "" };
    case "Published": return { publishedUrl: values.publishedUrl ?? "", publishedDate: values.publishedDate ?? "", publishedTime: values.publishedTime ?? "", platform: (values.platform === "YouTube" || values.platform === "Other" ? values.platform : "Instagram"), finalNotes: values.finalNotes ?? "", status: values.status ?? "" };
  }
};

export function ProductionStageForm({ stage, data, validationErrors, isSaving = false, onSaveDraft, onComplete }: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [values, setValues] = useState<FormValues>(() => valuesFromData(stage, data));
  const [attachments, setAttachments] = useState<ContentIdeaAttachment[]>(() => data?.attachments ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attachmentError, setAttachmentError] = useState("");

  useEffect(() => {
    setValues(valuesFromData(stage, data));
    setAttachments(data?.attachments ?? []);
    setAttachmentError("");
    setErrors(validationErrors ?? {});
  }, [data, stage, validationErrors]);

  const updateValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  const updateAttachments = (attachments: ContentIdeaAttachment[]) => {
    setAttachments(attachments);
    setAttachmentError("");
  };
  const appendAttachments = (items: ContentIdeaAttachment[]) => {
    setAttachments((current) => [...current, ...items]);
    setAttachmentError("");
  };
  const addMedia = async () => {
    try {
      const selected = await selectMediaAttachment();
      if (selected.length) appendAttachments(selected);
    } catch {
      setAttachmentError("Media could not be attached. Please try again.");
    }
  };
  const addFile = async () => {
    try {
      const selected = await selectFileAttachment();
      if (selected) appendAttachments([selected]);
    } catch {
      setAttachmentError("File could not be attached. Please try again.");
    }
  };
  const draftData = () => ({ ...dataFromValues(stage, values), attachments });
  const saveDraft = () => {
    onSaveDraft(draftData());
    setErrors({});
  };
  const complete = () => {
    const nextData = draftData();
    const validation = validateProductionStage(stage, nextData);
    if (!validation.valid) {
      onSaveDraft(nextData);
      setErrors(validation.errors);
      return;
    }
    onComplete(nextData);
    setErrors({});
  };

  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.title}>{stageTitle(stage)}</Text>
          <Text style={styles.subtitle}>Save a draft while you work, then complete this stage when the required information is ready.</Text>
        </View>
        <Text style={styles.stageLabel}>{stage}</Text>
      </View>
      {fieldsForStage(stage).map((field) => (
        <View key={field.key} style={styles.fieldGroup}>
          <Text style={styles.label}>{field.label}{field.required ? " *" : ""}</Text>
          {field.key === "platform" ? (
            <View style={styles.platformRow}>
              {platformOptions.map((option) => {
                const selected = values.platform === option;
                return <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => updateValue("platform", option)} style={[styles.platformChip, selected && styles.platformChipActive]}><Text style={[styles.platformText, selected && styles.platformTextActive]}>{option}</Text></Pressable>;
              })}
            </View>
          ) : field.key.endsWith("Date") || field.key === "reminderDate" || field.key.endsWith("Time") ? (
            <DateTimeField
              label={field.label}
              hideLabel
              value={values[field.key] ?? ""}
              mode={field.key.endsWith("Time") ? "time" : "date"}
              onChange={(value) => updateValue(field.key, value)}
              placeholder={field.placeholder}
            />
          ) : (
            <TextInput
              accessibilityLabel={field.label}
              value={values[field.key] ?? ""}
              onChangeText={(value) => updateValue(field.key, value)}
              placeholder={field.placeholder}
              placeholderTextColor={theme.colors.inputPlaceholder}
              autoCapitalize={field.keyboardType === "url" ? "none" : "sentences"}
              autoCorrect={field.keyboardType !== "url"}
              keyboardType={field.keyboardType ?? "default"}
              multiline={field.multiline}
              scrollEnabled={field.multiline}
              textAlignVertical={field.multiline ? "top" : "center"}
              style={[styles.input, field.multiline && styles.textarea, errors[field.key] && styles.inputError]}
            />
          )}
          {errors[field.key] ? <Text style={styles.error}>{errors[field.key]}</Text> : null}
        </View>
      ))}
      <View style={styles.attachmentGroup}>
        <View style={styles.attachmentHeader}><View style={styles.flex}><Text style={styles.label}>Step media and files</Text><Text style={styles.attachmentHint}>Attach references, footage, documents, or final assets to this stage.</Text></View><AppIcon name="attach-outline" size={19} color={theme.colors.primary} /></View>
        <View style={styles.attachmentButtons}><AppButton label="Add media" icon="images-outline" compact variant="secondary" onPress={() => void addMedia()} style={styles.attachmentButton} /><AppButton label="Add file" icon="document-attach-outline" compact variant="secondary" onPress={() => void addFile()} style={styles.attachmentButton} /></View>
        {attachments.map((attachment) => <CreatorAttachmentRow key={attachment.id} attachment={attachment} onRemove={() => updateAttachments(attachments.filter((item) => item.id !== attachment.id))} />)}
        {attachmentError ? <Text style={styles.error}>{attachmentError}</Text> : null}
      </View>
      {errors.stage ? <Text style={styles.error}>{errors.stage}</Text> : null}
      <View style={styles.actions}>
        <AppButton label="Save draft" icon="save-outline" variant="secondary" loading={isSaving} onPress={saveDraft} style={styles.action} />
        <AppButton label={`Complete ${stage}`} icon="checkmark" loading={isSaving} onPress={complete} style={styles.action} />
      </View>
    </AppCard>
  );
}

const makeStyles = (theme: AppTheme) => createThemeStyles(theme, {
  card: { gap: theme.spacing.md, backgroundColor: theme.colors.surfaceSky, borderWidth: 0 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  title: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, fontWeight: "900", fontFamily: theme.type.bodyFont },
  subtitle: { marginTop: theme.spacing.xs, color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
  stageLabel: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "900", fontFamily: theme.type.bodyFont },
  fieldGroup: { gap: theme.spacing.xs },
  attachmentGroup: { gap: theme.spacing.sm, paddingTop: theme.spacing.xs },
  attachmentHeader: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  attachmentHint: { marginTop: theme.spacing.xs, color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
  attachmentButtons: { flexDirection: "row", gap: theme.spacing.sm },
  attachmentButton: { flex: 1 },
  label: { color: theme.colors.textPrimary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
  input: { minHeight: 46, paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceRaised, color: theme.colors.textPrimary, fontSize: theme.type.body, fontFamily: theme.type.bodyFont },
  textarea: { minHeight: 88, paddingTop: theme.spacing.sm },
  inputError: { borderWidth: 1, borderColor: theme.colors.danger },
  error: { color: theme.colors.danger, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
  platformRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
  platformChip: { minHeight: 42, justifyContent: "center", paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceRaised },
  platformChipActive: { backgroundColor: theme.colors.primary },
  platformText: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
  platformTextActive: { color: theme.colors.primaryText },
  actions: { flexDirection: "row", gap: theme.spacing.sm },
  action: { flex: 1 },
});
