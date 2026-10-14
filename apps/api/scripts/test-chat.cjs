const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const ts = require('typescript');
const results = [];
function load(relative, mocks = {}, globals = {}, cache = new Map()) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const req = (name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('.')) {
      let target = path.resolve(path.dirname(file), name).replace(/\.js$/, '.ts');
      if (!/\.tsx?$/.test(target)) target += '.ts';
      return load(target, mocks, globals, cache);
    }
    return require(require.resolve(name, { paths: [path.dirname(file)] }));
  };
  vm.runInNewContext(js, { module: mod, exports: mod.exports, require: req, console, Error, Date, Intl, URL, URLSearchParams, TextEncoder, AbortController, setTimeout, clearTimeout, ...globals }, { filename: file });
  return mod.exports;
}
async function test(name, fn) { try { await fn(); results.push({ name, pass: true }); } catch (error) { results.push({ name, pass: false, error: error.stack }); } }
(async () => {
  const store = load('apps/mobile/src/store/store.ts');
  const id = '11111111-1111-4111-8111-111111111111', alias = '22222222-2222-4222-8222-222222222222';
  const user = { userId: '33333333-3333-4333-8333-333333333333', role: 'BRAND' };
  const conversation = { id, applicationId: id, participantName: 'Creator', participantInitials: 'CR', briefTitle: 'Campaign', preview: '', status: 'Accepted', blockedBy: [], updatedAt: '2026-10-06T00:00:00Z', messages: [] };
  const message = { id: '44444444-4444-4444-8444-444444444444', text: 'Hello', mine: false, createdAt: '2026-10-06T00:01:00Z', time: 'Now', clientMessageId: 'client-one' };
  await test('Refresh and older pages retain persisted messages and cursor without duplicate unread counts', () => {
    store.mobileStore.dispatch(store.hydrateMarketplaceConversations([conversation]));
    store.mobileStore.dispatch(store.hydrateMarketplaceConversationMessages({ conversationId: id, messages: [message], syncedAt: 123, nextCursor: message.id }));
    store.mobileStore.dispatch(store.hydrateMarketplaceConversations([conversation]));
    let cached = store.mobileStore.getState().demo.marketplaceConversations[0];
    assert.equal(cached.messages.length, 1); assert.equal(cached.messagesSyncedAt, 123); assert.equal(cached.messageCursor, message.id);
    store.mobileStore.dispatch(store.addMarketplaceMessage({ conversationId: id, message }));
    store.mobileStore.dispatch(store.addMarketplaceMessage({ conversationId: id, message }));
    cached = store.mobileStore.getState().demo.marketplaceConversations[0];
    assert.equal(cached.messages.length, 1); assert.equal(cached.unreadCount ?? 0, 0);
    store.mobileStore.dispatch(store.hydrateMarketplaceConversationMessages({ conversationId: id, messages: [{ ...message, id: alias, clientMessageId: 'old', text: 'Older', createdAt: '2026-10-05T00:01:00Z' }], older: true }));
    cached = store.mobileStore.getState().demo.marketplaceConversations[0];
    assert.equal(cached.messages.length, 2); assert.equal(cached.preview, 'Hello'); assert.equal(cached.messageCursor, undefined);
  });
  await test('Authenticated campaign arrays stay stable across 100 chat-state renders', () => {
    store.mobileStore.dispatch(store.setUserIdentity({ userId: user.userId }));
    store.mobileStore.dispatch(store.hydrateCampaignMarketplace({ campaigns: [{ id, title: 'Real', brandId: user.userId }], applications: [] }));
    let memoIndex = 0; const memo = [];
    const hook = load('apps/mobile/src/hooks/useDemoMarketplace.ts', {
      react: { useMemo(fn, deps) { const index = memoIndex++; const previous = memo[index]; if (previous && deps.every((value, i) => value === previous.deps[i])) return previous.value; const value = fn(); memo[index] = { deps, value }; return value; } },
      'react-redux': { useDispatch: () => store.mobileStore.dispatch, useSelector: (select) => select(store.mobileStore.getState()) },
      '../store/store': store,
    });
    memoIndex = 0; const first = hook.useDemoMarketplace();
    for (let i = 0; i < 100; i++) {
      store.mobileStore.dispatch(store.markMarketplaceConversationRead(id));
      memoIndex = 0; const next = hook.useDemoMarketplace();
      assert.equal(next.campaigns, first.campaigns); assert.equal(next.applications, first.applications);
    }
  });
  let token = 'test-access', fetches = [], release;
  const api = load('apps/mobile/src/services/authApi.service.ts', {
    './reminders.service': { createReminderId: () => id },
    'expo-secure-store': { getItemAsync: async (key) => key.includes('access-token') ? token : null },
    'expo-file-system/legacy': {}, '../config/api': { API_BASE_URLS: ['http://local.test/v1'] },
    'react-native': { Platform: { OS: 'android' } },
  }, { fetch: async (url, init) => { fetches.push({ url, init }); if (release) await new Promise((resolve) => release.push(resolve)); return { ok: true, status: 200, json: async () => ({ messages: [] }) }; }, atob });
  await test('20 concurrent message refreshes make one request; history only requests selected cursor', async () => {
    release = []; fetches = [];
    const pending = Array.from({ length: 20 }, () => api.getRemoteChatMessages(id));
    await new Promise((resolve) => setTimeout(resolve, 10)); assert.equal(fetches.length, 1);
    release.splice(0).forEach((resolve) => resolve()); release = null; await Promise.all(pending);
    await api.getRemoteChatMessages(id, alias);
    assert.equal(fetches.length, 2); assert.match(fetches[1].url, /limit=30&before=/);
  });
  await test('A burst of read receipts batches into one POST', async () => {
    fetches = []; await Promise.all(Array.from({ length: 20 }, () => api.markRemoteChatRead(id)));
    assert.equal(fetches.length, 1); assert.match(fetches[0].url, /\/read$/);
  });
  await test('Background offline is ordered after in-flight heartbeat', async () => {
    fetches = []; await Promise.all([api.sendChatPresenceHeartbeat(id), api.markChatOffline()]);
    assert.match(fetches[0].url, /heartbeat$/); assert.match(fetches[1].url, /offline$/);
  });
  const serviceModule = load('apps/api/src/modules/chat/chat.service.ts', {
    '../../common/cache/redis.service.js': { RedisService: class {} }, '../../common/database/prisma.service.js': { PrismaService: class {} },
    '../notifications/notifications.service.js': { NotificationsService: class {} }, './chat.realtime.js': { ChatRealtimeService: class {} },
  });
  const app = { id, campaignId: alias, status: 'ACCEPTED', creatorId: alias, campaign: { brandId: user.userId, brand: { profile: { displayName: 'Brand' } } }, creator: { profile: { displayName: 'Creator' } } };
  let records = Array.from({ length: 65 }, (_, i) => ({ id: `${String(i + 1).padStart(8, '0')}-4444-4444-8444-444444444444`, applicationId: id, senderId: user.userId, sender: { role: 'BRAND', profile: { displayName: 'Brand' } }, text: `message-${i}`, createdAt: new Date(Date.UTC(2026, 9, 6, 0, 0, i)), updatedAt: new Date(), attachments: [], readAt: null }));
  const events = [], pushes = [], queries = [];
  let blockRows = [];
  const db = {
    campaignApplication: { findUnique: async () => app, findFirst: async () => app, update: async () => app },
    profileInteraction: { findFirst: async () => null, findMany: async () => blockRows },
    chatMessage: {
      findFirst: async ({ where }) => records.find((record) => where.id ? record.id === where.id && record.applicationId === where.applicationId : record.clientMessageId === where.clientMessageId && record.applicationId === where.applicationId) ?? null,
      findMany: async (query) => { queries.push(query); const cursor = query.where.OR?.[0].createdAt.lt; return records.filter((record) => record.applicationId === query.where.applicationId && (!cursor || record.createdAt < cursor)).sort((a, b) => b.createdAt - a.createdAt).slice(0, query.take); },
      findUnique: async ({ where }) => records.find((record) => record.clientMessageId === where.applicationId_senderId_clientMessageId.clientMessageId),
      create: async ({ data }) => {
        if (records.some((record) => record.clientMessageId === data.clientMessageId)) throw new (require('@prisma/client').Prisma.PrismaClientKnownRequestError)('Duplicate', { code: 'P2002', clientVersion: 'test' });
        const record = { ...data, id: message.id, createdAt: new Date(), updatedAt: new Date(), sender: { role: 'BRAND', profile: { displayName: 'Brand' } } }; records.push(record); return record;
      },
      updateMany: async () => ({ count: 0 }),
    },
  };
  db.$transaction = async (fn) => fn(db);
  const redis = { getClient: () => ({ get: async () => { throw new Error('Redis disconnected'); } }), connect: async () => true };
  const service = new serviceModule.ChatService(db, { create: async (recipient, input) => { pushes.push({ recipient, input }); } }, redis, { send: (recipient, event) => events.push({ recipient, event }) });
  await test('Latest 30 then older pages resolve shared chat ID and keep chronological order', async () => {
    const latest = await service.getMessages(user, alias);
    assert.equal(queries[0].where.applicationId, id); assert.equal(queries[0].take, 31);
    assert.equal(latest.messages.length, 30); assert.equal(latest.messages[0].text, 'message-35'); assert.equal(latest.messages.at(-1).text, 'message-64'); assert.equal(latest.hasMore, true);
    const older = await service.getMessages(user, alias, 30, latest.nextCursor);
    assert.equal(older.messages[0].text, 'message-5'); assert.equal(older.messages.at(-1).text, 'message-34');
    const oldest = await service.getMessages(user, alias, 30, older.nextCursor);
    assert.equal(oldest.messages.length, 5); assert.equal(oldest.hasMore, false);
    await assert.rejects(service.getMessages(user, alias, 30, '------------------------------------'), /Invalid message cursor/);
  });
  await test('A block immediately disables the accepted chat for both delivery and send', async () => {
    blockRows = [{ ownerId: user.userId }];
    const snapshot = await service.getMessages(user, alias);
    assert.equal(snapshot.canSend, false);
    assert.deepEqual(snapshot.blockedBy, ['brand']);
    await assert.rejects(service.createMessage(user, alias, { text: 'Blocked message' }), /blocked/i);
    blockRows = [];
  });
  await test('Accepted Brand and Creator chats can attach a shared task card; unrelated users cannot', async () => {
    db.task = { findFirst: async ({ where }) => {
      const requesterId = where.OR?.find((item) => item.createdById)?.createdById ?? where.OR?.find((item) => item.brandId)?.brandId ?? where.OR?.find((item) => item.creatorId)?.creatorId;
      if (![user.userId, alias].includes(requesterId)) return null;
      return { creatorId: alias, recipients: [{ userId: user.userId }, { userId: alias }] };
    } };
    await service.assertCardReferences(user, app, { taskId: id });
    await service.assertCardReferences({ userId: alias, role: 'CREATOR' }, app, { taskId: id });
    await assert.rejects(service.assertCardReferences({ userId: '55555555-5555-4555-8555-555555555555', role: 'ADMIN' }, app, { taskId: id }), /Share the task only after the collaboration is accepted/);
  });
  await test('Concurrent send retries persist once; Redis outage does not fail save; push targets the chat', async () => {
    records = []; const sent = await Promise.all([service.createMessage(user, alias, { text: 'Real message', clientMessageId: 'same' }), service.createMessage(user, alias, { text: 'Real message', clientMessageId: 'same' })]);
    assert.equal(records.length, 1); assert.equal(records[0].applicationId, id); assert.equal(sent[0].id, sent[1].id);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(pushes[0].input.channels.join(), 'PUSH'); assert.equal(pushes[0].input.channelId, 'chat-messages'); assert.equal(pushes[0].input.data.conversationId, id);
    assert.equal(pushes.length, 1); assert.equal(pushes[0].input.dedupeKey, `chat-message:${message.id}`);
    await assert.rejects(service.createMessage(user, alias, { text: 'Hello', attachments: [{ type: 'image', uri: 'file://local.jpg' }] }), /uploaded file URL/);
    app.status = 'PENDING'; await assert.rejects(service.createMessage(user, alias, { text: 'Hello' }), /accepted/); app.status = 'ACCEPTED';
  });
  await test('Read with no new unread messages does not broadcast another event', async () => {
    const before = events.length; await service.markRead(user, alias); assert.equal(events.length, before);
  });
  await test('Disconnected websocket cannot fail a saved-message event', () => {
    const { ChatRealtimeService } = load('apps/api/src/modules/chat/chat.realtime.ts', { '../../common/cache/redis.service.js': { RedisService: class {} } });
    const realtime = new ChatRealtimeService({ createBlockingClient: () => null, getClient: () => null });
    realtime.add(user.userId, { readyState: 1, send: () => { throw new Error('Socket gone'); } });
    realtime.send(user.userId, { type: 'message.created' }); assert.equal(realtime.isConnected(user.userId), false);
  });
  await test('Rate-limit 429 remains 429 instead of Internal server error', () => {
    const { HttpExceptionFilter } = load('apps/api/src/common/filters/http-exception.filter.ts');
    let status, body;
    new HttpExceptionFilter().catch(Object.assign(new Error('Rate limit exceeded'), { statusCode: 429 }), { switchToHttp: () => ({ getRequest: () => ({ id: 'request', url: '/v1/chat', log: { error() {} } }), getResponse: () => ({ status(value) { status = value; return this; }, send(value) { body = value; } }) }) });
    assert.equal(status, 429); assert.equal(body.message, 'Rate limit exceeded');
  });
  await test('Verified users on the same IP have independent limits; invalid token stays IP-limited', async () => {
    const jose = await import('jose');
    const { rateLimitKey } = load('apps/api/src/common/security/rate-limit.ts', { jose });
    const secret = 'local-test-secret-at-least-32-characters';
    const sign = (subject) => new jose.SignJWT({ role: 'BRAND' }).setProtectedHeader({ alg: 'HS256' }).setSubject(subject).setExpirationTime('5m').sign(new TextEncoder().encode(secret));
    const first = await rateLimitKey({ ip: 'same-ip', headers: { authorization: `Bearer ${await sign(id)}` } }, secret);
    const second = await rateLimitKey({ ip: 'same-ip', headers: { authorization: `Bearer ${await sign(alias)}` } }, secret);
    assert.notEqual(first, second); assert.equal(await rateLimitKey({ ip: 'same-ip', headers: { authorization: 'Bearer invalid' } }, secret), 'ip:same-ip');
  });
  await test('Campaign picker matches one creator in one list call instead of one request per campaign', async () => {
    const { CampaignsService } = load('apps/api/src/modules/campaigns/campaigns.service.ts', {
      '../../common/database/prisma.service.js': { PrismaService: class {} }, '../notifications/notifications.service.js': { NotificationsService: class {} }, '../chat/chat.realtime.js': { ChatRealtimeService: class {} },
    });
    let campaignQueries = 0, creatorQueries = 0;
    const creator = { id: alias, role: 'CREATOR', status: 'ACTIVE', profile: { displayName: 'Creator', city: 'Jaipur', focus: 'Food', bio: 'Food videos', rateRange: '1000' }, socialAccounts: [{ platform: 'Instagram' }] };
    const match = { id, title: 'Match', status: 'PUBLISHED', visibility: 'PUBLIC', targetLocations: ['Pan India'], category: 'Food', creatorRequirements: '', platforms: ['Instagram'], budget: '5000', applications: [], applicationLimit: null, approvalLimit: null };
    const campaigns = new CampaignsService({ campaign: { findMany: async () => { campaignQueries++; return [match, { ...match, id: alias, title: 'No match', category: 'Finance', targetLocations: ['Mumbai'], platforms: ['YouTube'], budget: '10' }]; } }, user: { findUnique: async () => { creatorQueries++; return creator; } }, profileInteraction: { findMany: async () => [] } }, {}, {});
    campaigns.closeExpiredCampaigns = async () => {};
    campaigns.serializeCampaign = (campaign) => ({ id: campaign.id });
    const options = await campaigns.list(user, { creatorId: alias });
    assert.equal(options.campaigns.length, 1); assert.equal(options.campaigns[0].id, id); assert.equal(options.applications.length, 0);
    assert.equal(campaignQueries, 1); assert.equal(creatorQueries, 1);
    await assert.rejects(campaigns.list({ ...user, role: 'CREATOR' }, { creatorId: alias }), /brand/i);
  });
  await test('Creator marketplace keeps open campaigns visible and ranks match scores instead of hiding low scores', async () => {
    const { CampaignsService } = load('apps/api/src/modules/campaigns/campaigns.service.ts', {
      '../../common/database/prisma.service.js': { PrismaService: class {} }, '../notifications/notifications.service.js': { NotificationsService: class {} }, '../chat/chat.realtime.js': { ChatRealtimeService: class {} },
    });
    const user = { userId: alias, role: 'CREATOR' };
    const openCampaign = (campaignId, title) => ({ id: campaignId, title, status: 'PUBLISHED', visibility: 'PUBLIC', applications: [], deadlineAt: null, applicationLimit: null, approvalLimit: null, closeOnApplicationLimit: true, closeOnApprovalLimit: true });
    const campaigns = new CampaignsService({
      campaign: { findMany: async () => [openCampaign(id, 'Strong match'), openCampaign('00000000-0000-4000-8000-000000000003', 'Partial match')] },
      user: { findUnique: async () => ({ id: alias, profile: {}, socialAccounts: [] }) },
      profileInteraction: { findMany: async () => [] },
    }, {}, {});
    campaigns.closeExpiredCampaigns = async () => {};
    campaigns.serializeCampaign = (campaign) => ({ id: campaign.id, matchScore: campaign.id === id ? 80 : 20 });
    const result = await campaigns.list(user);
    assert.deepEqual(result.campaigns.map((campaign) => campaign.id), [id, '00000000-0000-4000-8000-000000000003']);
    assert.deepEqual(result.campaigns.map((campaign) => campaign.matchScore), [80, 20]);
  });
  await test('Creator can apply to an open campaign when profile match data is incomplete', async () => {
    const { CampaignsService } = load('apps/api/src/modules/campaigns/campaigns.service.ts', {
      '../../common/database/prisma.service.js': { PrismaService: class {} }, '../notifications/notifications.service.js': { NotificationsService: class {} }, '../chat/chat.realtime.js': { ChatRealtimeService: class {} },
    });
    const creator = { userId: alias, role: 'CREATOR' };
    const campaign = { id, brandId: user.userId, title: 'Open offer', status: 'PUBLISHED', visibility: 'PUBLIC', deadlineAt: null, applications: [], applicationLimit: null, approvalLimit: null, closeOnApplicationLimit: true, closeOnApprovalLimit: true };
    const application = { id: alias, creatorId: alias, message: 'I would like to apply', history: [], creator: { profile: { displayName: 'Creator' } } };
    const service = new CampaignsService({
      $transaction: async (callback) => callback({
        $queryRaw: async () => {},
        campaign: { findUnique: async () => campaign },
        campaignApplication: { findUnique: async () => null, upsert: async () => application },
        campaignApplicationEvent: { create: async () => ({ id: 'event' }) },
      }),
    }, {}, { send() {} });
    service.findPublicCampaign = async () => campaign;
    service.assertApplicationCapacity = () => {};
    service.serializeApplication = () => application;
    service.resolveConversationId = async () => application.id;
    service.persistApplicationMessage = async () => null;
    service.notify = async () => {};
    assert.equal(await service.apply(creator, id, { message: application.message }), application);
  });
  await test('Admin support chat supports attachments, paginates reports, stays admin-protected, and identifies Brandly messages', async () => {
    const { AdminChatService } = load('apps/api/src/modules/chat/admin-chat.service.ts', {
      '../../common/cache/redis.service.js': { RedisService: class {} }, '../../common/database/prisma.service.js': { PrismaService: class {} },
      '../notifications/notifications.service.js': { NotificationsService: class {} }, './chat.realtime.js': { ChatRealtimeService: class {} },
      '@nestjs/config': { ConfigService: class {} },
    });
    const admin = { userId: 'admin:owner@example.test', role: 'ADMIN' }, creator = { userId: alias, role: 'CREATOR' };
    const thread = { id, userId: alias, user: { id: alias, role: 'CREATOR', email: 'creator@example.test', profile: { displayName: 'Creator', avatarUrl: null } } };
    const savedAt = new Date('2026-10-11T00:00:00.000Z'), events = [], pushes = [], writes = [];
    const created = { id: message.id, conversationId: id, senderId: alias, senderRole: 'ADMIN', clientMessageId: 'admin:admin-client', text: 'Hello from support', createdAt: savedAt, readAt: null, sender: { id: alias, role: 'ADMIN', profile: null } };
    const db = {
      user: { findFirst: async () => ({ id: alias }), findMany: async () => [{ id: user.userId }] },
      adminChatConversation: { findUnique: async () => thread, upsert: async () => thread, update: async () => thread },
      adminChatMessage: {
        findUnique: async () => null,
        findFirst: async () => null,
        findMany: async () => [{ ...created, text: '[Bug report] Upload failed', attachments: [{ id: 'proof', name: 'screen.png', type: 'image', uri: 'https://media.example/screen.png' }], conversation: thread }],
        create: async ({ data }) => { writes.push(data); return { ...created, ...data, sender: { id: data.senderId, role: data.senderRole, profile: { displayName: 'Creator' } } }; },
        updateMany: async ({ where }) => { writes.push({ readWhere: where }); return { count: 0 }; },
      },
      $transaction: async (work) => work(db),
    };
    const service = new AdminChatService(db, { getClient: () => null, connect: async () => false }, { send: (recipient, event) => events.push({ recipient, event }), isConnected: () => false }, { create: async (recipient, input) => pushes.push({ recipient, input }) }, { get: (key) => key === 'ADMIN_OWNER_EMAIL' ? 'owner@example.test' : key === 'NODE_ENV' ? 'production' : undefined });
    await assert.rejects(service.openForAdmin(creator, alias), /admin/i);
    await assert.rejects(service.conversationForUser(admin), /user/i);
    const supportThread = await service.openForUser(creator);
    assert.equal(supportThread.conversationId, id);
    assert.equal(supportThread.participant.name, 'Brandly');
    const attachment = { id: 'proof', name: 'screen.png', type: 'image', uri: 'https://media.example/screen.png' };
    const sent = await service.send(admin, id, '  Hello from support  ', 'admin-client', [attachment]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(writes.length, 1); assert.equal(writes[0].text, 'Hello from support');
    assert.deepEqual(Object.keys(writes[0]).sort(), ['attachments', 'clientMessageId', 'conversationId', 'senderId', 'senderRole', 'text'].sort());
    assert.equal(writes[0].attachments[0].uri, attachment.uri); assert.equal(sent.attachments[0].uri, attachment.uri);
    assert.equal(sent.senderName, 'Brandly'); assert.equal(sent.mine, true);
    assert.equal(writes[0].senderId, alias); assert.equal(writes[0].clientMessageId, 'admin:admin-client');
    assert.ok(events.some((item) => item.recipient === alias && item.event.channel === 'ADMIN_CHAT'));
    assert.equal(pushes[0].input.data.adminChat, 'true');
    const sentByCreator = await service.send(creator, id, 'Hello Brandly', 'creator-client');
    assert.equal(sentByCreator.mine, true);
    assert.ok(events.some((item) => item.recipient === 'admin:owner@example.test' && item.event.message?.mine === false));
    const reports = await service.reports('BUG_REPORT');
    assert.equal(reports.items[0].type, 'BUG_REPORT'); assert.equal(reports.items[0].userId, alias);
    assert.equal(reports.items[0].message, 'Upload failed'); assert.equal(reports.items[0].attachments[0].uri, attachment.uri);
    await assert.rejects(service.send(creator, id, '', 'invalid-attachment', [{ ...attachment, uri: 'file:///unsafe.png' }]), /uploaded file URL/i);
    await service.markRead(admin, id);
    assert.equal(writes.at(-1).readWhere.senderRole.not, 'ADMIN');
  });
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) => !result.pass)) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
