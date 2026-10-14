import AsyncStorage from '@react-native-async-storage/async-storage';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StatusBar as NativeStatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './src/services/reminderNotificationTask';
import { MarketplaceApp } from './src/features/marketplace/MarketplaceApp';
import { AppUpdatePrompt } from './src/components/AppUpdatePrompt';
import { useAppVersion } from './src/hooks/useAppVersion';
import { isAdminThemePreview, ThemeProvider, useTheme } from './src/providers/ThemeProvider';
import { ToastProvider } from './src/providers/ToastProvider';
import { MobileStoreProvider } from './src/store/provider';

function AppContent() {
  const { mode, theme } = useTheme();
  const { update, dismissOptional } = useAppVersion();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <NativeStatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
        translucent={false}
      />
      <MarketplaceApp />
      <AppUpdatePrompt update={update} onDismiss={dismissOptional} />
    </View>
  );
}

type StartupBoundaryState = { error: Error | null; retryNonce: number };

class StartupBoundary extends Component<{ children: ReactNode }, StartupBoundaryState> {
  state: StartupBoundaryState = { error: null, retryNonce: 0 };

  static getDerivedStateFromError(error: Error): StartupBoundaryState {
    return { error, retryNonce: 0 };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Brandly startup error', error, info.componentStack);
  }

  retry = async () => {
    // Remove only rebuildable local snapshots. Auth tokens and server data live elsewhere.
    const keys = await AsyncStorage.getAllKeys().catch(() => [] as string[]);
    const rebuildableKeys = keys.filter((key) =>
      key === 'brandly-mobile-state-v3'
      || key.startsWith('brandly.remote-tasks:')
      || key === 'brandly-app-version-config-v1',
    );
    if (rebuildableKeys.length) await AsyncStorage.multiRemove(rebuildableKeys).catch(() => undefined);
    this.setState((current) => ({ error: null, retryNonce: current.retryNonce + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <View style={startupStyles.container}>
          <View style={startupStyles.card}>
            <Text style={startupStyles.icon}>!</Text>
            <Text style={startupStyles.title}>Brandly could not open</Text>
            <Text style={startupStyles.message}>
              The app hit a temporary startup problem. Try again to reload the app safely.
            </Text>
            {this.state.error.message ? <Text numberOfLines={3} style={startupStyles.detail}>{this.state.error.message}</Text> : null}
            <Pressable accessibilityRole="button" onPress={() => void this.retry()} style={startupStyles.button}>
              <Text style={startupStyles.buttonLabel}>Try again</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return <View key={this.state.retryNonce} style={{ flex: 1 }}>{this.props.children}</View>;
  }
}

const startupStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F7F4FB' },
  card: { width: '100%', maxWidth: 420, alignItems: 'center', gap: 14, padding: 24, borderRadius: 24, backgroundColor: '#FFFDFC' },
  icon: { width: 48, height: 48, borderRadius: 24, color: '#FFFFFF', backgroundColor: '#6D4AFF', textAlign: 'center', fontSize: 30, lineHeight: 48, fontWeight: '800' },
  title: { color: '#241B3A', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  message: { color: '#716A80', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  detail: { color: '#9B315D', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  button: { minWidth: 150, alignItems: 'center', paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14, backgroundColor: '#241B3A' },
  buttonLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});

export default function App() {
  return <StartupBoundary><SafeAreaProvider><MobileStoreProvider preview={isAdminThemePreview()}><ThemeProvider><ToastProvider><AppContent /></ToastProvider></ThemeProvider></MobileStoreProvider></SafeAreaProvider></StartupBoundary>;
}
