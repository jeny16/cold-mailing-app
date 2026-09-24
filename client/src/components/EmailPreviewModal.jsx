import React from 'react';
import { Modal, Typography, Tag, Space, Divider, Button } from 'antd';
import { MailOutlined, PaperClipOutlined, SendOutlined } from '@ant-design/icons';

const { Text } = Typography;

export function EmailPreviewModal({ visible, previewData, onClose, onSendTest }) {
  if (!previewData) return null;

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      width={720}
      title={
        <Space>
          <MailOutlined style={{ color: '#1890ff' }} />
          <span>Email Application Preview</span>
        </Space>
      }
      footer={[
        <Button
          key="test"
          icon={<SendOutlined />}
          onClick={() => {
            onClose();
            if (onSendTest) onSendTest(previewData);
          }}
        >
          Send Test to My Email
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          Done
        </Button>,
      ]}
    >
      <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
          <Text strong style={{ width: 80, color: '#64748b' }}>
            To:
          </Text>
          <Text strong>{previewData.recipient}</Text>
          {previewData.recipientName && (
            <Text type="secondary" style={{ marginLeft: 8 }}>
              ({previewData.recipientName})
            </Text>
          )}
        </div>

        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
          <Text strong style={{ width: 80, color: '#64748b' }}>
            Subject:
          </Text>
          <Text strong style={{ color: '#1e293b' }}>
            {previewData.subject}
          </Text>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Text strong style={{ width: 80, color: '#64748b' }}>
            Attachment:
          </Text>
          <Tag color="blue" icon={<PaperClipOutlined />}>
            resume.pdf ({previewData.resumePath || 'attachments/resume.pdf'})
          </Tag>
        </div>
      </div>

      <Divider style={{ margin: '16px 0' }} />

      <div
        className="email-preview-box"
        dangerouslySetInnerHTML={{ __html: previewData.htmlBody }}
        style={{ minHeight: 220 }}
      />
    </Modal>
  );
}

export default EmailPreviewModal;
