import express from 'express';
import cors from 'cors';
import incidentsRouter from './routes/incidents.js';
import dashboardRouter from './routes/dashboard.js';
import intelligenceRouter from './routes/intelligence.js';

const app = express();

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: clientUrl,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'incident-intelligence-api', ts: new Date().toISOString() });
});

app.get('/api', (req, res) => {
  res.json({ name: 'Incident Intelligence API', version: '1.0.0' });
});

app.use('/api/incidents', incidentsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/intelligence', intelligenceRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

/**
 * Centralized error handler — keeps route handlers thin
 */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.name === 'CastError' || err.name === 'BSONError') {
    return res.status(400).json({ error: 'Invalid id' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message || 'Validation failed' });
  }
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({ error: message });
});

export default app;
