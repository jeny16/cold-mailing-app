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
  notification,
  Tabs,
  Popconfirm,
  Tooltip,
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
  DeleteOutlined,
  SafetyCertificateOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { QueueAPI } from '../services/api';

const { Title, Text } = Typography;

export function EmailQueue() {
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [verifyingQueue, setVerifyingQueue] = useState(false);

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

  const handleRemoveJob = async (jobId) => {
    try {
      await QueueAPI.removeFromQueue(jobId, 'Removed from queue by user');
      message.success('Job removed from queue');
      fetchQueue();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to remove job');
    }
  };

  const handleVerifyQueue = async () => {
    try {
      setVerifyingQueue(true);
      const res = await QueueAPI.verifyQueue();
      if (res.removedCount > 0) {
        notification.warning({
          message: 'Invalid Emails Purged from Queue',
          description: `Checked ${res.totalChecked} queued email(s). Automatically removed ${res.removedCount} invalid domain(s) (e.g. DNS SERVFAIL or missing MX) so they will not be sent.`,
          duration: 6,
        });
      } else {
        message.success(`Verified ${res.totalChecked} queued email(s) — all have active MX mail servers!`);
      }
      fetchQueue();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to verify queue');
    } finally {
      setVerifyingQueue(false);
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
      if (res.bouncedCount > 0) {
        notification.info({
          message: 'Retry Completed with DNS Filter',
          description: `Requeued ${res.modifiedCount} valid job(s). Permanently marked ${res.bouncedCount} dead domains as BOUNCED.`,
        });
      } else {
        message.success(`Requeued ${res.modifiedCount} failed job(s)`);
      }
      fetchQueue();
    } catch (err) {
      message.error('Failed to retry all jobs');
    }
  };

  const handleDismissFailed = async (jobId) => {
    try {
      await QueueAPI.dismissFailed(jobId);
      message.info('Failed job dismissed');
      fetchQueue();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to dismiss job');
    }
  };

  const handleDismissAllFailed = async () => {
    try {
      const res = await QueueAPI.dismissAllFailed();
      message.info(`Dismissed ${res.dismissedCount} failed jobs`);
      fetchQueue();
    } catch (err) {
      message.error('Failed to dismiss all failed jobs');
    }
  };

  const isRunning = queueData?.state === 'RUNNING';
  const isPaused = queueData?.state === 'PAUSED';
  const sentToday = queueData?.sentToday || 0;
  const dailyLimit = queueData?.dailyLimit || 20;
  const progressPercent = Math.min(100, Math.round((sentToday / dailyLimit) * 100));

  const isDnsOrPermanentFailure = (err = '') => {
    const s = (err || '').toLowerCase();
    return (
      s.includes('dns error') ||
      s.includes('servfail') ||
      s.includes('nxdomain') ||
      s.includes('no mx') ||
      s.includes('user does not exist') ||
      s.includes('address not found') ||
      s.includes('550 5.1.1')
    );
  };

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
    {
      title: 'Action',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Popconfirm
          title="Remove from queue?"
          description={`Remove application for ${record.company} from the dispatch queue?`}
          onConfirm={() => handleRemoveJob(record._id)}
          okText="Remove"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
        >
          <Button size="small" danger icon={<DeleteOutlined />}>
            Remove
          </Button>
        </Popconfirm>
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
      render: (err) => {
        const isDns = isDnsOrPermanentFailure(err);
        return (
          <Space direction="vertical" size={2}>
            <Text orientation="horizontal" type="danger" style={{ fontSize: 13 }}>
              {err || 'Delivery failed'}
            </Text>
            {isDns && <Tag color="error">Invalid Domain / DNS Error</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 180,
      render: (_, record) => {
        const cannotRetry = isDnsOrPermanentFailure(record.lastError);
        return (
          <Space orientation="horizontal" size="small">
            <Tooltip
              title={
                cannotRetry
                  ? 'Cannot retry: recipient domain has no valid MX records or address does not exist'
                  : 'Retry delivery'
              }
            >
              <Button
                size="small"
                type="primary"
                icon={<RedoOutlined />}
                disabled={cannotRetry}
                onClick={() => handleRetryJob(record._id)}
              >
                Retry
              </Button>
            </Tooltip>
            <Button
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleDismissFailed(record._id)}
            >
              Dismiss
            </Button>
          </Space>
        );
      },
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

          <Button
            icon={<SafetyCertificateOutlined />}
            onClick={handleVerifyQueue}
            loading={verifyingQueue}
            style={{ borderColor: '#52c41a', color: '#389e0d' }}
          >
            Verify DNS & Purge Invalid
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

      <Alert
        type="info"
        showIcon
        icon={<SafetyCertificateOutlined style={{ color: '#52c41a' }} />}
        message="Active DNS MX Pre-Check & Protection"
        description="All recipient domains are verified before sending. Addresses with broken or failing DNS (such as SERVFAIL, NXDOMAIN, or missing MX mail servers) are automatically blocked and purged from the queue to protect your sender reputation and prevent Gmail 48-hour retry loops."
        style={{ marginBottom: 18 }}
      />

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
                  Retry Valid Failed ({queueData.failedJobs.length})
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
                    <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <Button icon={<RedoOutlined />} onClick={handleRetryAll}>
                        Retry Valid Failed
                      </Button>
                      <Button danger icon={<ClearOutlined />} onClick={handleDismissAllFailed}>
                        Dismiss All Failed
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
