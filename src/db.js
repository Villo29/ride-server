const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.PG_USER || "",
  host: process.env.PG_HOST || "",
  database: process.env.PG_DB || "",
  password: process.env.PG_PASSWORD || "",
  port: Number(process.env.PG_PORT) || 5432,
});

console.log("Conexión a la base de datos exitosa");

module.exports = pool;
