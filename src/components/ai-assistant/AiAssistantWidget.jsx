import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getTokens, errorMessage } from '../../api/client';
import { attachmentUrl } from '../messaging/format';
import Icon from '../Icon';
import { AI_STRINGS, isTempId, renderMarkdown, fmtTime, fmtSize, roleContent, greeting, groupConversations, relTime } from './aiAssistantUtils';

const API = '/api/v1/ai-assistant';

// Hosts that buffer/kill long-lived responses can drop an SSE connection
// with zero bytes ever reaching the browser. Without a watchdog the
// assistant bubble would be left showing the typing indicator forever —
// same two timers as the vanilla widget (STALL_TIMEOUT_MS / MAX_TURN_MS).
const STALL_TIMEOUT_MS = 45000;
const MAX_TURN_MS = 120000;

/** Portal alias map — mirrors layouts/footer.php's $__aiPortalMap so the
 *  badge/context this widget sends never disagrees with what the server
 *  would derive from the same role. */
const PORTAL_MAP = {
  security_admin: 'security', security_officer: 'security',
  data_analyst: 'data_analysis',
};

/** Maps a failure to one of the design's three states. */
function errorKindOf(status, timeout) {
  if (status === 403) return 'permission';
  if (timeout || status >= 500) return 'service';
  return 'error';
}

function currentLocale() {
  const attr = document.documentElement.getAttribute('lang');
  return attr === 'ar' ? 'ar' : 'en';
}

