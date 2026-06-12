import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from testing/web-tests/ first, then fall back to root .env if necessary
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  baseUrl: process.env.BASE_URL || 'http://localhost:5173',
  headless: process.env.HEADLESS === 'true',
  timeouts: {
    implicit: 5000,
    explicit: 10000,
  },
  credentials: {
    customer: {
      email: process.env.CUSTOMER_EMAIL || '',
      password: process.env.CUSTOMER_PASSWORD || '',
    },
    business: {
      email: process.env.BUSINESS_EMAIL || '',
      password: process.env.BUSINESS_PASSWORD || '',
    },
    admin: {
      email: process.env.ADMIN_EMAIL || '',
      password: process.env.ADMIN_PASSWORD || '',
    },
  },
};
