import React from 'react';
import {
  Modal,
  Descriptions,
  Tag,
  Button,
  Space,
  Alert,
  Typography,
  Divider,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  EyeOutlined,
  SendOutlined,
  LinkOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { Paragraph, Text, Link } = Typography;

export function JobDetailModal({
  job,
  contact,
  visible,
  onClose,
  onApprove,
  onSkip,
  onEdit,
  onPreviewEmail,
  onSendTest,
}) {
  if (!job) return null;

  const isApproved = job.status === 'APPROVED';
  const isSkipped = job.status === 'SKIPPED';
  const isSent = job.status === 'SENT';

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      width={760}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>{job.role}</span>
          <Text type="secondary" style={{ fontSize: 14 }}>
            at {job.company}
          </Text>
          <Tag
            color={
              job.status === 'SENT'
                ? 'green'
                : job.status === 'APPROVED'
                ? 'blue'
                : job.status === 'QUEUED'
                ? 'cyan'
                : job.status === 'FAILED'
                ? 'red'
                : job.status === 'SKIPPED'
                ? 'default'
                : 'orange'
            }
          >
            {job.status}
          </Tag>
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button icon={<EyeOutlined />} onClick={() => onPreviewEmail(job)}>
              Preview Email
            </Button>
            <Button icon={<SendOutlined />} onClick={() => onSendTest(job)}>
              Send Test Email
            </Button>
          </Space>

          <Space>
            <Button icon={<EditOutlined />} onClick={() => onEdit(job)}>
              Edit
            </Button>

            {!isSkipped && !isSent && (
              <Button danger icon={<CloseOutlined />} onClick={() => onSkip(job._id)}>
                Skip
              </Button>
            )}

            {!isApproved && !isSent && (
              <Button type="primary" icon={<CheckOutlined />} onClick={() => onApprove(job._id)}>
                Approve
              </Button>
            )}

            <Button onClick={onClose}>Close</Button>
          </Space>
        </div>
      }
    >
      {job.isDuplicate && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="Possible Duplicate Warning"
          description={job.duplicateReason || 'This HR email or job listing already exists in database.'}
          style={{ marginBottom: 16 }}
        />
      )}

      {job.contactVerification?.reason && (
        <Alert
          type={job.contactVerification.status === 'verified' ? 'success' : 'warning'}
          showIcon
          message={`Contact Verification: ${job.contactVerification.status || 'needs_manual_verification'}`}
          description={job.contactVerification.reason}
          style={{ marginBottom: 16 }}
        />
      )}

      {contact && contact.totalEmailsSent > 0 && (
        <Alert
          type="info"
          showIcon
          icon={<CheckCircleOutlined />}
          message="Contact History"
          description={`You have previously sent ${contact.totalEmailsSent} email(s) to this contact. Last sent on: ${
            contact.lastContactedAt ? new Date(contact.lastContactedAt).toLocaleDateString() : 'N/A'
          }`}
          style={{ marginBottom: 16 }}
        />
      )}

      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="Company" span={1}>
          <strong>{job.company}</strong>
        </Descriptions.Item>
        <Descriptions.Item label="Role" span={1}>
          {job.role}
        </Descriptions.Item>

        <Descriptions.Item label="HR Recruiter" span={1}>
          {job.hrName ? job.hrName : <Text type="secondary">Not specified (Hiring Team)</Text>}
        </Descriptions.Item>
        <Descriptions.Item label="HR Email" span={1}>
          <Link href={`mailto:${job.hrEmail}`}>{job.hrEmail}</Link>
        </Descriptions.Item>

        <Descriptions.Item label="Location" span={1}>
          {job.location || <Text type="secondary">Not specified</Text>}
        </Descriptions.Item>
        <Descriptions.Item label="Work Mode" span={1}>
          <Tag color={job.remote ? 'purple' : 'default'}>
            {job.remote ? 'Remote' : 'On-Site / Hybrid'}
          </Tag>
        </Descriptions.Item>

        <Descriptions.Item label="Source" span={1}>
          <Tag>{job.source || 'AI Agent'}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Job Posting URL" span={1}>
          {job.jobUrl ? (
            <Link href={job.jobUrl} target="_blank" rel="noreferrer">
              <LinkOutlined /> Open Link
            </Link>
          ) : (
            <Text type="secondary">None</Text>
          )}
        </Descriptions.Item>

        <Descriptions.Item label="Imported Date" span={2}>
          {new Date(job.importedAt).toLocaleString()} ({job.originalFilename || 'Manual'})
        </Descriptions.Item>

        {job.requirements && job.requirements.length > 0 && (
          <Descriptions.Item label="Requirements" span={2}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {job.requirements.map((req, idx) => (
                <Tag color="blue" key={idx}>
                  {req}
                </Tag>
              ))}
            </div>
          </Descriptions.Item>
        )}
      </Descriptions>

      {job.description && (
        <div style={{ marginTop: 16 }}>
          <Text strong>Job Description:</Text>
          <Paragraph
            style={{
              marginTop: 6,
              background: '#f8fafc',
              padding: 12,
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              maxHeight: 180,
              overflowY: 'auto',
            }}
          >
            {job.description}
          </Paragraph>
        </div>
      )}

      {job.notes && (
        <div style={{ marginTop: 12 }}>
          <Text strong>AI Agent Notes:</Text>
          <Paragraph
            style={{
              marginTop: 6,
              background: '#fef3c7',
              padding: 10,
              borderRadius: 6,
              border: '1px solid #fde68a',
            }}
          >
            {job.notes}
          </Paragraph>
        </div>
      )}

      {job.email?.subject && (
        <div style={{ marginTop: 16 }}>
          <Text strong style={{ color: '#1890ff' }}>
            AI-Generated Email Application:
          </Text>
          <div
            style={{
              marginTop: 6,
              background: '#f0f9ff',
              padding: 12,
              borderRadius: 6,
              border: '1px solid #bae6fd',
            }}
          >
            <div style={{ marginBottom: 6 }}>
              <Text strong style={{ fontSize: 13 }}>
                Subject: {job.email.subject}
              </Text>
            </div>
            <Paragraph
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                fontSize: 13,
                maxHeight: 180,
                overflowY: 'auto',
                color: '#334155',
              }}
            >
              {job.email.body}
            </Paragraph>
          </div>
        </div>
      )}

      {job.lastError && (
        <div style={{ marginTop: 12 }}>
          <Alert
            type="error"
            message="Last Delivery Error"
            description={job.lastError}
            showIcon
          />
        </div>
      )}
    </Modal>
  );
}

export default JobDetailModal;
