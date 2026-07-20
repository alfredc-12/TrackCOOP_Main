import mysql from 'mysql2/promise';

const dbConfig = {
  uri: process.env.DATABASE_URL || "mysql://root:@localhost:3306/trackcoopdb",
};

// Create a connection pool instead of a single connection
export const db = mysql.createPool(dbConfig.uri);
