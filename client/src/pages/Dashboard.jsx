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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { StatsAPI, QueueAPI, JobsAPI } from '../services/api';
import { WhatsAppModal } from '../components/WhatsAppModal';
import { SendEmailModal } from '../components/SendEmailModal';
import { AddCompanyModal } from '../components/AddCompanyModal';
import { FollowUpModal } from '../components/FollowUpModal';
import { JobDetailModal, STATUS_COLORS } from '../components/JobDetailModal';
import { EditJobModal } from '../components/EditJobModal';

const { Title, Text } = Typography;
const { Option } = Select;

export function Dashboard({ onNavigate, onTriggerTestModal }) {
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(false);

  // Table State
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [totalJobs, setTotalJobs] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
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

  const fetchStats = async () => {
    try {
      const res = await StatsAPI.getStats();
      setStatsData(res);
    } catch (err) {
      console.error('Error fetching stats:', err);
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
  };

  useEffect(() => {
    fetchStats();
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

  // Table Columns exactly matching the user's specification
  const columns = [
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
      sorter: (a, b) => a.company.localeCompare(b.company),
      render: (company, record) => (
        <div>
          <a
            onClick={() => {
              setActiveJob(record);
              setDetailModalVisible(true);
            }}
            style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}
          >
            {company}
          </a>
          <div style={{ marginTop: 2 }}>
            <Space size={4}>
              <Tag style={{ fontSize: 11 }}>
                {record.job?.location || record.location || 'Ahmedabad'}
              </Tag>
              {record.remote && <Tag color="purple" style={{ fontSize: 11 }}>Remote</Tag>}
              {record.isDuplicate && (
                <Tooltip title={record.duplicateReason || 'Potential duplicate contact'}>
                  <Tag color="warning" icon={<WarningOutlined />} style={{ fontSize: 11 }}>
                    Duplicate
                  </Tag>
                </Tooltip>
              )}
            </Space>
          </div>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#334155' }}>{role}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.contact?.hrName ? record.contact.hrName : record.hrName ? record.hrName : 'Hiring Team'}
          </Text>
        </div>
      ),
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
          return <span style={{ color: '#94a3b8' }}>—</span>;
        }

        if (isSent) {
          return (
            <Tooltip
              title={`Sent on ${record.email?.sentAt ? dayjs(record.email.sentAt).format('DD MMM YYYY, hh:mm A') : 'Recorded'}`}
            >
              <Tag color="green" icon={<CheckCircleOutlined />}>
                ✅ Sent
              </Tag>
            </Tooltip>
          );
        }

        if (record.status === 'SENDING') {
          return <Tag color="processing">⏳ Sending</Tag>;
        }

        if (emailStatus === 'failed' || record.status === 'FAILED') {
          return <Tag color="red">❌ Failed</Tag>;
        }

        return (
          <Tooltip title={`Ready to dispatch to ${record.contact?.email || record.hrEmail}`}>
            <Tag color="default">⏳ Ready</Tag>
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
          return <span style={{ color: '#94a3b8' }}>—</span>;
        }

        if (isSent) {
          return (
            <Tooltip title={`Sent manually on ${record.whatsapp?.sentAt ? dayjs(record.whatsapp.sentAt).format('DD MMM, hh:mm A') : 'Recorded'}`}>
              <Tag color="geekblue" icon={<CheckCircleOutlined />}>
                ✅ Sent
              </Tag>
            </Tooltip>
          );
        }

        if (isCopied) {
          return (
            <Tag color="gold" icon={<ClockCircleOutlined />}>
              💬 Copied
            </Tag>
          );
        }

        return (
          <Tooltip title={`Click to message ${phone}`}>
            <Tag
              color="green"
              icon={<WhatsAppOutlined />}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setActiveJob(record);
                setWhatsAppModalVisible(true);
              }}
            >
              📱 Ready
            </Tag>
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
        return (
          <Tag color={color} style={{ fontWeight: 600, borderRadius: 4 }}>
            {status}
          </Tag>
        );
      },
    },
    {
      title: 'Follow-up Due',
      key: 'followUp',
      render: (_, record) => {
        const nextDate = record.tracking?.nextFollowUpAt;
        if (!nextDate) return <span style={{ color: '#cbd5e1' }}>—</span>;

        const due = dayjs(nextDate);
        const today = dayjs();
        const isOverdue = due.isBefore(today, 'day');
        const isToday = due.isSame(today, 'day');

        if (isOverdue) {
          return (
            <Tooltip title={`Was due on ${due.format('DD MMM YYYY')}`}>
              <Tag color="red" icon={<BellOutlined />}>
                🔴 Overdue ({due.format('DD MMM')})
              </Tag>
            </Tooltip>
          );
        }

        if (isToday) {
          return (
            <Tag color="orange" icon={<BellOutlined />}>
              🟡 Due Today
            </Tag>
          );
        }

        return (
          <Tag color="blue" icon={<BellOutlined />}>
            {due.format('DD MMM')}
          </Tag>
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
          <Space size={6}>
            <Tooltip title="Send Application Email">
              <Button
                size="small"
                type="primary"
                icon={<MailOutlined />}
                onClick={() => {
                  setActiveJob(record);
                  setSendEmailModalVisible(true);
                }}
              >
                Email
              </Button>
            </Tooltip>

            <Tooltip title="WhatsApp Outreach (Copy → Open → Send)">
              <Button
                size="small"
                icon={<WhatsAppOutlined />}
                style={{
                  color: phone ? '#128C7E' : '#94a3b8',
                  borderColor: phone ? '#25D366' : '#e2e8f0',
                }}
                disabled={!phone}
                onClick={() => {
                  setActiveJob(record);
                  setWhatsAppModalVisible(true);
                }}
              >
                WhatsApp
              </Button>
            </Tooltip>

            {linkedin && (
              <Tooltip title="Open LinkedIn Profile">
                <Button
                  size="small"
                  icon={<LinkedinOutlined />}
                  href={linkedin.startsWith('http') ? linkedin : `https://${linkedin}`}
                  target="_blank"
                  style={{ color: '#0a66c2' }}
                />
              </Tooltip>
            )}

            {phone && (
              <Tooltip title={`Call ${phone}`}>
                <Button
                  size="small"
                  icon={<PhoneOutlined />}
                  href={`tel:${phone}`}
                />
              </Tooltip>
            )}

            <Tooltip title="View CRM Details & Activity Timeline">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setActiveJob(record);
                  setDetailModalVisible(true);
                }}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      {/* Header with Navigation and Quick Creation */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Job Outreach CRM
          </Title>
          <Text type="secondary">
            Personalized Job Outreach & Application Tracker (Separate Email & WhatsApp Outreach Management)
          </Text>
        </div>

        <Space wrap>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddCompanyModalVisible(true)}
            style={{ fontWeight: 600, background: '#16a34a', borderColor: '#16a34a' }}
          >
            Add Company
          </Button>

          <Button icon={<UploadOutlined />} onClick={() => onNavigate('import')}>
            Import JSON
          </Button>

          <Button icon={<AuditOutlined />} onClick={() => onNavigate('review')}>
            Batch Review
          </Button>

          <Button
            type={isRunning ? 'default' : 'primary'}
            danger={isRunning}
            icon={isRunning ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={handleToggleQueue}
            loading={queueLoading}
          >
            {isRunning ? 'PAUSE QUEUE' : 'START QUEUE'}
          </Button>
        </Space>
      </div>

      {stats.dryRun && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="DRY RUN Active"
          description="Emails sent via Queue or Direct Send will be logged in full detail but will NOT be dispatched to external SMTP servers. Toggle anytime in Settings."
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      {/* Today's CRM Priorities Banner */}
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ fontSize: 13, textTransform: 'uppercase', color: '#64748b' }}>
          Today's Outreach Metrics
        </Text>
        <Row gutter={[12, 12]} style={{ marginTop: 6 }}>
          <Col xs={12} sm={8} lg={4}>
            <Card
              className="stat-card"
              hoverable
              onClick={() => handleQuickFilterClick('followups_due')}
              style={{
                borderLeft: quickFilter === 'followups_due' ? '4px solid #ef4444' : undefined,
                background: quickFilter === 'followups_due' ? '#fef2f2' : undefined,
              }}
            >
              <Statistic
                title="🔴 Follow-ups Due"
                value={stats.followupsDue || 0}
                valueStyle={{ color: '#ef4444', fontWeight: 700 }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={8} lg={4}>
            <Card
              className="stat-card"
              hoverable
              onClick={() => handleQuickFilterClick('whatsapp_pending')}
              style={{
                borderLeft: quickFilter === 'whatsapp_pending' ? '4px solid #f59e0b' : undefined,
                background: quickFilter === 'whatsapp_pending' ? '#fffbeb' : undefined,
              }}
            >
              <Statistic
                title="🟡 WhatsApp Pending"
                value={stats.whatsappPending || 0}
                valueStyle={{ color: '#f59e0b', fontWeight: 700 }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={8} lg={4}>
            <Card
              className="stat-card"
              hoverable
              onClick={() => handleQuickFilterClick('emails_pending')}
              style={{
                borderLeft: quickFilter === 'emails_pending' ? '4px solid #3b82f6' : undefined,
                background: quickFilter === 'emails_pending' ? '#eff6ff' : undefined,
              }}
            >
              <Statistic
                title="🔵 Emails Pending"
                value={stats.emailsPending || 0}
                valueStyle={{ color: '#3b82f6', fontWeight: 700 }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={8} lg={4}>
            <Card
              className="stat-card"
              hoverable
              onClick={() => handleQuickFilterClick('applications_sent')}
              style={{
                borderLeft: quickFilter === 'applications_sent' ? '4px solid #10b981' : undefined,
                background: quickFilter === 'applications_sent' ? '#f0fdf4' : undefined,
              }}
            >
              <Statistic
                title="🟢 Applications Sent"
                value={stats.applicationsSent || 0}
                valueStyle={{ color: '#10b981', fontWeight: 700 }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={8} lg={4}>
            <Card
              className="stat-card"
              hoverable
              onClick={() => handleQuickFilterClick('replies')}
              style={{
                borderLeft: quickFilter === 'replies' ? '4px solid #8b5cf6' : undefined,
                background: quickFilter === 'replies' ? '#f5f3ff' : undefined,
              }}
            >
              <Statistic
                title="💬 Replies"
                value={stats.replies || 0}
                valueStyle={{ color: '#8b5cf6', fontWeight: 700 }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={8} lg={4}>
            <Card
              className="stat-card"
              hoverable
              onClick={() => handleQuickFilterClick('interviews')}
              style={{
                borderLeft: quickFilter === 'interviews' ? '4px solid #ec4899' : undefined,
                background: quickFilter === 'interviews' ? '#fdf2f8' : undefined,
              }}
            >
              <Statistic
                title="🎯 Interviews"
                value={stats.interviews || 0}
                valueStyle={{ color: '#ec4899', fontWeight: 700 }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* Main CRM Table Card */}
      <Card
        style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Company Prospects</span>
            <Tag color="blue">{totalJobs} total records</Tag>
          </div>
        }
        extra={
          <Space wrap>
            <Input
              placeholder="Search company, role, HR..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={() => {
                setPage(1);
                fetchJobs();
              }}
              style={{ width: 220 }}
              allowClear
            />

            <Select
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
              style={{ width: 170 }}
            >
              <Option value="ALL">All Statuses</Option>
              <Option value="NEW">NEW</Option>
              <Option value="RESEARCHED">RESEARCHED</Option>
              <Option value="READY_TO_CONTACT">READY_TO_CONTACT</Option>
              <Option value="EMAIL_SENT">EMAIL_SENT</Option>
              <Option value="WHATSAPP_PENDING">WHATSAPP_PENDING</Option>
              <Option value="WHATSAPP_SENT">WHATSAPP_SENT</Option>
              <Option value="LINKEDIN_CONTACTED">LINKEDIN_CONTACTED</Option>
              <Option value="REPLIED">REPLIED</Option>
              <Option value="INTERVIEW">INTERVIEW</Option>
              <Option value="FOLLOW_UP">FOLLOW_UP</Option>
              <Option value="CLOSED">CLOSED</Option>
            </Select>

            <Button icon={<ReloadOutlined />} onClick={refreshAll}>
              Refresh
            </Button>
          </Space>
        }
      >
        {/* Quick Filter Tabs */}
        <div style={{ marginBottom: 16, overflowX: 'auto', whiteSpace: 'nowrap' }}>
          <Radio.Group
            value={quickFilter}
            onChange={(e) => handleQuickFilterClick(e.target.value)}
            buttonStyle="solid"
          >
            <Radio.Button value="all">All Prospects</Radio.Button>
            <Radio.Button value="followups_due">🔴 Follow-ups Due</Radio.Button>
            <Radio.Button value="whatsapp_pending">🟡 WhatsApp Pending</Radio.Button>
            <Radio.Button value="emails_pending">🔵 Emails Pending</Radio.Button>
            <Radio.Button value="applications_sent">🟢 Applications Sent</Radio.Button>
            <Radio.Button value="replies">💬 Replies</Radio.Button>
            <Radio.Button value="interviews">🎯 Interviews</Radio.Button>
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
