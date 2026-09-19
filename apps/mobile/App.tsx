import { StatusBar as NativeStatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DemoApp } from './src/features/marketplace/DemoApp';
import { ThemeProvider, useTheme } from './src/providers/ThemeProvider';
import { ToastProvider } from './src/providers/ToastProvider';

function AppContent() {
  const { mode, theme } = useTheme();
  return (
    <>
      <NativeStatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
        translucent={false}
      />
      <DemoApp />
    </>
  );
}

export default function App() {
  return <SafeAreaProvider><ThemeProvider><ToastProvider><AppContent /></ToastProvider></ThemeProvider></SafeAreaProvider>;
}
