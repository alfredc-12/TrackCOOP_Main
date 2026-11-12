// One-shot initialization only. Refuses an existing schema or unknown instance.
import mysql from 'mysql2/promise';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const expectedDir = await realpath(path.join(root, 'scratch/jmeter-isolated-mysql/data'));
const db = await mysql.createConnection({host:'127.0.0.1', port:33328, user:'root', multipleStatements:true});
try {
  const [rows] = await db.query('SELECT @@port AS port, @@datadir AS datadir, @@version AS version, @@bind_address AS bindAddress');
  const info = rows[0];
  const actualDir = await realpath(info.datadir);
  if (info.port !== 33328 || info.bindAddress !== '127.0.0.1' || actualDir.toLowerCase() !== expectedDir.toLowerCase()) throw new Error('Unverified MySQL instance; refusing all changes');
  const [schemas] = await db.query('SHOW DATABASES');
  const allowed = new Set(['information_schema','mysql','performance_schema','sys']);
  if (schemas.some(row => !allowed.has(row.Database))) throw new Error('Instance is not empty; refusing all changes');
  const schema = await readFile(path.join(root,'server/database/TrackCOOP_MAIN_Database.sql'),'utf8');
  console.log(JSON.stringify({host:'127.0.0.1',port:info.port,datadir:actualDir,version:info.version,bindAddress:info.bindAddress,database:'trackcoop_jmeter_synthetic',priorDatabases:schemas.map(r=>r.Database)},null,2));
  await db.query('CREATE DATABASE `trackcoop_jmeter_synthetic` CHARACTER SET utf8mb4');
  await db.query('USE `trackcoop_jmeter_synthetic`');
  const [[identity]] = await db.query('SELECT DATABASE() AS name, @@port AS port, @@datadir AS datadir');
  if (identity.name !== 'trackcoop_jmeter_synthetic' || identity.port !== 33328 || (await realpath(identity.datadir)).toLowerCase() !== expectedDir.toLowerCase()) throw new Error('Database identity changed; refusing schema import');
  await db.query(schema);
  const [[count]] = await db.query('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=DATABASE()');
  console.log(`Base schema imported; ${count.n} tables/views. Migrations and fixtures have NOT been applied.`);
} finally { await db.end(); }