export default function AiAssistantWidget({ role, user }) {
  const locale = currentLocale();
  const T = AI_STRINGS[locale] || AI_STRINGS.en;
  const t = useCallback((key) => T[key] || key, [T]);
  const portal = PORTAL_MAP[role] || role || 'student';
  const firstName = String(user?.full_name || user?.name || '').trim().split(/\s+/)[0] || '';

  const [fabVisible, setFabVisible] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [available, setAvailable] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const [conversations, setConversations] = useState([]);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [banner, setBanner] = useState(null); // { text, kind }

  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);

  const [draft, setDraft] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const textareaRef = useRef(null);
  const messagesElRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortCtrlRef = useRef(null);
  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const searchTimerRef = useRef(null);
  const activeIdRef = useRef(null);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // -- Status (bug fix ported verbatim: check immediately on mount so the
  // FAB isn't stuck hidden waiting for a click that can never happen) --
  const checkStatus = useCallback(() => {
    api.get(`${API}/status`).then((res) => {
      const ok = !!(res.data && res.data.available);
      setAvailable(ok);
      if (!ok) setBanner({ text: t('unavailable'), kind: 'service' });
      setFabVisible(true);
    }).catch(() => setFabVisible(true));
  }, [t]);

  useEffect(() => { checkStatus(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // -- Open / close --
  function open() {
    setPulse(false);
    setIsOpen(true);
    if (available === null) checkStatus();
    if (!loadedOnce) { loadConversations(); setLoadedOnce(true); }
    setTimeout(() => textareaRef.current && textareaRef.current.focus(), 250);
  }
  function close() { setIsOpen(false); }

  // The Student sidebar's "UIP AI Assistant" button (components/Sidebar.jsx)
  // fires this event so the floating button isn't the only way in.
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    const onOpen = () => openRef.current();
    window.addEventListener('uip:open-ai-assistant', onOpen);
    return () => window.removeEventListener('uip:open-ai-assistant', onOpen);
  }, []);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && isOpen) close(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // Close any open per-conversation menu on outside click.
  useEffect(() => {
    if (!openMenuId) return undefined;
    function onDocClick() { setOpenMenuId(null); }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [openMenuId]);

  // -- Conversations --
  const loadConversations = useCallback((q) => {
    api.get(`${API}/conversations`, q ? { q } : undefined)
      .then((res) => setConversations(res.data || []))
      .catch(() => {});
  }, []);

  function onSearchChange(e) {
    const q = e.target.value;
    setSearch(q);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => loadConversations(q), 250);
  }

  function newChat() {
    stopStreaming();
    setActiveId(null);
    setMessages([]);
    setPendingFiles([]);
    setSidebarCollapsed(true);
    setDraft('');
    setTimeout(() => textareaRef.current && textareaRef.current.focus(), 0);
  }

  function openConversation(id) {
    stopStreaming();
    setActiveId(id);
    setSidebarCollapsed(true);
    setMessagesLoading(true);
    setBanner(null);
    api.get(`${API}/conversations/${id}`).then((res) => {
      setMessages((res.data && res.data.messages) || []);
      setMessagesLoading(false);
    }).catch((err) => {
      setMessages([]);
      setMessagesLoading(false);
      setBanner({ text: err?.status === 403 ? t('permissionText') : errorMessage(err), kind: errorKindOf(err?.status) });
    });
  }

  function ensureConversation() {
    if (activeIdRef.current) return Promise.resolve(activeIdRef.current);
    return api.post(`${API}/conversations`, {}).then((res) => {
      activeIdRef.current = res.data.id;
      setActiveId(res.data.id);
      setConversations((prev) => [res.data, ...prev]);
      return res.data.id;
    });
  }

  function convAction(c, action) {
    if (action === 'rename') {
      // eslint-disable-next-line no-alert
      const title = prompt(t('renamePrompt'), c.title);
      if (title && title.trim()) {
        api.patch(`${API}/conversations/${c.id}`, { title: title.trim() }).then(() => loadConversations(search));
      }
    } else if (action === 'pin') {
      api.patch(`${API}/conversations/${c.id}`, { is_pinned: !c.is_pinned }).then(() => loadConversations(search));
    } else if (action === 'archive') {
      api.patch(`${API}/conversations/${c.id}`, { is_archived: !c.is_archived }).then(() => loadConversations(search));
    } else if (action === 'export') {
      exportConversation(c.id);
    } else if (action === 'delete') {
      // eslint-disable-next-line no-alert
      if (!confirm(t('confirmDelete'))) return;
      api.del(`${API}/conversations/${c.id}`).then(() => {
        if (activeIdRef.current === c.id) newChat();
        loadConversations(search);
      });
    }
  }

  // Bearer-auth download — window.open() can't carry an Authorization
  // header, so this follows the same fetch+blob pattern already used by
  // AdminSecurityLogs.jsx's CSV export.
  async function exportConversation(id) {
    try {
      const { accessToken } = getTokens();
      const res = await fetch(`${API}/conversations/${id}/export`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${id}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setBanner({ text: t('errorGeneric'), kind: 'error' });
    }
  }

  // -- Files --
  function handleFiles(fileList) {
    Array.from(fileList).forEach((file) => {
      const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      setPendingFiles((prev) => [...prev, { tempId, name: file.name, size: file.size, status: 'uploading' }]);

      ensureConversation().then((convId) => {
        const fd = new FormData();
        fd.append('file', file);
        return api.postForm(`${API}/conversations/${convId}/attachments`, fd);
      }).then((res) => {
        setPendingFiles((prev) => prev.map((f) => (f.tempId === tempId
          ? { ...f, status: 'done', attachmentId: res.data.id, kind: res.data.kind }
          : f)));
      }).catch((err) => {
        const msg = errorMessage(err);
        setPendingFiles((prev) => prev.map((f) => (f.tempId === tempId ? { ...f, status: 'error', errorMessage: msg } : f)));
        setBanner({ text: `${file.name}: ${msg}`, kind: 'error' });
      });
    });
  }

  function removePendingFile(tempId) {
    setPendingFiles((prev) => prev.filter((f) => f.tempId !== tempId));
  }

  function onFileInputChange(e) {
    handleFiles(e.target.files);
    e.target.value = '';
  }

  function onDrop(e) {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  // -- Voice recording --
  function toggleRecording() {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
      // eslint-disable-next-line no-alert
      alert(t('errorGeneric'));
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      recordedChunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.addEventListener('dataavailable', (e) => { if (e.data.size) recordedChunksRef.current.push(e.data); });
      recorder.addEventListener('stop', () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setRecording(false);
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const ext = blob.type.indexOf('ogg') > -1 ? 'ogg' : 'webm';
        const file = new File([blob], `voice-message-${Date.now()}.${ext}`, { type: blob.type });
        handleFiles([file]);
      });
      recorder.start();
      setRecording(true);
    }).catch(() => { /* mic permission denied — silently ignore, same as vanilla */ });
  }

  // -- Textarea --
  function onTextareaInput(e) {
    setDraft(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }
  function onTextareaKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function buildContextPayload() {
    const extra = window.UIP_AI_CONTEXT || {};
    return {
      portal,
      page: (document.title || location.pathname || '').slice(0, 200),
      route: `${location.pathname}`.slice(0, 200),
      locale,
      project: extra.project || undefined,
      dashboard: extra.dashboard || undefined,
    };
  }

  function submit(e) {
    if (e) e.preventDefault();
    if (streaming) { stopStreaming(); return; }
    send();
  }

  function send(textOverride) {
    if (available === false) { setBanner({ text: t('unavailable'), kind: 'service' }); return; }
    const content = (typeof textOverride === 'string' ? textOverride : draft).trim();
    const doneFiles = pendingFiles.filter((f) => f.status === 'done');
    const attachmentIds = doneFiles.map((f) => f.attachmentId);
    if (!content && !attachmentIds.length) return;
    if (pendingFiles.some((f) => f.status === 'uploading')) return;

    if (typeof textOverride !== 'string') setDraft('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setPendingFiles([]);

    const tempId = `tmp_msg_${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      role: 'user',
      content,
      status: 'complete',
      attachments: doneFiles.map((f) => ({
        id: f.attachmentId, kind: f.kind, url: `${API}/attachments/${f.attachmentId}/download`,
        original_name: f.name, mime_type: null, size_bytes: f.size,
      })),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    ensureConversation().then((convId) => {
      streamTurn(convId, {
        content,
        attachment_ids: attachmentIds,
        ...buildContextPayload(),
      }, `${API}/conversations/${convId}/messages`, tempId);
    });
  }

  function regenerate(messageId) {
    if (streaming) return;
    streamTurn(activeIdRef.current, buildContextPayload(), `${API}/messages/${messageId}/regenerate`, null);
  }

  function stopStreaming() {
    if (abortCtrlRef.current) abortCtrlRef.current.abort();
  }

  function finalizeStreaming() {
    setStreaming(false);
    abortCtrlRef.current = null;
  }

  function handleSseEvent(evt, placeholderId, optimisticUserMsgId) {
    if (evt.type === 'user_message' && evt.message) {
      setMessages((prev) => {
        const tmpIdx = optimisticUserMsgId ? prev.findIndex((m) => m.id === optimisticUserMsgId) : -1;
        if (tmpIdx > -1) {
          const next = prev.slice();
          next[tmpIdx] = evt.message;
          return next;
        }
        const idx = prev.findIndex((m) => m.id === placeholderId);
        const next = prev.slice();
        next.splice(Math.max(idx, 0), 0, evt.message);
        return next;
      });
    } else if (evt.type === 'token') {
      setMessages((prev) => prev.map((m) => (m.id === placeholderId ? { ...m, content: (m.content || '') + evt.delta } : m)));
    } else if (evt.type === 'done') {
      setMessages((prev) => prev.map((m) => (m.id === placeholderId ? { ...m, id: evt.message_id, content: evt.content, status: 'complete' } : m)));
    } else if (evt.type === 'error') {
      setMessages((prev) => prev.map((m) => (m.id === placeholderId ? { ...m, status: 'error', errorKind: errorKindOf(evt.status, evt.timeout), content: evt.message || t('errorGeneric') } : m)));
    }
  }

  /** Shared SSE consumer for both send() and regenerate() — fetch()+
   *  ReadableStream rather than EventSource because the request needs a
   *  POST body, same reasoning as the vanilla widget. Authenticates via
   *  Bearer instead of the session+CSRF the PHP app used. */
  function streamTurn(convId, payload, url, optimisticUserMsgId) {
    setStreaming(true);
    abortCtrlRef.current = typeof AbortController !== 'undefined' ? new AbortController() : null;

    const placeholderId = `streaming_${Date.now()}`;
    const isNewTurn = !!optimisticUserMsgId;
    const assistantMsg = {
      id: placeholderId, role: 'assistant', content: '', status: 'streaming', attachments: [],
      created_at: new Date().toISOString(),
      retryContent: isNewTurn ? (payload.content || '') : undefined,
    };
    setMessages((prev) => [...prev, assistantMsg]);

    let settled = false;
    let userAborted = false;
    let watchdog;
    const runFetch = (retried) => {
      const { accessToken } = getTokens();
      watchdog = setTimeout(() => {
        if (settled) return;
        settled = true;
        if (abortCtrlRef.current) abortCtrlRef.current.abort();
        handleSseEvent({ type: 'error', message: t('timeoutError'), timeout: true }, placeholderId);
        finalizeStreaming();
      }, MAX_TURN_MS);
      const bumpWatchdog = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => {
          if (settled) return;
          settled = true;
          if (abortCtrlRef.current) abortCtrlRef.current.abort();
          handleSseEvent({ type: 'error', message: t('timeoutError'), timeout: true }, placeholderId);
          finalizeStreaming();
        }, STALL_TIMEOUT_MS);
      };

      fetch(url, {
        method: 'POST',
        signal: abortCtrlRef.current ? abortCtrlRef.current.signal : undefined,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'X-Requested-With': 'XMLHttpRequest',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      }).then((response) => {
        if (response.status === 401 && !retried) {
          // One transparent refresh-and-retry, same policy as api/client.js's
          // request(): redeem the refresh token via a trivial call through
          // the normal client (which owns the single-flight refresh logic),
          // then replay this stream once.
          clearTimeout(watchdog);
          return api.get(`${API}/status`).then(() => runFetch(true));
        }
        if (!response.ok || !response.body) {
          const status = response.status;
          const fail = (msg) => Object.assign(new Error(status === 403 ? t('permissionText') : msg), { status });
          return response.json ? response.json().then((j) => { throw fail((j && j.message) || t('errorGeneric')); }, () => { throw fail(t('errorGeneric')); })
            : Promise.reject(fail(t('errorGeneric')));
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buf = '';
        function pump() {
          return reader.read().then((res) => {
            if (settled) return undefined;
            if (res.done) return undefined;
            bumpWatchdog();
            buf += decoder.decode(res.value, { stream: true });
            const chunks = buf.split('\n\n');
            buf = chunks.pop();
            chunks.forEach((chunk) => {
              const line = chunk.split('\n').find((l) => l.indexOf('data:') === 0);
              if (!line) return;
              let evt;
              try { evt = JSON.parse(line.slice(5).trim()); } catch { return; }
              if (evt.type === 'done' || evt.type === 'error') { settled = true; clearTimeout(watchdog); }
              handleSseEvent(evt, placeholderId, optimisticUserMsgId);
            });
            return pump();
          });
        }
        return pump();
      }).catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        if (err && err.name === 'AbortError') { userAborted = true; finalizeStreaming(); return; }
        handleSseEvent({ type: 'error', message: (err && err.message) || t('errorGeneric'), status: err && err.status }, placeholderId);
      }).then(() => {
        clearTimeout(watchdog);
        finalizeStreaming();
        // The stream can end (or be stopped) without a `done`/`error` event; don't leave
        // the bubble in "streaming" forever. Keep partial text, drop an empty placeholder.
        setMessages((prev) => prev.flatMap((m) => {
          if (m.id !== placeholderId || m.status !== 'streaming') return [m];
          if (m.content) return [{ ...m, status: 'complete' }];
          if (userAborted) return [];
          return [{ ...m, status: 'error', errorKind: 'service', content: t('errorGeneric') }];
        }));
        loadConversations(search);
      });
    };
    runFetch(false);
  }

  // -- Message actions --
  function copyText(text, id) {
    const done = () => { setCopiedId(id); setTimeout(() => setCopiedId(null), 1200); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
      done();
    }
  }

  function messageAction(m, action) {
    const idDependent = { delete: 1, bookmark: 1, react: 1, edit: 1, regenerate: 1 };
    if (idDependent[action] && isTempId(m.id)) return;

    if (action === 'copy') {
      copyText(m.content, m.id);
    } else if (action === 'retry-send') {
      setDraft(m.retryContent || '');
      setTimeout(() => textareaRef.current && textareaRef.current.focus(), 0);
    } else if (action === 'delete') {
      api.del(`${API}/messages/${m.id}`).then(() => setMessages((prev) => prev.filter((x) => x.id !== m.id)));
    } else if (action === 'bookmark') {
      api.post(`${API}/messages/${m.id}/bookmark`, { bookmarked: !m.is_bookmarked }).then((res) => patchMessage(m.id, res.data));
    } else if (action === 'react') {
      api.post(`${API}/messages/${m.id}/react`, { emoji: '👍' }).then((res) => patchMessage(m.id, res.data));
    } else if (action === 'edit') {
      // eslint-disable-next-line no-alert
      const text = prompt(t('edit'), m.content);
      if (text != null && text.trim() && text !== m.content) {
        api.patch(`${API}/messages/${m.id}`, { content: text.trim() }).then((res) => patchMessage(m.id, res.data));
      }
    } else if (action === 'regenerate') {
      regenerate(m.id);
    }
  }

  function patchMessage(id, data) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
  }

  // Auto-scroll to bottom on new content.
  useEffect(() => {
    if (messagesElRef.current) messagesElRef.current.scrollTop = messagesElRef.current.scrollHeight;
  }, [messages]);

  if (!fabVisible && available === null) return null;

  const groups = groupConversations(conversations, t);
  const sendDisabled = streaming ? false : (!draft.trim() && !pendingFiles.filter((f) => f.status !== 'error').length);
  const content = roleContent(role, locale);
  const showSidebar = isExpanded || !sidebarCollapsed;
  const activeConv = conversations.find((c) => c.id === activeId);
  const hasMessages = messages.length > 0;

  const renderGroups = () => (
    <>
      {conversations.length === 0 && <div className="ai-sidebar__empty">{t('empty')}</div>}
      {groups.map((g) => (
        <div key={g.key}>
          <div className="ai-sidebar__group-label">{g.label}</div>
          {g.items.map((c) => (
            <ConvItem key={c.id} c={c} active={c.id === activeId} open={openMenuId === c.id}
              time={relTime(c, t, locale)}
              onOpenMenu={() => setOpenMenuId((id) => (id === c.id ? null : c.id))}
              onSelect={() => openConversation(c.id)} onAction={(act) => convAction(c, act)} t={t} />
          ))}
        </div>
      ))}
    </>
  );

  return (
    <div className="ai-assistant-root">
      <button
        type="button"
        className={`ai-fab${pulse ? ' ai-fab--pulse' : ''}`}
        aria-label={t('title')}
        hidden={!fabVisible}
        onClick={open}
      >
        <Icon name="sparkles" size={26} />
      </button>

      <div className={`ai-panel-scrim${isOpen ? ' is-open' : ''}`} onClick={close} />

      <div
        className={`ai-panel${isOpen ? ' is-open' : ''}${isExpanded ? ' is-fullscreen' : ''}`}
        role="dialog"
        aria-label={t('title')}
      >
        <div className="ai-panel__header">
          {!isExpanded && (
            <button type="button" className={`ai-panel__icon-btn${!sidebarCollapsed ? ' is-on' : ''}`} aria-label={t('menu')} aria-pressed={!sidebarCollapsed} onClick={() => setSidebarCollapsed((c) => !c)}>
              <Icon name="menu" size={18} />
            </button>
          )}
          <div className="ai-panel__title">
            <span className="ai-avatar"><Icon name="sparkles" size={15} /></span>
            <div className="ai-panel__title-text">
              <strong>{isExpanded ? t('expandedWorkspace') : t('title')}</strong>
              {!isExpanded && <small>{t('subtitle')}</small>}
            </div>
          </div>
          <div className="ai-panel__header-actions">
            <button type="button" className="ai-panel__text-btn" aria-label={t('newChat')} onClick={newChat}>
              <Icon name="plus" size={15} /><span>{t('newChatLabel')}</span>
            </button>
            <button
              type="button"
              className="ai-panel__icon-btn"
              aria-label={isExpanded ? t('collapseSize') : t('expand')}
              onClick={() => setIsExpanded((v) => !v)}
            >
              <Icon name={isExpanded ? 'collapse' : 'expand'} size={17} />
            </button>
            <button type="button" className="ai-panel__icon-btn" aria-label={t('close')} onClick={close}>
              <Icon name="x" size={18} />
            </button>
          </div>
        </div>

        <div className="ai-panel__body">
          <aside className={`ai-sidebar${showSidebar ? '' : ' is-collapsed'}`} aria-hidden={!showSidebar}>
            <div className="ai-sidebar__head">
              <span className="ai-sidebar__eyebrow"><Icon name="history" size={13} /> {isExpanded ? t('recentChats') : t('history')}</span>
              {!isExpanded && <h3>{t('conversationHistory')}</h3>}
            </div>
            <div className="ai-sidebar__search">
              <span><Icon name="search" size={15} /></span>
              <input type="search" placeholder={t('searchPlaceholder')} value={search} onChange={onSearchChange} />
            </div>
            <div className="ai-sidebar__list">{renderGroups()}</div>
          </aside>

          <section className="ai-conversation">
            {isExpanded && hasMessages && activeConv && (
              <div className="ai-conversation__head">
                <span className="ai-avatar"><Icon name="sparkles" size={13} /></span>
                <strong>{activeConv.title}</strong>
              </div>
            )}
            <div className="ai-messages" ref={messagesElRef}>
              {banner && <AiBanner banner={banner} t={t} onRetry={banner.kind === 'service' || banner.kind === 'error' ? checkStatus : null} />}
              {messagesLoading && <MessagesSkeleton />}
              {!messagesLoading && !hasMessages && (
                <div className="ai-welcome">
                  <span className="ai-avatar ai-avatar--lg"><Icon name="sparkles" size={26} /></span>
                  <span className="ai-welcome__eyebrow">{content.eyebrow}</span>
                  <h3>{greeting(t, firstName)}</h3>
                  <p>{content.body}</p>
                  <div className="ai-welcome__head">
                    <strong>{t('tryAsking')}</strong>
                    <span>{content.suggestions.length} {t('suggestionsCount')}</span>
                  </div>
                  <div className="ai-welcome__suggestions">
                    {content.suggestions.map((sg) => (
                      <button key={sg} type="button" className="ai-suggestion-chip" onClick={() => send(sg)}>
                        <span>{sg}</span>
                        <Icon name={locale === 'ar' ? 'chevron-left' : 'chevron-right'} size={15} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!messagesLoading && messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  m={m}
                  t={t}
                  locale={locale}
                  copied={copiedId === m.id}
                  onStop={stopStreaming}
                  onAction={(action) => messageAction(m, action)}
                  onCopyCode={(code, btnEl) => {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      navigator.clipboard.writeText(code).then(() => {
                        if (btnEl) { const orig = btnEl.textContent; btnEl.textContent = t('copied'); setTimeout(() => { btnEl.textContent = orig; }, 1200); }
                      }).catch(() => {});
                    }
                  }}
                />
              ))}
            </div>

            <form
              className="ai-composer"
              onSubmit={submit}
              onDragEnter={(e) => e.preventDefault()}
              onDragOver={(e) => e.preventDefault()}
            >
              {pendingFiles.length > 0 && (
                <div className="ai-composer__files">
                  {pendingFiles.map((pf) => (
                    <div key={pf.tempId} className={`ai-file-chip${pf.status === 'uploading' ? ' is-uploading' : ''}${pf.status === 'error' ? ' is-error' : ''}`} title={pf.status === 'error' ? (pf.errorMessage || t('errorGeneric')) : undefined}>
                      <Icon name={pf.status === 'error' ? 'alert' : 'file'} size={13} />
                      <span>{pf.name}</span>
                      <button type="button" onClick={() => removePendingFile(pf.tempId)}><Icon name="x" size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="ai-composer__box" onDrop={onDrop}>
                <textarea
                  ref={textareaRef}
                  rows={1}
                  placeholder={isExpanded && hasMessages ? t('followUp') : t('placeholder')}
                  value={draft}
                  onChange={onTextareaInput}
                  onKeyDown={onTextareaKeyDown}
                />
                <div className="ai-composer__bar">
                  <span className="ai-composer__hint">{recording ? t('recording') : t('disclaimer')}</span>
                  <div className="ai-composer__tools">
                    <button type="button" className="ai-composer__btn" aria-label={t('attach')} onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                      <Icon name="paperclip" size={17} />
                    </button>
                    <input ref={fileInputRef} type="file" multiple hidden onChange={onFileInputChange} />
                    <button
                      type="button"
                      className={`ai-composer__btn${recording ? ' ai-composer__btn--recording' : ''}`}
                      aria-label={t('voice')}
                      onClick={toggleRecording}
                    >
                      <Icon name="mic" size={17} />
                    </button>
                    <button
                      type="submit"
                      className={`ai-composer__btn ${streaming ? 'ai-composer__btn--stop' : 'ai-composer__btn--send'}`}
                      disabled={!streaming && sendDisabled}
                      aria-label={streaming ? t('stop') : t('send')}
                    >
                      <Icon name={streaming ? 'stop' : 'arrow-up'} size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Error / No Permission / Service Error card (design's three states). */
function AiBanner({ banner, t, onRetry }) {
  const kind = ({ danger: 'error', warning: 'service' })[banner.kind] || banner.kind || 'error';
  const meta = {
    error: { title: t('errorTitle'), icon: 'alert', action: t('retry') },
    permission: { title: t('permissionTitle'), icon: 'info', action: null },
    service: { title: t('serviceTitle'), icon: 'refresh', action: t('tryAgain') },
  }[kind] || { title: t('errorTitle'), icon: 'alert', action: t('retry') };
  return (
    <div className={`ai-banner ai-banner--${kind}`} role="alert">
      <span className="ai-banner__icon"><Icon name={meta.icon} size={15} /></span>
      <div className="ai-banner__body"><strong>{meta.title}</strong><span>{banner.text}</span></div>
      {meta.action && onRetry && <button type="button" className="ai-banner__action" onClick={onRetry}>{meta.action}</button>}
    </div>
  );
}

function ConvItem({ c, active, open, time, onOpenMenu, onSelect, onAction, t }) {
  return (
    <div className={`ai-conv-item${active ? ' is-active' : ''}`} onClick={onSelect}>
      <span className="ai-conv-item__icon"><Icon name="message-square" size={15} /></span>
      <span className="ai-conv-item__text">
        <span className="ai-conv-item__title">{c.title}</span>
        {time && <span className="ai-conv-item__time">{time}</span>}
      </span>
      <button
        type="button"
        className={`ai-conv-item__menu-btn${open ? ' is-open' : ''}`}
        aria-label={t('menu')}
        onClick={(e) => { e.stopPropagation(); onOpenMenu(); }}
      >
        <Icon name="more-vertical" size={15} />
      </button>
      <div className={`ai-conv-menu glass-panel${open ? ' is-open' : ''}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => onAction('rename')}><Icon name="edit" size={14} />{t('rename')}</button>
        <button type="button" onClick={() => onAction('pin')}><Icon name="star" size={14} />{c.is_pinned ? t('unpin') : t('pin')}</button>
        <button type="button" onClick={() => onAction('archive')}><Icon name="archive" size={14} />{c.is_archived ? t('unarchive') : t('archive')}</button>
        <button type="button" onClick={() => onAction('export')}><Icon name="download" size={14} />{t('exportChat')}</button>
        <button type="button" className="is-danger" onClick={() => onAction('delete')}><Icon name="trash" size={14} />{t('del')}</button>
      </div>
    </div>
  );
}

