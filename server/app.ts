import express from 'express';
import { apiRouter } from './routes/api.routes';

const app = express();

// Global Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Netfyer Professional Backend Engine' });
});

// Mount modular API subsystem routes
app.use('/api', apiRouter);

export default app;
