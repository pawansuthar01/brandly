'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, BadgeCheck, CheckCheck, Circle, ExternalLink, FileText, Image as ImageIcon, LoaderCircle, Maximize2, MessageCircle, Minimize2, Paperclip, Search, SearchX, Send, UserRound, Video } from 'lucide-react';
import { getAdminChatMessages, getAdminChatSocketUrl, getAdminChatUsers, heartbeatAdminChat, markAdminChatRead, openAdminChat, resolveAdminMediaUrl, sendAdminChatMessage, uploadAdminChatAttachment, type AdminChatMessage, type AdminChatSnapshot, type AdminChatUser } from '@/services/adminApi.service';
import styles from './admin-chat.module.css';

export function AdminChatPage() {
  const [users, setUsers] = useState<AdminChatUser[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AdminChatUser | null>(null);
  const [thread, setThread] = useState<AdminChatSnapshot | null>(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const conversationRef = useRef<string | null>(null);
  const openRequestRef = useRef(0);
  const workspaceRef = useRef<HTMLElement>(null);
  const requestedUserOpened = useRef('');
  const requestedUserId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const followMessagesRef = useRef(true);
  const previousMessageCountRef = useRef<{ conversationId: string | null; count: number }>({ conversationId: null, count: 0 });
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  conversationRef.current = thread?.conversationId ?? null;

  const loadUsers = useCallback(async (search: string, offset = 0, append = false) => {
    setLoadingUsers(true); setListError('');
    try {
      const result = await getAdminChatUsers(search, offset);
      setUsers((current) => append ? [...current, ...result.items.filter((item) => !current.some((saved) => saved.id === item.id))] : result.items);
      setNextOffset(result.nextOffset);
    } catch (cause) { setListError(cause instanceof Error ? cause.message : 'Users could not be loaded.'); }
    finally { setLoadingUsers(false); }
  }, []);

  useEffect(() => { if (requestedUserId.current === null) requestedUserId.current = new URLSearchParams(window.location.search).get('user'); const timer = window.setTimeout(() => void loadUsers(query || requestedUserId.current || ''), 250); return () => window.clearTimeout(timer); }, [loadUsers, query]);

  const openThread = useCallback(async (user: AdminChatUser) => {
    const requestId = ++openRequestRef.current;
    setSelected(user); setError(''); setLoadingThread(true); setThread(null); setText('');
    try {
      const opened = await openAdminChat(user.id);
      const snapshot = await getAdminChatMessages(opened.conversationId);
      if (requestId !== openRequestRef.current) return;
      setThread(snapshot);
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, conversationId: snapshot.conversationId, unreadCount: 0 } : item));
      await markAdminChatRead(snapshot.conversationId);
      void heartbeatAdminChat(snapshot.conversationId).catch(() => undefined);
    } catch (cause) { if (requestId === openRequestRef.current) setError(cause instanceof Error ? cause.message : 'Conversation could not be opened.'); }
    finally { if (requestId === openRequestRef.current) setLoadingThread(false); }
  }, []);

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === workspaceRef.current);
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === workspaceRef.current) await document.exitFullscreen();
      else await workspaceRef.current?.requestFullscreen();
    } catch { setError('Fullscreen mode is unavailable in this browser.'); }
  };

  useEffect(() => {
    const userId = new URLSearchParams(window.location.search).get('user');
    if (!userId || loadingUsers || requestedUserOpened.current === userId) return;
    const user = users.find((item) => item.id === userId);
    if (!user) return;
    requestedUserOpened.current = userId;
    void openThread(user);
  }, [loadingUsers, openThread, users]);

  useEffect(() => {
    if (!thread?.conversationId) return;
    const pulse = () => void heartbeatAdminChat(thread.conversationId).catch(() => undefined);
    pulse();
    const timer = window.setInterval(pulse, 30_000);
    return () => window.clearInterval(timer);
  }, [thread?.conversationId]);

  useEffect(() => {
    let active = true; let socket: WebSocket | null = null; let retry: number | undefined;
    const connect = () => {
      const url = getAdminChatSocketUrl();
      if (!url || !active) return;
      try { socket = new WebSocket(url); } catch { retry = window.setTimeout(connect, 5_000); return; }
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as { type?: string; channel?: string; conversationId?: string; userId?: string; online?: boolean; message?: AdminChatMessage; readerId?: string };
          if (payload.channel !== 'ADMIN_CHAT' || !payload.conversationId) return;
          if (payload.type === 'presence') {
            if (payload.userId) setUsers((current) => current.map((user) => user.id === payload.userId ? { ...user, online: Boolean(payload.online) } : user));
            setThread((current) => !current || current.conversationId !== payload.conversationId ? current : { ...current, online: Boolean(payload.online) });
          }
          if (payload.type === 'message.created' && payload.message) {
            const message = payload.message;
            setThread((current) => !current || current.conversationId !== payload.conversationId || current.messages.some((item) => item.id === message.id)
              ? current
              : { ...current, messages: [...current.messages, message] });
            setUsers((current) => current.map((user) => user.conversationId === payload.conversationId ? { ...user, preview: payload.message!.text || 'Sent an attachment', updatedAt: payload.message!.createdAt, unreadCount: payload.message!.mine ? user.unreadCount : user.unreadCount + 1 } : user));
            if (conversationRef.current === payload.conversationId && !payload.message.mine) void markAdminChatRead(payload.conversationId).catch(() => undefined);
          }
          if (payload.type === 'conversation.read' && payload.readerId) {
            setThread((current) => !current || current.conversationId !== payload.conversationId ? current : { ...current, messages: current.messages.map((item) => item.mine ? { ...item, status: 'seen', readAt: new Date().toISOString() } : item) });
          }
        } catch { /* Invalid socket payloads do not affect the saved conversation. */ }
      };
      socket.onclose = () => { if (active) retry = window.setTimeout(connect, 5_000); };
    };
    connect();
    return () => { active = false; if (retry) window.clearTimeout(retry); socket?.close(); };
  }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    window.requestAnimationFrame(() => {
      const pane = scrollRef.current;
      if (pane) pane.scrollTo({ top: pane.scrollHeight, behavior });
    });
  }, []);

  useEffect(() => {
    const conversationId = thread?.conversationId ?? null;
    const count = thread?.messages.length ?? 0;
    const previous = previousMessageCountRef.current;
    if (!conversationId) {
      previousMessageCountRef.current = { conversationId: null, count: 0 };
      followMessagesRef.current = true;
      setNewMessageCount(0);
      return;
    }
    if (previous.conversationId !== conversationId) {
      previousMessageCountRef.current = { conversationId, count };
      followMessagesRef.current = true;
      setNewMessageCount(0);
      scrollToLatest('instant');
      return;
    }
    const added = Math.max(0, count - previous.count);
    previousMessageCountRef.current = { conversationId, count };
    if (!added) return;
    if (followMessagesRef.current) scrollToLatest();
    else setNewMessageCount((current) => current + added);
  }, [scrollToLatest, thread?.conversationId, thread?.messages.length]);

  const keepLatestVisible = () => {
    if (followMessagesRef.current) scrollToLatest();
  };

  const send = async () => {
    if (!thread || (!text.trim() && !files.length) || sending) return;
    followMessagesRef.current = true;
    setNewMessageCount(0);
    const content = text.trim(); setSending(true); setError('');
    try {
      const attachments = await Promise.all(files.map(uploadAdminChatAttachment));
      const saved = await sendAdminChatMessage(thread.conversationId, content, crypto.randomUUID(), attachments);
      setThread((current) => current && !current.messages.some((item) => item.id === saved.id) ? { ...current, messages: [...current.messages, saved] } : current);
      setUsers((current) => current.map((user) => user.id === selected?.id ? { ...user, preview: saved.text || (saved.attachments?.length ? 'Sent an attachment' : ''), updatedAt: saved.createdAt, conversationId: thread.conversationId } : user));
      setText('');
      setFiles([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Message could not be sent.'); }
    finally { setSending(false); }
  };

  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>Operations</span><h1><MessageCircle size={22} /> User chats</h1><p>Private messages, media, and files with marketplace users.</p></div><button type="button" className={styles.fullscreenButton} onClick={() => void toggleFullscreen()} title={isFullscreen ? 'Exit fullscreen' : 'Open chats fullscreen'} aria-label={isFullscreen ? 'Exit fullscreen' : 'Open chats fullscreen'}>{isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span></button></header>
    <section className={styles.workspace} ref={workspaceRef}>
      <aside className={styles.contacts}>
        <div className={styles.contactsHeader}><strong><UserRound size={16} /> All users</strong><span>{users.length}{nextOffset !== null ? '+' : ''}</span></div>
        <label className={styles.search}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" /></label>
        <div className={styles.userList}>
          {users.map((user) => <button key={user.id} type="button" className={`${styles.user} ${selected?.id === user.id ? styles.userSelected : ''}`} onClick={() => void openThread(user)}>
            <span className={styles.avatar}>{user.name.slice(0, 1).toUpperCase()}{user.avatarUrl && <img src={resolveAdminMediaUrl(user.avatarUrl)} alt="" onError={(event) => event.currentTarget.remove()} />}</span>
            <span className={styles.userCopy}><strong>{user.name}</strong><small>{user.role} · {user.email || user.status}</small><span>{user.preview}</span></span>
            <span className={styles.userMeta}>{user.online && <Circle size={8} fill="currentColor" />} {user.unreadCount > 0 && <b>{user.unreadCount}</b>}</span>
          </button>)}
          {loadingUsers && <div className={styles.state}><LoaderCircle className={styles.spin} size={18} /> Loading users…</div>}
          {listError && <div className={styles.error}>{listError}<button onClick={() => void loadUsers(query)}>Retry</button></div>}
          {!loadingUsers && !listError && users.length === 0 && <div className={styles.emptyUsers}><span className={styles.emptyUsersIcon}><SearchX size={18} /></span><strong>{query ? 'No users found' : 'No users yet'}</strong><span>{query ? 'Try another name or email.' : 'User conversations will appear here.'}</span></div>}
          {nextOffset !== null && <button className={styles.loadMore} disabled={loadingUsers} onClick={() => void loadUsers(query, nextOffset, true)}><ArrowDown size={14} /> Load more users</button>}
        </div>
      </aside>
      <section className={styles.thread} aria-label="Conversation">
        {!selected ? <div className={styles.empty}><span className={styles.emptyIcon}><MessageCircle size={25} /></span><strong>Choose a conversation</strong><span>Search the user list, then select someone to view or start a private chat.</span><small>Messages and shared files stay in this conversation.</small></div> : <>
          <header className={styles.threadHeader}><span className={styles.avatar}>{selected.name.slice(0, 1).toUpperCase()}{selected.avatarUrl && <img src={resolveAdminMediaUrl(selected.avatarUrl)} alt="" onError={(event) => event.currentTarget.remove()} />}</span><div><strong>{selected.name}</strong><span><i className={`${styles.onlineDot} ${thread?.online ? styles.online : ''}`} />{thread?.online ? 'Online' : 'Offline'} · {selected.role}</span></div></header>
          <div className={styles.messagePane}>
          <div className={styles.messages} ref={scrollRef} onScroll={(event) => {
            const pane = event.currentTarget;
            followMessagesRef.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 72;
            if (followMessagesRef.current) setNewMessageCount(0);
          }}>
            {loadingThread && <div className={styles.state}><LoaderCircle className={styles.spin} size={18} /> Loading conversation…</div>}
            {!loadingThread && !thread && <div className={styles.emptyThread}><span className={styles.emptyThreadIcon}><MessageCircle size={20} /></span><strong>Conversation unavailable</strong><span>{error || 'Could not load this conversation.'}</span><button type="button" className={styles.retryButton} onClick={() => void openThread(selected)}>Try again</button></div>}
            {!loadingThread && thread?.messages.length === 0 && <div className={styles.emptyThread}><span className={styles.emptyThreadIcon}><MessageCircle size={20} /></span><strong>Start a conversation</strong><span>Send {selected.name} a message. Replies will show here.</span></div>}
            {thread?.messages.map((message) => <article key={message.id} className={`${styles.message} ${message.mine ? styles.messageMine : ''}`}>
              {/^(\[Feedback\]|\[Bug report\])/.test(message.text) && <strong className={styles.reportLabel}>{message.text.startsWith('[Bug report]') ? 'Bug report' : 'Feedback'}</strong>}
              {message.text && <p>{message.text.replace(/^\[(?:Feedback|Bug report)\]\s*/, '')}</p>}
              {message.attachments?.map((attachment) => attachment.type === 'social-review' ? <div key={attachment.id} className={styles.socialReviewCard}><BadgeCheck size={18} /><div><strong>Social account verification</strong><span>{attachment.platform} · {attachment.handle}</span><small>Review {attachment.contentType} proof; confirm it is public and matches this account.</small></div>{/^https?:\/\//i.test(attachment.contentUrl) && <a href={attachment.contentUrl} target="_blank" rel="noreferrer" aria-label="Open submitted proof"><ExternalLink size={14} /></a>}</div> : attachment.type === 'image' ? <a key={attachment.id} className={styles.messageAttachment} href={resolveAdminMediaUrl(attachment.uri)} target="_blank" rel="noreferrer"><img src={resolveAdminMediaUrl(attachment.uri)} alt={attachment.name} onLoad={keepLatestVisible} onError={(event) => event.currentTarget.remove()} /><span><ImageIcon size={13} />{attachment.name}</span></a> : attachment.type === 'video' ? <video key={attachment.id} className={styles.messageVideo} src={resolveAdminMediaUrl(attachment.uri)} controls preload="metadata" onLoadedMetadata={keepLatestVisible} /> : <a key={attachment.id} className={styles.fileAttachment} href={resolveAdminMediaUrl(attachment.uri)} target="_blank" rel="noreferrer"><FileText size={17} /><span>{attachment.name}</span></a>)}
              <small>{message.time}{message.mine && <>{' · '}{message.status === 'seen' ? <><CheckCheck size={13} /> Seen</> : 'Delivered'}</>}</small>
            </article>)}
            {error && <div className={styles.error} role="alert">{error}</div>}
          </div>
          {newMessageCount > 0 && <button type="button" className={styles.newMessages} onClick={() => { followMessagesRef.current = true; setNewMessageCount(0); scrollToLatest(); }}><ArrowDown size={15} /> {newMessageCount} new message{newMessageCount === 1 ? '' : 's'}</button>}
          </div>
          <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <input hidden ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.txt,.xlsx,.csv" onChange={(event) => { const selectedFiles = Array.from(event.target.files ?? []); const available = 12 - files.length; if (selectedFiles.length > available) setError(`You can attach ${available} more file${available === 1 ? '' : 's'} (12 per message).`); else { setError(''); setFiles((current) => [...current, ...selectedFiles]); } event.currentTarget.value = ''; }} />
            <button type="button" className={styles.attachButton} aria-label="Attach media or file" title={files.length ? `${files.length} of 12 attachments` : 'Attach photos, videos, or files'} onClick={() => fileInputRef.current?.click()} disabled={sending || loadingThread || files.length >= 12}><Paperclip size={17} /></button>
            <textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} placeholder={`Message ${selected.name}`} maxLength={5000} rows={2} disabled={loadingThread || !thread} aria-label={`Message ${selected.name}`} />
            <button type="submit" disabled={(!text.trim() && !files.length) || sending || loadingThread || !thread} aria-label="Send message" title="Send message (Enter)">{sending ? <LoaderCircle className={styles.spin} size={17} /> : <Send size={17} />}</button>
          </form>
          <div className={styles.keyboardHint}>Enter to send <kbd>Enter</kbd><span>·</span> new line <kbd>Shift</kbd> + <kbd>Enter</kbd></div>
          {files.length > 0 && <div className={styles.stagedFiles} aria-label={`${files.length} attachments selected`}><span className={styles.attachmentCount}>{files.length}/12</span>{files.map((file, index) => { const AttachmentIcon = file.type.startsWith('image/') ? ImageIcon : file.type.startsWith('video/') ? Video : FileText; return <button key={`${file.name}-${index}`} type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => index !== itemIndex))} title={`Remove ${file.name}`} aria-label={`Remove ${file.name}`}><AttachmentIcon size={14} /><span>{file.name}</span><b>×</b></button>; })}</div>}
        </>}
      </section>
    </section>
  </main>;
}
