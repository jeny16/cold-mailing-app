import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Modal,
  message,
  Typography,
  Tooltip,
  Card,
  Popconfirm,
} from 'antd';
import {
  SearchOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  EyeOutlined,
  DeleteOutlined,
  WarningOutlined,
  LinkOutlined,
  SendOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { JobsAPI } from '../services/api';
import { JobDetailModal } from '../components/JobDetailModal';
import { EmailPreviewModal } from '../components/EmailPreviewModal';
import { EditJobModal } from '../components/EditJobModal';

const { Title, Text } = Typography;
const { Option } = Select;

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


export function JobReview({ onSendTestTrigger }) {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // Modals state
  const [detailJob, setDetailJob] = useState(null);
  const [detailContact, setDetailContact] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const [previewData, setPreviewData] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const [editingJob, setEditingJob] = useState(null);
  const [editVisible, setEditVisible] = useState(false);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      };
      const data = await JobsAPI.getJobs(params);
      setJobs(data.jobs || []);
      setTotal(data.total || 0);
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [page, pageSize, statusFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchJobs();
  };

  // Actions
  const handleApprove = async (id) => {
    try {
      await JobsAPI.approveJob(id);
      message.success('Job approved! Ready for sending queue.');
      fetchJobs();
      if (detailVisible && detailJob?._id === id) {
        setDetailJob((prev) => ({ ...prev, status: 'APPROVED' }));
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to approve');
    }
  };

  const handleSkip = async (id) => {
    try {
      await JobsAPI.skipJob(id);
      message.info('Job marked as skipped');
      fetchJobs();
      if (detailVisible && detailJob?._id === id) {
        setDetailJob((prev) => ({ ...prev, status: 'SKIPPED' }));
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to skip');
    }
  };

  const handleDelete = async (id) => {
    try {
      await JobsAPI.deleteJob(id);
      message.success('Job listing removed');
      fetchJobs();
      if (detailVisible) setDetailVisible(false);
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  // Batch actions
  const handleBatchApprove = async () => {
    if (selectedRowKeys.length === 0) return;
    try {
      const res = await JobsAPI.batchApprove(selectedRowKeys);
      message.success(`Approved ${res.modifiedCount} job(s)!`);
      setSelectedRowKeys([]);
      fetchJobs();
    } catch (err) {
      message.error('Failed batch approval');
    }
  };

  const handleBatchSkip = async () => {
    if (selectedRowKeys.length === 0) return;
    try {
      const res = await JobsAPI.batchSkip(selectedRowKeys);
      message.info(`Skipped ${res.modifiedCount} job(s)`);
      setSelectedRowKeys([]);
      fetchJobs();
    } catch (err) {
      message.error('Failed batch skip');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    try {
      const res = await JobsAPI.batchDelete(selectedRowKeys);
      message.success(`Deleted ${res.deletedCount} job(s)`);
      setSelectedRowKeys([]);
      fetchJobs();
    } catch (err) {
      message.error('Failed batch deletion');
    }
  };

  const openDetail = async (record) => {
    try {
      const full = await JobsAPI.getJobById(record._id);
      setDetailJob(full.job);
      setDetailContact(full.contact);
      setDetailVisible(true);
    } catch (err) {
      setDetailJob(record);
      setDetailVisible(true);
    }
  };

  const openPreview = async (record) => {
    try {
      const preview = await JobsAPI.previewEmail(record._id);
      setPreviewData(preview);
      setPreviewVisible(true);
    } catch (err) {
      message.error('Could not preview email');
    }
  };

  const openEdit = (record) => {
    setEditingJob(record);
    setEditVisible(true);
  };

  const columns = [
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
      sorter: (a, b) => a.company.localeCompare(b.company),
      render: (text, record) => {
        const initials = getCompanyInitials(text);
        const bgGradient = getAvatarGradient(text);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="company-avatar" style={{ background: bgGradient, width: 32, height: 32, fontSize: 12 }}>
              {initials}
            </div>
            <div>
              <a onClick={() => openDetail(record)} style={{ fontWeight: 700, color: '#0f172a' }}>
                {text}
              </a>
              {record.isDuplicate && (
                <div style={{ marginTop: 2 }}>
                  <Tooltip title={record.duplicateReason || 'Potential duplicate contact/listing'}>
                    <Tag color="warning" icon={<WarningOutlined />} style={{ fontSize: 11, padding: '0 5px' }}>
                      Duplicate
                    </Tag>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (text) => <span>{text}</span>,
    },
    {
      title: 'HR Contact',
      key: 'hr',
      render: (_, record) => (
        <div>
          <div>{record.hrName ? record.hrName : <Text type="secondary">Hiring Team</Text>}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.hrEmail}
          </Text>
        </div>
      ),
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      render: (loc, record) => (
        <Space size={4}>
          <span>{loc || '—'}</span>
          {record.remote && <Tag color="purple">Remote</Tag>}
        </Space>
      ),
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      render: (source) => <Tag>{source || 'AI'}</Tag>,
    },
    {
      title: 'Job Link',
      dataIndex: 'jobUrl',
      key: 'jobUrl',
      render: (url) =>
        url ? (
          <a href={url} target="_blank" rel="noreferrer">
            <LinkOutlined /> View
          </a>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const color =
          status === 'SENT' || status === 'EMAIL_SENT'
            ? 'green'
            : status === 'APPROVED'
            ? 'blue'
            : status === 'QUEUED'
            ? 'cyan'
            : status === 'FAILED' || status === 'BOUNCED'
            ? 'red'
            : status === 'SKIPPED'
            ? 'default'
            : 'orange';
        return <Tag color={color}>{status === 'BOUNCED' ? '⛔ BOUNCED' : status}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        const isApproved = record.status === 'APPROVED';
        const isSent = record.status === 'SENT';
        const isSkipped = record.status === 'SKIPPED';

        return (
          <Space size="small">
            <Tooltip title="Preview Personalized Email">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => openPreview(record)}
              />
            </Tooltip>

            {!isApproved && !isSent && (
              <Tooltip title="Approve for Queue">
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={() => handleApprove(record._id)}
                />
              </Tooltip>
            )}

            {!isSkipped && !isSent && (
              <Tooltip title="Skip Job">
                <Button
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => handleSkip(record._id)}
                />
              </Tooltip>
            )}

            <Tooltip title="Edit Job">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              />
            </Tooltip>

            <Popconfirm
              title="Delete Job"
              description="Are you sure you want to delete this listing?"
              onConfirm={() => handleDelete(record._id)}
              okText="Yes"
              cancelText="No"
            >
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div className="crm-header-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="crm-title">Job Review & Batch Approval</h1>
              <span
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#2563eb',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {total} Records
              </span>
            </div>
            <p className="crm-subtitle">
              Inspect scraped prospects, verify HR contacts, customize personalized drafts, and approve for outbound queue.
            </p>
          </div>

          <Space wrap size={10}>
            <Button icon={<ReloadOutlined />} onClick={fetchJobs} style={{ fontWeight: 600 }}>
              Refresh
            </Button>
          </Space>
        </div>
      </div>

      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <Space wrap size="middle">
            <Input
              placeholder="Search Company, Role, HR Email, Name..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 320 }}
              allowClear
            />
            <Button type="primary" onClick={handleSearch}>
              Search
            </Button>

            <Select
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
              style={{ width: 160 }}
            >
              <Option value="ALL">All Statuses</Option>
              <Option value="REVIEW">Review / New</Option>
              <Option value="APPROVED">Approved</Option>
              <Option value="QUEUED">Queued</Option>
              <Option value="SENT">Sent</Option>
              <Option value="BOUNCED">⛔ Bounced</Option>
              <Option value="FAILED">Failed</Option>
              <Option value="SKIPPED">Skipped</Option>
            </Select>
          </Space>

          {selectedRowKeys.length > 0 && (
            <Space wrap>
              <Text strong>{selectedRowKeys.length} selected:</Text>
              <Button type="primary" icon={<CheckOutlined />} onClick={handleBatchApprove}>
                Approve Selected
              </Button>
              <Button icon={<CloseOutlined />} onClick={handleBatchSkip}>
                Skip Selected
              </Button>
              <Popconfirm
                title="Delete Selected"
                description={`Delete ${selectedRowKeys.length} job(s)?`}
                onConfirm={handleBatchDelete}
              >
                <Button danger icon={<DeleteOutlined />}>
                  Delete Selected
                </Button>
              </Popconfirm>
            </Space>
          )}
        </div>
      </Card>

      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        columns={columns}
        dataSource={jobs}
        rowKey="_id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      {/* Modals */}
      <JobDetailModal
        job={detailJob}
        contact={detailContact}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onApprove={handleApprove}
        onSkip={handleSkip}
        onEdit={(job) => {
          setDetailVisible(false);
          openEdit(job);
        }}
        onPreviewEmail={(job) => {
          setDetailVisible(false);
          openPreview(job);
        }}
        onSendTest={(job) => {
          setDetailVisible(false);
          if (onSendTestTrigger) onSendTestTrigger(job);
        }}
      />

      <EmailPreviewModal
        visible={previewVisible}
        previewData={previewData}
        onClose={() => setPreviewVisible(false)}
        onSendTest={(preview) => {
          if (onSendTestTrigger) onSendTestTrigger(preview);
        }}
      />

      <EditJobModal
        visible={editVisible}
        job={editingJob}
        onClose={() => setEditVisible(false)}
        onUpdated={() => fetchJobs()}
      />
    </div>
  );
}

export default JobReview;
