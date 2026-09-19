import { ReactNode, useEffect, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image as ExpoImage } from "expo-image";
import {
  Animated,
  Modal,
  Pressable,
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
import { AppTheme } from "../styles/theme";
import { TabName } from "../types/marketplace";

export function AppButton({
  label,
  onPress,
  variant = "primary",
  compact = false,
  icon,
  style,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  compact?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        style,
        compact && styles.buttonCompact,
        variant === "secondary" && styles.buttonSecondary,
        variant === "ghost" && styles.buttonGhost,
        variant === "danger" && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && styles.pressed,
      ]}
    >
      {icon ? (
        <AppIcon
          name={icon}
          size={18}
          color={
            variant === "primary" || variant === "danger"
              ? theme.colors.primaryText
              : theme.colors.primary
          }
        />
      ) : null}
      <Text
        style={[
          styles.buttonText,
          variant === "secondary" && styles.buttonTextSecondary,
          variant === "ghost" && styles.buttonTextGhost,
          variant === "danger" && styles.buttonTextDanger,
        ]}
      >
        {label}
      </Text>
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
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        flat && styles.cardFlat,
        style,
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
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmIcon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { width } = useWindowDimensions();
  const stackActions = width < 360;
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.confirmOverlay}>
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
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  selected?: boolean;
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
        selected && styles.iconButtonSelected,
        pressed && styles.pressed,
      ]}
    >
      <AppIcon
        name={name}
        size={20}
        color={selected ? theme.colors.primary : theme.colors.textPrimary}
      />
    </Pressable>
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

