import { config } from '../config/index.js';

export const knexConfig = {
  client: 'pg',
  connection: config.DATABASE_URL,
  pool: { min: 2, max: 10 },
  migrations: {
    directory: './db/migrations',
    extension: 'ts',
  },
};

export default knexConfig;
