export const THEME_SCREENS = [
  { id: 'home', routes: ['tab:Home'], label: 'Home', group: 'commerce', audiences: ['brand', 'creator'] },
  { id: 'studio', routes: ['tab:Studio'], label: 'Studio', group: 'workspace', audiences: ['creator'] },
  { id: 'marketplace', routes: ['tab:Market'], label: 'Marketplace', group: 'commerce', audiences: ['creator'] },
  { id: 'discover', routes: ['tab:Discover'], label: 'Discover', group: 'commerce', audiences: ['brand'] },
  { id: 'campaigns', routes: ['tab:Campaigns'], label: 'Campaigns', group: 'commerce', audiences: ['brand'] },
  { id: 'calendar', routes: ['tab:Calendar'], label: 'Calendar', group: 'workspace', audiences: ['brand', 'creator'] },
  { id: 'budget', routes: ['tab:Budget'], label: 'Budget', group: 'workspace', audiences: ['brand'] },
  { id: 'proposals', routes: ['tab:Proposals'], label: 'Proposals', group: 'workspace', audiences: ['creator'] },
  { id: 'profile', routes: ['tab:Profile', 'detail:profile'], label: 'Profile', group: 'account', audiences: ['brand', 'creator'] },
  { id: 'chat', routes: ['utility:Chats', 'detail:chat'], label: 'Chats', group: 'communication', audiences: ['brand', 'creator'] },
  { id: 'notifications', routes: ['utility:Notifications'], label: 'Notifications', group: 'communication', audiences: ['brand', 'creator'] },
  { id: 'auth', routes: ['auth'], label: 'Welcome & sign in', group: 'account', audiences: ['brand', 'creator'] },
  { id: 'onboarding', routes: ['onboarding'], label: 'Onboarding', group: 'account', audiences: ['brand', 'creator'] },
  { id: 'taskDetail', routes: ['detail:todo'], label: 'Task details', group: 'workspace', audiences: ['brand', 'creator'] },
  { id: 'creatorProfile', routes: ['detail:influencer'], label: 'Creator profile', group: 'account', audiences: ['brand'] },
  { id: 'creatorWork', routes: ['detail:creatorWork'], label: 'Creator work details', group: 'account', audiences: ['brand'] },
  { id: 'compareCreators', routes: ['detail:compareCreators'], label: 'Compare creators', group: 'commerce', audiences: ['brand'] },
  { id: 'brandProfile', routes: ['detail:brandProfile'], label: 'Brand profile', group: 'account', audiences: ['creator'] },
  { id: 'campaignDetail', routes: ['detail:campaign'], label: 'Campaign details', group: 'commerce', audiences: ['creator'] },
  { id: 'campaignApplication', routes: ['detail:application'], label: 'Campaign application', group: 'commerce', audiences: ['creator'] },
  { id: 'proposalDetail', routes: ['detail:proposal'], label: 'Proposal details', group: 'workspace', audiences: ['brand'] },
  { id: 'workflow', routes: ['detail:flow'], label: 'Forms & workflows', group: 'workspace', audiences: ['brand'] },
] as const;

export const THEME_CONTENT_FIELDS = [
  { id: 'home.brand.heading', screen: 'home', audience: 'brand', label: 'Home heading', fallback: 'Find your next creator.', maxLength: 80 },
  { id: 'home.brand.description', screen: 'home', audience: 'brand', label: 'Home description', fallback: 'Browse a few strong matches and move the right brief forward.', maxLength: 180 },
  { id: 'home.brand.buttonLabel', screen: 'home', audience: 'brand', label: 'Main button', fallback: 'Explore creators', maxLength: 40 },
  { id: 'home.creator.heading', screen: 'home', audience: 'creator', label: 'Home heading', fallback: 'Find briefs made for you.', maxLength: 80 },
  { id: 'home.creator.description', screen: 'home', audience: 'creator', label: 'Home description', fallback: 'See your best matches, then keep every application moving.', maxLength: 180 },
  { id: 'home.creator.buttonLabel', screen: 'home', audience: 'creator', label: 'Main button', fallback: 'Explore briefs', maxLength: 40 },
] as const;
export type ThemeContentKey = (typeof THEME_CONTENT_FIELDS)[number]['id'];

