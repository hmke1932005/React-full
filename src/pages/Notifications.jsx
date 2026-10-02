import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getPortalBrand, pick } from '../config/portalBrand';

/**
 * React port of app/Views/components/notification-center.php +
 * notification-row.php + public/assets/js/notifications.js.
 *
 * THE single Notification Center UI for every portal — one backend surface
 * (/api/v1/notifications/*, App\Controllers\Api\NotificationsApiController)
 * and this is its one React client, mounted at every role's `/*\/notifications`
 * route (see navConfig.js's COMMON_ACCOUNT_ITEMS + App.jsx), same
 * "one system, portal only changes the URL prefix" convention already used
 * for Messages (src/pages/Messages.jsx + /api/v1/messaging/*).
 *
 * Unlike the old public/assets/js/notifications.js (which hit a bespoke
 * {portal}/notifications/search endpoint and read res.items/res.total off
 * an ad-hoc body), this talks to the newer unified REST surface:
 *   GET    /api/v1/notifications            list (filters as query params)
 *   GET    /api/v1/notifications/counts     tab badge counts (one round trip,
 *                                            not the old JS's 7x per-status
 *                                            /search calls)
 *   PATCH  /api/v1/notifications/{id}/{read|unread|pin|unpin|important|
 *                                    unimportant|archive|unarchive}
 *   POST   /api/v1/notifications/{id}/restore
 *   DELETE /api/v1/notifications/{id}        soft delete -> Trash
 *   DELETE /api/v1/notifications/{id}/purge  permanent delete
 *   POST   /api/v1/notifications/read-all
 *   POST   /api/v1/notifications/bulk        { ids, action }
 * Every response uses Controller::apiSuccess()'s {success,message,data,
 * errors,meta} envelope — list items are `data` (an array), pagination info
 * is `meta.{page,perPage,total,totalPages}`, counts are `data.{unread,read,
 * pinned,important,archived,deleted,total}`.
 */

const BASE = '/api/v1/notifications';

// Tab keys ('' = All) and the category buckets; labels live in TX below.
const TAB_KEYS = ['', 'unread', 'read', 'pinned', 'important', 'archived', 'deleted'];
const CATEGORY_KEYS = ['', 'messages', 'university', 'projects', 'ai', 'reports', 'invitations', 'files', 'security', 'system', 'general'];

const EMPTY_COUNTS = { unread: 0, read: 0, pinned: 0, important: 0, archived: 0, deleted: 0, total: 0 };

