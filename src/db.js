const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  user: process.env.PG_USER || '',
  host: process.env.PG_HOST || '',
  database: process.env.PG_DB || '',
  password: process.env.PG_PASSWORD || '',
  port: Number(process.env.PG_PORT) || 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Error conectando a la base de datos:', err);
  } else {
    console.log('Conexión exitosa a la base de datos PostgreSQL.');
    release();
  }
});

module.exports = pool;
