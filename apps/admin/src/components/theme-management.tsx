'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Blocks, Check, Copy, Download, Eye, FileText, History, LoaderCircle, Maximize2, Minimize2, Moon, MousePointer2, PanelsTopLeft, Palette, Plus, Redo2, RotateCcw, Save, Send, Smartphone, Sun, Undo2, Upload, UsersRound, X } from 'lucide-react';
import { activateThemeVersion, createThemeDraft, getActiveTheme, getThemeActivations, getThemeDraft, getThemeDrafts, getThemeVersion, getThemeVersions, publishThemeDraft, saveThemeDraft, type AdminTheme, type ThemeDraft, type ThemeDraftSummary, type ThemeVersion, type ThemeVersionSummary } from '@/services/adminApi.service';
import { THEME_PAGE_GROUPS, THEME_SCREENS, THEME_COMPONENTS, THEME_CONTENT_FIELDS, getThemePageGroup, type ThemePageGroupId, type ThemeScreenId } from '../../../mobile/src/lib/themeScreens';
import { resolveThemeComponents, type ThemeDocument } from '../../../mobile/src/lib/themeValidation';
import { surfaceColors } from '../../../mobile/src/styles/surfaceColors';
import { applyThemePreset } from '@/lib/applyThemePreset';
import { exportThemeJson, parseThemeJson, themeContrastWarning, updateTypographyToken } from '@/lib/themeJson';
import styles from './theme-management.module.css';

const mobilePreviewUrl = '/mobile-preview/index.html?adminThemePreview=1';
const viewports = { compact: { width: 320, height: 640 }, phone: { width: 390, height: 844 }, large: { width: 430, height: 932 } } as const;

