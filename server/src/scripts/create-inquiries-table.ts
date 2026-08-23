import { getPool, closePool } from "../db/pool";

async function main() {
    console.log("Connecting to database...");
    const pool = getPool();

    try {
        console.log("Creating inquiries table...");
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS inquiries (
                inquiry_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                tracking_code VARCHAR(60) NOT NULL,
                sender_name VARCHAR(190) NOT NULL,
                sender_email VARCHAR(190) NULL,
                sender_contact VARCHAR(40) NULL,
                category ENUM('Membership', 'Loan', 'General Inquiry', 'Technical Support') NOT NULL DEFAULT 'General Inquiry',
                status ENUM('Open', 'Pending', 'Resolved', 'Closed') NOT NULL DEFAULT 'Open',
                priority ENUM('Low', 'Medium', 'High') NOT NULL DEFAULT 'Medium',
                assigned_to BIGINT UNSIGNED NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT uq_inquiries_tracking_code UNIQUE (tracking_code),
                CONSTRAINT fk_inquiries_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(user_id)
                    ON UPDATE CASCADE ON DELETE SET NULL
            ) ENGINE=InnoDB;
        `);

        console.log("Creating inquiry_messages table...");
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS inquiry_messages (
                message_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                inquiry_id BIGINT UNSIGNED NOT NULL,
                sender_type ENUM('Public', 'Admin') NOT NULL,
                sender_user_id BIGINT UNSIGNED NULL,
                message_body TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_inquiry_messages_inquiry FOREIGN KEY (inquiry_id) REFERENCES inquiries(inquiry_id)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_inquiry_messages_user FOREIGN KEY (sender_user_id) REFERENCES users(user_id)
                    ON UPDATE CASCADE ON DELETE SET NULL
            ) ENGINE=InnoDB;
        `);

        console.log("Tables created successfully.");
    } catch (err) {
        console.error("Error creating tables:", err);
    } finally {
        await closePool();
    }
}

main().catch(console.error);
