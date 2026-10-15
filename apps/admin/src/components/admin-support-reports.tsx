'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Bug, Check, ChevronLeft, ChevronRight, FileText, Flag, LoaderCircle, MessageCircle, Search, UserRoundCheck, Video, X } from 'lucide-react';
import { getAccountReactivationRequests, getAdminChatReports, resolveAdminMediaUrl, reviewAccountReactivation, type AccountReactivationRequest, type AdminChatReport } from '@/services/adminApi.service';
import styles from './admin-support-reports.module.css';

type Filter = 'ALL' | 'FEEDBACK' | 'BUG_REPORT';

export function AdminSupportReportsPage() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [items, setItems] = useState<AdminChatReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'reports' | 'reactivation'>('reports');
  const [requests, setRequests] = useState<AccountReactivationRequest[]>([]);
  const [requestOffset, setRequestOffset] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);

  useEffect(() => { const timer = window.setTimeout(() => setSearch(query.trim()), 250); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => { setPage(1); }, [filter, search, pageSize]);
  useEffect(() => {
    if (view !== 'reports') return;
    let current = true;
    setLoading(true); setError('');
    void getAdminChatReports({ type: filter, query: search, take: pageSize, offset: (page - 1) * pageSize })
      .then((result) => { if (current) { setItems(result.items); setTotal(result.total); } })
      .catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : 'Reports could not be loaded.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [filter, page, pageSize, refresh, search, view]);

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
    {error && <div className={styles.error} role="alert">{error}<button type="button" onClick={() => setRefresh((value) => value + 1)}>Retry</button></div>}
    <div className={styles.reportToolbar}>
      <label className={styles.search}><Search size={15} /><span className="srOnly">Search reports</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search user, email, or report text" /></label>
      <label className={styles.limit}>Rows<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
    </div>
    <section className={styles.tablePanel} aria-live="polite" aria-busy={loading}>
      {loading ? <div className={styles.state}><LoaderCircle className={styles.spin} size={19} />Loading reports…</div> : items.length === 0 ? <div className={styles.state}><Flag size={21} /><strong>{search ? 'No matching reports' : 'No reports yet'}</strong><span>{search ? 'Try another user, email, or phrase.' : 'New feedback and bug reports from users will appear here.'}</span></div> : <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>Type</th><th>User</th><th>Report</th><th>Attachments</th><th>Received</th><th>Action</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id}>
          <td><span className={`${styles.typeBadge} ${item.type === 'BUG_REPORT' ? styles.typeBug : ''}`}>{item.type === 'BUG_REPORT' ? <Bug size={14} /> : <MessageCircle size={14} />}{item.type === 'BUG_REPORT' ? 'Bug report' : 'Feedback'}</span></td>
          <td><div className={styles.tableUser}><strong>{item.userName}</strong><span>{item.role}{item.email ? ` · ${item.email}` : ''}</span></div></td>
          <td><div className={styles.tableMessage} title={item.message}>{item.message || 'Attachment only'}</div></td>
          <td><div className={styles.tableAttachments}>{item.attachments.length ? item.attachments.slice(0, 3).map((attachment) => attachment.type === 'image' ? <a key={attachment.id} href={resolveAdminMediaUrl(attachment.uri)} target="_blank" rel="noreferrer" title={attachment.name} aria-label={`Open image ${attachment.name}`} className={styles.thumb}><img src={resolveAdminMediaUrl(attachment.uri)} alt={attachment.name} onError={(event) => event.currentTarget.remove()} /></a> : <a key={attachment.id} href={resolveAdminMediaUrl(attachment.uri)} target="_blank" rel="noreferrer" title={attachment.name} className={styles.fileIcon}>{attachment.type === 'video' ? <Video size={15} /> : <FileText size={15} />}</a>) : <span className={styles.noAttachment}>—</span>}{item.attachments.length > 3 && <span className={styles.moreAttachments}>+{item.attachments.length - 3}</span>}</div></td>
          <td><time className={styles.date} dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</time></td>
          <td><Link href={`/admin/chats?user=${encodeURIComponent(item.userId)}`} className={styles.rowAction}><MessageCircle size={14} /> Chat</Link></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
    {total > 0 && <footer className={styles.tableFooter}><span>Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}</span><div><button type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} /></button><span>{page} / {Math.max(1, Math.ceil(total / pageSize))}</span><button type="button" aria-label="Next page" disabled={page >= Math.ceil(total / pageSize) || loading} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></div></footer>}
    </>}
  </main>;
}
