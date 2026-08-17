import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { supabase } from '../config/supabase';

// Helper to calculate time waiting
const calculateTimeWaited = (startTime: string): string => {
  const start = new Date(startTime).getTime();
  const now = new Date().getTime();
  const minutes = Math.floor((now - start) / (1000 * 60));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

// --- RULES 2, 3, 4, 6, 7: DYNAMIC QUEUE ROUTING ---
export const getPatientQueue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query; // 'waiting_triage', 'waiting_doctor', 'in_treatment', 'discharged_ready'
    
    let dbStatusFilter: string[] = [];
    
    switch (status) {
      case 'waiting_triage':
        dbStatusFilter = ['WAITING_FOR_TRIAGE'];
        break;
      case 'waiting_doctor':
        dbStatusFilter = ['WAITING_FOR_DOCTOR'];
        break;
      case 'in_treatment':
        dbStatusFilter = ['IN_TREATMENT'];
        break;
      case 'discharged_ready':
        dbStatusFilter = ['READY_FOR_DISCHARGE'];
        break;
      default:
        // Default view: all active non-discharged patients
        dbStatusFilter = ['WAITING_FOR_TRIAGE', 'IN_TRIAGE', 'WAITING_FOR_DOCTOR', 'IN_TREATMENT', 'OBSERVATION', 'READY_FOR_DISCHARGE'];
    }

    const { data: visits, error } = await supabase
      .from('ed_visits')
      .select(`
        id,
        status,
        arrival_time,
        chief_complaint,
        arrival_mode,
        ready_for_discharge_at,
        patient:patients (id, patient_id, full_name),
        triage:triage_assessments (severity_level),
        doctor:staff!assigned_doctor_id (first_name, last_name)
      `)
      .in('status', dbStatusFilter)
      .order('arrival_time', { ascending: true });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Map the raw DB data to the specific fields required by the frontend
    const formattedQueue = visits.map((visit: any) => {
      const patientData = Array.isArray(visit.patient) ? visit.patient[0] : visit.patient;
      const triageData = Array.isArray(visit.triage) ? visit.triage[0] : visit.triage;
      const doctorData = visit.doctor;

      const baseData = {
        visitId: visit.id,
        patientName: patientData?.full_name || 'Unknown',
        patientId: patientData?.patient_id || '--',
        complaint: visit.chief_complaint || 'Not specified',
        status: visit.status,
      };

      // Format based on the requested queue
      if (status === 'waiting_triage') {
        return {
          ...baseData,
          arrivalMode: visit.arrival_mode,
          timeWaiting: calculateTimeWaited(visit.arrival_time),
          triageStatus: triageData ? 'Triaged' : 'Not Triaged'
        };
      } 
      
      if (status === 'discharged_ready') {
        return {
          ...baseData,
          doctorInCharge: doctorData ? `Dr. ${doctorData.last_name}` : 'Unassigned',
          readySince: visit.ready_for_discharge_at ? calculateTimeWaited(visit.ready_for_discharge_at) : '--',
          dischargeStatus: 'Ready'
        };
      }

      // Default for waiting_doctor, in_treatment, and general overview
      return {
        ...baseData,
        priority: triageData?.severity_level ? `Level ${triageData.severity_level}` : 'Pending',
        timeWaited: calculateTimeWaited(visit.arrival_time),
        doctorInCharge: doctorData ? `Dr. ${doctorData.last_name}` : 'Unassigned'
      };
    });

    res.status(200).json({ queue: formattedQueue });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error fetching queue.' });
  }
};

// --- RULE 5: ASSIGNED TO ME ---
export const getAssignedPatients = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const nurseId = req.user?.id;

    const { data: visits, error } = await supabase
      .from('ed_visits')
      .select(`
        id,
        status,
        arrival_time,
        chief_complaint,
        patient:patients (id, patient_id, full_name),
        triage:triage_assessments (severity_level)
      `)
      .eq('assigned_nurse_id', nurseId)
      .not('status', 'eq', 'DISCHARGED'); // Exclude fully completed visits

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    const assignedList = visits.map((visit: any) => {
      const patientData = Array.isArray(visit.patient) ? visit.patient[0] : visit.patient;
      const triageData = Array.isArray(visit.triage) ? visit.triage[0] : visit.triage;

      return {
        visitId: visit.id,
        patientName: patientData?.full_name || 'Unknown',
        patientId: patientData?.patient_id || '--',
        complaint: visit.chief_complaint,
        priority: triageData?.severity_level ? `Level ${triageData.severity_level}` : 'Pending',
        timeWaited: calculateTimeWaited(visit.arrival_time),
        status: visit.status
      };
    });

    res.status(200).json({ assignedPatients: assignedList });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error fetching assigned patients.' });
  }
};