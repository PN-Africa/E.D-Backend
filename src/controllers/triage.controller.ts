import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { supabase } from '../config/supabase';

// Severity label helper
const getSeverityLabel = (level: number | null): string => {
  switch (level) {
    case 1: return '1-Critical';
    case 2: return '2-Emergent';
    case 3: return '3-Urgent';
    case 4: return '4-Stable';
    default: return 'Unassigned';
  }
};

// --- RULE 2: VIEW TRIAGE QUEUE & STATS ---
export const getTriageQueue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 1. Fetch Waiting Patients (Status: WAITING_FOR_TRIAGE or IN_TRIAGE)
    const { data: queueData, error: queueError } = await supabase
      .from('ed_visits')
      .select(`
        id,
        arrival_time,
        chief_complaint,
        presenting_condition,
        status,
        patient:patients (
          id,
          patient_id,
          full_name,
          patient_description
        ),
        triage_assessments (
          id,
          severity_level,
          heart_rate,
          blood_pressure,
          spo2,
          temperature,
          respiratory_rate,
          pain_score
        )
      `)
      .in('status', ['WAITING_FOR_TRIAGE', 'IN_TRIAGE'])
      .order('arrival_time', { ascending: true });

    if (queueError) {
      res.status(400).json({ error: queueError.message });
      return;
    }

    // Process list to calculate waiting time
    const triageList = queueData.map(visit => {
      const arrival = new Date(visit.arrival_time).getTime();
      const now = new Date().getTime();
      const waitingMinutes = Math.floor((now - arrival) / (1000 * 60));

      const triage = Array.isArray(visit.triage_assessments) 
        ? visit.triage_assessments[0] 
        : visit.triage_assessments;

      // Extract single patient record safely
      const patient = Array.isArray(visit.patient) ? visit.patient[0] : visit.patient;

      return {
        visitId: visit.id,
        patientId: patient?.patient_id,
        patientName: patient?.full_name || patient?.patient_description || 'Unidentified Patient',
        arrivalTime: visit.arrival_time,
        waitingTimeFormatted: `${Math.floor(waitingMinutes / 60)}h ${waitingMinutes % 60}m`,
        waitingTimeMinutes: waitingMinutes,
        chiefComplaint: visit.chief_complaint || visit.presenting_condition,
        severityLevel: triage?.severity_level ? getSeverityLabel(triage.severity_level) : 'Pending Assessment',
        currentTriageDetails: triage || null
      };
    });

    // 2. Aggregate Stats
    // Waiting Triage Count
    const waitingCount = triageList.length;

    // Completed Triage Today Count
    const { count: completedCount, error: countError } = await supabase
      .from('triage_assessments')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());

    // Calculate Average Triage Wait Time Today (in minutes)
    const { data: completedTriages } = await supabase
      .from('triage_assessments')
      .select('created_at, ed_visits(arrival_time)')
      .gte('created_at', todayStart.toISOString());

    let averageTimeMinutes = 0;
    if (completedTriages && completedTriages.length > 0) {
      const totalWait = completedTriages.reduce((sum, item: any) => {
        const arrival = new Date(item.ed_visits.arrival_time).getTime();
        const triaged = new Date(item.created_at).getTime();
        return sum + (triaged - arrival);
      }, 0);
      averageTimeMinutes = Math.round((totalWait / completedTriages.length) / (1000 * 60));
    }

    res.status(200).json({
      stats: {
        waitingTriageCount: waitingCount,
        triageCompletedToday: completedCount || 0,
        triageAverageTime: `${averageTimeMinutes} mins`
      },
      triageList
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error fetching triage queue.' });
  }
};