const TX = {
  en: {
    tabs: { '': 'All', unread: 'Unread', read: 'Read', pinned: 'Pinned', important: 'Important', archived: 'Archived', deleted: 'Trash' },
    categories: { '': 'All categories', messages: 'Messages', university: 'University', projects: 'Projects', ai: 'AI', reports: 'Reports', invitations: 'Invitations', files: 'Files', security: 'Security', system: 'System', general: 'General' },
    now: 'Just now', m: (n) => `${n}m ago`, h: (n) => `${n}h ago`, d: (n) => `${n}d ago`, dateLocale: 'en-US',
    select: 'Select', pinned: 'Pinned', important: 'Important', urgent: 'Urgent', high: 'High', view: 'View',
    restore: 'Restore', purge: 'Delete permanently', markUnread: 'Mark as unread', markRead: 'Mark as read',
    unpin: 'Unpin', pin: 'Pin', unmarkImportant: 'Unmark important', markImportant: 'Mark important',
    unarchive: 'Unarchive', archive: 'Archive', delete: 'Delete',
    allRead: 'All notifications marked as read.', purgeConfirm: 'Permanently delete this notification? This cannot be undone.',
    updated: (n) => `${n} updated.`,
    searchPh: 'Search notifications…', searchAria: 'Search notifications', category: 'Category', priority: 'Priority',
    anyPriority: 'Any priority', normal: 'Normal', low: 'Low', fromDate: 'From date', toDate: 'To date', sort: 'Sort',
    newest: 'Newest first', oldest: 'Oldest first', clear: 'Clear', markAll: 'Mark all read', refresh: 'Refresh',
    selected: 'selected', cancel: 'Cancel', noMatch: 'No notifications match these filters.', none: "You don't have any notifications yet.",
    prev: 'Prev', next: 'Next', pageOf: (p, n, t) => `Page ${p} of ${n} · ${t} total`,
  },
  ar: {
    tabs: { '': 'الكل', unread: 'غير مقروءة', read: 'مقروءة', pinned: 'المثبّتة', important: 'المهمة', archived: 'المؤرشفة', deleted: 'المحذوفات' },
    categories: { '': 'كل الفئات', messages: 'الرسائل', university: 'الجامعة', projects: 'المشاريع', ai: 'الذكاء الاصطناعي', reports: 'التقارير', invitations: 'الدعوات', files: 'الملفات', security: 'الأمان', system: 'النظام', general: 'عام' },
    now: 'الآن', m: (n) => `منذ ${n} د`, h: (n) => `منذ ${n} س`, d: (n) => `منذ ${n} يوم`, dateLocale: 'ar-EG',
    select: 'تحديد', pinned: 'مثبّت', important: 'مهم', urgent: 'عاجل', high: 'مرتفع', view: 'عرض',
    restore: 'استعادة', purge: 'حذف نهائي', markUnread: 'تعيين كغير مقروء', markRead: 'تعيين كمقروء',
    unpin: 'إلغاء التثبيت', pin: 'تثبيت', unmarkImportant: 'إلغاء التمييز كمهم', markImportant: 'تمييز كمهم',
    unarchive: 'إلغاء الأرشفة', archive: 'أرشفة', delete: 'حذف',
    allRead: 'تم تعيين كل الإشعارات كمقروءة.', purgeConfirm: 'هل تريد حذف هذا الإشعار نهائياً؟ لا يمكن التراجع عن ذلك.',
    updated: (n) => `تم تحديث ${n}.`,
    searchPh: 'ابحث في الإشعارات…', searchAria: 'ابحث في الإشعارات', category: 'الفئة', priority: 'الأولوية',
    anyPriority: 'أي أولوية', normal: 'عادية', low: 'منخفضة', fromDate: 'من تاريخ', toDate: 'إلى تاريخ', sort: 'الترتيب',
    newest: 'الأحدث أولاً', oldest: 'الأقدم أولاً', clear: 'مسح', markAll: 'تعيين الكل كمقروء', refresh: 'تحديث',
    selected: 'محدد', cancel: 'إلغاء', noMatch: 'لا توجد إشعارات تطابق هذه المرشّحات.', none: 'ليس لديك أي إشعارات بعد.',
    prev: 'السابق', next: 'التالي', pageOf: (p, n, t) => `صفحة ${p} من ${n} · ${t} إجمالاً`,
  },
};

function timeAgo(dateStr, tx) {
  if (!dateStr) return '';
  const then = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(then.getTime())) return dateStr;
  const diff = Math.max(0, Math.floor((Date.now() - then.getTime()) / 1000));
  if (diff < 60) return tx.now;
  if (diff < 3600) return tx.m(Math.floor(diff / 60));
  if (diff < 86400) return tx.h(Math.floor(diff / 3600));
  if (diff < 604800) return tx.d(Math.floor(diff / 86400));
  return then.toLocaleDateString(tx.dateLocale, { year: 'numeric', month: 'short', day: 'numeric' });
}

function isExternal(url) {
  return /^(https?:)?\/\//i.test(url || '');
}

function SkeletonRow() {
  return (
    <div className="notif-row notif-row--skeleton">
      <span className="skeleton skeleton-avatar is-sm" style={{ borderRadius: 'var(--radius-sm)' }} />
      <div className="notif-row__body">
        <div className="skeleton skeleton-line" style={{ width: '70%' }} />
        <div className="skeleton skeleton-line" style={{ width: '45%' }} />
      </div>
    </div>
  );
}

// Tile color per notification kind (used by the Insight portal styling).
function toneForIcon(icon, priority) {
  if (priority === 'urgent') return 'danger';
  if (['download', 'check', 'check-circle', 'upload'].includes(icon)) return 'success';
  if (['alert', 'alert-triangle', 'shield'].includes(icon)) return 'warning';
  if (['trend', 'chart', 'bar-chart', 'x-circle'].includes(icon)) return 'danger';
  return 'primary';
}

