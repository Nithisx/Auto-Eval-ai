// Load .env and run the Migration.sql using psql with the DATABASE_URL
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const sqlFile = path.resolve(__dirname, '..', 'Migration', 'Migration.sql');
const conn = process.env.DATABASE_URL;

if (!conn) {
  console.error('DATABASE_URL is not set. Please set it in .env or your environment.');
  process.exit(1);
}

const args = ['-d', conn, '-f', sqlFile];
console.log('Running:', 'psql', args.join(' '));

const child = spawn('psql', args, { stdio: 'inherit' });

child.on('exit', (code) => {
  if (code === 0) {
    console.log('Migration completed successfully.');
  } else {
    console.error(`Migration failed with exit code ${code}.`);
  }
  process.exit(code);
});
