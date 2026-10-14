import type { ReminderTone } from "../types/marketplace";

export type ReminderToneOption = {
  id: ReminderTone;
  label: string;
  shortLabel: string;
  duration: string;
  file?: string;
  alarmFile?: string;
};

export const REMINDER_TONES: ReminderToneOption[] = [
  { id: "default", label: "System default", shortLabel: "Default", duration: "System", alarmFile: "soft_chime_alarm.wav" },
  { id: "soft-chime", label: "Soft chime", shortLabel: "Chime", duration: "8.0s", file: "soft_chime.wav", alarmFile: "soft_chime_alarm.wav" },
  { id: "bright-bell", label: "Bright bell", shortLabel: "Bell", duration: "8.5s", file: "bright_bell.wav", alarmFile: "bright_bell_alarm.wav" },
  { id: "focus-pulse", label: "Focus pulse", shortLabel: "Pulse", duration: "9.0s", file: "focus_pulse.wav", alarmFile: "focus_pulse_alarm.wav" },
  { id: "morning-rise", label: "Morning rise", shortLabel: "Rise", duration: "10.0s", file: "morning_rise.wav", alarmFile: "morning_rise_alarm.wav" },
  { id: "warm-double", label: "Warm double", shortLabel: "Double", duration: "8.5s", file: "warm_double.wav", alarmFile: "warm_double_alarm.wav" },
  { id: "clear-triangle", label: "Clear triangle", shortLabel: "Clear", duration: "8.0s", file: "clear_triangle.wav", alarmFile: "clear_triangle_alarm.wav" },
  { id: "gentle-wave", label: "Gentle wave", shortLabel: "Wave", duration: "10.0s", file: "gentle_wave.wav", alarmFile: "gentle_wave_alarm.wav" },
  { id: "short-alert", label: "Short alert", shortLabel: "Alert", duration: "8.0s", file: "short_alert.wav", alarmFile: "short_alert_alarm.wav" },
  { id: "deep-note", label: "Deep note", shortLabel: "Deep", duration: "9.0s", file: "deep_note.wav", alarmFile: "deep_note_alarm.wav" },
  { id: "sparkle-sequence", label: "Sparkle sequence", shortLabel: "Sparkle", duration: "10.0s", file: "sparkle_sequence.wav", alarmFile: "sparkle_sequence_alarm.wav" },
  { id: "akx-alarmed", label: "Alarmed", shortLabel: "Alarmed", duration: "0.3s", file: "akx_alarmed.wav", alarmFile: "akx_alarmed_alarm.wav" },
  { id: "akx-beeper", label: "Beeper", shortLabel: "Beeper", duration: "0.3s", file: "akx_beeper.wav", alarmFile: "akx_beeper_alarm.wav" },
  { id: "akx-belligerent", label: "Belligerent", shortLabel: "Belligerent", duration: "5.0s", file: "akx_belligerent.wav", alarmFile: "akx_belligerent_alarm.wav" },
  { id: "akx-calm", label: "Calm", shortLabel: "Calm", duration: "1.7s", file: "akx_calm.wav", alarmFile: "akx_calm_alarm.wav" },
  { id: "akx-chord", label: "Chord", shortLabel: "Chord", duration: "1.0s", file: "akx_chord.wav", alarmFile: "akx_chord_alarm.wav" },
  { id: "akx-chord2", label: "Chord two", shortLabel: "Chord 2", duration: "1.2s", file: "akx_chord2.wav", alarmFile: "akx_chord2_alarm.wav" },
  { id: "akx-cloud", label: "Cloud", shortLabel: "Cloud", duration: "1.5s", file: "akx_cloud.wav", alarmFile: "akx_cloud_alarm.wav" },
  { id: "akx-glass", label: "Glass", shortLabel: "Glass", duration: "0.9s", file: "akx_glass.wav", alarmFile: "akx_glass_alarm.wav" },
  { id: "akx-glisten", label: "Glisten", shortLabel: "Glisten", duration: "2.2s", file: "akx_glisten.wav", alarmFile: "akx_glisten_alarm.wav" },
  { id: "akx-polite", label: "Polite", shortLabel: "Polite", duration: "0.5s", file: "akx_polite.wav", alarmFile: "akx_polite_alarm.wav" },
  { id: "akx-sharp", label: "Sharp", shortLabel: "Sharp", duration: "0.1s", file: "akx_sharp.wav", alarmFile: "akx_sharp_alarm.wav" },
  { id: "akx-whistleronic", label: "Whistleronic", shortLabel: "Whistler", duration: "0.5s", file: "akx_whistleronic.wav", alarmFile: "akx_whistleronic_alarm.wav" },
  { id: "silent", label: "Silent", shortLabel: "Silent", duration: "Off" },
];

export function getReminderTone(tone?: ReminderTone) {
  return REMINDER_TONES.find((option) => option.id === tone) ?? REMINDER_TONES[0];
}

export function getReminderToneLabel(tone?: ReminderTone) {
  return getReminderTone(tone).shortLabel;
}
