import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ConversationRail from '../components/messaging/ConversationRail';
import ThreadPanel from '../components/messaging/ThreadPanel';
import InfoPanel from '../components/messaging/InfoPanel';
import {
  NewDirectModal,
  NewGroupModal,
  AddMemberModal,
  PinnedMessagesModal,
  ForwardModal,
  PollModal,
  Lightbox,
} from '../components/messaging/modals';
import { attachmentUrl } from '../components/messaging/format';
import { useLanguage } from '../context/LanguageContext';
import { getPortalBrand, pick } from '../config/portalBrand';

/**
 * React port of public/assets/js/messaging.js + app/Views/messaging/app.php.
 * THE single messaging UI for every portal — there is exactly one backend
 * API (/api/v1/messaging/*, App\Controllers\Common\MessagingController) and
 * this is its one React client, mounted at every role's `/*\/messages` route
 * (see navConfig.js's COMMON_ACCOUNT_ITEMS + App.jsx) instead of being
 * duplicated per portal.
 *
 * No WebSocket server on the current deployment, so new messages/typing/
 * presence are delivered by short-interval polling — same cadence as the
 * old JS (config/messaging.php's poll_interval_ms, default 4000ms):
 *   - pollActiveConversation: every pollMs
 *   - heartbeat: every pollMs * 2
 *   - loadInbox: every pollMs * 3
 *
 * Bugfix carried over from the earlier backend/API audit: the *old*
 * messaging.js read res.messages / res.typing straight off the poll
 * response, but MessagingController wraps every response as
 * {success, data: {...}} via its safe() helper — so this reads
 * res.data.messages / res.data.typing instead (the old JS's poll silently
 * never delivered live messages because of this).
 *
 * Voice recording, message forwarding, poll creation, and lightbox
 * zoom/rotate/navigation are all wired (ported from startRecording()/
 * stopRecording(), openForwardModal(), openPollModal(), and
 * openLightbox()/renderLightbox() in the old messaging.js) — along with
 * everything else (send/edit/delete, attachments, reactions, pins,
 * mentions, groups, presence, typing, search, categories,
 * favorite/mute/archive, poll voting).
 *
 * Sending GIFs/stickers is intentionally not exposed here (composer has
 * no GIF/sticker picker) — existing gif/sticker messages still render
 * fine in ThreadPanel, this only removes the ability to send new ones.
 */

const BASE = '/api/v1/messaging';
const POLL_MS = 4000;

function conversationsEqual(oldList, newList) {
  return JSON.stringify(oldList) === JSON.stringify(newList);
}

