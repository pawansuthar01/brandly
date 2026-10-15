'use client';

import {
  Activity, AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpRight, BarChart3,
  Archive, Bell, CalendarDays, Check, CheckCircle2, ChevronDown, Eye, EyeOff, ExternalLink, FileCheck2, Filter,
  FolderKanban, Image as ImageIcon, MapPin, Palette, Paperclip,
  Database, KeyRound, Mail, MessageCircle, Search, Send, ShieldAlert,
  SlidersHorizontal, Trash2, UserRound, Users, Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteAdminAppSettings, getAdminAppSettings, getAdminCampaignApplications, getAdminNotificationLogs, getAdminNotifications, getAdminProposal, getAdminProposals, getAdminSnapshot,
  resolveAdminMediaUrl, saveAdminAppSettings, sendAdminChatBroadcast, sendAdminNotifications, suspendUser, updateCampaignStatus,
} from '@/services/adminApi.service';
import { canAccessSection, type AdminRole } from '@/lib/admin-auth';
import { useAdminSession } from '@/hooks/useAdminSession';
import { formatCampaignDeadline } from '@/lib/date-time';
import { adminSocialPlatforms } from '@/types/admin';
import type {
  AdminAppSettings,
  AdminMediaFile,
  AdminProductSettings,
  AdminRuntimeSettings,
  AdminSmtpSettings,
  AdminWhatsAppSettings,
  AdminNotificationRecord,
  AdminSnapshot,
  AdminUser,
  Campaign,
  CampaignApplicationsPage,
  Proposal,
  ProposalDetail,
  ProposalPage,
  VersionConfig,
} from '@/types/admin';
import styles from './admin-pages.module.css';

type Toast = string | null;
type ActivityEntry = { id: string; actor: string; action: string; target: string; time: string; tone: 'blue' | 'orange' | 'red' | 'green' };
type Column<T> = { key: string; label: string; render: (item: T) => React.ReactNode; locked?: boolean };
type ExtraFilter = { key: string; label: string; value: string; options: string[]; onChange: (value: string) => void; searchable?: boolean };

const meta: Record<string, { title: string; eyebrow: string; description: string; icon: LucideIcon }> = {
  users: { title: 'Users & profiles', eyebrow: 'Marketplace', description: 'Keep profiles discoverable, trustworthy, and easy to review.', icon: Users },
  campaigns: { title: 'Campaigns', eyebrow: 'Marketplace', description: 'Review how brands are shaping briefs and where creators are finding momentum.', icon: FolderKanban },
  proposals: { title: 'Proposals', eyebrow: 'Marketplace', description: 'Inspect collaboration intent, scope, pricing, and attached media in one view.', icon: FileCheck2 },
  'app-settings': { title: 'App settings', eyebrow: 'System', description: 'Control version guidance, release notes, and essential product content.', icon: SlidersHorizontal },
  notifications: { title: 'Send notifications', eyebrow: 'Trust & content', description: 'Send a clear in-app, push, or email update to selected marketplace users.', icon: Bell },
  'notification-logs': { title: 'Notification logs', eyebrow: 'Trust & content', description: 'Review the latest app, system, and admin notifications delivered across the marketplace.', icon: Activity },
};

function PageHeader({ title, eyebrow, description, action }: { title: string; eyebrow: string; description: string; action?: React.ReactNode }) {
  return <div className={styles.pageHeader}><div><p className={styles.eyebrow}>{eyebrow}</p><h1 className={styles.title}>{title}</h1><p className={styles.description}>{description}</p></div>{action && <div className={styles.headerActions}>{action}</div>}</div>;
}

