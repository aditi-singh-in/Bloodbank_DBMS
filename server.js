
const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// =========================
// SERVER + DATABASE TEST
// =========================

app.get("/", (req, res) => {
    res.json({ message: "Blood Bank Backend is running!" });
});

// =========================
// REGISTER
// =========================

app.post("/api/register", async (req, res) => {
    try {
        const { fullName, email, phone, role, password } = req.body;

        if (
            !fullName?.trim() ||
            !email?.trim() ||
            !role ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Please fill all required fields."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const [existingUser] = await db.execute(
            "SELECT admin_id FROM user_admin WHERE email = ?",
            [normalizedEmail]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.execute(
            `INSERT INTO user_admin
                (full_name, username, email, phone, password, role)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                fullName.trim(),
                normalizedEmail,
                normalizedEmail,
                phone?.trim() || null,
                hashedPassword,
                role
            ]
        );

        res.status(201).json({
            success: true,
            message: "Registration successful!"
        });

    } catch (error) {
        console.error("Registration error:", error);

        res.status(500).json({
            success: false,
            message: "Registration failed."
        });
    }
});

// =========================
// LOGIN
// =========================

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email?.trim() || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const [users] = await db.execute(
            "SELECT * FROM user_admin WHERE email = ?",
            [email.trim().toLowerCase()]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Account not found."
            });
        }

        const user = users[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid password."
            });
        }

        res.json({
            success: true,
            message: "Login successful!",
            user: {
                id: user.admin_id,
                name: user.full_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Login failed."
        });
    }
});

// =========================
// DONOR MANAGEMENT
// =========================

const validBloodGroups = [
    "A+", "A-", "B+", "B-",
    "O+", "O-", "AB+", "AB-"
];

// GET: Fetch all donors from MySQL

/* GET: Fetch all donors with their latest recorded donation date */

app.get("/api/donors", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                d.donor_id,
                d.name,
                d.age,
                d.address,
                d.gender,
                d.blood_grp,
                d.contact,
                DATE_FORMAT(
                    latest.last_donation_date,
                    '%Y-%m-%d'
                ) AS last_donation_date
            FROM donor d
            LEFT JOIN (
                SELECT
                    donor_id,
                    MAX(donation_date) AS last_donation_date
                FROM (
                    SELECT
                        donor_id,
                        donation_id,
                        MAX(donation_date) AS donation_date
                    FROM blood
                    WHERE donation_id IS NOT NULL
                      AND donation_date IS NOT NULL
                    GROUP BY donor_id, donation_id
                ) AS unique_donations
                GROUP BY donor_id
            ) AS latest
                ON latest.donor_id = d.donor_id
            ORDER BY d.donor_id DESC
        `);

        res.json(rows);
    } catch (error) {
        console.error("Fetch donors error:", error);
        res.status(500).json({
            message: "Failed to fetch donors."
        });
    }
});



// POST: Save a new donor in MySQL
app.post("/api/donors", async (req, res) => {
    try {
        const {
            name,
            age,
            address,
            gender,
            blood_grp,
            contact
        } = req.body;

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                message: "Donor name is required."
            });
        }

        if (
            typeof blood_grp !== "string" ||
            !validBloodGroups.includes(blood_grp)
        ) {
            return res.status(400).json({
                message: "Please select a valid blood group."
            });
        }

        const parsedAge =
            age === "" || age === null || age === undefined
                ? null
                : Number(age);

        if (
            parsedAge !== null &&
            (!Number.isInteger(parsedAge) ||
             parsedAge < 18 ||
             parsedAge > 100)
        ) {
            return res.status(400).json({
                message: "Age must be a whole number between 18 and 100."
            });
        }

        if (
            contact != null &&
            String(contact).trim().length > 15
        ) {
            return res.status(400).json({
                message: "Phone number must be at most 15 characters."
            });
        }

        const sql = `
            INSERT INTO donor
                (name, age, address, gender, blood_grp, contact)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const [result] = await db.execute(sql, [
            name.trim(),
            parsedAge,
            address?.trim() || null,
            gender || null,
            blood_grp,
            contact?.trim() || null
        ]);

        res.status(201).json({
            success: true,
            message: "Donor added successfully.",
            donor_id: result.insertId
        });

    } catch (error) {
        console.error("Add donor error:", error);

        res.status(500).json({
            message: "Failed to add donor."
        });
    }
});

/* ==========================================
   RECIPIENT MANAGEMENT
========================================== */

// Fetch recipients
app.get("/api/recipients", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT recipient_id, recipient, age, gender,
                   contact, address, blood_grp
            FROM recipient
            ORDER BY recipient_id DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error("Fetch recipients:", error);
        res.status(500).json({ message: "Failed to fetch recipients." });
    }
});

// Add recipient
app.post("/api/recipients", async (req, res) => {
    try {
        const { recipient, age, gender, contact, address, blood_grp } = req.body;

        if (!recipient?.trim() || !validBloodGroups.includes(blood_grp)) {
            return res.status(400).json({
                message: "Recipient name and a valid blood group are required."
            });
        }

        const [result] = await db.execute(`
            INSERT INTO recipient
                (recipient, age, gender, contact, address, blood_grp)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            recipient.trim(),
            age === "" || age == null ? null : Number(age),
            gender || null,
            contact?.trim() || null,
            address?.trim() || null,
            blood_grp
        ]);

        res.status(201).json({
            success: true,
            message: "Recipient added successfully.",
            recipient_id: result.insertId
        });
    } catch (error) {
        console.error("Add recipient:", error);
        res.status(500).json({ message: "Failed to add recipient." });
    }
});


