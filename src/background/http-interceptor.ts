import type { CapturedRequest, RequestCategory, ParsedUrl } from '../shared/types';
import {
  COPILOT_HTTP_PATTERNS,
  SENSITIVE_HEADERS,
  SENSITIVE_KEYWORDS,
  MAX_BODY_SIZE,
  WRITE_BATCH_SIZE,
  WRITE_BATCH_INTERVAL_MS,
} from '../shared/constants';

// Pending requests
const pendingRequests = new Map<string, Partial<CapturedRequest>>();
const requestTimings = new Map<string, number>();

// Buffer for batch writes
let writeBuffer: CapturedRequest[] = [];
let writeTimer: ReturnType<typeof setTimeout> | null = null;

// Callbacks
let onNewRequest: ((req: CapturedRequest) => void) | null = null;
let storeCallback: ((reqs: CapturedRequest[]) => Promise<void>) | null = null;

export function setOnNewRequest(cb: (req: CapturedRequest) => void) { onNewRequest = cb; }
export function setStoreCallback(cb: (reqs: CapturedRequest[]) => Promise<void>) { storeCallback = cb; }

// State
let isMonitoring = false;
let activeSessionId: string | null = null;

export function setMonitoring(enabled: boolean) { isMonitoring = enabled; }
export function setActiveSession(sessionId: string | null) { activeSessionId = sessionId; }
export function getMonitoring(): boolean { return isMonitoring; }
export function getActiveSessionId(): string | null { return activeSessionId; }

// ---- Classification ----

function classifyUrl(url: string): { category: RequestCategory; service: string } {
  for (const { pattern, category, service } of COPILOT_HTTP_PATTERNS) {
    if (pattern.test(url)) return { category, service };
  }
  return { category: 'other', service: 'Other' };
}

function parseUrl(url: string): ParsedUrl {
  try {
    const u = new URL(url);
    return {
      host: u.host,
      pathname: u.pathname,
      search: u.search,
      apiVersion: u.searchParams.get('api-version') || undefined,
    };
  } catch {
    return { host: '', pathname: url, search: '' };
  }
}

// ---- Redaction ----

function redactValue(name: string, value: string): string {
  const lowerName = name.toLowerCase();
  if (lowerName === 'cookie' || lowerName === 'set-cookie') {
    return value.length > 50 ? value.slice(0, 50) + '... [REDACTED]' : value;
  }
  if (value.startsWith('Bearer ') && value.length > 27) {
    const token = value.slice(7);
    return `Bearer ${token.slice(0, 10)}...${token.slice(-4)} [REDACTED]`;
  }
  if (SENSITIVE_HEADERS.includes(lowerName) || SENSITIVE_KEYWORDS.some(kw => lowerName.includes(kw))) {
    if (value.length > 20) return `${value.slice(0, 10)}...${value.slice(-4)} [REDACTED]`;
  }
  return value;
}

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) out[k] = redactValue(k, v);
  return out;
}

function headersToRecord(headers: chrome.webRequest.HttpHeader[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers) if (h.value !== undefined) out[h.name] = h.value;
  return out;
}

// ---- Body extraction ----

function extractBody(details: chrome.webRequest.WebRequestBodyDetails): string | null {
  if (!details.requestBody) return null;
  if (details.requestBody.raw?.[0]?.bytes) {
    try {
      const text = new TextDecoder().decode(details.requestBody.raw[0].bytes);
      return text.length > MAX_BODY_SIZE ? text.slice(0, MAX_BODY_SIZE) + '\n[TRUNCATED]' : text;
    } catch { return '[Binary data]'; }
  }
  if (details.requestBody.formData) {
    const str = JSON.stringify(details.requestBody.formData);
    return str.length > MAX_BODY_SIZE ? str.slice(0, MAX_BODY_SIZE) + '\n[TRUNCATED]' : str;
  }
  return null;
}

// ---- Batch write ----

function flush() {
  if (writeBuffer.length === 0) return;
  const batch = writeBuffer.splice(0);
  if (storeCallback) storeCallback(batch).catch(console.error);
}

function scheduleFlush() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => { writeTimer = null; flush(); }, WRITE_BATCH_INTERVAL_MS);
}

function addToBuffer(req: CapturedRequest) {
  writeBuffer.push(req);
  if (writeBuffer.length >= WRITE_BATCH_SIZE) {
    if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
    flush();
  } else {
    scheduleFlush();
  }
}

// ---- Tab info ----

async function getTabInfo(tabId: number): Promise<{ url: string; title: string }> {
  try {
    if (tabId < 0) return { url: '', title: '' };
    const tab = await chrome.tabs.get(tabId);
    return { url: tab.url || '', title: tab.title || '' };
  } catch { return { url: '', title: '' }; }
}

// ---- Event handlers ----

function shouldCapture(): boolean {
  return isMonitoring || activeSessionId !== null;
}

