import { useEffect, useState } from 'react';
import Icon from '../Icon';
import { Avatar } from './ConversationRail';
import { attachmentUrl, fmtBytes } from './format';

/**
 * Right-hand info panel — ported from renderInfoPanel()/infoToggleRow() in
 * messaging.js. Same sections, same order: group rename (group only),
 * favorite/pin/mute/archive toggles, category input, members list (with
 * remove-member for owners/admins of a group), shared files.
 *
 * `convMeta` is the conversation's row from the inbox list (carries the
 * per-member flags/category — those live there, not on the thread's
 * `conversation` object, same split the original state had between
 * state.activeConversation and findConv()).
 */
export default function InfoPanel({
  conversation,
  convMeta,
  others,
  messages,
  myUserId,
  onToggleFlag,
  onSetCategory,
  onRenameGroup,
  onAddMember,
  onRemoveMember,
  onClose,
}) {
  const [groupName, setGroupName] = useState(conversation?.subject || '');
  const [category, setCategory] = useState(convMeta?.category || '');

  useEffect(() => {
    setGroupName(conversation?.subject || '');
  }, [conversation?.id, conversation?.subject]);

  useEffect(() => {
    setCategory(convMeta?.category || '');
  }, [conversation?.id, convMeta?.category]);

  if (!conversation) return null;

  const iAmAdmin = conversation.my_role === 'owner' || conversation.my_role === 'admin';
  const members = conversation.is_group ? others : others;

  const files = [];
  messages.forEach((m) => (m.attachments || []).forEach((a) => files.push(a)));
  const recentFiles = files.slice(-8).reverse();

  const flags = [
    { key: 'favorite', label: 'Favorite', on: !!convMeta?.is_favorite },
    { key: 'pin', label: 'Pin conversation', on: !!convMeta?.is_pinned },
    { key: 'mute', label: 'Mute notifications', on: !!convMeta?.is_muted },
    { key: 'archive', label: 'Archive', on: !!convMeta?.is_archived },
  ];

  return (
    <aside className="msg-info" data-info-panel>
      <div className="msg-info__head">
        <strong className="text-h4">Conversation info</strong>
        <button type="button" className="msg-icon-btn" onClick={onClose} aria-label="Close">
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="msg-info__body" data-info-body>
        {conversation.is_group && (
          <div>
            <div className="msg-info__section-title">Group name</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={groupName}
                disabled={!iAmAdmin}
                onChange={(e) => setGroupName(e.target.value)}
              />
              {iAmAdmin && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => groupName.trim() && onRenameGroup(groupName.trim())}
                >
                  Save
                </button>
              )}
            </div>
          </div>
        )}

        <div>
          {flags.map((f) => (
            <div className="msg-info__toggle-row" key={f.key}>
              <span>{f.label}</span>
              <button
                type="button"
                className={`msg-switch${f.on ? ' is-on' : ''}`}
                onClick={() => onToggleFlag(f.key, !f.on)}
                aria-pressed={f.on}
              />
            </div>
          ))}
        </div>

        <div>
          <div className="msg-info__section-title">Category</div>
          <input
            type="text"
            value={category}
            placeholder="e.g. Projects, Support…"
            onChange={(e) => setCategory(e.target.value)}
            onBlur={() => onSetCategory(category.trim() || null)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </div>

        <div>
          <div className="msg-info__section-title">
            Members{conversation.is_group ? ` (${members.length + 1})` : ''}
          </div>
          {conversation.is_group && (
            <div className="msg-info__member">
              <Avatar name="You" size="sm" />
              <span className="msg-info__member-meta">
                <strong>You</strong>
                <span className="msg-info__member-role">{conversation.my_role || 'member'}</span>
              </span>
            </div>
          )}
          {members.map((p) => (
            <div className="msg-info__member" key={p.id}>
              <Avatar name={p.full_name} size="sm" />
              <span className="msg-info__member-meta">
                <strong>{p.full_name}</strong>
                <span className="msg-info__member-role">
                  {conversation.is_group ? p.role || 'member' : p.org || ''}
                </span>
              </span>
              {conversation.is_group && iAmAdmin && String(p.id) !== String(myUserId) && (
                <button type="button" className="msg-icon-btn msg-icon-btn--sm" onClick={() => onRemoveMember(p.id)}>
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>
          ))}
          {conversation.is_group && iAmAdmin && (
            <button type="button" className="btn btn-outline btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={onAddMember}>
              + Add member
            </button>
          )}
        </div>

        <div>
          <div className="msg-info__section-title">Shared files</div>
          {recentFiles.length === 0 ? (
            <p className="text-small text-muted">No files shared yet.</p>
          ) : (
            recentFiles.map((a, i) => (
              <a className="msg-info__file" key={i} href={attachmentUrl(a.url)} target="_blank" rel="noopener noreferrer">
                {a.kind === 'image' ? (
                  <img src={attachmentUrl(a.url)} alt={a.original_name} />
                ) : (
                  <span className="msg-info__file-icon">
                    <Icon name="file" size={16} />
                  </span>
                )}
                <span className="msg-info__file-name">{a.original_name}</span>
                <span className="msg-info__file-size">{fmtBytes(a.size_bytes)}</span>
              </a>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
