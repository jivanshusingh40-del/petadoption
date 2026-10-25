const express = require("express");
const mysql = require("mysql2");
const bcrypt=require("bcrypt");

const db = mysql.createConnection({
    host: "127.0.0.1",
    user: "root",
    password: "lpu@@2026",
    database: "pet_adoption"
});

db.connect((err) => {
    if (err) {
        console.log("MySQL connection failed:", err.message);
    } else {
        console.log("MySQL connected successfully!");
    }
});

const app = express();
const PORT = 3000;

app.use(express.json());
app.use((req, res, next) => {
  console.log(req.method, req.url, req.body);
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

app.get("/api/pets", (req, res) => {
    db.query("SELECT * FROM pets", (err, results) => {
        if (err) {
           if (err) {
    console.log("ADOPTION ERROR:", err.message);
    return res.status(500).json({
        error: err.message
    });
} 
            return res.status(500).json({ error: err.message });
        }

        res.json(results);
    });
});
app.post("/api/adoptions", (req, res) => {
    const { adopter_name, email, pet_name } = req.body;

    console.log("received data",req.body);

    const sql = "INSERT INTO adoptions (adopter_name, email, pet_name) VALUES (?, ?, ?)";

    db.query(sql, [adopter_name, email, pet_name], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        res.json({ message: "Adoption application saved successfully!" });
    });
});
console.log('GET ADOPTIONS ROUTE LOADED')
app.get("/api/adoptions", (req, res) => {
    db.query("SELECT * FROM adoptions", (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});