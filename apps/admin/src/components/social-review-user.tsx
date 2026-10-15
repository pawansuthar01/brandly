'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, BadgeCheck, Bell, Check, ExternalLink, LoaderCircle, MessageCircle, RefreshCw, Send, ShieldCheck, UserRound } from 'lucide-react';
import { getAdminSocialReviewUser, resolveAdminMediaUrl, reviewAdminSocialAccount, sendAdminNotification, type AdminSocialReviewAccount, type AdminSocialReviewUserDetail } from '@/services/adminApi.service';
import styles from './social-reviews.module.css';

export function SocialReviewUserPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const [data, setData] = useState<AdminSocialReviewUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [followerCounts, setFollowerCounts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [notifyFor, setNotifyFor] = useState<string | null>(null);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await getAdminSocialReviewUser(userId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Social accounts could not be loaded.'); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const approve = async (account: AdminSocialReviewAccount) => {
    setBusyId(account.id); setError(''); setNotice('');
    try {
      const rawCount = followerCounts[account.id]?.trim();
      const followerCount = rawCount ? Number(rawCount) : undefined;
      if (rawCount && (!Number.isSafeInteger(followerCount) || followerCount! < 0 || followerCount! > 100_000_000)) throw new Error('Enter a whole follower count from 0 to 100,000,000.');
      const result = await reviewAdminSocialAccount(account.id, followerCount);
      setNotice(account.platform + ' account approved. ' + (result.notificationQueued ? 'The user was notified.' : 'Approval saved, but notification could not be queued.'));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Approval failed. Refresh and try again.'); }
    finally { setBusyId(null); }
  };

  const openNotifier = (account: AdminSocialReviewAccount) => {
    setNotifyFor(account.id);
    const proof = account.contentRequest?.contentType;
    setNotifyMessage('Please update your ' + account.platform + ' account (' + account.handle + ') so we can verify it. ' + (proof ? 'The submitted ' + proof + ' proof must open publicly and match this account.' : 'Please submit a public profile or post link that clearly belongs to this account.') + ' Reply in Brandly chat if you need help.');
    setNotice(''); setError('');
  };

  const sendNotice = async (account: AdminSocialReviewAccount) => {
    if (!notifyMessage.trim()) return;
    setSending(true); setError(''); setNotice('');
    try {
      const result = await sendAdminNotification({
        userId, title: account.platform + ' account needs an update', message: notifyMessage.trim(),
        type: 'SOCIAL_VERIFICATION', actionLabel: 'Open social accounts', actionUrl: 'brandly://social-accounts',
        data: { screen: 'Notifications', socialPlatform: account.platform, socialAccountId: account.id, socialHandle: account.handle, verificationStatus: 'PENDING' },
      });
      setNotifyFor(null);
      setNotice('Update request sent to ' + data?.user.name + '. Push delivery: ' + result.delivery.delivered + ' delivered, ' + result.delivery.pending + ' pending, ' + result.delivery.failed + ' failed.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Notification could not be sent.'); }
    finally { setSending(false); }
  };

  return <main className={styles.page}>
    <Link className={styles.backLink} href="/admin/social-reviews"><ArrowLeft size={15} /> Social reviews</Link>
    {loading ? <div className={styles.loading}><LoaderCircle size={20} className={styles.spin} />Loading user accounts…</div> : error && !data ? <div className={styles.empty}><AlertCircle size={22} /><strong>Could not open social reviews</strong><span>{error}</span><button onClick={() => void load()}><RefreshCw size={14} /> Try again</button></div> : data ? <>
      <header className={styles.detailHeader}>
        <div className={styles.accountCell}><span className={styles.avatar}>{data.user.name.slice(0, 1).toUpperCase()}{data.user.avatarUrl && <img src={resolveAdminMediaUrl(data.user.avatarUrl)} alt="" onError={(event) => event.currentTarget.remove()} />}</span><div className={styles.accountCopy}><p className={styles.eyebrow}><UserRound size={13} /> {data.user.role} · {data.user.status}</p><h1>{data.user.name}</h1><span>{data.user.email || data.user.phone || 'Contact details unavailable'} · {data.user.city || 'Location not set'}</span></div></div>
        <Link className={styles.chatButton} href={'/admin/chats?user=' + encodeURIComponent(userId)}><MessageCircle size={15} /> Chat with user</Link>
      </header>
      {notice && <div className={styles.notice} role="status"><Check size={16} />{notice}</div>}
      {error && <div className={styles.error} role="alert"><AlertCircle size={16} />{error}<button onClick={() => void load()}><RefreshCw size={13} /> Refresh</button></div>}
      <div className={styles.sectionHeading}><div><h2>Social accounts</h2><p>Review proof and approve each platform independently.</p></div><span>{data.accounts.filter((item) => item.verificationStatus === 'PENDING').length} pending</span></div>
      {data.accounts.length ? <section className={styles.accountCards}>{data.accounts.map((account) => <article className={styles.accountCard} key={account.id}>
        <header className={styles.accountCardHeader}><div><span className={styles.eyebrow}><BadgeCheck size={13} /> {account.platform}</span><h3>{account.displayName || account.handle}</h3><a href={account.profileUrl || undefined} target="_blank" rel="noreferrer">{account.handle} <ExternalLink size={12} /></a></div><span className={styles.syncStatus + ' ' + (account.verificationStatus === 'PENDING' && (account.syncError || account.syncStatus !== 'SYNCED') ? styles.syncAttention : styles.syncReady)}>{account.verificationStatus.replace('_', ' ')}</span></header>
        <div className={styles.accountMetrics}><span><strong>{account.followerCount?.toLocaleString() || '—'}</strong> followers</span><span><strong>{account.postCount?.toLocaleString() || '—'}</strong> posts</span><span><strong>{account.syncStatus}</strong> sync</span></div>
        {account.profileImageUrl && <img className={styles.accountImage} src={resolveAdminMediaUrl(account.profileImageUrl)} alt={account.displayName || account.handle} onError={(event) => event.currentTarget.remove()} />}
        {account.syncError && <p className={styles.syncError}><AlertCircle size={14} /> {account.syncError}</p>}
        {account.verificationStatus === 'PENDING' && <label className={styles.formField}>Verified follower count <input type="number" inputMode="numeric" min="0" max="100000000" step="1" placeholder="Optional · check public profile" value={followerCounts[account.id] ?? (account.followerCount === null ? '' : String(account.followerCount))} onChange={(event) => setFollowerCounts((current) => ({ ...current, [account.id]: event.target.value }))} /><span>Entering the count you checked records it for campaign minimums; blank counts do not qualify.</span></label>}
        {account.contentRequest ? <div className={styles.proofCard}><div><strong>{account.contentRequest.contentType} proof</strong><span>Submitted {new Date(account.contentRequest.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span></div><a href={account.contentRequest.contentUrl} target="_blank" rel="noreferrer">Open proof <ExternalLink size={13} /></a></div> : account.verificationStatus === 'PENDING' ? <p className={styles.helper}>No pending proof link. Ask the user to submit a public profile or post link.</p> : null}
        <div className={styles.accountActions}>
          {account.verificationStatus === 'PENDING' && <button className={styles.secondaryAction} onClick={() => openNotifier(account)} disabled={data.user.status !== 'ACTIVE'} title={data.user.status !== 'ACTIVE' ? 'Restore account access before notifying' : 'Send this account-specific update request'}><Bell size={14} /> Request update</button>}
          {account.verificationStatus === 'PENDING' && <button className={styles.approve} onClick={() => void approve(account)} disabled={busyId !== null || data.user.status !== 'ACTIVE'}>{busyId === account.id ? <RefreshCw className={styles.spin} size={14} /> : <ShieldCheck size={14} />} Approve account</button>}
        </div>
        {notifyFor === account.id && <form className={styles.notifyForm} onSubmit={(event) => { event.preventDefault(); void sendNotice(account); }}>
          <strong><Bell size={15} /> Notification for {account.platform} · {account.handle}</strong><label className={styles.formField}>Message<textarea maxLength={2000} required value={notifyMessage} onChange={(event) => setNotifyMessage(event.target.value)} /></label><div className={styles.composerActions}><button type="button" className={styles.cancel} onClick={() => setNotifyFor(null)}>Cancel</button><button className={styles.send} disabled={sending || !notifyMessage.trim()}>{sending ? <RefreshCw className={styles.spin} size={14} /> : <Send size={14} />} Send notification</button></div>
        </form>}
      </article>)}</section> : <div className={styles.empty}><BadgeCheck size={22} /><strong>No social accounts found</strong><span>This user has no connected social accounts.</span></div>}
    </> : null}
  </main>;
}
