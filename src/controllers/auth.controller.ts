import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { supabase } from '../config/supabase';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.service';

// --- Unified Registration Endpoint ---
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Note: We now extract 'role' from the request body
    const { firstName, lastName, workEmail, staffId, password, confirmPassword, role } = req.body;

    if (!firstName || !lastName || !workEmail || !staffId || !password || !role) {
      res.status(400).json({ error: 'All fields, including role, are required.' });
      return;
    }

    // Validate role
    const validRoles = ['nurse', 'doctor', 'admin'];
    const assignedRole = role.toLowerCase().trim();
    if (!validRoles.includes(assignedRole)) {
      res.status(400).json({ error: 'Invalid role. Must be nurse, doctor, or admin.' });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate 6-digit OTP & 15-min Expiration
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000);

    const { data, error } = await supabase
      .from('staff')
      .insert([{
        first_name: firstName,
        last_name: lastName,
        work_email: workEmail.toLowerCase().trim(),
        staff_id: staffId.toUpperCase().trim(),
        password_hash: passwordHash,
        role: assignedRole,
        is_verified: false,
        verification_code: verificationCode,
        verification_expires: verificationExpires
      }])
      .select('id, work_email, role')
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        res.status(400).json({ error: 'Work email or Staff ID is already registered.' });
        return;
      }
      res.status(400).json({ error: error.message });
      return;
    }

    // Send Verification Email
    await sendVerificationEmail(data.work_email, verificationCode);

    res.status(201).json({
      message: `${assignedRole.toUpperCase()} registered successfully. Please verify your email with the 6-digit code sent.`,
      role: data.role,
      email: data.work_email
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
};

// --- Email Verification ---
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { workEmail, code } = req.body;

    const { data: user, error } = await supabase
      .from('staff')
      .select('*')
      .eq('work_email', workEmail.toLowerCase().trim())
      .single();

    if (error || !user) {
      res.status(404).json({ error: 'Staff account not found.' });
      return;
    }

    if (user.is_verified) {
      res.status(400).json({ error: 'Account is already verified. Please log in.' });
      return;
    }

    if (user.verification_code !== code || new Date() > new Date(user.verification_expires)) {
      res.status(400).json({ error: 'Invalid or expired verification code.' });
      return;
    }

    await supabase
      .from('staff')
      .update({
        is_verified: true,
        verification_code: null,
        verification_expires: null
      })
      .eq('id', user.id);

    res.status(200).json({ message: 'Account verified successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error during email verification.' });
  }
};

// --- Unified Login (Email OR Staff ID) ---
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, password } = req.body; // identifier = Email or Staff ID

    if (!identifier || !password) {
      res.status(400).json({ error: 'Identifier and password are required.' });
      return;
    }

    const cleanIdentifier = identifier.trim();
    const isEmail = cleanIdentifier.includes('@');
    const targetColumn = isEmail ? 'work_email' : 'staff_id';
    const queryValue = isEmail ? cleanIdentifier.toLowerCase() : cleanIdentifier.toUpperCase();

    const { data: user, error } = await supabase
      .from('staff')
      .select('*')
      .eq(targetColumn, queryValue)
      .single();

    if (error || !user) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    if (!user.is_verified) {
      res.status(403).json({ error: 'Account not verified. Please verify your email first.' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    // Generate JWT Token
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        staffId: user.staff_id,
        email: user.work_email,
        name: `${user.first_name} ${user.last_name}`
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '12h' } // 12-hour shift duration
    );

    // Return the specific JSON structure required by the frontend
    res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        workEmail: user.work_email,
        staffId: user.staff_id,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error during login.' });
  }
};

// --- Forgot Password ---
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { workEmail } = req.body;

    const { data: user } = await supabase
      .from('staff')
      .select('id')
      .eq('work_email', workEmail.toLowerCase().trim())
      .single();

    if (!user) {
      res.status(200).json({ message: 'A reset link has been sent to your email.' });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 30 * 60 * 1000); 

    await supabase
      .from('staff')
      .update({ reset_token: resetToken, reset_expires: resetExpires })
      .eq('id', user.id);

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${workEmail}`;
    await sendPasswordResetEmail(workEmail, resetLink);

    res.status(200).json({ message: 'A reset link has been sent to your email.' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// --- Reset Password ---
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { workEmail, token, newPassword } = req.body;

    const { data: user, error } = await supabase
      .from('staff')
      .select('id, reset_token, reset_expires')
      .eq('work_email', workEmail.toLowerCase().trim())
      .single();

    if (error || !user || user.reset_token !== token || new Date() > new Date(user.reset_expires)) {
      res.status(400).json({ error: 'Invalid or expired password reset token.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    await supabase
      .from('staff')
      .update({
        password_hash: newPasswordHash,
        reset_token: null,
        reset_expires: null
      })
      .eq('id', user.id);

    res.status(200).json({ message: 'Password has been updated successfully. Please log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};