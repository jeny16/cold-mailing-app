import React, { useState, useEffect } from 'react';
import {
  Modal,
  DatePicker,
  Input,
  Button,
  message,
  Space,
  Typography,
  Select,
  Divider,
  Tag,
  Alert,
  Tooltip,
} from 'antd';
import {
  BellOutlined,
  CalendarOutlined,
  SendOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { JobsAPI } from '../services/api';

const { TextArea } = Input;
const { Text } = Typography;
const { Option } = Select;

export function FollowUpModal({ visible, job, onClose, onSuccess }) {
  const [followUpDate, setFollowUpDate] = useState(dayjs().add(3, 'day'));
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('FOLLOW_UP_1_DUE');
  const [loading, setLoading] = useState(false);
  const [sendingFollowUp, setSendingFollowUp] = useState(false);

  useEffect(() => {
    if (job) {
      if (job.tracking?.nextFollowUpAt) {
        setFollowUpDate(dayjs(job.tracking.nextFollowUpAt));
      } else {
        setFollowUpDate(dayjs().add(3, 'day'));
      }
      setNotes(job.tracking?.notes || '');
      setStatus(job.status?.startsWith('FOLLOW_UP') ? job.status : 'FOLLOW_UP_1_DUE');
    }
  }, [job]);

  if (!job) return null;

  const hrName = (job.contact?.hrName || job.hrName || '').trim() || 'Hiring Team';
  const role = job.role || 'Developer';
  const company = job.company || 'Company';

  const defaultFollowUpText = `Hi ${hrName},\n\nI wanted to follow up on my application for the ${role} position that I shared recently. I remain interested in the opportunity and would be happy to provide any additional information required.\n\nPlease let me know if there is any update regarding the application.\n\nBest regards,\nJeny Pansuriya`;

  const isSuppressed = ['NO_REQUIREMENT', 'NO_FOLLOW_UP', 'REJECTED', 'CLOSED', 'BOUNCED'].includes(status);

  const handleSave = async () => {
    try {
      setLoading(true);
      await JobsAPI.scheduleFollowUp(job._id, {
        nextFollowUpAt: isSuppressed ? null : followUpDate ? followUpDate.toISOString() : null,
        notes: notes.trim(),
        status,
      });
      message.success(isSuppressed ? `Status updated to ${status} (follow-ups suppressed)` : 'Follow-up scheduled in CRM!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      message.error('Failed to schedule follow-up');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkNoRequirement = async () => {
    try {
      setLoading(true);
      await JobsAPI.markNoRequirement(job._id, 'HR replied: No opening / No requirement');
      message.success(`Marked "${job.company}" as NO_REQUIREMENT. Follow-ups permanently stopped.`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleSendFollowUpEmail = async () => {
    try {
      setSendingFollowUp(true);
      const res = await JobsAPI.sendFollowUp(job._id, {
        body: defaultFollowUpText,
      });
      message.success(res.message || 'Follow-up email dispatched!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to send follow-up email');
    } finally {
      setSendingFollowUp(false);
    }
  };

  const handleCopyFollowUpText = () => {
    navigator.clipboard.writeText(defaultFollowUpText);
    message.success('Follow-up text copied to clipboard!');
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: isSuppressed ? '#ff4d4f' : '#fa8c16',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            {isSuppressed ? <StopOutlined /> : <BellOutlined />}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              {isSuppressed ? 'Follow-up Suppressed' : 'Follow-up Scheduler & Outreach'}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {job.company} — {job.role} ({job.hrEmail || 'No email'})
            </Text>
          </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Close
        </Button>,
        <Button
          key="no_req"
          danger
          icon={<StopOutlined />}
          loading={loading}
          onClick={handleMarkNoRequirement}
        >
          No Requirement / Stop
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<CalendarOutlined />}
          loading={loading}
          onClick={handleSave}
          style={{ backgroundColor: '#fa8c16', borderColor: '#fa8c16', fontWeight: 600 }}
        >
          Save Schedule
        </Button>,
      ]}
      width={560}
      centered
    >
      <div style={{ padding: '8px 0' }}>
        {/* Preset Quick Date Buttons */}
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Quick Cadence Presets
          </Text>
          <Space orientation="horizontal" wrap>
            <Button
              size="small"
              onClick={() => {
                setFollowUpDate(dayjs().add(3, 'day'));
                setStatus('FOLLOW_UP_1_DUE');
              }}
            >
              +3 Days (Follow-up 1 Due)
            </Button>
            <Button
              size="small"
              onClick={() => {
                setFollowUpDate(dayjs().add(6, 'day'));
                setStatus('FOLLOW_UP_2_DUE');
              }}
            >
              +6 Days (Follow-up 2 Due)
            </Button>
            <Button
              size="small"
              danger
              onClick={() => {
                setStatus('NO_REQUIREMENT');
                setFollowUpDate(null);
              }}
            >
              No Opening (Suppress)
            </Button>
          </Space>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>
            Follow-up Due Date
          </Text>
          <DatePicker
            value={followUpDate}
            onChange={(date) => setFollowUpDate(date)}
            format="DD MMM YYYY, dddd"
            allowClear={true}
            disabled={isSuppressed}
            style={{ width: '100%', height: 40 }}
            placeholder={isSuppressed ? 'Follow-up disabled for this status' : 'Select follow-up date'}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>
            Outreach & CRM Status
          </Text>
          <Select value={status} onChange={setStatus} style={{ width: '100%', height: 40 }}>
            <Option value="FOLLOW_UP_1_DUE">🔴 FOLLOW_UP_1_DUE (First Follow-up Due)</Option>
            <Option value="FOLLOW_UP_1_SENT">📨 FOLLOW_UP_1_SENT (First Follow-up Sent)</Option>
            <Option value="FOLLOW_UP_2_DUE">🟠 FOLLOW_UP_2_DUE (Second Follow-up Due)</Option>
            <Option value="FOLLOW_UP_2_SENT">📤 FOLLOW_UP_2_SENT (Second Follow-up Sent)</Option>
            <Option value="NO_REQUIREMENT">⛔ NO_REQUIREMENT (HR: No Opening / Stop)</Option>
            <Option value="REPLIED">💬 REPLIED (HR Replied)</Option>
            <Option value="INTERVIEW">🎯 INTERVIEW (Discussion Scheduled)</Option>
            <Option value="REJECTED">❌ REJECTED</Option>
            <Option value="NO_RESPONSE">⏳ NO_RESPONSE (Closed after 2 follow-ups)</Option>
            <Option value="CLOSED">🔒 CLOSED</Option>
          </Select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>
            Follow-up Notes
          </Text>
          <TextArea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Sent application via email. Follow up on active React opening."
          />
        </div>

        <Divider style={{ margin: '14px 0' }} />

        {/* Standardized Follow-up Message Preview & Instant Send */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>Standard Follow-up Message</Text>
            <Space>
              <Button size="small" icon={<CopyOutlined />} onClick={handleCopyFollowUpText}>
                Copy
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<SendOutlined />}
                loading={sendingFollowUp}
                disabled={isSuppressed}
                onClick={handleSendFollowUpEmail}
              >
                Send Follow-up Email
              </Button>
            </Space>
          </div>
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: 'pre-line',
              color: '#334155',
            }}
          >
            {defaultFollowUpText}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default FollowUpModal;

