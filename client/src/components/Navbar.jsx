import React from 'react';
import { Layout, Menu, Button, Badge, Space, Tag, Tooltip } from 'antd';
import {
  DashboardOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  UploadOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  MailOutlined,
} from '@ant-design/icons';

const { Header } = Layout;

export function Navbar({ activeTab, onSelectTab, queueStatus, onToggleQueue, queueLoading }) {
  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
    {
      key: 'review',
      icon: <CheckCircleOutlined />,
      label: (
        <span>
          Review Jobs{' '}
          {queueStatus?.reviewCount > 0 && (
            <Badge count={queueStatus.reviewCount} style={{ backgroundColor: '#faad14' }} />
          )}
        </span>
      ),
    },
    {
      key: 'queue',
      icon: <ClockCircleOutlined />,
      label: (
        <span>
          Email Queue{' '}
          {queueStatus?.queuedCount > 0 && (
            <Badge count={queueStatus.queuedCount} style={{ backgroundColor: '#1890ff' }} />
          )}
        </span>
      ),
    },
    { key: 'history', icon: <HistoryOutlined />, label: 'Sent History' },
    { key: 'import', icon: <UploadOutlined />, label: 'Import JSON' },
    { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
  ];

  const isRunning = queueStatus?.state === 'RUNNING';

  return (
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#ffffff',
        padding: '0 24px',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        height: '64px',
        lineHeight: 'normal',
      }}
    >
      {/* Left: Brand Logo & Title */}
      <div
        onClick={() => onSelectTab('dashboard')}
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
          marginRight: '20px',
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #1890ff 0%, #0050b3 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          <MailOutlined />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.2 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            JOB OUTREACH CRM
          </span>
          <span style={{ fontSize: 11, color: '#64748b', lineHeight: 1.2, marginTop: 2 }}>
            Email &amp; WhatsApp Outreach System
          </span>
        </div>
      </div>

      {/* Center: Main Horizontal Menu */}
      <Menu
        mode="horizontal"
        selectedKeys={[activeTab]}
        onClick={({ key }) => onSelectTab(key)}
        items={menuItems}
        style={{
          flex: 1,
          minWidth: 0,
          borderBottom: 'none',
          lineHeight: '62px',
        }}
      />

      {/* Right: Actions and Live Mode Tag */}
      <Space size="middle" style={{ flexShrink: 0, marginLeft: '16px' }}>
        {queueStatus?.dryRun ? (
          <Tooltip title="DRY RUN active: Emails are logged without reaching external SMTP. You can toggle this in Settings.">
            <Tag color="orange" style={{ fontWeight: 600, padding: '4px 8px' }}>
              🛡️ DRY RUN MODE
            </Tag>
          </Tooltip>
        ) : (
          <Tooltip title="Live SMTP active: Real emails will be dispatched when queue is running">
            <Tag color="green" style={{ fontWeight: 600, padding: '4px 8px' }}>
              🚀 LIVE SMTP
            </Tag>
          </Tooltip>
        )}

        <Button
          type={isRunning ? 'default' : 'primary'}
          danger={isRunning}
          icon={isRunning ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          onClick={onToggleQueue}
          loading={queueLoading}
          style={{ fontWeight: 600 }}
        >
          {isRunning ? 'PAUSE SENDING' : 'START SENDING'}
        </Button>
      </Space>
    </Header>
  );
}

export default Navbar;