const colors = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'mutedText', 'border', 'focus', 'overlay', 'success', 'warning', 'error', 'info'];
const components = Object.keys(THEME_COMPONENTS) as (keyof typeof THEME_COMPONENTS)[];
const componentFields = Object.fromEntries(Object.entries(THEME_COMPONENTS).map(([id, spec]) => [id, [...spec.colors.map((key): [string, 'color' | 'number'] => [key, 'color']), ...spec.numbers.map((key): [string, 'color' | 'number'] => [key, 'number'])]]));
const labels: Record<string, string> = { primary: 'Brand color', secondary: 'Secondary', accent: 'Accent', background: 'Page background', surface: 'Surface · cards', text: 'Main text', mutedText: 'Secondary text', border: 'Borders', focus: 'Focus ring', overlay: 'Overlay', success: 'Success', warning: 'Warning', error: 'Error', info: 'Information', foreground: 'Text color', radius: 'Corners', borderWidth: 'Border thickness', padding: 'Inner spacing', height: 'Height', caption: 'Small text', body: 'Body text', bodyLarge: 'Large body', title: 'Headings', display: 'Display heading', hero: 'Hero heading' };
Object.assign(labels, { surface: 'Surface', backgroundHero: 'Hero card color', backgroundMuted: 'Green card color', backgroundSky: 'Sky card color', backgroundMint: 'Mint card color', backgroundButter: 'Butter card color', backgroundBlush: 'Peach card color', backgroundLilac: 'Lilac card color', secondaryBackground: 'Secondary button', secondaryForeground: 'Secondary button text', dangerBackground: 'Danger button', dangerForeground: 'Danger button text', toneSecondaryBackground: 'Soft secondary button', toneSecondaryForeground: 'Soft secondary button text', toneTertiaryBackground: 'Soft tertiary button', toneTertiaryForeground: 'Soft tertiary button text' });
Object.assign(labels, { top: 'Gradient top', right: 'Gradient right', bottom: 'Gradient bottom', left: 'Gradient left' });
const spacingLabels: Record<string, string> = { xs: 'Tiny', sm: 'Small', md: 'Regular', lg: 'Large', xl: 'Extra large', xxl: 'Section gap' };
type PresetPalette = { primary: string; secondary: string; accent: string; background: string; surface: string; text: string; mutedText: string; border: string };
const palette = (...values: [string, string, string, string, string, string, string, string]): PresetPalette => {
  const [primary, secondary, accent, background, surface, text, mutedText, border] = values;
  return { primary, secondary, accent, background, surface, text, mutedText, border };
};
const preset = (id: string, name: string, description: string, light: PresetPalette, dark: PresetPalette, components: ThemeDocument['tokens']['components'] = {}, gradients?: ThemeDocument['tokens']['gradients']) => ({ id, name, description, light: { ...light, surface: '#FAFDFE' }, dark, components, gradients });
const PREBUILT_THEMES = [
  preset('creatorhub-sky', 'CreatorHub Sky', 'Soft blue surfaces, lilac actions, and the app’s pastel card colors.', palette('#5C5FC1','#A9ABF3','#B0B2F4','#E9EEFB','#FAFDFE','#2B2736','#777486','#E2E2EB'), palette('#BBA8FF','#5D8F9B','#423C67','#16141D','#211D2C','#F7F4FF','#C4BED0','#464056'), {
    card: { backgroundHero: '#F2F7FE', backgroundMuted: '#C7EBC5', backgroundSky: '#C2E0FD', backgroundMint: '#AAEDE3', backgroundButter: '#F7E0AF', backgroundBlush: '#FED8B7', backgroundLilac: '#F8D3F7' },
  }, { light: { top: '#E9EEFB', right: '#E2EEF8', bottom: '#E5EFF9', left: '#DBECF3' }, dark: { top: '#16141D', right: '#1C2432', bottom: '#182B31', left: '#20253B' } }),
  preset('lavender', 'Brandly Lavender', 'Soft lilac, close to the current app.', palette('#5C5FC1','#C2E0FD','#B0B2F4','#F7F7FC','#FFFFFF','#27283A','#686A7D','#E6E6F0'), palette('#BBA8FF','#5D8F9B','#423C67','#171624','#211F32','#F6F3FF','#B9B5CC','#37344A')),
  preset('ocean', 'Ocean', 'Calm teal with cool, clear surfaces.', palette('#176B68','#BFE8E3','#8DCFC5','#F1F8F7','#FFFFFF','#172D2C','#5F7775','#D9E8E6'), palette('#80D6C9','#245C5B','#A7E4DB','#102120','#19302F','#F0FCFA','#B1CECA','#2D4846')),
  preset('terracotta', 'Terracotta', 'Warm clay, rose and cream.', palette('#8B4652','#F3D7C8','#D99B7E','#FCF6F2','#FFFFFF','#352526','#796668','#EADBD5'), palette('#F2A58B','#633B43','#F5C3A8','#211719','#302124','#FFF4EF','#D1B9B5','#493438')),
  preset('royal-indigo', 'Royal Indigo', 'Confident indigo with crisp contrast.', palette('#4338CA','#DDD9FF','#A5A0FF','#F6F5FF','#FFFFFF','#24213D','#66627E','#E1DFF2'), palette('#A5A0FF','#37317E','#C8C4FF','#17162A','#23213A','#F5F4FF','#BDB9D7','#393650')),
  preset('forest', 'Forest', 'Grounded green with natural neutrals.', palette('#26734D','#D7EBDD','#9BC8A8','#F3F8F3','#FFFFFF','#203327','#64766A','#DCE8DE'), palette('#8CD2A5','#294E38','#B1E1BF','#142219','#203127','#F2FAF4','#B8C9BC','#34483A')),
  preset('berry', 'Berry', 'Rich berry accents on soft rose surfaces.', palette('#A33363','#F4D5E3','#E5A2C0','#FFF5F8','#FFFFFF','#382431','#796471','#EEDCE5'), palette('#F08AB8','#5D2942','#F7B3D0','#24141D','#34202C','#FFF3F8','#D3B7C4','#4A303D')),
  preset('sunrise', 'Sunrise', 'Bright coral and golden warmth.', palette('#C64D3E','#FFE0C2','#F3A26C','#FFF8F1','#FFFFFF','#382820','#78675E','#F0E2D5'), palette('#FF9B7E','#693B34','#FFC28D','#241714','#36221E','#FFF6EF','#D5BDB3','#4A302A')),
  preset('sapphire', 'Sapphire', 'Clear blue for a focused, modern feel.', palette('#1763A6','#D4E9FF','#80B9F0','#F2F8FE','#FFFFFF','#1C2C3B','#607487','#D9E7F2'), palette('#78B9F2','#234A70','#A5D0FA','#121D28','#1C2B39','#F1F8FF','#B4C7D6','#304352')),
  preset('citrus', 'Citrus', 'Fresh lime accents with deep green text.', palette('#5B7617','#E6F0BD','#B4CF5F','#F8FAEF','#FFFFFF','#293018','#6E7659','#E5E9D5'), palette('#C4E66C','#3E501A','#D5EF90','#1A2011','#272E1A','#F7FAEC','#C0CAA1','#3B4430')),
  preset('midnight', 'Midnight', 'Deep blue surfaces with electric accents.', palette('#3949AB','#DDE2FF','#8795FF','#F4F5FC','#FFFFFF','#20243A','#626981','#DFE2EF'), palette('#93A1FF','#303A78','#C0C8FF','#111421','#1B2031','#F1F3FF','#B5BAD0','#30374C')),
  preset('sandstone', 'Sandstone', 'Understated tan, sand and espresso.', palette('#8B5E34','#F0DFC8','#D3B083','#FAF6F0','#FFFFFF','#352B21','#786C5D','#E9DFD2'), palette('#E1B985','#60452C','#F0D0A5','#211B15','#30271D','#FBF5ED','#CEC0AD','#493D30')),
  preset('plum', 'Plum', 'Elegant plum with muted lavender tones.', palette('#7040A0','#E8D9F5','#C49BE1','#F9F5FC','#FFFFFF','#30243B','#756782','#E8DEEF'), palette('#C99FE7','#4D3166','#E0C4F2','#1E1725','#2D2137','#FAF4FF','#C7B7D0','#44334F')),
  preset('lagoon', 'Lagoon', 'Aqua and deep blue inspired by clear water.', palette('#087E8B','#C9F0EF','#65C9C4','#F0FAFA','#FFFFFF','#193234','#5D7678','#D8E9E9'), palette('#62D2D0','#17565C','#9AE5E0','#102123','#193033','#EFFBFA','#B0CECD','#2D484A')),
  preset('copper', 'Copper', 'Polished copper, ivory and charcoal.', palette('#9B542B','#F4DDC8','#D89460','#FCF6F0','#FFFFFF','#35271F','#77665A','#EADDD1'), palette('#E8A473','#653D27','#F4BD91','#211914','#31231C','#FFF5ED','#D1B9AA','#49362B')),
  preset('orchid', 'Orchid', 'Playful orchid with balanced soft pink.', palette('#9747A8','#F1D8F2','#D99BE3','#FCF5FC','#FFFFFF','#342439','#78627E','#EBDDED'), palette('#DA9BE7','#60316B','#EDB9F2','#211624','#312136','#FFF3FF','#D1B7D4','#49334D')),
  preset('slate', 'Slate', 'Quiet blue-gray for a minimal workspace.', palette('#475569','#DDE4EC','#9AAABD','#F4F6F8','#FFFFFF','#27313D','#697582','#DFE4E8'), palette('#A9BCD0','#3D4C5D','#D0DCE8','#171D24','#222A33','#F1F5F8','#B9C3CC','#343E49')),
  preset('ruby', 'Ruby', 'Bold ruby with clean neutral backgrounds.', palette('#B4233A','#F9D9DE','#E98C9B','#FFF5F6','#FFFFFF','#381F24','#7D6267','#EEDCDF'), palette('#F08A9B','#682936','#F5B3BD','#251518','#352024','#FFF3F5','#D6B9BE','#4B3035')),
  preset('pine', 'Pine', 'Deep evergreen with fresh mint accents.', palette('#17634F','#D1EADF','#86C9AE','#F1F8F4','#FFFFFF','#1D3029','#5E756B','#D7E7DE'), palette('#79CEAF','#204B3D','#A5E3C9','#112019','#1B2E25','#F0FAF4','#B1CCBE','#2D4539')),
  preset('marigold', 'Marigold', 'Golden amber balanced by warm ivory.', palette('#A86A05','#F8E7B9','#E9BD5B','#FFFAF0','#FFFFFF','#352B1C','#786D58','#EFE5CF'), palette('#F1C66D','#664713','#F7D995','#241D12','#342A1A','#FFF9EC','#D5C7A8','#4A3C28')),
  preset('ice', 'Ice Blue', 'Light, airy blue with a confident accent.', palette('#2877A8','#D7EFFA','#91D2EC','#F3FAFD','#FFFFFF','#20313B','#627983','#DCEAF0'), palette('#83C9E8','#285773','#B5E2F3','#121F26','#1D2D35','#F1FAFD','#B5CDD5','#304650')),
  preset('moss', 'Moss', 'Muted olive and sage for a calm workspace.', palette('#66733A','#E5E9CF','#B8C38A','#F7F8F1','#FFFFFF','#303322','#70725F','#E4E5D9'), palette('#C3CE8C','#454E2B','#D9E0AD','#1D2016','#2B2F20','#F7F8EB','#C5C9AA','#414633')),
  preset('coral', 'Coral', 'Lively coral tones softened with peach.', palette('#D04F59','#FFE0D8','#F4A79A','#FFF6F3','#FFFFFF','#3B2627','#806B69','#F0DFDB'), palette('#FF9B91','#70343A','#FFC0B1','#261719','#372124','#FFF4F1','#D6BBB6','#4C3033')),
  preset('cosmic', 'Cosmic', 'Violet and indigo with a deep night mode.', palette('#6741D9','#E2D9FF','#B39DFF','#F7F5FF','#FFFFFF','#2A2340','#6E6687','#E4DFF0'), palette('#B59BFF','#433186','#D2C2FF','#191426','#272039','#F7F3FF','#C3B9D7','#3C3452')),
  preset('lagoon-green', 'Lagoon Green', 'Balanced turquoise and botanical green.', palette('#07836E','#CBEDE2','#71C8AC','#F0F9F6','#FFFFFF','#1B312C','#5F7770','#D7E9E2'), palette('#73D2B5','#20594B','#A3E4CC','#10211C','#1B3028','#EFFAF5','#B1CEC1','#2D483C')),
  preset('graphite', 'Graphite', 'Modern monochrome with a vivid blue accent.', palette('#3F5B73','#DFE9F0','#88B6D2','#F4F7F9','#FFFFFF','#25313A','#667680','#DDE4E8'), palette('#8EBFE0','#344A5B','#B7D7EA','#151C21','#212B32','#F2F7FA','#B6C4CC','#34424B')),
] as const;
const screensByPage = Object.fromEntries(THEME_SCREENS.map(({ id, label }) => [id, label]));
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function inheritedComponentValue(theme: AdminTheme, mode: 'light' | 'dark', component: string, field: string, page?: string) {
  const { colors, radius, spacing, borders } = theme.tokens;
  const cardSurfaces: Record<string, keyof typeof surfaceColors.light> = { background: 'surfaceRaised', backgroundHero: 'surfaceHero', backgroundMuted: 'surfaceMuted', backgroundSky: 'surfaceSky', backgroundMint: 'surfaceMint', backgroundButter: 'surfaceButter', backgroundBlush: 'surfaceBlush', backgroundLilac: 'surfaceLilac' };
  if (component === 'card' && cardSurfaces[field]) return surfaceColors[mode][cardSurfaces[field]];
  if (component === 'button' && field === 'secondaryBackground') return surfaceColors[mode].surfaceLilac;
  if (component === 'button' && field === 'secondaryForeground') return colors[mode].text;
  if (component === 'button' && field === 'dangerBackground') return colors[mode].error;
  if (component === 'button' && field === 'dangerForeground') return mode === 'dark' ? '#201829' : '#FFFFFF';
  if (component === 'button' && field === 'toneSecondaryBackground') return colors[mode].secondary;
  if (component === 'button' && field === 'toneSecondaryForeground') return mode === 'dark' ? '#D6F0F3' : '#426B75';
  if (component === 'button' && field === 'toneTertiaryBackground') return mode === 'dark' ? '#A97858' : '#FED8B7';
  if (component === 'button' && field === 'toneTertiaryForeground') return mode === 'dark' ? '#FFE2CF' : '#7D5942';
  if (component === 'button' && field === 'foreground') return mode === 'dark' ? '#201829' : '#FFFFFF';
  if (field === 'background') return component === 'button' ? colors[mode].primary : component === 'tabs' ? colors[mode].accent : colors[mode].surface;
  if (field === 'foreground') return component === 'button' ? (contrast('#ffffff', colors[mode].primary) >= 4.5 ? '#ffffff' : colors[mode].text) : colors[mode].text;
  if (field === 'border') return component === 'tabs' ? colors[mode].primary : colors[mode].border;
  if (field === 'radius') return component === 'badge' || component === 'chip' ? radius.pill : component === 'card' || component === 'dialog' ? radius.lg : radius.control;
  if (field === 'height') return component === 'input' || component === 'navigation' ? 56 : 44;
  if (field === 'padding') return spacing.md;
  return borders.width;
}
function contrast(a: string, b: string) { const luminance = (hex: string) => hex.slice(1, 7).match(/.{2}/g)!.map((part) => parseInt(part, 16) / 255).map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0); const values = [luminance(a), luminance(b)].sort((x, y) => y - x); return (values[0] + .05) / (values[1] + .05); }

