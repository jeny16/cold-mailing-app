import React, { useState, useEffect } from 'react';
import { Modal, Button, Typography, Space, Tag, Input, Alert, message, Divider } from 'antd';
import {
  MailOutlined,
  SendOutlined,
  PaperClipOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { JobsAPI, SettingsAPI } from '../services/api';

const { Text, Title, Paragraph } = Typography;

export function SendEmailModal({ visible, job, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewData, setPreviewData] = useState(null);
  const [dryRun, setDryRun] = useState(false);

  useEffect(() => {
    if (visible && job) {
      loadPreview();
    }
  }, [visible, job]);

  const loadPreview = async () => {
    try {
      setPreviewLoading(true);
      const [prevRes, settingsRes] = await Promise.all([
        JobsAPI.previewEmail(job._id),
        SettingsAPI.getSettings(),
      ]);
      setPreviewData(prevRes);
      setDryRun(settingsRes.dryRun);
    } catch (err) {
      console.error(err);
      message.error('Failed to load email preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSend = async () => {
    try {
      setLoading(true);
      const res = await JobsAPI.sendSingleEmail(job._id);
      message.success(res.message || 'Email sent successfully!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.error || 'Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  if (!job) return null;

  const recipientEmail = job.contact?.email || job.hrEmail;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #1890ff 0%, #0050b3 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}
          >
            <MailOutlined />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Dispatch Application Email</div>
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
          key="send"
          type="primary"
          icon={<SendOutlined />}
          loading={loading}
          disabled={previewLoading || !recipientEmail}
          onClick={handleSend}
          style={{ fontWeight: 600 }}
        >
          {dryRun ? 'Simulate Send (DRY RUN)' : 'Dispatch Email Now'}
        </Button>,
      ]}
      width={640}
      centered
    >
      <div style={{ padding: '8px 0' }}>
        {dryRun && (
          <Alert
            type="warning"
            showIcon
            message="DRY RUN Active"
            description="Email will be recorded in CRM and sent history without being sent externally to the recruiter."
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Email Recipient & Subject Details */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text type="secondary">Recipient:</Text>
            <Text strong>
              {previewData?.recipientName || job.contact?.hrName || 'Hiring Team'} &lt;{recipientEmail}&gt;
            </Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text type="secondary">Subject:</Text>
            <Text strong style={{ color: '#1890ff', textAlign: 'right', maxWidth: '75%' }}>
              {previewData?.subject || job.email?.subject || `Application for ${job.role} – Jeny Pansuriya`}
            </Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">Attachment:</Text>
            <Tag color="blue" icon={<PaperClipOutlined />}>
              {previewData?.resumePath ? previewData.resumePath.split('/').pop() : 'Jeny_Pansuriya_Resume.pdf'} (PDF)
            </Tag>
          </div>
        </div>

        {/* Body Preview */}
        <div>
          <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
            Email Body Preview:
          </Text>
          <div
            style={{
              maxHeight: 250,
              overflowY: 'auto',
              padding: 16,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.6,
            }}
            dangerouslySetInnerHTML={{
              __html:
                previewData?.htmlBody ||
                (job.email?.body
                  ? job.email.body.replace(/\n/g, '<br/>')
                  : '<p>Loading preview...</p>'),
            }}
          />
        </div>
      </div>
    </Modal>
  );
}

export default SendEmailModal;
