import React from 'react';
import { Tag, Tooltip, Badge, Empty, Spin } from 'antd';
import {
  BellOutlined,
  MailOutlined,
  WhatsAppOutlined,
  CalendarOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { STATUS_COLORS } from '../JobDetailModal';

/* ─── Column definitions ─────────────────────────────────────────────────── */
const COLUMNS = [
  {
    key: 'ready',
    label: 'Ready to Contact',
    statuses: ['NEW', 'RESEARCHED', 'READY_TO_CONTACT'],
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    emoji: '📋',
  },
  {
    key: 'sent',
    label: 'Sent',
    statuses: ['SENT', 'EMAIL_SENT', 'WHATSAPP_SENT'],
    color: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    emoji: '✉️',
  },
  {
    key: 'followup',
    label: 'Follow-up Due',
    statuses: [
      'FOLLOW_UP',
      'FOLLOW_UP_1_DUE',
      'FOLLOW_UP_1_SENT',
      'FOLLOW_UP_2_DUE',
      'FOLLOW_UP_2_SENT',
    ],
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    emoji: '🔔',
  },
  {
    key: 'replied',
    label: 'Replied',
    statuses: ['REPLIED'],
    color: '#8b5cf6',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    emoji: '💬',
  },
  {
    key: 'interview',
    label: 'Interview',
    statuses: ['INTERVIEW'],
    color: '#ec4899',
    bg: '#fdf2f8',
    border: '#fbcfe8',
    emoji: '🎯',
  },
  {
    key: 'no_requirement',
    label: 'No Requirement',
    statuses: ['NO_REQUIREMENT', 'NO_FOLLOW_UP'],
    color: '#64748b',
    bg: '#f8fafc',
    border: '#e2e8f0',
    emoji: '🚫',
  },
  {
    key: 'bounced',
    label: 'Bounced / Invalid',
    statuses: ['BOUNCED', 'FAILED', 'INVALID_EMAIL'],
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    emoji: '⛔',
  },
];

const SUPPRESSED = ['NO_REQUIREMENT', 'NO_FOLLOW_UP', 'BOUNCED', 'REJECTED', 'CLOSED'];

/* ─── Individual Kanban Card ─────────────────────────────────────────────── */
function KanbanCard({ job, onCardClick, onFollowUpClick }) {
  const hrName = job.contact?.hrName || job.hrName || 'Hiring Team';
  const hrEmail = job.contact?.email || job.hrEmail || '';
  const hasPhone = !!(job.contact?.phone || job.whatsapp?.phone);
  const nextFollowUp = job.tracking?.nextFollowUpAt;
  const isOverdue =
    nextFollowUp &&
    dayjs(nextFollowUp).isBefore(dayjs(), 'day') &&
    !SUPPRESSED.includes(job.status);
  const isDueToday =
    nextFollowUp &&
    dayjs(nextFollowUp).isSame(dayjs(), 'day') &&
    !SUPPRESSED.includes(job.status);

  return (
    <div
      className={
        'kanban-card' +
        (isOverdue ? ' kanban-card--overdue' : '') +
        (isDueToday ? ' kanban-card--today' : '')
      }
      onClick={() => onCardClick(job)}
    >
      {isOverdue && (
        <div className="kanban-card-alert kanban-card-alert--overdue">
          {'🔴 Follow-up Overdue · ' + dayjs(nextFollowUp).format('DD MMM')}
        </div>
      )}
      {isDueToday && !isOverdue && (
        <div className="kanban-card-alert kanban-card-alert--today">
          🟡 Follow-up Due Today
        </div>
      )}

      <div className="kanban-card-company">{job.company}</div>
      <div className="kanban-card-role">{job.role}</div>

      <div className="kanban-card-meta">
        <UserOutlined style={{ fontSize: 11, color: '#94a3b8' }} />
        <span>{hrName}</span>
        {job.isDuplicate && (
          <Tooltip title="Potential duplicate">
            <ExclamationCircleOutlined style={{ fontSize: 11, color: '#f59e0b' }} />
          </Tooltip>
        )}
      </div>

      <div className="kanban-card-channels">
        <Tooltip title={hrEmail || 'No email'}>
          <span
            className={
              'kanban-ch-icon ' +
              (hrEmail ? 'kanban-ch-icon--active' : 'kanban-ch-icon--dim')
            }
          >
            <MailOutlined />
          </span>
        </Tooltip>
        <Tooltip title={hasPhone ? 'WhatsApp available' : 'No phone'}>
          <span
            className={
              'kanban-ch-icon ' +
              (hasPhone ? 'kanban-ch-icon--wa' : 'kanban-ch-icon--dim')
            }
          >
            <WhatsAppOutlined />
          </span>
        </Tooltip>
        {nextFollowUp && (
          <Tooltip title={'Follow-up: ' + dayjs(nextFollowUp).format('DD MMM YYYY')}>
            <span
              className={
                'kanban-ch-icon ' +
                (isOverdue
                  ? 'kanban-ch-icon--overdue'
                  : isDueToday
                  ? 'kanban-ch-icon--today'
                  : 'kanban-ch-icon--followup')
              }
              onClick={(e) => {
                e.stopPropagation();
                onFollowUpClick(job);
              }}
            >
              <BellOutlined />
            </span>
          </Tooltip>
        )}
        {nextFollowUp && (
          <span className="kanban-date-chip">
            <CalendarOutlined style={{ fontSize: 9 }} />
            {dayjs(nextFollowUp).format('DD MMM')}
          </span>
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        <Tag
          color={STATUS_COLORS[job.status] || 'default'}
          style={{ fontSize: 10, padding: '0 5px', borderRadius: 4, fontWeight: 700 }}
        >
          {job.status ? job.status.replace(/_/g, ' ') : '—'}
        </Tag>
        {job.jobType === 'general_inquiry' && (
          <Tag
            style={{
              fontSize: 10,
              padding: '0 5px',
              borderRadius: 4,
              color: '#64748b',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
            }}
          >
            General
          </Tag>
        )}
      </div>
    </div>
  );
}

/* ─── Main Kanban Board View ─────────────────────────────────────────────── */
export function KanbanView({ jobs, loading, onCardClick, onFollowUpClick }) {
  // Build column to job mapping
  const columnMap = {};
  COLUMNS.forEach((col) => {
    columnMap[col.key] = [];
  });
  (jobs || []).forEach((job) => {
    const col = COLUMNS.find((c) => c.statuses.includes(job.status));
    if (col) {
      columnMap[col.key].push(job);
    }
  });

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 400,
        }}
      >
        <Spin size="large" tip="Loading pipeline..." />
      </div>
    );
  }

  return (
    <div className="kanban-board">
      {COLUMNS.map((col) => {
        const colJobs = columnMap[col.key] || [];
        const overdueCount = colJobs.filter(
          (j) =>
            j.tracking?.nextFollowUpAt &&
            dayjs(j.tracking.nextFollowUpAt).isBefore(dayjs(), 'day') &&
            !SUPPRESSED.includes(j.status)
        ).length;

        return (
          <div key={col.key} className="kanban-column">
            <div
              className="kanban-column-header"
              style={{ background: col.bg, borderBottom: '2px solid ' + col.border }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 15 }}>{col.emoji}</span>
                <span className="kanban-column-title" style={{ color: col.color }}>
                  {col.label}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {overdueCount > 0 && (
                  <Tooltip title={overdueCount + ' overdue'}>
                    <Badge
                      count={overdueCount}
                      style={{ backgroundColor: '#ef4444', fontSize: 10 }}
                    />
                  </Tooltip>
                )}
                <span
                  className="kanban-column-count"
                  style={{
                    color: col.color,
                    background: col.bg,
                    border: '1px solid ' + col.border,
                  }}
                >
                  {colJobs.length}
                </span>
              </div>
            </div>

            <div className="kanban-column-body">
              {colJobs.length === 0 ? (
                <div className="kanban-empty">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>No prospects</span>
                    }
                  />
                </div>
              ) : (
                colJobs.map((job) => (
                  <KanbanCard
                    key={job._id}
                    job={job}
                    onCardClick={onCardClick}
                    onFollowUpClick={onFollowUpClick}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default KanbanView;
