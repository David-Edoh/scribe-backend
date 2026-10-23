import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({
  path: process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env',
});

export const env = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
};
