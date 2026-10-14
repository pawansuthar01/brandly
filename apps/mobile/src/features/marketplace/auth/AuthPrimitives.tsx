import { type ComponentPropsWithRef, type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ImageStyle,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { LocationFilterSheet } from "../../../components/marketplace";
import { AppIcon } from "../../../components/ui";
import { useTheme } from "../../../providers/ThemeProvider";
import { type AppIconName } from "../marketplaceDomain";
import { makeStyles } from "../marketplaceStyles";

export function AuthInput({
  icon,
  error = false,
  success = false,
  inputRef,
  style,
  containerStyle,
  ...props
}: Omit<ComponentPropsWithRef<typeof TextInput>, "style"> & {
  icon: AppIconName;
  error?: boolean;
  success?: boolean;
  inputRef?: RefObject<TextInput | null>;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.authInputShell, props.multiline && styles.authInputShellMultiline, focused && styles.authInputShellFocused, success && styles.authInputShellSuccess, error && styles.authInputShellError, containerStyle]}>
      <View pointerEvents="none" style={[styles.authInputIcon, props.multiline && styles.authInputIconMultiline]}>
        <AppIcon name={icon} size={16} color={error ? theme.colors.danger : success ? theme.colors.success : theme.colors.primary} />
      </View>
      <TextInput
        ref={inputRef}
        {...props}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        style={[styles.authInputField, style]}
        placeholderTextColor={props.placeholderTextColor ?? theme.colors.inputPlaceholder}
      />
    </View>
  );
}

export function AuthStepPill({ label, icon }: { label: string; icon: AppIconName }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.authStepPill}>
      <AppIcon name={icon} size={14} color={theme.colors.primary} />
      <Text style={styles.authStepPillText}>{label}</Text>
    </View>
  );
}

export function AuthText({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const [motion] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Keep auth content motion off the native driver. Fabric can try to
    // reconnect legacy native animated nodes when OTP content re-renders.
    const animation = Animated.timing(motion, { toValue: 1, duration: 180, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [motion]);

  return <Animated.Text style={[style, { opacity: motion }]}>{children}</Animated.Text>;
}

export function AuthTitle({ primary, secondary, style }: { primary: ReactNode; secondary?: ReactNode; style?: StyleProp<TextStyle> }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <AuthText style={[styles.authTitle, style]}>
      <Text style={styles.authTitlePrimary}>{primary}</Text>
      {secondary ? <Text style={styles.authTitleSecondary}>{secondary}</Text> : null}
    </AuthText>
  );
}

export function AuthBackButton({ label = "Back", onPress }: { label?: string; onPress: () => void }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={7}
      onPress={onPress}
      style={({ pressed }) => [styles.authBackButton, pressed && { opacity: 0.72 }]}
    >
      <AppIcon name="arrow-back" size={16} color={theme.colors.textPrimary} />
    </Pressable>
  );
}

