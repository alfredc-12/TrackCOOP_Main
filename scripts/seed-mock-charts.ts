import { getPool } from "../server/src/db/pool";

const db = getPool();

async function seed() {
  try {
    console.log("Seeding comprehensive mock data for dashboard...");

    // Get a user to attach POS sales to
    const [users] = await db.query<any>("SELECT user_id FROM users LIMIT 1");
    if (!users.length) {
      await db.query("INSERT INTO users (first_name, last_name, email, password_hash, role_id) VALUES ('Admin', 'User', 'admin@test.com', 'hash', 1)");
    }
    const [[{ user_id }]] = await db.query<any>("SELECT user_id FROM users LIMIT 1");

    // Seed Members for demographics & health
    const barangays = ['Poblacion 1', 'Wawa', 'Bucana', 'Lumbangan'];
    const statuses = ['Active', 'Needs Monitoring', 'Inactive'];
    let memberValues = "";
    for(let i=0; i<15; i++) {
        const brgy = barangays[i % barangays.length];
        const status = statuses[i % statuses.length];
        memberValues += `(CONCAT('MEM-', ${i}, '-', RAND()), 'Member${i} Test', '${brgy}', 'Approved', '${status}', DATE_SUB(NOW(), INTERVAL ${i} DAY)),`;
    }
    await db.query(`INSERT INTO member_profiles (member_code, full_name, barangay, approval_status, official_member_status, created_at) VALUES ${memberValues.slice(0, -1)}`);
    console.log("Inserted mock members.");

    // Get all members for share capital distribution
    const [members] = await db.query<any>("SELECT member_id FROM member_profiles LIMIT 10");
    const memberIds = members.map((m: any) => m.member_id);

    // Seed Products for inventory alerts
    await db.query(`INSERT INTO products (name, sku, category_id, price, stock_quantity, is_active) VALUES 
        ('Fertilizer A', 'FRT-A', 1, 1500, 5, 1),
        ('Pesticide B', 'PST-B', 1, 800, 2, 1),
        ('Seed Pack C', 'SD-C', 1, 200, 0, 1)
    `).catch(() => console.log("Products table might not exist or failed (ignoring)."));
    console.log("Inserted mock products.");

    const now = new Date();
    let posValues = "";
    let scValues = "";
    const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    for(let m = 0; m < 12; m++) {
      for(let d = 1; d <= 3; d++) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - m, rand(1, 28));
        const ds = targetDate.toISOString().slice(0,19).replace('T', ' ');

        // POS Order
        const amt = rand(500, 3000);
        posValues += `(UUID(), ${user_id}, 'Walk-in', 'Completed', 'Paid', ${amt}, ${amt}, '${ds}'),`;

        // Share Capital
        const scAmt = rand(1000, 5000);
        const mId = memberIds[rand(0, memberIds.length - 1)];
        scValues += `(${mId}, ${scAmt}, 'Validated', '${ds}'),`;
      }
    }

    if(posValues) {
       await db.query(`INSERT INTO pos_sales (sale_number, recorded_by, sale_type, sale_status, payment_status, subtotal_amount, total_amount, created_at) VALUES ${posValues.slice(0, -1)}`);
       console.log("Inserted POS sales.");
    }
    
    if(scValues) {
       await db.query(`INSERT INTO share_capital_payments (member_id, amount, payment_status, payment_date) VALUES ${scValues.slice(0, -1)}`);
       console.log("Inserted Share Capital.");
    }

    console.log("Done seeding!");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

seed();
