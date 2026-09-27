import React, { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Typography,
  Select,
  Input,
  Space,
  Button,
  Modal,
  Descriptions,
  Divider,
  Card,
  message,
} from 'antd';
import {
  SearchOutlined,
  EyeOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import { EmailsAPI } from '../services/api';

const { Title, Text, Paragraph } = Typography;
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


export function SentHistory() {
  const [emails, setEmails] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Selected email for modal
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const data = await EmailsAPI.getEmails({
        page,
        limit: pageSize,
        status: status !== 'ALL' ? status : undefined,
        search: search.trim() || undefined,
      });
      setEmails(data.emails || []);
      setTotal(data.total || 0);
    } catch (err) {
      message.error('Failed to load email history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [page, pageSize, status]);

  const handleSearch = () => {
    setPage(1);
    fetchEmails();
  };

  const openDetail = (record) => {
    setSelectedEmail(record);
    setDetailVisible(true);
  };

  const columns = [
    {
      title: 'Date & Time',
      dataIndex: 'sentAt',
      key: 'sentAt',
      render: (date, r) => (
        <span>
          {date ? new Date(date).toLocaleString() : new Date(r.queuedAt).toLocaleString()}
        </span>
      ),
    },
    {
      title: 'Company',
      key: 'company',
      render: (_, r) => {
        const comp = r.jobId?.company || 'Direct Outreach';
        const initials = getCompanyInitials(comp);
        const bgGradient = getAvatarGradient(comp);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="company-avatar" style={{ background: bgGradient, width: 32, height: 32, fontSize: 12 }}>
              {initials}
            </div>
            <strong style={{ color: '#0f172a' }}>{comp}</strong>
          </div>
        );
      },
    },
    {
      title: 'Role',
      key: 'role',
      render: (_, r) => <span>{r.jobId?.role || '—'}</span>,
    },
    {
      title: 'Recipient HR',
      key: 'recipient',
      render: (_, r) => (
        <div>
          <div>{r.contactId?.name || r.jobId?.hrName || 'Hiring Team'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.recipient}
          </Text>
        </div>
      ),
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
      render: (subj) => <span style={{ fontWeight: 500 }}>{subj}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        if (record.isDryRun && status === 'SENT') {
          return <Tag color="orange">DRY RUN (SENT)</Tag>;
        }
        const color =
          status === 'SENT'
            ? 'green'
            : status === 'BOUNCED'
            ? 'red'
            : status === 'FAILED'
            ? 'red'
            : status === 'SENDING'
            ? 'processing'
            : 'default';
        return <Tag color={color}>{status === 'BOUNCED' ? '⛔ BOUNCED' : status}</Tag>;
      },
    },
    {
      title: 'Message ID',
      dataIndex: 'messageId',
      key: 'messageId',
      ellipsis: true,
      render: (msgId) => (
        <Text copyable={msgId ? { text: msgId } : false} type="secondary" style={{ fontSize: 12 }}>
          {msgId ? (msgId.length > 20 ? `${msgId.slice(0, 18)}...` : msgId) : '—'}
        </Text>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="crm-header-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="crm-title">Sent Application History</h1>
              <span
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#15803d',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {total} Dispatched
              </span>
            </div>
            <p className="crm-subtitle">
              Live audit ledger of sent, dry-run, and failed applications with RFC Message-IDs and delivery timestamps.
            </p>
          </div>

          <Space wrap size={10}>
            <Button icon={<ReloadOutlined />} onClick={fetchEmails} style={{ fontWeight: 600 }}>
              Refresh
            </Button>
          </Space>
        </div>
      </div>

      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search Recipient Email, Subject, Message ID..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 340 }}
            allowClear
          />
          <Button type="primary" onClick={handleSearch}>
            Search
          </Button>

          <Select
            value={status}
            onChange={(val) => {
              setStatus(val);
              setPage(1);
            }}
            style={{ width: 160 }}
          >
            <Option value="ALL">All Statuses</Option>
            <Option value="SENT">Sent</Option>
            <Option value="BOUNCED">⛔ Bounced</Option>
            <Option value="FAILED">Failed</Option>
            <Option value="QUEUED">Queued</Option>
            <Option value="SKIPPED">Skipped</Option>
          </Select>
        </div>
      </Card>

      <Table
        dataSource={emails}
        columns={columns}
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

      {/* Email Detail View Modal */}
      <Modal
        open={detailVisible}
        title="Email Delivery Log"
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setDetailVisible(false)}>
            Close
          </Button>,
        ]}
        width={720}
      >
        {selectedEmail && (
          <div>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="To (Recipient)" span={1}>
                <strong>{selectedEmail.recipient}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Status" span={1}>
                <Tag color={selectedEmail.status === 'SENT' ? 'green' : 'red'}>
                  {selectedEmail.status}
                </Tag>
                {selectedEmail.isDryRun && <Tag color="orange">DRY RUN</Tag>}
              </Descriptions.Item>

              <Descriptions.Item label="Company" span={1}>
                {selectedEmail.jobId?.company || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Role" span={1}>
                {selectedEmail.jobId?.role || 'N/A'}
              </Descriptions.Item>

              <Descriptions.Item label="Sent At" span={1}>
                {selectedEmail.sentAt ? new Date(selectedEmail.sentAt).toLocaleString() : 'Not sent'}
              </Descriptions.Item>
              <Descriptions.Item label="Message ID" span={1}>
                <Text copyable style={{ fontSize: 12 }}>
                  {selectedEmail.messageId || 'None'}
                </Text>
              </Descriptions.Item>

              <Descriptions.Item label="Attachment" span={2}>
                <Tag icon={<FilePdfOutlined />} color="blue">
                  {selectedEmail.attachmentName || 'resume.pdf'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            {selectedEmail.error && (
              <div style={{ marginTop: 14 }}>
                <Text type="danger" strong>
                  Delivery Failure Reason:
                </Text>
                <div
                  style={{
                    background: '#fef2f2',
                    color: '#991b1b',
                    padding: 10,
                    borderRadius: 6,
                    marginTop: 4,
                  }}
                >
                  {selectedEmail.error}
                </div>
              </div>
            )}

            <Divider style={{ margin: '16px 0' }} />

            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                Subject: {selectedEmail.subject}
              </Text>
              <div
                className="email-preview-box"
                dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default SentHistory;
