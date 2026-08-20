import { Resend } from 'resend';

// Initialize Resend with your API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

export const sendVerificationEmail = async (email: string, code: string): Promise<void> => {
  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev', // See important note below regarding domains
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
    });
  } catch (error) {
    console.error('Error sending verification email via Resend:', error);
    throw new Error('Failed to send verification email.');
  }
};

export const sendPasswordResetEmail = async (email: string, resetLink: string): Promise<void> => {
  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev', // See important note below regarding domains
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
    });
  } catch (error) {
    console.error('Error sending password reset email via Resend:', error);
    throw new Error('Failed to send password reset email.');
  }
};