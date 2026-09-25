import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Space, Typography, Tag, message, Alert, Divider, DatePicker, Checkbox } from 'antd';
import {
  WhatsAppOutlined,
  CopyOutlined,
  CheckOutlined,
  SendOutlined,
  PhoneOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { JobsAPI } from '../services/api';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

export function WhatsAppModal({ visible, job, onClose, onSuccess }) {
  const [msgText, setMsgText] = useState('');
  const [phone, setPhone] = useState('');
  const [loadingCopy, setLoadingCopy] = useState(false);
  const [loadingSent, setLoadingSent] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState('not_sent');
  const [scheduleFollowUp, setScheduleFollowUp] = useState(true);
  const [followUpDate, setFollowUpDate] = useState(dayjs().add(3, 'day'));
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (job) {
      const extractedPhone = (job.contact?.phone || job.whatsapp?.phone || '').trim();
      setPhone(extractedPhone);

      const existingMsg = job.whatsapp?.message || '';
      if (existingMsg) {
        setMsgText(existingMsg);
      } else {
        const hrName = job.contact?.hrName || job.hrName || 'Hiring Team';
        const company = job.company || 'your company';
        const role = job.role || 'Full Stack Developer';
        setMsgText(
          `Hi ${hrName}, I'm Jeny Pansuriya, a Full Stack Developer (React / Node.js). I noticed the opening for ${role} at ${company} and would love to apply. Here is my portfolio: http://jenypansuriya.in. May I share my resume with you?`
        );
      }

      setWhatsappStatus(job.whatsapp?.status || 'not_sent');
      setFollowUpDate(dayjs().add(3, 'day'));
      setNotes('');
    }
  }, [job]);

  if (!job) return null;

  // Format clean international phone number
  const cleanPhone = phone.replace(/[^\d]/g, '');
  const internationalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const waUrl = internationalPhone ? `https://wa.me/${internationalPhone}?text=${encodeURIComponent(msgText)}` : '';

  const handleCopyMessage = async () => {
    try {
      setLoadingCopy(true);
      await navigator.clipboard.writeText(msgText);
      await JobsAPI.copyWhatsApp(job._id);
      setWhatsappStatus('copied');
      message.success('Message copied to clipboard! (Status updated to COPIED)');
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      message.error('Failed to copy message');
    } finally {
      setLoadingCopy(false);
    }
  };

  const handleOpenWhatsApp = () => {
    if (!internationalPhone) {
      message.warning('No phone number available for this contact. Please enter or verify HR phone.');
      return;
    }
    window.open(waUrl, '_blank');
    message.info('Opening WhatsApp. Remember to press Send manually!');
  };

  const handleMarkAsSent = async () => {
    try {
      setLoadingSent(true);
      const payload = {
        notes: notes.trim() || undefined,
        nextFollowUpAt: scheduleFollowUp && followUpDate ? followUpDate.toISOString() : undefined,
      };
      await JobsAPI.markWhatsAppSent(job._id, payload);
      setWhatsappStatus('sent');
      message.success('WhatsApp outreach marked as SENT & activity logged!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      message.error('Failed to update status');
    } finally {
      setLoadingSent(false);
    }
  };

  const getStatusBadge = () => {
    if (whatsappStatus === 'sent') return <Tag color="green">✅ SENT</Tag>;
    if (whatsappStatus === 'copied') return <Tag color="gold">📋 COPIED</Tag>;
    return <Tag color="default">⏳ NOT SENT</Tag>;
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
              backgroundColor: '#25D366',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}
          >
            <WhatsAppOutlined />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>WhatsApp Outreach</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {job.company} — {job.role}
            </Text>
          </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={560}
      centered
    >
      <div style={{ padding: '8px 0' }}>
        {/* Recipient info & Status */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 16,
            border: '1px solid #e2e8f0',
          }}
        >
          <div>
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
              HR Contact
            </Text>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {job.contact?.hrName || job.hrName || 'Hiring Manager'}
            </div>
            <Space size={6} style={{ marginTop: 2 }}>
              <PhoneOutlined style={{ color: '#25D366' }} />
              <Text strong>{phone || 'No phone number provided'}</Text>
            </Space>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase' }}>
              Status
            </Text>
            {getStatusBadge()}
          </div>
        </div>

        {!phone && (
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message="No phone number recorded"
            description="You can copy the message and search the HR person manually on WhatsApp Web or mobile."
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Message Box */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text strong>WhatsApp Message</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Editable before sending
            </Text>
          </div>
          <TextArea
            rows={5}
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            style={{
              fontFamily: 'monospace',
              fontSize: 13,
              borderRadius: 8,
              border: '1px solid #cbd5e1',
            }}
          />
        </div>

        {/* Follow-up reminder configuration */}
        <div
          style={{
            background: '#fafafa',
            padding: '12px 14px',
            borderRadius: 8,
            marginBottom: 20,
            border: '1px dashed #d9d9d9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Checkbox
              checked={scheduleFollowUp}
              onChange={(e) => setScheduleFollowUp(e.target.checked)}
            >
              <Text strong>Schedule Follow-up reminder</Text>
            </Checkbox>
            {scheduleFollowUp && (
              <DatePicker
                value={followUpDate}
                onChange={(date) => setFollowUpDate(date)}
                format="DD MMM YYYY"
                allowClear={false}
                style={{ width: 150 }}
              />
            )}
          </div>
        </div>

        {/* Three Action Buttons */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginTop: 8,
          }}
        >
          <Button
            icon={<CopyOutlined />}
            onClick={handleCopyMessage}
            loading={loadingCopy}
            style={{ fontWeight: 600, height: 42 }}
          >
            Copy Message
          </Button>

          <Button
            type="default"
            icon={<WhatsAppOutlined />}
            onClick={handleOpenWhatsApp}
            disabled={!phone}
            style={{
              fontWeight: 600,
              height: 42,
              color: phone ? '#128C7E' : undefined,
              borderColor: phone ? '#25D366' : undefined,
            }}
          >
            Open WhatsApp
          </Button>

          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={handleMarkAsSent}
            loading={loadingSent}
            style={{
              fontWeight: 600,
              height: 42,
              backgroundColor: '#25D366',
              borderColor: '#25D366',
            }}
          >
            Mark as Sent
          </Button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Workflow: <strong>Copy Message</strong> → <strong>Open WhatsApp</strong> → <strong>Paste</strong> → <strong>Send manually</strong> → <strong>Mark as Sent</strong>
          </Text>
        </div>
      </div>
    </Modal>
  );
}

export default WhatsAppModal;
