import { openDB, type IDBPDatabase } from 'idb';
import type { CapturedRequest, CopilotWSMessage, CopilotConversation, CopilotPlugin, PluginInvocation, Session } from '../shared/types';
import { DB_NAME, DB_VERSION } from '../shared/constants';

let dbInstance: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // HTTP requests
      if (!db.objectStoreNames.contains('requests')) {
        const store = db.createObjectStore('requests', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('category', 'category');
        store.createIndex('sessionId', 'sessionId');
      }
      // WebSocket messages
      if (!db.objectStoreNames.contains('ws_messages')) {
        const store = db.createObjectStore('ws_messages', { keyPath: 'id' });
        store.createIndex('conversationId', 'conversationId');
        store.createIndex('timestamp', 'timestamp');
      }
      // Conversations
      if (!db.objectStoreNames.contains('conversations')) {
        db.createObjectStore('conversations', { keyPath: 'id' });
      }
      // Plugins
      if (!db.objectStoreNames.contains('plugins')) {
        db.createObjectStore('plugins', { keyPath: 'id' });
      }
      // Plugin invocations
      if (!db.objectStoreNames.contains('plugin_invocations')) {
        const store = db.createObjectStore('plugin_invocations', { keyPath: 'id' });
        store.createIndex('pluginId', 'pluginId');
        store.createIndex('conversationId', 'conversationId');
        store.createIndex('timestamp', 'timestamp');
      }
      // Sessions
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
    },
  });
  return dbInstance;
}

// ---- HTTP Requests ----

export async function storeRequests(requests: CapturedRequest[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('requests', 'readwrite');
  for (const req of requests) tx.store.put(req);
  await tx.done;
}

export async function getRequests(offset: number, limit: number): Promise<{ data: CapturedRequest[]; total: number }> {
  const db = await getDB();
  const tx = db.transaction('requests', 'readonly');
  const index = tx.store.index('timestamp');
  const all: CapturedRequest[] = [];
  let cursor = await index.openCursor(null, 'prev');
  while (cursor) { all.push(cursor.value as CapturedRequest); cursor = await cursor.continue(); }
  return { data: all.slice(offset, offset + limit), total: all.length };
}

// ---- WebSocket Messages ----

export async function storeWSMessage(msg: CopilotWSMessage): Promise<void> {
  const db = await getDB();
  await db.put('ws_messages', msg);
}

export async function storeWSMessages(msgs: CopilotWSMessage[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('ws_messages', 'readwrite');
  for (const msg of msgs) tx.store.put(msg);
  await tx.done;
}

export async function getConversationMessages(conversationId: string): Promise<CopilotWSMessage[]> {
  const db = await getDB();
  const index = db.transaction('ws_messages', 'readonly').store.index('conversationId');
  const messages = (await index.getAll(conversationId)) as CopilotWSMessage[];
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

// ---- Conversations ----

export async function storeConversation(conv: CopilotConversation): Promise<void> {
  const db = await getDB();
  await db.put('conversations', conv);
}

export async function getConversations(): Promise<CopilotConversation[]> {
  const db = await getDB();
  const convs = (await db.getAll('conversations')) as CopilotConversation[];
  return convs.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

// ---- Plugins ----

export async function storePlugin(plugin: CopilotPlugin): Promise<void> {
  const db = await getDB();
  await db.put('plugins', plugin);
}

export async function storePlugins(plugins: CopilotPlugin[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('plugins', 'readwrite');
  for (const p of plugins) tx.store.put(p);
  await tx.done;
}

export async function getPlugins(): Promise<CopilotPlugin[]> {
  const db = await getDB();
  return (await db.getAll('plugins')) as CopilotPlugin[];
}

// ---- Plugin Invocations ----

export async function storePluginInvocation(inv: PluginInvocation): Promise<void> {
  const db = await getDB();
  await db.put('plugin_invocations', inv);
}

export async function getPluginInvocations(pluginId?: string): Promise<PluginInvocation[]> {
  const db = await getDB();
  if (pluginId) {
    const index = db.transaction('plugin_invocations', 'readonly').store.index('pluginId');
    return (await index.getAll(pluginId)) as PluginInvocation[];
  }
  const all = (await db.getAll('plugin_invocations')) as PluginInvocation[];
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

// ---- Sessions ----

export async function storeSession(session: Session): Promise<void> {
  const db = await getDB();
  await db.put('sessions', session);
}

export async function getSessions(): Promise<Session[]> {
  const db = await getDB();
  return ((await db.getAll('sessions')) as Session[]).sort((a, b) => b.startedAt - a.startedAt);
}

export async function updateSession(id: string, updates: Partial<Session>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('sessions', id);
  if (existing) await db.put('sessions', { ...existing, ...updates });
}

// ---- Cleanup ----

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const stores = ['requests', 'ws_messages', 'conversations', 'plugins', 'plugin_invocations', 'sessions'];
  for (const store of stores) {
    const tx = db.transaction(store, 'readwrite');
    await tx.store.clear();
    await tx.done;
  }
}
