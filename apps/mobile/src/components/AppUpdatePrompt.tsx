import { useEffect, useState } from 'react';
import { AccessibilityInfo, Linking, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../providers/ThemeProvider';
import { type AppTheme } from '../styles/theme';
import { createThemeStyles } from '../styles/createThemeStyles';
import { downloadAndInstallApk, type UpdateCheck } from '../services/appVersion.service';
import { AppButton, AppCard, AppIcon } from './ui';

type UpdateState = 'idle' | 'downloading' | 'installing' | 'error';

export function AppUpdatePrompt({ update, onDismiss }: { update: UpdateCheck | null; onDismiss: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const [state, setState] = useState<UpdateState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [reduceMotion, setReduceMotion] = useState(false);
  const directApk = Platform.OS === 'android' && update?.sourceType === 'apk';

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    setState('idle');
    setProgress(0);
    setError('');
  }, [update?.latestVersion, update?.storeUrl]);

  if (!update) return null;

  const openStore = () => { void Linking.openURL(update.storeUrl).catch(() => setError('Could not open the update link. Please try again.')); };
  const startUpdate = async () => {
    if (state === 'downloading' || state === 'installing') return;
    setError('');
    if (!directApk) {
      openStore();
      return;
    }
    setState('downloading');
    try {
      await downloadAndInstallApk(update.storeUrl, update.latestVersion, setProgress, () => setState('installing'));
    } catch (downloadError) {
      setState('error');
      setError(downloadError instanceof Error ? downloadError.message : 'The APK could not be downloaded.');
    }
  };

  const busy = state === 'downloading' || state === 'installing';
  const icon = update.required ? 'shield-checkmark-outline' : directApk ? 'download-outline' : 'arrow-up-circle-outline';
  const title = update.required ? 'Update required' : 'A newer Brandly is ready';
  const actionLabel = state === 'error' ? 'Retry download' : directApk ? 'Download & install' : 'Update app';

  return <Modal visible transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={update.required || busy ? undefined : onDismiss}>
    <View style={styles.overlay}>
      <AppCard style={[styles.card, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <View style={styles.handle} />
        <View style={styles.icon}><AppIcon name={icon} size={26} color={theme.colors.primary} /></View>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.copy}>{update.message}</Text>
        <Text style={styles.source}>{directApk ? 'Secure Android APK download' : update.platform === 'ios' ? 'Apple App Store update' : 'Google Play Store update'}</Text>
        {update.releaseNotes.length > 0 ? <View style={styles.notes}>{update.releaseNotes.map((note) => <View key={note} style={styles.noteRow}><AppIcon name="ellipse" size={6} color={theme.colors.secondaryText} /><Text style={styles.note}>{note}</Text></View>)}</View> : null}
        {directApk && busy ? <View accessibilityLiveRegion="polite" style={styles.progressBlock}>
          <View style={styles.progressHeader}><Text style={styles.progressLabel}>{state === 'installing' ? 'Opening installer…' : 'Downloading update…'}</Text><Text style={styles.progressValue}>{state === 'installing' ? 'Ready' : `${Math.round(progress * 100)}%`}</Text></View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, progress * 100))}%` }]} /></View>
        </View> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          {!update.required && !busy ? <AppButton label="Later" variant="secondary" onPress={onDismiss} style={styles.action} /> : null}
          <AppButton label={actionLabel} icon={directApk ? 'download-outline' : 'open-outline'} onPress={() => void startUpdate()} loading={busy} style={styles.action} />
        </View>
      </AppCard>
    </View>
  </Modal>;
}

const makeStyles = (theme: AppTheme) => createThemeStyles(theme, {
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay },
  card: { width: '100%', padding: theme.spacing.lg, gap: theme.spacing.md, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 999, backgroundColor: theme.colors.border },
  icon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.md, backgroundColor: theme.colors.accent },
  title: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: '800', fontFamily: theme.type.displayFont },
  copy: { color: theme.colors.textSecondary, fontSize: theme.type.body, fontFamily: theme.type.bodyFont, lineHeight: theme.type.lineHeight.body },
  source: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: '700', fontFamily: theme.type.bodyFont },
  notes: { gap: theme.spacing.xs, padding: theme.spacing.md, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceMuted },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
  note: { flex: 1, color: theme.colors.textSecondary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont, lineHeight: theme.type.lineHeight.caption },
  progressBlock: { gap: theme.spacing.xs },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm },
  progressLabel: { color: theme.colors.textPrimary, fontSize: theme.type.caption, fontWeight: '700', fontFamily: theme.type.bodyFont },
  progressValue: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: '800', fontFamily: theme.type.bodyFont },
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: 999, backgroundColor: theme.colors.surfaceMuted },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: theme.colors.primary },
  error: { color: theme.colors.danger, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont, lineHeight: theme.type.lineHeight.caption },
  actions: { flexDirection: 'row', gap: theme.spacing.sm },
  action: { flex: 1 },
});
