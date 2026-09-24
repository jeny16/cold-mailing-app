import React, { useState } from 'react';
import { Modal, Form, Input, Button, Alert, message, Space } from 'antd';
import { SendOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { EmailsAPI } from '../services/api';

export function TestEmailModal({ visible, initialJob, onClose }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const handleSend = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      setLastResult(null);

      const res = await EmailsAPI.sendTestEmail({
        testEmail: values.testEmail,
        sampleCompany: values.sampleCompany || initialJob?.company,
        sampleRole: values.sampleRole || initialJob?.role,
      });

      setLastResult(res);
      message.success(`Test email dispatched to ${values.testEmail}`);
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.error || err.message || 'Failed to send test email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={visible}
      title={
        <Space>
          <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
          <span>Send Test Email (Safety Mode)</span>
        </Space>
      }
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
        <Button
          key="send"
          type="primary"
          icon={<SendOutlined />}
          loading={loading}
          onClick={handleSend}
        >
          Send Test Email
        </Button>,
      ]}
      width={560}
    >
      <Alert
        type="info"
        showIcon
        message="Safe Testing Guarantee"
        description="This will send an email ONLY to the destination email address you provide below. Real HR recipients will NEVER be contacted."
        style={{ marginBottom: 16 }}
      />

      {lastResult && (
        <Alert
          type="success"
          showIcon
          message="Test Send Succeeded!"
          description={
            <div>
              <p>{lastResult.message}</p>
              <p>
                <strong>Resume Attached:</strong> {lastResult.resumeAttached ? 'Yes (PDF)' : 'No'}
              </p>
              {lastResult.result?.isDryRun && (
                <p>
                  <em>Note: DRY_RUN mode is currently enabled, so this was logged locally without external SMTP.</em>
                </p>
              )}
            </div>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Form form={form} layout="vertical">
        <Form.Item
          name="testEmail"
          label="Your Test Email Address"
          rules={[
            { required: true, message: 'Please input your test email address' },
            { type: 'email', message: 'Enter a valid email address' },
          ]}
        >
          <Input placeholder="e.g. your.personal.email@gmail.com" />
        </Form.Item>

        <Form.Item
          name="sampleCompany"
          label="Sample Company Name"
          initialValue={initialJob?.company || 'Acme Technologies Inc.'}
        >
          <Input placeholder="Company Name" />
        </Form.Item>

        <Form.Item
          name="sampleRole"
          label="Sample Role Title"
          initialValue={initialJob?.role || 'MERN Stack Developer'}
        >
          <Input placeholder="Role Title" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default TestEmailModal;
