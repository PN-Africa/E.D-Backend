import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { supabase } from '../config/supabase';

// Helper to calculate age from DOB
const calculateAge = (dob: string | null): string => {
  if (!dob) return 'Unknown';
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return `${age} yrs`;
};

// Helper for Severity Labels
const getSeverityLabel = (level: number | null): string => {
  switch (level) {
    case 1: return '1-Critical';
    case 2: return '2-Emergent';
    case 3: return '3-Urgent';
    case 4: return '4-Stable';
    default: return 'Unassigned';
  }
};

// --- RULE 2: VIEW ALL PATIENTS LIST ---
export const getAllPatientRecords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: patients, error } = await supabase
      .from('patients')
      .select(`
        id, 
        patient_id, 
        full_name, 
        date_of_birth, 
        sex, 
        blood_type,
        created_at
      `)
      .order('full_name', { ascending: true });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    const formattedRecords = patients.map((patient: any) => ({
      id: patient.id,
      patientId: patient.patient_id,
      name: patient.full_name || 'Unidentified Patient',
      dob: patient.date_of_birth || '--',
      age: calculateAge(patient.date_of_birth),
      sex: patient.sex || '--',
      bloodType: patient.blood_type || '--',
      registeredOn: patient.created_at
    }));

    res.status(200).json({ records: formattedRecords });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error fetching patient records.' });
  }
};

// --- RULES 3 & 4: VIEW COMPREHENSIVE PATIENT DETAILS & TABS ---
export const getPatientRecordDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // Patient UUID

    // Fetch Patient along with all their past visits and triage assessments
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
          doctors_note,
          doctor:staff!assigned_doctor_id(first_name, last_name),
          triage:triage_assessments (
            id,
            severity_level,
            heart_rate,
            blood_pressure,
            spo2,
            temperature,
            respiratory_rate,
            pain_score,
            triage_notes,
            created_at
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error || !patient) {
      res.status(404).json({ error: 'Patient record not found.' });
      return;
    }

    // Determine current/latest priority (from their most recent ED visit)
    // Supabase arrays aren't strictly ordered in joins unless specified, so we sort in JS
    const sortedVisits = Array.isArray(patient.ed_visits) 
      ? patient.ed_visits.sort((a: any, b: any) => new Date(b.arrival_time).getTime() - new Date(a.arrival_time).getTime())
      : [];

    const latestVisit = sortedVisits[0];
    const latestTriage = latestVisit?.triage ? (Array.isArray(latestVisit.triage) ? latestVisit.triage[0] : latestVisit.triage) : null;
    const currentPriority = latestTriage?.severity_level ? getSeverityLabel(latestTriage.severity_level) : 'None';

    // Format the response to easily map to Frontend Buttons/Tabs
    const masterRecord = {
      // Top Level Profile Summary
      header: {
        name: patient.full_name || patient.patient_description,
        patientId: patient.patient_id,
        dob: patient.date_of_birth,
        age: calculateAge(patient.date_of_birth),
        sex: patient.sex || '--',
        bloodType: patient.blood_type || '--',
        currentPriority: currentPriority
      },
      // Tab 1: Profile & Contact
      profile: {
        phoneNumber: patient.phone_number,
        emergencyContactName: patient.emergency_contact_name,
        emergencyContactPhone: patient.emergency_contact_phone,
        isQuickRegistration: patient.is_quick_registration
      },
      // Tab 2: Medical History
      medicalHistory: patient.medical_history || 'No medical history recorded.',
      // Tab 3, 4, 5, 6: Extracted from Visit History
      visits: sortedVisits.map((visit: any) => {
        const triageData = Array.isArray(visit.triage) ? visit.triage[0] : visit.triage;
        return {
          visitId: visit.id,
          date: visit.arrival_time,
          status: visit.status,
          complaint: visit.chief_complaint || visit.presenting_condition,
          // Treatment History & Doctors Notes
          treatment: {
            doctorInCharge: visit.doctor ? `Dr. ${visit.doctor.last_name}` : 'Unassigned',
            doctorsNote: visit.doctors_note || 'No notes available.'
          },
          // Triage Assessment & Vital Signs
          triage: triageData ? {
            time: triageData.created_at,
            severity: getSeverityLabel(triageData.severity_level),
            notes: triageData.triage_notes,
            vitals: {
              heartRate: triageData.heart_rate,
              bloodPressure: triageData.blood_pressure,
              spo2: triageData.spo2,
              temperature: triageData.temperature,
              respiratoryRate: triageData.respiratory_rate,
              painScore: triageData.pain_score
            }
          } : null
        };
      })
    };

    res.status(200).json(masterRecord);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error fetching patient details.' });
  }
};