function MessagesSkeleton() {
  const rows = [
    { side: 'assistant', widths: ['85%', '60%'] },
    { side: 'user', widths: ['40%'] },
    { side: 'assistant', widths: ['70%', '90%', '35%'] },
  ];
  return (
    <>
      {rows.map((row, i) => (
        <div key={i} className={`ai-msg ai-msg--${row.side} ai-msg--skeleton`}>
          <div className="ai-msg__col">
            <div className="ai-bubble">
              {row.widths.map((w, j) => <div key={j} className="skeleton skeleton-line" style={{ width: w }} />)}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function attachmentChip(a) {
  if (a.kind === 'image') {
    return (
      <a key={a.id} className="ai-attachment-chip" href={attachmentUrl(a.url)} target="_blank" rel="noopener noreferrer">
        <img src={attachmentUrl(a.url)} alt="" /><span>{a.original_name}</span>
      </a>
    );
  }
  if (a.kind === 'audio') {
    return (
      <div key={a.id} className="ai-attachment-chip" style={{ maxWidth: 260 }}>
        <audio controls src={attachmentUrl(a.url)} style={{ maxWidth: 200, height: 32 }} />
      </div>
    );
  }
  if (a.kind === 'video') {
    return (
      <a key={a.id} className="ai-attachment-chip" href={attachmentUrl(a.url)} target="_blank" rel="noopener noreferrer">
        <Icon name="file" size={14} /><span>{a.original_name} · {fmtSize(a.size_bytes)}</span>
      </a>
    );
  }
  return (
    <a key={a.id} className="ai-attachment-chip" href={attachmentUrl(a.url)} target="_blank" rel="noopener noreferrer" download={a.original_name}>
      <Icon name="file" size={14} /><span>{a.original_name} · {fmtSize(a.size_bytes)}</span>
    </a>
  );
}

function MessageBubble({ m, t, locale, copied, onAction, onCopyCode, onStop }) {
  const isUser = m.role === 'user';
  const persisted = !isTempId(m.id);
  const canRetry = !persisted && !isUser && m.status === 'error' && m.retryContent != null;
  const reactions = m.reactions || {};
  const reactionKeys = Object.keys(reactions).filter((k) => reactions[k] && reactions[k].length);
  const isStreaming = m.status === 'streaming';
  const isError = m.status === 'error';
  const waiting = isStreaming && !m.content;
  const bodyHtml = waiting ? null : renderMarkdown(m.content, t('copy'));

  function onBubbleClick(e) {
    const btn = e.target.closest('[data-copy-code]');
    if (!btn) return;
    const code = btn.nextElementSibling ? btn.nextElementSibling.textContent : '';
    onCopyCode(code, btn);
  }

  // Failed turn: the design's error card (Error / No Permission / Service Error).
  if (isError && !isUser) {
    const kind = m.errorKind || 'error';
    const title = { error: t('errorTitle'), permission: t('permissionTitle'), service: t('serviceTitle') }[kind];
    return (
      <div className="ai-msg ai-msg--assistant">
        <span className="ai-avatar ai-msg__avatar"><Icon name="sparkles" size={14} /></span>
        <div className="ai-msg__col">
          <div className={`ai-banner ai-banner--${kind} ai-banner--inline`} role="alert">
            <span className="ai-banner__icon"><Icon name={kind === 'permission' ? 'info' : kind === 'service' ? 'refresh' : 'alert'} size={15} /></span>
            <div className="ai-banner__body"><strong>{title}</strong><span>{m.content}</span></div>
            {canRetry && kind !== 'permission' && <button type="button" className="ai-banner__action" onClick={() => onAction('retry-send')}>{kind === 'service' ? t('tryAgain') : t('retry')}</button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`ai-msg ${isUser ? 'ai-msg--user' : 'ai-msg--assistant'}`}>
      {!isUser && <span className="ai-avatar ai-msg__avatar"><Icon name="sparkles" size={14} /></span>}
      <div className="ai-msg__col">
        {m.attachments && m.attachments.length > 0 && (
          <div className="ai-msg__attachments">{m.attachments.map(attachmentChip)}</div>
        )}

        {waiting ? (
          <div className="ai-status"><strong>{t('analyzing')}</strong><div className="ai-typing"><span /><span /><span /></div></div>
        ) : (
          <>
            {isStreaming && (
              <div className="ai-status ai-status--stream">
                <span className="ai-status__label">{t('streamingResponse')}</span>
                <button type="button" className="ai-stop-pill" onClick={onStop}><span className="ai-stop-pill__sq" />{t('stopShort')}</button>
              </div>
            )}
            <div className="ai-bubble" onClick={onBubbleClick}>
              <span dangerouslySetInnerHTML={{ __html: bodyHtml }} />
              {isStreaming && <span className="ai-cursor" />}
            </div>
          </>
        )}

        {!waiting && !isStreaming && (
          <div className="ai-msg__meta">
            {isUser && <span>{t('you')}{m.edited_at ? ` · ${t('edit').toLowerCase()}` : ''} · {fmtTime(m.created_at, locale)}</span>}
            {!isUser && reactionKeys.length > 0 && <span>{reactionKeys.map((k) => `${k}${reactions[k].length}`).join(' ')}</span>}
            {isUser ? (
              <div className="ai-msg__actions">
                {m.content && <button type="button" onClick={() => onAction('copy')} title={t('copy')}><Icon name={copied ? 'check' : 'copy'} size={13} /></button>}
                {persisted && <button type="button" onClick={() => onAction('edit')} title={t('edit')}><Icon name="edit" size={13} /></button>}
                {persisted && <button type="button" onClick={() => onAction('delete')} title={t('del')}><Icon name="trash" size={13} /></button>}
              </div>
            ) : (
              <div className="ai-msg__toolbar">
                {m.content && (
                  <button type="button" onClick={() => onAction('copy')}><Icon name={copied ? 'check' : 'copy'} size={13} /><span>{copied ? t('copied') : t('copy')}</span></button>
                )}
                {persisted && (
                  <button type="button" className={reactionKeys.indexOf('👍') > -1 ? 'is-active' : ''} onClick={() => onAction('react')}><Icon name="thumbs-up" size={13} /><span>{t('helpful')}</span></button>
                )}
                {persisted && <button type="button" onClick={() => onAction('regenerate')}><Icon name="refresh" size={13} /><span>{t('regenerate')}</span></button>}
                {persisted && <button type="button" className={`ai-msg__icon-only${m.is_bookmarked ? ' is-active' : ''}`} onClick={() => onAction('bookmark')} title={t('bookmark')} aria-label={t('bookmark')}><Icon name="star" size={13} /></button>}
                {persisted && <button type="button" className="ai-msg__icon-only" onClick={() => onAction('delete')} title={t('del')} aria-label={t('del')}><Icon name="trash" size={13} /></button>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
