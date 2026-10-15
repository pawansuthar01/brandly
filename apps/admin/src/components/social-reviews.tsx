'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, MessageCircle, RefreshCw, Search, UserRound } from 'lucide-react';
import { getAdminSocialReviewUsers, resolveAdminMediaUrl, type AdminSocialReviewUser } from '@/services/adminApi.service';
import styles from './social-reviews.module.css';

export function SocialReviewsPage() {
  const [users, setUsers] = useState<AdminSocialReviewUser[]>([]);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [take, setTake] = useState(25);
  const [offset, setOffset] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => { setOffset(0); }, [search, take]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void getAdminSocialReviewUsers({ query: search, take, offset })
      .then((result) => { if (active) { setUsers(result.items); setNextOffset(result.nextOffset); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Social review queue could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [offset, reload, search, take]);

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}><BadgeCheck size={14} /> Trust &amp; content</p><h1>Social account reviews</h1><p>One row per person. Open a user to review each account separately.</p></div>
      <button className={styles.refresh} onClick={() => setReload((value) => value + 1)} disabled={loading}><RefreshCw size={15} /> Refresh</button>
    </header>
    {error && <div className={styles.error} role="alert">{error}<button onClick={() => setReload((value) => value + 1)}><RefreshCw size={13} /> Retry</button></div>}
    <section className={styles.filters} aria-label="Search social review users">
      <label className={styles.search}><Search size={16} /><span className="srOnly">Search users and social accounts</span><input value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0); }} placeholder="Search user, email, platform, or handle" /></label>
      <label className={styles.limit}>Rows<select value={take} onChange={(event) => setTake(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
      <span className={styles.resultCount}>{loading ? 'Loading…' : users.length + ' users on this page'}</span>
    </section>

    {loading ? <div className={styles.loading} aria-label="Loading social reviews"><LoaderCircle size={20} className={styles.spin} />Loading review queue…</div> : users.length ? <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr><th>User</th><th>Accounts awaiting review</th><th>Queue status</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody>{users.map((user) => <tr key={user.id}>
          <td><div className={styles.accountCell}><span className={styles.avatar}>{user.name.slice(0, 1).toUpperCase()}{user.avatarUrl && <img src={resolveAdminMediaUrl(user.avatarUrl)} alt="" onError={(event) => event.currentTarget.remove()} />}</span><div className={styles.accountCopy}><strong>{user.name}</strong><span>{user.role} · {user.email || 'No email'}</span><small>{user.city || 'Location not set'} · {user.status}</small></div></div></td>
          <td><strong>{user.pendingCount} pending</strong><span className={styles.cellSub}>{user.platforms.join(' · ')}</span></td>
          <td><span className={styles.syncStatus + ' ' + (user.needsAttention ? styles.syncAttention : styles.syncReady)}>{user.needsAttention ? 'Needs attention' : 'Ready to review'}</span></td>
          <td><time dateTime={user.joinedAt}>{new Date(user.joinedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</time></td>
          <td><div className={styles.rowActions}>
            <Link className={styles.detailsLink} href={'/admin/social-reviews/' + encodeURIComponent(user.id)}><UserRound size={14} /> Review accounts <ExternalLink size={12} /></Link>
            <Link className={styles.iconAction} href={'/admin/chats?user=' + encodeURIComponent(user.id)} aria-label={'Chat with ' + user.name} title="Open user chat"><MessageCircle size={15} /></Link>
          </div></td>
        </tr>)}</tbody>
      </table>
    </div> : <div className={styles.empty}><BadgeCheck size={24} /><strong>{search ? 'No matching users' : 'No pending social reviews'}</strong><span>{search ? 'Try a name, email, platform, or handle.' : 'Users awaiting social account verification will appear here.'}</span></div>}

    <footer className={styles.pagination}><span>{users.length ? 'Users ' + (offset + 1) + '–' + (offset + users.length) + (nextOffset !== null ? '+' : '') : 'No pending users'}</span><div><button aria-label="Previous page" onClick={() => setOffset((value) => Math.max(0, value - take))} disabled={loading || offset === 0}><ChevronLeft size={17} /></button><button aria-label="Next page" onClick={() => nextOffset !== null && setOffset(nextOffset)} disabled={loading || nextOffset === null}><ChevronRight size={17} /></button></div></footer>
  </main>;
}
