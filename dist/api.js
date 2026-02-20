import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { APP_NAME } from './core/config';
// Import Routes
import adminRoutes from './routes/dashboard-admin';
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard-user';
import inviteRoutes from './routes/public-invite';
const app = new Hono();
// Global Middleware
app.use('*', cors());
// Health Check
app.get('/', (c) => c.json({ message: `${APP_NAME} API Running (Strict Mode)` }));
// Mount Routes
app.route('/auth', authRoutes);
app.route('/invite', inviteRoutes);
app.route('/dashboard', dashboardRoutes);
app.route('/admin', adminRoutes);
export default app;
