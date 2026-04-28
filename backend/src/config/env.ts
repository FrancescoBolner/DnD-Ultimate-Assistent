import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || 'password',
  DB_NAME: process.env.DB_NAME || 'dnd_db',
  DB_SSL: process.env.DB_SSL === 'true',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || '15m',
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || '7d',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // SMTP (for password-reset emails)
  SMTP_HOST:   process.env.SMTP_HOST   || '',
  SMTP_PORT:   parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',   // true for port 465
  SMTP_USER:   process.env.SMTP_USER   || '',
  SMTP_PASS:   process.env.SMTP_PASS   || '',
  SMTP_FROM:   process.env.SMTP_FROM   || 'noreply@dnd-assistant.app',

  // Public URL of the frontend (used in reset-password links)
  APP_URL: process.env.APP_URL || 'http://localhost:5173',
} as const;
