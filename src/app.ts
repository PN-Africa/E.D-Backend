// src/app.ts
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// Auth Endpoints Base Route
app.use('/api/v1/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 5010;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

export default app;