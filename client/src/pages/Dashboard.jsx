import React, { useEffect, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Button,
  Progress,
  Table,
  Tag,
  Space,
  Typography,
  Alert,
  Tooltip,
  Input,
  Select,
  Radio,
  Badge,
  message,
  Modal,
  Segmented,
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SendOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  UploadOutlined,
  AuditOutlined,
  WarningOutlined,
  WhatsAppOutlined,
  MailOutlined,
  PlusOutlined,
  LinkedinOutlined,
  PhoneOutlined,
  BellOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
  UserOutlined,
  CalendarOutlined,
  TableOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { StatsAPI, QueueAPI, JobsAPI, EmailsAPI } from '../services/api';
import { WhatsAppModal } from '../components/WhatsAppModal';
import { SendEmailModal } from '../components/SendEmailModal';
import { AddCompanyModal } from '../components/AddCompanyModal';
import { FollowUpModal } from '../components/FollowUpModal';
import { JobDetailModal, STATUS_COLORS } from '../components/JobDetailModal';
import { EditJobModal } from '../components/EditJobModal';
import { KanbanView } from '../components/views/KanbanView';
import { CalendarView } from '../components/views/CalendarView';

const { Title, Text } = Typography;
const { Option } = Select;

// Dynamic company monogram
const getCompanyInitials = (name) => {
  if (!name) return 'CO';
  const clean = name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const words = clean.split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

const getAvatarGradient = (name) => {
  const gradients = [
    'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    'linear-gradient(135deg, #059669 0%, #047857 100%)',
    'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
    'linear-gradient(135deg, #db2777 0%, #be185d 100%)',
    'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash += name.charCodeAt(i);
  return gradients[Math.abs(hash) % gradients.length];
};

export function Dashboard({ onNavigate, onTriggerTestModal }) {
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(false);

  // View switcher: 'table' | 'kanban' | 'calendar'
  const [activeView, setActiveView] = useState('table');

  // Table State
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [totalJobs, setTotalJobs] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [quickFilter, setQuickFilter] = useState('all');

  // Modals
  const [activeJob, setActiveJob] = useState(null);
  const [whatsAppModalVisible, setWhatsAppModalVisible] = useState(false);
  const [sendEmailModalVisible, setSendEmailModalVisible] = useState(false);
  const [addCompanyModalVisible, setAddCompanyModalVisible] = useState(false);
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Duplicate cleanup & IMAP state
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);
  const [checkingReplies, setCheckingReplies] = useState(false);
  const [queueFollowUpsLoading, setQueueFollowUpsLoading] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await StatsAPI.getStats();
      setStatsData(res);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchDuplicateStats = async () => {
    try {
      const res = await JobsAPI.getDuplicateStats();
      setDuplicateCount(res.totalDuplicates || 0);
    } catch (err) {
      console.error('Error fetching duplicate stats:', err);
    }
  };

  const handleCleanupDuplicates = () => {
    Modal.confirm({
      title: 'Clean Up Duplicate Records?',
      icon: <ExclamationCircleOutlined style={{ color: '#ef4444' }} />,
      content: (
        <div style={{ marginTop: 8 }}>
          <p style={{ color: '#475569', fontSize: 13 }}>
            This will scan your CRM database, retain the most active and complete master record for each opportunity, and permanently remove redundant duplicate entries.
          </p>
          {duplicateCount > 0 ? (
            <p style={{ fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '6px 12px', borderRadius: 6 }}>
              Detected duplicates to remove: {duplicateCount}
            </p>
          ) : (
            <p style={{ color: '#64748b' }}>Checking and purging any duplicate entries...</p>
          )}
        </div>
      ),
      okText: 'Clean Up Duplicates Now',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          setCleaningDuplicates(true);
          const res = await JobsAPI.cleanupDuplicates();
          if (res.deletedCount > 0) {
            message.success(`Successfully removed ${res.deletedCount} duplicate record(s)!`);
          } else {
            message.info('No duplicate records found to clean up.');
          }
          fetchJobs();
          fetchStats();
          fetchDuplicateStats();
        } catch (err) {
          message.error(err.response?.data?.error || 'Failed to clean duplicates');
        } finally {
          setCleaningDuplicates(false);
        }
      },
    });
  };

  const handleCheckReplies = async () => {
    try {
      setCheckingReplies(true);
      const res = await EmailsAPI.checkReplies();
      const repliesCount = res.repliesMatched || 0;
      const bouncesCount = res.bouncesMatched || 0;

      if (repliesCount > 0 || bouncesCount > 0) {
        const parts = [];
        if (repliesCount > 0) parts.push(`🎉 ${repliesCount} new HR reply(s)`);
        if (bouncesCount > 0) parts.push(`⛔ ${bouncesCount} bounced email(s)`);
        message.success(`${parts.join(' & ')} detected! CRM statuses updated.`);
        fetchJobs();
        fetchStats();
      } else if (res.configured === false) {
        Modal.info({
          title: 'IMAP Reply & Bounce Tracking',
          content: (
            <div style={{ marginTop: 8 }}>
              <p style={{ color: '#475569' }}>{res.message}</p>
              <p style={{ color: '#64748b', fontSize: 13 }}>
                To track replies and delivery failures live from your email inbox (Gmail, Outlook, Zoho), go to <strong>Settings</strong> and enter your email address and App Password.
              </p>
              <Space wrap style={{ marginTop: 12 }}>
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={async () => {
                    Modal.destroyAll();
                    try {
                      const simRes = await EmailsAPI.simulateReply();
                      message.success(simRes.message || 'Simulated reply generated!');
                      fetchJobs();
                      fetchStats();
                    } catch (simErr) {
                      message.error(simErr.response?.data?.error || 'Simulation failed');
                    }
                  }}
                >
                  Simulate HR Reply
                </Button>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={async () => {
                    Modal.destroyAll();
                    try {
                      const simRes = await EmailsAPI.simulateBounce({
                        bouncedEmail: 'dev@ansorbit.com',
                        reason: '550 5.1.1 User does not exist - Address not found',
                      });
                      message.success(simRes.message || 'Simulated bounce generated!');
                      fetchJobs();
                      fetchStats();
                    } catch (simErr) {
                      message.error(simErr.response?.data?.error || 'Bounce simulation failed');
                    }
                  }}
                >
                  Simulate Bounced Email
                </Button>
              </Space>
            </div>
          ),
        });
      } else {
        message.info(res.message || 'Checked inbox: No new HR replies or bounces detected.');
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to check replies via IMAP');
    } finally {
      setCheckingReplies(false);
    }
  };

  const fetchJobs = async () => {
    try {
      setJobsLoading(true);
      const params = {
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        quickFilter: quickFilter !== 'all' ? quickFilter : undefined,
      };
      const res = await JobsAPI.getJobs(params);
      setJobs(res.jobs || []);
      setTotalJobs(res.total || 0);
    } catch (err) {
      console.error('Error loading jobs:', err);
      message.error('Failed to load prospects');
    } finally {
      setJobsLoading(false);
    }
  };

  const refreshAll = () => {
    fetchStats();
    fetchJobs();
    fetchDuplicateStats();
  };

  const handleQueueAllFollowUps = () => {
    Modal.confirm({
      title: 'Queue All Due Follow-up Emails?',
      icon: <BellOutlined style={{ color: '#d97706' }} />,
      content: (
        <div style={{ marginTop: 8 }}>
          <p style={{ color: '#475569', fontSize: 13 }}>
            This will automatically find every contact with a <strong>due or overdue follow-up</strong>
            {' '}(statuses: Follow-Up 1 Due, Follow-Up 2 Due, overdue Follow-Up) and add them to the
            send queue, then start the queue immediately.
          </p>
          <p style={{ color: '#b45309', background: '#fef3c7', padding: '6px 12px', borderRadius: 6, fontWeight: 600, fontSize: 12, marginTop: 8 }}>
            ⚡ Bounced and suppressed contacts are automatically excluded.
          </p>
        </div>
      ),
      okText: '🔔 Queue & Send All Follow-ups',
      okType: 'primary',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          setQueueFollowUpsLoading(true);
          const res = await QueueAPI.queueFollowUps();
          if (res.queuedCount > 0) {
            message.success(`✅ ${res.queuedCount} follow-up email(s) queued and queue started!`);
          } else {
            message.info('No due follow-up emails found. All caught up! 🎉');
          }
          refreshAll();
        } catch (err) {
          message.error(err.response?.data?.error || 'Failed to queue follow-ups');
        } finally {
          setQueueFollowUpsLoading(false);
        }
      },
    });
  };

  useEffect(() => {
    fetchStats();
    fetchDuplicateStats();
    const interval = setInterval(fetchStats, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [page, pageSize, statusFilter, quickFilter]);

  const handleToggleQueue = async () => {
    if (!statsData?.stats) return;
    try {
      setQueueLoading(true);
      if (statsData.stats.queueState === 'RUNNING') {
        await QueueAPI.pauseQueue();
      } else {
        await QueueAPI.startQueue();
      }
      await fetchStats();
    } catch (err) {
      console.error('Queue toggle error:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  // Quick filter triggers
  const handleQuickFilterClick = (filterKey) => {
    setQuickFilter(filterKey);
    setPage(1);
  };

  const stats = statsData?.stats || {};
  const isRunning = stats.queueState === 'RUNNING';
  const isPaused = stats.queueState === 'PAUSED';
  const sentToday = stats.sentToday || 0;
  const dailyLimit = stats.dailyLimit || 50;
  const progressPercent = Math.min(100, Math.round((sentToday / dailyLimit) * 100));

  // Table Columns
  const columns = [
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
      sorter: (a, b) => a.company.localeCompare(b.company),
      render: (company, record) => {
        const initials = getCompanyInitials(company);
        const bgGradient = getAvatarGradient(company);

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="company-avatar"
              style={{ background: bgGradient }}
              title={company}
            >
              {initials}
            </div>
            <div>
              <a
                onClick={() => {
                  setActiveJob(record);
                  setDetailModalVisible(true);
                }}
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: '#0f172a',
                  lineHeight: 1.3,
                  display: 'inline-block',
                }}
              >
                {company}
              </a>
              <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <Tag
                  style={{
                    fontSize: 11,
                    padding: '0 6px',
                    borderRadius: 4,
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    color: '#475569',
                  }}
                >
                  {record.job?.location || record.location || 'Ahmedabad'}
                </Tag>
                {record.remote && (
                  <Tag
                    color="purple"
                    style={{ fontSize: 11, padding: '0 6px', borderRadius: 4 }}
                  >
                    Remote
                  </Tag>
                )}
                {record.isDuplicate && (
                  <Tooltip title={record.duplicateReason || 'Potential duplicate contact'}>
                    <Tag
                      color="warning"
                      icon={<WarningOutlined />}
                      style={{ fontSize: 11, padding: '0 6px', borderRadius: 4 }}
                    >
                      Duplicate
                    </Tag>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Role & Contact',
      dataIndex: 'role',
      key: 'role',
      render: (role, record) => {
        const hrName = record.contact?.hrName || record.hrName;
        return (
          <div>
            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13.5 }}>{role}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, color: '#64748b', fontSize: 12 }}>
              <UserOutlined style={{ fontSize: 11, color: '#94a3b8' }} />
              <span>{hrName || 'Hiring Team'}</span>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Email',
      key: 'email',
      align: 'center',
      render: (_, record) => {
        const emailStatus = record.email?.status || '';
        const isSent = emailStatus === 'sent' || record.status === 'EMAIL_SENT' || record.status === 'SENT';
        const hasEmail = Boolean(record.contact?.email || record.hrEmail);

        if (!hasEmail) {
          return <span style={{ color: '#cbd5e1' }}>—</span>;
        }

        if (isSent) {
          return (
            <Tooltip
              title={`Sent on ${record.email?.sentAt ? dayjs(record.email.sentAt).format('DD MMM YYYY, hh:mm A') : 'Recorded'}`}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 9px',
                  borderRadius: 6,
                  background: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                <CheckCircleOutlined /> Sent
              </span>
            </Tooltip>
          );
        }

        if (record.status === 'SENDING') {
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 9px',
                borderRadius: 6,
                background: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              ⏳ Sending
            </span>
          );
        }

        if (record.status === 'BOUNCED' || emailStatus === 'bounced') {
          return (
            <Tooltip
              title={`Delivery Failed: ${record.contactVerification?.reason || record.lastError || '550 5.1.1 User does not exist'}`}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 9px',
                  borderRadius: 6,
                  background: '#fef2f2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                <CloseCircleOutlined /> Bounced
              </span>
            </Tooltip>
          );
        }

        if (emailStatus === 'failed' || record.status === 'FAILED') {
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 9px',
                borderRadius: 6,
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              ❌ Failed
            </span>
          );
        }

        return (
          <Tooltip title={`Ready to dispatch to ${record.contact?.email || record.hrEmail}`}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 9px',
                borderRadius: 6,
                background: '#f8fafc',
                color: '#475569',
                border: '1px solid #e2e8f0',
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              ⏳ Ready
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'WhatsApp',
      key: 'whatsapp',
      align: 'center',
      render: (_, record) => {
        const waStatus = record.whatsapp?.status || '';
        const isSent = waStatus === 'sent' || record.status === 'WHATSAPP_SENT';
        const isCopied = waStatus === 'copied';
        const phone = record.contact?.phone || record.whatsapp?.phone || '';

        if (!phone) {
          return <span style={{ color: '#cbd5e1' }}>—</span>;
        }

        if (isSent) {
          return (
            <Tooltip title={`Sent manually on ${record.whatsapp?.sentAt ? dayjs(record.whatsapp.sentAt).format('DD MMM, hh:mm A') : 'Recorded'}`}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 9px',
                  borderRadius: 6,
                  background: '#f0fdf4',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                <CheckCircleOutlined /> Sent
              </span>
            </Tooltip>
          );
        }

        if (isCopied) {
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 9px',
                borderRadius: 6,
                background: '#fffbeb',
                color: '#b45309',
                border: '1px solid #fef3c7',
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              <ClockCircleOutlined /> Copied
            </span>
          );
        }

        return (
          <Tooltip title={`Click to message ${phone}`}>
            <span
              onClick={() => {
                setActiveJob(record);
                setWhatsAppModalVisible(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 9px',
                borderRadius: 6,
                background: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <WhatsAppOutlined /> Ready
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const color = STATUS_COLORS[status] || 'default';
        const isBounced = status === 'BOUNCED';
        const isNoReq = status === 'NO_REQUIREMENT' || status === 'NO_FOLLOW_UP';

        let label = status.replace(/_/g, ' ');
        if (isBounced) label = '⛔ BOUNCED';
        else if (isNoReq) label = '🚫 NO OPENING';
        else if (status === 'FOLLOW_UP_1_DUE') label = '🔔 FOLLOW-UP 1 DUE';
        else if (status === 'FOLLOW_UP_1_SENT') label = '✉️ FOLLOW-UP 1 SENT';
        else if (status === 'FOLLOW_UP_2_DUE') label = '🔔 FOLLOW-UP 2 DUE';
        else if (status === 'FOLLOW_UP_2_SENT') label = '✉️ FOLLOW-UP 2 SENT';

        return (
          <Tag
            color={color}
            style={{
              fontWeight: 700,
              borderRadius: 6,
              fontSize: 11.5,
              padding: '2px 8px',
              border: isBounced ? '1px solid #f87171' : isNoReq ? '1px solid #cbd5e1' : undefined,
            }}
          >
            {label}
          </Tag>
        );
      },
    },
    {
      title: 'Follow-up Due',
      key: 'followUp',
      render: (_, record) => {
        const nextDate = record.tracking?.nextFollowUpAt;
        const isSuppressed =
          record.status === 'NO_REQUIREMENT' ||
          record.status === 'NO_FOLLOW_UP' ||
          record.status === 'REJECTED' ||
          record.status === 'CLOSED';

        if (record.status === 'BOUNCED') {
          return (
            <Tooltip title="Follow-up disabled: recipient email bounced/invalid">
              <Tag
                style={{
                  color: '#991b1b',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Disabled (Bounced)
              </Tag>
            </Tooltip>
          );
        }

        if (isSuppressed) {
          return (
            <Tooltip title="Follow-up permanently stopped (HR replied no opening/requirement or closed)">
              <Tag
                style={{
                  borderRadius: 6,
                  color: '#64748b',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                🚫 Suppressed
              </Tag>
            </Tooltip>
          );
        }

        if (record.jobType === 'general_inquiry' && !nextDate) {
          return (
            <Tooltip title="General inquiry: follow-up suppressed unless an active requirement is confirmed">
              <Tag
                style={{
                  borderRadius: 6,
                  color: '#64748b',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: 11,
                }}
              >
                General Inquiry
              </Tag>
            </Tooltip>
          );
        }

        if (!nextDate) {
          return (
            <Tooltip title="Click to schedule follow-up">
              <a
                onClick={() => {
                  setActiveJob(record);
                  setFollowUpModalVisible(true);
                }}
                style={{ color: '#94a3b8', fontSize: 12 }}
              >
                + Schedule
              </a>
            </Tooltip>
          );
        }

        const due = dayjs(nextDate);
        const today = dayjs();
        const isOverdue = due.isBefore(today, 'day');
        const isToday = due.isSame(today, 'day');

        if (isOverdue) {
          return (
            <Tooltip title={`Was due on ${due.format('DD MMM YYYY')}. Click to manage/send.`}>
              <Tag
                color="error"
                icon={<BellOutlined />}
                style={{ fontWeight: 600, borderRadius: 6, fontSize: 11.5, cursor: 'pointer' }}
                onClick={() => {
                  setActiveJob(record);
                  setFollowUpModalVisible(true);
                }}
              >
                Overdue ({due.format('DD MMM')})
              </Tag>
            </Tooltip>
          );
        }

        if (isToday) {
          return (
            <Tooltip title="Follow-up is due today! Click to manage/send.">
              <Tag
                color="warning"
                icon={<BellOutlined />}
                style={{ fontWeight: 600, borderRadius: 6, fontSize: 11.5, cursor: 'pointer' }}
                onClick={() => {
                  setActiveJob(record);
                  setFollowUpModalVisible(true);
                }}
              >
                Due Today
              </Tag>
            </Tooltip>
          );
        }

        return (
          <Tooltip title={`Scheduled for ${due.format('DD MMM YYYY')}. Click to manage/send.`}>
            <Tag
              color="processing"
              icon={<CalendarOutlined />}
              style={{ fontWeight: 600, borderRadius: 6, fontSize: 11.5, cursor: 'pointer' }}
              onClick={() => {
                setActiveJob(record);
                setFollowUpModalVisible(true);
              }}
            >
              {due.format('DD MMM')}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        const phone = record.contact?.phone || record.whatsapp?.phone || '';
        const linkedin = record.contact?.linkedin || record.linkedin?.profileUrl || '';

        return (
          <Space size={5}>
            <Tooltip title="Send Application Email">
              <Button
                size="small"
                type="primary"
                icon={<MailOutlined />}
                onClick={() => {
                  setActiveJob(record);
                  setSendEmailModalVisible(true);
                }}
                className="action-btn-clean"
                style={{
                  fontWeight: 600,
                  fontSize: 12,
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                }}
              >
                Email
              </Button>
            </Tooltip>

            <Tooltip title="Follow-up Manager & Sequence">
              <Button
                size="small"
                icon={<BellOutlined />}
                onClick={() => {
                  setActiveJob(record);
                  setFollowUpModalVisible(true);
                }}
                style={{
                  color: record.tracking?.nextFollowUpAt ? '#d97706' : '#475569',
                  borderColor: record.tracking?.nextFollowUpAt ? '#fcd34d' : '#cbd5e1',
                  background: record.tracking?.nextFollowUpAt ? '#fefce8' : undefined,
                  fontWeight: 600,
                  fontSize: 12,
                }}
                className="action-btn-clean"
              >
                Follow-up
              </Button>
            </Tooltip>

            <Tooltip title="WhatsApp Outreach">
              <Button
                size="small"
                icon={<WhatsAppOutlined />}
                style={{
                  color: phone ? '#15803d' : '#94a3b8',
                  borderColor: phone ? '#86efac' : '#e2e8f0',
                  background: phone ? '#f0fdf4' : undefined,
                  fontWeight: 600,
                  fontSize: 12,
                }}
                disabled={!phone}
                onClick={() => {
                  setActiveJob(record);
                  setWhatsAppModalVisible(true);
                }}
                className="action-btn-clean"
              >
                WhatsApp
              </Button>
            </Tooltip>

            {linkedin && (
              <Tooltip title="LinkedIn Profile">
                <Button
                  size="small"
                  icon={<LinkedinOutlined />}
                  href={linkedin.startsWith('http') ? linkedin : `https://${linkedin}`}
                  target="_blank"
                  style={{ color: '#0a66c2', borderColor: '#bfdbfe' }}
                  className="action-btn-clean"
                />
              </Tooltip>
            )}

            {phone && (
              <Tooltip title={`Call ${phone}`}>
                <Button
                  size="small"
                  icon={<PhoneOutlined />}
                  href={`tel:${phone}`}
                  style={{ color: '#059669', borderColor: '#a7f3d0' }}
                  className="action-btn-clean"
                />
              </Tooltip>
            )}

            <Tooltip title="View Details & Activity Timeline">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setActiveJob(record);
                  setDetailModalVisible(true);
                }}
                className="action-btn-clean"
              />
            </Tooltip>

            {record.status !== 'BOUNCED' && (
              <Tooltip title="Mark as Bounced / Invalid Email">
                <Button
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    Modal.confirm({
                      title: `Mark ${record.company} as Bounced?`,
                      icon: <CloseCircleOutlined style={{ color: '#ef4444' }} />,
                      content: `This will mark "${record.contact?.email || record.hrEmail}" as an invalid/bounced email address (550 User does not exist) and block further automated sends.`,
                      okText: 'Mark Bounced',
                      okType: 'danger',
                      onOk: async () => {
                        await JobsAPI.markBounced(record._id, {
                          reason: '550 5.1.1 User does not exist - Address not found',
                        });
                        message.success(`Marked ${record.company} as BOUNCED`);
                        refreshAll();
                      },
                    });
                  }}
                  className="action-btn-clean"
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      {/* Sleek SaaS Header */}
      <div className="crm-header-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="crm-title">Job Outreach CRM</h1>
              <span
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {totalJobs} Prospects Active
              </span>
            </div>
            <p className="crm-subtitle">
              AI-Curated multi-channel candidate pipeline • Email, WhatsApp, and LinkedIn Outreach Management
            </p>
          </div>

          <Space wrap size={8}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddCompanyModalVisible(true)}
              style={{
                fontWeight: 700,
                background: '#16a34a',
                borderColor: '#16a34a',
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)',
              }}
            >
              Add Company
            </Button>

            <Button
              icon={<UploadOutlined />}
              onClick={() => onNavigate('import')}
              style={{ fontWeight: 600 }}
            >
              Import JSON
            </Button>

            <Button
              icon={<AuditOutlined />}
              onClick={() => onNavigate('review')}
              style={{ fontWeight: 600 }}
            >
              Batch Review
            </Button>

            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleCleanupDuplicates}
              loading={cleaningDuplicates}
              style={{ fontWeight: 600 }}
            >
              Cleanup Duplicates {duplicateCount > 0 ? `(${duplicateCount})` : ''}
            </Button>

            <Button
              icon={<SyncOutlined spin={checkingReplies} />}
              onClick={handleCheckReplies}
              loading={checkingReplies}
              style={{
                borderColor: '#c4b5fd',
                color: '#7c3aed',
                background: '#faf5ff',
                fontWeight: 600,
              }}
              title="Check inbox via IMAP for incoming HR email replies and delivery bounces"
            >
              Check Replies (IMAP)
            </Button>

            <Button
              icon={<BellOutlined />}
              onClick={handleQueueAllFollowUps}
              loading={queueFollowUpsLoading}
              style={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                borderColor: '#d97706',
                color: '#fff',
                boxShadow: '0 2px 8px rgba(217, 119, 6, 0.35)',
              }}
            >
              Queue All Follow-ups
            </Button>

            <Button
              type={isRunning ? 'default' : 'primary'}
              danger={isRunning}
              icon={isRunning ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={handleToggleQueue}
              loading={queueLoading}
              style={{ fontWeight: 700 }}
            >
              {isRunning ? 'PAUSE QUEUE' : 'START QUEUE'}
            </Button>
          </Space>
        </div>
      </div>

      {stats.dryRun && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="DRY RUN Active"
          description="Emails sent via Queue or Direct Send will be logged in full detail but will NOT be dispatched to external SMTP servers. Toggle anytime in Settings."
          style={{ marginBottom: 18, borderRadius: 10, border: '1px solid #fef3c7' }}
        />
      )}

      {/* Queue & Daily Send Status Mini Bar */}
      <div className="queue-status-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 6,
              background: isRunning ? '#ecfdf5' : '#fffbeb',
              border: isRunning ? '1px solid #a7f3d0' : '1px solid #fef3c7',
              color: isRunning ? '#047857' : '#b45309',
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: isRunning ? '#10b981' : '#f59e0b',
                display: 'inline-block',
              }}
              className={isRunning ? 'pulse-active' : ''}
            />
            Queue: {stats.queueState || 'IDLE'}
          </span>
          <Text style={{ fontSize: 13, color: '#475569' }}>
            Approved: <strong>{stats.approved || 0}</strong> &nbsp;|&nbsp; Queued: <strong>{stats.queued || 0}</strong>
          </Text>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 260 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
              <span style={{ color: '#64748b' }}>Daily Send Limit</span>
              <span style={{ fontWeight: 700, color: '#1e293b' }}>
                {sentToday} / {dailyLimit} ({dailyLimit - sentToday} left)
              </span>
            </div>
            <Progress
              percent={progressPercent}
              showInfo={false}
              size="small"
              strokeColor={{
                '0%': '#2563eb',
                '100%': progressPercent >= 100 ? '#ef4444' : '#10b981',
              }}
            />
          </div>

          <Button
            size="small"
            onClick={() => onTriggerTestModal()}
            style={{ fontWeight: 600, fontSize: 12, borderRadius: 6 }}
          >
            Safe Test Email
          </Button>
        </div>
      </div>

      {/* Main CRM Pipeline Card */}
      <Card
        style={{
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
        }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>Prospect Pipeline</span>
            <span
              style={{
                background: '#eff6ff',
                color: '#2563eb',
                fontSize: 12,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 6,
                border: '1px solid #bfdbfe',
              }}
            >
              {totalJobs} total
            </span>
          </div>
        }
        extra={
          <Space wrap size={8}>
            {/* ── View Switcher ── */}
            <Segmented
              value={activeView}
              onChange={setActiveView}
              options={[
                { value: 'table', icon: <TableOutlined />, label: 'Table' },
                { value: 'kanban', icon: <AppstoreOutlined />, label: 'Kanban' },
                { value: 'calendar', icon: <CalendarOutlined />, label: 'Calendar' },
              ]}
              style={{ fontWeight: 600 }}
            />
            {activeView === 'table' && (
              <>
                <Input
                  placeholder="Search company, role, HR..."
                  prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onPressEnter={() => { setPage(1); fetchJobs(); }}
                  style={{ width: 230 }}
                  allowClear
                />
                <Select
                  value={statusFilter}
                  onChange={(val) => { setStatusFilter(val); setPage(1); }}
                  style={{ width: 195 }}
                >
                  <Option value="ALL">All Statuses</Option>
                  <Option value="NEW">NEW</Option>
                  <Option value="RESEARCHED">RESEARCHED</Option>
                  <Option value="READY_TO_CONTACT">READY_TO_CONTACT</Option>
                  <Option value="EMAIL_SENT">EMAIL_SENT</Option>
                  <Option value="SENT">SENT</Option>
                  <Option value="FOLLOW_UP_1_DUE">FOLLOW_UP_1_DUE</Option>
                  <Option value="FOLLOW_UP_1_SENT">FOLLOW_UP_1_SENT</Option>
                  <Option value="FOLLOW_UP_2_DUE">FOLLOW_UP_2_DUE</Option>
                  <Option value="FOLLOW_UP_2_SENT">FOLLOW_UP_2_SENT</Option>
                  <Option value="FOLLOW_UP">FOLLOW_UP</Option>
                  <Option value="NO_REQUIREMENT">🚫 NO REQUIREMENT</Option>
                  <Option value="WHATSAPP_PENDING">WHATSAPP_PENDING</Option>
                  <Option value="WHATSAPP_SENT">WHATSAPP_SENT</Option>
                  <Option value="LINKEDIN_CONTACTED">LINKEDIN_CONTACTED</Option>
                  <Option value="REPLIED">REPLIED</Option>
                  <Option value="INTERVIEW">INTERVIEW</Option>
                  <Option value="BOUNCED">⛔ BOUNCED / INVALID</Option>
                  <Option value="CLOSED">CLOSED</Option>
                </Select>
                <Button icon={<ReloadOutlined />} onClick={refreshAll} style={{ fontWeight: 600 }}>
                  Refresh
                </Button>
              </>
            )}
            {activeView !== 'table' && (
              <Button icon={<ReloadOutlined />} onClick={refreshAll} style={{ fontWeight: 600 }}>
                Refresh
              </Button>
            )}
          </Space>
        }
      >
        {/* ── Table View ── */}
        {activeView === 'table' && (
          <>
            {/* Quick Filter Pill Tabs */}
            <div style={{ marginBottom: 16, overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: 4 }}>
              <Radio.Group
                value={quickFilter}
                onChange={(e) => handleQuickFilterClick(e.target.value)}
                buttonStyle="solid"
              >
                <Radio.Button value="all">All ({totalJobs})</Radio.Button>
                <Radio.Button value="followups_due">
                  🔔 Follow-ups ({stats.followupsScheduled || stats.followupsDue || 0})
                </Radio.Button>
                <Radio.Button value="applications_sent">🟢 Sent ({stats.applicationsSent || 0})</Radio.Button>
                <Radio.Button value="replies">💬 Replies ({stats.replies || 0})</Radio.Button>
                <Radio.Button value="interviews">🎯 Interviews ({stats.interviews || 0})</Radio.Button>
                <Radio.Button value="no_requirement">🚫 No Requirement ({stats.noRequirement || 0})</Radio.Button>
                <Radio.Button value="bounced">⛔ Bounced ({stats.bounced || 0})</Radio.Button>
                <Radio.Button value="whatsapp_pending">🟡 WhatsApp ({stats.whatsappPending || 0})</Radio.Button>
                <Radio.Button value="emails_pending">🔵 Emails ({stats.emailsPending || 0})</Radio.Button>
              </Radio.Group>
            </div>

            <Table
              dataSource={jobs}
              columns={columns}
              rowKey="_id"
              loading={jobsLoading}
              pagination={{
                current: page,
                pageSize,
                total: totalJobs,
                showSizeChanger: true,
                onChange: (p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                },
              }}
              size="middle"
            />
          </>
        )}

        {/* ── Kanban View ── */}
        {activeView === 'kanban' && (
          <KanbanView
            jobs={jobs}
            loading={jobsLoading}
            onCardClick={(job) => { setActiveJob(job); setDetailModalVisible(true); }}
            onFollowUpClick={(job) => { setActiveJob(job); setFollowUpModalVisible(true); }}
          />
        )}

        {/* ── Calendar View ── */}
        {activeView === 'calendar' && (
          <CalendarView
            jobs={jobs}
            onCardClick={(job) => { setActiveJob(job); setDetailModalVisible(true); }}
          />
        )}
      </Card>

      {/* Modals */}
      <WhatsAppModal
        visible={whatsAppModalVisible}
        job={activeJob}
        onClose={() => setWhatsAppModalVisible(false)}
        onSuccess={refreshAll}
      />

      <SendEmailModal
        visible={sendEmailModalVisible}
        job={activeJob}
        onClose={() => setSendEmailModalVisible(false)}
        onSuccess={refreshAll}
      />

      <AddCompanyModal
        visible={addCompanyModalVisible}
        onClose={() => setAddCompanyModalVisible(false)}
        onSuccess={refreshAll}
      />

      <FollowUpModal
        visible={followUpModalVisible}
        job={activeJob}
        onClose={() => setFollowUpModalVisible(false)}
        onSuccess={refreshAll}
      />

      <JobDetailModal
        job={activeJob}
        visible={detailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        onEdit={(job) => {
          setActiveJob(job);
          setDetailModalVisible(false);
          setEditModalVisible(true);
        }}
        onPreviewEmail={() => {
          setDetailModalVisible(false);
          setSendEmailModalVisible(true);
        }}
        onTriggerSendEmail={(job) => {
          setActiveJob(job);
          setDetailModalVisible(false);
          setSendEmailModalVisible(true);
        }}
        onTriggerWhatsApp={(job) => {
          setActiveJob(job);
          setDetailModalVisible(false);
          setWhatsAppModalVisible(true);
        }}
        onTriggerFollowUp={(job) => {
          setActiveJob(job);
          setDetailModalVisible(false);
          setFollowUpModalVisible(true);
        }}
        onRefresh={refreshAll}
      />

      <EditJobModal
        job={activeJob}
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        onSaved={refreshAll}
      />
    </div>
  );
}

export default Dashboard;