export default function Messages() {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const brand = getPortalBrand(user?.role);

  const [conversations, setConversations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const [activeId, setActiveId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [activeOthers, setActiveOthers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [presenceText, setPresenceText] = useState('');

  const [replyTarget, setReplyTarget] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  const [infoOpen, setInfoOpen] = useState(false);
  const [modal, setModal] = useState(null); // 'newDirect' | 'newGroup' | 'addMember' | 'pinned' | 'forward' | 'poll'
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [forwardMessageId, setForwardMessageId] = useState(null);

  const lastPollIdRef = useRef(0);
  const activeIdRef = useRef(null);
  const typingTimerRef = useRef(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // messaging-app.css locks .app-shell to the viewport height via this
  // body class (see its "Bugfix (2026-08-08)" comment — :has() isn't
  // supported everywhere) — the PHP view set it server-side; here it's
  // toggled for the lifetime of this page instead.
  useEffect(() => {
    document.body.classList.add('msg-page-active');
    return () => document.body.classList.remove('msg-page-active');
  }, []);

  // Mobile: while a thread is open the page chrome (title + bottom nav) is
  // hidden so the thread + composer get the whole screen (see messaging-mobile.css).
  useEffect(() => {
    document.body.classList.toggle('msg-thread-open', Boolean(activeId));
    return () => document.body.classList.remove('msg-thread-open');
  }, [activeId]);

  const onBack = useCallback(() => {
    setActiveId(null);
    setActiveConversation(null);
    setMessages([]);
    setReplyTarget(null);
    setInfoOpen(false);
  }, []);

  const showError = (err) => {
    console.error(err);
    // No toast system ported yet — surface inline via a simple alert-free
    // fallback so failures aren't silent.
    setLastError(err?.message || 'Something went wrong.');
  };
  const [lastError, setLastError] = useState('');
  useEffect(() => {
    if (!lastError) return;
    const h = setTimeout(() => setLastError(''), 4000);
    return () => clearTimeout(h);
  }, [lastError]);

  // ------------------------------------------------------------- inbox
  const loadInbox = useCallback(async (q) => {
    try {
      const res = await api.get(BASE + '/inbox', q ? { q } : undefined);
      setConversations((prev) => (conversationsEqual(prev, res.data) ? prev : res.data));
    } catch (err) {
      showError(err);
    } finally {
      setLoadingInbox(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const res = await api.get(BASE + '/categories');
      setCategories(res.data || []);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    loadInbox();
    loadCategories();
  }, [loadInbox, loadCategories]);

  // Inbox refresh poll (pollMs * 3) — skipped while the rail search is
  // showing live results for a query, same as the original.
  useEffect(() => {
    const h = setInterval(() => {
      if (!searchOpen || !searchQuery) loadInbox();
    }, POLL_MS * 3);
    return () => clearInterval(h);
  }, [loadInbox, searchOpen, searchQuery]);

  // Rail search (conversations/messages), debounced.
  useEffect(() => {
    if (!searchOpen || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const h = setTimeout(async () => {
      try {
        const res = await api.get(BASE + '/search', { q: searchQuery.trim() });
        setSearchResults(res.data || []);
      } catch (err) {
        showError(err);
      }
    }, 300);
    return () => clearTimeout(h);
  }, [searchOpen, searchQuery]);

  // ------------------------------------------------------------- thread
  const refreshPresence = useCallback(async (userIds) => {
    if (!userIds.length) return;
    try {
      const res = await api.post(BASE + '/presence/lookup', { user_ids: userIds });
      const p = res.data?.[userIds[0]];
      if (p) {
        setPresenceText(p.is_online ? 'Online' : p.last_seen_at ? `Last seen ${p.last_seen_at}` : 'Offline');
      }
    } catch {
      /* non-critical */
    }
  }, []);

  const markConversationSeenLocally = (id) => {
    setConversations((prev) => prev.map((c) => (String(c.id) === String(id) ? { ...c, is_unread: false } : c)));
  };

  const loadThread = useCallback(async (id, beforeId, isInitial) => {
    try {
      const res = await api.get(BASE + '/conversations/' + id, beforeId ? { before_id: beforeId } : undefined);
      const conversation = res.data?.conversation;
      const others = res.data?.others || [];
      setActiveConversation(conversation);
      setActiveOthers(others);
      const batch = res.data?.messages || [];
      setMessages((prev) => {
        const next = beforeId ? [...batch, ...prev] : batch;
        lastPollIdRef.current = next.length ? next[next.length - 1].id : 0;
        return next;
      });
      setHasMoreOlder(beforeId ? batch.length > 0 : batch.length >= 50);

      if (isInitial) {
        api.post(BASE + '/conversations/' + id + '/read').catch(() => {});
        markConversationSeenLocally(id);
        api
          .get(BASE + '/conversations/' + id + '/pinned')
          .then((r) => setPinnedMessages(r.data || []))
          .catch(() => {});
        if (conversation && !conversation.is_group && others?.[0]) {
          setPresenceText('Loading status…');
          refreshPresence([others[0].id]);
        }
      }
    } catch (err) {
      showError(err);
    }
  }, [refreshPresence]);

  const openConversation = useCallback((id) => {
    setActiveId(id);
    setActiveConversation(null);
    setMessages([]);
    setReplyTarget(null);
    setInfoOpen(false);
    setPresenceText('');
    loadThread(id, null, true);
  }, [loadThread]);

  const onOpenSearchResult = (m) => {
    setSearchOpen(false);
    setSearchQuery('');
    openConversation(m.conversation_id);
  };

  const onLoadOlder = () => {
    if (!activeId || !messages.length) return;
    loadThread(activeId, messages[0].id, false);
  };

  // Active-conversation poll (new messages + typing).
  useEffect(() => {
    const h = setInterval(() => {
      const id = activeIdRef.current;
      if (!id || document.hidden) return;
      api
        .get(BASE + '/conversations/' + id + '/poll', { since_id: lastPollIdRef.current })
        .then((res) => {
          const newMsgs = res.data?.messages || [];
          if (newMsgs.length) {
            setMessages((prev) => {
              const byId = new Map(prev.map((m) => [String(m.id), m]));
              newMsgs.forEach((m) => byId.set(String(m.id), m));
              const merged = Array.from(byId.values());
              lastPollIdRef.current = merged.length ? merged[merged.length - 1].id : lastPollIdRef.current;
              return merged;
            });
            api.post(BASE + '/conversations/' + id + '/read').catch(() => {});
          }
          setTypingUsers(res.data?.typing || []);
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(h);
  }, []);

  // Presence heartbeat.
  useEffect(() => {
    const h = setInterval(() => {
      api.post(BASE + '/presence/heartbeat').catch(() => {});
    }, POLL_MS * 2);
    return () => clearInterval(h);
  }, []);

  const onNotifyTyping = useCallback(() => {
    if (!activeId) return;
    clearTimeout(typingTimerRef.current);
    api.post(BASE + '/presence/typing', { conversation_id: activeId }).catch(() => {});
    typingTimerRef.current = setTimeout(() => {
      api.post(BASE + '/presence/typing', { conversation_id: null }).catch(() => {});
    }, 3000);
  }, [activeId]);

  // ------------------------------------------------------------- composer
  const onAddFiles = (fileList) => {
    const files = Array.from(fileList).map((file) => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));
    setPendingFiles((prev) => [...prev, ...files]);
  };
  const onRemoveFile = (i) => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i));

  const onSend = async (body) => {
    if (!activeId) return;
    const fd = new FormData();
    fd.append('body', body);
    if (replyTarget) fd.append('parent_message_id', replyTarget.id);
    pendingFiles.forEach((pf) => fd.append('attachments[]', pf.file));
    setPendingFiles([]);
    setReplyTarget(null);
    try {
      const res = await api.postForm(BASE + '/conversations/' + activeId + '/messages', fd);
      setMessages((prev) => [...prev, res.data]);
      lastPollIdRef.current = res.data.id;
      loadInbox();
    } catch (err) {
      showError(err);
    }
  };

  const onEditMessage = async (id, body) => {
    try {
      const res = await api.post(BASE + '/messages/' + id + '/edit', { body });
      setMessages((prev) => prev.map((m) => (m.id === id ? res.data : m)));
    } catch (err) {
      showError(err);
    }
  };

  const onDeleteMessage = async (id, mode) => {
    try {
      if (mode === 'for-everyone') await api.del(BASE + '/messages/' + id + '/for-everyone');
      else await api.del(BASE + '/messages/' + id + '/for-me');
      if (mode === 'for-everyone') {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_deleted: true, body: null } : m)));
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (err) {
      showError(err);
    }
  };

  const onReact = async (id, emoji) => {
    try {
      const res = await api.post(BASE + '/messages/' + id + '/react', { emoji });
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, reactions: res.data.reactions ?? res.data } : m)));
    } catch (err) {
      showError(err);
    }
  };

  const onPin = async (m) => {
    try {
      await api.post(BASE + '/messages/' + m.id + '/' + (m.is_pinned ? 'unpin' : 'pin'));
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_pinned: !m.is_pinned } : x)));
      const r = await api.get(BASE + '/conversations/' + activeId + '/pinned');
      setPinnedMessages(r.data || []);
    } catch (err) {
      showError(err);
    }
  };

  const onVote = async (id, optionIndex) => {
    try {
      const res = await api.post(BASE + '/messages/' + id + '/vote', { option_index: optionIndex });
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...res.data } : m)));
    } catch (err) {
      showError(err);
    }
  };

  // ------------------------------------------------------------- voice
  // Ported from stopRecording(true)'s upload path in messaging.js.
  const onSendVoice = async (file) => {
    if (!activeId) return;
    const fd = new FormData();
    fd.append('body', '');
    fd.append('attachments[]', file, file.name);
    try {
      const res = await api.postForm(BASE + '/conversations/' + activeId + '/messages', fd);
      setMessages((prev) => [...prev, res.data]);
      lastPollIdRef.current = res.data.id;
      loadInbox();
    } catch (err) {
      showError(err);
    }
  };

  // ------------------------------------------------------------- forward
  // Ported from openForwardModal() in messaging.js.
  const onForwardMessage = (messageId) => {
    setForwardMessageId(messageId);
    setModal('forward');
  };

  const submitForward = async (targetConversationId) => {
    const fd = new FormData();
    fd.append('body', '');
    fd.append('forwarded_from_id', forwardMessageId);
    await api.postForm(BASE + '/conversations/' + targetConversationId + '/messages', fd);
    setModal(null);
    setForwardMessageId(null);
    loadInbox();
    if (String(targetConversationId) === String(activeId)) {
      loadThread(activeId, null, false);
    }
  };

  // ------------------------------------------------------------- poll
  // Ported from openPollModal() in messaging.js.
  const createPoll = async ({ question, options }) => {
    if (!activeId) return;
    const res = await api.post(BASE + '/conversations/' + activeId + '/poll-message', { question, options });
    setMessages((prev) => [...prev, res.data]);
    lastPollIdRef.current = res.data.id;
    setModal(null);
  };

  // All image attachments currently loaded in the thread, for the
  // lightbox's prev/next navigation — same source set as messaging.js's
  // querySelectorAll("[data-lightbox-src]").
  const lightboxImages = useMemo(
    () =>
      messages.flatMap((m) =>
        (m.attachments || []).filter((a) => a.kind === 'image').map((a) => attachmentUrl(a.url))
      ),
    [messages]
  );

  // ------------------------------------------------------------- info panel
  const convMeta = conversations.find((c) => String(c.id) === String(activeId));

  const onToggleFlag = async (flag, value) => {
    if (!activeId) return;
    setConversations((prev) =>
      prev.map((c) => (String(c.id) === String(activeId) ? { ...c, [`is_${flag === 'favorite' ? 'favorite' : flag === 'pin' ? 'pinned' : flag === 'mute' ? 'muted' : 'archived'}`]: value } : c))
    );
    try {
      await api.post(BASE + '/conversations/' + activeId + '/flags/' + flag, { value });
    } catch (err) {
      showError(err);
      loadInbox();
    }
  };

  const onSetCategory = async (category) => {
    if (!activeId) return;
    try {
      await api.post(BASE + '/conversations/' + activeId + '/category', { category });
      loadInbox();
    } catch (err) {
      showError(err);
    }
  };

  const onRenameGroup = async (name) => {
    if (!activeId) return;
    try {
      await api.post(BASE + '/conversations/' + activeId + '/rename', { name });
      setActiveConversation((prev) => (prev ? { ...prev, subject: name } : prev));
      loadInbox();
    } catch (err) {
      showError(err);
    }
  };

  const onAddMember = async (userId) => {
    if (!activeId) return;
    await api.post(BASE + '/conversations/' + activeId + '/members', { user_id: userId });
    loadThread(activeId, null, false);
  };

  const onRemoveMember = async (userId) => {
    if (!activeId) return;
    try {
      await api.del(BASE + '/conversations/' + activeId + '/members/' + userId);
      loadThread(activeId, null, false);
    } catch (err) {
      showError(err);
    }
  };

  // ------------------------------------------------------------- modals
  const searchRecipients = async (q) => {
    const res = await api.get(BASE + '/recipients', { q });
    return res.data || [];
  };

  const createDirect = async ({ recipient_email, body }) => {
    const res = await api.post(BASE + '/conversations/direct', { recipient_email, body });
    setModal(null);
    loadInbox();
    setTimeout(() => openConversation(res.data.conversation.id), 150);
  };

  const createGroup = async ({ name, member_ids }) => {
    const res = await api.post(BASE + '/conversations/group', { name, member_ids });
    setModal(null);
    loadInbox();
    setTimeout(() => openConversation(res.data.conversation.id), 150);
  };

  const onShowPinned = async () => {
    if (!activeId) return;
    try {
      const res = await api.get(BASE + '/conversations/' + activeId + '/pinned');
      setPinnedMessages(res.data || []);
      setModal('pinned');
    } catch (err) {
      showError(err);
    }
  };

  const onGoToMessage = (id) => {
    setModal(null);
    const el = document.querySelector(`[data-msg-id="${id}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  return (
    <>
    <div className="page-header msg-page-header">
      <div className="page-header__title">
        <h1>{locale === 'ar' ? 'الرسائل' : 'Messages'}</h1>
        <p>{pick(brand.messages, locale)}</p>
      </div>
    </div>
    <div className={`msg-app${infoOpen ? ' has-info' : ''}${activeId ? ' thread-open' : ''}`} data-msg-app>
      <ConversationRail
        conversations={conversations}
        categories={categories}
        filter={filter}
        setFilter={setFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        activeId={activeId}
        onOpen={openConversation}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchResults={searchResults}
        onOpenSearchResult={onOpenSearchResult}
        onNewDirect={() => setModal('newDirect')}
        onNewGroup={() => setModal('newGroup')}
        loading={loadingInbox}
      />

      <ThreadPanel
        conversation={activeConversation}
        others={activeOthers}
        messages={messages}
        hasMoreOlder={hasMoreOlder}
        onLoadOlder={onLoadOlder}
        pinnedCount={pinnedMessages.length}
        onShowPinned={onShowPinned}
        presenceText={presenceText}
        replyTarget={replyTarget}
        onSetReply={setReplyTarget}
        onCancelReply={() => setReplyTarget(null)}
        pendingFiles={pendingFiles}
        onAddFiles={onAddFiles}
        onRemoveFile={onRemoveFile}
        onSend={onSend}
        onEditMessage={onEditMessage}
        onDeleteMessage={onDeleteMessage}
        onReact={onReact}
        onPin={onPin}
        onVote={onVote}
        typingUsers={typingUsers}
        onOpenInfo={() => setInfoOpen((o) => !o)}
        onBack={onBack}
        onOpenLightbox={setLightboxSrc}
        onNotifyTyping={onNotifyTyping}
        onForwardMessage={onForwardMessage}
        onOpenPollModal={() => setModal('poll')}
        onSendVoice={onSendVoice}
        onError={showError}
      />

      {infoOpen && activeConversation && (
        <InfoPanel
          conversation={activeConversation}
          convMeta={convMeta}
          others={activeOthers}
          messages={messages}
          myUserId={user?.id}
          onToggleFlag={onToggleFlag}
          onSetCategory={onSetCategory}
          onRenameGroup={onRenameGroup}
          onAddMember={() => setModal('addMember')}
          onRemoveMember={onRemoveMember}
          onClose={() => setInfoOpen(false)}
        />
      )}

      {modal === 'newDirect' && (
        <NewDirectModal onClose={() => setModal(null)} onSearchRecipients={searchRecipients} onSubmit={createDirect} />
      )}
      {modal === 'newGroup' && (
        <NewGroupModal onClose={() => setModal(null)} onSearchRecipients={searchRecipients} onSubmit={createGroup} />
      )}
      {modal === 'addMember' && (
        <AddMemberModal onClose={() => setModal(null)} onSearchRecipients={searchRecipients} onSubmit={onAddMember} />
      )}
      {modal === 'pinned' && (
        <PinnedMessagesModal pinned={pinnedMessages} onClose={() => setModal(null)} onGoToMessage={onGoToMessage} />
      )}
      {modal === 'forward' && (
        <ForwardModal
          conversations={conversations}
          onClose={() => { setModal(null); setForwardMessageId(null); }}
          onForward={submitForward}
        />
      )}
      {modal === 'poll' && <PollModal onClose={() => setModal(null)} onSubmit={createPoll} />}
      {lightboxSrc && (
        <Lightbox images={lightboxImages} initialSrc={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}

      {lastError && <div className="msg-toast msg-toast--error" role="alert">{lastError}</div>}
    </div>
    </>
  );
}