function Button({ children, variant = 'secondary', onClick, disabled, type = 'button', href }: { children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit'; href?: string }) {
  const className = `${styles.button} ${styles[`button${variant[0].toUpperCase()}${variant.slice(1)}`]}`;
  if (href) return <Link className={className} href={href}>{children}</Link>;
  return <button type={type} className={className} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Status({ value }: { value: string }) {
  const lower = value.toLowerCase();
  const tone = lower.includes('active') || lower.includes('published') || lower.includes('accepted') || lower.includes('resolved') || lower.includes('completed') || lower.includes('open') || lower.includes('delivered') ? 'Green' : lower.includes('pending') || lower.includes('review') || lower.includes('new') || lower.includes('optional') || lower.includes('draft') || lower.includes('medium') ? 'Orange' : lower.includes('suspend') || lower.includes('hidden') || lower.includes('declined') || lower.includes('mandatory') || lower.includes('high') || lower.includes('failed') ? 'Red' : lower.includes('private') || lower.includes('archived') || lower.includes('dismissed') || lower.includes('low') ? 'Slate' : 'Blue';
  return <span className={`${styles.status} ${styles[`status${tone}`]}`}>{value}</span>;
}

function notificationDeliveryStatus(item: AdminNotificationRecord) {
  if (item.deliveredAt) return 'Delivered';
  const status = item.deliveryStatus ?? 'PENDING';
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function Avatar({ label, imageUrl }: { label: string; imageUrl?: string | null }) { return <span className={styles.avatar}>{label.slice(0, 2).toUpperCase()}{imageUrl && <img src={resolveAdminMediaUrl(imageUrl)} alt="" onError={(event) => event.currentTarget.remove()} />}</span>; }

function Panel({ title, hint, children, action }: { title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className={styles.panel}><div className={styles.panelHeader}><div><h2 className={styles.panelTitle}>{title}</h2>{hint && <p className={styles.panelHint}>{hint}</p>}</div>{action}</div>{children}</section>;
}

function SearchBox({ value, onChange, placeholder = 'Search' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className={styles.search}><Search size={15} aria-hidden="true" /><span className="srOnly">{placeholder}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function usePagination<T>(items: T[], initialPageSize = 5, resetKey = '') {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  useEffect(() => { setPage(1); }, [items.length, resetKey]);
  return { page, pageSize, pageCount, pageItems: items.slice((page - 1) * pageSize, page * pageSize), setPage, setPageSize };
}

function Pagination({ page, pageCount, pageSize, total, setPage, setPageSize }: ReturnType<typeof usePagination<unknown>> & { total: number }) {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return <div className={styles.pagination}><span className={styles.paginationInfo}>Showing {start}-{end} of {total}</span><div className={styles.paginationControls}><label className={styles.pageSizeLabel}>Rows<select className={styles.pageSize} value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></label><button className={styles.pageButton} onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} aria-label="Previous page">‹</button><span className={styles.pageNumber}>{page} / {pageCount}</span><button className={styles.pageButton} onClick={() => setPage(Math.min(pageCount, page + 1))} disabled={page === pageCount} aria-label="Next page">›</button></div></div>;
}

function ToastMessage({ message }: { message: Toast }) { return message ? <div className={styles.toast} role="status"><CheckCircle2 size={16} />{message}</div> : null; }

function AdminDrawer({ open, title, description, onClose, children }: { open: boolean; title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return <div className={styles.drawerBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="drawer-title"><div className={styles.drawerHeader}><div><p className={styles.eyebrow}>Admin action</p><h2 id="drawer-title">{title}</h2><p>{description}</p></div><button className={styles.iconButton} onClick={onClose} aria-label="Close panel">×</button></div><div className={styles.drawerBody}>{children}</div></aside></div>;
}

function SearchableFilter({ item }: { item: ExtraFilter }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const matchingOptions = item.options.filter((option) => option === 'All' || option.toLowerCase().includes(normalizedQuery)).slice(0, 80);
  const choose = (option: string) => {
    item.onChange(option);
    setQuery(option === 'All' ? '' : option);
  };
  return <div className={styles.popoverField}>
    <span>{item.label}</span>
    <label className={`${styles.search} ${styles.filterSearch}`}>
      <Search size={13} aria-hidden="true" />
      <span className="srOnly">Search {item.label}</span>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${item.label.toLowerCase()}`} />
    </label>
    <div className={styles.filterOptions} role="listbox" aria-label={`${item.label} results`}>
      {matchingOptions.map((option) => <button type="button" className={`${styles.filterOption} ${item.value === option ? styles.filterOptionSelected : ''}`} key={option} onClick={() => choose(option)} aria-selected={item.value === option} role="option"><span>{option === 'All' ? `All ${item.label.toLowerCase()}` : option}</span>{item.value === option && <Check size={13} aria-hidden="true" />}</button>)}
    </div>
    {!matchingOptions.some((option) => option !== 'All') && <span className={styles.popoverHint}>No matching locations.</span>}
  </div>;
}

function DataToolbar({ query, setQuery, filter, setFilter, options, columns, visibleColumns, setVisibleColumns, extraFilters = [], onClear, filterLabel = 'Quick filter' }: { query: string; setQuery: (value: string) => void; filter: string; setFilter: (value: string) => void; options: string[]; columns: { key: string; label: string; locked?: boolean }[]; visibleColumns: string[]; setVisibleColumns: (columns: string[]) => void; extraFilters?: ExtraFilter[]; onClear?: () => void; filterLabel?: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const toggleColumn = (key: string) => {
    const locked = columns.find((column) => column.key === key)?.locked;
    if (locked) return;
    setVisibleColumns(visibleColumns.includes(key) ? visibleColumns.filter((item) => item !== key) : [...visibleColumns, key]);
  };
  const clear = () => {
    setQuery('');
    setFilter('All');
    extraFilters.forEach((item) => item.onChange('All'));
    onClear?.();
  };
  return <div className={styles.toolbar}><div className={styles.toolbarLeft}><SearchBox value={query} onChange={setQuery} placeholder="Search by name or keyword" /><select className={styles.select} value={filter} onChange={(event) => setFilter(event.target.value)} aria-label={filterLabel}>{options.map((option) => <option key={option}>{option}</option>)}</select></div><div className={styles.toolbarRight}><div className={styles.toolbarMenu}><Button variant="secondary" onClick={() => { setMoreOpen((value) => !value); setColumnsOpen(false); }}><Filter size={14} /> More filters</Button>{moreOpen && <div className={styles.toolbarPopover} role="dialog" aria-label="More filters"><strong>Advanced filters</strong>{extraFilters.length === 0 ? <span className={styles.popoverHint}>No extra filters for this view.</span> : extraFilters.map((item) => item.searchable ? <SearchableFilter item={item} key={item.key} /> : <label className={styles.popoverField} key={item.key}>{item.label}<select className={styles.select} value={item.value} onChange={(event) => item.onChange(event.target.value)}>{item.options.map((option) => <option key={option}>{option}</option>)}</select></label>)}<Button variant="ghost" onClick={() => { clear(); setMoreOpen(false); }}>Clear filters</Button></div>}</div>{columns.length > 0 && <div className={styles.toolbarMenu}><Button variant="ghost" onClick={() => { setColumnsOpen((value) => !value); setMoreOpen(false); }}><SlidersHorizontal size={14} /> Columns</Button>{columnsOpen && <div className={styles.toolbarPopover} role="dialog" aria-label="Column visibility"><strong>Visible columns</strong>{columns.map((column) => <label className={styles.checkRow} key={column.key}><input type="checkbox" checked={visibleColumns.includes(column.key)} disabled={column.locked} onChange={() => toggleColumn(column.key)} />{column.label}</label>)}<span className={styles.popoverHint}>Applies to this table immediately.</span></div>}</div>}</div></div>;
}

function DataTable<T extends { id: string }>({ columns, visibleColumns, items, empty }: { columns: Column<T>[]; visibleColumns: string[]; items: T[]; empty: React.ReactNode }) {
  const visible = columns.filter((column) => visibleColumns.includes(column.key));
  if (items.length === 0) return <>{empty}</>;
  return <div className={styles.tableWrap}><table className={styles.table}><thead><tr>{visible.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{items.map((item) => <tr key={item.id}>{visible.map((column) => <td key={column.key}>{column.render(item)}</td>)}</tr>)}</tbody></table></div>;
}

function useColumns(key: string, columns: { key: string; locked?: boolean }[]) {
  const storageKey = `brandly-admin-columns-${key}-v1`;
  const defaults = columns.filter((column) => column.locked || columns.indexOf(column) < 6).map((column) => column.key);
  const [visible, setVisible] = useState(defaults);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) setVisible(JSON.parse(stored) as string[]);
    } catch { /* keep defaults */ }
  }, [storageKey]);
  const save = (next: string[]) => {
    const locked = columns.filter((column) => column.locked).map((column) => column.key);
    const merged = Array.from(new Set([...locked, ...next]));
    setVisible(merged);
    try { window.localStorage.setItem(storageKey, JSON.stringify(merged)); } catch { /* storage can be unavailable */ }
  };
  return [visible, save] as const;
}

function Field({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) { return <div className={`${styles.field} ${full ? styles.fieldFull : ''}`}><label>{label}</label>{children}</div>; }
function SettingsToggle({ label, description, enabled, onChange }: { label: string; description: string; enabled: boolean; onChange: (value: boolean) => void }) { return <label className={styles.settingRow}><div><strong>{label}</strong><span>{description}</span></div><input type="checkbox" checked={enabled} onChange={(event) => onChange(event.target.checked)} /></label>; }
function DetailItem({ label, value }: { label: string; value: string }) { return <div className={styles.detailItem}><div className={styles.detailLabel}>{label}</div><div className={styles.detailValue}>{value}</div></div>; }

function proposalValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => proposalValue(item)).join(', ');
  return JSON.stringify(value);
}

function proposalLabel(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) { return <div className={styles.empty}><div className={styles.emptyIcon}><Icon size={19} /></div><strong>{title}</strong><span>{description}</span></div>; }

function MediaFiles({ files = [] }: { files?: AdminMediaFile[] }) {
  if (files.length === 0) return <EmptyState icon={Paperclip} title="No media attached" description="No saved images, videos, or documents are available for this record." />;
  return <div className={styles.mediaList}>{files.map((file) => <a className={styles.mediaItem} href={resolveAdminMediaUrl(file.url)} target="_blank" rel="noreferrer" key={file.id}><span className={styles.statIcon + ' ' + styles.statBlue}>{file.type === 'Video' ? <Video size={15} /> : file.type === 'Image' ? <ImageIcon size={15} /> : <Paperclip size={15} />}</span><span className={styles.mediaInfo}><strong>{file.name}</strong><small>{file.type} · {file.size}</small></span><ExternalLink size={14} /></a>)}</div>;
}

function UserProfilePanels({ user }: { user: AdminUser }) {
  const socialAccounts = user.socialAccounts ?? [];
  const notificationSettings = user.notificationSettings ?? [];
  return <>
    <div className={styles.twoCol}>
      <Panel title="Contact & account details" hint="Saved account information">
        <div className={styles.panelBody}><div className={styles.detailGrid}>
          <DetailItem label="Email" value={user.email} />
          <DetailItem label="Phone" value={user.phone ?? 'Not provided'} />
          <DetailItem label="Account type" value={user.role} />
          <DetailItem label="Account status" value={user.status} />
          <DetailItem label="Profile visibility" value={user.profileVisible ? 'Public' : 'Private'} />
          <DetailItem label="Last active" value={user.lastActive ?? 'Not available'} />
        </div></div>
      </Panel>
      <Panel title="Location & marketplace profile" hint="Location and matching context">
        <div className={styles.panelBody}><div className={styles.detailGrid}>
          <DetailItem label="Saved location" value={user.location} />
          <DetailItem label="City" value={user.city ?? user.location.split(',')[0] ?? 'Not provided'} />
          <DetailItem label="State" value={user.state ?? user.location.split(',')[1]?.trim() ?? 'Not provided'} />
          <DetailItem label="Categories" value={user.categories.join(' · ')} />
          <DetailItem label="Audience" value={user.followers === '—' ? 'Brand account' : `${user.followers} followers`} />
          <DetailItem label="Joined" value={user.joined} />
        </div></div>
      </Panel>
    </div>
    <div className={styles.twoCol}>
      <Panel title="Profile description" hint="Content saved by the user">
        <div className={styles.panelBody}><p className={styles.detailCopy}>{user.bio ?? 'No profile description has been saved.'}</p><div className={styles.detailGrid + ' ' + styles.detailGridCompact}>
          <DetailItem label="Languages" value={user.languages?.join(' · ') ?? 'Not provided'} />
          <DetailItem label="Content types" value={user.contentTypes?.join(' · ') ?? 'Not provided'} />
          <DetailItem label="Price range" value={user.priceRange ?? 'Not provided'} />
          <DetailItem label="Response time" value={user.responseTime ?? 'Not provided'} />
          <DetailItem label="Availability" value={user.availability ?? 'Not provided'} />
          <DetailItem label="Website" value={user.website ?? 'Not provided'} />
        </div></div>
      </Panel>
      <Panel title="Connected social accounts" hint={`${socialAccounts.length} accounts saved · ownership status shown`}>
        <div className={styles.panelBody}>{socialAccounts.length ? <div className={styles.socialList}>{socialAccounts.map((account) => <a className={styles.socialItem} href={account.url} target="_blank" rel="noreferrer" key={`${account.platform}-${account.handle}`}><span className={styles.statIcon + ' ' + styles.statBlue}><ExternalLink size={14} /></span><span><strong>{account.platform}</strong><small>{account.handle}</small></span><Status value={account.verified ? 'Verified' : 'Unverified'} /></a>)}</div> : <EmptyState icon={ExternalLink} title="No social accounts" description="The user has not connected a social account." />}</div>
      </Panel>
    </div>
    <Panel title="Notification preferences" hint="Read-only settings saved by the user"><div className={styles.preferenceList}>{notificationSettings.length ? notificationSettings.map((setting) => <div className={styles.preferenceItem} key={setting.key}><span><strong>{setting.label}</strong><small>{setting.channel}</small></span><Status value={setting.enabled ? 'Enabled' : 'Disabled'} /></div>) : <EmptyState icon={Bell} title="No notification preferences" description="No preference settings have been saved." />}</div></Panel>
  </>;
}

export function AdminDashboardPage() {
  const { snapshot, error, reload } = useAdminSnapshot();
  const { role, ready } = useAdminSession();
  const adminRole: AdminRole = role ?? 'Moderator';
  const isOwner = adminRole === 'Owner';
  if (!ready) return <LoadingPage />;
  if (error) return <LoadFailure message={error} retry={() => void reload()} />;
  if (!snapshot) return <LoadingPage />;
  const activeCreators = snapshot.users.filter((item) => item.role === 'Creator' && item.status === 'Active').length;
  const activeBrands = snapshot.users.filter((item) => item.role === 'Brand' && item.status === 'Active').length;
  const newProposals = snapshot.proposals.filter((item) => item.status === 'New');
  const publishedCampaigns = snapshot.campaigns.filter((item) => item.status === 'Published' || item.status === 'Active');
  const stats = [
    { label: 'Marketplace accounts', value: String(snapshot.users.length), delta: `${activeCreators} creators · ${activeBrands} brands`, icon: Users, tone: 'blue' },
    { label: 'Active campaigns', value: String(publishedCampaigns.length), delta: `${snapshot.campaigns.filter((item) => item.status === 'Private').length} private drafts`, icon: FolderKanban, tone: 'orange' },
    { label: 'Proposals', value: String(snapshot.proposals.length), delta: `${newProposals.length} pending`, icon: BarChart3, tone: 'green' },
    { label: 'Suspended accounts', value: String(snapshot.users.filter((item) => item.status === 'Suspended').length), delta: 'Database account status', icon: ShieldAlert, tone: 'slate' },
  ] as const;
  return <div className={`${styles.page} ${styles.dashboardPage}`}>
    <PageHeader
      eyebrow="Overview"
      title="Admin command center"
      description="Marketplace health from the application database."
      action={<div className={styles.headerActions}><Button variant="primary" href="/admin/users"><Users size={15} /> Browse accounts</Button></div>}
    />
    <div className={styles.dashboardHero}>
      <div className={styles.dashboardHeroMain}>
        <p className={styles.eyebrow}>Needs attention</p>
        <h2>Social account review queue</h2>
        <p>Check submitted profiles and evidence in one place.</p>
      </div>
      <div className={styles.dashboardHeroActions}>
        <Status value="Database connected" />
        <Button variant="primary" href="/admin/social-reviews"><CheckCircle2 size={15} /> Open social reviews</Button>
        {isOwner && <Button variant="secondary" href="/admin/app-settings"><SlidersHorizontal size={15} /> Settings</Button>}
      </div>
    </div>
    <div className={styles.gridStats}>{stats.map((item) => { const Icon = item.icon; return <div className={styles.statCard} key={item.label}><div className={styles.statTop}><span className={styles.statLabel}>{item.label}</span><span className={`${styles.statIcon} ${styles[`stat${item.tone[0].toUpperCase()}${item.tone.slice(1)}`]}`}><Icon size={17} /></span></div><div className={styles.statValue}>{item.value}</div><span className={styles.statDelta}><ArrowUpRight size={13} />{item.delta}</span></div>; })}</div>
    <div className={styles.dashboardThree}>
      <Panel title="Recent applications" hint="Latest saved campaign applications"><div className={styles.compactList}>{snapshot.proposals.slice(0, 5).map((item) => <Link href={`/admin/proposals/${item.id}`} className={styles.compactItem} key={item.id}><span className={`${styles.statIcon} ${styles.statOrange}`}><FileCheck2 size={15} /></span><div><strong>{item.campaign}</strong><span>{item.from} → {item.to}</span></div><Status value={item.status} /></Link>)}</div>{!snapshot.proposals.length && <EmptyState icon={FileCheck2} title="No applications yet" description="New campaign applications will appear here." />}</Panel>
      <Panel title="Campaign activity" hint="Recently updated campaigns"><div className={styles.compactList}>{snapshot.campaigns.slice(0, 5).map((item) => <Link href={`/admin/campaigns/${item.id}`} className={styles.compactItem} key={item.id}><span className={`${styles.statIcon} ${styles.statBlue}`}><FolderKanban size={15} /></span><div><strong>{item.title}</strong><span>{item.brand} · {item.category}</span></div><Status value={item.status} /></Link>)}</div>{!snapshot.campaigns.length && <EmptyState icon={FolderKanban} title="No campaigns yet" description="Saved campaigns will appear here." />}</Panel>
    </div>
  </div>;
}

function ActivityItem({ dot, action, target, time }: { dot: ActivityEntry['tone']; action: string; target: string; time: string }) { return <div className={styles.activityItem}><span className={`${styles.activityDot} ${dot !== 'blue' ? styles[dot] : ''}`} /><div><div className={styles.activityAction}>{action}</div><div className={styles.activityTarget}>{target}</div></div><span className={styles.activityTime}>{time}</span></div>; }
function LoadingPage() { return <div className={styles.page}><div className={styles.gridStats}>{[1, 2, 3, 4].map((item) => <div className={styles.skeleton} key={item} />)}</div><div className={`${styles.skeleton} ${styles.pageSkeleton}`} /></div>; }
function LoadFailure({ message, retry }: { message: string; retry: () => void }) { return <div className={styles.page}><div className={styles.errorInline} role="alert">{message}</div><Button variant="secondary" onClick={retry}><Activity size={14} /> Retry</Button></div>; }

function useAdminSnapshot() {
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setError('');
    try { setSnapshot(await getAdminSnapshot()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Admin data could not be loaded.'); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { snapshot, setSnapshot, error, reload };
}

function UsersView({ data, onToast, canSuspend }: { data: AdminUser[]; onToast: (message: string) => void; canSuspend: boolean }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [items, setItems] = useState(data);
  const [role, setRole] = useState('All');
  const [visibility, setVisibility] = useState('All');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<AdminUser | null>(null);
  const userActions = (user: AdminUser) => <div className={styles.userActions}>
    <Button variant="ghost" href={`/admin/users/${user.id}`}><Eye size={14} /> Profile</Button>
    <Button variant="ghost" href={`/admin/users/${user.id}/settings`}><SlidersHorizontal size={14} /> Settings</Button>
    <Button variant="ghost" href={`/admin/notifications?user=${user.id}`}><Bell size={14} /> Notify</Button>
    {canSuspend && user.status !== 'Deleted' ? <Button variant="ghost" onClick={() => setConfirmUser(user)} disabled={busy === user.id}>{user.status === 'Suspended' ? <><Check size={14} /> Restore</> : <><ShieldAlert size={14} /> Suspend</>}</Button> : user.status === 'Deleted' ? <Status value="Deleted" /> : <Status value="Read only" />}
  </div>;
  const columns: Column<AdminUser>[] = [
    { key: 'profile', label: 'Profile', locked: true, render: (user) => <div className={styles.entity}><Avatar label={user.avatar} imageUrl={user.avatarUrl} /><div><div className={styles.entityName}>{user.name}</div><div className={styles.entityMeta}>{user.email}</div></div></div> },
    { key: 'role', label: 'Role', render: (user) => user.role },
    { key: 'location', label: 'Location', render: (user) => user.location },
    { key: 'status', label: 'Status', render: (user) => <Status value={user.status} /> },
    { key: 'joined', label: 'Joined', render: (user) => formatUserJoined(user.joined) },
    { key: 'actions', label: '', locked: true, render: userActions },
  ];
  const [visibleColumns, setVisibleColumns] = useColumns('users', columns);
  const filtered = useMemo(() => items.filter((item) => `${item.name} ${item.email} ${item.location}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'All' || item.status === filter) && (role === 'All' || item.role === role) && (visibility === 'All' || (visibility === 'Public' ? item.profileVisible : !item.profileVisible))), [filter, items, query, role, visibility]);
  const pagination = usePagination(filtered, 5, `${query}|${filter}|${role}|${visibility}`);
  const toggle = async (reason?: string) => {
    if (!confirmUser) return;
    setBusy(confirmUser.id);
    try {
      await suspendUser(confirmUser.id, confirmUser.status !== 'Suspended', reason);
      setItems((current) => current.map((item) => item.id === confirmUser.id ? { ...item, status: confirmUser.status === 'Suspended' ? 'Active' : 'Suspended' } : item));
      onToast(confirmUser.status === 'Suspended' ? `${confirmUser.name} is active again.` : `${confirmUser.name} has been suspended.`);
    } catch (error) { onToast(error instanceof Error ? error.message : 'Account status could not be updated.'); }
    setBusy(null); setConfirmUser(null);
  };
  return <><Panel title="All accounts" hint={`${filtered.length} of up to 200 latest database records`}><DataToolbar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} options={['All', 'Active', 'Suspended', 'Pending review', 'Deleted']} columns={columns} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} extraFilters={[{ key: 'role', label: 'Role', value: role, options: ['All', 'Creator', 'Brand'], onChange: setRole }, { key: 'visibility', label: 'Visibility', value: visibility, options: ['All', 'Public', 'Private'], onChange: setVisibility }]} />{pagination.pageItems.length === 0 ? <EmptyState icon={Users} title="No accounts found" description="There are no database records for the selected filters." /> : <><div className={styles.usersTable}><DataTable columns={columns} visibleColumns={visibleColumns} items={pagination.pageItems} empty={null} /></div><div className={styles.userCards}>{pagination.pageItems.map((user) => <article className={styles.userCard} key={user.id}><div className={styles.userCardHeader}><div className={styles.userCardIdentity}><Avatar label={user.avatar} imageUrl={user.avatarUrl} /><div><strong>{user.name}</strong><span>{user.email}</span></div></div><Status value={user.status} /></div><div className={styles.userCardFacts}><div><span>Role</span><strong>{user.role}</strong></div><div><span>Location</span><strong><MapPin size={13} />{user.location}</strong></div><div><span>Joined</span><strong><CalendarDays size={13} />{formatUserJoined(user.joined)}</strong></div></div>{userActions(user)}</article>)}</div></>}<Pagination {...pagination} total={filtered.length} /></Panel>{confirmUser && <ConfirmDialog title={confirmUser.status === 'Suspended' ? 'Restore this account?' : 'Suspend this account?'} description={`${confirmUser.name} will ${confirmUser.status === 'Suspended' ? 'be visible and active again' : 'not be able to use marketplace actions'} in this environment.`} confirmLabel={confirmUser.status === 'Suspended' ? 'Restore account' : 'Suspend account'} danger={confirmUser.status !== 'Suspended'} reasonRequired={confirmUser.status !== 'Suspended'} busy={busy === confirmUser.id} onCancel={() => setConfirmUser(null)} onConfirm={toggle} />}</>;
}

function formatUserJoined(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function CampaignsView({ data, users, onToast, reload }: { data: Campaign[]; users: AdminUser[]; onToast: (message: string) => void; reload: () => Promise<void> }) {
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('All'); const [category, setCategory] = useState('All'); const items = data;
  const [pendingCampaignAction, setPendingCampaignAction] = useState<{ campaign: Campaign; status: 'Private' | 'Archived' } | null>(null);
  const [busyCampaign, setBusyCampaign] = useState<string | null>(null);
  const applyCampaignAction = async () => {
    if (!pendingCampaignAction) return;
    setBusyCampaign(pendingCampaignAction.campaign.id);
    try {
      await updateCampaignStatus(pendingCampaignAction.campaign.id, pendingCampaignAction.status);
      onToast(pendingCampaignAction.status === 'Private' ? 'Campaign hidden from the marketplace.' : 'Campaign archived.');
      setPendingCampaignAction(null);
      try { await reload(); }
      catch { onToast('Campaign status was saved, but the list could not refresh. Reload the page to see the latest status.'); }
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Campaign status could not be updated.');
    } finally { setBusyCampaign(null); }
  };
  const columns: Column<Campaign>[] = [
    { key: 'campaign', label: 'Campaign', locked: true, render: (campaign) => <div className={styles.entity}><span className={styles.statIcon + ' ' + styles.statBlue}><FolderKanban size={15} /></span><div><div className={styles.entityName}>{campaign.title}</div><div className={styles.entityMeta}>{[campaign.category, campaign.location].filter(Boolean).join(' · ')}</div></div></div> },
    { key: 'brand', label: 'Brand', render: (campaign) => { const user = users.find((item) => item.id === campaign.brandId); return user ? <Button variant="ghost" href={`/admin/users/${user.id}`}><UserRound size={14} /> {campaign.brand}</Button> : campaign.brand; } },
    { key: 'status', label: 'Status', render: (campaign) => <Status value={campaign.status} /> },
    { key: 'budget', label: 'Budget', render: (campaign) => campaign.budget || 'Not set' },
    { key: 'deadline', label: 'Deadline', render: (campaign) => formatCampaignDeadline(campaign.deadlineAt) },
    { key: 'proposals', label: 'Applications', render: (campaign) => campaign.proposals },
    { key: 'location', label: 'Target location', render: (campaign) => campaign.location || 'Not specified' },
    { key: 'category', label: 'Category', render: (campaign) => campaign.category || 'Not set' },
    { key: 'platforms', label: 'Platforms', render: (campaign) => campaign.platforms.length ? campaign.platforms.join(', ') : 'Not specified' },
    { key: 'media', label: 'Media', render: (campaign) => campaign.media?.length ? `${campaign.media.length} files` : 'None' },
    { key: 'updated', label: 'Updated', render: (campaign) => formatCampaignDeadline(campaign.updated) },
    { key: 'actions', label: 'Actions', locked: true, render: (campaign) => <div className={styles.campaignActions}><Button variant="ghost" href={`/admin/campaigns/${campaign.id}`}><Eye size={14} /> View</Button>{users.some((item) => item.id === campaign.brandId) && <Button variant="ghost" href={`/admin/users/${campaign.brandId}`}><UserRound size={14} /> Brand</Button>}{campaign.status !== 'Archived' && <Button variant="ghost" onClick={() => setPendingCampaignAction({ campaign, status: campaign.status === 'Published' || campaign.status === 'Active' ? 'Private' : 'Archived' })}>{campaign.status === 'Published' || campaign.status === 'Active' ? <><EyeOff size={14} /> Hide</> : <><Archive size={14} /> Archive</>}</Button>}</div> },
  ];
  const [visibleColumns, setVisibleColumns] = useColumns('campaigns', columns);
  const categories = ['All', ...Array.from(new Set(items.map((item) => item.category)))];
  const filtered = items.filter((item) => `${item.title} ${item.description} ${item.brand} ${item.category} ${item.location} ${item.platforms.join(' ')}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'All' || item.status === filter) && (category === 'All' || item.category === category));
  const pagination = usePagination(filtered, 5, `${query}|${filter}|${category}`);
  return <><Panel title="Campaigns" hint={`${filtered.length} of ${data.length} latest database records`}><DataToolbar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} options={['All', 'Draft', 'Published', 'Active', 'Private', 'Completed', 'Archived']} columns={columns} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} extraFilters={[{ key: 'category', label: 'Category', value: category, options: categories, onChange: setCategory }]} /><DataTable columns={columns} visibleColumns={visibleColumns} items={pagination.pageItems} empty={<EmptyState icon={FolderKanban} title="No campaigns found" description="Try clearing filters to see more campaigns." />} /><Pagination {...pagination} total={filtered.length} /></Panel>{pendingCampaignAction && <ConfirmDialog title={pendingCampaignAction.status === 'Private' ? 'Hide this campaign?' : 'Archive this campaign?'} description={pendingCampaignAction.status === 'Private' ? 'It will no longer appear in the public marketplace. Existing applications and campaign data will remain saved.' : 'It will be archived and stop accepting new marketplace activity. Existing applications and campaign data will remain saved.'} confirmLabel={pendingCampaignAction.status === 'Private' ? 'Hide campaign' : 'Archive campaign'} danger busy={busyCampaign === pendingCampaignAction.campaign.id} onCancel={() => setPendingCampaignAction(null)} onConfirm={applyCampaignAction} />}</>;
}

function ProposalsView() {
  const [query, setQuery] = useState(''); const [search, setSearch] = useState(''); const [filter, setFilter] = useState('All'); const [media, setMedia] = useState('All');
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(20); const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<ProposalPage | null>(null); const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState('');
  useEffect(() => { const timer = window.setTimeout(() => setSearch(query.trim()), 250); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => { setPage(1); }, [search, filter, media, pageSize]);
  useEffect(() => {
    let current = true;
    setLoading(true); setLoadError('');
    void getAdminProposals({ take: pageSize, offset: (page - 1) * pageSize, query: search, status: filter, media })
      .then((response) => { if (current) setResult(response); })
      .catch((reason) => { if (current) setLoadError(reason instanceof Error ? reason.message : 'Proposals could not be loaded.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [filter, media, page, pageSize, refresh, search]);
  const columns: Column<Proposal>[] = [
    { key: 'proposal', label: 'Proposal', locked: true, render: (proposal) => <div className={styles.entity}><span className={styles.statIcon + ' ' + styles.statOrange}>{proposal.hasMedia ? <ImageIcon size={15} /> : <FileCheck2 size={15} />}</span><div><div className={styles.entityName}>{proposal.title}</div><div className={styles.entityMeta}>{proposal.campaign}</div></div></div> },
    { key: 'direction', label: 'Direction', render: (proposal) => proposal.invitedByBrand ? 'Brand invitation' : 'Creator application' },
    { key: 'from', label: 'Creator', render: (proposal) => <Button variant="ghost" href={`/admin/users/${proposal.creatorId}`}><UserRound size={14} /> {proposal.from}</Button> },
    { key: 'to', label: 'Brand', render: (proposal) => <Button variant="ghost" href={`/admin/users/${proposal.brandId}`}><UserRound size={14} /> {proposal.to}</Button> },
    { key: 'status', label: 'Status', render: (proposal) => <Status value={proposal.status} /> },
    { key: 'budget', label: 'Budget', render: (proposal) => proposal.budget },
    { key: 'media', label: 'Media', render: (proposal) => proposal.media?.length ? `${proposal.media.length} files` : proposal.hasMedia ? 'Attached' : 'None' },
    { key: 'submitted', label: 'Submitted', render: (proposal) => formatCampaignDeadline(proposal.submittedAt) },
    { key: 'updated', label: 'Updated', render: (proposal) => proposal.updated },
    { key: 'actions', label: 'Actions', locked: true, render: (proposal) => <div className={styles.rowActions}><Button variant="ghost" href={`/admin/proposals/${proposal.id}`}><Eye size={14} /> View</Button><Button variant="ghost" href={`/admin/campaigns/${proposal.campaignId}`}><FolderKanban size={14} /> Campaign</Button></div> },
  ];
  const [visibleColumns, setVisibleColumns] = useColumns('proposals', columns);
  const pageCount = Math.max(1, Math.ceil((result?.total ?? 0) / pageSize));
  const pagination = { page, pageCount, pageSize, total: result?.total ?? 0, pageItems: result?.items ?? [], setPage, setPageSize };
  return <Panel title="Proposal flow" hint={result ? `${result.total} saved applications` : 'Applications saved in the marketplace database'}><DataToolbar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} filterLabel="Status" options={['All', 'New', 'Accepted', 'Declined', 'Withdrawn', 'Completed']} columns={columns} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} extraFilters={[{ key: 'media', label: 'Media', value: media, options: ['All', 'With media', 'No media'], onChange: setMedia }]} />{loading ? <div className={styles.empty}>Loading proposals…</div> : loadError ? <div className={styles.panelBody}><div className={styles.errorInline} role="alert">{loadError}</div><Button variant="secondary" onClick={() => setRefresh((value) => value + 1)}><Activity size={14} /> Retry</Button></div> : <><DataTable columns={columns} visibleColumns={visibleColumns} items={pagination.pageItems} empty={<EmptyState icon={FileCheck2} title="No proposals found" description="Try clearing the search or filters." />} /><Pagination {...pagination} total={pagination.total} /></>}</Panel>;
}

function AppSettingsView({ onToast }: { onToast: (message: string) => void }) {
  const [versions, setVersions] = useState<VersionConfig[]>([]);
  const [settings, setSettings] = useState<AdminAppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savingSection, setSavingSection] = useState<'runtime' | 'whatsapp' | 'smtp' | 'product' | 'release' | 'delete' | null>(null);
  useEffect(() => {
    let active = true;
    getAdminAppSettings()
      .then((response) => {
        if (!active) return;
        setSettings(response.settings);
        setVersions(response.versions);
      })
      .catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : 'Could not load app settings.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const update = (platform: VersionConfig['platform'], key: keyof VersionConfig, value: string) => setVersions((current) => current.map((item) => item.platform === platform ? { ...item, [key]: value } : item));
  const updateRuntime = <K extends keyof AdminRuntimeSettings>(key: K, value: AdminRuntimeSettings[K]) => setSettings((current) => current ? { ...current, runtime: { ...current.runtime, [key]: value } } : current);
  const updateSmtp = <K extends keyof AdminSmtpSettings>(key: K, value: AdminSmtpSettings[K]) => setSettings((current) => current ? { ...current, smtp: { ...current.smtp, [key]: value } } : current);
  const updateWhatsApp = <K extends keyof AdminWhatsAppSettings>(key: K, value: AdminWhatsAppSettings[K]) => setSettings((current) => current ? { ...current, whatsapp: { ...current.whatsapp, [key]: value } } : current);
  const updateProduct = <K extends keyof AdminProductSettings>(key: K, value: AdminProductSettings[K]) => setSettings((current) => current ? { ...current, product: { ...current.product, [key]: value } } : current);
  const saveSection = async (section: Exclude<typeof savingSection, null>) => {
    if (!settings || section === 'delete') return;
    setSavingSection(section);
    try {
      const response = await saveAdminAppSettings(settings, versions);
      setSettings(response.settings);
      setVersions(response.versions);
      onToast(`${section === 'release' ? 'Release configuration' : section[0].toUpperCase() + section.slice(1)} updated successfully.`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Could not save app settings.');
    } finally {
      setSavingSection(null);
    }
  };
  const deleteSavedSettings = async () => {
    if (!window.confirm('Delete all saved app settings from the database?')) return;
    setSavingSection('delete');
    try {
      const response = await deleteAdminAppSettings();
      setSettings(response.settings);
      setVersions(response.versions);
      onToast('Saved app settings deleted from the database.');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Could not delete app settings.');
    } finally {
      setSavingSection(null);
    }
  };
  if (loading) return <Panel title="App settings" hint="Loading current values from the database."><div className={styles.panelBody}>Loading saved settings…</div></Panel>;
  if (!settings) return <Panel title="App settings" hint="The database-backed settings could not be loaded."><div className={styles.panelBody}><div className={styles.errorInline} role="alert">{loadError || 'Could not load app settings.'}</div></div></Panel>;
  return <>
    <div className={styles.settingsToolbar}><div><strong>Database-backed configuration</strong><span>Every save updates the server database. Passwords and API keys remain masked and server-side.</span></div><Button variant="danger" onClick={deleteSavedSettings} disabled={savingSection !== null}><Trash2 size={14} />{savingSection === 'delete' ? 'Deleting…' : 'Delete saved settings'}</Button></div>
    <Panel title="Runtime & environment" hint="Keep service endpoints and runtime behavior in one place.">
      <div className={styles.panelBody}><div className={styles.settingsIntro}><span className={`${styles.statIcon} ${styles.statBlue}`}><Database size={16} /></span><div><strong>Environment-aware configuration</strong><p>Use separate values for development, staging, and production. Secrets should be connected to a server-side environment or secret manager before release.</p></div><Status value={settings.runtime.environment} /></div><div className={styles.formGrid}><Field label="Environment"><select className={styles.select} value={settings.runtime.environment} onChange={(event) => updateRuntime('environment', event.target.value as AdminRuntimeSettings['environment'])}><option>Development</option><option>Staging</option><option>Production</option></select></Field><Field label="Log level"><select className={styles.select} value={settings.runtime.logLevel} onChange={(event) => updateRuntime('logLevel', event.target.value as AdminRuntimeSettings['logLevel'])}><option>Error</option><option>Warn</option><option>Info</option><option>Debug</option></select></Field><Field label="API base URL"><input className={styles.input} value={settings.runtime.apiBaseUrl} onChange={(event) => updateRuntime('apiBaseUrl', event.target.value)} /></Field><Field label="Admin web URL"><input className={styles.input} value={settings.runtime.webBaseUrl} onChange={(event) => updateRuntime('webBaseUrl', event.target.value)} /></Field><Field label="Media/CDN URL"><input className={styles.input} value={settings.runtime.mediaBaseUrl} onChange={(event) => updateRuntime('mediaBaseUrl', event.target.value)} /></Field><Field label="Timezone"><select className={styles.select} value={settings.runtime.timezone} onChange={(event) => updateRuntime('timezone', event.target.value)}><option>Asia/Kolkata</option><option>UTC</option><option>America/New_York</option><option>Europe/London</option></select></Field></div><div className={styles.drawerActions}><Button variant="primary" onClick={() => saveSection('runtime')} disabled={savingSection !== null}><Check size={14} />{savingSection === 'runtime' ? 'Updating…' : 'Update runtime'}</Button></div></div>
    </Panel>
    <Panel title="WhatsApp delivery" hint="Provider settings are read from server environment variables first, with encrypted admin settings available as an override." action={<Status value={settings.whatsapp.enabled ? 'Enabled' : 'Disabled'} />}>
      <div className={styles.panelBody}><div className={styles.settingsIntro}><span className={`${styles.statIcon} ${styles.statGreen}`}><MessageCircle size={16} /></span><div><strong>WhatsApp OTP and notifications</strong><p>Use the configured wa-api.suthartech.com session. The API key is never returned to the browser after saving.</p></div><Status value={settings.whatsapp.session ? 'Configured' : 'Needs setup'} /></div><div className={styles.formGrid}><Field label="Enable WhatsApp"><select className={styles.select} value={String(settings.whatsapp.enabled)} onChange={(event) => updateWhatsApp('enabled', event.target.value === 'true')}><option value="true">Enabled</option><option value="false">Disabled</option></select></Field><Field label="Provider base URL"><input className={styles.input} type="url" value={settings.whatsapp.baseUrl} onChange={(event) => updateWhatsApp('baseUrl', event.target.value)} /></Field><Field label="Session name"><input className={styles.input} value={settings.whatsapp.session} onChange={(event) => updateWhatsApp('session', event.target.value)} placeholder="Configured server-side" /></Field><Field label="API key"><input className={styles.input} type="password" value={settings.whatsapp.apiKey} onChange={(event) => updateWhatsApp('apiKey', event.target.value)} autoComplete="new-password" placeholder="Leave blank to keep the server value" /></Field><Field label="Sender name"><input className={styles.input} value={settings.whatsapp.senderName} onChange={(event) => updateWhatsApp('senderName', event.target.value)} /></Field></div><div className={styles.drawerActions}><Button variant="primary" onClick={() => saveSection('whatsapp')} disabled={savingSection !== null}><Check size={14} />{savingSection === 'whatsapp' ? 'Updating…' : 'Update WhatsApp'}</Button></div></div>
    </Panel>
    <Panel title="SMTP & email delivery" hint="Save sender configuration used by the API. No connectivity test is exposed in this admin build.">
      <div className={styles.panelBody}><div className={styles.settingsIntro}><span className={`${styles.statIcon} ${styles.statOrange}`}><Mail size={16} /></span><div><strong>Server-side delivery</strong><p>SMTP credentials are masked in this form. The live connection should be performed by the backend, never in the browser.</p></div><Status value={settings.smtp.enabled ? 'Enabled' : 'Disabled'} /></div><div className={styles.formGrid}><Field label="Email provider"><select className={styles.select} value={settings.smtp.provider} onChange={(event) => updateSmtp('provider', event.target.value)}><option>SMTP relay</option><option>Amazon SES</option><option>SendGrid SMTP</option><option>Mailgun SMTP</option></select></Field><Field label="Encryption"><select className={styles.select} value={settings.smtp.encryption} onChange={(event) => updateSmtp('encryption', event.target.value as AdminSmtpSettings['encryption'])}><option>TLS</option><option>SSL</option><option>None</option></select></Field><Field label="SMTP host"><input className={styles.input} value={settings.smtp.host} onChange={(event) => updateSmtp('host', event.target.value)} placeholder="smtp.example.com" /></Field><Field label="SMTP port"><input className={styles.input} type="number" min="1" max="65535" value={settings.smtp.port} onChange={(event) => updateSmtp('port', event.target.value)} /></Field><Field label="Username"><input className={styles.input} value={settings.smtp.username} onChange={(event) => updateSmtp('username', event.target.value)} /></Field><Field label="Password / secret"><div className={styles.secretInput}><KeyRound size={15} /><input className={styles.input} type="password" value={settings.smtp.password} onChange={(event) => updateSmtp('password', event.target.value)} autoComplete="new-password" /></div></Field><Field label="From name"><input className={styles.input} value={settings.smtp.fromName} onChange={(event) => updateSmtp('fromName', event.target.value)} /></Field><Field label="From email"><input className={styles.input} type="email" value={settings.smtp.fromEmail} onChange={(event) => updateSmtp('fromEmail', event.target.value)} /></Field><Field label="Reply-to email"><input className={styles.input} type="email" value={settings.smtp.replyTo} onChange={(event) => updateSmtp('replyTo', event.target.value)} /></Field></div><div className={styles.settingsToggleList}><SettingsToggle label="Enable email delivery" description="Allow the backend to send transactional emails through this configuration." enabled={settings.smtp.enabled} onChange={(value) => updateSmtp('enabled', value)} /></div><div className={styles.drawerActions}><Button variant="primary" onClick={() => saveSection('smtp')} disabled={savingSection !== null}><Check size={14} />{savingSection === 'smtp' ? 'Updating…' : 'Update SMTP'}</Button></div></div>
    </Panel>
    <Panel title="Product controls" hint="Marketplace behavior and public support links.">
      <div className={styles.panelBody}><div className={styles.settingsToggleList}><SettingsToggle label="Maintenance banner" description="Show a maintenance notice while critical work is in progress." enabled={settings.product.maintenance} onChange={(value) => updateProduct('maintenance', value)} /><SettingsToggle label="Public discovery" description="Allow visitors to browse public profiles and campaigns without signing in." enabled={settings.product.publicDiscovery} onChange={(value) => updateProduct('publicDiscovery', value)} /></div><div className={styles.formGrid}><Field label="Support email"><input className={styles.input} type="email" value={settings.product.supportEmail} onChange={(event) => updateProduct('supportEmail', event.target.value)} /></Field><Field label="Support hours"><input className={styles.input} value={settings.product.supportHours} onChange={(event) => updateProduct('supportHours', event.target.value)} /></Field><Field label="Privacy policy URL"><input className={styles.input} value={settings.product.privacyUrl} onChange={(event) => updateProduct('privacyUrl', event.target.value)} /></Field><Field label="Terms URL"><input className={styles.input} value={settings.product.termsUrl} onChange={(event) => updateProduct('termsUrl', event.target.value)} /></Field><Field label="Community guidelines URL" full><input className={styles.input} value={settings.product.guidelinesUrl} onChange={(event) => updateProduct('guidelinesUrl', event.target.value)} /></Field></div><div className={styles.drawerActions}><Button variant="primary" onClick={() => saveSection('product')} disabled={savingSection !== null}><Check size={14} />{savingSection === 'product' ? 'Updating…' : 'Update product'}</Button></div></div>
    </Panel>
    <Panel title="Release configuration" hint="Mobile clients use this configuration at launch and resume.">
      <div className={styles.panelBody}><div className={styles.cardGrid}>{versions.map((version) => <div className={styles.contentCard} key={version.platform}><div className={styles.contentCardTop}><div><h3>{version.platform}</h3><p>{version.platform === 'Android' ? 'APK or Google Play Store release control' : 'Apple App Store release control'}</p></div><Status value={version.updateType} /></div><div className={styles.formGrid}><Field label="Minimum version"><input className={styles.input} value={version.minimumVersion} onChange={(event) => update(version.platform, 'minimumVersion', event.target.value)} /></Field><Field label="Latest version"><input className={styles.input} value={version.latestVersion} onChange={(event) => update(version.platform, 'latestVersion', event.target.value)} /></Field><Field label="Update type"><select className={styles.select} value={version.updateType} onChange={(event) => update(version.platform, 'updateType', event.target.value)}><option>None</option><option>Optional</option><option>Mandatory</option></select></Field>{version.platform === 'Android' ? <Field label="Update source"><select className={styles.select} value={version.sourceType} onChange={(event) => update(version.platform, 'sourceType', event.target.value)}><option value="apk">Direct APK download</option><option value="playStore">Google Play Store</option></select></Field> : <Field label="Update source"><input className={styles.input} value="Apple App Store only" disabled readOnly /></Field>}<Field label={version.platform === 'iOS' ? 'App Store URL' : version.sourceType === 'apk' ? 'APK URL' : 'Google Play Store URL'} full><input className={styles.input} type="url" value={version.storeUrl} onChange={(event) => update(version.platform, 'storeUrl', event.target.value)} /></Field><Field label="Update message" full><input className={styles.input} value={version.message} onChange={(event) => update(version.platform, 'message', event.target.value)} /></Field><Field label="Release notes" full><textarea className={styles.textarea} value={version.releaseNotes} onChange={(event) => update(version.platform, 'releaseNotes', event.target.value)} /></Field></div></div>)}</div><div className={styles.drawerActions}><Button variant="primary" onClick={() => saveSection('release')} disabled={savingSection !== null}><Check size={14} />{savingSection === 'release' ? 'Updating…' : 'Update release settings'}</Button></div></div>
    </Panel>
  </>;
}

function ConfirmDialog({ title, description, confirmLabel, danger = false, busy = false, reasonRequired = false, onCancel, onConfirm }: { title: string; description: string; confirmLabel: string; danger?: boolean; busy?: boolean; reasonRequired?: boolean; onCancel: () => void; onConfirm: (reason?: string) => void }) {
  const [reason, setReason] = useState('');
  return <div className={styles.modalBackdrop} role="presentation"><div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">{title}</h2><p>{description}</p>{reasonRequired && <label className={styles.suspensionReason}>Reason for suspension<textarea className={styles.textarea} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} placeholder="Explain why this account is being suspended" /></label>}<div className={styles.modalActions}><Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} onClick={() => onConfirm(reasonRequired ? reason.trim() : undefined)} disabled={busy || (reasonRequired && reason.trim().length < 5)}>{busy ? 'Working...' : confirmLabel}</Button></div></div></div>;
}

function DetailHero({ avatar, title, metaText, status, actions }: { avatar: string; title: string; metaText: string; status?: string; actions?: React.ReactNode }) {
  return <div className={styles.detailHero}><div className={styles.detailHeroMain}><div className={styles.detailHeroAvatar}>{avatar.slice(0, 2).toUpperCase()}</div><div><h2 className={styles.detailHeroTitle}>{title}</h2><p className={styles.detailHeroMeta}>{metaText}{status && <> · <Status value={status} /></>}</p></div></div>{actions && <div className={styles.detailHeroActions}>{actions}</div>}</div>;
}

type DetailAction = {
  title: string;
  description: string;
  confirmLabel: string;
  successMessage: string;
  danger?: boolean;
  reasonRequired?: boolean;
  run: (reason?: string) => Promise<void>;
};

function UserDetailContent({ user, isOwner, onSuspend, noticeNode, confirmation }: { user: AdminUser; isOwner: boolean; onSuspend: () => void; noticeNode: React.ReactNode; confirmation: React.ReactNode }) {
  const suspended = user.status === 'Suspended';
  return <div className={styles.page}>
    <PageHeader eyebrow="Profile detail" title={user.name} description="Review contact details, saved profile data, social accounts, marketplace history, and moderation state." action={<div className={styles.headerActions}><Button variant="secondary" href="/admin/users"><ArrowLeft size={15} /> Back to users</Button><Button variant="secondary" href={`/admin/users/${user.id}/activity`}><Activity size={15} /> Activity</Button><Button variant="primary" href={`/admin/notifications?user=${user.id}`}><Bell size={15} /> Send notification</Button></div>} />
    <DetailHero avatar={user.avatar} title={user.name} metaText={`${user.role} · ${user.location} · Joined ${user.joined}`} status={user.status} actions={<div className={styles.detailHeroActions}><Button variant="ghost" href={`/admin/users/${user.id}/campaigns`}><FolderKanban size={14} /> Campaigns</Button><Button variant="ghost" href={`/admin/users/${user.id}/proposals`}><FileCheck2 size={14} /> Proposals</Button>{isOwner ? <Button variant={suspended ? 'secondary' : 'danger'} onClick={onSuspend}>{suspended ? 'Restore account' : 'Suspend account'}</Button> : <Status value="Moderator · no suspension access" />}</div>} />
    {noticeNode}
    <UserProfilePanels user={user} />
    {confirmation}
  </div>;
}

export function AdminDetailPage({ section, id }: { section: string; id: string }) {
  const { snapshot, setSnapshot, error, reload } = useAdminSnapshot();
  const [notice, setNotice] = useState('');
  const [pendingAction, setPendingAction] = useState<DetailAction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { role, ready } = useAdminSession();
  const [applicationPage, setApplicationPage] = useState(1);
  const [applicationData, setApplicationData] = useState<CampaignApplicationsPage | null>(null);
  const [applicationError, setApplicationError] = useState('');
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [applicationRefresh, setApplicationRefresh] = useState(0);
  const [proposalDetail, setProposalDetail] = useState<ProposalDetail | null>(null);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState('');
  const [proposalRefresh, setProposalRefresh] = useState(0);
  const adminRole: AdminRole = role ?? 'Moderator';
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 2600); return () => window.clearTimeout(timer); }, [notice]);
  useEffect(() => {
    if (section !== 'campaigns' || !ready) return;
    let current = true;
    setApplicationLoading(true);
    setApplicationError('');
    setApplicationData(null);
    void getAdminCampaignApplications(id, 20, (applicationPage - 1) * 20)
      .then((result) => {
        if (!current) return;
        if (result.offset > 0 && result.offset >= result.total) {
          setApplicationPage(Math.max(1, Math.ceil(result.total / result.take)));
          return;
        }
        setApplicationData(result);
      })
      .catch((reason) => { if (current) setApplicationError(reason instanceof Error ? reason.message : 'Campaign applications could not be loaded.'); })
      .finally(() => { if (current) setApplicationLoading(false); });
    return () => { current = false; };
  }, [applicationPage, applicationRefresh, id, ready, section]);
  useEffect(() => {
    if (section !== 'proposals' || !ready) return;
    let current = true;
    setProposalLoading(true); setProposalError(''); setProposalDetail(null);
    void getAdminProposal(id)
      .then((result) => { if (current) setProposalDetail(result); })
      .catch((reason) => { if (current) setProposalError(reason instanceof Error ? reason.message : 'Proposal details could not be loaded.'); })
      .finally(() => { if (current) setProposalLoading(false); });
    return () => { current = false; };
  }, [id, proposalRefresh, ready, section]);
  if (!ready) return <LoadingPage />;
  if (error) return <LoadFailure message={error} retry={() => void reload()} />;
  if (!snapshot) return <LoadingPage />;
  if (!canAccessSection(adminRole, section)) {
    return <div className={styles.page}><PageHeader eyebrow="Access limited" title="Owner access required" description="This detail view belongs to an owner-only admin area." /><div className={styles.roleBanner}><ShieldAlert size={16} /><div><strong>Moderator workspace</strong><span>Your current role does not allow access to this detail.</span></div></div></div>;
  }
  const backAction = <Button variant="secondary" href={`/admin/${section}`}><ArrowLeft size={15} /> Back to {meta[section]?.title ?? 'list'}</Button>;
  const completeAction = async (reason?: string) => {
    if (!pendingAction) return;
    setIsSaving(true);
    try {
      await pendingAction.run(reason);
      setSnapshot(await getAdminSnapshot());
      setNotice(pendingAction.successMessage);
      setPendingAction(null);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'The action could not be completed.');
    } finally { setIsSaving(false); }
  };
  const confirmation = pendingAction ? <ConfirmDialog title={pendingAction.title} description={pendingAction.description} confirmLabel={pendingAction.confirmLabel} danger={pendingAction.danger} reasonRequired={pendingAction.reasonRequired} busy={isSaving} onCancel={() => setPendingAction(null)} onConfirm={completeAction} /> : null;
  const noticeNode = notice && <div className={styles.notice}><CheckCircle2 size={16} />{notice}</div>;
  if (section === 'users') { const user = snapshot.users.find((item) => item.id === id); if (!user) return <EmptyState icon={Users} title="Profile not found" description="The requested profile is not available." />; const suspended = user.status === 'Suspended'; return <UserDetailContent user={user} isOwner={adminRole === 'Owner'} onSuspend={() => setPendingAction({ title: suspended ? 'Restore this account?' : 'Suspend this account?', description: suspended ? `${user.name} will regain marketplace access.` : `${user.name} will lose marketplace access until restored.`, confirmLabel: suspended ? 'Restore account' : 'Suspend account', danger: !suspended, reasonRequired: !suspended, successMessage: `${user.name} is now ${suspended ? 'active' : 'suspended'}.`, run: (reason) => suspendUser(user.id, !suspended, reason).then(() => undefined) })} noticeNode={noticeNode} confirmation={confirmation} />; }
  if (section === 'campaigns') {
    const campaign = snapshot.campaigns.find((item) => item.id === id);
    if (!campaign) return <EmptyState icon={FolderKanban} title="Campaign not found" description="The requested campaign is not available." />;
    const applications = applicationData?.items ?? [];
    const brand = snapshot.users.find((user) => user.id === campaign.brandId);
    const nextStatus = campaign.status === 'Published' || campaign.status === 'Active' ? 'Private' : 'Archived';
    const applicationColumns: Column<Proposal>[] = [
      { key: 'creator', label: 'Creator', render: (application) => <Button variant="ghost" href={`/admin/users/${application.creatorId}`}><UserRound size={14} /> {application.from}</Button> },
      { key: 'status', label: 'Status', render: (application) => <Status value={application.status} /> },
      { key: 'budget', label: 'Creator quote', render: (application) => application.budget || 'Not provided' },
      { key: 'media', label: 'Attachments', render: (application) => application.media?.length ? `${application.media.length} files` : 'None' },
      { key: 'updated', label: 'Updated', render: (application) => formatCampaignDeadline(application.updated) },
      { key: 'actions', label: 'Actions', locked: true, render: (application) => <Button variant="ghost" href={`/admin/proposals/${application.id}`}><Eye size={14} /> View</Button> },
    ];
    return <div className={styles.page}>
      <PageHeader eyebrow="Campaign detail" title={campaign.title} description={campaign.description || 'No campaign description was saved.'} action={backAction} />
      <DetailHero avatar={campaign.brand} title={campaign.brand} metaText={`${campaign.category} · ${campaign.location} · Updated ${formatCampaignDeadline(campaign.updated)}`} status={campaign.status} actions={<div className={styles.detailHeroActions}>{brand && <Button variant="secondary" href={`/admin/users/${brand.id}`}><UserRound size={14} /> Brand profile</Button>}{campaign.status !== 'Archived' && <Button variant={nextStatus === 'Archived' ? 'danger' : 'secondary'} onClick={() => setPendingAction({ title: nextStatus === 'Private' ? 'Hide this campaign?' : 'Archive this campaign?', description: nextStatus === 'Private' ? 'It will no longer appear in the public marketplace. Existing applications and campaign data will remain saved.' : 'It will stop accepting new marketplace activity. Existing applications and campaign data will remain saved.', confirmLabel: nextStatus === 'Private' ? 'Hide campaign' : 'Archive campaign', danger: nextStatus === 'Archived', successMessage: nextStatus === 'Private' ? 'Campaign hidden from the marketplace.' : 'Campaign archived.', run: () => updateCampaignStatus(campaign.id, nextStatus) })}>{nextStatus === 'Private' ? <><EyeOff size={14} /> Hide</> : <><Archive size={14} /> Archive</>}</Button>}</div>} />
      {noticeNode}
      <Panel title="Campaign overview" hint="Saved campaign and marketplace state">
        <div className={styles.panelBody}><div className={styles.detailGrid}>
          <DetailItem label="Category" value={campaign.category || 'Not set'} />
          <DetailItem label="Budget" value={campaign.budget || 'Not set'} />
          <DetailItem label="Target locations" value={campaign.targetLocations.join(', ') || 'Not specified'} />
          <DetailItem label="Preferred platforms" value={campaign.platforms.join(', ') || 'Not specified'} />
          <DetailItem label="Deadline" value={formatCampaignDeadline(campaign.deadlineAt)} />
          <DetailItem label="Applications" value={`${campaign.proposals} total`} />
          <DetailItem label="Application limit" value={campaign.applicationLimit?.toString() || 'No limit'} />
          <DetailItem label="Approval limit" value={campaign.approvalLimit?.toString() || 'No limit'} />
          <DetailItem label="Published" value={formatCampaignDeadline(campaign.publishedAt)} />
          <DetailItem label="Closed" value={formatCampaignDeadline(campaign.closedAt)} />
          <DetailItem label="Created" value={formatCampaignDeadline(campaign.createdAt)} />
          <DetailItem label="Last updated" value={formatCampaignDeadline(campaign.updated)} />
        </div></div>
      </Panel>
      <Panel title="Campaign brief" hint="Content saved from the campaign form">
        <div className={styles.panelBody}><div className={styles.detailGrid}>
          <DetailItem label="Description" value={campaign.description || 'Not provided'} />
          <DetailItem label="Deliverables" value={campaign.deliverables || 'Not provided'} />
          <DetailItem label="Creator requirements" value={campaign.creatorRequirements || 'Not provided'} />
          <DetailItem label="Requirements" value={campaign.requirements.join(' · ') || 'Not provided'} />
          <DetailItem label="Close at application limit" value={campaign.closeOnApplicationLimit ? 'Yes' : 'No'} />
          <DetailItem label="Close at approval limit" value={campaign.closeOnApprovalLimit ? 'Yes' : 'No'} />
          {campaign.collaborationVideoUrl && <DetailItem label={campaign.collaborationVideoLabel || 'Collaboration video'} value={campaign.collaborationVideoUrl} />}
        </div></div>
      </Panel>
      <Panel title="Campaign media" hint="Saved images, videos, and documents"><MediaFiles files={campaign.media} /></Panel>
      <Panel title="Applications" hint={applicationData ? `${applicationData.total} total · ${applicationData.take} per page` : 'Applications saved for this campaign'}>
        {applicationLoading ? <div className={styles.empty}>Loading campaign applications…</div> : applicationError ? <div className={styles.panelBody}><div className={styles.errorInline} role="alert">{applicationError}</div><Button variant="secondary" onClick={() => setApplicationRefresh((value) => value + 1)}><Activity size={14} /> Retry</Button></div> : <DataTable columns={applicationColumns} visibleColumns={applicationColumns.map((column) => column.key)} items={applications} empty={<EmptyState icon={FileCheck2} title="No applications yet" description="Creator applications for this campaign will appear here." />} />}
        {applicationData && !applicationLoading && !applicationError && <Pagination page={applicationPage} pageCount={Math.max(1, Math.ceil(applicationData.total / applicationData.take))} pageSize={applicationData.take} total={applicationData.total} setPage={setApplicationPage} setPageSize={() => setApplicationPage(1)} pageItems={applications} />}
      </Panel>
      {confirmation}
    </div>;
  }
  if (section === 'proposals') {
    if (proposalLoading) return <LoadingPage />;
    if (proposalError) return <div className={styles.page}><PageHeader eyebrow="Proposal detail" title="Proposal unavailable" description="The saved application could not be loaded." action={backAction} /><Panel title="Could not load proposal"><div className={styles.panelBody}><div className={styles.errorInline} role="alert">{proposalError}</div><Button variant="secondary" onClick={() => setProposalRefresh((value) => value + 1)}><Activity size={14} /> Retry</Button></div></Panel></div>;
    const proposal = proposalDetail;
    if (!proposal) return <EmptyState icon={FileCheck2} title="Proposal not found" description="The requested application is not available in the database." />;
    const responseFields = Object.entries(proposal.responses).filter(([, value]) => value !== null && value !== undefined);
    return <div className={styles.page}>
      <PageHeader eyebrow={proposal.invitedByBrand ? 'Brand invitation' : 'Creator application'} title={proposal.campaign} description={proposal.message || 'No application message was saved.'} action={backAction} />
      <DetailHero avatar={proposal.from} title={proposal.from} metaText={`${proposal.invitedByBrand ? 'Invited by' : 'Applied to'} ${proposal.to} · Submitted ${formatCampaignDeadline(proposal.submittedAt)}`} status={proposal.status} actions={<div className={styles.detailHeroActions}><Button variant="secondary" href={`/admin/users/${proposal.creatorId}`}><UserRound size={14} /> Creator</Button><Button variant="secondary" href={`/admin/users/${proposal.brandId}`}><UserRound size={14} /> Brand</Button><Button variant="secondary" href={`/admin/campaigns/${proposal.campaignId}`}><FolderKanban size={14} /> Campaign</Button><Button variant="primary" href={`/admin/chats?user=${encodeURIComponent(proposal.invitedByBrand ? proposal.creatorId : proposal.brandId)}`}><MessageCircle size={14} /> Chat</Button></div>} />
      {noticeNode}
      <Panel title="Application" hint="Saved application state and response details">
        <div className={styles.panelBody}><div className={styles.detailGrid}>
          <DetailItem label="Direction" value={proposal.invitedByBrand ? 'Brand invitation' : 'Creator application'} />
          <DetailItem label="Creator quote" value={proposal.budget} />
          <DetailItem label="Submitted" value={formatCampaignDeadline(proposal.submittedAt)} />
          <DetailItem label="Last updated" value={formatCampaignDeadline(proposal.updated)} />
          <DetailItem label="Completed" value={formatCampaignDeadline(proposal.completedAt)} />
          <DetailItem label="Contact shared" value={proposal.contactShared ? 'Yes' : 'No'} />
          {proposal.rejectionReason && <DetailItem label="Decline reason" value={proposal.rejectionReason} />}
          {proposal.status === 'Declined' && <DetailItem label="May reapply" value={proposal.allowReapply ? 'Yes' : 'No'} />}
          <DetailItem label="Application message" value={proposal.message || 'Not provided'} />
        </div></div>
      </Panel>
      {responseFields.length > 0 && <Panel title="Application responses" hint="Answers saved with this application"><div className={styles.panelBody}><div className={styles.detailGrid}>{responseFields.map(([key, value]) => <DetailItem key={key} label={proposalLabel(key)} value={proposalValue(value)} />)}</div></div></Panel>}
      <Panel title="Campaign details" hint="Current campaign record linked to this application">
        <div className={styles.panelBody}><div className={styles.detailGrid}>
          <DetailItem label="Campaign description" value={proposal.campaignDetails.description || 'Not provided'} />
          <DetailItem label="Category" value={proposal.campaignDetails.category || 'Not set'} />
          <DetailItem label="Brand budget" value={proposal.campaignDetails.budget || 'Not set'} />
          <DetailItem label="Deadline" value={formatCampaignDeadline(proposal.campaignDetails.deadlineAt)} />
          <DetailItem label="Target locations" value={proposal.campaignDetails.targetLocations.join(', ') || 'Not specified'} />
          <DetailItem label="Platforms" value={proposal.campaignDetails.platforms.join(', ') || 'Not specified'} />
          <DetailItem label="Deliverables" value={proposal.campaignDetails.deliverables || 'Not provided'} />
          <DetailItem label="Requirements" value={proposal.campaignDetails.requirements.join(' · ') || 'Not provided'} />
        </div></div>
      </Panel>
      <Panel title="Attached media" hint={`${proposal.media?.length ?? 0} file(s) saved with this application`}><MediaFiles files={proposal.media} /></Panel>
      <Panel title="Application history" hint="Recorded status changes from the database"><div className={styles.activityList}>{proposal.history.length ? proposal.history.map((event) => <ActivityItem key={event.id} dot={event.status === 'Declined' ? 'red' : event.status === 'Accepted' || event.status === 'Completed' ? 'green' : 'orange'} action={`${event.status} · ${event.invitedByBrand ? 'Brand invitation' : 'Creator application'}`} target={`${event.actorRole}${event.rejectionReason ? ` · ${event.rejectionReason}` : ''}`} time={formatCampaignDeadline(event.occurredAt)} />) : <EmptyState icon={Activity} title="No status history" description="No status-change events were recorded for this application." />}</div></Panel>
      {confirmation}
    </div>;
  }
  return <div className={styles.page}><PageHeader eyebrow={meta[section]?.eyebrow ?? 'Admin'} title={meta[section]?.title ?? 'Detail'} description="This detail view is ready for the corresponding service data." action={backAction} /><EmptyState icon={meta[section]?.icon ?? Activity} title="Detail view ready" description="The list view is available now." /></div>;
}

type UserWorkspaceSection = 'campaigns' | 'proposals' | 'activity' | 'settings';

export function AdminUserWorkspacePage({ id, section }: { id: string; section: UserWorkspaceSection }) {
  const { snapshot, setSnapshot, error, reload } = useAdminSnapshot();
  const [notice, setNotice] = useState('');
  const [pendingAction, setPendingAction] = useState<DetailAction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activityQuery, setActivityQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState('All');
  const { role, ready } = useAdminSession();
  const isOwner = role === 'Owner';
  const user = snapshot?.users.find((item) => item.id === id);
  const userProposals = snapshot && user ? snapshot.proposals.filter((item) => item.creatorId === user.id || item.brandId === user.id) : [];
  const userCampaigns = snapshot && user ? snapshot.campaigns.filter((item) => item.brandId === user.id || userProposals.some((proposal) => proposal.campaignId === item.id)) : [];
  const userActivity: ActivityEntry[] = user ? [
    { id: `user-${user.id}-profile`, actor: 'Account', action: 'Account created', target: user.name, time: user.joined, tone: 'blue' },
    ...userCampaigns.map((item) => ({ id: `user-${user.id}-campaign-${item.id}`, actor: 'Marketplace', action: `${item.status} campaign`, target: item.title, time: item.updated, tone: 'blue' as const })),
    ...userProposals.map((item) => ({ id: `user-${user.id}-proposal-${item.id}`, actor: 'Marketplace', action: `${item.status} proposal`, target: item.title, time: item.updated, tone: 'orange' as const })),
  ] : [];
  const filteredActivity = userActivity.filter((item) => {
    const haystack = `${item.action} ${item.target} ${item.actor}`.toLowerCase();
    const matchesQuery = haystack.includes(activityQuery.toLowerCase());
    const matchesFilter = activityFilter === 'All' || item.action.toLowerCase().includes(activityFilter.toLowerCase());
    return matchesQuery && matchesFilter;
  });
  const campaignPagination = usePagination(userCampaigns, 5, `${id}-campaigns`);
  const proposalPagination = usePagination(userProposals, 5, `${id}-proposals`);
  const activityPagination = usePagination(filteredActivity, 10, `${id}-activity-${activityQuery}|${activityFilter}`);
  const campaignTableColumns: Column<Campaign>[] = [
    { key: 'campaign', label: 'Campaign', locked: true, render: (item) => <div className={styles.entity}><span className={`${styles.statIcon} ${styles.statBlue}`}><FolderKanban size={15} /></span><div><div className={styles.entityName}>{item.title}</div><div className={styles.entityMeta}>{item.brand}</div></div></div> },
    { key: 'category', label: 'Category', render: (item) => item.category },
    { key: 'location', label: 'Location', render: (item) => item.location },
    { key: 'status', label: 'Status', render: (item) => <Status value={item.status} /> },
    { key: 'proposals', label: 'Proposals', render: (item) => item.proposals },
    { key: 'media', label: 'Media', render: (item) => item.media?.length ? `${item.media.length} files` : 'None' },
    { key: 'actions', label: 'Actions', locked: true, render: (item) => { const hide = item.status === 'Published' || item.status === 'Active'; return <div className={styles.campaignActions}><Button variant="ghost" href={`/admin/campaigns/${item.id}`}><Eye size={14} /> View</Button>{item.status !== 'Archived' && <Button variant="ghost" onClick={() => setPendingAction({ title: hide ? 'Hide this campaign?' : 'Archive this campaign?', description: hide ? 'It will disappear from the public marketplace. Existing applications remain saved.' : 'It will be archived and stop accepting new marketplace activity. Existing applications remain saved.', confirmLabel: hide ? 'Hide campaign' : 'Archive campaign', danger: !hide, successMessage: hide ? 'Campaign hidden from the marketplace.' : 'Campaign archived.', run: () => updateCampaignStatus(item.id, hide ? 'Private' : 'Archived') })}>{hide ? <><EyeOff size={14} /> Hide</> : <><Archive size={14} /> Archive</>}</Button>}</div>; } },
  ];
  const proposalTableColumns: Column<Proposal>[] = [
    { key: 'proposal', label: 'Proposal', locked: true, render: (item) => <div className={styles.entity}><span className={`${styles.statIcon} ${styles.statOrange}`}><FileCheck2 size={15} /></span><div><div className={styles.entityName}>{item.title}</div><div className={styles.entityMeta}>{item.campaign}</div></div></div> },
    { key: 'from', label: 'From', render: (item) => item.from },
    { key: 'to', label: 'To', render: (item) => item.to },
    { key: 'status', label: 'Status', render: (item) => <Status value={item.status} /> },
    { key: 'budget', label: 'Budget', render: (item) => item.budget },
    { key: 'media', label: 'Media', render: (item) => item.media?.length ? `${item.media.length} files` : item.hasMedia ? 'Attached' : 'None' },
    { key: 'actions', label: '', locked: true, render: (item) => <div className={styles.rowActions}><Button variant="ghost" href={`/admin/proposals/${item.id}`}><Eye size={14} /> View</Button></div> },
  ];
  const [campaignVisibleColumns, setCampaignVisibleColumns] = useColumns(`user-campaigns-${id}`, campaignTableColumns);
  const [proposalVisibleColumns, setProposalVisibleColumns] = useColumns(`user-proposals-${id}`, proposalTableColumns);
  if (!ready) return <LoadingPage />;
  if (error) return <LoadFailure message={error} retry={() => void reload()} />;
  if (!snapshot) return <LoadingPage />;
  if (!user) return <div className={styles.page}><EmptyState icon={Users} title="Profile not found" description="The requested profile is not available." /></div>;
  const backAction = <Button variant="secondary" href={`/admin/users/${user.id}`}><ArrowLeft size={15} /> Back to profile</Button>;
  const completeAction = async () => {
    if (!pendingAction) return;
    setIsSaving(true);
    try {
      await pendingAction.run();
      setSnapshot(await getAdminSnapshot());
      setNotice(pendingAction.successMessage);
      setPendingAction(null);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'The action could not be completed.');
    } finally { setIsSaving(false); }
  };
  const confirmation = pendingAction ? <ConfirmDialog title={pendingAction.title} description={pendingAction.description} confirmLabel={pendingAction.confirmLabel} danger={pendingAction.danger} busy={isSaving} onCancel={() => setPendingAction(null)} onConfirm={completeAction} /> : null;
  const noticeNode = notice && <div className={styles.notice}><CheckCircle2 size={16} />{notice}</div>;
  const accountAction = isOwner ? <Button variant={user.status === 'Suspended' ? 'secondary' : 'danger'} onClick={() => setPendingAction({ title: user.status === 'Suspended' ? 'Restore this account?' : 'Suspend this account?', description: user.status === 'Suspended' ? 'The account will regain marketplace access.' : 'The account will lose marketplace actions until restored.', confirmLabel: user.status === 'Suspended' ? 'Restore account' : 'Suspend account', danger: user.status !== 'Suspended', reasonRequired: user.status !== 'Suspended', successMessage: user.status === 'Suspended' ? 'Account restored.' : 'Account suspended.', run: (reason) => suspendUser(user.id, user.status !== 'Suspended', reason).then(() => undefined) })}>{user.status === 'Suspended' ? 'Restore account' : 'Suspend account'}</Button> : <Status value="Moderator · read-only account action" />;
  return <><div className={styles.page}><PageHeader eyebrow="User workspace" title={`${user.name} · ${section === 'activity' ? 'Recent record activity' : section[0].toUpperCase() + section.slice(1)}`} description={`Review ${user.name}'s account-specific ${section} data.`} action={<div className={styles.headerActions}>{backAction}<Button variant="primary" href={`/admin/notifications?user=${user.id}`}><Bell size={15} /> Send notification</Button></div>} />{noticeNode}{section === 'campaigns' && <Panel title="User campaigns" hint={`${userCampaigns.length} campaigns connected to this profile`}><DataTable columns={campaignTableColumns} visibleColumns={campaignVisibleColumns} items={campaignPagination.pageItems} empty={<EmptyState icon={FolderKanban} title="No connected campaigns" description="No campaign is owned by or connected to this user in the current data." />} /><Pagination {...campaignPagination} total={userCampaigns.length} /></Panel>}{section === 'proposals' && <Panel title="User proposals" hint={`${userProposals.length} proposals sent or received by this profile`}><DataTable columns={proposalTableColumns} visibleColumns={proposalVisibleColumns} items={proposalPagination.pageItems} empty={<EmptyState icon={FileCheck2} title="No connected proposals" description="No proposal is linked to this user in the current data." />} /><Pagination {...proposalPagination} total={userProposals.length} /></Panel>}{section === 'activity' && <Panel title="Recent record activity" hint={`${filteredActivity.length} matching records · based on saved account, campaign, and proposal timestamps`}><DataToolbar query={activityQuery} setQuery={setActivityQuery} filter={activityFilter} setFilter={setActivityFilter} options={['All', 'Account', 'Campaign', 'Proposal']} columns={[]} visibleColumns={[]} setVisibleColumns={() => undefined} /><div className={styles.activityList}>{activityPagination.pageItems.length ? activityPagination.pageItems.map((item) => <ActivityItem key={item.id} dot={item.tone} action={item.action} target={`${item.target} · ${item.actor}`} time={item.time} />) : <EmptyState icon={Activity} title="No related records" description="No saved account, campaign, or proposal records match this filter." />}</div><Pagination {...activityPagination} total={filteredActivity.length} /></Panel>}{section === 'settings' && <><Panel title="User settings" hint="Read-only account configuration and notification preferences."><div className={styles.panelBody}><div className={styles.detailGrid}><DetailItem label="Profile visibility" value={user.profileVisible ? 'Public' : 'Private'} /><DetailItem label="Account status" value={user.status} /><DetailItem label="Account role" value={user.role} /><DetailItem label="Primary location" value={user.location} /><DetailItem label="Email" value={user.email} /><DetailItem label="Phone" value={user.phone ?? 'Not provided'} /></div></div></Panel><Panel title="Notification preferences" hint="Saved preferences for this user"><div className={styles.preferenceList}>{user.notificationSettings?.length ? user.notificationSettings.map((setting) => <div className={styles.preferenceItem} key={setting.key}><span><strong>{setting.label}</strong><small>{setting.channel}</small></span><Status value={setting.enabled ? 'Enabled' : 'Disabled'} /></div>) : <EmptyState icon={Bell} title="No preferences saved" description="This user has not configured notification preferences." />}</div></Panel><Panel title="Account actions" hint="Actions are permission-aware and require confirmation"><div className={styles.settingActions}><Button variant="secondary" href={`/admin/users/${user.id}`}><UserRound size={14} /> View profile</Button><Button variant="secondary" href={`/admin/users/${user.id}/activity`}><Activity size={14} /> View record activity</Button><Button variant="primary" href={`/admin/notifications?user=${user.id}`}><Send size={14} /> Send notification</Button>{accountAction}</div></Panel></>}</div>{confirmation}</>;
}

function NotificationsView({ data, campaigns, proposals, initialUserId }: { data: AdminUser[]; campaigns: Campaign[]; proposals: Proposal[]; initialUserId?: string }) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('All');
  const [status, setStatus] = useState('All');
  const [location, setLocation] = useState('All');
  const [category, setCategory] = useState('All');
  const [followers, setFollowers] = useState('All');
  const [budget, setBudget] = useState('All');
  const [socialPlatform, setSocialPlatform] = useState('All');
  const [socialVerification, setSocialVerification] = useState('All');
  const [contentType, setContentType] = useState('All');
  const [selectedIds, setSelectedIds] = useState<string[]>(initialUserId ? [initialUserId] : []);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [actionLabel, setActionLabel] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [channel, setChannel] = useState<'All' | 'In-app' | 'In-chat' | 'Push' | 'Email' | 'WhatsApp'>('In-app');
  const [history, setHistory] = useState<AdminNotificationRecord[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const locations = ['All', ...Array.from(new Set(data.map((item) => item.location)))];
  const categories = ['All', ...Array.from(new Set(data.flatMap((item) => item.categories)))];
  const socialPlatforms = ['All', ...adminSocialPlatforms];
  const contentTypes = ['All', ...Array.from(new Set(data.flatMap((item) => item.contentTypes ?? [])))];
  const reloadHistory = useCallback(async () => {
    setHistoryError('');
    try { setHistory(await getAdminNotifications()); }
    catch (error) { setHistoryError(error instanceof Error ? error.message : 'Notification logs could not be loaded.'); }
  }, []);
  useEffect(() => { void reloadHistory(); }, [reloadHistory]);
  useEffect(() => { if (initialUserId && data.some((item) => item.id === initialUserId)) setSelectedIds((current) => Array.from(new Set([...current, initialUserId]))); }, [data, initialUserId]);
  const followerMatches = (value: string) => { const amount = Number.parseFloat(value.replace(/[^0-9.]/g, '')) || 0; return followers === 'All' || (followers === 'Under 10K' && amount < 10) || (followers === '10K–50K' && amount >= 10 && amount <= 50) || (followers === '50K+' && amount > 50) || (followers === 'Brand accounts' && value === '—'); };
  const budgetMatches = (user: AdminUser) => {
    if (budget === 'All') return true;
    const values = [...campaigns.filter((item) => item.brandId === user.id).map((item) => item.budget), ...proposals.filter((item) => item.creatorId === user.id || item.brandId === user.id).map((item) => item.budget)].flatMap((value) => Array.from(value.toLowerCase().replace(/,/g, '').matchAll(/(\d+(?:\.\d+)?)(k|l)?/g)).map((match) => { const amount = Number(match[1]); return match[2] === 'l' ? amount * 100 : match[2] === 'k' ? amount : amount > 1000 ? amount / 1000 : amount; }));
    const maximum = Math.max(...values, 0);
    return budget === 'Under ₹50K' ? maximum > 0 && maximum < 50 : budget === '₹50K–₹1L' ? maximum >= 50 && maximum <= 100 : maximum > 100;
  };
  const socialMatches = (user: AdminUser) => { const accounts = user.socialAccounts ?? []; const platformMatch = socialPlatform === 'All' || accounts.some((account) => account.platform === socialPlatform); const verificationMatch = socialVerification === 'All' || (socialVerification === 'Verified social' && accounts.some((account) => account.verified)) || (socialVerification === 'Unverified social' && accounts.some((account) => !account.verified)) || (socialVerification === 'No social account' && accounts.length === 0); return platformMatch && verificationMatch; };
  const filtered = data.filter((item) => `${item.name} ${item.email} ${item.location} ${item.categories.join(' ')} ${(item.socialAccounts ?? []).map((account) => account.platform).join(' ')} ${(item.contentTypes ?? []).join(' ')}`.toLowerCase().includes(query.toLowerCase()) && (role === 'All' || item.role === role) && (status === 'All' || item.status === status) && (location === 'All' || item.location === location) && (category === 'All' || item.categories.includes(category)) && followerMatches(item.followers) && budgetMatches(item) && socialMatches(item) && (contentType === 'All' || (item.contentTypes ?? []).includes(contentType)));
  const selectedRecipients = data.filter((item) => selectedIds.includes(item.id) && item.status === 'Active');
  const activeMatches = filtered.filter((item) => item.status === 'Active');
  const recipients = (selectedIds.length ? selectedRecipients : activeMatches).slice(0, 100);
  const conditions = [role !== 'All' ? `Account type: ${role}` : '', category !== 'All' ? `Category: ${category}` : '', contentType !== 'All' ? `Content: ${contentType}` : '', socialPlatform !== 'All' ? `Social: ${socialPlatform}` : '', socialVerification !== 'All' ? socialVerification : '', location !== 'All' ? `Location: ${location}` : '', status !== 'All' ? `Status: ${status}` : '', followers !== 'All' ? `Followers: ${followers}` : '', budget !== 'All' ? `Budget: ${budget}` : ''].filter(Boolean);
  const conditionLabel = conditions.length ? conditions.join(' · ') : 'All marketplace users';
  const audienceLabel = query.trim() ? `${conditionLabel} · Search: ${query.trim()}` : conditionLabel;
  const columns: Column<AdminUser>[] = [
    { key: 'profile', label: 'Recipient', locked: true, render: (item) => <div className={styles.entity}><Avatar label={item.avatar} /><div><div className={styles.entityName}>{item.name}</div><div className={styles.entityMeta}>{item.email}</div></div></div> },
    { key: 'role', label: 'Role', render: (item) => item.role },
    { key: 'category', label: 'Category', render: (item) => item.categories.join(' · ') },
    { key: 'location', label: 'Location', render: (item) => item.location },
    { key: 'followers', label: 'Audience', render: (item) => item.followers === '—' ? 'Brand account' : item.followers },
    { key: 'status', label: 'Status', render: (item) => <Status value={item.status} /> },
    { key: 'actions', label: '', locked: true, render: (item) => <label className={styles.checkboxControl}><input type="checkbox" checked={selectedIds.includes(item.id)} disabled={item.status !== 'Active'} onChange={() => setSelectedIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : current.length < 100 ? [...current, item.id] : current)} aria-label={`Select ${item.name}`} /><span>{item.status !== 'Active' ? item.status : selectedIds.includes(item.id) ? 'Selected' : 'Select'}</span></label> },
  ];
  const [visibleColumns, setVisibleColumns] = useColumns('notification-recipients', columns);
  const pagination = usePagination(filtered, 6, `${query}|${role}|${status}|${location}|${category}|${followers}|${budget}|${socialPlatform}|${socialVerification}|${contentType}`);
  const selectAll = () => setSelectedIds((current) => Array.from(new Set([...current, ...filtered.filter((item) => item.status === 'Active').map((item) => item.id)])).slice(0, 100));
  const clearSelection = () => setSelectedIds([]);
  const submit = async () => {
    if (!recipients.length || !title.trim() || !message.trim()) { setNotice('Choose active recipients and enter a title and message.'); return; }
    if (actionUrl.trim() && !/^https:\/\//i.test(actionUrl.trim())) { setNotice('Action links must use HTTPS.'); return; }
    setBusy(true);
    try {
      const userIds = recipients.map((user) => user.id);
      const data = { ...(actionLabel.trim() ? { actionLabel: actionLabel.trim() } : {}), ...(actionUrl.trim() ? { actionUrl: actionUrl.trim() } : {}) };
      if (channel === 'In-chat') {
        const result = await sendAdminChatBroadcast(userIds, title.trim(), message.trim(), data);
        await reloadHistory();
        setTitle(''); setMessage(''); setActionLabel(''); setActionUrl(''); setSelectedIds(result.failedUserIds); setDrawerOpen(result.failed > 0);
        setNotice(`Posted in Brandly chat for ${result.sent}/${result.requested} recipients${result.failed ? ` · ${result.failed} failed; only failed recipients remain selected` : ''}.`);
        return;
      }
      const channels = channel === 'All' ? ['IN_APP', 'PUSH', 'EMAIL', 'WHATSAPP'] as const : channel === 'In-app' ? ['IN_APP'] as const : channel === 'Email' ? ['EMAIL'] as const : channel === 'WhatsApp' ? ['WHATSAPP'] as const : ['PUSH'] as const;
      const result = await sendAdminNotifications({ userIds, title: title.trim(), body: message.trim(), channels: [...channels], data });
      await reloadHistory();
      setTitle(''); setMessage(''); setActionLabel(''); setActionUrl(''); setSelectedIds([]); setDrawerOpen(false);
      const { delivered, accepted, pending, failed: deliveryFailed } = result.delivery;
      const summary = `Saved for ${result.completed}/${result.requested} recipients · delivery: ${delivered} in-app/delivered, ${accepted} accepted by push, ${pending} pending, ${deliveryFailed} failed`;
      setNotice(result.failed ? `${summary} · ${result.failed} recipients failed to save` : summary);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Notification send failed.');
    } finally { setBusy(false); }
  };
  return <div className={styles.notificationWorkspace}>
    {notice && <div className={styles.notice}><CheckCircle2 size={16} />{notice}</div>}
    <Panel title="Choose recipients" hint={`${filtered.length} users match · ${selectedRecipients.length ? `${selectedRecipients.length} selected` : 'broadcast mode'}`} action={<div className={styles.headerActions}><Button variant="ghost" onClick={selectAll} disabled={!filtered.length}>Select all</Button><Button variant="ghost" onClick={clearSelection} disabled={!selectedIds.length}>Clear selection</Button><Button variant="primary" onClick={() => recipients.length ? setDrawerOpen(true) : setNotice('No matching recipients found for the current conditions.')}><Send size={14} /> {selectedRecipients.length ? 'Send to selected' : 'Send to all matching'}</Button></div>}><DataToolbar query={query} setQuery={setQuery} filter={role} setFilter={setRole} filterLabel="Account type" options={['All', 'Creator', 'Brand']} columns={columns} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} extraFilters={[{ key: 'status', label: 'Account status', value: status, options: ['All', 'Active', 'Suspended', 'Pending review'], onChange: setStatus }, { key: 'social-platform', label: 'Social media platform', value: socialPlatform, options: socialPlatforms, onChange: setSocialPlatform }, { key: 'social-verification', label: 'Social account verification', value: socialVerification, options: ['All', 'Verified social', 'Unverified social', 'No social account'], onChange: setSocialVerification }, { key: 'content-type', label: 'Content type', value: contentType, options: contentTypes, onChange: setContentType }, { key: 'location', label: 'Location', value: location, options: locations, onChange: setLocation, searchable: true }, { key: 'category', label: 'Category', value: category, options: categories, onChange: setCategory }, { key: 'followers', label: 'Audience / followers', value: followers, options: ['All', 'Brand accounts', 'Under 10K', '10K–50K', '50K+'], onChange: setFollowers }, { key: 'budget', label: 'Linked budget', value: budget, options: ['All', 'Under ₹50K', '₹50K–₹1L', '₹1L+'], onChange: setBudget }]} /><DataTable columns={columns} visibleColumns={visibleColumns} items={pagination.pageItems} empty={<EmptyState icon={Users} title="No recipients found" description="Adjust the account type, social account, content type, category, location, audience, budget, status, or search filters." />} /><Pagination {...pagination} total={filtered.length} /></Panel>
    <AdminDrawer open={drawerOpen} onClose={() => !busy && setDrawerOpen(false)} title="Send notification" description={`Send to ${recipients.length} active accounts. Maximum 100 recipients per send.`}><div className={styles.drawerForm}><div className={styles.bulkSummary}><span className={styles.statIcon + ' ' + styles.statBlue}><Users size={15} /></span><div><strong>{recipients.length} recipients ready</strong><small>{selectedRecipients.length ? 'Manual selection' : 'First matching accounts'} · {audienceLabel}</small></div></div><div className={styles.recipientPreview}>{recipients.slice(0, 6).map((user) => <span className={styles.recipientChip} key={user.id}><Avatar label={user.avatar} />{user.name}</span>)}{recipients.length > 6 && <span className={styles.recipientMore}>+{recipients.length - 6} more</span>}</div><Field label="Delivery channel"><select className={styles.select} value={channel} onChange={(event) => setChannel(event.target.value as 'All' | 'In-app' | 'In-chat' | 'Push' | 'Email' | 'WhatsApp')}><option value="In-app">In-app inbox only</option><option value="In-chat">In-chat message</option><option value="All">All notification channels</option><option value="Push">Push only</option><option value="Email">Email</option><option value="WhatsApp">WhatsApp</option></select></Field><Field label="Title"><input className={styles.input} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Notification title" maxLength={160} /></Field><Field label="Message"><textarea className={styles.textarea} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write the notification message." maxLength={2000} /></Field><div className={styles.formGrid}><Field label="Action button label"><input className={styles.input} value={actionLabel} onChange={(event) => setActionLabel(event.target.value)} placeholder="Optional" /></Field><Field label="Action link"><input className={styles.input} type="url" value={actionUrl} onChange={(event) => setActionUrl(event.target.value)} placeholder="https://…" /></Field></div><div className={styles.drawerActions}><Button variant="secondary" onClick={() => setDrawerOpen(false)} disabled={busy}>Cancel</Button><Button variant="primary" onClick={submit} disabled={busy || !recipients.length}>{busy ? 'Sending...' : <><Send size={14} /> Send to {recipients.length}</>}</Button></div></div></AdminDrawer>
    <Panel title="Latest notification logs" hint={`Latest ${history.length} records returned by the API · showing up to 10`} action={<Button variant="ghost" href="/admin/notification-logs">View all logs <ArrowUpRight size={14} /></Button>}>{historyError ? <div className={styles.panelBody}><div className={styles.errorInline} role="alert">{historyError}</div><Button variant="secondary" onClick={() => void reloadHistory()}><Activity size={14} /> Retry logs</Button></div> : <div className={styles.compactList}>{history.length ? history.slice(0, 10).map((item) => <div className={styles.compactItem} key={item.id}><span className={styles.statIcon + ' ' + styles.statBlue}><Bell size={14} /></span><div><strong>{item.title}</strong><span>{item.userName} · {item.type} · {item.channel} · {item.createdAt}{item.actionLabel ? ` · CTA: ${item.actionLabel}` : ''}</span><p className={styles.notificationMessage}>{item.message}</p>{item.lastDeliveryError && <p className={styles.errorInline}>{item.lastDeliveryError}</p>}</div><div><Status value={notificationDeliveryStatus(item)} /><small>{item.read ? 'Read' : 'Unread'}</small></div></div>) : <EmptyState icon={Bell} title="No notification logs" description="App and admin notification records will appear here." />}</div>}</Panel>
  </div>;
}

function NotificationLogsView() {
  const [items, setItems] = useState<AdminNotificationRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [source, setSource] = useState('All');
  const [channel, setChannel] = useState('All');
  const [types, setTypes] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const reload = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const channelValue = channel === 'In-app' ? 'IN_APP' : channel === 'Push' ? 'PUSH' : channel === 'Email' ? 'EMAIL' : channel === 'WhatsApp' ? 'WHATSAPP' : undefined;
      const result = await getAdminNotificationLogs({ take: pageSize, offset: (page - 1) * pageSize, search: query.trim() || undefined, type: filter === 'All' ? undefined : filter, source: source === 'All' ? undefined : source as 'App' | 'Admin', channel: channelValue });
      setItems(result.items); setTotal(result.total); setTypes(result.types);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Notification logs could not be loaded.'); }
    finally { setLoading(false); }
  }, [channel, filter, page, pageSize, query, source]);
  useEffect(() => { const timer = setTimeout(() => void reload(), query ? 250 : 0); return () => clearTimeout(timer); }, [reload, query]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pagination = { page, pageCount, pageSize, pageItems: items, setPage, setPageSize: (value: Parameters<typeof setPageSize>[0]) => { setPage(1); setPageSize(value); } };
  const changeFilter = (value: string) => { setPage(1); setFilter(value); };
  const changeSource = (value: string) => { setPage(1); setSource(value); };
  const changeChannel = (value: string) => { setPage(1); setChannel(value); };
  const openExternalAction = (url: string) => /^https:\/\//i.test(url);
  const columns: Column<AdminNotificationRecord>[] = [
    { key: 'notification', label: 'Notification', locked: true, render: (item) => <div className={styles.entity}><span className={styles.statIcon + ' ' + styles.statBlue}>{item.mediaType === 'image' ? <ImageIcon size={15} /> : item.mediaType === 'video' ? <Video size={15} /> : item.adminChat || item.type === 'CHAT_MESSAGE' ? <MessageCircle size={15} /> : <Bell size={15} />}</span><div className={styles.notificationLogCopy}><div className={styles.entityName}>{item.title}</div><div className={styles.entityMeta}>{item.message}</div>{item.mediaUri && <a className={styles.notificationAttachment} href={resolveAdminMediaUrl(item.mediaUri)} target="_blank" rel="noreferrer">{item.mediaType === 'image' ? <img src={resolveAdminMediaUrl(item.mediaUri)} alt={item.mediaName || 'Notification attachment'} onError={(event) => event.currentTarget.remove()} /> : item.mediaType === 'video' ? <Video size={15} /> : <Paperclip size={15} />}<span>{item.mediaName || (item.mediaType === 'image' ? 'Image attachment' : item.mediaType === 'video' ? 'Video attachment' : 'File attachment')}</span><ExternalLink size={12} /></a>}</div></div> },
    { key: 'recipient', label: 'Recipient', render: (item) => <Button variant="ghost" href={`/admin/users/${item.userId}`}><UserRound size={14} /> {item.userName}</Button> },
    { key: 'type', label: 'Type', render: (item) => item.type },
    { key: 'source', label: 'Source', render: (item) => item.source },
    { key: 'channel', label: 'Channel', render: (item) => item.channel },
    { key: 'action', label: 'Action', render: (item) => item.adminChat || item.type === 'CHAT_MESSAGE' ? <Button variant="ghost" href={`/admin/chats?user=${encodeURIComponent(item.userId)}`}><MessageCircle size={14} /> Open chat</Button> : item.actionLabel && item.actionUrl && openExternalAction(item.actionUrl) ? <a className={styles.linkInline} href={item.actionUrl} target="_blank" rel="noreferrer">{item.actionLabel} <ExternalLink size={12} /></a> : 'None' },
    { key: 'delivery', label: 'Delivery', render: (item) => <Status value={notificationDeliveryStatus(item)} /> },
    { key: 'read', label: 'Inbox', render: (item) => <Status value={item.read ? 'Read' : 'Unread'} /> },
    { key: 'created', label: 'Time', render: (item) => item.createdAt },
  ];
  const [visibleColumns, setVisibleColumns] = useColumns('notification-logs', columns);
  return <Panel title="Notification logs" hint={`${total} matching records · page ${page} of ${pageCount}`} action={<Button variant="primary" href="/admin/notifications"><Send size={14} /> Send notification</Button>}>{error ? <div className={styles.panelBody}><div className={styles.errorInline} role="alert">{error}</div><Button variant="secondary" onClick={() => void reload()}><Activity size={14} /> Retry</Button></div> : <><DataToolbar query={query} setQuery={(value) => { setPage(1); setQuery(value); }} filter={filter} setFilter={changeFilter} options={['All', ...types]} columns={columns} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} extraFilters={[{ key: 'source', label: 'Source', value: source, options: ['All', 'App', 'Admin'], onChange: changeSource }, { key: 'channel', label: 'Channel', value: channel, options: ['All', 'In-app', 'Push', 'Email', 'WhatsApp'], onChange: changeChannel }]} /><DataTable columns={columns} visibleColumns={visibleColumns} items={pagination.pageItems} empty={<EmptyState icon={Bell} title={loading ? 'Loading notification logs' : 'No notification logs found'} description={loading ? 'Fetching the selected page.' : 'Try a different search or notification filter.'} />} /><Pagination {...pagination} total={total} /></>}</Panel>;
}

export function AdminSectionPage({ section }: { section: string }) {
  const { snapshot, error, reload } = useAdminSnapshot();
  const [toast, setToast] = useState<Toast>(null);
  const { role, ready } = useAdminSession();
  const searchParams = useSearchParams();
  const adminRole: AdminRole = role ?? 'Moderator';
  const isOwner = adminRole === 'Owner';
  const config = meta[section];
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 2600); return () => window.clearTimeout(timer); }, [toast]);
  if (!config) return <EmptyState icon={AlertTriangle} title="Page not found" description="This admin section is not available." />;
  if (!ready) return <LoadingPage />;
  if (error) return <LoadFailure message={error} retry={() => void reload()} />;
  if (!snapshot) return <LoadingPage />;
  if (!canAccessSection(adminRole, section)) {
    return <div className={styles.page}><PageHeader eyebrow="Access limited" title="Owner access required" description="This area contains owner-only system controls." /><div className={styles.roleBanner}><ShieldAlert size={16} /><div><strong>Moderator workspace</strong><span>Your current role does not allow access to this section.</span></div></div></div>;
  }
  return <div className={styles.page}><PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} />
    {section === 'users' && <UsersView data={snapshot.users} onToast={setToast} canSuspend={isOwner} />}
    {section === 'campaigns' && <CampaignsView data={snapshot.campaigns} users={snapshot.users} onToast={setToast} reload={reload} />}
    {section === 'proposals' && <ProposalsView />}
    {section === 'app-settings' && <AppSettingsView onToast={setToast} />}
    {section === 'notifications' && <NotificationsView data={snapshot.users} campaigns={snapshot.campaigns} proposals={snapshot.proposals} initialUserId={searchParams.get('user') ?? undefined} />}
    {section === 'notification-logs' && <NotificationLogsView />}
    <ToastMessage message={toast} />
  </div>;
}
