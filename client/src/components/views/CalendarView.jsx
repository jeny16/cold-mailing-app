import React, { useState } from 'react';
import { Badge, Tooltip, Tag, Empty } from 'antd';
import {
  BellOutlined,
  CalendarOutlined,
  MailOutlined,
  UserOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

/* ─── Event colour by type ───────────────────────────────────────────────── */
const EVENT_COLORS = {
  overdue: { bg: '#fef2f2', border: '#f87171', color: '#dc2626', dot: '#ef4444' },
  today: { bg: '#fffbeb', border: '#fcd34d', color: '#b45309', dot: '#f59e0b' },
  scheduled: { bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb', dot: '#3b82f6' },
  interview: { bg: '#fdf2f8', border: '#fbcfe8', color: '#be185d', dot: '#ec4899' },
  sent: { bg: '#ecfdf5', border: '#a7f3d0', color: '#065f46', dot: '#10b981' },
};

/* ─── Mini day names ─────────────────────────────────────────────────────── */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ─── Build calendar events from jobs array ──────────────────────────────── */
function buildEvents(jobs) {
  const events = {}; // key: 'YYYY-MM-DD', value: array of event objects
  const add = (dateStr, event) => {
    if (!events[dateStr]) events[dateStr] = [];
    events[dateStr].push(event);
  };

  (jobs || []).forEach((job) => {
    const suppressed = ['NO_REQUIREMENT', 'NO_FOLLOW_UP', 'BOUNCED', 'REJECTED', 'CLOSED'].includes(
      job.status
    );

    // Follow-up date event
    if (job.tracking?.nextFollowUpAt && !suppressed) {
      const d = dayjs(job.tracking.nextFollowUpAt);
      const today = dayjs();
      const isOverdue = d.isBefore(today, 'day');
      const isDueToday = d.isSame(today, 'day');
      const dateKey = d.format('YYYY-MM-DD');
      add(dateKey, {
        job,
        type: isOverdue ? 'overdue' : isDueToday ? 'today' : 'scheduled',
        label: job.company,
        subLabel: job.role,
        icon: 'bell',
      });
    }

    // Interview event (use nextFollowUpAt as proxy if interview status)
    if (job.status === 'INTERVIEW' && job.tracking?.nextFollowUpAt) {
      const dateKey = dayjs(job.tracking.nextFollowUpAt).format('YYYY-MM-DD');
      add(dateKey, {
        job,
        type: 'interview',
        label: job.company + ' – Interview',
        subLabel: job.role,
        icon: 'interview',
      });
    }
  });

  return events;
}

/* ─── Single day cell ────────────────────────────────────────────────────── */
function DayCell({ date, currentMonth, eventsForDay, onEventClick }) {
  const isToday = date.isSame(dayjs(), 'day');
  const isCurrentMonth = date.month() === currentMonth;
  const isWeekend = date.day() === 0 || date.day() === 6;

  return (
    <div
      className={
        'cal-day' +
        (isToday ? ' cal-day--today' : '') +
        (!isCurrentMonth ? ' cal-day--other-month' : '') +
        (isWeekend ? ' cal-day--weekend' : '')
      }
    >
      <span className={'cal-day-number' + (isToday ? ' cal-day-number--today' : '')}>
        {date.date()}
      </span>

      <div className="cal-events">
        {(eventsForDay || []).slice(0, 3).map((evt, idx) => {
          const colors = EVENT_COLORS[evt.type] || EVENT_COLORS.scheduled;
          return (
            <Tooltip
              key={idx}
              title={
                evt.label +
                (evt.subLabel ? ' · ' + evt.subLabel : '') +
                ' (' +
                evt.type +
                ')'
              }
              placement="top"
            >
              <div
                className="cal-event"
                style={{
                  background: colors.bg,
                  borderLeft: '3px solid ' + colors.dot,
                  color: colors.color,
                }}
                onClick={() => onEventClick && onEventClick(evt.job)}
              >
                <span className="cal-event-dot" style={{ background: colors.dot }} />
                <span className="cal-event-label">{evt.label}</span>
              </div>
            </Tooltip>
          );
        })}
        {eventsForDay && eventsForDay.length > 3 && (
          <div className="cal-event-more">+{eventsForDay.length - 3} more</div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Calendar View ─────────────────────────────────────────────────── */
export function CalendarView({ jobs, onCardClick }) {
  const [currentDate, setCurrentDate] = useState(dayjs());
  const events = buildEvents(jobs);

  const startOfMonth = currentDate.startOf('month');
  const endOfMonth = currentDate.endOf('month');
  const startDay = startOfMonth.day(); // 0=Sun
  const daysInMonth = currentDate.daysInMonth();

  // Generate grid: pad start with prev-month days, end with next-month days
  const calDays = [];
  for (let i = 0; i < startDay; i++) {
    calDays.push(startOfMonth.subtract(startDay - i, 'day'));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calDays.push(currentDate.date(d));
  }
  const totalCells = Math.ceil(calDays.length / 7) * 7;
  let nextDay = 1;
  while (calDays.length < totalCells) {
    calDays.push(endOfMonth.add(nextDay, 'day'));
    nextDay++;
  }

  // Count stats for the displayed month
  const monthKey = currentDate.format('YYYY-MM');
  const thisMonthEvents = Object.entries(events)
    .filter(([k]) => k.startsWith(monthKey))
    .flatMap(([, v]) => v);
  const overdueCount = thisMonthEvents.filter((e) => e.type === 'overdue').length;
  const scheduledCount = thisMonthEvents.filter((e) => e.type === 'scheduled' || e.type === 'today').length;
  const interviewCount = thisMonthEvents.filter((e) => e.type === 'interview').length;

  return (
    <div className="cal-container">
      {/* Calendar header */}
      <div className="cal-header">
        <div className="cal-nav">
          <button
            className="cal-nav-btn"
            onClick={() => setCurrentDate(currentDate.subtract(1, 'month'))}
          >
            <LeftOutlined />
          </button>
          <span className="cal-month-label">
            {currentDate.format('MMMM YYYY')}
          </span>
          <button
            className="cal-nav-btn"
            onClick={() => setCurrentDate(currentDate.add(1, 'month'))}
          >
            <RightOutlined />
          </button>
          <button
            className="cal-today-btn"
            onClick={() => setCurrentDate(dayjs())}
          >
            Today
          </button>
        </div>

        <div className="cal-legend">
          {overdueCount > 0 && (
            <span className="cal-legend-item" style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #f87171' }}>
              🔴 {overdueCount} Overdue
            </span>
          )}
          {scheduledCount > 0 && (
            <span className="cal-legend-item" style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              🔔 {scheduledCount} Follow-ups
            </span>
          )}
          {interviewCount > 0 && (
            <span className="cal-legend-item" style={{ color: '#be185d', background: '#fdf2f8', border: '1px solid #fbcfe8' }}>
              🎯 {interviewCount} Interviews
            </span>
          )}
          {overdueCount === 0 && scheduledCount === 0 && interviewCount === 0 && (
            <span className="cal-legend-item" style={{ color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              No events this month
            </span>
          )}
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="cal-grid cal-dow-row">
        {DAY_NAMES.map((d) => (
          <div key={d} className="cal-dow">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="cal-grid cal-body">
        {calDays.map((date, idx) => {
          const dateKey = date.format('YYYY-MM-DD');
          return (
            <DayCell
              key={idx}
              date={date}
              currentMonth={currentDate.month()}
              eventsForDay={events[dateKey]}
              onEventClick={onCardClick}
            />
          );
        })}
      </div>

      {/* Upcoming events sidebar / list below */}
      <div className="cal-upcoming">
        <div className="cal-upcoming-title">
          <CalendarOutlined style={{ marginRight: 6 }} />
          Upcoming in {currentDate.format('MMMM')}
        </div>
        {thisMonthEvents.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                No follow-ups or interviews scheduled this month
              </span>
            }
          />
        ) : (
          <div className="cal-upcoming-list">
            {thisMonthEvents
              .sort((a, b) => {
                const da = dayjs(a.job.tracking?.nextFollowUpAt);
                const db = dayjs(b.job.tracking?.nextFollowUpAt);
                return da.diff(db);
              })
              .slice(0, 15)
              .map((evt, idx) => {
                const colors = EVENT_COLORS[evt.type] || EVENT_COLORS.scheduled;
                const dateStr = evt.job.tracking?.nextFollowUpAt
                  ? dayjs(evt.job.tracking.nextFollowUpAt).format('ddd, DD MMM')
                  : '—';
                return (
                  <div
                    key={idx}
                    className="cal-upcoming-item"
                    style={{ borderLeft: '3px solid ' + colors.dot }}
                    onClick={() => onCardClick && onCardClick(evt.job)}
                  >
                    <div className="cal-upcoming-company">{evt.job.company}</div>
                    <div className="cal-upcoming-role">{evt.job.role}</div>
                    <div className="cal-upcoming-meta">
                      <Tag
                        style={{
                          fontSize: 10,
                          padding: '0 5px',
                          borderRadius: 4,
                          color: colors.color,
                          background: colors.bg,
                          border: '1px solid ' + colors.border,
                          fontWeight: 700,
                        }}
                      >
                        {evt.type === 'overdue'
                          ? '🔴 Overdue'
                          : evt.type === 'today'
                          ? '🟡 Due Today'
                          : evt.type === 'interview'
                          ? '🎯 Interview'
                          : '🔔 Follow-up'}
                      </Tag>
                      <span className="cal-upcoming-date">{dateStr}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

export default CalendarView;
