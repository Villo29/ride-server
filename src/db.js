import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const client = new Client({
    user: process.env.PG_USER || '',
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DB || '',
    password: process.env.PG_PASSWORD || '',
    port: Number(process.env.PG_PORT) || 5432,
    ssl: {
        rejectUnauthorized: false,
    },
});

client.connect()
    .then(() => {
        console.log('Conectado a la base de datos PostgreSQL exitosamente.');
    })
    .catch((error) => {
        console.error('Error al conectar a la base de datos PostgreSQL:', error);
    });

export default client;
