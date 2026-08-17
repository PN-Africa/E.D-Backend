import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { supabase } from '../config/supabase';

// --- RULE 2: VIEW NOTIFICATIONS BY CATEGORY ---
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category } = req.query; // e.g., 'high_priority', 'assignment', 'status', 'queue'

    let dbCategoryFilter = null;

    // Map the frontend button clicks to the Database ENUM
    switch (category) {
      case 'high_priority':
        dbCategoryFilter = 'HIGH_PRIORITY';
        break;
      case 'assignment':
        dbCategoryFilter = 'DOCTOR_ASSIGNMENT';
        break;
      case 'status':
        dbCategoryFilter = 'STATUS_UPDATE';
        break;
      case 'queue':
        dbCategoryFilter = 'QUEUE_CHANGE';
        break;
      default:
        // If no specific button is clicked, return all notifications
        dbCategoryFilter = null;
    }

    // Build the query
    let query = supabase
      .from('notifications')
      .select(`
        id,
        category,
        message,
        is_read,
        created_at,
        visit:ed_visits (
          id,
          patient:patients (
            full_name,
            patient_id
          )
        )
      `)
      .order('created_at', { ascending: false });

    // Apply the filter if a specific button was clicked
    if (dbCategoryFilter) {
      query = query.eq('category', dbCategoryFilter);
    }

    const { data: notifications, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Format the response for the frontend
    const formattedNotifications = notifications.map((notif: any) => {
      // Safely extract patient details if linked
      const visitData = notif.visit ? (Array.isArray(notif.visit) ? notif.visit[0] : notif.visit) : null;
      const patientData = visitData?.patient ? (Array.isArray(visitData.patient) ? visitData.patient[0] : visitData.patient) : null;

      return {
        notificationId: notif.id,
        category: notif.category,
        message: notif.message,
        isRead: notif.is_read,
        time: notif.created_at,
        relatedPatient: patientData ? `${patientData.full_name} (${patientData.patient_id})` : null,
        visitId: visitData?.id || null
      };
    });

    res.status(200).json({
      count: formattedNotifications.length,
      notifications: formattedNotifications
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error fetching notifications.' });
  }
};