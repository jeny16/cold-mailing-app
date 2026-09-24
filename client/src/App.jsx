import React, { useState, useEffect } from 'react';
import { ConfigProvider, Layout, App as AntdApp } from 'antd';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { JobReview } from './pages/JobReview';
import { EmailQueue } from './pages/EmailQueue';
import { SentHistory } from './pages/SentHistory';
import { ImportJobs } from './pages/ImportJobs';
import { Settings } from './pages/Settings';
import { TestEmailModal } from './components/TestEmailModal';
import { QueueAPI, StatsAPI } from './services/api';

const { Content, Footer } = Layout;

function MainApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [queueStatus, setQueueStatus] = useState(null);
  const [queueLoading, setQueueLoading] = useState(false);

  // Global test email modal
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testInitialJob, setTestInitialJob] = useState(null);

  const fetchGlobalState = async () => {
    try {
      const [queueRes, statsRes] = await Promise.all([
        QueueAPI.getStatus(),
        StatsAPI.getStats(),
      ]);
      setQueueStatus({
        ...queueRes,
        reviewCount: statsRes.stats?.review || 0,
      });
    } catch (err) {
      console.error('Error fetching global state:', err);
    }
  };

  useEffect(() => {
    fetchGlobalState();
    const interval = setInterval(fetchGlobalState, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleQueue = async () => {
    try {
      setQueueLoading(true);
      if (queueStatus?.state === 'RUNNING') {
        await QueueAPI.pauseQueue();
      } else {
        await QueueAPI.startQueue();
      }
      await fetchGlobalState();
    } catch (err) {
      console.error('Failed to toggle queue:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleOpenTestModal = (job = null) => {
    setTestInitialJob(job);
    setTestModalVisible(true);
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        queueStatus={queueStatus}
        onToggleQueue={handleToggleQueue}
        queueLoading={queueLoading}
      />

      <Content className="main-content">
        {activeTab === 'dashboard' && (
          <Dashboard
            onNavigate={setActiveTab}
            onTriggerTestModal={handleOpenTestModal}
          />
        )}

        {activeTab === 'review' && (
          <JobReview onSendTestTrigger={handleOpenTestModal} />
        )}

        {activeTab === 'queue' && <EmailQueue />}

        {activeTab === 'history' && <SentHistory />}

        {activeTab === 'import' && (
          <ImportJobs onNavigateToReview={() => setActiveTab('review')} />
        )}

        {activeTab === 'settings' && (
          <Settings onTriggerTestModal={handleOpenTestModal} />
        )}
      </Content>

      <Footer style={{ textAlign: 'center', color: '#94a3b8', background: '#f8fafc' }}>
        Job Application Mailer © 2026 – Built for Jeny Pansuriya – Local Safe Sending System
      </Footer>

      <TestEmailModal
        visible={testModalVisible}
        initialJob={testInitialJob}
        onClose={() => setTestModalVisible(false)}
      />
    </div>
  );
}

export function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 8,
          fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
      }}
    >
      <AntdApp>
        <MainApp />
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
