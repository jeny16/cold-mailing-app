import React, { useState, useEffect } from 'react';
import { Modal, DatePicker, Input, Button, message, Space, Typography, Select } from 'antd';
import { BellOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { JobsAPI } from '../services/api';

const { TextArea } = Input;
const { Text } = Typography;
const { Option } = Select;

export function FollowUpModal({ visible, job, onClose, onSuccess }) {
  const [followUpDate, setFollowUpDate] = useState(dayjs().add(3, 'day'));
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('FOLLOW_UP');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (job) {
      if (job.tracking?.nextFollowUpAt) {
        setFollowUpDate(dayjs(job.tracking.nextFollowUpAt));
      } else {
        setFollowUpDate(dayjs().add(3, 'day'));
      }
      setNotes(job.tracking?.notes || '');
      setStatus('FOLLOW_UP');
    }
  }, [job]);

  if (!job) return null;

  const handleSave = async () => {
    if (!followUpDate) {
      message.error('Please select a follow-up date');
      return;
    }

    try {
      setLoading(true);
      await JobsAPI.scheduleFollowUp(job._id, {
        nextFollowUpAt: followUpDate.toISOString(),
        notes: notes.trim(),
        status,
      });
      message.success('Follow-up scheduled in CRM!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      message.error('Failed to schedule follow-up');
    } finally {
      setLoading(false);
    }
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
              backgroundColor: '#fa8c16',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            <BellOutlined />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Schedule Follow-up</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {job.company} — {job.role}
            </Text>
          </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<CalendarOutlined />}
          loading={loading}
          onClick={handleSave}
          style={{ backgroundColor: '#fa8c16', borderColor: '#fa8c16', fontWeight: 600 }}
        >
          Save Reminder
        </Button>,
      ]}
      width={480}
      centered
    >
      <div style={{ padding: '8px 0' }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>
            Follow-up Due Date
          </Text>
          <DatePicker
            value={followUpDate}
            onChange={(date) => setFollowUpDate(date)}
            format="DD MMM YYYY, dddd"
            allowClear={false}
            style={{ width: '100%', height: 40 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>
            Update CRM Status To
          </Text>
          <Select value={status} onChange={setStatus} style={{ width: '100%', height: 40 }}>
            <Option value="FOLLOW_UP">🔔 FOLLOW_UP</Option>
            <Option value="WHATSAPP_PENDING">📱 WHATSAPP_PENDING</Option>
            <Option value="READY_TO_CONTACT">🔵 READY_TO_CONTACT</Option>
          </Select>
        </div>

        <div>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>
            Follow-up / Reminder Notes
          </Text>
          <TextArea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Check if HR replied to email. If no reply, send follow-up WhatsApp message."
          />
        </div>
      </div>
    </Modal>
  );
}

export default FollowUpModal;
