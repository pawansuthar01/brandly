import { ReactNode, createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "../components/ui";
import { useTheme } from "./ThemeProvider";

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

type ToastTone = "success" | "error" | "info";
type ToastState = { message: string; tone: ToastTone };

const inferToastTone = (message: string): ToastTone => /could not|unable|failed|error|invalid|try again|unavailable|expired|not connected|choose .* before|enter |add |must |required|sign in|already|cannot|can't|no .*|not .*|different|allow notifications|blocked|limit|review required/i.test(message)
  ? "error"
  : "success";

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message: string, tone?: ToastTone) => {
    const resolvedTone = tone ?? inferToastTone(message);
    if (resolvedTone !== "error") return;
    setToast({ message, tone: resolvedTone });
  }, []);
  const context = useMemo(() => ({ showToast }), [showToast]);

  const isError = toast?.tone === "error";
  const isInfo = toast?.tone === "info";
  const backgroundColor = typeof theme.components.alert.background === "string" ? theme.components.alert.background : isError
    ? theme.colors.surfaceBlush
    : isInfo
      ? theme.colors.surfaceLilac
      : theme.colors.surfaceMint;
  const accentColor = isError ? theme.colors.danger : isInfo ? theme.colors.primary : theme.colors.success;
  const icon = isError ? "alert-circle-outline" : isInfo ? "information-circle-outline" : "checkmark-circle-outline";

  return (
    <ToastContext.Provider value={context}>
      {children}
      <View
        pointerEvents="none"
        style={[styles.host, { top: Math.max(insets.top, 12) + 8 }]}
      >
        {toast ? (
          <View
            accessible
            accessibilityLiveRegion="polite"
            style={[
              styles.toast,
              theme.shadows.floating,
              {
                backgroundColor,
                borderColor: accentColor,
              },
            ]}
          >
            <View
              style={[styles.iconWrap, { backgroundColor: accentColor }]}
            >
              <AppIcon
                name={icon}
                size={16}
                color={theme.colors.primaryText}
              />
            </View>
            <Text
              numberOfLines={2}
              style={[
                styles.text,
                {
                  color: typeof theme.components.alert.foreground === "string" ? theme.components.alert.foreground : theme.colors.textPrimary,
                  fontFamily: theme.type.bodyFont,
                  lineHeight: theme.type.lineHeight.body,
                },
              ]}
            >
              {toast.message}
            </Text>
          </View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 100,
    alignItems: "center",
  },
  toast: {
    minHeight: 52,
    maxWidth: 380,
    width: "100%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  text: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "700",
  },
});
