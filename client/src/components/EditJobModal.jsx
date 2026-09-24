import React, { useEffect } from 'react';
import { Modal, Form, Input, Switch, message } from 'antd';
import { JobsAPI } from '../services/api';

const { TextArea } = Input;

export function EditJobModal({ visible, job, onClose, onUpdated }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = React.useState(false);

  useEffect(() => {
    if (job && visible) {
      form.setFieldsValue({
        company: job.company,
        role: job.role,
        hrName: job.hrName,
        hrEmail: job.hrEmail,
        location: job.location,
        remote: job.remote,
        jobUrl: job.jobUrl,
        notes: job.notes,
        description: job.description,
        emailSubject: job.email?.subject || '',
        emailBody: job.email?.body || '',
      });
    }
  }, [job, visible, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        company: values.company,
        role: values.role,
        hrName: values.hrName,
        hrEmail: values.hrEmail,
        location: values.location,
        remote: values.remote,
        jobUrl: values.jobUrl,
        notes: values.notes,
        description: values.description,
        email: {
          to: values.hrEmail,
          subject: values.emailSubject || '',
          body: values.emailBody || '',
        },
      };
      const res = await JobsAPI.updateJob(job._id, payload);
      message.success('Job details and email application updated');
      onUpdated(res.job);
      onClose();
    } catch (err) {
      if (err.errorFields) return; // Validation error in form
      message.error(err.response?.data?.error || err.message || 'Failed to update job');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={visible}
      title={`Edit Job: ${job?.role || ''}`}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={submitting}
      okText="Save Changes"
      width={640}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="company"
          label="Company Name"
          rules={[{ required: true, message: 'Company name is required' }]}
        >
          <Input placeholder="Company Name" />
        </Form.Item>

        <Form.Item
          name="role"
          label="Job Role / Title"
          rules={[{ required: true, message: 'Role is required' }]}
        >
          <Input placeholder="e.g. MERN Stack Developer" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Form.Item name="hrName" label="HR / Recruiter Name">
            <Input placeholder="e.g. Rahul Sharma (or leave blank)" />
          </Form.Item>

          <Form.Item
            name="hrEmail"
            label="HR Email Address"
            rules={[
              { required: true, message: 'HR email is required' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <Input placeholder="e.g. rahul@company.com" />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Form.Item name="location" label="Location">
            <Input placeholder="e.g. Ahmedabad, India" />
          </Form.Item>

          <Form.Item name="remote" label="Remote Work" valuePropName="checked">
            <Switch checkedChildren="Remote" unCheckedChildren="On-site" />
          </Form.Item>
        </div>

        <Form.Item name="jobUrl" label="Job Posting URL">
          <Input placeholder="https://..." />
        </Form.Item>

        <Form.Item name="description" label="Job Description">
          <TextArea rows={3} placeholder="Job description summary" />
        </Form.Item>

        <Form.Item name="notes" label="AI Agent Notes">
          <TextArea rows={2} placeholder="Any recruiter notes" />
        </Form.Item>

        <Form.Item name="emailSubject" label="Email Subject">
          <Input placeholder="Application Subject" />
        </Form.Item>

        <Form.Item name="emailBody" label="Email Body (AI Generated)">
          <TextArea rows={5} placeholder="Personalized cold email body" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default EditJobModal;