export const THEME_PAGE_GROUPS = [
  { id: 'commerce', label: 'Commerce pages' },
  { id: 'workspace', label: 'Workspace pages' },
  { id: 'account', label: 'Account pages' },
  { id: 'communication', label: 'Communication pages' },
] as const;

export type ThemeScreenId = (typeof THEME_SCREENS)[number]['id'];
export type ThemePageGroupId = (typeof THEME_PAGE_GROUPS)[number]['id'];

export const THEME_COMPONENTS = {
  button: { label: 'Buttons', colors: ['background', 'foreground', 'secondaryBackground', 'secondaryForeground', 'dangerBackground', 'dangerForeground', 'toneSecondaryBackground', 'toneSecondaryForeground', 'toneTertiaryBackground', 'toneTertiaryForeground'], numbers: ['radius', 'height'] },
  input: { label: 'Inputs', colors: ['background', 'border'], numbers: ['radius', 'height'] },
  card: { label: 'Cards', colors: ['background', 'backgroundHero', 'backgroundMuted', 'backgroundSky', 'backgroundMint', 'backgroundButter', 'backgroundBlush', 'backgroundLilac', 'border'], numbers: ['radius', 'borderWidth', 'padding'] },
  appBar: { label: 'Headers', colors: ['background', 'foreground'], numbers: [] },
  navigation: { label: 'Navigation', colors: ['background', 'border'], numbers: ['height'] },
  tabs: { label: 'Tabs', colors: ['background', 'border'], numbers: [] },
  list: { label: 'Lists', colors: ['background', 'border'], numbers: [] },
  badge: { label: 'Badges', colors: ['background', 'foreground'], numbers: ['radius'] },
  dialog: { label: 'Dialogs', colors: ['background', 'border'], numbers: ['radius', 'borderWidth'] },
  alert: { label: 'Alerts', colors: ['background', 'foreground'], numbers: [] },
  chip: { label: 'Chips', colors: ['background', 'border'], numbers: ['radius'] },
} as const;
export type ThemeComponentId = keyof typeof THEME_COMPONENTS;
export type ComponentOverrides = Partial<Record<ThemeComponentId, Record<string, string | number>>>;

export function componentOverrideError(value: unknown, path: string): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return path;
  for (const [name, fields] of Object.entries(value)) {
    const spec = THEME_COMPONENTS[name as ThemeComponentId];
    if (!spec || !fields || typeof fields !== 'object' || Array.isArray(fields)) return `${path}.${name}`;
    for (const [key, entry] of Object.entries(fields)) {
      const colors: readonly string[] = spec.colors;
      const numbers: readonly string[] = spec.numbers;
      if (colors.includes(key)) { if (typeof entry !== 'string' || !/^#[\da-f]{6}$/i.test(entry)) return `${path}.${name}.${key}`; }
      else if (numbers.includes(key)) {
        const max = key === 'height' ? 88 : key === 'radius' ? 999 : key === 'borderWidth' ? 4 : 64;
        if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < (key === 'height' ? 40 : 0) || entry > max) return `${path}.${name}.${key}`;
      } else return `${path}.${name}.${key}`;
    }
  }
}

export function themeScreenForRoute(route: string): ThemeScreenId | undefined {
  return THEME_SCREENS.find((screen) => (screen.routes as readonly string[]).includes(route))?.id;
}

export function getThemePageGroup<T extends { pages: readonly string[]; colors: Partial<Record<string, string>>; followRegistry?: boolean }>(groups: Record<string, T>, page?: string): (T & { id: string }) | undefined {
  const explicit = Object.entries(groups).find(([, group]) => group.pages.includes(page ?? ''));
  const registeredGroup = THEME_SCREENS.find((screen) => screen.id === page)?.group;
  const selected = explicit ?? Object.entries(groups).find(([id, group]) => id === registeredGroup && group.followRegistry);
  return selected ? { ...selected[1], id: selected[0] } : undefined;
}