export function OtpBoxes({
  value,
  onChange,
  accessibilityLabel,
  error = false,
  channel = "sms",
}: {
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
  error?: boolean;
  channel?: "email" | "sms";
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, 5);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${accessibilityLabel}. Tap to enter the 6-digit code.`}
      onPress={() => inputRef.current?.focus()}
      style={[styles.otpBoxes, focused && styles.otpBoxesFocused]}
    >
      <View pointerEvents="none" style={styles.otpDigitsRow}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View key={index} style={[styles.otpBox, value[index] && styles.otpBoxFilled, focused && index === activeIndex && styles.otpBoxFocused, error && styles.otpBoxError]}>
            <Text style={styles.otpDigit}>{value[index] ?? ""}</Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        autoFocus
        value={value}
        onChangeText={(next) => onChange(next.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        autoCorrect={false}
        autoComplete={channel === "email" ? "email-otp" : "sms-otp"}
        textContentType="oneTimeCode"
        importantForAutofill="yes"
        caretHidden
        accessibilityLabel={accessibilityLabel}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.otpInputOverlay}
      />
    </Pressable>
  );
}

export function IndiaPhoneField({
  value,
  onChange,
  error = false,
  success = false,
  inputRef,
  onBlur,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  success?: boolean;
  inputRef?: RefObject<TextInput | null>;
  onBlur?: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [focused, setFocused] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  return (
    <View style={styles.phoneField}>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel="Country code. India plus 91"
        accessibilityState={{ expanded: countryPickerOpen }}
        onPress={() => setCountryPickerOpen((open) => !open)}
        style={({ pressed }) => [styles.countryCodeBox, countryPickerOpen && styles.countryCodeBoxOpen, pressed && { opacity: 0.82 }]}
      >
        <Text style={styles.countryFlag}>🇮🇳</Text>
        <Text style={styles.countryCodeText}>+91</Text>
        <AppIcon name="chevron-down" size={14} color={theme.colors.textSecondary} />
      </Pressable>
      <Modal
        visible={countryPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCountryPickerOpen(false)}
      >
        <Pressable style={styles.countryPickerBackdrop} onPress={() => setCountryPickerOpen(false)}>
          <Pressable style={styles.countryPickerSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.countryPickerHeader}>
              <Text style={styles.countryPickerTitle}>Country code</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close country code selector" onPress={() => setCountryPickerOpen(false)} hitSlop={8}>
                <AppIcon name="close" size={20} color={theme.colors.textSecondary} />
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel="India plus 91"
              accessibilityState={{ selected: true }}
              onPress={() => setCountryPickerOpen(false)}
              style={({ pressed }) => [styles.countryCodeMenuItem, pressed && styles.countryCodeMenuItemPressed]}
            >
              <Text style={styles.countryFlag}>🇮🇳</Text>
              <Text style={styles.countryCodeMenuCountry}>India</Text>
              <Text style={styles.countryCodeMenuCode}>+91</Text>
              <AppIcon name="checkmark" size={16} color={theme.colors.primary} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <View style={[styles.authInputShell, styles.phoneInputShell, focused && styles.authInputShellFocused, success && styles.authInputShellSuccess, error && styles.authInputShellError]}>
        <View pointerEvents="none" style={styles.authInputIcon}>
          <AppIcon name="call-outline" size={16} color={error ? theme.colors.danger : success ? theme.colors.success : theme.colors.primary} />
        </View>
        <TextInput
          ref={inputRef}
          accessibilityLabel="10-digit phone number"
          keyboardType="phone-pad"
          value={value}
          onChangeText={(next) => onChange(next.replace(/\D/g, "").slice(0, 10))}
          placeholder="10-digit phone number"
          placeholderTextColor={theme.colors.inputPlaceholder}
          maxLength={10}
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="done"
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          onSubmitEditing={() => Keyboard.dismiss()}
          style={styles.authInputField}
        />
      </View>
    </View>
  );
}

export function AuthProgress({
  current,
  total = 10,
  style,
}: {
  current: number;
  total?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Setup progress, step ${current} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: current }}
      style={[styles.authProgress, style]}
    >
      {Array.from({ length: total }, (_, index) => {
        const step = index + 1;
        const isCompleted = step < current;
        const isActive = step === current;
        return (
          <View key={step} style={styles.authProgressItem}>
            <AuthProgressStep completed={isCompleted} active={isActive} />
            {step < total ? (
              <View
                style={[
                  styles.authProgressLine,
                  isCompleted && styles.authProgressLineActive,
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function AuthProgressStep({ completed, active }: { completed: boolean; active: boolean }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const motion = useRef(new Animated.Value(completed || active ? 1 : 0)).current;
  const scale = useMemo(() => motion.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }), [motion]);

  useEffect(() => {
    const animation = Animated.spring(motion, {
      toValue: completed || active ? 1 : 0,
      useNativeDriver: false,
      speed: 20,
      bounciness: 4,
    });
    animation.start();
    return () => animation.stop();
  }, [active, completed, motion]);

  return (
    <Animated.View
      style={[
        styles.authProgressDot,
        (completed || active) && styles.authProgressDotActive,
        { transform: [{ scale }] },
      ]}
    >
      {completed ? (
        <AppIcon name="checkmark" size={10} color={theme.colors.primaryText} />
      ) : active ? (
        <View style={[styles.authProgressActiveMark, { backgroundColor: theme.colors.primaryText }]} />
      ) : null}
    </Animated.View>
  );
}

export function AuthLandingIllustration() {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View pointerEvents="none" style={styles.landingIllustContainer}>
      <View style={styles.landingIllustrationArtwork}>
        <ExpoImage
          source={require("../../../../assets/illustration.gif")}
          autoplay={false}
          transition={0}
          contentFit="contain"
          style={styles.landingIllustrationImage as ImageStyle}
          accessibilityLabel="Brandly creator and brand partnership illustration"
        />
      </View>
    </View>
  );
}

export function AuthContent({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return <View style={styles.authContentTransition}>{children}</View>;
}

export function DropdownPickerField({
  label,
  value,
  placeholder,
  options,
  icon,
  onSelect,
  error = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  icon?: AppIconName;
  onSelect: (option: string) => void;
  error?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        onPress={() => setModalVisible(true)}
        style={[styles.dropdownSelector, error && styles.dropdownSelectorError]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          {icon ? <AppIcon name={icon} size={18} color={theme.colors.primary} /> : null}
          <Text
            numberOfLines={1}
            style={value ? styles.dropdownSelectorText : styles.dropdownSelectorPlaceholder}
          >
            {value || placeholder}
          </Text>
        </View>
        <AppIcon name="chevron-down" size={18} color={theme.colors.textSecondary} />
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "flex-end",
          }}
          onPress={() => setModalVisible(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              maxHeight: "60%",
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: theme.colors.textPrimary }}>
                {label}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <AppIcon name="close" size={20} color={theme.colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((option) => {
                const isSelected = option === value;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      onSelect(option);
                      setModalVisible(false);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.colors.cardBorder,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: isSelected ? "700" : "500",
                        color: isSelected ? theme.colors.primary : theme.colors.textPrimary,
                      }}
                    >
                      {option}
                    </Text>
                    {isSelected ? (
                      <AppIcon name="checkmark-circle" size={18} color={theme.colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function LocationPickerField({
  selected,
  locations,
  onApply,
  single = false,
  title = "Choose your location",
  subtitle = "Search an Indian state or city",
  searchAccessibilityLabel = "Search Indian states and cities",
  error = false,
  placeholder = "Select city or state",
  icon = "location-outline",
  optionIcon = icon,
  searchPlaceholder = "Search city or state",
  emptyLabel = "No locations found",
}: {
  selected: string[];
  locations: string[];
  onApply: (locations: string[]) => void;
  single?: boolean;
  title?: string;
  subtitle?: string;
  searchAccessibilityLabel?: string;
  error?: boolean;
  placeholder?: string;
  icon?: AppIconName;
  optionIcon?: AppIconName;
  searchPlaceholder?: string;
  emptyLabel?: string;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [visible, setVisible] = useState(false);
  const value = selected.join(" · ");
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${value || placeholder}`}
        onPress={() => setVisible(true)}
        style={[styles.dropdownSelector, error && styles.dropdownSelectorError]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <AppIcon name={icon} size={18} color={theme.colors.primary} />
          <Text numberOfLines={2} style={value ? styles.dropdownSelectorText : styles.dropdownSelectorPlaceholder}>
            {value || placeholder}
          </Text>
        </View>
        <AppIcon name="chevron-down" size={18} color={theme.colors.textSecondary} />
      </Pressable>
      <LocationFilterSheet
        visible={visible}
        locations={locations}
        selected={selected}
        onClose={() => setVisible(false)}
        onApply={onApply}
        title={title}
        subtitle={subtitle}
        searchAccessibilityLabel={searchAccessibilityLabel}
        limitWithoutQuery={null}
        single={single}
        optionIcon={optionIcon}
        searchPlaceholder={searchPlaceholder}
        emptyLabel={emptyLabel}
      />
    </>
  );
}

