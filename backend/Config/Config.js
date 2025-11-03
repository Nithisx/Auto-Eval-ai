const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // optionally add SSL config for production
});

pool.on('error', (err) => {
  console.error('Unexpected PG error', err);
  process.exit(-1);
});

// Check connection to the database and log success
pool
  .query('SELECT NOW()')  // Simple query to check the connection
  .then(() => {
    console.log('Connected to the PostgreSQL database successfully!');
  })
  .catch((err) => {
    console.error('Error connecting to the PostgreSQL database', err.stack);
  });

module.exports = pool;