export function ThemeManagementPage() {
  const [active, setActive] = useState<{ id: string; name: string; revision: number; published: boolean; theme: AdminTheme } | null>(null);
  const [drafts, setDrafts] = useState<ThemeDraftSummary[]>([]);
  const [versions, setVersions] = useState<ThemeVersionSummary[]>([]);
  const [activations, setActivations] = useState<Array<{ id: string; action: string; actorId: string; createdAt: string; version: ThemeVersionSummary }>>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [draftCursor, setDraftCursor] = useState<string | null>(null);
  const [activationCursor, setActivationCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState<ThemeDraft | null>(null);
  const [document, setDocument] = useState<AdminTheme | null>(null);
  const [historyAvailability, setHistoryAvailability] = useState({ undo: false, redo: false });
  const documentHistory = useRef<{ previous: AdminTheme | null; past: AdminTheme[]; future: AdminTheme[] }>({ previous: null, past: [], future: [] });
  const skipHistoryCapture = useRef(false);
  const [name, setName] = useState('Brandly theme');
  const [note, setNote] = useState('');
  const [screen, setScreen] = useState<ThemeScreenId>('home');
  const [previewSide, setPreviewSide] = useState<'brand' | 'creator'>('brand');
  const [sharedGroup, setSharedGroup] = useState<ThemePageGroupId>('commerce');
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [selectedVersion, setSelectedVersion] = useState<ThemeVersion | null>(null);
  const [previewVersion, setPreviewVersion] = useState<ThemeVersion | null>(null);
  const [previewActive, setPreviewActive] = useState(false);
  const [viewport, setViewport] = useState<keyof typeof viewports>('phone');
  const [mobilePanel, setMobilePanel] = useState<'editor' | 'preview'>('editor');
  const [editorTab, setEditorTab] = useState<'brand' | 'layout' | 'components' | 'pages' | 'content' | 'json'>('brand');
  const [pageScope, setPageScope] = useState<'page' | 'shared'>('page');
  const [selectedComponent, setSelectedComponent] = useState('button');
  const [componentScope, setComponentScope] = useState<'global' | 'page'>('global');
  const [selectedType, setSelectedType] = useState('body');
  const [inspectMode, setInspectMode] = useState(false);
  const [pickedField, setPickedField] = useState('');
  const [pickedComponent, setPickedComponent] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [libraryTab, setLibraryTab] = useState<'history' | 'prebuilt'>('history');
  const [previewReady, setPreviewReady] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [workspaceFullscreen, setWorkspaceFullscreen] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [jsonError, setJsonError] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [colorInputs, setColorInputs] = useState<Record<string, string>>({});
  const [componentSearch, setComponentSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean; warning?: boolean } | null>(null);
  const lastContrastToast = useRef('');
  const lastValidationToast = useRef('');
  const documentRef = useRef<HTMLIFrameElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const previewHostRef = useRef<HTMLDivElement>(null);
  const previewSectionRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [previewHostSize, setPreviewHostSize] = useState({ width: 390, height: 680 });
  const sideScreens = THEME_SCREENS.filter((item) => item.audiences.some((audience) => audience === previewSide));
  const contentFields = THEME_CONTENT_FIELDS.filter((field) => field.screen === screen && field.audience === previewSide);
  const reload = useCallback(async () => {
    const [live, savedDrafts, page, audit] = await Promise.all([getActiveTheme(), getThemeDrafts(), getThemeVersions(), getThemeActivations()]);
    setActive(live); setDrafts(savedDrafts.items); setDraftCursor(savedDrafts.nextCursor); setVersions(page.items); setCursor(page.nextCursor); setActivations(audit.items); setActivationCursor(audit.nextCursor);
  }, []);
  useEffect(() => { void reload().catch((error: unknown) => setMessage({ text: error instanceof Error ? error.message : 'Could not load themes.', error: true })); }, [reload]);
  useEffect(() => {
    const history = documentHistory.current;
    if (history.previous === document) return;
    const previous = history.previous;
    history.previous = document;
    if (skipHistoryCapture.current) skipHistoryCapture.current = false;
    else if (previous && document) {
      history.past.push(clone(previous));
      if (history.past.length > 50) history.past.shift(); // Keep memory bounded during continuous color-picker edits.
      history.future = [];
    }
    setHistoryAvailability({ undo: history.past.length > 0, redo: history.future.length > 0 });
  }, [document]);
  useEffect(() => { setJsonText(document ? JSON.stringify({ ...document, name }, null, 2) : ''); }, [document, name]);
  const assignedGroup = document && getThemePageGroup(document.tokens.pageGroups ?? {},screen)?.id as ThemePageGroupId | undefined;
  const sharedColors = assignedGroup ? document?.tokens.pageGroups?.[assignedGroup]?.colors ?? {} : {};
  const selectedColors = useMemo(() => Object.fromEntries(Object.entries({ ...document?.tokens.colors[mode], ...sharedColors, ...(document?.tokens.pages[screen] ?? {}) }).filter((entry): entry is [string, string] => typeof entry[1] === 'string')), [document, mode, screen, sharedColors]);
  const validationError = useMemo(() => {
    if (!document) return '';
    try { parseThemeJson(JSON.stringify({ ...document, name })); return ''; }
    catch (error) { return error instanceof Error ? error.message : 'Invalid theme'; }
  }, [document, name]);
  const contrastWarning = useMemo(() => document ? themeContrastWarning({ ...document, name }) : '', [document, name]);
  useEffect(() => {
    if (!contrastWarning) { lastContrastToast.current = ''; setMessage((current) => current?.warning ? null : current); return; }
    if (lastContrastToast.current === contrastWarning) return;
    lastContrastToast.current = contrastWarning;
    setMessage({ warning: true, text: `${contrastWarning} This happens when text and its background are too similar. Your draft remains editable and preview updates continue; adjust the indicated color before publishing.` });
  }, [contrastWarning]);
  useEffect(() => {
    if (!validationError) { lastValidationToast.current = ''; return; }
    if (lastValidationToast.current === validationError) return;
    lastValidationToast.current = validationError;
    setMessage({ error: true, text: `Invalid theme value: ${validationError}. Your current draft edits are preserved; correct this field and continue.` });
  }, [validationError]);
  useEffect(() => {
    if (!message) return;
    const current = message;
    const timer = window.setTimeout(() => setMessage((value) => value === current ? null : value), current.error || current.warning ? 8000 : 4000);
    return () => window.clearTimeout(timer);
  }, [message]);
  const dirty = !draft || !document || name !== draft.name || note !== draft.changeNote || JSON.stringify(document) !== JSON.stringify(draft.document);
  const previewDocument = previewVersion?.document ?? (previewActive || !document ? active?.theme : document);
  const previewLabel = previewVersion ? `${previewVersion.name} v${previewVersion.revision}` : previewActive || !document ? active ? `${active.published ? 'Active' : 'Bundled'} · ${active.name} v${active.revision}` : 'Bundled default' : draft ? `Draft v${draft.revision}${dirty ? ' · unsaved edits' : ''}` : name;
  const previewRevision = previewVersion ? `version:${previewVersion.id}` : previewActive || !document ? active?.id ?? 'bundled-default-v1' : draft ? `draft:${draft.id}:${draft.revision}:${dirty ? 'unsaved' : 'saved'}` : `new-draft:${name}`;
  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setMessage(null);
    try { await action(); await reload(); setMessage({ text: success }); }
    catch (error) { setMessage({ text: error instanceof Error ? error.message : 'Theme action failed.', error: true }); }
    finally { setBusy(false); }
  };
  const resetDocumentHistory = () => {
    documentHistory.current.past = [];
    documentHistory.current.future = [];
    skipHistoryCapture.current = true;
    setHistoryAvailability({ undo: false, redo: false });
  };
  const undoDocument = () => {
    const history = documentHistory.current;
    const previous = history.past.pop();
    if (!document || !previous) return;
    history.future.push(clone(document));
    skipHistoryCapture.current = true;
    setColorInputs({}); setDocument(previous);
    setHistoryAvailability({ undo: history.past.length > 0, redo: true });
  };
  const redoDocument = () => {
    const history = documentHistory.current;
    const next = history.future.pop();
    if (!document || !next) return;
    history.past.push(clone(document));
    skipHistoryCapture.current = true;
    setColorInputs({}); setDocument(next);
    setHistoryAvailability({ undo: true, redo: history.future.length > 0 });
  };
  const startDraft = (source: AdminTheme, draftName: string) => { resetDocumentHistory(); setColorInputs({}); setDocument(clone(source)); setName(draftName); setDraft(null); setNote(''); setPreviewVersion(null); setPreviewActive(false); };
  const applyPreset = (preset: typeof PREBUILT_THEMES[number]) => {
    if (!active) return;
    const hasUnsaved = !!document && (draft ? dirty : name !== 'Brandly theme' || JSON.stringify(document) !== JSON.stringify(active.theme));
    if (hasUnsaved && !window.confirm('Replace the current unsaved edits with this preset?')) return;
    const next = applyThemePreset(active.theme, preset);
    setColorInputs({}); setDocument(next); setName(preset.name); setNote(`Started from ${preset.name} preset`); setDraft(null); setPreviewVersion(null); setPreviewActive(false); setShowHistory(false); setEditorTab('brand');
  };
  const save = () => document && run(async () => {
    const next = draft ? await saveThemeDraft(draft, { ...document, name }, name, note) : await createThemeDraft({ ...document, name }, name, note);
    setDraft(next); skipHistoryCapture.current = true; setDocument(next.document); setName(next.name); setNote(next.changeNote); setPreviewVersion(null); setPreviewActive(false);
  }, 'Draft saved. The mobile app is unchanged until you publish.');
  const publish = () => document && run(async () => {
    const saved = draft ? dirty ? await saveThemeDraft(draft, { ...document, name }, name, note) : draft : await createThemeDraft({ ...document, name }, name, note);
    await publishThemeDraft(saved, note);
    setDraft(null); resetDocumentHistory(); setDocument(null); setPreviewVersion(null); setPreviewActive(true);
  }, 'Theme published. The preview now shows the active version.');
  const restore = (version: ThemeVersionSummary) => {
    if (!window.confirm(`Activate ${version.name} v${version.revision}? This adds a restore audit event.`)) return;
    void run(async () => { await activateThemeVersion(version.id); setDraft(null); resetDocumentHistory(); setDocument(null); setPreviewVersion(null); setPreviewActive(true); }, `Activated ${version.name} v${version.revision}.`);
  };
  const continueDraft = (item: ThemeDraftSummary) => void run(async () => {
    const full = await getThemeDraft(item.id);
    resetDocumentHistory(); setColorInputs({}); setDraft(full); setDocument(clone(full.document)); setName(full.name); setNote(full.changeNote); setPreviewVersion(null); setPreviewActive(false);
  }, 'Draft loaded for editing and preview.');
  const inspectVersion = (item: ThemeVersionSummary) => void run(async () => {
    const full = await getThemeVersion(item.id);
    setSelectedVersion(full); setPreviewVersion(full); setPreviewActive(false);
  }, 'Saved version loaded in the app preview.');
  const duplicateVersion = (item: ThemeVersionSummary) => void run(async () => {
    const full = await getThemeVersion(item.id);
    startDraft(full.document, `${item.name} copy`);
  }, 'Saved version copied into a new draft.');
  const updateColor = (key: string, value: string) => setDocument((current) => current && ({ ...current, tokens: { ...current.tokens, colors: { ...current.tokens.colors, [mode]: { ...current.tokens.colors[mode], [key]: value } } } }));
  const updateGradient = (key: string, value: string) => setDocument((current) => current && ({ ...current, tokens: { ...current.tokens, gradients: { light: { top: '#E9EEFB', right: '#E2EEF8', bottom: '#E5EFF9', left: '#DBECF3', ...current.tokens.gradients?.light }, dark: { top: '#16141D', right: '#1C2432', bottom: '#182B31', left: '#20253B', ...current.tokens.gradients?.dark }, [mode]: { top: '#E9EEFB', right: '#E2EEF8', bottom: '#E5EFF9', left: '#DBECF3', ...current.tokens.gradients?.[mode], [key]: value } } } }));
  const updateContent = (key: string, value: string) => setDocument((current) => current && ({ ...current, content: { ...current.content, [key]: value } }));
  const updateNumber = (group: 'spacing' | 'radius', key: string, value: number) => setDocument((current) => current && ({ ...current, tokens: { ...current.tokens, [group]: { ...current.tokens[group], [key]: value } } }));
  const updateDepth = (group: 'borders' | 'elevation', key: string, value: number) => setDocument((current) => current && ({ ...current, tokens: { ...current.tokens, [group]: { ...current.tokens[group], [key]: value } } }));
  const updateOpacity = (key: 'disabled' | 'light' | 'dark', value: number) => setDocument((current) => current && ({ ...current, tokens: { ...current.tokens, opacity: key === 'disabled' ? { ...current.tokens.opacity, disabled: value } : { ...current.tokens.opacity, overlay: { ...current.tokens.opacity.overlay, [key]: value } } } }));
  const updateShadow = (mode: 'light' | 'dark', field: keyof AdminTheme['tokens']['shadows']['light'], value: string | number) => setDocument((current) => current && ({ ...current, tokens: { ...current.tokens, shadows: { ...current.tokens.shadows, [mode]: { ...current.tokens.shadows[mode], [field]: value } } } }));
  const updatePageColor = (key: string, value: string) => setDocument((current) => current && ({ ...current, tokens: { ...current.tokens, pages: { ...current.tokens.pages, [screen]: { ...current.tokens.pages[screen], [key]: value } } } }));
  const updateSharedColor = (key: string, value: string) => setDocument((current) => {
    if (!current) return current;
    const groups = current.tokens.pageGroups ?? {};
    const group = groups[sharedGroup] ?? { pages: [], colors: {}, followRegistry: true };
    return { ...current, tokens: { ...current.tokens, pageGroups: { ...groups, [sharedGroup]: { ...group, colors: { ...group.colors, [key]: value } } } } };
  });
  const setPageGroupMembership = (groupId: ThemePageGroupId, pageId: ThemeScreenId, enabled: boolean) => setDocument((current) => {
    if (!current) return current;
    const groups = { ...(current.tokens.pageGroups ?? {}) };
    for (const [id, group] of Object.entries(groups)) groups[id] = { ...group, followRegistry: false, pages: Array.from(new Set([...group.pages, ...(group.followRegistry ? THEME_SCREENS.filter((item) => item.group === id).map((item) => item.id) : [])])).filter((page) => page !== pageId) };
    if (enabled) {
      const group = groups[groupId] ?? { pages: [], colors: {} };
      groups[groupId] = { ...group, pages: [...group.pages, pageId] };
    }
    return { ...current, tokens: { ...current.tokens, pageGroups: groups } };
  });
  const useSharedTheme = () => setDocument((current) => {
    if (!current) return current;
    const groupId = assignedGroup ?? THEME_SCREENS.find((item) => item.id === screen)?.group ?? sharedGroup;
    const groups = { ...(current.tokens.pageGroups ?? {}) };
    for (const [id, group] of Object.entries(groups)) groups[id] = { ...group, pages: group.pages.filter((page) => page !== screen) };
    const group = groups[groupId] ?? { pages: [], colors: {} };
    groups[groupId] = { ...group, pages: [...group.pages, screen] };
    const pages = { ...current.tokens.pages }; delete pages[screen];
    const pageComponents = { ...current.tokens.pageComponents }; delete pageComponents[screen];
    return { ...current, tokens: { ...current.tokens, pageGroups: groups, pages, pageComponents } };
  });
  const customizePage = () => setDocument((current) => {
    if (!current) return current;
    return { ...current, tokens: { ...current.tokens, pages: { ...current.tokens.pages, [screen]: { ...(current.tokens.pages[screen] ?? {}) } } } };
  });
  const resetPage = () => setDocument((current) => {
    if (!current) return current;
    const pages = { ...current.tokens.pages }; delete pages[screen];
    const pageComponents = { ...current.tokens.pageComponents }; delete pageComponents[screen];
    return { ...current, tokens: { ...current.tokens, pages, pageComponents } };
  });
  const downloadJson = (theme: AdminTheme, fileName: string) => {
    const url = URL.createObjectURL(new Blob([exportThemeJson(theme)], { type: 'application/json' }));
    const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = `${fileName.replace(/[^a-z0-9-_]+/gi, '-')}.json`; window.document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const importJson = async (file?: File) => {
    if (!file) return;
    setJsonError('');
    try {
      if (file.size > 256 * 1024) throw new Error('theme: JSON file exceeds the 256 KB import limit');
      const imported = parseThemeJson(await file.text());
      const next = { ...imported, tokens: { ...imported.tokens, pageGroups: imported.tokens.pageGroups ?? {} } } as unknown as AdminTheme;
      setColorInputs({}); setDocument(next); setName(next.name); setNote('Imported JSON theme'); setDraft(null); setPreviewVersion(null); setPreviewActive(false); setSelectedVersion(null); setMobilePanel('preview');
      setMessage({ text: 'JSON loaded as a new, unsaved draft. Save it to add it to draft history.' });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'theme: import failed';
      setJsonError(detail); setMessage({ text: detail, error: true });
    } finally { if (importRef.current) importRef.current.value = ''; }
  };
  const applyJson = (formatOnly = false) => {
    setJsonError('');
    try {
      const imported = parseThemeJson(jsonText);
      const formatted = JSON.stringify(imported, null, 2);
      setJsonText(`${formatted}\n`);
      if (formatOnly) { setMessage({ text: 'JSON is valid and formatted.' }); return; }
      setColorInputs({}); setDocument(imported as AdminTheme); setName(imported.name); setNote('Updated from validated JSON'); setDraft(null); setPreviewVersion(null); setPreviewActive(false); setSelectedVersion(null);
      setMessage({ text: 'Validated JSON applied as a new draft. Save it to keep it.' });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'theme: invalid JSON';
      setJsonError(detail); setMessage({ text: detail, error: true });
    }
  };
  const updateTypography = (key: string, field: 'size' | 'lineHeight', value: number) => setDocument((current) => current && updateTypographyToken(current, key, field, value));
  const updateTypographyChoice = (key: string, field: 'weight' | 'family', value: string) => setDocument((current) => current && ({ ...current, tokens: { ...current.tokens, typography: { ...current.tokens.typography, [key]: { ...current.tokens.typography[key], [field]: value } } } }));

  const updateComponent = (field: string, value: string | number) => setDocument((current) => {
    if (!current) return current;
    const foregroundField = selectedComponent === 'button' && (field === 'background' || field.endsWith('Background')) ? field === 'background' ? 'foreground' : `${field.slice(0, -10)}Foreground` : undefined;
    const foreground = foregroundField && typeof value === 'string' ? contrast('#FFFFFF', value) >= contrast('#000000', value) ? '#FFFFFF' : '#000000' : undefined;
    if (componentScope === 'global') return { ...current, tokens: { ...current.tokens, components: { ...current.tokens.components, [selectedComponent]: { ...current.tokens.components[selectedComponent], [field]: value, ...(foregroundField && foreground ? { [foregroundField]: foreground } : {}) } } } };
    const page = current.tokens.pageComponents?.[screen] ?? {};
    return { ...current, tokens: { ...current.tokens, pageComponents: { ...current.tokens.pageComponents, [screen]: { ...page, [selectedComponent]: { ...page[selectedComponent], [field]: value, ...(foregroundField && foreground ? { [foregroundField]: foreground } : {}) } } } } };
  });
  const componentColorControl = (field: string, value: string) => {
    const inputKey = `component.${componentScope}.${screen}.${selectedComponent}.${field}`;
    const stored = value.toUpperCase();
    const inputValue = colorInputs[inputKey] ?? stored;
    const saveValue = (next: string) => {
      setColorInputs((current) => ({ ...current, [inputKey]: next }));
      if (/^#[\da-f]{6}$/i.test(next)) updateComponent(field, next.toUpperCase());
    };
    return <span className={styles.componentColor}><input data-theme-field={`${selectedComponent}.${field}`} aria-label={`${selectedComponent} ${field} swatch`} type="color" value={stored} onChange={(event) => saveValue(event.currentTarget.value)} /><input aria-label={`${selectedComponent} ${field} HEX`} className={styles.hexInput} value={inputValue} maxLength={7} spellCheck={false} onChange={(event) => saveValue(event.target.value)} onBlur={() => { if (!/^#[\da-f]{6}$/i.test(inputValue)) { setColorInputs((current) => ({ ...current, [inputKey]: stored })); setMessage({ text: 'Enter a six-digit HEX color, such as #5C5FC1.', error: true }); } }} /></span>;
  };
  const resetComponent = () => setDocument((current) => {
    if (!current) return current;
    if (componentScope === 'global') { const next = { ...current.tokens.components }; delete next[selectedComponent]; return { ...current, tokens: { ...current.tokens, components: next } }; }
    const next = { ...current.tokens.pageComponents?.[screen] }; delete next[selectedComponent];
    return { ...current, tokens: { ...current.tokens, pageComponents: { ...current.tokens.pageComponents, [screen]: next } } };
  });
  const colorControls = (keys: string[], values: Record<string, string | number>, prefix: string, change: (key: string, value: string) => void) => <div className={styles.colorGrid}>{keys.map((key) => { const stored = String(values[key] ?? '#ffffff').slice(0, 7); const scope = prefix === 'shared' ? sharedGroup : prefix === 'page' ? screen : 'brand'; const inputKey = `${prefix}.${scope}.${mode}.${key}`; const inputValue = colorInputs[inputKey] ?? stored; const saveValue = (value: string) => { setColorInputs((current) => ({ ...current, [inputKey]: value })); if (/^#[\da-f]{6}$/i.test(value)) change(key, value.toUpperCase()); }; return <div className={styles.colorItem} key={key}><span className={styles.colorLabel}>{labels[key] ?? key}</span><div><input aria-label={`${labels[key] ?? key} swatch`} type="color" value={stored} onChange={(event) => saveValue(event.currentTarget.value)} /><input data-theme-field={`${prefix}.${key}`} aria-label={`${labels[key] ?? key} HEX`} className={styles.hexInput} value={inputValue} maxLength={7} spellCheck={false} onChange={(event) => saveValue(event.target.value)} onBlur={() => { if (!/^#[\da-f]{6}$/i.test(inputValue)) { setColorInputs((current) => ({ ...current, [inputKey]: stored })); setMessage({ text: `${labels[key] ?? key} needs a six-digit HEX value such as #5C5FC1.`, error: true }); } }} /></div></div>; })}</div>;
  const typeToken = document?.tokens.typography[selectedType];
  const openSection = (next: typeof editorTab) => setEditorTab(editorTab === next ? 'brand' : next);

  const previewDocumentRef = useRef(previewDocument);
  const lastValidPreviewRef = useRef<AdminTheme | null>(null);
  const previewRevisionRef = useRef(previewRevision);
  const previewScreenRef = useRef(screen);
  const previewModeRef = useRef(mode);
  const previewSideRef = useRef(previewSide);
  previewDocumentRef.current = previewDocument;
  previewRevisionRef.current = previewRevision;
  previewScreenRef.current = screen;
  previewModeRef.current = mode;
  previewSideRef.current = previewSide;
  const syncPreview = useCallback(() => {
    const frame = documentRef.current?.contentWindow;
    const theme = previewDocumentRef.current;
    if (!frame) return;
    const usableTheme = theme === document && validationError ? lastValidPreviewRef.current ?? active?.theme : theme;
    if (!usableTheme) return;
    if (usableTheme === theme) lastValidPreviewRef.current = theme;
    frame.postMessage({ type: 'brandly:admin-theme-preview', theme: usableTheme, revision: previewRevisionRef.current, screen: previewScreenRef.current, mode: previewModeRef.current, role: previewSideRef.current === 'creator' ? 'Influencer' : 'Brand' }, window.location.origin);
  }, [active, document, validationError]);
  useEffect(() => { syncPreview(); }, [previewDocument, previewRevision, screen, mode, previewSide, syncPreview]);
  useEffect(() => { if (document) { setPreviewVersion(null); setPreviewActive(false); } }, [document]);
  useEffect(() => {
    if (!inspectMode || !previewReady) return;
    const frameDocument = documentRef.current?.contentDocument;
    if (!frameDocument) { setInspectMode(false); setMessage({ text: 'Preview inspection requires the same-origin mobile preview.', error: true }); return; }
    const style = frameDocument.createElement('style');
    style.textContent = 'body{cursor:crosshair!important} [data-testid^="theme-component-"]:hover{outline:2px solid #5c5fc1!important;outline-offset:2px!important}';
    frameDocument.head.append(style);
    const onClick = (event: MouseEvent) => {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      const target = event.target instanceof Element ? event.target : null;
      const marked = target?.closest('[data-testid^="theme-component-"]');
      const component = marked?.getAttribute('data-testid')?.replace('theme-component-', '');
      if (component && components.includes(component as keyof typeof THEME_COMPONENTS)) {
        setPickedComponent(component); setSelectedComponent(component); setEditorTab('components'); setPickedField(`${component}.${['button', 'appBar', 'badge', 'alert'].includes(component) && marked !== target ? 'foreground' : 'background'}`);
        setMessage({ text: `Editing shared ${component} style. This change applies wherever the app uses this component.` });
      } else {
        const color = target && frameDocument.defaultView?.getComputedStyle(target).color;
        const hex = color?.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        const matchingKey = hex && Object.entries(selectedColors).find(([, value]) => value.toLowerCase() === `#${hex.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`)?.[0];
        if (matchingKey && document?.tokens.pages[screen]?.[matchingKey]) { setEditorTab('pages'); setPageScope('page'); setPickedField(`page.${matchingKey}`); }
        else if (matchingKey && assignedGroup && sharedColors[matchingKey]) { setEditorTab('pages'); setPageScope('shared'); setSharedGroup(assignedGroup); setPickedField(`shared.${matchingKey}`); }
        else if (matchingKey) { setEditorTab('brand'); setPickedField(`color.${matchingKey}`); }
        else { setPickedComponent(''); setEditorTab('pages'); setPageScope('page'); setPickedField(''); }
        setMessage({ text: matchingKey ? `Editing ${matchingKey} at the scope used by this screen.` : 'This element has a screen-specific style. Choose its shared component or page color below.' });
      }
      setInspectMode(false);
    };
    frameDocument.addEventListener('click', onClick, true);
    return () => { frameDocument.removeEventListener('click', onClick, true); style.remove(); };
  }, [inspectMode, previewReady, frameKey, document, screen, selectedColors, assignedGroup, sharedColors]);
  useEffect(() => {
    if (!pickedComponent || !previewReady) return;
    const frameDocument = documentRef.current?.contentDocument;
    if (!frameDocument) return;
    const style = frameDocument.createElement('style');
    style.textContent = `[data-testid="theme-component-${pickedComponent}"]{outline:2px solid #5c5fc1!important;outline-offset:2px!important}`;
    frameDocument.head.append(style);
    const timeout = window.setTimeout(() => style.remove(), 1800);
    return () => { window.clearTimeout(timeout); style.remove(); };
  }, [pickedComponent, previewReady, frameKey]);
  useEffect(() => {
    if (!pickedField) return;
    const selector = `[data-theme-field="${pickedField}"]`;
    const id = window.requestAnimationFrame(() => {
      const input = window.document.querySelector<HTMLInputElement>(selector);
      input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      input?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [pickedField, editorTab, selectedComponent]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== documentRef.current?.contentWindow || event.data?.type !== 'brandly:theme-preview-ready') return;
      setPreviewReady(true);
      setPreviewError(false);
      syncPreview();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [syncPreview]);
  useEffect(() => {
    const onScreenChange = (event: MessageEvent) => {
      const nextScreen = event.data?.screen;
      if (event.origin !== window.location.origin || event.source !== documentRef.current?.contentWindow || event.data?.type !== 'brandly:theme-preview-screen' || !THEME_SCREENS.some((item) => item.id === nextScreen && item.audiences.some((audience) => audience === previewSide))) return;
      setScreen(nextScreen as ThemeScreenId);
    };
    window.addEventListener('message', onScreenChange);
    return () => window.removeEventListener('message', onScreenChange);
  }, [previewSide]);
  useEffect(() => {
    if (previewReady || previewError || !previewDocument) return;
    const timeout = window.setTimeout(() => setPreviewError(true), 15_000);
    return () => window.clearTimeout(timeout);
  }, [previewDocument, previewReady, previewError, frameKey]);
  useEffect(() => {
    const element = previewHostRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setPreviewHostSize({ width: entry.contentRect.width, height: window.document.fullscreenElement === previewHostRef.current ? entry.contentRect.height : Math.min(entry.contentRect.height, window.innerHeight * .8) }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { previewHostRef.current?.scrollTo(0, 0); }, [screen]);
  useEffect(() => {
    const updateFullscreenState = () => {
      setPreviewFullscreen(window.document.fullscreenElement === previewHostRef.current);
      setWorkspaceFullscreen(window.document.fullscreenElement === workspaceRef.current);
    };
    window.document.addEventListener('fullscreenchange', updateFullscreenState);
    return () => window.document.removeEventListener('fullscreenchange', updateFullscreenState);
  }, []);
  const togglePreviewFullscreen = async () => {
    const preview = previewHostRef.current;
    if (!preview) return;
    try {
      if (window.document.fullscreenElement === preview) await window.document.exitFullscreen();
      else await preview.requestFullscreen();
    } catch {
      setMessage({ text: 'Full screen could not be opened in this browser.', error: true });
    }
  };
  const toggleWorkspaceFullscreen = async () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    try {
      if (window.document.fullscreenElement === workspace) await window.document.exitFullscreen();
      else await workspace.requestFullscreen();
    } catch {
      setMessage({ text: 'Full screen could not be opened in this browser.', error: true });
    }
  };

  const viewportScale = Math.min(1, (previewHostSize.width - 16) / viewports[viewport].width, (previewHostSize.height - 16) / viewports[viewport].height);
  const deviceStyle = { '--device-scale': Math.max(.2, viewportScale), '--device-width': `${viewports[viewport].width}px`, '--device-height': `${viewports[viewport].height}px` } as React.CSSProperties;

  return <main className={styles.page}>
    <header className={styles.header}><div><p className={styles.kicker}>SYSTEM · MOBILE APP</p><h1>Theme Studio</h1><p className={styles.headerDescription}>Style your app. Preview privately. Publish when ready.</p><button className={styles.primary} disabled={busy || !active} onClick={() => active && startDraft(active.theme, 'Brandly theme')}><Plus size={16} /> New from current theme</button></div></header>
    {message && typeof window !== 'undefined' && createPortal(<div className={styles.toastViewport}><div className={`${styles.toast} ${message.error ? styles.toastError : message.warning ? styles.toastWarning : ''}`} role={message.error ? 'alert' : 'status'} aria-live={message.error ? 'assertive' : 'polite'}>{message.error || message.warning ? <AlertTriangle size={17} aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}<span>{message.text}</span><button type="button" className={styles.toastClose} aria-label="Dismiss notification" onClick={() => setMessage(null)}><X size={16} /></button></div></div>, window.document.body)}
    <section className={styles.live}><div><span className={styles.liveDot} /> {active?.published ? 'ACTIVE PUBLISHED THEME' : 'BUNDLED DEFAULT · NOT PUBLISHED'}</div><strong>{active ? `${active.name} · v${active.revision}` : 'Loading active version…'}</strong><span>Published themes refresh on app launch and when the app returns to foreground.</span></section>
    <div className={styles.mobileTabs} role="tablist" aria-label="Theme editor panels"><button role="tab" aria-selected={mobilePanel === 'editor'} className={mobilePanel === 'editor' ? styles.modeActive : ''} onClick={() => setMobilePanel('editor')}>Editor</button><button role="tab" aria-selected={mobilePanel === 'preview'} className={mobilePanel === 'preview' ? styles.modeActive : ''} onClick={() => setMobilePanel('preview')}>App preview</button></div>
    <div ref={workspaceRef} className={styles.columns}>
      <section className={`${styles.editor} ${mobilePanel === 'preview' ? styles.mobileHidden : ''}`}>
        <div className={styles.sectionTitle}><h2>{draft ? draft.name : 'New draft'}</h2><span className={styles.draftStatus}>{document ? dirty ? 'Unsaved changes' : `Saved draft v${draft?.revision}` : 'Active theme'}</span><div className={styles.historyActions}><button type="button" className={styles.iconButton} aria-label="Undo theme edit" title="Undo" disabled={!historyAvailability.undo} onClick={undoDocument}><Undo2 size={17} /></button><button type="button" className={styles.iconButton} aria-label="Redo theme edit" title="Redo" disabled={!historyAvailability.redo} onClick={redoDocument}><Redo2 size={17} /></button></div></div>
        {!document ? <div className={styles.empty}>Choose New from current theme to start editing.</div> : <>
          <nav className={styles.editorTabs} aria-label="Theme sections">{([['brand', 'Brand', Palette], ['components', 'Components', Blocks], ['pages', 'Pages', PanelsTopLeft], ['content', 'Content', FileText]] as const).map(([id, label, Icon]) => <button type="button" key={id} className={editorTab === id ? styles.editorTabActive : ''} aria-current={editorTab === id ? 'page' : undefined} onClick={() => setEditorTab(id)}><Icon size={15} />{label}</button>)}</nav>
          {editorTab === 'brand' && <div className={`${styles.studioSection} ${styles.brandSection}`}><label className={styles.field}><span><Palette size={15} aria-hidden="true" />Theme name</span><input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} /></label><div className={styles.modeTabs}>{(['light', 'dark'] as const).map((item) => <button type="button" aria-label={item === 'light' ? 'Light appearance' : 'Dark appearance'} aria-pressed={mode === item} title={item === 'light' ? 'Light appearance' : 'Dark appearance'} className={mode === item ? styles.modeActive : ''} key={item} onClick={() => setMode(item)}>{item === 'light' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}</button>)}</div>{colorControls(['primary', 'secondary', 'accent', 'surface'], document.tokens.colors[mode], 'color', updateColor)}<details className={styles.subsection}><summary>More colors</summary>{colorControls(['background', 'text', 'mutedText', 'border', 'focus', 'overlay', 'success', 'warning', 'error', 'info'], document.tokens.colors[mode], 'color', updateColor)}<strong>Background gradient</strong>{colorControls(['top', 'right', 'bottom', 'left'], document.tokens.gradients?.[mode] ?? (mode === 'light' ? { top: '#E9EEFB', right: '#E2EEF8', bottom: '#E5EFF9', left: '#DBECF3' } : { top: '#16141D', right: '#1C2432', bottom: '#182B31', left: '#20253B' }), 'gradient', updateGradient)}</details><button className={styles.textButton} onClick={() => setEditorTab('layout')}>Typography, spacing & corners</button></div>}
          {editorTab === 'layout' && typeToken && <div className={styles.studioSection}><button className={styles.textButton} onClick={() => setEditorTab('brand')}>← Back to Brand</button><h3>Typography & layout</h3><label className={styles.field}>Text style<select value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>{Object.keys(document.tokens.typography).map((role) => <option key={role} value={role}>{labels[role]}</option>)}</select></label><div className={styles.fontSample} style={{ fontFamily: typeToken.family === 'display' ? 'Georgia, serif' : 'system-ui, sans-serif', fontSize: typeToken.size, lineHeight: `${typeToken.lineHeight}px`, fontWeight: Number(typeToken.weight) }}>The quick brown fox<br />Your app, your style.</div><div className={styles.typeControls}><label>Size<input aria-label={`${selectedType} font size`} type="number" min={10} max={64} value={typeToken.size} onChange={(event) => updateTypography(selectedType, 'size', Number(event.target.value))} /></label><label>Line height<input aria-label={`${selectedType} line height`} type="number" min={typeToken.size} max={96} value={typeToken.lineHeight} onChange={(event) => updateTypography(selectedType, 'lineHeight', Number(event.target.value))} /></label><label>Weight<select aria-label={`${selectedType} weight`} value={typeToken.weight} onChange={(event) => updateTypographyChoice(selectedType, 'weight', event.target.value)}>{[['400','Regular'],['500','Medium'],['600','Semibold'],['700','Bold'],['800','Extra bold'],['900','Heavy']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Font<select aria-label={`${selectedType} font`} value={typeToken.family} onChange={(event) => updateTypographyChoice(selectedType, 'family', event.target.value)}><option value="system">System</option><option value="display">Display</option></select></label></div><details className={styles.subsection}><summary>Spacing, corners & depth</summary><div className={styles.numberGrid}>{Object.entries(document.tokens.spacing).map(([key,value]) => <label key={key}>{spacingLabels[key]} spacing<input type="number" min={0} max={64} value={value} onChange={(event) => updateNumber('spacing',key,Number(event.target.value))} /></label>)}{Object.entries(document.tokens.radius).map(([key,value]) => <label key={key}>{spacingLabels[key] ?? key} corners<input type="number" min={0} max={key === 'pill' ? 999 : 128} value={value} onChange={(event) => updateNumber('radius',key,Number(event.target.value))} /></label>)}<label>Disabled opacity<input type="number" min={0.2} max={0.7} step={0.01} value={document.tokens.opacity.disabled} onChange={(event) => updateOpacity('disabled',Number(event.target.value))} /></label>{(['light','dark'] as const).map((item) => <label key={item}>{item} overlay<input type="number" min={0} max={1} step={0.01} value={document.tokens.opacity.overlay[item]} onChange={(event) => updateOpacity(item,Number(event.target.value))} /></label>)}<label>Border thickness<input type="number" min={0} max={4} step={0.5} value={document.tokens.borders.width} onChange={(event) => updateDepth('borders','width',Number(event.target.value))} /></label>{Object.entries(document.tokens.elevation).map(([key,value]) => <label key={key}>{key} depth<input type="number" min={0} max={24} value={value} onChange={(event) => updateDepth('elevation',key,Number(event.target.value))} /></label>)}</div></details></div>}
          <details className={`${styles.studioSection} ${styles.componentSection}`} open={editorTab === 'components'}><summary onClick={(event) => { event.preventDefault(); openSection('components'); }}>Components</summary>{editorTab === 'components' && <><div className={styles.twoFields}><label className={styles.field}>Find a component<input aria-label="Search components" placeholder="Buttons, cards…" value={componentSearch} onChange={(event) => setComponentSearch(event.target.value)} /></label><label className={styles.field}>Component<select value={selectedComponent} onChange={(event) => setSelectedComponent(event.target.value)}>{components.filter((id) => THEME_COMPONENTS[id].label.toLowerCase().includes(componentSearch.toLowerCase())).map((id) => <option key={id} value={id}>{THEME_COMPONENTS[id].label}</option>)}</select></label><label className={styles.field}>Apply to<select value={componentScope} onChange={(event) => setComponentScope(event.target.value as typeof componentScope)}><option value="global">All screens · shared</option><option value="page">This screen · {screensByPage[screen]}</option></select></label></div><p className={styles.scopeHint}><Blocks size={14} />{componentScope === 'global' ? `${THEME_COMPONENTS[selectedComponent as keyof typeof THEME_COMPONENTS].label} is shared across every screen.` : `Only ${screensByPage[screen]} gets this override.`}</p><div className={styles.componentCard}>{componentFields[selectedComponent].map(([field,kind]) => { const value = (componentScope === 'page' ? resolveThemeComponents(document as unknown as ThemeDocument,screen)[selectedComponent]?.[field] : undefined) ?? document.tokens.components[selectedComponent]?.[field] ?? inheritedComponentValue(document,mode,selectedComponent,field); return <label key={field}>{field === 'background' ? 'Background' : labels[field] ?? field}{kind === 'color' ? componentColorControl(field,String(value)) : <input aria-label={`${selectedComponent} ${field}`} type="number" min={field === 'height' ? 40 : 0} max={field === 'height' ? 88 : field === 'radius' ? 999 : field === 'borderWidth' ? 4 : 64} value={Number(value)} onChange={(event) => updateComponent(field,Number(event.target.value))} />}</label>; })}</div><button className={styles.textButton} onClick={resetComponent}>Reset {componentScope === 'page' ? 'to shared style' : 'component'}</button><details className={styles.subsection}><summary>Shadows</summary>{(['light','dark'] as const).map((item) => <fieldset className={styles.componentCard} key={item}><legend>{item}</legend><label>Color<input type="color" value={document.tokens.shadows[item].color} onChange={(event) => updateShadow(item,'color',event.currentTarget.value)} /></label>{(['card','floating','modal'] as const).map((kind) => <div className={styles.shadowPair} key={kind}><label>{kind} opacity<input type="number" min={0} max={0.35} step={0.01} value={document.tokens.shadows[item][kind]} onChange={(event) => updateShadow(item,kind,Number(event.target.value))} /></label><label>Blur<input type="number" min={0} max={48} value={document.tokens.shadows[item][`${kind}Radius` as 'cardRadius']} onChange={(event) => updateShadow(item,`${kind}Radius` as 'cardRadius',Number(event.target.value))} /></label></div>)}</fieldset>)}</details></>}</details>
          <details className={`${styles.studioSection} ${styles.pageSection}`} open={editorTab === 'pages'}><summary onClick={(event) => { event.preventDefault(); openSection('pages'); }}>Pages</summary>{editorTab === 'pages' && <><div className={styles.modeTabs}><button className={pageScope === 'page' ? styles.modeActive : ''} onClick={() => setPageScope('page')}><PanelsTopLeft size={14} />This page</button><button className={pageScope === 'shared' ? styles.modeActive : ''} onClick={() => setPageScope('shared')}><UsersRound size={14} />Shared group</button></div>{pageScope === 'shared' ? <><label className={styles.field}>Page group<select value={sharedGroup} onChange={(event) => setSharedGroup(event.target.value as ThemePageGroupId)}>{THEME_PAGE_GROUPS.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label><label className={styles.followRegistry}><input type="checkbox" checked={document.tokens.pageGroups?.[sharedGroup]?.followRegistry ?? false} onChange={(event) => { const followRegistry = event.target.checked; setDocument((current) => current && ({ ...current, tokens: { ...current.tokens, pageGroups: { ...current.tokens.pageGroups, [sharedGroup]: { pages: [], colors: current.tokens.pageGroups?.[sharedGroup]?.colors ?? {}, followRegistry } } } })); }} />All group pages, including future screens</label><div className={styles.checkGrid}>{sideScreens.map((item) => <label key={item.id}><input type="checkbox" checked={getThemePageGroup(document.tokens.pageGroups ?? {},item.id)?.id === sharedGroup} onChange={(event) => setPageGroupMembership(sharedGroup,item.id,event.target.checked)} />{item.label}</label>)}</div>{colorControls(colors,{ ...document.tokens.colors[mode], ...document.tokens.pageGroups?.[sharedGroup]?.colors },'shared',updateSharedColor)}</> : <><strong>{screensByPage[screen]}</strong><p className={styles.hint}>{assignedGroup ? `Inherits ${THEME_PAGE_GROUPS.find((group) => group.id === assignedGroup)?.label}` : 'Inherits brand styles'}{document.tokens.pages[screen] ? ' ? customized' : ''}</p><div className={styles.inlineActions}><button className={styles.secondary} onClick={useSharedTheme}><UsersRound size={14} />Use shared style</button><button className={styles.secondary} onClick={customizePage}><PanelsTopLeft size={14} />Customize this page</button><button className={styles.textButton} onClick={resetPage}><RotateCcw size={14} />Reset to shared style</button></div>{document.tokens.pages[screen] && colorControls(colors,selectedColors,'page',updatePageColor)}</>}</>}</details>
          {editorTab === 'content' && <div className={`${styles.studioSection} ${styles.contentEditor}`}><h3><FileText size={16} aria-hidden="true" /> App copy · {screensByPage[screen]}</h3><p className={styles.hint}>Text edits are saved with this draft and only appear in this preview until publication.</p>{contentFields.length ? contentFields.map((field) => <label className={styles.field} key={field.id}>{field.label}<input aria-label={field.label} maxLength={field.maxLength} value={document.content?.[field.id] ?? field.fallback} onChange={(event) => updateContent(field.id,event.target.value)} /></label>) : <p className={styles.empty}>This screen has no registered editable copy yet. Supported fields are listed with the screen registry.</p>}</div>}
          <details className={styles.studioSection} open={editorTab === 'json'}><summary onClick={(event) => { event.preventDefault(); openSection('json'); }}>Advanced · JSON & history</summary>{editorTab === 'json' && <><div className={styles.inlineActions}><button className={styles.secondary} onClick={() => downloadJson({ ...document,name },name)}><Download size={14} /> Export draft</button><button className={styles.secondary} onClick={() => importRef.current?.click()}><Upload size={14} /> Import JSON</button></div><label className={styles.field}>Change note<input value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} /></label><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importJson(event.target.files?.[0])} /><details className={styles.subsection}><summary>Edit JSON</summary><textarea className={styles.jsonText} aria-label="Theme JSON editor" spellCheck={false} value={jsonText} onChange={(event) => setJsonText(event.target.value)} /><div className={styles.inlineActions}><button className={styles.secondary} onClick={() => applyJson(true)}>Validate & format</button><button className={styles.secondary} onClick={() => applyJson()}>Apply as draft</button></div></details>{jsonError && <p className={styles.error} role="alert">{jsonError}</p>}</>}</details>
          {validationError && <p className={styles.contrastWarning} role="alert"><AlertTriangle size={14} />{validationError}. Fix this value before saving.</p>}
          {contrastWarning && <p className={styles.contrastWarning} role="status"><AlertTriangle size={14} />Contrast warning: {contrastWarning} The draft preview and save still work; improve contrast before publishing.</p>}
          <div className={styles.actions}><button className={styles.secondary} disabled={busy || !!validationError} onClick={save}><Save size={15} /> Save draft</button><button className={styles.secondary} onClick={() => { setPreviewActive(false); setPreviewVersion(null); setMobilePanel('preview'); }}><Eye size={15} /> Preview draft</button><button className={styles.primary} disabled={busy || !draft || dirty || !!validationError || !!contrastWarning} title={contrastWarning ? 'Improve text contrast before publishing.' : undefined} onClick={publish}><Send size={15} /> Publish</button></div>
        </>}
      </section>
      <section ref={previewSectionRef} className={`${styles.previewSection} ${mobilePanel === 'editor' ? styles.mobileHidden : ''}`}><div className={styles.previewToolbar}><strong><Eye size={16} /> App preview</strong><span className={styles.previewStatus}>{previewVersion ? 'Saved version' : previewActive || !document ? 'Active theme' : draft ? 'Draft preview' : 'Unsaved draft'} · {previewLabel}</span><button type="button" className={styles.secondary} onClick={() => void toggleWorkspaceFullscreen()} aria-label={workspaceFullscreen ? 'Exit editor and preview full screen' : 'Open editor and preview full screen'} title={workspaceFullscreen ? 'Exit full screen (Esc)' : 'Show editor and preview together'}>{workspaceFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}<span>{workspaceFullscreen ? 'Exit workspace' : 'Editor + preview'}</span></button></div><div className={styles.previewBody}><div className={styles.previewHost} ref={previewHostRef}><div className={styles.phone} style={deviceStyle}><iframe key={frameKey} ref={documentRef} title={`Brandly mobile ${screensByPage[screen]} preview · ${previewLabel}`} src={mobilePreviewUrl} onLoad={() => { setPreviewReady(false); setPreviewError(false); syncPreview(); }} onError={() => setPreviewError(true)} className={styles.mobileFrame} /></div>{!previewReady && !previewError && <div className={styles.previewState}><LoaderCircle size={18} /> Loading the real app preview…</div>}{previewError && <div className={`${styles.previewState} ${styles.error}`}><AlertTriangle size={18} /> Preview did not load. Check the mobile preview build and try again.<button className={styles.secondary} onClick={() => { setPreviewError(false); setPreviewReady(false); setFrameKey((key) => key + 1); }}>Retry</button></div>}</div><div className={styles.previewActions}> <label className={styles.toolbarField}><span className={styles.toolbarLabel}><UsersRound size={13} />Role</span><select value={previewSide} onChange={(event) => { const next = event.target.value as typeof previewSide; setPreviewSide(next); if (!THEME_SCREENS.some((item) => item.id === screen && item.audiences.some((audience) => audience === next))) setScreen(THEME_SCREENS.find((item) => item.audiences.some((audience) => audience === next))!.id); }}>{[['brand', 'Brand'], ['creator', 'Creator']].map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className={styles.toolbarField}><span className={styles.toolbarLabel}><PanelsTopLeft size={13} />Screen</span><select value={screen} onChange={(event) => setScreen(event.target.value as typeof screen)}>{sideScreens.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}</select></label><label className={styles.toolbarField}><span className={styles.toolbarLabel}><Smartphone size={13} />Device</span><select value={viewport} onChange={(event) => setViewport(event.target.value as keyof typeof viewports)}><option value="compact">Compact · 320 × 640</option><option value="phone">Phone · 390 × 844</option><option value="large">Large · 430 × 932</option></select></label><button type="button" className={styles.secondary} onClick={() => void togglePreviewFullscreen()} aria-label={previewFullscreen ? 'Exit mobile screen full screen' : 'Open mobile screen full screen'} title={previewFullscreen ? 'Exit full screen (Esc)' : 'Show only the phone screen'}>{previewFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}<span>{previewFullscreen ? 'Exit phone' : 'Phone full screen'}</span></button><button className={`${styles.secondary} ${inspectMode ? styles.inspectorActive : ''}`} aria-pressed={inspectMode} disabled={!previewReady || !document || previewActive || !!previewVersion} onClick={() => { setInspectMode((value) => !value); setPickedField(''); }} title="Click an element in the real app preview to find its theme control"><MousePointer2 size={15} /> {inspectMode ? 'Click in app…' : 'Pick style'}</button>{document && (previewActive || previewVersion) && <button className={`${styles.secondary} ${!previewActive && !previewVersion ? styles.modeActive : ''}`} onClick={() => { setInspectMode(false); setPreviewVersion(null); setPreviewActive(false); }}>Draft preview</button>}<button className={`${styles.secondary} ${previewActive || !document ? styles.modeActive : ''}`} disabled={!active} onClick={() => { setInspectMode(false); setPreviewVersion(null); setPreviewActive(true); }}>Active theme</button><button className={styles.secondary} onClick={() => { setLibraryTab('history'); setShowHistory(true); }}><History size={15} /> Library</button></div></div><p className={styles.hint}>Draft edits update this real app preview immediately and stay private. Preview actions use local sample data.</p></section>
    </div>
    <section className={`${styles.history} ${showHistory ? '' : styles.historyHidden}`}><div className={styles.libraryHeader}><h2><History size={17} /> Theme library</h2><button className={styles.iconButton} aria-label="Close theme library" onClick={() => setShowHistory(false)}><X size={17} /></button></div><div className={styles.libraryTabs} role="tablist" aria-label="Theme library sections"><button type="button" role="tab" className={libraryTab === 'history' ? styles.libraryTabActive : ''} aria-selected={libraryTab === 'history'} onClick={() => setLibraryTab('history')}><History size={15} />History</button><button type="button" role="tab" className={libraryTab === 'prebuilt' ? styles.libraryTabActive : ''} aria-selected={libraryTab === 'prebuilt'} onClick={() => setLibraryTab('prebuilt')}><Palette size={15} />Prebuilt</button></div>{libraryTab === 'history' && <div className={styles.historyContent}>{drafts.map((item) => <article className={styles.historyCard} key={item.id}><div className={styles.historyMeta}><strong>{item.name} · draft</strong><span>Revision {item.revision}{item.publishedRevision === item.revision ? ' · already published' : ''} · Updated {new Date(item.updatedAt).toLocaleString()} · {item.updatedBy} · {item.changeNote || 'No change note'}</span></div><div className={styles.historyCardActions}><button className={styles.secondary} disabled={busy} onClick={() => continueDraft(item)}><Save size={14} /> Continue draft</button><button className={styles.secondary} disabled={busy || item.publishedRevision === item.revision} onClick={() => void run(() => publishThemeDraft(item, item.changeNote), 'Theme published.')}><Send size={14} /> Publish saved revision</button></div></article>)}
      {draftCursor && <button className={styles.loadMore} disabled={busy} onClick={() => void run(async () => { const page = await getThemeDrafts(draftCursor); setDrafts((old) => [...old, ...page.items]); setDraftCursor(page.nextCursor); }, 'More drafts loaded.')}>Load more drafts</button>}
      {versions.map((item) => <article className={`${styles.historyCard} ${selectedVersion?.id === item.id ? styles.historyCardSelected : ''}`} key={item.id}><div className={styles.historyMeta}><strong>{item.name} · v{item.revision} {item.active && <em>ACTIVE</em>}</strong><span>{new Date(item.createdAt).toLocaleString()} · {item.authorId} · {item.changeNote || 'No change note'}{item.sourceId ? ` · source ${item.sourceId}` : ''}</span></div><div className={styles.historyCardActions}><button className={styles.secondary} disabled={busy} onClick={() => inspectVersion(item)}><Eye size={14} /> Preview version</button><button className={styles.iconButton} aria-label={`Duplicate ${item.name} version ${item.revision} as a draft`} title="Duplicate as a draft" disabled={busy} onClick={() => duplicateVersion(item)}><Copy size={15} /></button><button className={styles.secondary} onClick={() => void run(async () => downloadJson((await getThemeVersion(item.id)).document, `${item.name}-v${item.revision}`), 'Version JSON exported.')}>Export JSON</button><button className={styles.secondary} disabled={busy || item.active} onClick={() => restore(item)}><RotateCcw size={14} /> Restore / Activate</button></div></article>)}
      {selectedVersion && <div className={styles.diff}><strong>Version detail · {selectedVersion.name} v{selectedVersion.revision}</strong><span>Source version: {selectedVersion.sourceId ?? 'Bundled default'}. Values are immutable; restore activates this complete snapshot.</span><div>{['colors', 'typography', 'spacing', 'radius', 'components', 'pages'].map((key) => { const changed = JSON.stringify(selectedVersion.document.tokens[key as keyof AdminTheme['tokens']]) !== JSON.stringify(active?.theme.tokens[key as keyof AdminTheme['tokens']]); return <span key={key} className={changed ? styles.changed : ''}>{key}: {changed ? 'differs from active' : 'same as active'}</span>; })}</div></div>}
      {cursor && <button className={styles.loadMore} disabled={busy} onClick={() => void run(async () => { const page = await getThemeVersions(cursor); setVersions((old) => [...old, ...page.items]); setCursor(page.nextCursor); }, 'More versions loaded.')}>Load more history</button>}
      {activationCursor && <button className={styles.loadMore} disabled={busy} onClick={() => void run(async () => { const page = await getThemeActivations(activationCursor); setActivations((old) => [...old, ...page.items]); setActivationCursor(page.nextCursor); }, 'More audit events loaded.')}>Load more publish and restore events</button>}
      {!versions.length && !drafts.length && <p className={styles.empty}>No saved drafts or published versions yet.</p>}
      {activations.length > 0 && <div className={styles.audit}><h3>Publish and restore audit</h3>{activations.map((item) => <div key={item.id}><strong>{item.action === 'RESTORE' ? 'Restored' : 'Published'} {item.version.name} v{item.version.revision}</strong><span>{item.actorId} · {new Date(item.createdAt).toLocaleString()}</span></div>)} </div>}
    </div>}{libraryTab === 'prebuilt' && <div className={styles.presetList}><div className={styles.presetIntro}><strong>{PREBUILT_THEMES.length} ready-to-use themes</strong><span>Each includes matching Light and Dark styles.</span></div>{PREBUILT_THEMES.map((preset) => <article className={styles.presetCard} key={preset.id}><div><strong>{preset.name}</strong><span>{preset.description}</span></div><div className={styles.presetPalettes}>{(['light', 'dark'] as const).map((appearance) => <div className={styles.presetPalette} key={appearance} aria-label={`${preset.name} ${appearance} colors`}><small>{appearance === 'light' ? 'Light' : 'Dark'}</small><div className={styles.presetSwatches}>{[preset[appearance].primary,preset[appearance].secondary,preset[appearance].accent,preset[appearance].background,preset[appearance].surface].map((color) => <span key={color} style={{ backgroundColor: color }} />)}</div></div>)}</div><button className={styles.secondary} disabled={!active || busy} onClick={() => applyPreset(preset)}><Check size={14} /> Use as draft</button></article>)}</div>}</section>
    {busy && <div className={styles.busy}><LoaderCircle size={15} /> Saving…</div>}
  </main>;
}
