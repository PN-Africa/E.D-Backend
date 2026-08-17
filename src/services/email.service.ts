import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendVerificationEmail = async (email: string, code: string): Promise<void> => {
  const mailOptions = {
    from: '"ED.APP Security" <no-reply@edapp.com>',
    to: email,
    subject: 'ED.APP - Verify Your Account',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Welcome to ED.APP</h2>
        <p>Your 6-digit verification code is:</p>
        <h1 style="color: #2563eb; letter-spacing: 4px;">${code}</h1>
        <p>This code will expire in <strong>15 minutes</strong>.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

export const sendPasswordResetEmail = async (email: string, resetLink: string): Promise<void> => {
  const mailOptions = {
    from: '"ED.APP Security" <no-reply@edapp.com>',
    to: email,
    subject: 'ED.APP - Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your ED.APP staff account password:</p>
        <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 10px 18px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        <p style="margin-top: 15px;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};