function NotifRow({ n, checked, onCheck, onAction }) {
  const { locale } = useLanguage();
  const tx = TX[locale] || TX.en;
  const isDeleted = !!n.is_deleted;
  const isArchived = !!n.is_archived;
  const isRead = !!n.is_read;
  const isPinned = !!n.is_pinned;
  const isImportant = !!n.is_important;
  const priority = n.priority || 'normal';

  const cls = ['notif-row'];
  if (!isRead) cls.push('is-unread');
  if (isPinned) cls.push('is-pinned');
  if (isImportant) cls.push('is-important');
  if (isArchived) cls.push('is-archived');
  if (isDeleted) cls.push('is-deleted');

  return (
    <div className={cls.join(' ')} data-id={n.id}>
      <input
        type="checkbox"
        className="form-checkbox notif-row__check"
        aria-label={tx.select}
        checked={checked}
        onChange={(e) => onCheck(n.id, e.target.checked)}
      />

      <span className="notif-row__icon" data-tone={toneForIcon(n.icon, priority)}>
        <Icon name={n.icon || 'bell'} size={20} />
      </span>

      <div className="notif-row__body">
        <p className="notif-row__title">
          {isPinned && (
            <span className="notif-row__flag" title={tx.pinned}>
              <Icon name="pin" size={12} />
            </span>
          )}
          {isImportant && (
            <span className="notif-row__flag" title={tx.important}>
              <Icon name="star" size={12} />
            </span>
          )}
          {n.title}
          {(priority === 'urgent' || priority === 'high') && (
            <span className={`badge ${priority === 'urgent' ? 'badge-danger' : 'badge-warning'}`}>
              {priority === 'urgent' ? tx.urgent : tx.high}
            </span>
          )}
        </p>
        {n.body && <p className="notif-row__snippet">{n.body}</p>}
        <div className="notif-row__meta">
          <span className="text-caption text-muted">{timeAgo(n.created_at, tx)}</span>
          {n.link_url && (
            isExternal(n.link_url) ? (
              <a href={n.link_url} className="text-caption notif-row__view" target="_blank" rel="noreferrer">{tx.view}</a>
            ) : (
              <Link to={n.link_url} className="text-caption notif-row__view">{tx.view}</Link>
            )
          )}
        </div>
      </div>

      <div className="notif-row__actions">
        {isDeleted ? (
          <>
            <button type="button" className="topbar__icon-btn" title={tx.restore} onClick={() => onAction(n.id, 'restore')}>
              <Icon name="refresh" size={14} />
            </button>
            <button type="button" className="topbar__icon-btn notif-row__danger" title={tx.purge} onClick={() => onAction(n.id, 'purge')}>
              <Icon name="trash" size={14} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="topbar__icon-btn"
              title={isRead ? tx.markUnread : tx.markRead}
              onClick={() => onAction(n.id, isRead ? 'unread' : 'read')}
            >
              <Icon name={isRead ? 'mail' : 'check'} size={14} />
            </button>
            <button
              type="button"
              className={`topbar__icon-btn${isPinned ? ' is-active' : ''}`}
              title={isPinned ? tx.unpin : tx.pin}
              onClick={() => onAction(n.id, isPinned ? 'unpin' : 'pin')}
            >
              <Icon name="pin" size={14} />
            </button>
            <button
              type="button"
              className={`topbar__icon-btn${isImportant ? ' is-active' : ''}`}
              title={isImportant ? tx.unmarkImportant : tx.markImportant}
              onClick={() => onAction(n.id, isImportant ? 'unimportant' : 'important')}
            >
              <Icon name="star" size={14} />
            </button>
            <button
              type="button"
              className="topbar__icon-btn"
              title={isArchived ? tx.unarchive : tx.archive}
              onClick={() => onAction(n.id, isArchived ? 'unarchive' : 'archive')}
            >
              <Icon name="archive" size={14} />
            </button>
            <button type="button" className="topbar__icon-btn notif-row__danger" title={tx.delete} onClick={() => onAction(n.id, 'delete')}>
              <Icon name="trash" size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Notifications() {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const brand = getPortalBrand(user?.role);
  const tx = TX[locale] || TX.en;
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const [selected, setSelected] = useState({});
  const [toast, setToast] = useState(null);

  const reqIdRef = useRef(0);

  const showToast = useCallback((message, kind = 'success') => {
    setToast({ message, kind });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(h);
  }, [toast]);

  const loadCounts = useCallback(() => {
    api.get(BASE + '/counts').then((res) => setCounts(res.data || EMPTY_COUNTS)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    const myReqId = ++reqIdRef.current;
    setLoading(true);
    const params = {
      status: status || undefined,
      category: category || undefined,
      priority: priority || undefined,
      search: search || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      sort,
      page,
      per_page: perPage,
    };
    api.get(BASE, params)
      .then((res) => {
        if (reqIdRef.current !== myReqId) return;
        const list = res.data || [];
        const metaTotal = res.meta?.total ?? 0;
        if (!list.length && page > 1) {
          setPage((p) => Math.max(1, p - 1));
          return;
        }
        setItems(list);
        setTotal(metaTotal);
        setSelected({});
        setLoadError('');
      })
      .catch((err) => {
        if (reqIdRef.current !== myReqId) return;
        setItems([]);
        setLoadError(errorMessage(err));
      })
      .finally(() => {
        if (reqIdRef.current !== myReqId) return;
        setLoading(false);
        setFirstLoad(false);
      });
  }, [status, category, priority, search, dateFrom, dateTo, sort, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  // Debounced search box, same 350ms as the old JS.
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const h = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(h);
  }, [searchInput]);

  const changeTab = (key) => {
    setStatus(key);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setCategory('');
    setPriority('');
    setDateFrom('');
    setDateTo('');
    setSort('newest');
    setPage(1);
  };

  const markAllRead = () => {
    api.post(BASE + '/read-all', {})
      .then(() => {
        showToast(tx.allRead);
        load();
        loadCounts();
      })
      .catch((err) => showToast(errorMessage(err), 'error'));
  };

  const singleAction = (id, action) => {
    if (action === 'purge' && !window.confirm(tx.purgeConfirm)) return;
    const method = action === 'restore' ? 'post' : action === 'delete' || action === 'purge' ? 'del' : 'patch';
    const path = action === 'delete' ? `${BASE}/${id}` : `${BASE}/${id}/${action}`;
    const call = method === 'del' ? api.del(path) : method === 'post' ? api.post(path, {}) : api.patch(path, {});
    call
      .then(() => { load(); loadCounts(); })
      .catch((err) => showToast(errorMessage(err), 'error'));
  };

  const toggleCheck = (id, checked) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) next[id] = true; else delete next[id];
      return next;
    });
  };

  const selectedIds = Object.keys(selected);
  const allChecked = items.length > 0 && selectedIds.length === items.length;

  const toggleSelectAll = (checked) => {
    if (checked) {
      const next = {};
      items.forEach((n) => { next[n.id] = true; });
      setSelected(next);
    } else {
      setSelected({});
    }
  };

  const bulkAction = (action) => {
    if (!selectedIds.length) return;
    api.post(BASE + '/bulk', { ids: selectedIds, action })
      .then((res) => {
        showToast(tx.updated(res.data?.affected ?? selectedIds.length));
        setSelected({});
        load();
        loadCounts();
      })
      .catch((err) => showToast(errorMessage(err), 'error'));
  };

  const pages = Math.max(1, Math.ceil(total / perPage));
  const hasFilters = !!(status || search || category || priority);

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{locale === 'ar' ? 'الإشعارات' : 'Notifications'}</h1>
          <p className="text-small">{pick(brand.notifications, locale)}</p>
        </div>
      </div>

      <div className="notif-center">
        <div className="notif-center__toolbar">
          <div className="notif-center__search">
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder={tx.searchPh}
              aria-label={tx.searchAria}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="notif-center__filters">
            <select className="form-select" aria-label={tx.category} value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
              {CATEGORY_KEYS.map((val) => (
                <option key={val} value={val}>{tx.categories[val]}</option>
              ))}
            </select>

            <select className="form-select" aria-label={tx.priority} value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
              <option value="">{tx.anyPriority}</option>
              <option value="urgent">{tx.urgent}</option>
              <option value="high">{tx.high}</option>
              <option value="normal">{tx.normal}</option>
              <option value="low">{tx.low}</option>
            </select>

            <input type="date" className="form-input" title={tx.fromDate} value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            <span className="notif-center__date-sep">–</span>
            <input type="date" className="form-input" title={tx.toDate} value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />

            <select className="form-select" aria-label={tx.sort} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              <option value="newest">{tx.newest}</option>
              <option value="oldest">{tx.oldest}</option>
              <option value="priority">{tx.priority}</option>
            </select>

            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <Icon name="x" size={14} /> {tx.clear}
            </button>
          </div>

          <div className="notif-center__toolbar-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={markAllRead}>
              <Icon name="check" size={14} /> {tx.markAll}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" title={tx.refresh} onClick={() => { load(); loadCounts(); }}>
              <Icon name="refresh" size={14} />
            </button>
          </div>
        </div>

        <div className="notif-center__tabs" role="tablist">
          {TAB_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`notif-tab${status === key ? ' is-active' : ''}`}
              role="tab"
              aria-selected={status === key}
              onClick={() => changeTab(key)}
            >
              {tx.tabs[key]}
              <span className="notif-tab__count">{counts[key || 'total'] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="notif-center__bulkbar" hidden={selectedIds.length === 0}>
          <label className="notif-center__select-all">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={allChecked}
              onChange={(e) => toggleSelectAll(e.target.checked)}
            />
            <span>{selectedIds.length}</span> {tx.selected}
          </label>
          <div className="notif-center__bulk-actions">
            <button type="button" className="btn btn-ghost btn-sm" title={tx.markRead} onClick={() => bulkAction('markRead')}><Icon name="check" size={14} /></button>
            <button type="button" className="btn btn-ghost btn-sm" title={tx.markUnread} onClick={() => bulkAction('markUnread')}><Icon name="mail" size={14} /></button>
            <button type="button" className="btn btn-ghost btn-sm" title={tx.pin} onClick={() => bulkAction('pin')}><Icon name="pin" size={14} /></button>
            <button type="button" className="btn btn-ghost btn-sm" title={tx.markImportant} onClick={() => bulkAction('important')}><Icon name="star" size={14} /></button>
            <button type="button" className="btn btn-ghost btn-sm" title={tx.archive} onClick={() => bulkAction('archive')}><Icon name="archive" size={14} /></button>
            <button type="button" className="btn btn-ghost btn-sm" title={tx.delete} onClick={() => bulkAction('delete')}><Icon name="trash" size={14} /></button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected({})}>{tx.cancel}</button>
          </div>
        </div>

        <div className={`notif-center__list${loading ? ' is-loading' : ''}${firstLoad && loading ? ' is-skeleton' : ''}`}>
          {firstLoad && loading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          ) : loadError ? (
            <div className="notif-center__empty">
              <p className="text-small text-muted">{loadError}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="notif-center__empty">
              <div className="notif-center__empty-icon"><Icon name="bell" size={28} /></div>
              <p className="text-small text-muted">
                {hasFilters ? tx.noMatch : tx.none}
              </p>
            </div>
          ) : (
            items.map((n) => (
              <NotifRow
                key={n.id}
                n={n}
                checked={!!selected[n.id]}
                onCheck={toggleCheck}
                onAction={singleAction}
              />
            ))
          )}
        </div>

        <div className="notif-center__pagination" hidden={pages <= 1}>
          <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <Icon name={locale === 'ar' ? 'chevron-right' : 'chevron-left'} size={14} /> {tx.prev}
          </button>
          <span className="text-caption text-muted">{tx.pageOf(page, pages, total)}</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            {tx.next} <Icon name={locale === 'ar' ? 'chevron-left' : 'chevron-right'} size={14} />
          </button>
        </div>
      </div>

      {toast && (
        <div className={`toast toast--${toast.kind}`} role="status" style={{ position: 'fixed', bottom: 'var(--space-5)', insetInlineEnd: 'var(--space-5)', zIndex: 'var(--z-toast)' }}>
          {toast.message}
        </div>
      )}
    </>
  );
}