export function AuthShell({
  children,
  landing = false,
  keyboardAware = false,
}: {
  children: ReactNode;
  landing?: boolean;
  keyboardAware?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { width, height } = useWindowDimensions();
  const compactScreen = height < 760 || width < 360;
  const horizontalPadding = width < 360 ? 14 : 16;
  const scrollContent = (
    <ScrollView
      style={styles.authScroll}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.auth,
        landing && styles.authLanding,
        {
          justifyContent: "flex-start",
          paddingHorizontal: horizontalPadding,
          paddingTop: landing ? 36 : compactScreen ? 22 : 28,
          paddingBottom: landing ? 18 : 24,
        },
      ]}
    >
      {children}
    </ScrollView>
  );
  return (
    <SafeAreaView style={[styles.authShell, landing && styles.authLandingShell]} edges={["top", "bottom"]}>
        <View pointerEvents="none" style={styles.authBackdrop}>
          <View style={styles.authOrbPrimary} />
          <View style={styles.authOrbSecondary} />
          <View style={styles.authOrbTertiary} />
          <View style={styles.authOrbQuaternary} />
        {landing ? (
          <>
            <View style={[styles.authLandingShape, styles.authLandingShapePink]} />
            <View style={[styles.authLandingShape, styles.authLandingShapeLilac]} />
            <View style={styles.authLandingSpark} />
          </>
        ) : null}
      </View>
      <KeyboardAvoidingView
        style={styles.authKeyboard}
        enabled={keyboardAware}
        behavior={keyboardAware ? (Platform.OS === "ios" ? "padding" : "height") : undefined}
      >
        {scrollContent}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
