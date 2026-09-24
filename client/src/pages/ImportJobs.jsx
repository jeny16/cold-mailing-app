import React, { useState, useEffect } from 'react';
import {
  Card,
  Upload,
  Button,
  Typography,
  Space,
  Alert,
  Modal,
  Descriptions,
  Table,
  Tag,
  Input,
  message,
  Tabs,
} from 'antd';
import {
  InboxOutlined,
  UploadOutlined,
  FolderOpenOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { ImportAPI } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;
const { TextArea } = Input;

export function ImportJobs({ onNavigateToReview }) {
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [directLoading, setDirectLoading] = useState(false);

  // Import Summary Modal
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  const fetchImports = async () => {
    try {
      setLoading(true);
      const data = await ImportAPI.getImports();
      setImports(data.imports || []);
    } catch (err) {
      console.error('Failed to load imports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImports();
  }, []);

  const handleCustomUpload = async ({ file, onSuccess, onError }) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await ImportAPI.uploadFile(formData);
      onSuccess(res, file);
      message.success(`File "${file.name}" uploaded and parsed`);
      setImportSummary({
        filename: file.name,
        ...res.summary,
        errors: res.errors,
      });
      setSummaryModalVisible(true);
      fetchImports();
    } catch (err) {
      onError(err);
      message.error(err.response?.data?.error || 'Failed to import JSON file');
    }
  };

  const handleDirectPaste = async () => {
    if (!jsonText.trim()) {
      message.warning('Please paste a JSON string first');
      return;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      message.error(`Invalid JSON syntax: ${err.message}`);
      return;
    }

    try {
      setDirectLoading(true);
      const res = await ImportAPI.directImport(parsed);
      message.success('JSON imported successfully');
      setImportSummary({
        filename: 'Direct Paste Import',
        ...res.summary,
        errors: res.errors,
      });
      setSummaryModalVisible(true);
      setJsonText('');
      fetchImports();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to import JSON');
    } finally {
      setDirectLoading(false);
    }
  };

  const importColumns = [
    {
      title: 'Import Time',
      dataIndex: 'importedAt',
      key: 'importedAt',
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: 'Filename / Source',
      dataIndex: 'filename',
      key: 'filename',
      render: (name, r) => (
        <div>
          <strong>{name}</strong>
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            {r.source}
          </Text>
        </div>
      ),
    },
    {
      title: 'Total',
      dataIndex: 'totalRecords',
      key: 'totalRecords',
    },
    {
      title: 'Valid',
      dataIndex: 'validRecords',
      key: 'validRecords',
      render: (cnt) => <Tag color="green">{cnt}</Tag>,
    },
    {
      title: 'New',
      dataIndex: 'newRecords',
      key: 'newRecords',
      render: (cnt) => <Tag color="blue">{cnt}</Tag>,
    },
    {
      title: 'Duplicates',
      dataIndex: 'duplicateRecords',
      key: 'duplicateRecords',
      render: (cnt) => (cnt > 0 ? <Tag color="orange">{cnt}</Tag> : <Text type="secondary">0</Text>),
    },
    {
      title: 'Invalid',
      dataIndex: 'invalidRecords',
      key: 'invalidRecords',
      render: (cnt) => (cnt > 0 ? <Tag color="red">{cnt}</Tag> : <Text type="secondary">0</Text>),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (st) => (
        <Tag color={st === 'SUCCESS' ? 'green' : st === 'PARTIAL' ? 'orange' : 'red'}>
          {st}
        </Tag>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Import AI Job Leads
          </Title>
          <Text type="secondary">
            Ingest normalized JSON files produced by your AI research agents via upload, paste, or local folder watcher.
          </Text>
        </div>
      </div>

      <Alert
        type="info"
        showIcon
        icon={<FolderOpenOutlined />}
        message="Automatic Folder Watcher Running"
        description={
          <div>
            The application continuously watches <code>data/incoming/</code>. Any <code>.json</code> file added there by your AI agents will be automatically parsed, deduplicated, and moved to <code>data/processed/</code> (or <code>data/failed/</code> if malformed).
          </div>
        }
        style={{ marginBottom: 20 }}
      />

      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <Tabs
          defaultActiveKey="upload"
          items={[
            {
              key: 'upload',
              label: (
                <span>
                  <UploadOutlined /> File Upload
                </span>
              ),
              children: (
                <div style={{ padding: '16px 0' }}>
                  <Dragger
                    name="file"
                    multiple={false}
                    accept=".json,application/json"
                    customRequest={handleCustomUpload}
                    showUploadList={false}
                    style={{ padding: '24px 0', background: '#f8fafc', borderRadius: 12 }}
                  >
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined style={{ color: '#1890ff', fontSize: 48 }} />
                    </p>
                    <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 600 }}>
                      Click or drag a .json file to this area to import
                    </p>
                    <p className="ant-upload-hint" style={{ color: '#64748b' }}>
                      Accepts normalized JSON with a <code>jobs</code> array.
                    </p>
                  </Dragger>
                </div>
              ),
            },
            {
              key: 'paste',
              label: (
                <span>
                  <FileTextOutlined /> Paste Raw JSON
                </span>
              ),
              children: (
                <div style={{ padding: '12px 0' }}>
                  <TextArea
                    rows={8}
                    placeholder={`{\n  "jobs": [\n    {\n      "company": "ABC Technologies",\n      "role": "MERN Stack Developer",\n      "hrEmail": "rahul@abctech.com",\n      "hrName": "Rahul"\n    }\n  ]\n}`}
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                  <div style={{ marginTop: 12, textAlign: 'right' }}>
                    <Button
                      type="primary"
                      onClick={handleDirectPaste}
                      loading={directLoading}
                    >
                      Import Pasted JSON
                    </Button>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Historical Imports */}
      <Card title="Import History" style={{ borderRadius: 12 }}>
        <Table
          dataSource={imports}
          columns={importColumns}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 8 }}
        />
      </Card>

      {/* Import Summary Modal (Requirement 28) */}
      <Modal
        open={summaryModalVisible}
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span>Import Completed</span>
          </Space>
        }
        onCancel={() => setSummaryModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setSummaryModalVisible(false)}>
            Close
          </Button>,
          <Button
            key="review"
            type="primary"
            onClick={() => {
              setSummaryModalVisible(false);
              onNavigateToReview();
            }}
          >
            View Imported Jobs →
          </Button>,
        ]}
        width={560}
      >
        {importSummary && (
          <div>
            <Alert
              type={importSummary.invalid > 0 ? 'warning' : 'success'}
              showIcon
              message={`Processed: ${importSummary.filename}`}
              description={
                importSummary.newJobs > 0
                  ? `Successfully imported ${importSummary.newJobs} new job opportunity(s).`
                  : 'Import processed.'
              }
              style={{ marginBottom: 16 }}
            />

            <Descriptions bordered column={2} size="middle">
              <Descriptions.Item label="Total Records">
                <strong>{importSummary.total}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Valid Records">
                <Text type="success" strong>
                  {importSummary.valid}
                </Text>
              </Descriptions.Item>

              <Descriptions.Item label="New Jobs">
                <Tag color="blue" style={{ fontSize: 14, fontWeight: 600 }}>
                  {importSummary.newJobs}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Duplicates / Existing">
                <Tag color="orange" style={{ fontSize: 14 }}>
                  {importSummary.duplicates || importSummary.existing || 0}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Invalid Records" span={2}>
                {importSummary.invalid > 0 ? (
                  <Tag color="red" style={{ fontSize: 14 }}>
                    {importSummary.invalid}
                  </Tag>
                ) : (
                  <Text type="secondary">0</Text>
                )}
              </Descriptions.Item>
            </Descriptions>

            {importSummary.errors && importSummary.errors.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Text type="danger" strong>
                  Validation Issues:
                </Text>
                <div
                  style={{
                    maxHeight: 120,
                    overflowY: 'auto',
                    background: '#fef2f2',
                    padding: 8,
                    borderRadius: 6,
                    marginTop: 4,
                  }}
                >
                  {importSummary.errors.map((err, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#991b1b', marginBottom: 4 }}>
                      • {err.company || ''} ({err.role || ''}): {Array.isArray(err.errors) ? err.errors.join(', ') : err.message || JSON.stringify(err)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ImportJobs;
