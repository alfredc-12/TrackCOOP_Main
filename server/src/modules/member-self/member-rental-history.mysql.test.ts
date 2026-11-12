import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import type { Pool } from "mysql2/promise";
import { closePool, getPool } from "../../db/pool";
import type { AuthService } from "../auth/auth.service";
import { createMembershipProgressRouter } from "../membership-policy/membership-progress.routes";

test("MySQL member history includes owned rental payments, preserves status, and excludes other members", {
  skip: process.env.RUN_MEMBER_RENTAL_MYSQL_TESTS !== "true",
}, async () => {
  const connection = await getPool().getConnection();
  try {
    // These session-local tables shadow production tables without editing any saved records.
    await connection.query("CREATE TEMPORARY TABLE member_profiles (member_id BIGINT PRIMARY KEY, user_id BIGINT, membership_type VARCHAR(30), share_capital_deadline DATE)");
    await connection.query("CREATE TEMPORARY TABLE membership_applications (membership_application_id BIGINT, converted_member_id BIGINT)");
    await connection.query("CREATE TEMPORARY TABLE rental_bookings (rental_booking_id BIGINT PRIMARY KEY, member_id BIGINT)");
    await connection.query("CREATE TEMPORARY TABLE payment_references (payment_reference_id BIGINT PRIMARY KEY, member_id BIGINT, related_entity_type VARCHAR(50), related_entity_id BIGINT, payment_purpose VARCHAR(50), reference_number VARCHAR(100), amount DECIMAL(12,2), validation_status VARCHAR(30), submitted_at DATETIME)");
    await connection.query("INSERT INTO member_profiles VALUES (12,7,'True Member',NULL),(99,8,'True Member',NULL)");
    await connection.query("INSERT INTO rental_bookings VALUES (1,12),(2,99),(3,NULL)");
    await connection.query(`INSERT INTO payment_references VALUES
      (1,12,'rental_bookings',1,'Rental','RENTAL-PAID',2500,'Validated','2026-11-09'),
      (2,NULL,'rental_bookings',1,'Rental','RENTAL-PENDING',500,'Pending','2026-11-08'),
      (3,99,'rental_bookings',2,'Rental','OTHER-MEMBER',800,'Validated','2026-11-10'),
      (4,NULL,'rental_bookings',3,'Rental','PUBLIC-UNLINKED',900,'Validated','2026-11-10'),
      (5,99,'rental_bookings',1,'Rental','CONFLICTING-OWNER',1000,'Validated','2026-11-10')`);
    const authService = { authenticate: async () => ({ user: { id: "7", role: "member" } }) } as unknown as AuthService;
    const app = express();
    app.use("/api", createMembershipProgressRouter(authService, connection as unknown as Pool));
    const response = await request(app).get("/api/members/me/membership-payments?memberId=99&pageSize=1");
    assert.equal(response.status,200);
    assert.equal(response.body.data.total,2);
    assert.deepEqual(response.body.data.items.map((i: {reference: string;status: string;amount: number}) => [i.reference,i.status,i.amount]), [["RENTAL-PAID","Validated",2500]]);
    const second = await request(app).get("/api/members/me/membership-payments?page=2&pageSize=1");
    assert.equal(second.body.data.items[0].reference,"RENTAL-PENDING");
    assert.equal(second.body.data.items[0].status,"Pending");
  } finally {
    connection.destroy();
    await closePool();
  }
});
