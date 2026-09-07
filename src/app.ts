import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import patientRoutes from './routes/patient.routes'; 
import triageRoutes from './routes/triage.routes';
import queueRoutes from './routes/queue.routes';
import bedRoutes from './routes/bed.routes';
import recordRoutes from './routes/record.routes';
import notificationRoutes from './routes/notification.routes';
import profileRoutes from './routes/profile.routes';

dotenv.config();

const app = express();

const corsOptions = {
  origin: ['http://localhost:5173', 'https://localhost:5173', 'https://ed-workflow-app.vercel.app'], 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200 
};

app.use(cors(corsOptions));

app.options(/.*/, cors(corsOptions));

app.use(express.json());

// Health check
app.get('/', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }));


// Auth Endpoints Base Route
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/triage', triageRoutes);
app.use('/api/v1/queue', queueRoutes);
app.use('/api/v1/beds', bedRoutes);
app.use('/api/v1/patients-records', recordRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/profile', profileRoutes);


// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 5010;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

export default app;