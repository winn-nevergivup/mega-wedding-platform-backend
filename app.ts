
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { APP_NAME } from './workers/core/config';

// Import Routes
import auth from './workers/routes/auth';
import admin from './workers/routes/dashboard-admin';
import dashboard from './workers/routes/dashboard-user';
import invite from './workers/routes/public-invite';
import { AppEnv } from 'types/env';


const app = new Hono<AppEnv>();

// Global Middleware
app.use('*', cors({
    origin: ['http://localhost:3000',
        'https://mega-wedding-platform.vercel.app'],
    credentials: true
}));

// Health Check
app.get('/', (c) => c.json({ message: `${APP_NAME} API Running (Strict Mode)` }));

// Mount Routes
app.route('/auth', auth);
app.route('/invite', invite);
app.route('/dashboard', dashboard);
app.route('/dashboard-admin', admin);

export default app;