function onBeforeRequest(details: chrome.webRequest.WebRequestBodyDetails) {
  if (!shouldCapture() || !details.url.startsWith('http')) return;

  requestTimings.set(details.requestId, Date.now());
  const { category, service } = classifyUrl(details.url);

  pendingRequests.set(details.requestId, {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    url: details.url,
    method: details.method,
    tabId: details.tabId,
    initiator: details.initiator || '',
    type: details.type,
    requestBody: extractBody(details),
    sessionId: activeSessionId,
    parsedUrl: parseUrl(details.url),
    category,
    service,
  });
}

function onSendHeaders(details: chrome.webRequest.WebRequestHeadersDetails) {
  if (!shouldCapture()) return;
  const pending = pendingRequests.get(details.requestId);
  if (!pending) return;
  pending.requestHeaders = redactHeaders(headersToRecord(details.requestHeaders || []));
}

async function onCompleted(details: chrome.webRequest.WebResponseCacheDetails) {
  if (!shouldCapture()) return;
  const pending = pendingRequests.get(details.requestId);
  if (!pending) return;
  pendingRequests.delete(details.requestId);

  const startTime = requestTimings.get(details.requestId);
  requestTimings.delete(details.requestId);
  const tabInfo = await getTabInfo(details.tabId);
  const responseHeaders = redactHeaders(headersToRecord(details.responseHeaders || []));

  const completed: CapturedRequest = {
    id: pending.id || crypto.randomUUID(),
    timestamp: pending.timestamp || Date.now(),
    url: pending.url || details.url,
    method: pending.method || details.method,
    requestHeaders: pending.requestHeaders || {},
    requestBody: pending.requestBody || null,
    statusCode: details.statusCode,
    responseHeaders,
    tabId: details.tabId,
    tabUrl: tabInfo.url,
    tabTitle: tabInfo.title,
    initiator: pending.initiator || '',
    type: pending.type || details.type,
    timeMs: startTime ? Date.now() - startTime : 0,
    category: pending.category || 'other' as RequestCategory,
    service: pending.service || 'Other',
    sessionId: pending.sessionId || null,
    parsedUrl: pending.parsedUrl || parseUrl(details.url),
  };

  addToBuffer(completed);
  if (onNewRequest) onNewRequest(completed);
}

function onErrorOccurred(details: chrome.webRequest.WebResponseErrorDetails) {
  if (!shouldCapture()) return;
  const pending = pendingRequests.get(details.requestId);
  if (!pending) return;
  pendingRequests.delete(details.requestId);
  requestTimings.delete(details.requestId);

  const completed: CapturedRequest = {
    id: pending.id || crypto.randomUUID(),
    timestamp: pending.timestamp || Date.now(),
    url: pending.url || details.url,
    method: pending.method || details.method,
    requestHeaders: pending.requestHeaders || {},
    requestBody: pending.requestBody || null,
    statusCode: 0,
    responseHeaders: {},
    tabId: details.tabId,
    tabUrl: '',
    tabTitle: '',
    initiator: pending.initiator || '',
    type: pending.type || details.type,
    timeMs: 0,
    category: pending.category || 'other' as RequestCategory,
    service: pending.service || 'Other',
    sessionId: pending.sessionId || null,
    parsedUrl: pending.parsedUrl || parseUrl(details.url),
  };

  addToBuffer(completed);
  if (onNewRequest) onNewRequest(completed);
}

// ---- Listener management ----

let listenersActive = false;

const urlFilter: chrome.webRequest.RequestFilter = {
  urls: [
    '*://*.microsoft.com/*',
    '*://*.microsoftonline.com/*',
    '*://*.office.com/*',
    '*://*.office365.com/*',
    '*://*.sharepoint.com/*',
    '*://*.live.com/*',
    '*://*.azure.com/*',
    '*://*.msftauth.net/*',
    '*://*.msauth.net/*',
    '*://*.svc.ms/*',
    '*://*.powerapps.com/*',
    '*://*.powerautomate.com/*',
    '*://*.dynamics.com/*',
    '*://*.windows.net/*',
    '*://*.onenote.com/*',
    '*://*.onedrive.com/*',
    '*://*.outlook.com/*',
  ],
};

export function startListeners() {
  if (listenersActive) return;
  chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, urlFilter, ['requestBody']);
  chrome.webRequest.onSendHeaders.addListener(onSendHeaders, urlFilter, ['requestHeaders']);
  chrome.webRequest.onCompleted.addListener(onCompleted, urlFilter, ['responseHeaders']);
  chrome.webRequest.onErrorOccurred.addListener(onErrorOccurred, urlFilter);
  listenersActive = true;
}

export function stopListeners() {
  if (!listenersActive) return;
  chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest);
  chrome.webRequest.onSendHeaders.removeListener(onSendHeaders);
  chrome.webRequest.onCompleted.removeListener(onCompleted);
  chrome.webRequest.onErrorOccurred.removeListener(onErrorOccurred);
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  flush();
  pendingRequests.clear();
  requestTimings.clear();
  listenersActive = false;
}
