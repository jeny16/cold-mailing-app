import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const StatsAPI = {
  getStats: () => api.get('/stats').then((res) => res.data),
};

export const JobsAPI = {
  getJobs: (params) => api.get('/jobs', { params }).then((res) => res.data),
  getJobById: (id) => api.get(`/jobs/${id}`).then((res) => res.data),
  createJob: (data) => api.post('/jobs', data).then((res) => res.data),
  updateJob: (id, data) => api.patch(`/jobs/${id}`, data).then((res) => res.data),
  deleteJob: (id) => api.delete(`/jobs/${id}`).then((res) => res.data),
  sendSingleEmail: (id) => api.post(`/jobs/${id}/send-email`).then((res) => res.data),
  copyWhatsApp: (id) => api.post(`/jobs/${id}/whatsapp-copy`).then((res) => res.data),
  markWhatsAppSent: (id, data = {}) => api.post(`/jobs/${id}/whatsapp-send`, data).then((res) => res.data),
  scheduleFollowUp: (id, data) => api.post(`/jobs/${id}/follow-up`, data).then((res) => res.data),
  addActivity: (id, data) => api.post(`/jobs/${id}/activity`, data).then((res) => res.data),
  updateStatus: (id, status, notes = '') => api.patch(`/jobs/${id}/status`, { status, notes }).then((res) => res.data),
  approveJob: (id) => api.post(`/jobs/${id}/approve`).then((res) => res.data),
  skipJob: (id) => api.post(`/jobs/${id}/skip`).then((res) => res.data),
  batchApprove: (ids) => api.post('/jobs/batch-approve', { ids }).then((res) => res.data),
  batchSkip: (ids) => api.post('/jobs/batch-skip', { ids }).then((res) => res.data),
  batchDelete: (ids) => api.post('/jobs/batch-delete', { ids }).then((res) => res.data),
  previewEmail: (id) => api.get(`/jobs/${id}/preview-email`).then((res) => res.data),
};

export const QueueAPI = {
  getStatus: () => api.get('/queue').then((res) => res.data),
  startQueue: () => api.post('/queue/start').then((res) => res.data),
  pauseQueue: () => api.post('/queue/pause').then((res) => res.data),
  retryJob: (jobId) => api.post(`/queue/retry/${jobId}`).then((res) => res.data),
  retryAll: () => api.post('/queue/retry-all').then((res) => res.data),
};

export const EmailsAPI = {
  getEmails: (params) => api.get('/emails', { params }).then((res) => res.data),
  getEmailById: (id) => api.get(`/emails/${id}`).then((res) => res.data),
  sendTestEmail: (data) => api.post('/emails/test', data).then((res) => res.data),
};

export const SettingsAPI = {
  getSettings: () => api.get('/settings').then((res) => res.data),
  updateSettings: (data) => api.patch('/settings', data).then((res) => res.data),
  uploadResume: (formData) =>
    api
      .post('/settings/resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data),
};

export const ImportAPI = {
  uploadFile: (formData) =>
    api
      .post('/imports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data),
  directImport: (data) => api.post('/imports/direct', data).then((res) => res.data),
  getImports: (params) => api.get('/imports', { params }).then((res) => res.data),
};

export default api;
