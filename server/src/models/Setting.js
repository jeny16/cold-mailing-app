import mongoose from 'mongoose';

const DEFAULT_SUBJECT_TEMPLATE = 'Application for {{role}} – {{company}}';

const DEFAULT_BODY_TEMPLATE = `Dear {{hrNameOrHiringTeam}},

I am writing to express my interest in the {{role}} position at {{company}}.

I have experience working with React.js, Node.js, Express.js, MongoDB, REST APIs and modern web development technologies. I would be glad to discuss how my experience could contribute to your team.

I have attached my resume for your consideration.

Thank you for your time.

Best regards,
{{senderName}}`;

const SettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'global_settings',
      unique: true,
    },
    senderName: {
      type: String,
      default: () => process.env.SENDER_NAME || 'Jeny Pansuriya',
    },
    senderEmail: {
      type: String,
      default: () => process.env.SENDER_EMAIL || 'jeny.pansuriya@example.com',
    },
    senderPhone: {
      type: String,
      default: () => process.env.SENDER_PHONE || '+91 9876543210',
    },
    portfolioUrl: {
      type: String,
      default: () => process.env.PORTFOLIO_URL || 'https://jenypansuriya.dev',
    },
    githubUrl: {
      type: String,
      default: () => process.env.GITHUB_URL || 'https://github.com/jenypansuriya',
    },
    resumePath: {
      type: String,
      default: () => process.env.RESUME_PATH || 'attachments/Jeny_Pansuriya_Resume.pdf',
    },
    emailSubjectTemplate: {
      type: String,
      default: DEFAULT_SUBJECT_TEMPLATE,
    },
    emailBodyTemplate: {
      type: String,
      default: DEFAULT_BODY_TEMPLATE,
    },
    dailyLimit: {
      type: Number,
      default: () => parseInt(process.env.DAILY_EMAIL_LIMIT, 10) || 50,
    },
    minDelaySeconds: {
      type: Number,
      default: () => parseInt(process.env.MIN_DELAY_SECONDS, 10) || 5,
    },
    maxDelaySeconds: {
      type: Number,
      default: () => parseInt(process.env.MAX_DELAY_SECONDS, 10) || 15,
    },
    maxEmailsPerRun: {
      type: Number,
      default: () => parseInt(process.env.MAX_EMAILS_PER_RUN, 10) || 25,
    },
    dryRun: {
      type: Boolean,
      default: () => (process.env.DRY_RUN !== undefined ? process.env.DRY_RUN === 'true' : true),
    },
  },
  {
    timestamps: true,
  }
);

SettingSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ key: 'global_settings' });
  if (!settings) {
    settings = await this.create({ key: 'global_settings' });
  }
  return settings;
};

export const Setting = mongoose.models.Setting || mongoose.model('Setting', SettingSchema);
export default Setting;