export function Toggle({
  value,
  onChange,
  disabled = false,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      accessibilityRole="switch"
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
}: {
  label: string;
  accent?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={[styles.pill, accent && styles.pillAccent]}>
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
        <Pressable onPress={onAction}>
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
  return (
    <View style={styles.search}>
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
        placeholderTextColor={theme.colors.textSecondary}
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

export function BottomTabs({
  active,
  onChange,
  onChat,
  chatActive = false,
}: {
  active: TabName;
  onChange: (tab: TabName) => void;
  onChat: () => void;
  chatActive?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tabs: {
    name: TabName | "Chat";
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { name: "Home", icon: "home-outline" },
    { name: "Campaigns", icon: "briefcase-outline" },
    { name: "Discover", icon: "search-outline" },
    { name: "Proposals", icon: "paper-plane-outline" },
    { name: "Chat", icon: "chatbubbles-outline" },
    { name: "Profile", icon: "person-outline" },
  ];
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => (chatActive ? tab.name === "Chat" : tab.name === active)),
  );
  const indicator = useRef(new Animated.Value(activeIndex)).current;
  const isCompact = width < 360;
  const tabWidth = Math.max(0, width / tabs.length);
  const tabVisualWidth = isCompact ? 40 : 46;
  useEffect(() => {
    Animated.spring(indicator, {
      toValue: activeIndex,
      useNativeDriver: true,
      friction: 9,
      tension: 100,
    }).start();
  }, [activeIndex, indicator]);
  return (
    <View
      style={[
        styles.tabs,
        {
          paddingBottom: Math.max(
            insets.bottom - theme.spacing.md,
            theme.spacing.xs,
          ),
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tabIndicator,
          {
            width: tabVisualWidth,
            transform: [
              {
                translateX: indicator.interpolate({
                  inputRange: [0, tabs.length - 1],
                  outputRange: [
                    (tabWidth - tabVisualWidth) / 2,
                    (tabWidth - tabVisualWidth) / 2 + tabWidth * (tabs.length - 1),
                  ],
                }),
              },
            ],
          },
        ]}
      />
      {tabs.map((tab) => (
        <BottomTabItem
          key={tab.name}
          tab={tab}
          active={chatActive ? tab.name === "Chat" : active === tab.name}
          compact={isCompact}
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
  onPress,
}: {
  tab: { name: TabName | "Chat"; icon: keyof typeof Ionicons.glyphMap };
  active: boolean;
  compact: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
    }).start();
  }, [active, progress]);
  const isCenter = false;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={tab.name}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
    >
      <Animated.View
        style={[
          isCenter ? styles.tabCenter : styles.tabIconWrap,
          compact && !isCenter && styles.tabIconWrapCompact,
          isCenter && active && styles.tabCenterActive,
          {
            transform: [
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, isCenter ? 1 : 1.06],
                }),
              },
            ],
          },
        ]}
      >
        <AppIcon
          name={tab.icon}
          size={compact ? 22 : 24}
          color={
            active ? theme.colors.primary : theme.colors.textSecondary
          }
        />
      </Animated.View>
      <Text style={[styles.tabLabel, compact && styles.tabLabelCompact, active && styles.tabActive]}>
        {tab.name}
      </Text>
    </Pressable>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    button: {
      minHeight: 48,
      flexDirection: "row",
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.primary,
    },
    buttonCompact: { minHeight: 44, paddingHorizontal: theme.spacing.md },
    buttonSecondary: { backgroundColor: theme.colors.surfaceMuted },
    buttonGhost: { backgroundColor: theme.colors.transparent },
    buttonDanger: { backgroundColor: theme.colors.danger },
    buttonDisabled: { opacity: 0.48 },
    buttonText: {
      color: theme.colors.primaryText,
      fontWeight: "700",
      fontSize: theme.type.body,
      flexShrink: 1,
      textAlign: "center",
    },
    buttonTextSecondary: { color: theme.colors.textPrimary },
    buttonTextGhost: { color: theme.colors.primary },
    buttonTextDanger: { color: theme.colors.primaryText },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardFlat: { borderWidth: 0, borderColor: theme.colors.transparent },
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
      width: "100%",
      maxWidth: 420,
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
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
    },
    confirmMessage: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.body,
      lineHeight: 21,
    },
    confirmActions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    confirmAction: { flex: 1 },
    confirmActionsStack: { flexDirection: "column" },
    confirmActionStack: { width: "100%", flex: 0 },
    pressed: { opacity: 0.78 },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    iconButtonSelected: { backgroundColor: theme.colors.accent },
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
    pill: {
      alignSelf: "flex-start",
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
    },
    pillAccent: { backgroundColor: theme.colors.accent },
    pillText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontWeight: "700",
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
    },
    link: {
      color: theme.colors.primary,
      fontSize: theme.type.body,
      fontWeight: "700",
    },
    filterChip: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterChipSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.primary,
    },
    filterChipText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontWeight: "700",
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
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceMuted,
    },
    rangeValueLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.caption,
      fontWeight: "700",
    },
    rangeValueText: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontWeight: "800",
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
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingLeft: theme.spacing.md,
      paddingRight: theme.spacing.xs,
    },
    searchInput: {
      minHeight: 50,
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
    },
    tabs: {
      minHeight: 54,
      position: "relative",
      flexDirection: "row",
      backgroundColor: theme.colors.surface,
      paddingTop: theme.spacing.xs,
    },
    tabIndicator: {
      position: "absolute",
      top: theme.spacing.xs,
      width: 46,
      height: 34,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.accent,
    },
    tab: {
      minHeight: 48,
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
      zIndex: 1,
    },
    tabIconWrap: {
      width: 46,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
    },
    tabIconWrapCompact: { width: 40 },
    tabCenter: {
      width: 46,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
    },
    tabCenterActive: {
      borderRadius: theme.radius.md,
    },
    tabIcon: { color: theme.colors.textSecondary, fontSize: theme.type.title },
    tabLabel: {
      color: theme.colors.textSecondary,
      fontSize: 10,
      lineHeight: 12,
    },
    tabLabelCompact: { fontSize: theme.type.caption - 2 },
    tabActive: { color: theme.colors.primary, fontWeight: "700" },
    marketplaceSkeleton: {
      flexDirection: "row",
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.sm,
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
      backgroundColor: theme.colors.surface,
    },
    toggleThumbOn: { alignSelf: "flex-end" },
  });