/* ==========================================
   BLOOD INVENTORY
========================================== */

// Fetch blood stock records and related donor/hospital names
app.get("/api/inventory", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT b.blood_id, b.donor_id, b.hospital_id,
                   b.blood_grp, b.quantity, b.status,
                   b.donation_date, b.donation_id, b.supply_details,
                   d.name AS donor_name,
                   h.name AS hospital_name
            FROM blood b
            LEFT JOIN donor d ON b.donor_id = d.donor_id
            LEFT JOIN hospital h ON b.hospital_id = h.hospital_id
            ORDER BY b.blood_id DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error("Fetch inventory:", error);
        res.status(500).json({ message: "Failed to fetch inventory." });
    }
});

// Add blood stock (a blood record must reference an existing donor)
app.post("/api/inventory", async (req, res) => {
    try {
        const {
            donor_id, hospital_id, blood_grp, quantity,
            status, donation_date, donation_id, supply_details
        } = req.body;

        if (!donor_id || !validBloodGroups.includes(blood_grp)) {
            return res.status(400).json({
                message: "An existing donor ID and valid blood group are required."
            });
        }

        const amount = Number(quantity);
        if (!Number.isInteger(amount) || amount <= 0) {
            return res.status(400).json({
                message: "Quantity must be a positive whole number."
            });
        }

        const [result] = await db.execute(`
            INSERT INTO blood
                (donor_id, hospital_id, blood_grp, quantity, status,
                 donation_date, donation_id, supply_details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            Number(donor_id),
            hospital_id ? Number(hospital_id) : null,
            blood_grp,
            amount,
            status || "Available",
            donation_date || null,
            donation_id ? Number(donation_id) : null,
            supply_details?.trim() || null
        ]);

        res.status(201).json({
            success: true,
            message: "Blood stock added successfully.",
            blood_id: result.insertId
        });
    } catch (error) {
        console.error("Add inventory:", error);
        res.status(500).json({
            message: "Failed to add stock. Check that the donor and hospital IDs exist."
        });
    }
});


/* ==========================================
   DONATIONS
   Donations are recorded in the existing blood table.
========================================== */

app.get("/api/donations", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT b.blood_id, b.donation_id, b.donor_id,
                   d.name AS donor_name, b.blood_grp,
                   b.quantity, b.donation_date, b.status,
                   b.hospital_id, h.name AS hospital_name,
                   b.supply_details
            FROM blood b
            JOIN donor d ON b.donor_id = d.donor_id
            LEFT JOIN hospital h ON b.hospital_id = h.hospital_id
            ORDER BY b.blood_id DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error("Fetch donations:", error);
        res.status(500).json({ message: "Failed to fetch donations." });
    }
});

// Record a donation
app.post("/api/donations", async (req, res) => {
    try {
        const {
            donor_id, hospital_id, blood_grp, quantity,
            donation_date, supply_details
        } = req.body;

        if (!donor_id || !validBloodGroups.includes(blood_grp)) {
            return res.status(400).json({
                message: "Donor ID and valid blood group are required."
            });
        }

        const amount = Number(quantity);
        if (!Number.isInteger(amount) || amount <= 0) {
            return res.status(400).json({
                message: "Quantity must be a positive whole number."
            });
        }

        const [result] = await db.execute(`
            INSERT INTO blood
                (donor_id, hospital_id, blood_grp, quantity, status,
                 donation_date, donation_id, supply_details)
            VALUES (?, ?, ?, ?, 'Available', ?, NULL, ?)
        `, [
            Number(donor_id),
            hospital_id ? Number(hospital_id) : null,
            blood_grp,
            amount,
            donation_date || null,
            supply_details?.trim() || null
        ]);

        // Use the generated blood record ID as the donation reference.
        await db.execute(
            "UPDATE blood SET donation_id = ? WHERE blood_id = ?",
            [result.insertId, result.insertId]
        );

        res.status(201).json({
            success: true,
            message: "Donation recorded successfully.",
            blood_id: result.insertId,
            donation_id: result.insertId
        });
    } catch (error) {
        console.error("Record donation:", error);
        res.status(500).json({
            message: "Failed to record donation. Check the donor and hospital IDs."
        });
    }
});


/* ==========================================
   BLOOD REQUESTS
========================================== */

// Fetch requests with recipient and hospital details
app.get("/api/requests", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT br.request_id, br.hospital_id,
                   h.name AS hospital_name,
                   br.recipient_id, r.recipient AS recipient_name,
                   br.blood_id, br.blood_type, br.quantity,
                   br.request_date, br.status, br.completion_date
            FROM blood_request br
            JOIN recipient r ON br.recipient_id = r.recipient_id
            JOIN hospital h ON br.hospital_id = h.hospital_id
            ORDER BY br.request_id DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error("Fetch requests:", error);
        res.status(500).json({ message: "Failed to fetch blood requests." });
    }
});

// Create a request
app.post("/api/requests", async (req, res) => {
    try {
        const {
            hospital_id, recipient_id, blood_type, quantity
        } = req.body;

        if (!hospital_id || !recipient_id ||
            !validBloodGroups.includes(blood_type)) {
            return res.status(400).json({
                message: "Hospital, recipient and valid blood type are required."
            });
        }

        const amount = Number(quantity);
        if (!Number.isInteger(amount) || amount <= 0) {
            return res.status(400).json({
                message: "Quantity must be a positive whole number."
            });
        }

        const [result] = await db.execute(`
            INSERT INTO blood_request
                (hospital_id, recipient_id, blood_id, blood_type,
                 quantity, request_date, status, completion_date)
            VALUES (?, ?, NULL, ?, ?, CURDATE(), 'Pending', NULL)
        `, [Number(hospital_id), Number(recipient_id), blood_type, amount]);

        res.status(201).json({
            success: true,
            message: "Blood request created successfully.",
            request_id: result.insertId
        });
    } catch (error) {
        console.error("Create request:", error);
        res.status(500).json({
            message: "Failed to create request. Check that the hospital and recipient IDs exist."
        });
    }
});

// Change request status
app.patch("/api/requests/:id/status", async (req, res) => {
    try {
        const { status } = req.body;
        const allowedStatuses = ["Pending", "Approved", "Completed", "Rejected"];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid request status." });
        }

        const [result] = await db.execute(`
            UPDATE blood_request
            SET status = ?,
                completion_date = CASE
                    WHEN ? = 'Completed' THEN CURDATE()
                    ELSE NULL
                END
            WHERE request_id = ?
        `, [status, status, Number(req.params.id)]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Request not found." });
        }

        res.json({ success: true, message: "Request status updated." });
    } catch (error) {
        console.error("Update request:", error);
        res.status(500).json({ message: "Failed to update request status." });
    }
});


/* ==========================================
   REPORTS / DASHBOARD SUMMARY
========================================== */

app.get("/api/reports", async (req, res) => {
    try {
        const [[donors]] = await db.query(
            "SELECT COUNT(*) AS total FROM donor"
        );
        const [[recipients]] = await db.query(
            "SELECT COUNT(*) AS total FROM recipient"
        );
        const [[requests]] = await db.query(`
            SELECT COUNT(*) AS total,
                   SUM(status = 'Pending') AS pending,
                   SUM(status = 'Approved') AS approved,
                   SUM(status = 'Completed') AS completed,
                   SUM(status = 'Rejected') AS rejected
            FROM blood_request
        `);
        const [[donations]] = await db.query(`
            SELECT COUNT(*) AS total,
                   COUNT(CASE
                       WHEN YEAR(donation_date) = YEAR(CURDATE())
                        AND MONTH(donation_date) = MONTH(CURDATE())
                       THEN 1 END) AS this_month
            FROM blood
        `);
        const [inventory] = await db.query(`
            SELECT blood_grp,
                   SUM(CASE WHEN status = 'Available' THEN quantity ELSE 0 END)
                       AS available_quantity,
                   COUNT(CASE WHEN status = 'Available' THEN 1 END)
                       AS available_records,
                   COUNT(CASE WHEN status = 'Reserved' THEN 1 END)
                       AS reserved_records,
                   COUNT(CASE WHEN status = 'Supplied' THEN 1 END)
                       AS supplied_records
            FROM blood
            GROUP BY blood_grp
            ORDER BY blood_grp
        `);

        res.json({
            donors: donors.total,
            recipients: recipients.total,
            requests: {
                total: requests.total || 0,
                pending: requests.pending || 0,
                approved: requests.approved || 0,
                completed: requests.completed || 0,
                rejected: requests.rejected || 0
            },
            donations: {
                total: donations.total || 0,
                this_month: donations.this_month || 0
            },
            inventory
        });
    } catch (error) {
        console.error("Generate reports:", error);
        res.status(500).json({ message: "Failed to generate reports." });
    }
});

// Dashboard blood stock totals by blood group

app.get("/api/inventory/summary", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                blood_grp,
                COALESCE(SUM(
                    CASE
                        WHEN status = 'Available' THEN quantity
                        ELSE 0
                    END
                ), 0) AS available_quantity,
                COALESCE(SUM(
                    CASE
                        WHEN status = 'Reserved' THEN quantity
                        ELSE 0
                    END
                ), 0) AS reserved_quantity
            FROM blood
            GROUP BY blood_grp
        `);

        res.json(rows);
    } catch (error) {
        console.error("Inventory summary error:", error);
        res.status(500).json({
            message: "Failed to load inventory summary."
        });
    }
});


// =========================
// START SERVER
// =========================

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
    try {
        // Check the database connection before starting.
        const connection = await db.getConnection();
        await connection.ping();
        connection.release();

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Server running on port ${PORT}`);
            console.log("Database connection successful.");
        });

    } catch (error) {
        console.error("Could not connect to MySQL:", error.message);
        process.exit(1);
    }
}

startServer();
