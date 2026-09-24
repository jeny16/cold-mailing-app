import { Job } from '../models/Job.js';
import { Contact } from '../models/Contact.js';
import { EmailLog } from '../models/EmailLog.js';
import { Setting } from '../models/Setting.js';
import { personalizeEmail } from '../services/personalization/templateEngine.js';
import { normalizeEmail, generateJobKey } from '../services/duplicate/duplicateDetector.js';

export async function getJobs(req, res) {
  try {
    const {
      page = 1,
      limit = 25,
      status,
      search,
      company,
      role,
      source,
      location,
      sortBy = 'importedAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (company) {
      query.company = { $regex: company, $options: 'i' };
    }

    if (role) {
      query.role = { $regex: role, $options: 'i' };
    }

    if (source) {
      query.source = { $regex: source, $options: 'i' };
    }

    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    if (search) {
      const s = search.trim();
      query.$or = [
        { company: { $regex: s, $options: 'i' } },
        { role: { $regex: s, $options: 'i' } },
        { hrEmail: { $regex: s, $options: 'i' } },
        { hrName: { $regex: s, $options: 'i' } },
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      jobs,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getJobById(req, res) {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const contact = await Contact.findOne({ email: job.normalizedHrEmail });
    const emailLogs = await EmailLog.find({ jobId: job._id }).sort({ queuedAt: -1 });

    res.json({
      success: true,
      job,
      contact,
      emailLogs,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateJob(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.hrEmail) {
      updates.normalizedHrEmail = normalizeEmail(updates.hrEmail);
    }
    if (updates.company || updates.role || updates.jobUrl) {
      const current = await Job.findById(id);
      const company = updates.company || current.company;
      const role = updates.role || current.role;
      const jobUrl = updates.jobUrl !== undefined ? updates.jobUrl : current.jobUrl;
      updates.normalizedJobKey = generateJobKey(company, role, jobUrl);
    }

    const updated = await Job.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    res.json({ success: true, job: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteJob(req, res) {
  try {
    const { id } = req.params;
    const deleted = await Job.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.json({ success: true, message: 'Job deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function approveJob(req, res) {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    job.status = 'APPROVED';
    job.approvedAt = new Date();
    await job.save();

    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function skipJob(req, res) {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    job.status = 'SKIPPED';
    await job.save();

    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function batchApprove(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Array of job ids is required' });
    }

    const result = await Job.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'APPROVED', approvedAt: new Date() } }
    );

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function batchSkip(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Array of job ids is required' });
    }

    const result = await Job.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'SKIPPED' } }
    );

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function batchDelete(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Array of job ids is required' });
    }

    const result = await Job.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function previewEmail(req, res) {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const settings = await Setting.getSettings();
    const rendered = personalizeEmail(job, settings);

    res.json({
      success: true,
      subject: rendered.subject,
      htmlBody: rendered.htmlBody,
      textBody: rendered.textBody,
      recipient: job.hrEmail,
      recipientName: job.hrName || 'Hiring Team',
      resumePath: settings.resumePath,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
  approveJob,
  skipJob,
  batchApprove,
  batchSkip,
  batchDelete,
  previewEmail,
};
