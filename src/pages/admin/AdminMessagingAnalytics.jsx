import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/admin/messaging-analytics';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/admin/messaging-analytics.php, talking to the real
 * JSON API (AdminMessagingOversightApiController::analytics() — reuses
 * the exact same MessagingService::adminAnalytics() call the Blade view
 * already made).
 */

function StatCard({ label, value, icon }) {
  return (
    <div className="adm-kpi">
      <div className="adm-kpi__top">{label} <Icon name={icon} size={16} /></div>
      <div className="adm-kpi__value">{value}</div>
    </div>
  );
}

export default function AdminMessagingAnalytics() {
  const t = useTranslations(translations);
  const [a, setA] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/v1/admin/messaging/analytics')
      .then((json) => setA(json.data || {}))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-small">{t('Loading…')}</p>;
  if (error) return <p className="form-error">{error}</p>;

  const storageMb = Math.round(((a.storage_bytes || 0) / 1048576) * 10) / 10;
  const topConversations = a.top_conversations || [];

  return (
    <>
      <Link to="/admin/messaging/oversight" className="adm-link-back"><Icon name="chevron-left" size={14} /> Messaging Oversight</Link>

      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('Messaging Analytics')}</h1>
          <p className="text-small">{t('Platform-wide messaging usage, across every portal.')}</p>
        </div>
      </div>

      <div className="adm-kpis">
        <StatCard label="Total Conversations" value={a.total_conversations ?? 0} icon="message" />
        <StatCard label="Group / Direct" value={`${a.group_conversations ?? 0} / ${a.direct_conversations ?? 0}`} icon="users" />
        <StatCard label="Total Messages" value={a.total_messages ?? 0} icon="file" />
        <StatCard label="Messages Today" value={a.messages_today ?? 0} icon="calendar" />
      </div>

      <div className="adm-kpis">
        <StatCard label="Messages (7 days)" value={a.messages_this_week ?? 0} icon="trend" />
        <StatCard label="Active Users (7 days)" value={a.active_users_7d ?? 0} icon="user" />
        <StatCard label="Total Attachments" value={a.total_attachments ?? 0} icon="file" />
        <StatCard label="Attachment Storage" value={`${storageMb} MB`} icon="archive" />
      </div>

      <div className="adm-panel__head" style={{ marginBottom: 10 }}><h3>{t('Top 5 Most Active Conversations')}</h3></div>
      {topConversations.length === 0 ? (
        <div className="adm-panel" style={{ textAlign: 'center' }}>
          <p className="adm-empty">{t('No data yet.')}</p>
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Conversation</th><th>Type</th><th>Messages</th></tr></thead>
            <tbody>
              {topConversations.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/admin/messaging/oversight/${c.id}`} style={{ fontWeight: 600 }}>{c.is_group ? (c.group_name || 'Group') : (c.subject || `#${c.id}`)}</Link></td>
                  <td>{c.is_group ? 'Group' : 'Direct'}</td>
                  <td><span className="text-mono">{c.message_count}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
