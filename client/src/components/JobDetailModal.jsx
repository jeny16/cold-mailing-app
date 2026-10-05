import React, { useState } from 'react';
import {
  Modal,
  Descriptions,
  Tag,
  Button,
  Space,
  Typography,
  Divider,
  Timeline,
  Select,
  Input,
  Row,
  Col,
  Card,
  Tooltip,
  message,
  Alert,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  EyeOutlined,
  SendOutlined,
  LinkOutlined,
  WarningOutlined,
  MailOutlined,
  WhatsAppOutlined,
  LinkedinOutlined,
  PhoneOutlined,
  BellOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  CommentOutlined,
  CheckCircleOutlined,
  ScheduleOutlined,
  CloseCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { JobsAPI } from '../services/api';

const { Paragraph, Text, Link } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export const STATUS_COLORS = {
  NEW: 'default',
  RESEARCHED: 'cyan',
  READY_TO_CONTACT: 'blue',
  EMAIL_SENT: 'green',
  WHATSAPP_PENDING: 'orange',
  WHATSAPP_SENT: 'geekblue',
  LINKEDIN_CONTACTED: 'purple',
  REPLIED: 'gold',
  INTERVIEW: 'magenta',
  REJECTED: 'red',
  NO_RESPONSE: 'volcano',
  FOLLOW_UP: 'warning',
  FOLLOW_UP_1_DUE: 'orange',
  FOLLOW_UP_1_SENT: 'processing',
  FOLLOW_UP_2_DUE: 'volcano',
  FOLLOW_UP_2_SENT: 'purple',
  NO_REQUIREMENT: 'default',
  NO_FOLLOW_UP: 'default',
  CLOSED: 'default',
  // Legacy
  REVIEW: 'orange',
  APPROVED: 'blue',
  QUEUED: 'cyan',
  SENDING: 'processing',
  SENT: 'green',
  FAILED: 'red',
  SKIPPED: 'default',
  BOUNCED: 'red',
  INVALID_EMAIL: 'red',
};

export function JobDetailModal({
  job,
  contact,
  visible,
  onClose,
  onEdit,
  onPreviewEmail,
  onTriggerSendEmail,
  onTriggerWhatsApp,
  onTriggerFollowUp,
  onRefresh,
}) {
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  if (!job) return null;

  const handleStatusChange = async (newStatus) => {
    try {
      setChangingStatus(true);
      await JobsAPI.updateStatus(job._id, newStatus, `Manual status change to ${newStatus}`);
      message.success(`Status updated to ${newStatus}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      message.error('Failed to change status');
    } finally {
      setChangingStatus(false);
    }
  };

  const handleMarkBounced = () => {
    Modal.confirm({
      title: 'Mark Email as Bounced / Invalid?',
      icon: <CloseCircleOutlined style={{ color: '#ef4444' }} />,
      content: (
        <div>
          <p>
            This will mark <strong>{hrEmail || job.company}</strong> as an invalid or non-existent email address (e.g. <code>550 5.1.1 User does not exist</code>).
          </p>
          <p style={{ color: '#64748b', fontSize: 13 }}>
            Future automated queue dispatches to this address will be automatically blocked to protect your sender score.
          </p>
        </div>
      ),
      okText: 'Mark as Bounced',
      okType: 'danger',
      onOk: async () => {
        try {
          await JobsAPI.markBounced(job._id, {
            reason: '550 5.1.1 User does not exist - Address not found',
          });
          message.success(`Marked ${job.company} as BOUNCED`);
          if (onRefresh) onRefresh();
        } catch (err) {
          message.error('Failed to mark as bounced');
        }
      },
    });
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      setAddingNote(true);
      await JobsAPI.addActivity(job._id, {
        action: 'NOTE_ADDED',
        title: 'Note Logged',
        description: newNote.trim(),
      });
      message.success('Note added to timeline!');
      setNewNote('');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      message.error('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const hrPhone = job.contact?.phone || job.whatsapp?.phone || '';
  const hrEmail = job.contact?.email || job.hrEmail || '';
  const hrLinkedin = job.contact?.linkedin || job.linkedin?.profileUrl || '';
  const cleanPhone = hrPhone.replace(/[^\d]/g, '');

  const timelineItems = (job.timeline && job.timeline.length > 0)
    ? [...job.timeline].reverse()
    : [
        {
          action: 'CREATED',
          title: 'Prospect Added',
          description: `Imported / added on ${dayjs(job.createdAt || job.importedAt).format('DD MMM YYYY')}`,
          createdAt: job.createdAt || job.importedAt,
        },
      ];

  const getTimelineIcon = (action) => {
    if (action.includes('BOUNCED')) return <CloseCircleOutlined style={{ color: '#ef4444' }} />;
    if (action.includes('EMAIL')) return <MailOutlined style={{ color: '#1890ff' }} />;
    if (action.includes('WHATSAPP')) return <WhatsAppOutlined style={{ color: '#25D366' }} />;
    if (action.includes('FOLLOWUP')) return <BellOutlined style={{ color: '#fa8c16' }} />;
    if (action.includes('LINKEDIN')) return <LinkedinOutlined style={{ color: '#0a66c2' }} />;
    if (action.includes('CALL')) return <PhoneOutlined style={{ color: '#52c41a' }} />;
    return <ClockCircleOutlined style={{ color: '#64748b' }} />;
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      width={820}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 700 }}>{job.company}</span>
              <Tag color={STATUS_COLORS[job.status] || 'default'} style={{ fontSize: 12, padding: '2px 8px' }}>
                {job.status}
              </Tag>
              {job.isDuplicate && (
                <Tooltip title={job.duplicateReason}>
                  <Tag color="warning" icon={<WarningOutlined />}>
                    Potential Duplicate
                  </Tag>
                </Tooltip>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {job.role} • {job.job?.location || job.location || 'Ahmedabad'} • {job.job?.workMode || (job.remote ? 'Remote' : 'Work From Office')}
            </Text>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Status:</Text>
            <Select
              value={job.status}
              onChange={handleStatusChange}
              loading={changingStatus}
              style={{ width: 190 }}
            >
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
              <Option value="NO_RESPONSE">NO_RESPONSE</Option>
              <Option value="BOUNCED">⛔ BOUNCED / INVALID</Option>
              <Option value="REJECTED">REJECTED</Option>
              <Option value="CLOSED">CLOSED</Option>
            </Select>
          </div>
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            {job.jobUrl && (
              <Button icon={<LinkOutlined />} href={job.jobUrl} target="_blank">
                Open Job URL
              </Button>
            )}
            <Button icon={<EyeOutlined />} onClick={() => onPreviewEmail && onPreviewEmail(job)}>
              Preview Email
            </Button>
            <Button icon={<EditOutlined />} onClick={() => onEdit && onEdit(job)}>
              Edit Info
            </Button>
          </Space>
          <Button type="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      }
      centered
    >
      <div style={{ padding: '8px 0', maxHeight: '72vh', overflowY: 'auto' }}>
        {/* Bounce Alert Banner if email delivery failed */}
        {(job.status === 'BOUNCED' || job.email?.status === 'bounced' || job.contactVerification?.status === 'invalid') && (
          <Alert
            type="error"
            showIcon
            icon={<CloseCircleOutlined style={{ fontSize: 20 }} />}
            message="Email Delivery Failed / Address Not Found"
            description={
              <div>
                <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: '#b91c1c' }}>
                  {job.contactVerification?.reason || job.lastError || '550 5.1.1 User does not exist - Address not found'}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>
                  The email address <code>{hrEmail}</code> is invalid or unable to receive mail. Queue dispatch is blocked for this contact. Check with the hiring team via WhatsApp or LinkedIn.
                </p>
              </div>
            }
            style={{ marginBottom: 16, borderRadius: 8 }}
          />
        )}

        {/* Quick Action Bar */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f7ff 100%)',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 20,
            border: '1px solid #bae7ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 600, color: '#0050b3' }}>⚡ Quick Outreach:</div>
          <Space wrap>
            <Button
              type="primary"
              icon={<MailOutlined />}
              onClick={() => onTriggerSendEmail && onTriggerSendEmail(job)}
              style={{ fontWeight: 600 }}
            >
              Send Email
            </Button>

            <Button
              icon={<WhatsAppOutlined />}
              onClick={() => onTriggerWhatsApp && onTriggerWhatsApp(job)}
              style={{
                backgroundColor: '#25D366',
                borderColor: '#25D366',
                color: 'white',
                fontWeight: 600,
              }}
            >
              WhatsApp
            </Button>

            {hrLinkedin && (
              <Button
                icon={<LinkedinOutlined />}
                href={hrLinkedin.startsWith('http') ? hrLinkedin : `https://${hrLinkedin}`}
                target="_blank"
                style={{ color: '#0a66c2', borderColor: '#0a66c2' }}
              >
                LinkedIn
              </Button>
            )}

            {hrPhone && (
              <Button icon={<PhoneOutlined />} href={`tel:${hrPhone}`}>
                Call
              </Button>
            )}

            <Button icon={<BellOutlined />} onClick={() => onTriggerFollowUp && onTriggerFollowUp(job)}>
              Follow-up
            </Button>

            {job.status !== 'BOUNCED' && (
              <Button
                danger
                icon={<StopOutlined />}
                onClick={handleMarkBounced}
                title="Mark this email as bounced / invalid"
              >
                Mark Bounced
              </Button>
            )}
          </Space>
        </div>

        {/* Contact Info and Job Details Grid */}
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={12}>
            <Card title="👤 HR & Contact Profile" size="small" style={{ borderRadius: 8, height: '100%' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="HR Name">
                  <strong>{job.contact?.hrName || job.hrName || 'Hiring Team'}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Title">
                  {job.contact?.hrJobTitle || 'HR / Recruitment Team'}
                </Descriptions.Item>
                <Descriptions.Item label="Email">
                  <a href={`mailto:${hrEmail}`}>{hrEmail || '—'}</a>
                </Descriptions.Item>
                <Descriptions.Item label="Phone">
                  {hrPhone ? <a href={`tel:${hrPhone}`}>{hrPhone}</a> : <Text type="secondary">Not provided</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="WhatsApp">
                  {hrPhone ? (
                    <Tag color="green" icon={<WhatsAppOutlined />}>
                      Verified {cleanPhone}
                    </Tag>
                  ) : (
                    <Text type="secondary">—</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="LinkedIn">
                  {hrLinkedin ? (
                    <a href={hrLinkedin.startsWith('http') ? hrLinkedin : `https://${hrLinkedin}`} target="_blank" rel="noreferrer">
                      Profile Link →
                    </a>
                  ) : (
                    '—'
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col span={12}>
            <Card title="💼 Job Requirements & Follow-up" size="small" style={{ borderRadius: 8, height: '100%' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Work Mode">
                  <Tag color="blue">{job.job?.workMode || (job.remote ? 'Remote' : 'Work From Office')}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Experience">
                  {job.job?.experienceRequired || '1-3 years'}
                </Descriptions.Item>
                <Descriptions.Item label="Follow-up Due">
                  {job.tracking?.nextFollowUpAt ? (
                    <Tag color="orange" icon={<ClockCircleOutlined />}>
                      {dayjs(job.tracking.nextFollowUpAt).format('DD MMM YYYY')}
                    </Tag>
                  ) : (
                    <Text type="secondary">No follow-up set</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Skills">
                  <Space wrap size={[0, 4]}>
                    {(job.job?.requirements || job.requirements || []).map((req, idx) => (
                      <Tag key={idx}>{req}</Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
                {job.tracking?.notes && (
                  <Descriptions.Item label="Notes">
                    <Text type="secondary">{job.tracking.notes}</Text>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* Contact History / Activity Timeline */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>📜 Contact History & Activity Timeline</span>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
                Prevents contacting the same HR repeatedly
              </Text>
            </div>
          }
          size="small"
          style={{ borderRadius: 8 }}
        >
          {/* Add custom note row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Input
              placeholder="Log interaction (e.g. 'Spoke to Anand on phone, requested my CV on WhatsApp')"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onPressEnter={handleAddNote}
            />
            <Button icon={<PlusOutlined />} onClick={handleAddNote} loading={addingNote}>
              Add Note
            </Button>
          </div>

          <Timeline mode="left" style={{ marginTop: 12 }}>
            {timelineItems.map((item, idx) => (
              <Timeline.Item
                key={idx}
                dot={getTimelineIcon(item.action || '')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong>{item.title}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(item.createdAt).format('DD MMM YYYY hh:mm A')}
                  </Text>
                </div>
                {item.description && (
                  <Paragraph style={{ margin: '4px 0 0 0', color: '#475569', fontSize: 13 }}>
                    {item.description}
                  </Paragraph>
                )}
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      </div>
    </Modal>
  );
}

export default JobDetailModal;
