'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Bug, Check, FileText, Flag, Image as ImageIcon, LoaderCircle, MessageCircle, UserRoundCheck, Video, X } from 'lucide-react';
import { getAccountReactivationRequests, getAdminChatReports, resolveAdminMediaUrl, reviewAccountReactivation, type AccountReactivationRequest, type AdminChatReport } from '@/services/adminApi.service';
import styles from './admin-support-reports.module.css';

type Filter = 'ALL' | 'FEEDBACK' | 'BUG_REPORT';

export function AdminSupportReportsPage() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [items, setItems] = useState<AdminChatReport[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'reports' | 'reactivation'>('reports');
  const [requests, setRequests] = useState<AccountReactivationRequest[]>([]);
  const [requestOffset, setRequestOffset] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);

  const load = useCallback(async (kind: Filter, before?: string, append = false) => {
    setLoading(true); setError('');
    try {
      const page = await getAdminChatReports(kind, before);
      setItems((current) => append ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Reports could not be loaded.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { setItems([]); setNextCursor(null); void load(filter); }, [filter, load]);

  const loadReactivations = useCallback(async (offset = 0, append = false) => {
    setLoading(true); setError('');
    try {
      const page = await getAccountReactivationRequests(offset);
      setRequests((current) => append ? [...current, ...page.items] : page.items);
      setRequestOffset(page.nextOffset);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Reactivation requests could not be loaded.'); }
    finally { setLoading(false); }
  }, []);

  const reviewRequest = async (request: AccountReactivationRequest, status: 'APPROVED' | 'REJECTED') => {
    const response = window.prompt(status === 'APPROVED' ? 'Optional message for the user:' : 'Reason for declining this request:');
    if (response === null) return;
    const resolutionNote = response.trim();
    if (status === 'REJECTED' && !resolutionNote) { setError('Add a reason before declining the request.'); return; }
    setReviewing(request.id); setError('');
    try {
      await reviewAccountReactivation(request.id, status, resolutionNote || undefined);
      setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status, resolutionNote: resolutionNote || null, reviewedAt: new Date().toISOString() } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The request could not be reviewed.'); }
    finally { setReviewing(null); }
  };

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}><Flag size={14} /> User support</span><h1>{view === 'reports' ? 'Feedback & bug reports' : 'Reactivation requests'}</h1><p>{view === 'reports' ? 'Reports users sent through their private Brandly chat.' : 'Review suspended account requests. Approval restores account access.'}</p></div>
      <Link href="/admin/chats" className={styles.chatLink}><MessageCircle size={16} /> Open user chats</Link>
    </header>
    <nav className={styles.filters} aria-label="Support section"><button type="button" aria-pressed={view === 'reports'} className={view === 'reports' ? styles.filterActive : ''} onClick={() => setView('reports')}>Reports</button><button type="button" aria-pressed={view === 'reactivation'} className={view === 'reactivation' ? styles.filterActive : ''} onClick={() => { setView('reactivation'); if (!requests.length) void loadReactivations(); }}>Reactivation</button></nav>
    {view === 'reactivation' ? <section className={styles.list} aria-live="polite">
      {requests.map((item) => <article key={item.id} className={styles.card}>
        <div className={styles.cardHeader}><span className={styles.feedbackIcon}><UserRoundCheck size={17} /></span><div className={styles.reporter}><strong>{item.user.profile?.displayName || item.user.email || 'User'}</strong><span>{item.user.role} · {item.user.email || item.userId}</span></div><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</time></div>
        <div className={styles.kind}>Suspension reason</div><p className={styles.message}>{item.user.suspensionReason || 'No reason was recorded.'}</p>
        <div className={styles.kind}>User request</div><p className={styles.message}>{item.message}</p>
        <footer><span>{item.status}{item.reviewedAt ? ` · reviewed ${new Date(item.reviewedAt).toLocaleDateString('en-IN')}` : ''}</span><div className={styles.composerActions}>{item.status === 'PENDING' && <><button className={styles.approve} type="button" disabled={reviewing === item.id} onClick={() => void reviewRequest(item, 'APPROVED')}><Check size={14} /> Approve & reactivate</button><button className={styles.cancel} type="button" disabled={reviewing === item.id} onClick={() => void reviewRequest(item, 'REJECTED')}><X size={14} /> Decline</button></>}<Link href={`/admin/chats?user=${encodeURIComponent(item.userId)}`}><MessageCircle size={14} /> Message user</Link></div></footer>
      </article>)}
      {loading && <div className={styles.state}><LoaderCircle className={styles.spin} size={19} />Loading requests…</div>}
      {!loading && !error && !requests.length && <div className={styles.state}><UserRoundCheck size={21} /><strong>No reactivation requests</strong><span>User requests will appear here after a suspended user signs in and submits one.</span></div>}
      {requestOffset !== null && <button type="button" className={styles.more} disabled={loading} onClick={() => void loadReactivations(requestOffset, true)}>Load more requests</button>}
    </section> : <>
    <nav className={styles.filters} aria-label="Report type">
      {([['ALL', 'All'], ['FEEDBACK', 'Feedback'], ['BUG_REPORT', 'Bug reports']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} className={filter === value ? styles.filterActive : ''} onClick={() => setFilter(value)}>{label}</button>)}
    </nav>
    {error && <div className={styles.error} role="alert">{error}<button type="button" onClick={() => void load(filter)}>Retry</button></div>}
    <section className={styles.list} aria-live="polite">
      {items.map((item) => <article key={item.id} className={styles.card}>
        <div className={styles.cardHeader}><span className={item.type === 'BUG_REPORT' ? styles.bugIcon : styles.feedbackIcon}>{item.type === 'BUG_REPORT' ? <Bug size={17} /> : <MessageCircle size={17} />}</span><div className={styles.reporter}><strong>{item.userName}</strong><span>{item.role}{item.email ? ` · ${item.email}` : ''}</span></div><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</time></div>
        <div className={styles.kind}>{item.type === 'BUG_REPORT' ? 'Bug report' : 'Feedback'}</div>
        <p className={styles.message}>{item.message || 'Attachment only'}</p>
        {item.attachments.length > 0 && <div className={styles.attachments}>
          {item.attachments.map((attachment) => attachment.type === 'image' ? <a key={attachment.id} href={resolveAdminMediaUrl(attachment.uri)} target="_blank" rel="noreferrer" className={styles.image}><img src={resolveAdminMediaUrl(attachment.uri)} alt={attachment.name} onError={(event) => event.currentTarget.remove()} /><span><ImageIcon size={13} />{attachment.name}</span></a> : attachment.type === 'video' ? <a key={attachment.id} href={resolveAdminMediaUrl(attachment.uri)} target="_blank" rel="noreferrer" className={styles.file}><Video size={16} />{attachment.name}</a> : <a key={attachment.id} href={resolveAdminMediaUrl(attachment.uri)} target="_blank" rel="noreferrer" className={styles.file}><FileText size={16} />{attachment.name}</a>)}
        </div>}
        <footer><span>{item.attachments.length ? `${item.attachments.length} attachment${item.attachments.length === 1 ? '' : 's'}` : 'No attachments'}</span><Link href={`/admin/chats?user=${encodeURIComponent(item.userId)}`}><MessageCircle size={14} /> View in chat</Link></footer>
      </article>)}
      {loading && <div className={styles.state}><LoaderCircle className={styles.spin} size={19} />Loading reports…</div>}
      {!loading && !error && !items.length && <div className={styles.state}><Flag size={21} /><strong>No reports yet</strong><span>New feedback and bug reports from users will appear here.</span></div>}
    </section>
    {nextCursor && <button type="button" className={styles.more} disabled={loading} onClick={() => void load(filter, nextCursor, true)}>{loading ? 'Loading…' : 'Load older reports'}</button>}
    </>}
  </main>;
}
