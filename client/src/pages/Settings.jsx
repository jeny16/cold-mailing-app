import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Switch,
  Button,
  Upload,
  Typography,
  Divider,
  Alert,
  message,
  Space,
  Row,
  Col,
  Tag,
  Descriptions,
} from 'antd';
import {
  SaveOutlined,
  UploadOutlined,
  SendOutlined,
  FilePdfOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  MailOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { SettingsAPI, EmailsAPI } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export function Settings({ onTriggerTestModal }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resumeInfo, setResumeInfo] = useState(null);
  const [smtpStatus, setSmtpStatus] = useState(null);
  const [imapStatus, setImapStatus] = useState(null);
  const [testingImap, setTestingImap] = useState(false);
  const [simulatingReply, setSimulatingReply] = useState(false);
  const [simulatingBounce, setSimulatingBounce] = useState(false);
  const [testingEmail, setTestingEmail] = useState('dev@ansorbit.com');
  const [validatingEmail, setValidatingEmail] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  // Live preview template values
  const [subjectTemplate, setSubjectTemplate] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [senderName, setSenderName] = useState('');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await SettingsAPI.getSettings();
      const s = data.settings || {};
      setResumeInfo(data.resumeInfo);
      setSmtpStatus({
        configured: s.smtpConfigured,
        host: s.smtpHost,
        port: s.smtpPort,
        user: s.smtpUser,
      });
      setImapStatus({
        configured: s.imapConfigured,
        host: s.imapHost,
        port: s.imapPort,
        user: s.imapUser,
        lastReplyCheckAt: s.lastReplyCheckAt,
        repliesFoundCount: s.repliesFoundCount,
      });

      form.setFieldsValue({
        senderName: s.senderName,
        senderEmail: s.senderEmail,
        senderPhone: s.senderPhone,
        portfolioUrl: s.portfolioUrl,
        githubUrl: s.githubUrl,
        emailSubjectTemplate: s.emailSubjectTemplate,
        emailBodyTemplate: s.emailBodyTemplate,
        dailyLimit: s.dailyLimit,
        minDelaySeconds: s.minDelaySeconds,
        maxDelaySeconds: s.maxDelaySeconds,
        maxEmailsPerRun: s.maxEmailsPerRun,
        dryRun: s.dryRun,
        imapHost: s.imapHost || 'imap.gmail.com',
        imapPort: s.imapPort || 993,
        imapUser: s.imapUser || '',
      });

      setSubjectTemplate(s.emailSubjectTemplate || '');
      setBodyTemplate(s.emailBodyTemplate || '');
      setSenderName(s.senderName || 'Jeny Pansuriya');
    } catch (err) {
      message.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (values) => {
    try {
      setSaving(true);
      await SettingsAPI.updateSettings(values);
      message.success('Settings saved successfully!');
      fetchSettings();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestImap = async () => {
    try {
      setTestingImap(true);
      const values = form.getFieldsValue(['imapHost', 'imapPort', 'imapUser', 'imapPassword']);
      const res = await EmailsAPI.testImap(values);
      if (res.success) {
        message.success(res.message);
      } else {
        message.error(res.error || 'IMAP test failed');
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to test IMAP');
    } finally {
      setTestingImap(false);
    }
  };

  const handleSimulateReply = async () => {
    try {
      setSimulatingReply(true);
      const res = await EmailsAPI.simulateReply();
      message.success(res.message);
      fetchSettings();
    } catch (err) {
      message.error(err.response?.data?.error || 'Simulation failed');
    } finally {
      setSimulatingReply(false);
    }
  };

  const handleSimulateBounce = async () => {
    try {
      setSimulatingBounce(true);
      const res = await EmailsAPI.simulateBounce({
        bouncedEmail: 'dev@ansorbit.com',
        reason: '550 5.1.1 User does not exist - Address not found',
      });
      message.success(res.message);
      fetchSettings();
    } catch (err) {
      message.error(err.response?.data?.error || 'Bounce simulation failed');
    } finally {
      setSimulatingBounce(false);
    }
  };

  const handleValidateEmail = async () => {
    if (!testingEmail) return;
    try {
      setValidatingEmail(true);
      const res = await EmailsAPI.validateAddress({ email: testingEmail, checkMx: true });
      setValidationResult(res);
      if (res.valid) {
        message.success(`"${testingEmail}" is valid!`);
      } else {
        message.warning(`Issue detected: ${res.reason}`);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Validation check failed');
    } finally {
      setValidatingEmail(false);
    }
  };

  const handleResumeUpload = async ({ file, onSuccess, onError }) => {
    const formData = new FormData();
    formData.append('resume', file);

    try {
      const res = await SettingsAPI.uploadResume(formData);
      onSuccess(res, file);
      message.success('Resume PDF updated successfully!');
      setResumeInfo(res.resumeInfo);
    } catch (err) {
      onError(err);
      message.error(err.response?.data?.error || 'Failed to upload resume PDF');
    }
  };

  const insertVariable = (variable) => {
    const current = form.getFieldValue('emailBodyTemplate') || '';
    const updated = current + ` {{${variable}}}`;
    form.setFieldsValue({ emailBodyTemplate: updated });
    setBodyTemplate(updated);
  };

  // Generate preview body
  const previewBody = bodyTemplate
    .replace(/\{\{\s*hrNameOrHiringTeam\s*\}\}/g, 'Rahul')
    .replace(/\{\{\s*hrName\s*\}\}/g, 'Rahul')
    .replace(/\{\{\s*company\s*\}\}/g, 'ABC Technologies')
    .replace(/\{\{\s*role\s*\}\}/g, 'MERN Stack Developer')
    .replace(/\{\{\s*senderName\s*\}\}/g, senderName || 'Jeny Pansuriya')
    .replace(/\{\{\s*senderEmail\s*\}\}/g, form.getFieldValue('senderEmail') || 'jenypansuriya2004@gmail.com')
    .replace(/\{\{\s*senderPhone\s*\}\}/g, form.getFieldValue('senderPhone') || '+91 8511998086')
    .replace(/\{\{\s*portfolioUrl\s*\}\}/g, form.getFieldValue('portfolioUrl') || 'https://jenypansuriya.in')
    .replace(/\{\{\s*githubUrl\s*\}\}/g, form.getFieldValue('githubUrl') || 'https://github.com/jeny16');

  const previewSubject = subjectTemplate
    .replace(/\{\{\s*company\s*\}\}/g, 'ABC Technologies')
    .replace(/\{\{\s*role\s*\}\}/g, 'MERN Stack Developer');

  const templateVariables = [
    'company',
    'role',
    'hrName',
    'hrNameOrHiringTeam',
    'location',
    'jobUrl',
    'senderName',
    'senderEmail',
    'senderPhone',
    'portfolioUrl',
    'githubUrl',
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Application Settings & Configuration
          </Title>
          <Text type="secondary">
            Personal details, resume attachment, email personalization template, and safety limits.
          </Text>
        </div>

        <Space>
          <Button icon={<SendOutlined />} onClick={onTriggerTestModal}>
            Send Test Email
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={() => form.submit()}
          >
            Save All Changes
          </Button>
        </Space>
      </div>

      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Row gutter={[24, 24]}>
          {/* Left Column: Personal info & safety */}
          <Col xs={24} lg={12}>
            <Card title="Personal Contact Information" style={{ marginBottom: 24, borderRadius: 12 }}>
              <Form.Item
                name="senderName"
                label="Your Full Name"
                rules={[{ required: true }]}
              >
                <Input
                  placeholder="e.g. Jeny Pansuriya"
                  onChange={(e) => setSenderName(e.target.value)}
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="senderEmail"
                    label="Sender Email"
                    rules={[{ required: true, type: 'email' }]}
                  >
                    <Input placeholder="your.email@example.com" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="senderPhone" label="Contact Phone">
                    <Input placeholder="+91 9876543210" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="portfolioUrl" label="Portfolio Website URL">
                    <Input placeholder="https://..." />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="githubUrl" label="GitHub Profile URL">
                    <Input placeholder="https://github.com/..." />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Resume File Card */}
            <Card title="Resume PDF Attachment" style={{ marginBottom: 24, borderRadius: 12 }}>
              <div style={{ marginBottom: 16 }}>
                <Descriptions size="small" bordered column={1}>
                  <Descriptions.Item label="Current Path">
                    <code>{resumeInfo?.resolvedPath || 'attachments/resume.pdf'}</code>
                  </Descriptions.Item>
                  <Descriptions.Item label="Validation Status">
                    {resumeInfo?.valid ? (
                      <Tag color="green" icon={<CheckCircleOutlined />}>
                        Ready ({(resumeInfo.size / 1024).toFixed(1)} KB)
                      </Tag>
                    ) : (
                      <Tag color="red">{resumeInfo?.error || 'Missing file'}</Tag>
                    )}
                  </Descriptions.Item>
                </Descriptions>
              </div>

              <Upload
                accept=".pdf,application/pdf"
                multiple={false}
                showUploadList={false}
                customRequest={handleResumeUpload}
              >
                <Button icon={<UploadOutlined />}>Upload New Resume (PDF)</Button>
              </Upload>
            </Card>

            {/* Queue & Safety Limits */}
            <Card title="Queue & Safety Rate Limits" style={{ marginBottom: 24, borderRadius: 12 }}>
              <Form.Item
                name="dryRun"
                label="Dry Run Simulation Mode"
                valuePropName="checked"
                extra="When enabled, applications are logged in MongoDB without sending real emails to HR recipients."
              >
                <Switch checkedChildren="DRY RUN ON" unCheckedChildren="LIVE SENDING" />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="dailyLimit"
                    label="Daily Email Limit"
                    extra="Hard ceiling of emails per calendar day"
                  >
                    <InputNumber min={1} max={500} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="maxEmailsPerRun"
                    label="Max Emails Per Run"
                    extra="Maximum sent in a single queue execution"
                  >
                    <InputNumber min={1} max={50} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="minDelaySeconds"
                    label="Min Delay (seconds)"
                    extra="Minimum wait between consecutive sends"
                  >
                    <InputNumber min={1} max={300} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="maxDelaySeconds"
                    label="Max Delay (seconds)"
                    extra="Maximum randomized wait between sends"
                  >
                    <InputNumber min={1} max={600} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* SMTP Status */}
            <Card title="SMTP Server Configuration" style={{ borderRadius: 12, marginBottom: 24 }}>
              <Alert
                type={smtpStatus?.configured ? 'success' : 'warning'}
                showIcon
                icon={<SafetyCertificateOutlined />}
                message={
                  smtpStatus?.configured
                    ? 'SMTP Credentials Configured'
                    : 'Using Development / Test Transport'
                }
                description={
                  <div>
                    <p style={{ margin: 0 }}>
                      Host: <code>{smtpStatus?.host}</code> | Port: <code>{smtpStatus?.port}</code> | User: <code>{smtpStatus?.user}</code>
                    </p>
                    <p style={{ fontSize: 12, marginTop: 4, color: '#64748b' }}>
                      For security, SMTP passwords remain strictly in your local <code>.env</code> file.
                    </p>
                  </div>
                }
              />
            </Card>

            {/* IMAP Inbox & Reply Tracking Configuration */}
            <Card
              title={
                <Space>
                  <MailOutlined style={{ color: '#8b5cf6' }} />
                  <span>IMAP Inbox & Reply Tracking Configuration</span>
                </Space>
              }
              style={{ borderRadius: 12 }}
            >
              <Alert
                type={imapStatus?.configured ? 'success' : 'info'}
                showIcon
                icon={<SafetyCertificateOutlined />}
                message={
                  imapStatus?.configured
                    ? 'IMAP Reply & Bounce Tracking Configured'
                    : 'Configure IMAP to Track Inbound Replies & Delivery Failures'
                }
                description={
                  <div>
                    <p style={{ margin: 0 }}>
                      Allows the CRM to monitor your inbox and automatically detect both <strong>REPLIED</strong> emails and <strong>BOUNCED</strong> undelivered notifications (550 User does not exist).
                    </p>
                    {imapStatus?.lastReplyCheckAt && (
                      <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b' }}>
                        Last checked: {new Date(imapStatus.lastReplyCheckAt).toLocaleString()} | Replies: <strong>{imapStatus.repliesFoundCount || 0}</strong> | Bounces detected: <strong>{imapStatus.bouncesFoundCount || 0}</strong>
                      </p>
                    )}
                  </div>
                }
                style={{ marginBottom: 16 }}
              />

              <Row gutter={12}>
                <Col xs={24} sm={16}>
                  <Form.Item
                    name="imapHost"
                    label="IMAP Server Host"
                    extra="e.g. imap.gmail.com, outlook.office365.com, imap.mail.yahoo.com"
                  >
                    <Input placeholder="imap.gmail.com" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="imapPort" label="IMAP Port">
                    <InputNumber min={1} max={65535} style={{ width: '100%' }} placeholder="993" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="imapUser"
                    label="IMAP Email Address"
                    extra="Your email account username"
                  >
                    <Input placeholder="you@gmail.com" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="imapPassword"
                    label="IMAP Password / App Password"
                    extra="For Gmail, use a 16-character Google App Password"
                  >
                    <Input.Password placeholder="••••••••••••••••" />
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
                <Button
                  icon={<SyncOutlined />}
                  onClick={handleTestImap}
                  loading={testingImap}
                >
                  Test IMAP Connection
                </Button>

                <Space wrap>
                  <Button
                    type="dashed"
                    icon={<ThunderboltOutlined />}
                    onClick={handleSimulateReply}
                    loading={simulatingReply}
                    style={{ color: '#8b5cf6', borderColor: '#c4b5fd' }}
                  >
                    Simulate HR Reply
                  </Button>

                  <Button
                    type="dashed"
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={handleSimulateBounce}
                    loading={simulatingBounce}
                  >
                    Simulate Bounce (dev@ansorbit.com)
                  </Button>
                </Space>
              </div>
            </Card>

            {/* Email Address Hygiene & Validation Tester */}
            <Card
              title={
                <Space>
                  <SafetyCertificateOutlined style={{ color: '#10b981' }} />
                  <span>Email Hygiene & Domain Validator</span>
                </Space>
              }
              style={{ borderRadius: 12, marginTop: 24 }}
            >
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 0 }}>
                Check any recipient address for RFC syntax, dummy domains, typos, and mail server (MX) capability before sending:
              </p>
              <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
                <Input
                  value={testingEmail}
                  onChange={(e) => setTestingEmail(e.target.value)}
                  placeholder="e.g. dev@ansorbit.com"
                  onPressEnter={handleValidateEmail}
                />
                <Button
                  type="primary"
                  onClick={handleValidateEmail}
                  loading={validatingEmail}
                >
                  Validate
                </Button>
              </Space.Compact>

              {validationResult && (
                <Alert
                  type={validationResult.valid ? 'success' : 'error'}
                  showIcon
                  icon={validationResult.valid ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                  message={
                    validationResult.valid
                      ? `Valid Recipient: "${validationResult.email}"`
                      : `Delivery Issue: "${validationResult.email}"`
                  }
                  description={
                    <div>
                      <p style={{ margin: 0 }}>
                        {validationResult.valid
                          ? 'Email syntax and domain structure are valid.'
                          : validationResult.reason}
                      </p>
                      {validationResult.suggestedCorrection && (
                        <p style={{ margin: '4px 0 0 0', fontWeight: 600, color: '#b45309' }}>
                          Suggested correction: {validationResult.suggestedCorrection}
                        </p>
                      )}
                    </div>
                  }
                />
              )}
            </Card>
          </Col>

          {/* Right Column: Template Composer & Live Preview */}
          <Col xs={24} lg={12}>
            <Card title="Email Application Template" style={{ marginBottom: 24, borderRadius: 12 }}>
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                  Click to insert variable into template:
                </Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {templateVariables.map((v) => (
                    <Tag
                      key={v}
                      color="blue"
                      style={{ cursor: 'pointer' }}
                      onClick={() => insertVariable(v)}
                    >
                      +{`{{${v}}}`}
                    </Tag>
                  ))}
                </div>
              </div>

              <Form.Item
                name="emailSubjectTemplate"
                label="Email Subject Line"
                rules={[{ required: true }]}
              >
                <Input
                  placeholder="Application for {{role}} – {{company}}"
                  onChange={(e) => setSubjectTemplate(e.target.value)}
                />
              </Form.Item>

              <Form.Item
                name="emailBodyTemplate"
                label="Email Body Content"
                rules={[{ required: true }]}
              >
                <TextArea
                  rows={12}
                  onChange={(e) => setBodyTemplate(e.target.value)}
                  style={{ fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6 }}
                />
              </Form.Item>
            </Card>

            {/* Live Template Preview */}
            <Card
              title={
                <Space>
                  <InfoCircleOutlined style={{ color: '#1890ff' }} />
                  <span>Live Rendered Preview</span>
                </Space>
              }
              style={{ borderRadius: 12 }}
            >
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <Text strong style={{ display: 'block' }}>
                  Subject: {previewSubject}
                </Text>
              </div>

              <div
                className="email-preview-box"
                style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}
              >
                {previewBody}
              </div>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
}

export default Settings;
