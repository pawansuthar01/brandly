import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "./ThemeProvider";

type ToastContextValue = {
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 2600);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <ToastContext.Provider value={{ showToast: setMessage }}>
      {children}
      <View
        pointerEvents="none"
        style={[styles.host, { top: Math.max(insets.top, 12) + 8 }]}
      >
        {message ? (
          <View
            accessible
            accessibilityLiveRegion="polite"
            style={[
              styles.toast,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View
              style={[styles.iconWrap, { backgroundColor: theme.colors.success }]}
            >
              <Ionicons
                name="checkmark"
                size={16}
                color={theme.colors.primaryText}
              />
            </View>
            <Text style={[styles.text, { color: theme.colors.textPrimary }]}>
              {message}
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
    minHeight: 48,
    maxWidth: 420,
    width: "100%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
});
