import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { supabase } from '../config/supabase';

// --- RULE 2: NEW PATIENT REGISTRATION (FULL INTAKE) ---
export const registerNewPatient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { 
      fullName, dateOfBirth, phoneNumber, emergencyContactName, 
      emergencyContactPhone, patientId, chiefComplaint, arrivalMode, arrivalTime 
    } = req.body;

    const nurseId = req.user?.id; // Extracted from Auth Token

    // 1. Create the Patient Record
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .insert([{
        patient_id: patientId,
        full_name: fullName,
        date_of_birth: dateOfBirth,
        phone_number: phoneNumber,
        emergency_contact_name: emergencyContactName,
        emergency_contact_phone: emergencyContactPhone,
        is_quick_registration: false
      }])
      .select('id')
      .single();

    if (patientError) {
      res.status(400).json({ error: patientError.message });
      return;
    }

    // 2. Create the ED Visit Record
    const { data: visit, error: visitError } = await supabase
      .from('ed_visits')
      .insert([{
        patient_id: patient.id,
        registered_by: nurseId,
        chief_complaint: chiefComplaint,
        arrival_mode: arrivalMode,
        arrival_time: arrivalTime,
        status: 'WAITING_FOR_TRIAGE'
      }])
      .select('*')
      .single();

    if (visitError) {
      res.status(400).json({ error: visitError.message });
      return;
    }

    res.status(201).json({ message: 'Patient fully registered and added to triage queue.', visit });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error during full registration.' });
  }
};

// --- RULE 4: EMERGENCY QUICK REGISTRATION ---
export const quickEmergencyRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { patientDescription, arrivalTime, presentingCondition, arrivalMode, bedBayAssignment } = req.body;
    const nurseId = req.user?.id;

    // Generate a temporary ID for quick reg (e.g., EMG-169123456)
    const tempPatientId = `EMG-${Date.now().toString().slice(-6)}`;

    // 1. Create a minimal patient profile
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .insert([{
        patient_id: tempPatientId,
        patient_description: patientDescription,
        is_quick_registration: true
      }])
      .select('id, patient_id')
      .single();

    if (patientError) {
      res.status(400).json({ error: patientError.message });
      return;
    }

    // 2. Log the critical ED visit
    const { data: visit, error: visitError } = await supabase
      .from('ed_visits')
      .insert([{
        patient_id: patient.id,
        registered_by: nurseId,
        presenting_condition: presentingCondition,
        arrival_mode: arrivalMode,
        bed_bay_assignment: bedBayAssignment,
        arrival_time: arrivalTime,
        status: 'WAITING_FOR_DOCTOR' // Often bypasses standard triage
      }])
      .select('*')
      .single();

    if (visitError) {
      res.status(400).json({ error: visitError.message });
      return;
    }

    res.status(201).json({ 
      message: 'Emergency quick registration complete.', 
      patientId: patient.patient_id,
      visit 
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error during emergency registration.' });
  }
};

// --- RULE 3: SEARCH EXISTING PATIENTS ---
export const searchPatients = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { query } = req.query; // Search string (Name, DOB, or ID)

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Search query is required.' });
      return;
    }

    const searchQuery = `%${query}%`;

   // Regex to check if the user is searching for a date in YYYY-MM-DD format
    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(query);

    // Build the OR condition dynamically
    let orCondition = `full_name.ilike.${searchQuery},patient_id.ilike.${searchQuery}`;
    
    // Only query the date_of_birth column if the input is actually a date
    if (isDate) {
      orCondition += `,date_of_birth.eq.${query}`;
    }

    const { data: patients, error } = await supabase
      .from('patients')
      .select('id, patient_id, full_name, date_of_birth, phone_number, is_quick_registration')
      .or(orCondition);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(200).json({ results: patients });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error during patient search.' });
  }
};
// --- GET PATIENT DETAILS (View Result) ---
export const getPatientDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // UUID of the patient

    const { data: patient, error } = await supabase
      .from('patients')
      .select(`
        *,
        ed_visits (
          id,
          chief_complaint,
          presenting_condition,
          arrival_time,
          status,
          bed_bay_assignment
        )
      `)
      .eq('id', id)
      .single();

    if (error || !patient) {
      res.status(404).json({ error: 'Patient not found.' });
      return;
    }

    res.status(200).json({ patient });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error fetching patient details.' });
  }
};