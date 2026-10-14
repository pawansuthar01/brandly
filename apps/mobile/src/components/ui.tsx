import { ReactNode, useEffect, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Image as ExpoImage } from "expo-image";
import {
  Animated,
  ActivityIndicator,
  Easing,
  Modal,
  Pressable,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../providers/ThemeProvider";
import { selectImageAttachment } from "../services/mediaPicker.service";
import { AppTheme } from "../styles/theme";
import { createThemeStyles } from "../styles/createThemeStyles";
import { TabName } from "../types/marketplace";

export const NATIVE_ANIMATIONS_ENABLED = Platform.OS !== "web";

export function AppButton({
  label,
  onPress,
  variant = "primary",
  tone,
  compact = false,
  icon,
  iconAfter = false,
  style,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  tone?: "secondary" | "tertiary";
  compact?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconAfter?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const isDisabled = disabled || loading;
  const buttonColor = (key: string, fallback: string) => typeof theme.components.button?.[key] === "string" ? theme.components.button[key] as string : fallback;
  const iconColor =
      tone === "secondary"
      ? buttonColor("toneSecondaryForeground", theme.colors.secondaryText)
      : tone === "tertiary"
      ? buttonColor("toneTertiaryForeground", theme.colors.tertiaryText)
      : variant === "secondary"
      ? buttonColor("secondaryForeground", theme.colors.textPrimary)
      : variant === "danger"
      ? buttonColor("dangerForeground", theme.colors.primaryText)
      : variant === "primary"
      ? buttonColor("foreground", theme.colors.primaryText)
      : buttonColor("foreground", theme.colors.primary);
  return (
    <Pressable
      testID="theme-component-button"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        style,
        compact && styles.buttonCompact,
        variant === "secondary" && styles.buttonSecondary,
        variant === "ghost" && styles.buttonGhost,
        variant === "danger" && styles.buttonDanger,
        tone === "secondary" && styles.buttonToneSecondary,
        tone === "tertiary" && styles.buttonToneTertiary,
        isDisabled && styles.buttonDisabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : icon && !iconAfter ? (
        <AppIcon name={icon} size={16} color={iconColor} />
      ) : null}
      <Text
        style={[
          styles.buttonText,
          variant === "secondary" && styles.buttonTextSecondary,
          variant === "ghost" && styles.buttonTextGhost,
          variant === "danger" && styles.buttonTextDanger,
          tone === "secondary" && styles.buttonTextToneSecondary,
          tone === "tertiary" && styles.buttonTextToneTertiary,
        ]}
      >
        {label}
      </Text>
      {!loading && icon && iconAfter ? (
        <AppIcon name={icon} size={16} color={iconColor} />
      ) : null}
    </Pressable>
  );
}

export function AppCard({
  children,
  onPress,
  style,
  flat = false,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  flat?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      testID="theme-component-card"
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        flat && styles.cardFlat,
        style,
        typeof theme.components.card.border === "string" && { borderColor: theme.components.card.border },
        typeof theme.components.card.radius === "number" && { borderRadius: theme.components.card.radius },
        typeof theme.components.card.borderWidth === "number" && { borderWidth: theme.components.card.borderWidth },
        typeof theme.components.card.padding === "number" && { padding: theme.components.card.padding },
        pressed && onPress && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmIcon = "checkmark",
  destructive = false,
  tertiaryLabel,
  tertiaryIcon = "trash-outline",
  tertiaryDestructive = false,
  onConfirm,
  onCancel,
  onTertiary,
  confirmLoading = false,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmIcon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  tertiaryLabel?: string;
  tertiaryIcon?: keyof typeof Ionicons.glyphMap;
  tertiaryDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onTertiary?: () => void;
  confirmLoading?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const stackActions = width < 360 || Boolean(tertiaryLabel && onTertiary);
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
        <View style={[styles.confirmOverlay, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close confirmation dialog"
          onPress={onCancel}
          style={styles.confirmBackdrop}
        />
        <View accessibilityViewIsModal style={styles.confirmCard}>
          <View style={styles.confirmIcon}>
            <AppIcon
              name={destructive ? "alert-circle-outline" : "help-circle-outline"}
              size={24}
              color={destructive ? theme.colors.danger : theme.colors.primary}
            />
          </View>
          <Text style={styles.confirmTitle}>{title}</Text>
          <Text style={styles.confirmMessage}>{message}</Text>
          <View
            style={[
              styles.confirmActions,
              stackActions && styles.confirmActionsStack,
            ]}
          >
            {tertiaryLabel && onTertiary ? (
              <AppButton
                label={tertiaryLabel}
                variant={tertiaryDestructive ? "danger" : "secondary"}
                icon={tertiaryIcon}
                onPress={onTertiary}
                style={[styles.confirmAction, stackActions && styles.confirmActionStack]}
              />
            ) : null}
            <AppButton
              label={cancelLabel}
              variant="secondary"
              onPress={onCancel}
              style={[styles.confirmAction, stackActions && styles.confirmActionStack]}
            />
            <AppButton
              label={confirmLabel}
              variant={destructive ? "danger" : "primary"}
              icon={confirmIcon}
              onPress={onConfirm}
              loading={confirmLoading}
              style={[styles.confirmAction, stackActions && styles.confirmActionStack]}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function Avatar({
  initials,
  uri,
  size = "normal",
}: {
  initials: string;
  uri?: string;
  size?: "small" | "normal" | "large";
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [failedUri, setFailedUri] = useState<string | undefined>();
  useEffect(() => {
    setFailedUri(undefined);
  }, [uri]);
  const showImage = Boolean(uri && uri !== failedUri);
  return (
    <View
      style={[
        styles.avatar,
        size === "small" && styles.avatarSmall,
        size === "large" && styles.avatarLarge,
      ]}
    >
      {showImage ? (
        <ExpoImage
          accessibilityLabel={`${initials} profile photo`}
          source={uri}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
          style={styles.avatarImage}
          onError={() => setFailedUri(uri)}
        />
      ) : (
        <Text
          style={[
            styles.avatarText,
            size === "large" && styles.avatarTextLarge,
          ]}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

export function ProfilePhotoPicker({
  initials,
  uri,
  onChange,
  title = "Profile photo",
  hint = "Use a clear photo so people recognise you.",
  compact = false,
}: {
  initials: string;
  uri?: string;
  onChange: (uri: string) => void;
  title?: string;
  hint?: string;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [isPicking, setIsPicking] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const pickPhoto = async () => {
    if (isPicking) return;
    setIsPicking(true);
    setPickerError('');
    try {
      const item = await selectImageAttachment();
      if (item) onChange(item.uri);
    } catch {
      setPickerError('Photo could not be selected. Please try again.');
    } finally {
      setIsPicking(false);
    }
  };
  return (
    <View style={[styles.profilePhotoPicker, compact && styles.profilePhotoPickerCompact]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={uri ? "Change profile image" : title}
        disabled={isPicking}
        onPress={pickPhoto}
        style={({ pressed }) => [compact && styles.profilePhotoCompactPressable, pressed && styles.pressed]}
      >
        <Avatar initials={initials} uri={uri} size={compact ? "small" : "large"} />
        {compact ? (
          <View style={styles.profilePhotoCameraBadge}>
            <AppIcon name="camera-outline" size={12} color={theme.colors.primaryText} />
          </View>
        ) : null}
      </Pressable>
      <View style={[styles.profilePhotoCopy, compact && styles.profilePhotoCopyCompact]}>
        <Text style={[styles.profilePhotoTitle, compact && styles.profilePhotoTitleCompact]}>{title}</Text>
        <Text style={[styles.profilePhotoHint, compact && styles.profilePhotoHintCompact]}>{hint}</Text>
        {pickerError ? <Text accessibilityRole="alert" style={[styles.profilePhotoHint, { color: theme.colors.danger }]}>{pickerError}</Text> : null}
        {!compact ? (
          <AppButton
            label={isPicking ? "Opening photos…" : uri ? "Change photo" : "Upload photo"}
            variant="secondary"
            compact
            icon="image-outline"
            disabled={isPicking}
            onPress={pickPhoto}
          />
        ) : null}
      </View>
    </View>
  );
}

export function AppIcon({
  name,
  size = 20,
  color,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
}) {
  const { theme } = useTheme();
  return (
    <Ionicons name={name} size={size} color={color ?? theme.colors.primary} />
  );
}

export function IconButton({
  name,
  label,
  onPress,
  selected = false,
  variant = "default",
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  selected?: boolean;
  variant?: "default" | "primary";
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        variant === "primary" && styles.iconButtonPrimary,
        selected && styles.iconButtonSelected,
        pressed && styles.pressed,
      ]}
    >
      <AppIcon
        name={name}
        size={20}
        color={variant === "primary" ? theme.colors.primaryText : selected ? theme.colors.primary : theme.colors.textPrimary}
      />
    </Pressable>
  );
}

export type OverflowMenuAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function OverflowMenu({ label, actions }: { label: string; actions: OverflowMenuAction[] }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [visible, setVisible] = useState(false);
  const menuProgress = useRef(new Animated.Value(0)).current;
  if (!actions.length) return null;
  const openMenu = () => {
    setVisible(true);
    menuProgress.setValue(0);
    Animated.timing(menuProgress, {
      toValue: 1,
      duration: 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
    }).start();
  };
  const closeMenu = () => {
    menuProgress.stopAnimation();
    setVisible(false);
  };
  return (
    <View style={styles.overflowWrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={(event) => {
          event.stopPropagation();
          visible ? closeMenu() : openMenu();
        }}
        style={({ pressed }) => [styles.overflowButton, pressed && styles.pressed]}
      >
        <AppIcon name="ellipsis-horizontal" size={19} color={theme.colors.textSecondary} />
      </Pressable>
      {visible ? <>
        <Pressable accessibilityRole="button" accessibilityLabel="Close actions" onPress={(event) => { event.stopPropagation(); closeMenu(); }} style={styles.menuDismiss} />
        <Animated.View accessibilityViewIsModal style={[styles.menuCard, { opacity: menuProgress, transform: [{ scale: menuProgress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
          {actions.map((action, index) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={(event) => { event.stopPropagation(); closeMenu(); action.onPress(); }}
              style={({ pressed }) => [styles.menuAction, pressed && styles.pressed]}
            >
              <View style={[styles.menuActionIcon, index % 3 === 0 ? styles.menuActionIconSky : index % 3 === 1 ? styles.menuActionIconMint : styles.menuActionIconBlush, action.destructive && styles.menuActionIconDanger]}>
                <AppIcon name={action.icon ?? "chevron-forward-outline"} size={16} color={action.destructive ? theme.colors.danger : theme.colors.primary} />
              </View>
              <Text style={[styles.menuActionText, action.destructive && styles.menuActionTextDanger]}>{action.label}</Text>
            </Pressable>
          ))}
        </Animated.View>
      </> : null}
    </View>
  );
}

export function Skeleton({
  height = 16,
  width = "100%",
}: {
  height?: number;
  width?: number | `${number}%`;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return <View style={[styles.skeleton, { height, width }]} />;
}

export function MarketplaceCardSkeleton() {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.marketplaceSkeleton}>
      <View style={styles.skeletonAvatar} />
      <View style={styles.skeletonContent}>
        <Skeleton width="48%" />
        <Skeleton width="72%" height={12} />
        <Skeleton width="32%" height={12} />
        <View style={styles.skeletonFooter}>
          <Skeleton width="26%" height={12} />
          <Skeleton width="38%" height={12} />
        </View>
      </View>
    </View>
  );
}

export function ScreenSkeleton({ count = 3 }: { count?: number }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading content" style={styles.screenSkeleton}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.screenSkeletonCard}>
          <View style={styles.screenSkeletonIcon} />
          <View style={styles.skeletonContent}>
            <Skeleton width={index % 2 ? "62%" : "48%"} height={16} />
            <Skeleton width="86%" height={12} />
            <Skeleton width={index % 2 ? "42%" : "58%"} height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function Toggle({
  value,
  onChange,
  disabled = false,
  accessibilityLabel = "Toggle setting",
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[styles.toggle, value && styles.toggleOn, disabled && styles.toggleDisabled]}
    >
      <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
    </Pressable>
  );
}

export function Pill({
  label,
  accent = false,
  icon,
  style,
}: {
  label: string;
  accent?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const statusIcon = icon ?? ({
    draft: "create-outline",
    published: "megaphone-outline",
    open: "radio-outline",
    "proposal sent": "paper-plane-outline",
    accepted: "checkmark-circle-outline",
    completed: "checkmark-circle-outline",
    closed: "close-circle-outline",
    archived: "archive-outline",
    private: "lock-closed-outline",
    public: "globe-outline",
    pending: "time-outline",
    paid: "card-outline",
    rejected: "close-circle-outline",
    declined: "close-circle-outline",
    blocked: "ban-outline",
    unavailable: "ban-outline",
    "in progress": "time-outline",
    "waiting for review": "time-outline",
  } as Record<string, keyof typeof Ionicons.glyphMap>)[label.trim().toLowerCase()];
  return (
    <View testID="theme-component-badge" style={[styles.pill, accent && styles.pillAccent, style]}>
      {statusIcon ? <AppIcon name={statusIcon} size={13} color={accent ? theme.colors.accentText : theme.colors.textSecondary} /> : null}
      <Text style={[styles.pillText, accent && styles.pillTextAccent]}>
        {label}
      </Text>
    </View>
  );
}

export function FilterChip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      testID="theme-component-chip"
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        selected && styles.filterChipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.filterChipText,
          selected && styles.filterChipTextSelected,
        ]}
      >
        {label}
      </Text>
      {selected ? (
        <AppIcon name="checkmark" size={15} color={theme.colors.primary} />
      ) : null}
    </Pressable>
  );
}

export function RangeSlider({
  label,
  minValue,
  maxValue,
  onChange,
  minimum,
  maximum,
  step,
  formatValue,
}: {
  label: string;
  minValue: string;
  maxValue: string;
  onChange: (range: { min: string; max: string }) => void;
  minimum: number;
  maximum: number;
  step: number;
  formatValue: (value: number) => string;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [trackWidth, setTrackWidth] = useState(0);
  const activeThumb = useRef<"min" | "max">("min");
  const toNumber = (value: string, fallback: number) => {
    const parsed = Number(value);
    return value === "" || !Number.isFinite(parsed) ? fallback : parsed;
  };
  const selectedMin = Math.min(
    maximum,
    Math.max(minimum, toNumber(minValue, minimum)),
  );
  const selectedMax = Math.max(
    selectedMin,
    Math.min(maximum, toNumber(maxValue, maximum)),
  );
  const decimalPlaces = (String(step).split(".")[1] ?? "").length;
  const minPercent = ((selectedMin - minimum) / (maximum - minimum)) * 100;
  const maxPercent = ((selectedMax - minimum) / (maximum - minimum)) * 100;
  const updateFromPosition = (position: number) => {
    if (!trackWidth) return;
    const raw =
      minimum +
      (Math.max(0, Math.min(trackWidth, position)) / trackWidth) *
        (maximum - minimum);
    const value = Number(
      (Math.round(raw / step) * step).toFixed(decimalPlaces),
    );
    const moveMin =
      activeThumb.current === "min"
        ? value <= selectedMax
        : value < selectedMin;
    if (moveMin) {
      const nextMin = Math.min(value, selectedMax);
      onChange({
        min: nextMin === minimum ? "" : String(nextMin),
        max: selectedMax === maximum ? "" : String(selectedMax),
      });
      return;
    }
    const nextMax = Math.max(value, selectedMin);
    onChange({
      min: selectedMin === minimum ? "" : String(selectedMin),
      max: nextMax === maximum ? "" : String(nextMax),
    });
  };
  const selectThumb = (position: number) => {
    const percent = trackWidth ? (position / trackWidth) * 100 : 0;
    activeThumb.current =
      Math.abs(percent - minPercent) <= Math.abs(percent - maxPercent)
        ? "min"
        : "max";
    updateFromPosition(position);
  };
  return (
    <View accessibilityLabel={label} style={styles.rangeSlider}>
      <View style={styles.rangeSliderValues}>
        <View style={styles.rangeValueBadge}>
          <Text style={styles.rangeValueLabel}>Min</Text>
          <Text style={styles.rangeValueText}>{formatValue(selectedMin)}</Text>
        </View>
        <View style={styles.rangeValueBadge}>
          <Text style={styles.rangeValueLabel}>Max</Text>
          <Text style={styles.rangeValueText}>{formatValue(selectedMax)}</Text>
        </View>
      </View>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{
          min: minimum,
          max: maximum,
          now: selectedMin,
          text: `${formatValue(selectedMin)} to ${formatValue(selectedMax)}`,
        }}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => selectThumb(event.nativeEvent.locationX)}
        onResponderMove={(event) =>
          updateFromPosition(event.nativeEvent.locationX)
        }
        style={styles.rangeTrackTouch}
      >
        <View style={styles.rangeTrack} />
        <View
          pointerEvents="none"
          style={[
            styles.rangeTrackFill,
            { left: `${minPercent}%`, width: `${maxPercent - minPercent}%` },
          ]}
        />
        <View
          pointerEvents="none"
          style={[styles.rangeThumb, { left: `${minPercent}%` }]}
        />
        <View
          pointerEvents="none"
          style={[styles.rangeThumb, { left: `${maxPercent}%` }]}
        />
      </View>
    </View>
  );
}

export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionHeading}>{title}</Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          hitSlop={8}
          onPress={onAction}
          style={({ pressed }) => [styles.titleAction, pressed && styles.pressed]}
        >
          <Text style={styles.link}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SearchField({
  value,
  onChangeText,
  onFilter,
  filterActive = false,
  placeholder = "Search creators, city or niche",
  accessibilityLabel = "Search creators",
}: {
  value: string;
  onChangeText: (value: string) => void;
  onFilter?: () => void;
  filterActive?: boolean;
  placeholder?: string;
  accessibilityLabel?: string;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [focused, setFocused] = useState(false);
  return (
    <View testID="theme-component-input" style={[styles.search, focused && styles.searchFocused]}>
      <AppIcon
        name="search-outline"
        size={20}
        color={theme.colors.textSecondary}
      />
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={theme.colors.inputPlaceholder}
        style={styles.searchInput}
      />
      {onFilter ? (
        <IconButton
          name="options-outline"
          label="Open filters"
          selected={filterActive}
          onPress={onFilter}
        />
      ) : null}
    </View>
  );
}

type DateTimeFieldMode = "date" | "time";
type DateTimeFieldFormat = "iso" | "short";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parseDateTimeFieldValue = (value: string, mode: DateTimeFieldMode) => {
  const now = new Date();
  if (mode === "date") {
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12);
      if (!Number.isNaN(date.getTime())) return date;
    }
    const short = value.match(/^(\d{1,2})\s+([A-Za-z]{3})(?:\s+(\d{4}))?$/);
    if (short) {
      const month = SHORT_MONTHS.findIndex((item) => item.toLowerCase() === short[2].toLowerCase());
      if (month >= 0) return new Date(short[3] ? Number(short[3]) : now.getFullYear(), month, Number(short[1]), 12);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12) : parsed;
  }
  const time = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (time) {
    let hours = Number(time[1]);
    const minutes = Number(time[2]);
    const meridiem = time[3]?.toUpperCase();
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      now.setHours(hours, minutes, 0, 0);
      return now;
    }
  }
  return now;
};

const formatDateTimeFieldValue = (date: Date, mode: DateTimeFieldMode, format: DateTimeFieldFormat) => {
  if (mode === "date") {
    if (format === "short") return `${String(date.getDate()).padStart(2, "0")} ${SHORT_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  const hours = date.getHours();
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(date.getMinutes()).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
};

const isRecognizedDateTimeFieldValue = (value: string, mode: DateTimeFieldMode) =>
  mode === "date"
    ? /^(\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3})/.test(value)
    : /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.test(value);

export function DateTimeField({
  label,
  value,
  onChange,
  mode,
  format = "iso",
  placeholder = "Choose",
  hideLabel = false,
  accessibilityLabel,
  style,
  minimumDate,
  maximumDate,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode: DateTimeFieldMode;
  format?: DateTimeFieldFormat;
  placeholder?: string;
  hideLabel?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [open, setOpen] = useState(false);
  const pickerValue = parseDateTimeFieldValue(value, mode);
  const recognizedValue = isRecognizedDateTimeFieldValue(value.trim(), mode);
  const displayValue = value.trim()
    ? mode === "date" && recognizedValue
      ? `${String(pickerValue.getDate()).padStart(2, "0")} ${SHORT_MONTHS[pickerValue.getMonth()]}${format === "iso" ? ` ${pickerValue.getFullYear()}` : ""}`
      : value
    : placeholder;
  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setOpen(false);
    if (event.type === "dismissed" || !selected) return;
    onChange(formatDateTimeFieldValue(selected, mode, format));
  };
  return (
    <View style={style}>
      {!hideLabel ? <Text style={styles.dateTimeFieldLabel}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.dateTimeField, pressed && styles.pressed]}
      >
        <AppIcon name={mode === "date" ? "calendar-outline" : "time-outline"} size={18} color={theme.colors.primary} />
        <Text style={[styles.dateTimeFieldValue, !value.trim() && styles.dateTimeFieldPlaceholder]}>{displayValue}</Text>
        <AppIcon name="chevron-down" size={17} color={theme.colors.textSecondary} />
      </Pressable>
      {open && Platform.OS === "android" ? (
        <DateTimePicker value={pickerValue} mode={mode} display="default" onChange={handleChange} minimumDate={minimumDate} maximumDate={maximumDate} />
      ) : null}
      {open && Platform.OS === "ios" ? (
        <Modal transparent animationType="slide" visible onRequestClose={() => setOpen(false)}>
          <View style={styles.dateTimePickerOverlay}>
            <Pressable style={styles.dateTimePickerBackdrop} onPress={() => setOpen(false)} />
            <View style={styles.dateTimePickerCard}>
              <View style={styles.dateTimePickerHeader}>
                <Text style={styles.dateTimePickerTitle}>{label}</Text>
                <AppButton compact variant="secondary" label="Done" onPress={() => setOpen(false)} />
              </View>
              <DateTimePicker value={pickerValue} mode={mode} display="spinner" onChange={handleChange} minimumDate={minimumDate} maximumDate={maximumDate} />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

export function BottomTabs({
  active,
  role,
  onChange,
  onChat,
  chatActive = false,
  chatUnreadCount = 0,
}: {
  active: TabName;
  role: "Brand" | "Influencer";
  onChange: (tab: TabName) => void;
  onChat: () => void;
  chatActive?: boolean;
  chatUnreadCount?: number;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const barHeight = typeof theme.components.navigation.height === "number" ? theme.components.navigation.height : 56;
  const tabs: {
    name: TabName | "Chat";
    icon: keyof typeof Ionicons.glyphMap;
  }[] = role === "Brand"
      ? [
        { name: "Home", icon: "home-outline" },
        { name: "Campaigns", icon: "megaphone-outline" },
        { name: "Discover", icon: "people-outline" },
        { name: "Chat", icon: "chatbubbles-outline" },
        { name: "Calendar", icon: "calendar-outline" },
        { name: "Budget", icon: "wallet-outline" },
      ]
    : [
        { name: "Home", icon: "home-outline" },
        { name: "Studio", icon: "videocam-outline" },
        { name: "Calendar", icon: "calendar-outline" },
        { name: "Market", icon: "briefcase-outline" },
        { name: "Chat", icon: "chatbubbles-outline" },
      ];
  const isCompact = width / tabs.length < 54;
  const matchedIndex = tabs.findIndex((tab) => (chatActive ? tab.name === "Chat" : tab.name === active));
  const activeIndex = Math.max(0, matchedIndex);
  const indicator = useRef(new Animated.Value(activeIndex)).current;
  const tabWidth = width / tabs.length;
  useEffect(() => {
    Animated.timing(indicator, {
      toValue: activeIndex,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_ANIMATIONS_ENABLED,
    }).start();
  }, [activeIndex, indicator]);
  return (
    <View
      testID="theme-component-navigation"
      style={[
        styles.tabs,
        {
          height: barHeight + insets.bottom,
          minHeight: barHeight + insets.bottom,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tabIndicator,
          {
            width: tabWidth,
            height: barHeight,
            bottom: insets.bottom,
            opacity: matchedIndex >= 0 ? 1 : 0,
            transform: [
              {
                translateX: indicator.interpolate({
                  inputRange: [0, Math.max(1, tabs.length - 1)],
                  outputRange: [0, tabWidth * Math.max(1, tabs.length - 1)],
                }),
              },
            ],
          },
        ]}
      ><View style={styles.tabIndicatorLine} /></Animated.View>
      {tabs.map((tab) => (
        <BottomTabItem
          key={tab.name}
          tab={tab}
          active={chatActive ? tab.name === "Chat" : active === tab.name}
          compact={isCompact}
          chatUnreadCount={tab.name === "Chat" ? chatUnreadCount : 0}
          onPress={() =>
            tab.name === "Chat" ? onChat() : onChange(tab.name)
          }
        />
      ))}
    </View>
  );
}

function BottomTabItem({
  tab,
  active,
  compact,
  chatUnreadCount = 0,
  onPress,
}: {
  tab: { name: TabName | "Chat"; icon: keyof typeof Ionicons.glyphMap };
  active: boolean;
  compact: boolean;
  chatUnreadCount?: number;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={tab.name}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
    >
      <View style={[styles.tabIconWrap, compact && styles.tabIconWrapCompact]}>
          <AppIcon
            name={tab.icon}
            size={18}
            color={
              active ? theme.colors.accentText : theme.colors.textSecondary
            }
        />
        {chatUnreadCount > 0 ? <View style={styles.tabUnreadBadge}><Text style={styles.tabUnreadText}>{chatUnreadCount > 9 ? "9+" : chatUnreadCount}</Text></View> : null}
      </View>
      <Text
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        style={[
          styles.tabLabel,
          compact && styles.tabLabelCompact,
          active && styles.tabLabelActive,
        ]}
      >
        {tab.name}
      </Text>
    </Pressable>
  );
}

const makeStyles = (theme: AppTheme) => {
  const color = (component: string, key: string, fallback: string) => typeof theme.components[component]?.[key] === "string" ? theme.components[component][key] as string : fallback;
  const number = (component: string, key: string, fallback: number) => typeof theme.components[component]?.[key] === "number" ? theme.components[component][key] as number : fallback;
  return createThemeStyles(theme, {
    button: {
      minHeight: number("button", "height", 44),
      flexDirection: "row",
      paddingHorizontal: theme.spacing.md,
      borderRadius: number("button", "radius", theme.radius.md),
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      backgroundColor: color("button", "background", theme.colors.primary),
    },
    buttonCompact: {
      minHeight: 44,
      paddingHorizontal: theme.spacing.sm + theme.spacing.xs,
      borderRadius: theme.radius.control,
    },
    buttonSecondary: {
      backgroundColor: color("button", "secondaryBackground", theme.colors.surfaceLilac),
      borderWidth: theme.borders.width,
      borderColor: theme.colors.cardBorder,
      shadowOpacity: 0,
      elevation: 0,
    },
    buttonGhost: { backgroundColor: theme.colors.transparent, shadowOpacity: 0, elevation: 0 },
    buttonDanger: { backgroundColor: color("button", "dangerBackground", theme.colors.danger) },
    buttonToneSecondary: { backgroundColor: color("button", "toneSecondaryBackground", theme.colors.secondary) },
    buttonToneTertiary: { backgroundColor: color("button", "toneTertiaryBackground", theme.colors.tertiary) },
    buttonDisabled: { opacity: theme.opacity.disabled },
    buttonText: {
      color: color("button", "foreground", theme.colors.primaryText),
      fontWeight: "500",
      fontSize: theme.type.body,
      fontFamily: theme.type.bodyFont,
      lineHeight: theme.type.lineHeight.body,
      flexShrink: 1,
      textAlign: "center",
    },
    buttonTextSecondary: { color: color("button", "secondaryForeground", theme.colors.textPrimary) },
    buttonTextGhost: { color: theme.colors.primary },
    buttonTextDanger: { color: color("button", "dangerForeground", theme.colors.primaryText) },
    buttonTextToneSecondary: { color: color("button", "toneSecondaryForeground", theme.colors.secondaryText) },
    buttonTextToneTertiary: { color: color("button", "toneTertiaryForeground", theme.colors.tertiaryText) },
    card: {
      backgroundColor: color("card", "background", theme.colors.surfaceRaised),
      borderRadius: number("card", "radius", theme.radius.lg),
      padding: number("card", "padding", theme.spacing.md),
      borderWidth: number("card", "borderWidth", theme.borders.width),
      borderColor: color("card", "border", theme.colors.cardBorder),
    },
    cardFlat: {
      borderWidth: 0,
      borderColor: theme.colors.transparent,
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    confirmOverlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing.lg,
    },
    confirmBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.colors.overlay,
    },
    confirmCard: {
      ...theme.shadows.modal,
      width: "100%",
      maxWidth: 420,
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
      backgroundColor: color("dialog", "background", theme.colors.surfaceRaised),
      borderColor: color("dialog", "border", theme.colors.cardBorder),
      borderWidth: number("dialog", "borderWidth", theme.borders.width),
      borderRadius: number("dialog", "radius", theme.radius.lg),
    },
    confirmIcon: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    confirmTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      fontWeight: "900",
      fontFamily: theme.type.displayFont,
    },
    confirmMessage: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.body,
      fontFamily: theme.type.bodyFont,
      lineHeight: theme.type.lineHeight.body,
    },
    confirmActions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    confirmAction: { flex: 1 },
    confirmActionsStack: { flexDirection: "column" },
    confirmActionStack: { width: "100%", flex: 0 },
    pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    iconButtonSelected: { backgroundColor: theme.colors.accent },
    iconButtonPrimary: { width: 48, height: 48, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primary, ...theme.shadows.floating },
    overflowButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
    },
    overflowWrapper: { position: "relative", zIndex: 20 },
    menuDismiss: { position: "absolute", top: 48, right: -1000, bottom: -1000, left: -1000 },
    menuCard: {
      position: "absolute",
      top: 48,
      right: 0,
      width: 176,
      gap: 1,
      padding: 2,
      borderRadius: theme.radius.control,
      backgroundColor: color("list", "background", theme.colors.surfaceLilac),
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      ...theme.shadows.modal,
    },
    menuAction: { width: "100%", minHeight: 34, flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 2, borderRadius: theme.radius.sm, backgroundColor: theme.colors.transparent },
    menuActionIcon: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.pill },
    menuActionIconSky: { backgroundColor: theme.colors.surfaceSky },
    menuActionIconMint: { backgroundColor: theme.colors.surfaceMint },
    menuActionIconBlush: { backgroundColor: theme.colors.surfaceBlush },
    menuActionIconDanger: { backgroundColor: theme.colors.surfaceBlush },
    menuActionText: { color: theme.colors.textPrimary, fontSize: theme.type.caption - 1, lineHeight: theme.type.lineHeight.caption - 2, fontWeight: "700", fontFamily: theme.type.bodyFont, flexShrink: 1, textAlign: "center" },
    menuActionTextDanger: { color: theme.colors.danger },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.pill,
      overflow: "hidden",
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarSmall: { width: 36, height: 36 },
    avatarLarge: { width: 72, height: 72 },
    avatarText: {
      color: theme.colors.primaryText,
      fontWeight: "800",
      fontSize: theme.type.body,
    },
    avatarTextLarge: { fontSize: theme.type.title },
    avatarImage: { width: "100%", height: "100%" },
    profilePhotoPicker: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    profilePhotoPickerCompact: { gap: theme.spacing.sm, paddingVertical: 4 },
    profilePhotoCompactPressable: { position: "relative", minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
    profilePhotoCameraBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 20,
      height: 20,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
      borderWidth: 2,
      borderColor: theme.colors.background,
    },
    profilePhotoCopy: { flex: 1, gap: theme.spacing.xs },
    profilePhotoCopyCompact: { gap: 2 },
    profilePhotoTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.bodyLarge,
      fontWeight: "800",
      fontFamily: theme.type.bodyFont,
    },
    profilePhotoTitleCompact: { fontSize: theme.type.body, lineHeight: 18 },
    profilePhotoHint: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontFamily: theme.type.bodyFont,
      lineHeight: theme.type.lineHeight.caption,
    },
    profilePhotoHintCompact: { fontSize: 10, lineHeight: 14 },
    pill: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: number("badge", "radius", theme.radius.pill),
      backgroundColor: color("badge", "background", theme.colors.surfaceMuted),
    },
    pillAccent: { backgroundColor: theme.colors.accent },
    pillText: {
      color: color("badge", "foreground", theme.colors.textSecondary),
      fontSize: theme.type.caption,
      fontWeight: "700",
      fontFamily: theme.type.bodyFont,
    },
    pillTextAccent: { color: theme.colors.accentText },
    sectionTitle: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.sm,
    },
    sectionHeading: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      fontWeight: "800",
      fontFamily: theme.type.displayFont,
    },
    titleAction: { minHeight: 44, justifyContent: "center" },
    link: {
      color: theme.colors.primary,
      fontSize: theme.type.body,
      fontWeight: "700",
      fontFamily: theme.type.bodyFont,
    },
    filterChip: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      borderRadius: number("chip", "radius", theme.radius.pill),
      backgroundColor: color("chip", "background", theme.colors.surfaceRaised),
      borderWidth: theme.borders.width,
      borderColor: color("chip", "border", theme.colors.border),
    },
    filterChipSelected: {
      backgroundColor: color("chip", "background", theme.colors.accent),
      borderColor: theme.colors.primary,
    },
    filterChipText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontWeight: "700",
      fontFamily: theme.type.bodyFont,
    },
    filterChipTextSelected: { color: theme.colors.primary },
    rangeSlider: { gap: theme.spacing.md, paddingVertical: theme.spacing.xs },
    rangeSliderValues: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    rangeValueBadge: {
      minWidth: 74,
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.inputBackground,
    },
    rangeValueLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontWeight: "700",
      fontFamily: theme.type.bodyFont,
    },
    rangeValueText: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "800",
      fontFamily: theme.type.bodyFont,
    },
    rangeTrackTouch: {
      height: 44,
      justifyContent: "center",
    },
    rangeTrack: {
      height: 6,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.border,
    },
    rangeTrackFill: {
      position: "absolute",
      top: 19,
      height: 6,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primary,
    },
    rangeThumb: {
      position: "absolute",
      top: 12,
      width: 20,
      height: 20,
      marginLeft: -10,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primary,
    },
    search: {
      minHeight: number("input", "height", 56),
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      backgroundColor: color("input", "background", theme.colors.inputBackground),
      borderRadius: number("input", "radius", theme.radius.md),
      borderWidth: theme.borders.width,
      borderColor: color("input", "border", theme.colors.border),
      paddingLeft: theme.spacing.md,
      paddingRight: theme.spacing.xs,
    },
    searchInput: {
      minHeight: 50,
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.type.bodyFont,
    },
    searchFocused: { borderColor: theme.colors.focus, backgroundColor: theme.colors.surfaceRaised },
    dateTimeFieldLabel: { marginBottom: theme.spacing.xs, color: theme.colors.textPrimary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
    dateTimeField: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.inputBackground },
    dateTimeFieldValue: { flex: 1, color: theme.colors.textPrimary, fontSize: theme.type.body, fontFamily: theme.type.bodyFont },
    dateTimeFieldPlaceholder: { color: theme.colors.inputPlaceholder },
    dateTimePickerOverlay: { flex: 1, justifyContent: "flex-end" },
    dateTimePickerBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.overlay },
    dateTimePickerCard: { padding: theme.spacing.lg, gap: theme.spacing.md, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceRaised },
    dateTimePickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
    dateTimePickerTitle: { flex: 1, color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "800", fontFamily: theme.type.displayFont },
    tabs: {
      minHeight: number("navigation", "height", 56),
      height: number("navigation", "height", 56),
      position: "relative",
      flexDirection: "row",
      backgroundColor: color("navigation", "background", theme.colors.surfaceRaised),
      paddingTop: 0,
      borderTopWidth: theme.borders.width,
      borderTopColor: color("navigation", "border", theme.colors.cardBorder),
      overflow: "hidden",
    },
    tab: {
      minHeight: number("navigation", "height", 56),
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      paddingHorizontal: 1,
      zIndex: 1,
    },
    tabIndicator: {
      position: "absolute",
      left: 0,
      zIndex: 0,
      backgroundColor: color("tabs", "background", theme.colors.accent),
      borderBottomLeftRadius: theme.radius.control,
      borderBottomRightRadius: theme.radius.control,
    },
    tabIndicatorLine: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      height: 3,
      borderRadius: theme.radius.pill,
      backgroundColor: color("tabs", "border", theme.colors.primary),
    },
    tabIconWrap: {
      width: 24,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    tabIconWrapCompact: { width: 24 },
    tabUnreadBadge: {
      position: "absolute",
      top: -7,
      right: -11,
      minWidth: 17,
      height: 17,
      paddingHorizontal: 3,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.danger,
      borderWidth: 2,
      borderColor: theme.colors.surfaceRaised,
    },
    tabUnreadText: { color: theme.colors.primaryText, fontSize: 9, lineHeight: 11, fontWeight: "800" },
    tabIcon: { color: theme.colors.textSecondary, fontSize: theme.type.title },
    tabLabel: {
      width: "100%",
      flexShrink: 1,
      color: theme.colors.textSecondary,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      fontFamily: theme.type.bodyFont,
      textAlign: "center",
    },
    tabLabelActive: { color: theme.colors.accentText },
    tabLabelCompact: { fontSize: 9.5, lineHeight: 12 },
    marketplaceSkeleton: {
      flexDirection: "row",
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surfaceRaised,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      marginBottom: theme.spacing.sm,
    },
    screenSkeleton: { gap: theme.spacing.sm },
    screenSkeletonCard: {
      minHeight: 104,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radius.lg,
      backgroundColor: color("list", "background", theme.colors.surfaceRaised),
      borderWidth: theme.borders.width,
      borderColor: color("list", "border", theme.colors.cardBorder),
    },
    screenSkeletonIcon: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.control,
      backgroundColor: theme.colors.surfaceMuted,
    },
    skeletonAvatar: {
      width: 52,
      height: 52,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
    },
    skeletonContent: { flex: 1, gap: theme.spacing.sm },
    skeletonFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: theme.spacing.xs,
    },
    skeleton: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.sm,
    },
    toggle: {
      width: 48,
      height: 28,
      borderRadius: theme.radius.pill,
      padding: theme.spacing.xs,
      backgroundColor: theme.colors.border,
      justifyContent: "center",
    },
    toggleOn: { backgroundColor: theme.colors.primary },
    toggleDisabled: { opacity: 0.5 },
    toggleThumb: {
      width: 20,
      height: 20,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceRaised,
    },
    toggleThumbOn: { alignSelf: "flex-end" },
  });
};
