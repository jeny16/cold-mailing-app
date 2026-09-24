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

export function JobReview({ onSendTestTrigger }) {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
      render: (text, record) => (
        <Space orientation="vertical" size={2}>
          <a onClick={() => openDetail(record)} style={{ fontWeight: 600 }}>
            {text}
          </a>
          {record.isDuplicate && (
            <Tooltip title={record.duplicateReason || 'Potential duplicate contact/listing'}>
              <Tag color="warning" icon={<WarningOutlined />}>
                Duplicate
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
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
      <div className="page-header">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Job Review & Approval
          </Title>
          <Text type="secondary">
            Inspect imported jobs, review AI details, make corrections, and approve listings for the sending queue.
          </Text>
        </div>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchJobs}>
            Refresh
          </Button>
        </Space>
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
