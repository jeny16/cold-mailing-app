import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Row,
  Col,
  Button,
  message,
  Typography,
  Divider,
  Space,
} from 'antd';
import {
  PlusOutlined,
  BankOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  WhatsAppOutlined,
  LinkedinOutlined,
  LinkOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { JobsAPI } from '../services/api';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

export function AddCompanyModal({ visible, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleFinish = async (values) => {
    try {
      setLoading(true);

      const payload = {
        company: values.company.trim(),
        role: values.role.trim(),
        jobUrl: values.jobUrl?.trim() || '',
        location: values.location?.trim() || 'Ahmedabad',
        workMode: values.workMode || 'Work From Office',
        experienceRequired: values.experienceRequired?.trim() || '',
        requirements: values.requirements
          ? values.requirements.split(',').map((r) => r.trim()).filter(Boolean)
          : [],
        notes: values.notes?.trim() || '',
        contact: {
          hrName: values.hrName?.trim() || '',
          hrJobTitle: values.hrJobTitle?.trim() || 'HR / Recruitment Team',
          email: values.hrEmail.trim(),
          phone: values.phone?.trim() || '',
          whatsapp: values.whatsapp?.trim() || values.phone?.trim() || '',
          linkedin: values.linkedin?.trim() || '',
        },
        whatsapp: {
          phone: values.whatsapp?.trim() || values.phone?.trim() || '',
        },
        status: values.status || 'READY_TO_CONTACT',
      };

      await JobsAPI.createJob(payload);
      message.success(`Added ${values.company} to Outreach CRM!`);
      form.resetFields();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.error || 'Failed to add company');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (e) => {
    const phoneVal = e.target.value;
    const currentWa = form.getFieldValue('whatsapp');
    if (!currentWa || currentWa === phoneVal.slice(0, -1)) {
      form.setFieldsValue({ whatsapp: phoneVal });
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
              background: 'linear-gradient(135deg, #1890ff 0%, #0050b3 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            <BankOutlined />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Add New Company Prospect</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Add to Job Outreach CRM with separate Email and WhatsApp tracking
            </Text>
          </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={680}
      centered
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{
          workMode: 'Work From Office',
          status: 'READY_TO_CONTACT',
          location: 'Ahmedabad',
        }}
        style={{ marginTop: 16 }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="company"
              label="Company Name"
              rules={[{ required: true, message: 'Company name is required' }]}
            >
              <Input prefix={<BankOutlined />} placeholder="e.g. TriState Technology" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="role"
              label="Job Role / Position"
              rules={[{ required: true, message: 'Role title is required' }]}
            >
              <Input placeholder="e.g. MERN Stack Developer" />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" style={{ margin: '8px 0 16px 0', fontSize: 13, color: '#64748b' }}>
          HR & Contact Info
        </Divider>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="hrName" label="HR / Recruiter Name">
              <Input prefix={<UserOutlined />} placeholder="e.g. Anand Shah (or leave blank)" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="hrEmail"
              label="HR Email"
              rules={[
                { required: true, message: 'HR Email is required' },
                { type: 'email', message: 'Enter a valid email' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="career@tristatetechnology.com" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="phone" label="Phone / Mobile">
              <Input
                prefix={<PhoneOutlined />}
                placeholder="e.g. +917600436632"
                onChange={handlePhoneChange}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="whatsapp" label="WhatsApp Number">
              <Input prefix={<WhatsAppOutlined style={{ color: '#25D366' }} />} placeholder="e.g. +917600436632" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="linkedin" label="HR / Company LinkedIn URL">
              <Input prefix={<LinkedinOutlined style={{ color: '#0a66c2' }} />} placeholder="https://linkedin.com/..." />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="jobUrl" label="Job Posting URL">
              <Input prefix={<LinkOutlined />} placeholder="https://careers.company.com/..." />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" style={{ margin: '8px 0 16px 0', fontSize: 13, color: '#64748b' }}>
          Role Details & CRM Tracking
        </Divider>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="location" label="Location">
              <Input prefix={<EnvironmentOutlined />} placeholder="Ahmedabad" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="workMode" label="Work Mode">
              <Select>
                <Option value="Work From Office">Work From Office</Option>
                <Option value="Remote">Remote</Option>
                <Option value="Hybrid">Hybrid</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="status" label="Initial CRM Status">
              <Select>
                <Option value="NEW">NEW</Option>
                <Option value="RESEARCHED">RESEARCHED</Option>
                <Option value="READY_TO_CONTACT">READY_TO_CONTACT</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="requirements" label="Key Skills / Requirements (comma separated)">
          <Input placeholder="ReactJS, NodeJS, ExpressJS, MongoDB, REST APIs" />
        </Form.Item>

        <Form.Item name="notes" label="Outreach Notes">
          <TextArea rows={2} placeholder="Any notes, referral contact, or research details..." />
        </Form.Item>

        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading} icon={<PlusOutlined />}>
              Save to CRM
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
}

export default AddCompanyModal;
