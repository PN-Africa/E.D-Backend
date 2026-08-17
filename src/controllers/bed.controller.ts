import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { supabase } from '../config/supabase';

// --- RULE 8: BED METRICS & MAP ---
export const getBedDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Fetch all beds with joined patient data if occupied
    const { data: beds, error } = await supabase
      .from('beds')
      .select(`
        id,
        bay_number,
        status,
        visit:ed_visits (
          patient:patients (
            full_name,
            patient_id
          )
        )
      `)
      .order('bay_number', { ascending: true });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // A. Capacity Metrics Calculations
    const totalBeds = beds.length;
    let availableCount = 0;
    let occupiedCount = 0;
    let cleaningCount = 0;

    // B. Map formatting
    const bedMap = beds.map((bed: any) => {
      if (bed.status === 'AVAILABLE') availableCount++;
      if (bed.status === 'OCCUPIED') occupiedCount++;
      if (bed.status === 'CLEANING') cleaningCount++;

      // Extract nested patient details safely
      const visitData = bed.visit ? (Array.isArray(bed.visit) ? bed.visit[0] : bed.visit) : null;
      const patientData = visitData?.patient ? (Array.isArray(visitData.patient) ? visitData.patient[0] : visitData.patient) : null;

      return {
        bedId: bed.id,
        location: bed.bay_number,
        currentStatus: bed.status,
        occupant: bed.status === 'OCCUPIED' && patientData 
          ? `${patientData.full_name} (${patientData.patient_id})` 
          : null
      };
    });

    const occupiedPercentage = totalBeds > 0 ? Math.round((occupiedCount / totalBeds) * 100) : 0;

    res.status(200).json({
      metrics: {
        availableBeds: availableCount,
        occupiedBeds: `${occupiedCount} / ${occupiedPercentage}%`,
        cleaningTurnover: cleaningCount,
        totalCapacity: totalBeds
      },
      bedMap
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error fetching bed dashboard.' });
  }
};