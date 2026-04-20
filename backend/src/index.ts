import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { testConnection } from './config/db';
import { initDb } from './db/init';
import { createSocketServer } from './realtime/socket';
import authRoutes from './auth/auth.routes';
import campaignRoutes from './modules/campaigns/campaigns.routes';
import characterRoutes from './modules/plugins/core/characters/characters.routes';
import userRoutes from './modules/users/users.routes';
import creatureRoutes from './modules/plugins/core/creatures/creatures.routes';
import effectRoutes from './modules/plugins/core/effects/effects.routes';
import abilityRoutes from './modules/plugins/core/abilities/abilities.routes';
import itemRoutes from './modules/plugins/core/items/items.routes';
import combatRoutes from './modules/plugins/addon/combat/combat.routes';
import screenRoutes from './modules/plugins/addon/screen/screen.routes';
import mapRoutes from './modules/plugins/addon/map/map.routes';
import settingsRoutes from './modules/settings/settings.routes';
import adminRoutes from './modules/admin/admin.routes';
import { errorHandler } from './core/middleware/error.middleware';

const app = express();
app.set('trust proxy', 1); // trust Render's reverse proxy for req.protocol / req.ip

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;

  const explicitAllowed = env.CORS_ORIGIN
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (explicitAllowed.includes(origin)) return true;

  const lanOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/i;
  return lanOrigin.test(origin);
}

/* ── Global middleware ── */
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,             // allow cookies
}));
app.use(express.json());
app.use(cookieParser());

// Serve entire frontend/public directory so any asset (images, map files, sounds, etc.) is accessible
app.use(express.static(path.join(__dirname, '../../frontend/public')));

/* ── Routes ── */
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/users', userRoutes);
app.use('/api/creatures', creatureRoutes);
app.use('/api/effects', effectRoutes);
app.use('/api/abilities', abilityRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/combat', combatRoutes);
app.use('/api/screens', screenRoutes);
app.use('/api/maps', mapRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);

/* ── Health check ── */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/* ── Error handler (must be last) ── */
app.use(errorHandler);

/* ── Start ── */
async function start() {
  try {
    await testConnection();
    await initDb();
  } catch (err) {
    console.error('✗ Database connection failed:', err);
  }

  const httpServer = createSocketServer(app);
  httpServer.listen(env.PORT, () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
  });
}

start();
