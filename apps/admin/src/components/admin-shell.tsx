'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Activity, Bell, BriefcaseBusiness, ChevronRight, MessageCircle, BadgeCheck, Flag,
  FileText, LayoutDashboard, LogOut, Menu, Moon, PanelLeftClose,
  PanelLeftOpen, Palette, Settings2, Sun, Tags, Users, X,
} from 'lucide-react';
import styles from './admin-shell.module.css';
import { canAccessSection, clearAdminSession, type AdminRole } from '@/lib/admin-auth';
import { useAdminSession } from '@/hooks/useAdminSession';
import { getAdminNotifications } from '@/services/adminApi.service';
import type { AdminNotificationRecord } from '@/types/admin';
import { setNotificationsOpen, setTheme, toggleSidebar, type AdminRootState } from '@/store/store';

const groups = [
  { label: 'Overview', links: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard, section: 'dashboard' }] },
  {
    label: 'Marketplace',
    links: [
      { label: 'Users & profiles', href: '/admin/users', icon: Users, section: 'users' },
      { label: 'Campaigns', href: '/admin/campaigns', icon: BriefcaseBusiness, section: 'campaigns' },
      { label: 'Proposals', href: '/admin/proposals', icon: FileText, section: 'proposals' },
      { label: 'Categories', href: '/admin/categories', icon: Tags, section: 'categories' },
    ],
  },
  {
    label: 'Trust & content',
    links: [
      { label: 'Notifications', href: '/admin/notifications', icon: Bell, section: 'notifications' },
      { label: 'User chats', href: '/admin/chats', icon: MessageCircle, section: 'chats' },
      { label: 'Feedback & reports', href: '/admin/reports', icon: Flag, section: 'chats' },
      { label: 'Social reviews', href: '/admin/social-reviews', icon: BadgeCheck, section: 'social-reviews' },
      { label: 'Notification logs', href: '/admin/notification-logs', icon: Activity, section: 'notification-logs' },
    ],
  },
  {
    label: 'System',
    links: [
      { label: 'App settings', href: '/admin/app-settings', icon: Settings2, section: 'app-settings' },
      { label: 'Themes', href: '/admin/themes', icon: Palette, section: 'themes' },
    ],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { session, ready, role } = useAdminSession();
  const [recentNotifications, setRecentNotifications] = useState<AdminNotificationRecord[]>([]);
  const [notificationError, setNotificationError] = useState('');
  const [notificationLoading, setNotificationLoading] = useState(true);
  const loadRecentNotifications = () => getAdminNotifications()
    .then((items) => { setRecentNotifications(items); setNotificationError(''); })
    .catch((error: unknown) => setNotificationError(error instanceof Error ? error.message : 'Could not load recent notifications.'))
    .finally(() => setNotificationLoading(false));
  useEffect(() => {
    if (!session?.accessToken) return;
    void loadRecentNotifications();
  }, [session?.accessToken]);
  const { sidebarCollapsed: collapsed, theme, notificationsOpen } = useSelector((state: AdminRootState) => state.ui);
  const dark = theme === 'dark';
  const toggleTheme = () => dispatch(setTheme(dark ? 'light' : 'dark'));
  const activeRole: AdminRole = role ?? 'Moderator';
  const visibleGroups = groups
    .map((group) => ({ ...group, links: group.links.filter((item) => item.section === 'dashboard' || canAccessSection(activeRole, item.section)) }))
    .filter((group) => group.links.length > 0);

  const signOut = () => {
    clearAdminSession();
    router.replace('/admin/login');
  };

  if (!ready || !session) {
    return <div className={styles.shell} />;
  }

  return (
    <div className={styles.shell}>
      {mobileOpen && <button className={styles.mobileOverlay} aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''} ${mobileOpen ? styles.sidebarOpen : ''}`} aria-label="Admin navigation">
        <div className={styles.brand}>
          <div className={styles.brandMark}>B</div>
          {!collapsed && <div><div className={styles.brandName}>brandly</div><div className={styles.brandCaption}>operations console</div></div>}
          <button className={`${styles.iconButton} ${styles.mobileMenu}`} aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={17} /></button>
        </div>
        <nav className={styles.nav}>
          {visibleGroups.map((group) => (
            <div className={styles.navGroup} key={group.label}>
              {!collapsed && <div className={styles.navLabel}>{group.label}</div>}
              {group.links.map((item) => {
                const Icon = item.icon;
                const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`} title={collapsed ? item.label : undefined}>
                  <Icon className={styles.navIcon} size={17} strokeWidth={active ? 2.4 : 1.9} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>;
              })}
            </div>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>{collapsed ? activeRole : `${activeRole} workspace · v1.0`}</div>
      </aside>
      <div className={`${styles.main} ${collapsed ? styles.mainCollapsed : ''} ${pathname === '/admin/themes' ? styles.mainTheme : ''}`}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={`${styles.iconButton} ${styles.mobileMenu}`} aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={18} /></button>
            <button className={`${styles.iconButton} ${styles.desktopCollapse}`} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={() => dispatch(toggleSidebar())}><span className="srOnly">Toggle sidebar</span>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
            <div className={styles.topbarContext}><strong>Admin control</strong><ChevronRight size={14} className={styles.breadcrumbIcon} />{pathname === '/admin' ? 'Overview' : pathname.split('/').pop()?.replaceAll('-', ' ')}</div>
          </div>
          <div className={styles.topbarRight}>
          <button className={`${styles.iconButton} ${notificationsOpen ? styles.iconButtonActive : ''}`} aria-label="View recent notification deliveries" aria-expanded={notificationsOpen} onClick={() => dispatch(setNotificationsOpen(!notificationsOpen))}><Bell size={17} />{recentNotifications.length > 0 && <span className={styles.notificationDot} />}</button>
            <button className={styles.iconButton} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
            <div className={styles.adminUser}>
              <div className={styles.adminAvatar}>AT</div>
              <div><div className={styles.adminName}>{session.email.split('@')[0]}</div><div className={`${styles.adminRole} ${activeRole === 'Owner' ? styles.adminRoleOwner : styles.adminRoleModerator}`}>{activeRole === 'Owner' ? 'Owner · full access' : 'Moderator · trust access'}</div></div>
              <button className={styles.iconButton} aria-label="Sign out" onClick={signOut}><LogOut size={16} /></button>
            </div>
          </div>
          {notificationsOpen && <div className={styles.notificationPanel} role="dialog" aria-label="Recent notification deliveries"><div className={styles.notificationHeader}><div><strong>Recent deliveries</strong><span>Saved notification records</span></div><button className={styles.notificationClose} onClick={() => dispatch(setNotificationsOpen(false))} aria-label="Close notifications"><X size={16} /></button></div><div className={styles.notificationList}>{notificationLoading ? <div className={styles.notificationItem}><span>Loading notification records…</span></div> : notificationError ? <div className={styles.notificationItem} role="alert"><span>{notificationError}</span></div> : recentNotifications.slice(0, 5).map((notification) => <Link href="/admin/notification-logs" className={styles.notificationItem} key={notification.id} onClick={() => dispatch(setNotificationsOpen(false))}><span className={`${styles.notificationIcon} ${styles.notificationBlue}`}><Bell size={14} /></span><div><strong>{notification.title}</strong><p>{notification.userName} · {notification.channel}</p><span>{new Date(notification.createdAt).toLocaleString()}</span></div><ChevronRight size={14} className={styles.notificationArrow} /></Link>)}{!notificationLoading && !notificationError && recentNotifications.length === 0 && <div className={styles.notificationItem}><span>No notification records found.</span></div>}</div>{notificationError ? <button className={styles.notificationFooter} onClick={() => { setNotificationLoading(true); void loadRecentNotifications(); }}><Activity size={14} /> Retry</button> : <Link href="/admin/notification-logs" className={styles.notificationFooter} onClick={() => dispatch(setNotificationsOpen(false))}>View delivery logs <ChevronRight size={14} /></Link>}</div>}
        </header>
        <main className={`${styles.content} ${pathname === '/admin/themes' ? styles.contentTheme : ''}`}>{children}</main>
      </div>
    </div>
  );
}
