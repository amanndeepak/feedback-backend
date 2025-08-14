// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();

// Allow JSON up to ~20 MB for base64 payloads
app.use(express.json({ limit: '20mb' }));
// Allow your front-end origin during development
// app.use((req, res, next) => {
//   res.header('Access-Control-Allow-Origin', '*'); // Allow all origins (replace '*' with specific domains in production)
//   res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//   res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

//   // Handle preflight requests (for complex requests like DELETE/PUT with headers)
//   if (req.method === 'OPTIONS') {
//     return res.sendStatus(200);
//   }
//   next();
// });
 app.use(cors('*'));



// Read env
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  FROM_EMAIL,
  FROM_NAME,
  DEFAULT_TO_EMAIL,
  PORT
} = process.env;

// Create reusable transporter for Gmail SMTP
function createTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.gmail.com',
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465, // true for 465, false for 587
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

// Health check
app.get('/', (_req, res) => {
  res.json({ ok: true, msg: 'Mailer API is running' });
});

/**
 * POST /api/submit-feedback
 * Body: {
 *   formData: {...},                             // optional, any JSON
 *   pdf: { filename: "ParentFeedback_X.pdf", base64: "<...>" },  // required
 *   to: "recipient@gmail.com"                    // optional; defaults to DEFAULT_TO_EMAIL
 * }
 */
app.post('/api/submit-feedback', async (req, res) => {
  try {
    const { formData, pdf, to } = req.body || {};

    if (!pdf || !pdf.base64 || !pdf.filename) {
      return res.status(400).json({ message: 'pdf.base64 and pdf.filename are required' });
    }

    const recipient = (to && String(to).trim()) || DEFAULT_TO_EMAIL || FROM_EMAIL;
    if (!recipient) {
      return res.status(400).json({ message: 'No recipient email specified' });
    }

    const subject = `Parent Feedback - ${formData?.parentName || 'Anonymous'}`;
    const html = `
      <p>Hello,</p>
      <p>Please find attached the Parent Feedback submission.</p>
      ${formData ? `
        <ul>
          <li><strong>Parent:</strong> ${formData.parentName || '-'}</li>
          <li><strong>Child:</strong> ${formData.childName || '-'}</li>
          <li><strong>Submitted:</strong> ${new Date().toLocaleString()}</li>
        </ul>
      ` : ''}
      <p>Regards,<br/>${FROM_NAME || 'Feedback Bot'}</p>
    `;

    const transporter = createTransporter();

    const info = await transporter.sendMail({
      from: { name: FROM_NAME || 'Feedback Bot', address: FROM_EMAIL },
      to: recipient,
      subject,
      html,
      attachments: [
        {
          filename: pdf.filename.endsWith('.pdf') ? pdf.filename : `${pdf.filename}.pdf`,
          content: Buffer.from(pdf.base64, 'base64'),
          contentType: 'application/pdf'
        }
      ]
    });

    return res.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ message: 'Failed to email PDF' });
  }
});

const listenPort = Number(PORT || 3000);
app.listen(listenPort, () => {

  console.log(`Mailer APi listening on http://localhost:${listenPort}`);
});
