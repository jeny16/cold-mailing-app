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
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SendOutlined,
  CloseCircleOutlined,
  StopOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  UploadOutlined,
  AuditOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { StatsAPI, QueueAPI } from '../services/api';

const { Title, Text, Paragraph } = Typography;

export function Dashboard({ onNavigate, onTriggerTestModal }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(false);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const res = await StatsAPI.getStats();
      setData(res);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
    const interval = setInterval(fetchDashboardStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleQueue = async () => {
    if (!data?.stats) return;
    try {
      setQueueLoading(true);
      if (data.stats.queueState === 'RUNNING') {
        await QueueAPI.pauseQueue();
      } else {
        await QueueAPI.startQueue();
      }
      await fetchDashboardStats();
    } catch (err) {
      console.error('Queue toggle error:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  const stats = data?.stats || {};
  const isRunning = stats.queueState === 'RUNNING';
  const isPaused = stats.queueState === 'PAUSED';
  const sentToday = stats.sentToday || 0;
  const dailyLimit = stats.dailyLimit || 20;
  const progressPercent = Math.min(100, Math.round((sentToday / dailyLimit) * 100));

  const recentJobsColumns = [
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
    },
    {
      title: 'HR Email',
      dataIndex: 'hrEmail',
      key: 'hrEmail',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const color =
          status === 'SENT'
            ? 'green'
            : status === 'APPROVED'
            ? 'blue'
            : status === 'QUEUED'
            ? 'cyan'
            : status === 'FAILED'
            ? 'red'
            : status === 'SKIPPED'
            ? 'default'
            : 'orange';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: 'Imported',
      dataIndex: 'importedAt',
      key: 'importedAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Job Application Mailer Dashboard
          </Title>
          <Text type="secondary">
            Manage your AI-curated job prospects, review listings, and dispatch personalized cold applications safely.
          </Text>
        </div>

        <Space>
          <Button icon={<UploadOutlined />} onClick={() => onNavigate('import')}>
            Import JSON
          </Button>
          <Button icon={<AuditOutlined />} type="default" onClick={() => onNavigate('review')}>
            Review Jobs
          </Button>
          <Button
            type={isRunning ? 'default' : 'primary'}
            danger={isRunning}
            icon={isRunning ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={handleToggleQueue}
            loading={queueLoading}
          >
            {isRunning ? 'PAUSE SENDING' : 'START SENDING'}
          </Button>
        </Space>
      </div>

      {stats.dryRun && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="DRY RUN Active"
          description="Emails will be logged in full detail but will NOT be sent to external SMTP servers. Change this anytime in Settings."
          style={{ marginBottom: 20 }}
        />
      )}

      {/* Queue State Card */}
      <Card style={{ marginBottom: 24, borderRadius: 12, border: '1px solid #e2e8f0' }}>
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} md={8}>
            <Text type="secondary" style={{ display: 'block', fontSize: 13, textTransform: 'uppercase' }}>
              Queue Engine Status
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <Tag
                color={isRunning ? 'green' : isPaused ? 'orange' : 'default'}
                style={{ fontSize: 14, padding: '4px 10px', fontWeight: 600 }}
              >
                {stats.queueState || 'IDLE'}
              </Tag>
              <Text strong>
                {isRunning
                  ? 'Actively processing queue'
                  : isPaused
                  ? 'Sending is paused'
                  : 'Idle (Awaiting approved jobs)'}
              </Text>
            </div>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Approved: <strong>{stats.approved || 0}</strong> | Queued: <strong>{stats.queued || 0}</strong>
              </Text>
            </div>
          </Col>

          <Col xs={24} md={10}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Daily Send Limit
              </Text>
              <Text strong>
                {sentToday} / {dailyLimit} sent today
              </Text>
            </div>
            <Progress
              percent={progressPercent}
              status={progressPercent >= 100 ? 'exception' : 'active'}
              strokeColor={{
                '0%': '#108ee9',
                '100%': progressPercent >= 100 ? '#ff4d4f' : '#87d068',
              }}
            />
            {progressPercent >= 100 && (
              <Text type="danger" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                Daily limit reached. Queue will not dispatch until tomorrow or limit is adjusted in Settings.
              </Text>
            )}
          </Col>

          <Col xs={24} md={6} style={{ textAlign: 'right' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                block
                type="primary"
                icon={<AuditOutlined />}
                onClick={() => onNavigate('review')}
              >
                Review Pending ({stats.review || 0})
              </Button>
              <Button block onClick={() => onTriggerTestModal()}>
                Send Safe Test Email
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Primary Metrics Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card" hoverable onClick={() => onNavigate('review')}>
            <Statistic
              title="Total Jobs"
              value={stats.total || 0}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card" hoverable onClick={() => onNavigate('review')}>
            <Statistic
              title="Pending Review"
              value={stats.review || 0}
              valueStyle={{ color: '#faad14' }}
              prefix={<AuditOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card" hoverable onClick={() => onNavigate('review')}>
            <Statistic
              title="Approved"
              value={stats.approved || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card" hoverable onClick={() => onNavigate('queue')}>
            <Statistic
              title="Queued"
              value={stats.queued || 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card" hoverable onClick={() => onNavigate('history')}>
            <Statistic
              title="Sent"
              value={stats.sent || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<SendOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card" hoverable onClick={() => onNavigate('history')}>
            <Statistic
              title="Failed"
              value={stats.failed || 0}
              valueStyle={{ color: '#f5222d' }}
              prefix={<CloseCircleOutlined style={{ color: '#f5222d' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Recent Activity Table */}
      <Card
        title="Recently Imported Job Openings"
        extra={
          <Button type="link" onClick={() => onNavigate('review')}>
            View All Jobs →
          </Button>
        }
        style={{ borderRadius: 12 }}
      >
        <Table
          dataSource={data?.recentJobs || []}
          columns={recentJobsColumns}
          rowKey="_id"
          pagination={false}
          loading={loading}
          size="middle"
        />
      </Card>
    </div>
  );
}

export default Dashboard;
