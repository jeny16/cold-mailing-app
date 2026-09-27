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
  const isRunning = queueStatus?.state === 'RUNNING';

  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
    {
      key: 'review',
      icon: <CheckCircleOutlined />,
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Review Jobs
          {queueStatus?.reviewCount > 0 && (
            <Badge
              count={queueStatus.reviewCount}
              style={{ backgroundColor: '#f59e0b', fontSize: 11, fontWeight: 700 }}
            />
          )}
        </span>
      ),
    },
    {
      key: 'queue',
      icon: <ClockCircleOutlined />,
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Email Queue
          {queueStatus?.queuedCount > 0 && (
            <Badge
              count={queueStatus.queuedCount}
              style={{ backgroundColor: '#2563eb', fontSize: 11, fontWeight: 700 }}
            />
          )}
        </span>
      ),
    },
    { key: 'history', icon: <HistoryOutlined />, label: 'Sent History' },
    { key: 'import', icon: <UploadOutlined />, label: 'Import JSON' },
    { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
  ];

  return (
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: '0 28px',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        height: '64px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
      }}
    >
      {/* Brand Logo & Title */}
      <div
        onClick={() => onSelectTab('dashboard')}
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
          marginRight: '24px',
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 18,
            boxShadow: '0 3px 10px rgba(37, 99, 235, 0.3)',
            flexShrink: 0,
          }}
        >
          <MailOutlined />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              JOB OUTREACH CRM
            </span>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: isRunning ? '#10b981' : '#94a3b8',
                display: 'inline-block',
              }}
              className={isRunning ? 'pulse-active' : ''}
            />
          </div>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500, lineHeight: 1.2, marginTop: 2 }}>
            Multi-Channel Job Application System
          </span>
        </div>
      </div>

      {/* Main Navigation Menu */}
      <Menu
        mode="horizontal"
        selectedKeys={[activeTab]}
        onClick={({ key }) => onSelectTab(key)}
        items={menuItems}
        style={{
          flex: 1,
          minWidth: 0,
          borderBottom: 'none',
          background: 'transparent',
          fontWeight: 600,
          fontSize: '13.5px',
          lineHeight: '62px',
        }}
      />

      {/* Mode Tag and Live Queue Toggle */}
      <Space size="middle" style={{ flexShrink: 0, marginLeft: '20px' }}>
        {queueStatus?.dryRun ? (
          <Tooltip title="DRY RUN active: Emails are logged safely without reaching external mail servers. Toggle in Settings.">
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 8,
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                color: '#b45309',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              🛡️ DRY RUN
            </span>
          </Tooltip>
        ) : (
          <Tooltip title="Live SMTP active: Real emails will be dispatched to employers when queue is active.">
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 8,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              🚀 LIVE SMTP
            </span>
          </Tooltip>
        )}

        <Button
          type={isRunning ? 'default' : 'primary'}
          danger={isRunning}
          icon={isRunning ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          onClick={onToggleQueue}
          loading={queueLoading}
          style={{
            fontWeight: 700,
            borderRadius: 8,
            boxShadow: isRunning ? 'none' : '0 2px 8px rgba(37, 99, 235, 0.25)',
          }}
        >
          {isRunning ? 'PAUSE QUEUE' : 'START QUEUE'}
        </Button>
      </Space>
    </Header>
  );
}

export default Navbar;
