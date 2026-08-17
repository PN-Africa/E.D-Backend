import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { supabase } from '../config/supabase';

// --- RULE 3: VIEW PROFILE DETAILS ---
export const getMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const staffId = req.user?.id; // Extracted securely from JWT

    const { data: profile, error } = await supabase
      .from('staff')
      .select(`
        first_name,
        last_name,
        email,
        staff_id,
        role,
        credentials,
        phone_number,
        department,
        assigned_floor,
        created_at
      `)
      .eq('id', staffId)
      .single();

    if (error || !profile) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }

    res.status(200).json({
      profile: {
        fullName: `${profile.first_name} ${profile.last_name}`,
        firstName: profile.first_name,
        lastName: profile.last_name,
        workEmail: profile.email,
        staffId: profile.staff_id,
        role: profile.role,
        credentials: profile.credentials || '',
        phoneNumber: profile.phone_number || '',
        department: profile.department || 'Emergency',
        assignedFloor: profile.assigned_floor || ''
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error fetching profile.' });
  }
};

// --- RULE 3: EDIT AND SAVE PROFILE DETAILS ---
export const updateMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const staffId = req.user?.id;
    
    // Extract editable fields from the request body
    const { 
      firstName, 
      lastName, 
      credentials, 
      phoneNumber, 
      department, 
      assignedFloor 
    } = req.body;

    // Note: Work Email and Staff ID are typically locked by HR/Admin and omitted from self-editing.
    // If you want them to edit their email, you would need to handle Supabase Auth email change logic as well.

    const { data: updatedProfile, error } = await supabase
      .from('staff')
      .update({
        first_name: firstName,
        last_name: lastName,
        credentials: credentials,
        phone_number: phoneNumber,
        department: department,
        assigned_floor: assignedFloor,
        updated_at: new Date().toISOString()
      })
      .eq('id', staffId)
      .select(`
        first_name,
        last_name,
        email,
        credentials,
        phone_number,
        department,
        assigned_floor
      `)
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(200).json({
      message: 'Profile updated successfully.',
      profile: {
        fullName: `${updatedProfile.first_name} ${updatedProfile.last_name}`,
        firstName: updatedProfile.first_name,
        lastName: updatedProfile.last_name,
        workEmail: updatedProfile.email,
        credentials: updatedProfile.credentials,
        phoneNumber: updatedProfile.phone_number,
        department: updatedProfile.department,
        assignedFloor: updatedProfile.assigned_floor
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error updating profile.' });
  }
};