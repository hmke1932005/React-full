import Icon from '../Icon';
import MsgIcon from './msgIcons';
import { initials, fmtTime, peerLabel } from './format';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'favorite', label: 'Favorites' },
  { key: 'pinned', label: 'Pinned' },
  { key: 'group', label: 'Groups' },
  { key: 'archived', label: 'Archived' },
];

// Stable pastel tone per person (0-4) so each avatar keeps its color.
function toneOf(name) {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) % 5;
  return h;
}

function Avatar({ name, isGroup, size }) {
  return (
    <span className={`msg-avatar msg-avatar--tone-${toneOf(name)}${isGroup ? ' msg-avatar--group' : ''}${size === 'sm' ? ' msg-avatar--sm' : ''}`}>
      {initials(name)}
    </span>
  );
}

/** Same filtering rules as filteredConversations() in messaging.js. */
export function filterConversations(conversations, filter, categoryFilter) {
  return conversations.filter((c) => {
    if (filter === 'unread' && !c.is_unread) return false;
    if (filter === 'favorite' && !c.is_favorite) return false;
    if (filter === 'pinned' && !c.is_pinned) return false;
    if (filter === 'group' && !c.is_group) return false;
    if (filter === 'archived' && !c.is_archived) return false;
    if (filter !== 'archived' && c.is_archived) return false;
    if (categoryFilter && c.category !== categoryFilter) return false;
    return true;
  });
}

export default function ConversationRail({
  conversations,
  categories,
  filter,
  setFilter,
  categoryFilter,
  setCategoryFilter,
  activeId,
  onOpen,
  searchOpen,
  setSearchOpen,
  searchQuery,
  setSearchQuery,
  searchResults,
  onOpenSearchResult,
  onNewDirect,
  onNewGroup,
  loading,
}) {
  const list = filterConversations(conversations, filter, categoryFilter);

  return (
    <aside className="msg-rail" data-msg-rail>
      <div className="msg-rail__head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)' }}>
        <strong className="text-h4">Messages</strong>
        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          <button type="button" className="msg-icon-btn" title="Search" onClick={() => setSearchOpen((o) => !o)}>
            <Icon name="search" size={16} />
          </button>
          <button type="button" className="msg-icon-btn" title="New group" onClick={onNewGroup}>
            <Icon name="users" size={16} />
          </button>
          <button type="button" className="msg-icon-btn" title="New message" onClick={onNewDirect}>
            <Icon name="plus" size={16} />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="msg-rail__search" data-search-bar>
          <Icon name="search" size={15} />
          <input
            type="search"
            data-inbox-search
            placeholder="Search conversations or messages…"
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            className="msg-icon-btn msg-icon-btn--sm"
            title="Close search"
            aria-label="Close search"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery('');
            }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {searchOpen && searchQuery && (
        <div className="msg-search-results" data-search-results>
          {searchResults.length === 0 ? (
            <div className="msg-empty-state">No messages found.</div>
          ) : (
            searchResults.slice(0, 25).map((m) => (
              <button
                type="button"
                className="msg-conv"
                key={m.id}
                onClick={() => onOpenSearchResult(m)}
              >
                <Avatar name={m.sender_name} />
                <span className="msg-conv__meta">
                  <span className="msg-conv__row1">
                    <span className="msg-conv__name">{m.sender_name}</span>
                    <span className="msg-conv__time">{fmtTime(m.created_at)}</span>
                  </span>
                  <span className="msg-conv__preview">{(m.body || '').slice(0, 90)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="msg-rail__tabs" data-filter-tabs>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`msg-tab${filter === f.key ? ' is-active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {categories.length > 0 && (
        <div className="msg-rail__categories" data-category-chips>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`msg-chip${categoryFilter === c ? ' is-active' : ''}`}
              onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="msg-rail__list" data-conversation-list>
        {loading ? (
          <div className="msg-skeleton-list" data-conversation-skeleton>
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="msg-skeleton-row" key={i}>
                <span className="msg-skeleton-avatar" />
                <span className="msg-skeleton-lines">
                  <i />
                  <i />
                </span>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="msg-empty-state">No conversations here yet.</div>
        ) : (
          list.map((c) => {
            const badges = [];
            if (c.is_pinned) badges.push(<span className="msg-conv__pin" key="pin"><MsgIcon name="pin" size={12} /></span>);
            if (c.is_muted)
              badges.push(
                <span className="msg-mini-icon" key="mute">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                </span>
              );
            if (c.is_unread) {
              const n = Number(c.unread_count || 0);
              badges.push(n > 0
                ? <span className="msg-unread-count" key="unread">{n > 99 ? '99+' : n}</span>
                : <span className="msg-unread-dot" key="unread" />);
            }
            return (
              <button
                type="button"
                key={c.id}
                className={`msg-conv${c.is_unread ? ' is-unread' : ''}${String(c.id) === String(activeId) ? ' is-active' : ''}`}
                onClick={() => onOpen(c.id)}
              >
                <Avatar name={peerLabel(c)} isGroup={c.is_group} />
                <span className="msg-conv__meta">
                  <span className="msg-conv__row1">
                    <span className="msg-conv__name">{peerLabel(c)}</span>
                    <span className="msg-conv__time">{fmtTime(c.time)}</span>
                  </span>
                  <span className="msg-conv__row2">
                    <span className="msg-conv__preview">{c.preview || 'No messages yet'}</span>
                    <span className="msg-conv__badges">{badges}</span>
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

export { Avatar };
