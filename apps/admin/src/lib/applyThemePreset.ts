type ThemeDocument = {
  name: string;
  tokens: {
    colors: Record<'light' | 'dark', Record<string, string>>;
    gradients?: Record<'light' | 'dark', Record<'top' | 'right' | 'bottom' | 'left', string>>;
    components: Record<string, Record<string, string | number>>;
    pages: Record<string, Record<string, string | number>>;
    pageComponents?: Record<string, Record<string, Record<string, string | number>>>;
    pageGroups?: Record<string, { pages: string[]; colors: Record<string, string>; followRegistry?: boolean }>;
  };
};

type ThemePreset = {
  name: string;
  light: Record<string, string>;
  dark: Record<string, string>;
  components: ThemeDocument['tokens']['components'];
  gradients?: ThemeDocument['tokens']['gradients'];
};

export function applyThemePreset<T extends ThemeDocument>(active: T, preset: ThemePreset): T {
  const next = JSON.parse(JSON.stringify(active)) as T;
  next.name = preset.name;
  for (const appearance of ['light', 'dark'] as const) {
    next.tokens.colors[appearance] = {
      ...next.tokens.colors[appearance],
      ...preset[appearance],
      focus: preset[appearance].primary,
    };
  }
  if (preset.gradients) next.tokens.gradients = JSON.parse(JSON.stringify(preset.gradients));
  else delete next.tokens.gradients;
  next.tokens.components = JSON.parse(JSON.stringify(preset.components));
  next.tokens.pages = {};
  next.tokens.pageComponents = {};
  next.tokens.pageGroups = Object.fromEntries(Object.entries(next.tokens.pageGroups ?? {}).map(([id, group]) => [id, { ...group, colors: {} }]));
  return next;
}
