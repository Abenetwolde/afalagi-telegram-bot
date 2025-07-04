import express from 'express';
import { adminRoutes } from './routes/admin.routes';
import { logger } from '../services/logger.service';
import { connectDB } from '../services/database.service';
import { WEB_PORT } from '../config/config';

const app = express();

app.use(express.json());
app.use('/admin', adminRoutes);

app.listen(WEB_PORT, () => {
  logger.info(`Web server running on port ${WEB_PORT}`);
  connectDB();
});