'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, BadgeCheck, Bell, Check, ChevronLeft, ChevronRight, ExternalLink, MessageCircle, RefreshCw, Send, Shield, UserRound, X } from 'lucide-react';
import { getAdminSocialReviews, resolveAdminMediaUrl, reviewAdminSocialAccount, sendAdminNotification, suspendUser, type AdminSocialReview } from '@/services/adminApi.service';
import styles from './social-reviews.module.css';

type Readiness = 'all' | 'ready' | 'attention';

export function SocialReviewsPage() {
  const [items, setItems] = useState<AdminSocialReview[]>([]);
  const [offset, setOffset] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [accountBusyId, setAccountBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('all');
  const [role, setRole] = useState('all');
  const [readiness, setReadiness] = useState<Readiness>('all');
  const [notifyFor, setNotifyFor] = useState<string | null>(null);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);

  const load = useCallback(async (next = 0) => {
    setLoading(true); setError('');
    try {
      const result = await getAdminSocialReviews(next);
      setItems(result.items); setOffset(next); setNextOffset(result.nextOffset);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Social reviews could not be loaded.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      const searchable = [item.user.name, item.user.email, item.handle, item.displayName, item.platform, item.user.city].filter(Boolean).join(' ').toLowerCase();
      const needsAttention = Boolean(item.syncError) || item.syncStatus.toUpperCase() !== 'SYNCED';
      return (!needle || searchable.includes(needle))
        && (platform === 'all' || item.platform === platform)
        && (role === 'all' || item.user.role === role)
        && (readiness === 'all' || (readiness === 'attention' ? needsAttention : !needsAttention));
    });
  }, [items, platform, readiness, role, search]);
  const platforms = useMemo(() => Array.from(new Set(items.map((item) => item.platform))).sort(), [items]);

  const review = async (item: AdminSocialReview) => {
    setBusyId(item.id); setNotice(''); setError('');
    try {
      const result = await reviewAdminSocialAccount(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setNotifyFor((current) => current === item.id ? null : current);
      setNotice(`${item.platform} approved for ${item.user.name}.${result.notificationQueued ? ' User notification queued.' : ' Review saved, but the notification could not be queued.'}`);
      if (items.length === 1 && offset > 0) await load(Math.max(0, offset - 25));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The review could not be saved. Refresh and try again.');
    } finally { setBusyId(null); }
  };

  const toggleAccountAccess = async (item: AdminSocialReview) => {
    const suspended = item.user.status === 'SUSPENDED';
    const reason = suspended ? undefined : window.prompt(`Reason for suspending ${item.user.name} (at least 5 characters):`)?.trim();
    if (!suspended && (!reason || reason.length < 5)) return;
    if (suspended && !window.confirm(`Restore marketplace access for ${item.user.name}?`)) return;
    setAccountBusyId(item.id); setError(''); setNotice('');
    try {
      await suspendUser(item.user.id, !suspended, reason);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, user: { ...entry.user, status: suspended ? 'ACTIVE' : 'SUSPENDED' } } : entry));
      setNotice(`${item.user.name}'s account access ${suspended ? 'restored' : 'suspended'}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update account access.');
    } finally { setAccountBusyId(null); }
  };

  const openNotification = (item: AdminSocialReview) => {
    setNotifyFor((current) => current === item.id ? null : item.id);
    setNotifyTitle(`${item.platform} account review`);
    setNotifyMessage(''); setNotice(''); setError('');
  };

  const sendNotification = async (item: AdminSocialReview) => {
    if (!notifyTitle.trim() || !notifyMessage.trim()) return;
    setSendingNotification(true); setNotice(''); setError('');
    try {
      const result = await sendAdminNotification({ userId: item.user.id, title: notifyTitle.trim(), message: notifyMessage.trim(), channel: 'Push' });
      setNotifyFor(null); setNotifyTitle(''); setNotifyMessage('');
      setNotice(`Notification request finished for ${item.user.name}: ${result.completed} saved, ${result.failed} send errors. Push delivery: ${result.delivery.delivered} delivered, ${result.delivery.pending} pending, ${result.delivery.failed} failed.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Notification could not be sent.');
    } finally { setSendingNotification(false); }
  };

  const clearFilters = () => { setSearch(''); setPlatform('all'); setRole('all'); setReadiness('all'); };
  const hasFilters = Boolean(search || platform !== 'all' || role !== 'all' || readiness !== 'all');

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}><BadgeCheck size={14} /> Trust &amp; content</p><h1>Social account reviews</h1><p>Check the profile, message the user if needed, then approve in one click.</p></div>
      <button className={styles.refresh} onClick={() => void load(offset)} disabled={loading}><RefreshCw size={15} /> Refresh</button>
    </header>
    {notice && <div className={styles.notice} role="status"><Check size={16} />{notice}</div>}
    {error && <div className={styles.error} role="alert"><Activity size={16} />{error}<button onClick={() => void load(offset)}><RefreshCw size={13} /> Retry</button></div>}

    <section className={styles.filters} aria-label="Filter review queue">
      <label className={styles.search}><UserRound size={16} /><input aria-label="Search reviews" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, handle, city…" /></label>
      <label className={styles.filterField}><span>Platform</span><select value={platform} onChange={(event) => setPlatform(event.target.value)}><option value="all">All platforms</option>{platforms.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className={styles.filterField}><span>Account</span><select value={role} onChange={(event) => setRole(event.target.value)}><option value="all">All account types</option><option value="Creator">Creators</option><option value="Brand">Brands</option></select></label>
      <label className={styles.filterField}><span>Sync</span><select value={readiness} onChange={(event) => setReadiness(event.target.value as Readiness)}><option value="all">All pending</option><option value="ready">Ready</option><option value="attention">Needs attention</option></select></label>
      {hasFilters && <button className={styles.clearFilters} onClick={clearFilters}><X size={14} /> Clear</button>}
      <span className={styles.resultCount}>{filteredItems.length} shown · {items.length} loaded</span>
    </section>

    {loading ? <div className={styles.loading} aria-label="Loading social reviews"><span /><span /><span /></div> : filteredItems.length ? <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr><th>Account</th><th>Social profile</th><th>Audience</th><th>Submitted</th><th>Sync</th><th>Actions</th></tr></thead>
        <tbody>{filteredItems.map((item) => <Fragment key={item.id}>
          <tr>
            <td><div className={styles.accountCell}><span className={styles.avatar}>{item.user.name.slice(0, 1).toUpperCase()}{item.user.avatarUrl && <img src={resolveAdminMediaUrl(item.user.avatarUrl)} alt="" onError={(event) => event.currentTarget.remove()} />}</span><div className={styles.accountCopy}><strong>{item.user.name}</strong><span>{item.user.role} · {item.user.email || 'No email'}</span><small>{item.user.city || 'Location not set'} · Profile {item.user.profileCompleted}%</small></div></div></td>
            <td><div className={styles.socialCell}>{item.profileImageUrl && <img className={styles.socialAvatar} src={resolveAdminMediaUrl(item.profileImageUrl)} alt="" onError={(event) => event.currentTarget.remove()} />}<div><strong>{item.displayName || item.handle}</strong><span>{item.platform} · {item.handle}</span>{item.contentRequest && <a href={item.contentRequest.contentUrl} target="_blank" rel="noreferrer">View submitted proof <ExternalLink size={12} /></a>}</div></div></td>
            <td><strong>{item.followerCount?.toLocaleString() ?? '—'}</strong><span className={styles.cellSub}>{item.postCount?.toLocaleString() ?? '—'} posts</span></td>
            <td><span>{new Date(item.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span><span className={styles.cellSub}>{new Date(item.user.joinedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })} joined</span></td>
            <td><span className={`${styles.syncStatus} ${item.syncError || item.syncStatus.toUpperCase() !== 'SYNCED' ? styles.syncAttention : styles.syncReady}`}>{item.syncError ? 'Needs attention' : item.syncStatus}</span>{item.syncError && <span className={styles.cellSub}>{item.syncError}</span>}</td>
            <td><div className={styles.rowActions}>
              <Link className={styles.iconAction} href={`/admin/chats?user=${encodeURIComponent(item.user.id)}`} aria-label={`Chat with ${item.user.name}`} title="Chat with user"><MessageCircle size={15} /></Link>
              {item.profileUrl && <a className={styles.iconAction} href={item.profileUrl} target="_blank" rel="noreferrer" aria-label={`Open ${item.user.name}'s social profile`} title="Open social profile"><ExternalLink size={15} /></a>}
              <button className={styles.iconAction} onClick={() => openNotification(item)} disabled={item.user.status !== 'ACTIVE'} aria-label={`Send notification to ${item.user.name}`} title={item.user.status === 'ACTIVE' ? 'Send push notification' : 'Restore account access to send a notification'}><Bell size={15} /></button>
              <button className={styles.iconAction} onClick={() => void toggleAccountAccess(item)} disabled={accountBusyId !== null} aria-label={item.user.status === 'SUSPENDED' ? 'Restore account access' : 'Suspend account access'} title={item.user.status === 'SUSPENDED' ? 'Restore access' : 'Suspend access'}><Shield size={15} /></button>
              <button className={styles.approve} onClick={() => void review(item)} disabled={busyId !== null || item.user.status === 'SUSPENDED'} title={item.user.status === 'SUSPENDED' ? 'Restore account access before approval' : 'Approve this social account'}>{busyId === item.id ? <RefreshCw className={styles.spin} size={14} /> : <Check size={14} />} Approve</button>
              <Link className={styles.detailsLink} href={`/admin/users/${item.user.id}`}><UserRound size={13} /> Details</Link>
            </div></td>
          </tr>
          {notifyFor === item.id && <tr key={`${item.id}-notification`} className={styles.notificationRow}><td colSpan={6}><div className={styles.composer}>
            <div className={styles.composerTitle}><div><strong><Bell size={15} /> Push notification for {item.user.name}</strong><span>Sent directly from this review row.</span></div><button className={styles.iconAction} onClick={() => setNotifyFor(null)} aria-label="Close notification form"><X size={15} /></button></div>
            <label className={styles.formField}>Title<input value={notifyTitle} maxLength={160} onChange={(event) => setNotifyTitle(event.target.value)} placeholder="Short notification title" /></label>
            <label className={styles.formField}>Message<textarea value={notifyMessage} maxLength={2000} onChange={(event) => setNotifyMessage(event.target.value)} placeholder="Write what the user should check or update." /></label>
            <div className={styles.composerActions}><button className={styles.cancel} onClick={() => setNotifyFor(null)}><X size={14} /> Cancel</button><button className={styles.send} disabled={sendingNotification || !notifyTitle.trim() || !notifyMessage.trim()} onClick={() => void sendNotification(item)}>{sendingNotification ? <RefreshCw className={styles.spin} size={14} /> : <Send size={14} />} Send notification</button></div>
          </div></td></tr>}
        </Fragment>)}</tbody>
      </table>
    </div> : <div className={styles.empty}><BadgeCheck size={24} /><strong>{items.length ? 'No reviews match these filters' : 'No pending social reviews'}</strong><span>{items.length ? 'Clear or change a filter to see the pending review queue.' : 'New accounts waiting for social verification will appear here.'}</span>{hasFilters && <button onClick={clearFilters}><X size={14} /> Clear filters</button>}</div>}

    <footer className={styles.pagination}><span>{items.length ? `Page records ${offset + 1}–${offset + items.length}${nextOffset !== null ? '+' : ''}` : 'No pending items'}</span><div><button aria-label="Previous page" onClick={() => void load(Math.max(0, offset - 25))} disabled={loading || offset === 0}><ChevronLeft size={17} /></button><button aria-label="Next page" onClick={() => nextOffset !== null && void load(nextOffset)} disabled={loading || nextOffset === null}><ChevronRight size={17} /></button></div></footer>
  </main>;
}
