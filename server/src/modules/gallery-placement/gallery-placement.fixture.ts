import assert from "node:assert/strict";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import mysql, { type Pool } from "mysql2/promise";
export async function fixturePool(): Promise<Pool> {
  const c = await mysql.createConnection({
    host: "127.0.0.1",
    port: 33328,
    user: "root",
    multipleStatements: true,
  });
  const [r] = await c.query<mysql.RowDataPacket[]>(
    "SELECT @@datadir directory",
  );
  assert.equal(
    resolve(String(r[0].directory)).toLowerCase(),
    resolve(".gallery-verification/sql").toLowerCase(),
    "Refusing a database outside this checkout's disposable fixture",
  );
  await c.query("CREATE DATABASE IF NOT EXISTS trackcoop_gallery_fixture");
  await c.end();
  const pool = mysql.createPool({
    host: "127.0.0.1",
    port: 33328,
    user: "root",
    database: "trackcoop_gallery_fixture",
    timezone: "Z",
    multipleStatements: true,
  });
  pool.on("connection", (connection) => {
    connection.query("SET time_zone='+00:00'");
  });
  return pool;
}
export async function seedGallery(pool: Pool) {
  const [r] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT @@datadir directory,DATABASE() name",
  );
  assert.equal(
    resolve(String(r[0].directory)).toLowerCase(),
    resolve(".gallery-verification/sql").toLowerCase(),
  );
  assert.equal(r[0].name, "trackcoop_gallery_fixture");
  await pool.query(`SET FOREIGN_KEY_CHECKS=0;DROP TABLE IF EXISTS audit_logs,gallery_landing_state,gallery_landing_slots,gallery_images,gallery_groups,announcement_images,announcements,users;SET FOREIGN_KEY_CHECKS=1;
 CREATE TABLE users(user_id BIGINT UNSIGNED PRIMARY KEY,display_name VARCHAR(100));INSERT INTO users VALUES(1,'Gallery Chair');
 CREATE TABLE gallery_groups(gallery_group_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255),caption TEXT,category VARCHAR(120),activity_date DATE,location VARCHAR(255),border_color VARCHAR(20),public_visibility TINYINT,gallery_status VARCHAR(20),display_order INT DEFAULT 0,uploaded_by BIGINT UNSIGNED DEFAULT 1,published_at DATETIME,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE gallery_images(gallery_image_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,gallery_group_id BIGINT UNSIGNED,image_path VARCHAR(500),thumbnail_path VARCHAR(500),alt_text VARCHAR(255),sort_order INT DEFAULT 0,is_cover TINYINT DEFAULT 0,public_visibility TINYINT DEFAULT 1,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE announcements(announcement_id BIGINT UNSIGNED PRIMARY KEY,title VARCHAR(255),message TEXT,excerpt TEXT,audience_type VARCHAR(30),announcement_status VARCHAR(20),featured_image_path VARCHAR(500),posted_at DATETIME,publish_at DATETIME,expires_at DATETIME,created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE announcement_images(announcement_image_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,announcement_id BIGINT UNSIGNED NOT NULL,image_path VARCHAR(500) NOT NULL,alt_text VARCHAR(255),sort_order INT DEFAULT 0,is_featured TINYINT DEFAULT 0,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,UNIQUE(announcement_id,image_path));
 CREATE TABLE gallery_landing_slots(slot_key VARCHAR(80) PRIMARY KEY,gallery_group_id BIGINT UNSIGNED,gallery_image_id BIGINT UNSIGNED,display_order INT DEFAULT 0,updated_by BIGINT UNSIGNED,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,FOREIGN KEY(gallery_image_id) REFERENCES gallery_images(gallery_image_id) ON DELETE SET NULL);
 CREATE TABLE audit_logs(audit_log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,user_id BIGINT UNSIGNED,action VARCHAR(100),entity_table VARCHAR(100),record_id BIGINT UNSIGNED,description TEXT,old_values JSON,new_values JSON,action_time DATETIME DEFAULT CURRENT_TIMESTAMP);
 INSERT INTO gallery_groups(gallery_group_id,title,public_visibility,gallery_status,published_at,created_at) VALUES(1,'Harvest field photos',1,'Published',NOW()-INTERVAL 2 DAY,NOW()),(2,'Private gallery',0,'Published',NOW(),NOW()),(3,'Draft gallery',1,'Draft',NULL,NOW()),(4,'Archived gallery',1,'Archived',NOW(),NOW());
 INSERT INTO announcements(announcement_id,title,message,audience_type,announcement_status,posted_at,publish_at,expires_at) VALUES(1,'General assembly','Assembly recap','Public','Published',NOW(),NULL,NULL),(2,'Restricted announcement','Private','All Members','Published',NOW(),NULL,NULL),(3,'Draft announcement','Draft','Public','Draft',NULL,NULL,NULL),(4,'Expired announcement','Expired','Public','Published',NOW()-INTERVAL 10 DAY,NULL,NOW()-INTERVAL 1 DAY),(5,'Scheduled announcement','Future','Public','Published',NOW(),NOW()+INTERVAL 1 DAY,NULL),(6,'Archived announcement','Archived','Public','Archived',NOW(),NULL,NULL);
 INSERT INTO announcements(announcement_id,title,message,audience_type,announcement_status,featured_image_path,posted_at) VALUES(7,'Legacy announcement','Legacy','Public','Published','/images/Hero%20Page/Main%20Photo%204.jpg',NOW());`);
  const paths = [
    "/images/Hero%20Page/Main%20Photo%201.jpg",
    "/images/Hero%20Page/Main%20Photo%202.jpg",
    "/images/Hero%20Page/Main%20Photo%203.jpg",
    "/images/announcements/Post%201.1.jpg",
    "/images/announcements/Post%201.2.jpg",
    "/images/announcements/Post%201.3.jpg",
  ];
  for (const [i, path] of paths.entries())
    await pool.execute(
      "INSERT INTO gallery_images(gallery_group_id,image_path,alt_text,sort_order,is_cover) VALUES(1,?,?,?,?)",
      [path, `Harvest photo ${i + 1}`, i, i === 5 ? 1 : 0],
    );
  for (let g = 2; g <= 4; g++)
    await pool.execute(
      "INSERT INTO gallery_images(gallery_group_id,image_path,alt_text) VALUES(?,?,?)",
      [g, `/uploads/private-${g}.jpg`, `Restricted ${g}`],
    );
  for (let a = 1; a <= 6; a++)
    for (let i = 0; i < (a === 1 ? 4 : 1); i++)
      await pool.execute(
        "INSERT INTO announcement_images(announcement_id,image_path,alt_text,sort_order) VALUES(?,?,?,?)",
        [
          a,
          `/images/announcements/Post%20${i === 0 ? "2.1" : i === 1 ? "2.2" : i === 2 ? "3.1" : "3.2"}.jpg`,
          `Assembly photo ${i + 1}`,
          i,
        ],
      );
  await pool.query(
    "INSERT INTO gallery_landing_slots VALUES('gallery-feature-1',1,1,1,1,NOW()),('gallery-feature-2',1,2,2,1,NOW())",
  );
  await pool.query(
    await readFile(
      resolve(
        "server/database/migrations/20261104_gallery_landing_placements.sql",
      ),
      "utf-8",
    ),
  );
}
