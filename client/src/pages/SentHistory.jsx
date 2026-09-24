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
      render: (_, r) => <strong>{r.jobId?.company || 'Direct'}</strong>,
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
            : status === 'FAILED'
            ? 'red'
            : status === 'SENDING'
            ? 'processing'
            : 'default';
        return <Tag color={color}>{status}</Tag>;
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
      <div className="page-header">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Sent Application History
          </Title>
          <Text type="secondary">
            Full audit log of sent, dry-run, and failed application emails with delivery message IDs and timestamps.
          </Text>
        </div>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchEmails}>
            Refresh
          </Button>
        </Space>
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
