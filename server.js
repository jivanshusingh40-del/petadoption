require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");

// Database settings come from environment variables (.env on your laptop,
// Environment Variables on Render). No password is stored in this file.
const db = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "pet_adoption",
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

db.getConnection((err, connection) => {
    if (err) {
        console.log("MySQL connection failed:", err.message);
    } else {
        console.log("MySQL connected successfully!");
        connection.release();
    }
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Log only the method and address (never the body, which can hold passwords)
app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
});

app.use(express.static(__dirname));

app.post("/api/register", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            error: "Please fill in all fields."
        });
    }

    if (password.length < 8) {
        return res.status(400).json({
            error: "Password must be at least 8 characters."
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO users (name, email, password, role)
            VALUES (?, ?, ?, 'user')
        `;

        db.query(sql, [name.trim(), email.trim().toLowerCase(), hashedPassword],
            (err, result) => {
                if (err) {
                    if (err.code === "ER_DUP_ENTRY") {
                        return res.status(409).json({
                            error: "This email is already registered."
                        });
                    }

                    console.error("Registration error:", err.message);
                    return res.status(500).json({
                        error: "Registration failed."
                    });
                }

                return res.status(201).json({
                    message: "Registration successful! You can now log in."
                });
            }
        );
    } catch (error) {
        console.error("Password hashing error:", error.message);
        return res.status(500).json({
            error: "Registration failed."
        });
    }
});

app.post("/api/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            error: "Please enter your email and password."
        });
    }

    const sql = "SELECT id, name, email, password, role FROM users WHERE email = ?";

    db.query(sql, [String(email).trim().toLowerCase()], async (err, results) => {
        if (err) {
            console.error("Login error:", err.message);
            return res.status(500).json({ error: "Login failed." });
        }

        // Same message for "no such email" and "wrong password"
        if (results.length === 0) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        try {
            const user = results[0];
            const match = await bcrypt.compare(String(password), user.password);

            if (!match) {
                return res.status(401).json({ error: "Invalid email or password." });
            }

            return res.json({
                message: "Login successful!",
                user: { id: user.id, name: user.name, role: user.role }
            });
        } catch (error) {
            console.error("Password check error:", error.message);
            return res.status(500).json({ error: "Login failed." });
        }
    });
});

app.get("/api/pets", (req, res) => {
    db.query("SELECT * FROM pets", (err, results) => {
        if (err) {
            console.log("PETS ERROR:", err.message);
            return res.status(500).json({ error: err.message });
        }

        res.json(results);
    });
});

app.post("/api/adoptions", (req, res) => {
    const { adopter_name, email, pet_name } = req.body;

    console.log("received data", req.body);

    const sql = "INSERT INTO adoptions (adopter_name, email, pet_name) VALUES (?, ?, ?)";

    db.query(sql, [adopter_name, email, pet_name], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        res.json({ message: "Adoption application saved successfully!" });
    });
});

console.log("GET ADOPTIONS ROUTE LOADED");

// Public: only what the Dashboard needs (no names or emails)
app.get("/api/adoptions", (req, res) => {
    db.query("SELECT id, pet_name, status FROM adoptions", (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// ---------- Admin (protected by ADMIN_PASSWORD) ----------
function requireAdmin(req, res, next) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const given = req.headers["x-admin-password"];

    if (!adminPassword || !given || given !== adminPassword) {
        return res.status(401).json({ error: "Wrong admin password." });
    }
    next();
}

// Full list for the admin page
app.get("/api/admin/applications", requireAdmin, (req, res) => {
    db.query(
        "SELECT id, adopter_name, email, pet_name, status FROM adoptions ORDER BY id",
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(results);
        }
    );
});

// Approve / reject / set back to pending
app.post("/api/admin/applications/:id/status", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const status = req.body.status;
    const allowed = ["pending", "approved", "rejected"];

    if (!Number.isInteger(id) || !allowed.includes(status)) {
        return res.status(400).json({ error: "Invalid id or status." });
    }

    db.query("UPDATE adoptions SET status = ? WHERE id = ?", [status, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Application not found." });
        }
        res.json({ message: "Status updated." });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});