// --- RULES 3 & 4: ADD OR EDIT TRIAGE DETAILS ---
export const saveOrUpdateTriage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { visitId } = req.params;
    const { 
      heartRate, bloodPressure, spo2, temperature, 
      respiratoryRate, painScore, severityLevel, triageNotes, reasonForChange 
    } = req.body;

    const nurseId = req.user?.id;

    if (!severityLevel || severityLevel < 1 || severityLevel > 4) {
      res.status(400).json({ error: 'Valid severity level (1-Critical, 2-Emergent, 3-Urgent, 4-Stable) is required.' });
      return;
    }

    // Check if visit exists
    const { data: visit, error: visitError } = await supabase
      .from('ed_visits')
      .select('id, status')
      .eq('id', visitId)
      .single();

    if (visitError || !visit) {
      res.status(404).json({ error: 'ED Visit record not found.' });
      return;
    }

    // Check if a triage record already exists for this visit
    const { data: existingTriage } = await supabase
      .from('triage_assessments')
      .select('*')
      .eq('visit_id', visitId)
      .single();

    let triageRecord;

    if (existingTriage) {
      // EDIT TRIAGE
      const previousSeverity = existingTriage.severity_level;

      const { data: updated, error: updateError } = await supabase
        .from('triage_assessments')
        .update({
          triaged_by: nurseId,
          heart_rate: heartRate,
          blood_pressure: bloodPressure,
          spo2,
          temperature,
          respiratory_rate: respiratoryRate,
          pain_score: painScore,
          severity_level: severityLevel,
          triage_notes: triageNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingTriage.id)
        .select('*')
        .single();

      if (updateError) {
        res.status(400).json({ error: updateError.message });
        return;
      }
      triageRecord = updated;

      // RULE 7: Log Priority Change if severity shifted
      if (previousSeverity !== severityLevel) {
        await supabase.from('priority_updates').insert([{
          visit_id: visitId,
          triage_id: existingTriage.id,
          changed_by: nurseId,
          previous_severity: previousSeverity,
          new_severity: severityLevel,
          reason_for_change: reasonForChange || 'Severity re-evaluated during triage update'
        }]);
      }
    } else {
      // CREATE TRIAGE
      const { data: created, error: createError } = await supabase
        .from('triage_assessments')
        .insert([{
          visit_id: visitId,
          triaged_by: nurseId,
          heart_rate: heartRate,
          blood_pressure: bloodPressure,
          spo2,
          temperature,
          respiratory_rate: respiratoryRate,
          pain_score: painScore,
          severity_level: severityLevel,
          triage_notes: triageNotes
        }])
        .select('*')
        .single();

      if (createError) {
        res.status(400).json({ error: createError.message });
        return;
      }
      triageRecord = created;
    }

    // Update ED Visit status to WAITING_FOR_DOCTOR upon triage completion
    await supabase
      .from('ed_visits')
      .update({ status: 'WAITING_FOR_DOCTOR', updated_at: new Date().toISOString() })
      .eq('id', visitId);

    res.status(200).json({
      message: 'Triage details saved successfully.',
      triage: triageRecord
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error saving triage details.' });
  }
};

// --- RULES 5 & 6: VIEW & SEARCH TRIAGE HISTORY ---
export const getTriageHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { query, date } = req.query;

    let dbQuery = supabase
      .from('triage_assessments')
      .select(`
        id,
        created_at,
        severity_level,
        heart_rate,
        blood_pressure,
        spo2,
        temperature,
        respiratory_rate,
        pain_score,
        triage_notes,
        nurse:staff (
          id,
          first_name,
          last_name,
          staff_id
        ),
        visit:ed_visits (
          id,
          arrival_time,
          status,
          patient:patients (
            id,
            patient_id,
            full_name,
            date_of_birth,
            patient_description
          )
        )
      `)
      .order('created_at', { ascending: false });

    // Date filtering (YYYY-MM-DD)
    if (date && typeof date === 'string') {
      const startDate = `${date}T00:00:00.000Z`;
      const endDate = `${date}T23:59:59.999Z`;
      dbQuery = dbQuery.gte('created_at', startDate).lte('created_at', endDate);
    }

    const { data: history, error } = await dbQuery;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Client-side text filter for joined fields (Name / MRN)
    let filteredResults = history || [];

    if (query && typeof query === 'string') {
      const q = query.toLowerCase();
      filteredResults = filteredResults.filter((item: any) => {
        const patient = item.visit?.patient;
        const name = patient?.full_name?.toLowerCase() || '';
        const mrn = patient?.patient_id?.toLowerCase() || '';
        return name.includes(q) || mrn.includes(q);
      });
    }

    // Format output
    const formattedHistory = filteredResults.map((item: any) => {
      const patient = item.visit?.patient;
      const nurse = item.nurse;

      return {
        triageId: item.id,
        visitId: item.visit?.id,
        patientName: patient?.full_name || patient?.patient_description || 'Unidentified Patient',
        patientId: patient?.patient_id,
        triagedBy: nurse ? `Nurse ${nurse.first_name} ${nurse.last_name} (${nurse.staff_id})` : 'Unknown Staff',
        triageTime: item.created_at,
        severity: getSeverityLabel(item.severity_level),
        vitalSummary: `HR: ${item.heart_rate || '--'} bpm, BP: ${item.blood_pressure || '--'}, SpO2: ${item.spo2 || '--'}%, Temp: ${item.temperature || '--'}°F, RR: ${item.respiratory_rate || '--'}, Pain: ${item.pain_score ?? '--'}/10`,
        fullDetails: {
          vitals: {
            heartRate: item.heart_rate,
            bloodPressure: item.blood_pressure,
            spo2: item.spo2,
            temperature: item.temperature,
            respiratoryRate: item.respiratory_rate,
            painScore: item.pain_score
          },
          notes: item.triage_notes
        }
      };
    });

    res.status(200).json({ count: formattedHistory.length, history: formattedHistory });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error fetching triage history.' });
  }
};

// --- RULE 7: VIEW PRIORITY UPDATES (AUDIT TRAIL) ---
export const getPriorityUpdates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: updates, error } = await supabase
      .from('priority_updates')
      .select(`
        id,
        previous_severity,
        new_severity,
        reason_for_change,
        created_at,
        nurse:staff (
          first_name,
          last_name,
          staff_id
        ),
        visit:ed_visits (
          patient:patients (
            patient_id,
            full_name,
            patient_description
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    const formattedUpdates = updates.map((item: any) => {
      const patient = item.visit?.patient;
      const nurse = item.nurse;

      const prevLabel = getSeverityLabel(item.previous_severity);
      const newLabel = getSeverityLabel(item.new_severity);

      return {
        id: item.id,
        patientName: patient?.full_name || patient?.patient_description || 'Unidentified Patient',
        patientId: patient?.patient_id,
        reasonForChange: item.reason_for_change,
        time: item.created_at,
        statusTransition: `${prevLabel} ➔ ${newLabel}`,
        changedBy: nurse ? `${nurse.first_name} ${nurse.last_name} (${nurse.staff_id})` : 'System'
      };
    });

    res.status(200).json({ priorityUpdates: formattedUpdates });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error fetching priority updates.' });
  }
};