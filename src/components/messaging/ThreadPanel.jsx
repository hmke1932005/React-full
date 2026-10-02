import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon';
import MsgIcon from './msgIcons';
import { Avatar } from './ConversationRail';
import { fmtTime, fmtDayLabel, fmtBytes, fmtDuration, fmtClock, peerLabel, renderBody, attachmentUrl } from './format';

const EMOJI_SET = [
  '😀', '😂', '🥰', '😎', '🤔', '😢', '😮', '😡', '👍', '👎',
  '🙏', '👏', '🔥', '🎉', '❤️', '💯', '✅', '❌', '🚀', '⭐',
  '😴', '🤝', '👀', '💡', '📌', '⚡', '🙌', '😅', '🤯', '🥳',
];

function MessageBubble({ m, showAvatar, others, onReply, onEdit, onDelete, onReact, onPin, onVote, onOpenLightbox, onForward, editingId, onStartEdit, onSaveEdit, onCancelEdit }) {
  const [showReactPicker, setShowReactPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [editValue, setEditValue] = useState(m.body || '');
  const isEditing = editingId === m.id;

  if (m.is_deleted) {
    return (
      <div className={`msg-row${m.is_mine ? ' is-mine' : ' show-avatar'}`} data-msg-id={m.id}>
        {showAvatar && !m.is_mine ? <Avatar name={m.sender_name} size="sm" /> : null}
        <div className="msg-bubble-col">
          <div className="msg-bubble msg-bubble--deleted">This message was deleted</div>
        </div>
      </div>
    );
  }

  let isMedia = false;
  let body = null;
  if (m.message_type === 'poll' && m.metadata) {
    const results = m.pollResults || {};
    const total = Object.values(results).reduce((s, v) => s + v, 0);
    body = (
      <div className="msg-poll" data-poll-msg-id={m.id}>
        <div className="msg-poll__q">
          <MsgIcon name="poll" size={14} /> {m.metadata.question}
        </div>
        {(m.metadata.options || []).map((opt, idx) => {
          const count = results[idx] || 0;
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <button type="button" className="msg-poll__opt" key={idx} onClick={() => onVote(m.id, idx)}>
              <span className="msg-poll__opt-fill" style={{ width: pct + '%' }} />
              <span className="msg-poll__opt-label">
                <span>{opt}</span>
                <span>{count}</span>
              </span>
            </button>
          );
        })}
        <div className="msg-poll__total">{total} votes</div>
      </div>
    );
  } else if (m.message_type === 'gif' && m.metadata) {
    isMedia = true;
    body = <img className="msg-gif-img" src={m.metadata.url} alt={m.metadata.title || 'GIF'} loading="lazy" />;
  } else if (m.message_type === 'sticker' && m.metadata) {
    isMedia = true;
    body = <img className="msg-sticker-img" src={m.metadata.url} alt={m.metadata.label || 'Sticker'} loading="lazy" />;
  } else {
    body = (
      <>
        {m.parent_message_id && (
          <div className="msg-reply-quote">
            <strong>{m.parent_sender_name || ''}</strong>
            <span>{(m.parent_body || '').slice(0, 80)}</span>
          </div>
        )}
        {m.forwarded_from_id && (
          <div className="msg-forward-tag">
            <MsgIcon name="forward" size={11} /> Forwarded
          </div>
        )}
        {m.body ? <div>{renderBody(m.body, others)}</div> : null}
        {m.attachments && m.attachments.length > 0 && (
          <MessageAttachments attachments={m.attachments} onOpenLightbox={onOpenLightbox} />
        )}
      </>
    );
  }

  const canEdit = m.is_mine && (!m.message_type || m.message_type === 'text');

  return (
    <div className={`msg-row${m.is_mine ? ' is-mine' : ''}${showAvatar ? ' show-avatar' : ''}`} data-msg-id={m.id}>
      {!m.is_mine ? <Avatar name={m.sender_name} size="sm" /> : null}
      <div className="msg-bubble-col">
        {showAvatar && !m.is_mine ? <span className="msg-sender-name">{m.sender_name}</span> : null}
        <div className={`msg-bubble${isMedia ? ' msg-bubble--media' : ''}`} style={{ position: 'relative' }}>
          <div className="msg-hover-actions">
            <button type="button" title="React" onClick={() => setShowReactPicker((s) => !s)}>
              <MsgIcon name="react" size={14} />
            </button>
            <button type="button" title="Reply" onClick={() => onReply(m)}>
              <MsgIcon name="reply" size={14} />
            </button>
            <button type="button" title="Forward" onClick={() => onForward(m.id)}>
              <MsgIcon name="forward" size={14} />
            </button>
            {canEdit && (
              <button type="button" title="Edit" onClick={() => onStartEdit(m.id)}>
                <Icon name="edit" size={14} />
              </button>
            )}
            <button type="button" title={m.is_pinned ? 'Unpin' : 'Pin'} onClick={() => onPin(m)}>
              <MsgIcon name="pin" size={14} />
            </button>
            <button type="button" title="More" onClick={() => setShowMoreMenu((s) => !s)}>
              <MsgIcon name="more" size={14} />
            </button>
          </div>

          {showReactPicker && (
            <div className="msg-reaction-picker">
              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((e) => (
                <button
                  type="button"
                  key={e}
                  onClick={() => {
                    onReact(m.id, e);
                    setShowReactPicker(false);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {showMoreMenu && (
            <div className="msg-menu__panel is-open" style={{ position: 'absolute', top: '100%', insetInlineEnd: 0, zIndex: 20 }}>
              {m.is_mine && (
                <button
                  type="button"
                  className="msg-menu__item"
                  onClick={() => {
                    onDelete(m.id, 'for-everyone');
                    setShowMoreMenu(false);
                  }}
                >
                  Delete for everyone
                </button>
              )}
              <button
                type="button"
                className="msg-menu__item"
                onClick={() => {
                  onDelete(m.id, 'for-me');
                  setShowMoreMenu(false);
                }}
              >
                Delete for me
              </button>
            </div>
          )}

          {isEditing ? (
            <div>
              <textarea
                className="msg-edit-textarea"
                style={{ width: '100%', minHeight: 60, background: 'transparent', border: '1px solid currentColor', borderRadius: 8, padding: 6, color: 'inherit', font: 'inherit' }}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button type="button" className="btn btn-sm btn-outline" onClick={onCancelEdit}>Cancel</button>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => onSaveEdit(m.id, editValue.trim())}>Save</button>
              </div>
            </div>
          ) : (
            body
          )}
        </div>

        {m.reactions && m.reactions.length > 0 && (
          <div className="msg-reactions">
            {m.reactions.map((r) => (
              <button
                type="button"
                key={r.emoji}
                className="msg-reaction-pill"
                title={(r.users || []).map((u) => u.full_name).join(', ')}
                onClick={() => onReact(m.id, r.emoji)}
              >
                {r.emoji} <span>{r.count}</span>
              </button>
            ))}
          </div>
        )}

        <div className="msg-meta-row">
          {m.is_pinned ? <MsgIcon name="pin" size={11} /> : null}
          <span>
            {fmtTime(m.created_at)}
            {m.is_edited ? <span className="msg-edited-tag">(edited)</span> : null}
          </span>
        </div>
      </div>
    </div>
  );
}

function MessageAttachments({ attachments, onOpenLightbox }) {
  const images = attachments.filter((a) => a.kind === 'image');
  const others = attachments.filter((a) => a.kind !== 'image');
  return (
    <div className="msg-attachments">
      {images.length > 0 && (
        <div className={`msg-attach-image-grid${images.length === 1 ? ' single' : ''}`}>
          {images.map((a, i) => (
            <img key={i} src={attachmentUrl(a.url)} alt={a.original_name} onClick={() => onOpenLightbox(attachmentUrl(a.url))} style={{ cursor: 'zoom-in' }} />
          ))}
        </div>
      )}
      {others.map((a, i) => {
        if (a.kind === 'video') {
          return (
            <div className="msg-attach-video" key={i}>
              <video controls preload="metadata" poster={a.thumbnail_url ? attachmentUrl(a.thumbnail_url) : undefined} src={attachmentUrl(a.url)} />
              {a.duration_seconds ? <span className="msg-attach-video__duration">{fmtDuration(a.duration_seconds)}</span> : null}
            </div>
          );
        }
        if (a.kind === 'audio') {
          return (
            <div className="msg-audio-player" key={i}>
              <audio preload="metadata" src={attachmentUrl(a.url)} controls />
            </div>
          );
        }
        return (
          <a className="msg-attach-file" key={i} href={attachmentUrl(a.url)} download={a.original_name} target="_blank" rel="noopener noreferrer">
            <span className="msg-attach-file__icon">
              <Icon name="file" size={16} />
            </span>
            <span className="msg-attach-file__meta">
              <span className="msg-attach-file__name">{a.original_name}</span>
              <span className="msg-attach-file__size">{fmtBytes(a.size_bytes)}</span>
            </span>
          </a>
        );
      })}
    </div>
  );
}

export default function ThreadPanel({
  conversation,
  others,
  messages,
  hasMoreOlder,
  onLoadOlder,
  pinnedCount,
  onShowPinned,
  presenceText,
  replyTarget,
  onSetReply,
  onCancelReply,
  pendingFiles,
  onAddFiles,
  onRemoveFile,
  onSend,
  onEditMessage,
  onDeleteMessage,
  onReact,
  onPin,
  onVote,
  typingUsers,
  onOpenInfo,
  onOpenLightbox,
  onNotifyTyping,
  onForwardMessage,
  onOpenPollModal,
  onSendVoice,
  onError,
}) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState('00:00');
  const fileInputRef = useRef(null);
  const composerInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStartRef = useRef(0);
  const recordingTimerRef = useRef(null);
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const prevMessageCount = useRef(0);
  const emojiWrapRef = useRef(null);
  const emojiPopoverRef = useRef(null);

  // Close the emoji popover on an outside click, and on Escape — without
  // this the only way to close it was toggling the same toolbar button
  // again, which is easy to miss (e.g. after sending a message the
  // popover just stays open with no obvious way out).
  useEffect(() => {
    if (!showEmoji) return;
    const onPointerDown = (e) => {
      if (
        !emojiWrapRef.current?.contains(e.target) &&
        !emojiPopoverRef.current?.contains(e.target)
      ) {
        setShowEmoji(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowEmoji(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showEmoji]);

  useEffect(() => {
    // Scroll to bottom on conversation switch / new own message. Skip when
    // a "load older" prepended messages (handled by ThreadPanel's parent
    // keeping scroll position naturally since older messages render above).
    if (messages.length > prevMessageCount.current) {
      const box = scrollRef.current;
      if (box) {
        const wasNearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 150;
        if (wasNearBottom || prevMessageCount.current === 0) {
          bottomRef.current?.scrollIntoView({ block: 'end' });
        }
      }
    }
    prevMessageCount.current = messages.length;
  }, [messages]);

  // Stop any in-progress recording if the thread unmounts / switches.
  useEffect(() => {
    return () => {
      clearInterval(recordingTimerRef.current);
      recordingStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, [conversation]);

  if (!conversation) {
    return (
      <section className="msg-thread" data-thread-panel>
        <div className="msg-thread__empty" data-thread-empty>
          <div className="msg-thread__empty-icon">
            <Icon name="message" size={32} />
          </div>
          <p>Select a conversation to start messaging</p>
        </div>
      </section>
    );
  }

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && pendingFiles.length === 0) return;
    onSend(trimmed);
    setText('');
    setShowEmoji(false);
  };

  // ------------------------------------------------------- bold/markdown
  // Ported from wrapSelection() in messaging.js, adapted for a plain
  // <textarea> composer (the original wrapped a contenteditable div's
  // live browser selection via document.execCommand("insertText", ...)).
  // Same net effect: wrap the current selection in `marker`, or insert
  // an empty `marker+marker` pair with the cursor left in the middle
  // when nothing is selected — renderBody() in format.jsx already turns
  // **text** into <strong>.
  const wrapSelection = (marker) => {
    const el = composerInputRef.current;
    const start = el ? el.selectionStart ?? text.length : text.length;
    const end = el ? el.selectionEnd ?? text.length : text.length;
    const selected = text.slice(start, end);
    const next = text.slice(0, start) + marker + selected + marker + text.slice(end);
    setText(next);
    const cursor = start + marker.length + selected.length + (selected ? marker.length : 0);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(cursor, cursor);
    });
  };

  // ------------------------------------------------------- voice recording
  // Ported from startRecording()/stopRecording() in messaging.js.
  const startRecording = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onError?.(new Error('Voice messages need microphone access, which this browser cannot provide here.'));
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        recordingStreamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        recordingChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size) recordingChunksRef.current.push(e.data);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        recordingStartRef.current = Date.now();
        setIsRecording(true);
        setRecordingTime('00:00');
        recordingTimerRef.current = setInterval(() => {
          setRecordingTime(fmtClock((Date.now() - recordingStartRef.current) / 1000));
        }, 500);
      })
      .catch(() => {
        onError?.(new Error('Microphone permission was denied.'));
      });
  };

  const stopRecording = (send) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    recorder.onstop = () => {
      recordingStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      if (!send) return;
      const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
      if (blob.size < 300) {
        onError?.(new Error('Recording was too short.'));
        return;
      }
      const file = new File([blob], `voice-message-${Date.now()}.webm`, { type: 'audio/webm' });
      onSendVoice(file);
    };
    recorder.stop();
  };

  let lastDay = null;
  let lastSenderId = null;
  let lastTs = 0;

  return (
    <section className="msg-thread" data-thread-panel>
      <div className="msg-thread__active" data-thread-active>
        <header className="msg-thread__header">
          <div className="msg-thread__peer" data-action="open-info" onClick={onOpenInfo} style={{ cursor: 'pointer' }}>
            <Avatar name={peerLabel(conversation)} isGroup={conversation.is_group} />
            <div className="msg-thread__peer-meta">
              <strong>{peerLabel(conversation)}</strong>
              <span className="msg-thread__status">
                {conversation.is_group ? `${others.length + 1} members` : presenceText}
              </span>
            </div>
          </div>
          <div className="msg-thread__header-actions">
            <button type="button" className="msg-icon-btn" title="Pinned messages" onClick={onShowPinned}>
              <MsgIcon name="pin" size={17} />
            </button>
            <button type="button" className="msg-icon-btn" title="Info" onClick={onOpenInfo}>
              <Icon name="users" size={17} />
            </button>
          </div>
        </header>

        {pinnedCount > 0 && (
          <div className="msg-thread__pinned-bar" onClick={onShowPinned} style={{ cursor: 'pointer' }}>
            <MsgIcon name="pin" size={14} /> <strong>{pinnedCount}</strong> pinned message{pinnedCount > 1 ? 's' : ''}
            <button type="button" className="msg-icon-btn msg-icon-btn--sm" style={{ marginInlineStart: 'auto' }}>View</button>
          </div>
        )}

        <div className="msg-thread__scroll" data-message-list ref={scrollRef}>
          {hasMoreOlder && (
            <button type="button" className="msg-load-older" onClick={onLoadOlder}>Load older messages</button>
          )}
          <div className="msg-messages" data-messages>
            {messages.length === 0 ? (
              <div className="msg-empty-state">No messages yet — say hello!</div>
            ) : (
              messages.map((m) => {
                const day = m.created_at ? m.created_at.slice(0, 10) : '';
                const nodes = [];
                if (day !== lastDay) {
                  nodes.push(
                    <div className="msg-day-sep" key={`day-${day}-${m.id}`}>
                      <span>{fmtDayLabel(m.created_at)}</span>
                    </div>
                  );
                  lastDay = day;
                  lastSenderId = null;
                }
                const ts = m.created_at ? new Date(m.created_at.replace(' ', 'T')).getTime() : 0;
                const showAvatar = m.sender_id !== lastSenderId || ts - lastTs > 5 * 60000;
                lastSenderId = m.sender_id;
                lastTs = ts;
                nodes.push(
                  <MessageBubble
                    key={m.id}
                    m={m}
                    showAvatar={showAvatar}
                    others={others}
                    onReply={onSetReply}
                    onDelete={onDeleteMessage}
                    onReact={onReact}
                    onPin={onPin}
                    onVote={onVote}
                    onOpenLightbox={onOpenLightbox}
                    onForward={onForwardMessage}
                    editingId={editingId}
                    onStartEdit={setEditingId}
                    onCancelEdit={() => setEditingId(null)}
                    onSaveEdit={(id, body) => {
                      onEditMessage(id, body);
                      setEditingId(null);
                    }}
                  />
                );
                return nodes;
              })
            )}
          </div>
          {typingUsers.length > 0 && (
            <div className="msg-typing">
              <span className="msg-typing-dots"><span /><span /><span /></span>{' '}
              {typingUsers.map((u) => u.full_name).join(', ')} typing…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {replyTarget && (
          <div className="msg-reply-preview">
            <div className="msg-reply-preview__body">
              <strong>Replying to {replyTarget.sender_name}</strong>
              <span>{replyTarget.body || '(attachment)'}</span>
            </div>
            <button type="button" className="msg-icon-btn msg-icon-btn--sm" onClick={onCancelReply}>
              <Icon name="x" size={14} />
            </button>
          </div>
        )}

        {pendingFiles.length > 0 && (
          <div className="msg-upload-preview">
            {pendingFiles.map((pf, i) => (
              <div className="msg-upload-item" key={i}>
                {pf.previewUrl ? <img src={pf.previewUrl} alt="" /> : <div className="msg-upload-item__name">{pf.file.name.slice(0, 14)}</div>}
                <button type="button" className="msg-upload-item__remove" onClick={() => onRemoveFile(i)}>&times;</button>
              </div>
            ))}
          </div>
        )}

        <form
          className="msg-composer"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <div className="msg-composer__toolbar">
            <button type="button" className="msg-icon-btn" title="Attach file" onClick={() => fileInputRef.current?.click()}>
              <MsgIcon name="paperclip" size={18} />
            </button>
            <input
              type="file"
              multiple
              hidden
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files?.length) onAddFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <div className="msg-composer__popover-wrap" ref={emojiWrapRef}>
              <button
                type="button"
                className="msg-icon-btn"
                title="Emoji"
                onClick={() => setShowEmoji((s) => !s)}
              >
                <MsgIcon name="smile" size={18} />
              </button>
            </div>
            <button type="button" className="msg-icon-btn" title="Markdown" onClick={() => wrapSelection('**')}>
              <MsgIcon name="bold" size={18} />
            </button>
            <button type="button" className="msg-icon-btn" title="Poll" onClick={onOpenPollModal}>
              <MsgIcon name="poll" size={18} />
            </button>
            <button
              type="button"
              className={`msg-icon-btn msg-composer__record${isRecording ? ' is-recording' : ''}`}
              title="Voice message"
              onClick={() => (isRecording ? stopRecording(false) : startRecording())}
            >
              <MsgIcon name="mic" size={18} />
            </button>
          </div>
          <div className="msg-composer__input-row">
            <textarea
              className="msg-composer__input"
              data-composer-input
              ref={composerInputRef}
              placeholder="Type a message…"
              rows={1}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                onNotifyTyping();
              }}
              onKeyDown={(e) => {
                // Guard against IME composition (Arabic predictive-text /
                // any composed-input keyboard): while a candidate is being
                // composed, the virtual keyboard's "confirm suggestion" key
                // also fires a native Enter keydown. Without this check that
                // was sending the message mid-composition — before the rest
                // of what was typed even landed in the field — which is why
                // sent messages could come through as just one or two
                // characters. e.keyCode === 229 is the classic fallback for
                // browsers that don't set isComposing on the event itself.
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            {showEmoji && (
              <div className="msg-emoji-popover" ref={emojiPopoverRef}>
                <button type="button" className="msg-popover__close" aria-label="Close" onClick={() => setShowEmoji(false)}>
                  <Icon name="x" size={13} />
                </button>
                {EMOJI_SET.map((e) => (
                  <button type="button" key={e} onClick={() => setText((t) => t + e)}>{e}</button>
                ))}
              </div>
            )}
            <button type="submit" className="msg-send-btn" aria-label="Send">
              <MsgIcon name="send" size={18} />
            </button>
          </div>
          {isRecording && (
            <div className="msg-composer__recording">
              <span className="msg-rec-dot" />
              <span>{recordingTime}</span>
              <span className="msg-waveform-live" />
              <button type="button" className="msg-icon-btn" title="Cancel recording" aria-label="Cancel recording" onClick={() => stopRecording(false)}>
                <Icon name="x" size={16} />
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => stopRecording(true)}>Send</button>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
