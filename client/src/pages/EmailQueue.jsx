import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Progress,
  Alert,
  message,
  Tabs,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  RedoOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { QueueAPI } from '../services/api';

const { Title, Text } = Typography;

export function EmailQueue() {
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const data = await QueueAPI.getStatus();
      setQueueData(data);
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStartQueue = async () => {
    try {
      setActionLoading(true);
      await QueueAPI.startQueue();
      message.success('Queue started!');
      fetchQueue();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to start queue');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseQueue = async () => {
    try {
      setActionLoading(true);
      await QueueAPI.pauseQueue();
      message.info('Queue paused.');
      fetchQueue();
    } catch (err) {
      message.error('Failed to pause queue');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryJob = async (jobId) => {
    try {
      await QueueAPI.retryJob(jobId);
      message.success('Job requeued for sending');
      fetchQueue();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to retry job');
    }
  };

  const handleRetryAll = async () => {
    try {
      const res = await QueueAPI.retryAll();
      message.success(`Requeued ${res.modifiedCount} failed job(s)`);
      fetchQueue();
    } catch (err) {
      message.error('Failed to retry all jobs');
    }
  };

  const isRunning = queueData?.state === 'RUNNING';
  const isPaused = queueData?.state === 'PAUSED';
  const sentToday = queueData?.sentToday || 0;
  const dailyLimit = queueData?.dailyLimit || 20;
  const progressPercent = Math.min(100, Math.round((sentToday / dailyLimit) * 100));

  const queuedColumns = [
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
      title: 'Recipient HR Email',
      dataIndex: 'hrEmail',
      key: 'hrEmail',
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      render: (loc, r) => (
        <span>
          {loc || '—'} {r.remote ? <Tag color="purple">Remote</Tag> : null}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'SENDING' ? 'processing' : 'blue'}>
          {status}
        </Tag>
      ),
    },
  ];

  const failedColumns = [
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
      title: 'Retries',
      dataIndex: 'retryCount',
      key: 'retryCount',
      render: (cnt) => <Tag color={cnt >= 3 ? 'red' : 'orange'}>{cnt} / 3</Tag>,
    },
    {
      title: 'Failure Reason',
      dataIndex: 'lastError',
      key: 'lastError',
      render: (err) => (
        <Text type="danger" style={{ fontSize: 13 }}>
          {err || 'Delivery failed'}
        </Text>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button
          size="small"
          type="primary"
          icon={<RedoOutlined />}
          onClick={() => handleRetryJob(record._id)}
        >
          Retry
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Dispatch Queue & Rate Limiter
          </Title>
          <Text type="secondary">
            Controls sequential email delivery, rate limiting delays, and automatic daily volume protection.
          </Text>
        </div>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchQueue}>
            Refresh
          </Button>

          {isRunning ? (
            <Button
              danger
              icon={<PauseCircleOutlined />}
              onClick={handlePauseQueue}
              loading={actionLoading}
            >
              PAUSE QUEUE
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleStartQueue}
              loading={actionLoading}
            >
              START SENDING QUEUE
            </Button>
          )}
        </Space>
      </div>

      {sentToday >= dailyLimit && (
        <Alert
          type="error"
          showIcon
          icon={<CloseCircleOutlined />}
          message="Daily Sending Limit Reached"
          description={`You have reached your daily quota of ${dailyLimit} applications. Queue is paused until tomorrow to protect your sender reputation.`}
          style={{ marginBottom: 20 }}
        />
      )}

      {/* Control Banner */}
      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} md={8}>
            <Text type="secondary" style={{ fontSize: 13, textTransform: 'uppercase' }}>
              Queue Engine Status
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <Tag
                color={isRunning ? 'green' : isPaused ? 'orange' : 'default'}
                style={{ fontSize: 15, padding: '4px 12px', fontWeight: 600 }}
              >
                {queueData?.state || 'IDLE'}
              </Tag>
              <div>
                <Text strong style={{ display: 'block' }}>
                  {isRunning ? 'Actively Sending' : isPaused ? 'Paused by User' : 'Queue Idle'}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Delay between sends: {queueData?.minDelaySeconds || 10}s - {queueData?.maxDelaySeconds || 30}s
                </Text>
              </div>
            </div>
          </Col>

          <Col xs={24} md={10}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text type="secondary">Daily Send Progress</Text>
              <Text strong>
                {sentToday} of {dailyLimit} sent today ({queueData?.remainingToday || 0} remaining)
              </Text>
            </div>
            <Progress
              percent={progressPercent}
              status={progressPercent >= 100 ? 'exception' : 'active'}
              strokeColor={{
                '0%': '#1890ff',
                '100%': progressPercent >= 100 ? '#ff4d4f' : '#52c41a',
              }}
            />
          </Col>

          <Col xs={24} md={6} style={{ textAlign: 'right' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                block
                type={isRunning ? 'default' : 'primary'}
                danger={isRunning}
                icon={isRunning ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={isRunning ? handlePauseQueue : handleStartQueue}
                loading={actionLoading}
              >
                {isRunning ? 'Pause Sending' : 'Start Queue'}
              </Button>

              {queueData?.failedJobs?.length > 0 && (
                <Button block icon={<RedoOutlined />} onClick={handleRetryAll}>
                  Retry All Failed ({queueData.failedJobs.length})
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Queued vs Failed Tabs */}
      <Card style={{ borderRadius: 12 }}>
        <Tabs
          defaultActiveKey="queued"
          items={[
            {
              key: 'queued',
              label: (
                <span>
                  <ClockCircleOutlined /> Queued & In Progress (
                  {queueData?.queuedJobs?.length || 0})
                </span>
              ),
              children: (
                <Table
                  dataSource={queueData?.queuedJobs || []}
                  columns={queuedColumns}
                  rowKey="_id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: 'No jobs waiting in queue. Approve jobs in Review page first.' }}
                />
              ),
            },
            {
              key: 'failed',
              label: (
                <span>
                  <CloseCircleOutlined style={{ color: '#f5222d' }} /> Failed Delivery (
                  {queueData?.failedJobs?.length || 0})
                </span>
              ),
              children: (
                <div>
                  {queueData?.failedJobs?.length > 0 && (
                    <div style={{ marginBottom: 12, textAlign: 'right' }}>
                      <Button icon={<RedoOutlined />} onClick={handleRetryAll}>
                        Retry All Failed
                      </Button>
                    </div>
                  )}
                  <Table
                    dataSource={queueData?.failedJobs || []}
                    columns={failedColumns}
                    rowKey="_id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: 'No failed deliveries.' }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

export default EmailQueue;
