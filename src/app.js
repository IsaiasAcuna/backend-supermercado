import express from "express";
import multer from "multer";
import sqlite3 from "sqlite3";
import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from 'dotenv'


const app = express();
const upload = multer({ dest: "uploads/" });
dotenv.config();

const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: [ PORT, 'https://liverpool-web-6eys.onrender.com'],
  credentials: true,
}));


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Procesar forms
app.use(express.urlencoded({ extended: true }));

// Página de login
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Verificar contraseña y servir upload.html
app.post("/verify-password", (req, res) => {
  const { password } = req.body;
  if (password === process.env.PASSWORD) {
    res.sendFile(path.join(__dirname, "public", "upload.html"));
  } else {
    res.send("Contraseña incorrecta. Acceso denegado.");
  }
});

// Pagina de subida

app.get("/upload.html", (req, res) => {
  const token = req.query.token; // o header
  if (token !== process.env.SECRET_TOKEN) return res.status(403).send("Acceso denegado");
  res.sendFile(path.join(__dirname, "public", "upload.html"));
});


// Conectar a SQLite
const db = new sqlite3.Database("productos.db");

// Crear tabla si no existe
db.run(`CREATE TABLE IF NOT EXISTS productos (
    id TEXT PRIMARY KEY,
    name TEXT,
    price REAL,
    originalPrice REAL,
    imageSrc TEXT,
    category TEXT
)`);

// Ruta para subir Excel
app.post("/upload-excel/:token",  upload.single("file"), async (req, res) => {

  if (req.params.token !== process.env.SECRET_TOKEN) {
    return res.status(403).send("Acceso denegado");
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const sheet = workbook.worksheets[0]; // primera hoja

    const stmt = db.prepare(`
      INSERT INTO productos (id, name, price, originalPrice, imageSrc, category)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        price=excluded.price,
        originalPrice=excluded.originalPrice,
        imageSrc=excluded.imageSrc,
        category=excluded.category
    `);

    
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // salta encabezados
        let cellValue = row.getCell(5).value;
    
        // Si es un objeto con hyperlink
        if (cellValue && typeof cellValue === 'object' && cellValue.hyperlink) {
          cellValue = cellValue.hyperlink;
        }
      stmt.run([
        row.getCell(1).value, // id
        row.getCell(2).value, // name
        row.getCell(3).value, // price
        row.getCell(4).value, // originalPrice
        cellValue, // imageSrc corregido para URL
        row.getCell(6).value  // category
      ]);
    });

    stmt.finalize();
    res.json({ message: "Productos actualizados con éxito" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ruta para consultar productos
app.get("/productos", (req, res) => {
  db.all("SELECT * FROM productos", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// server.js
app.get("/api/productos", (req, res) => {
  db.all("SELECT * FROM productos", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows); // envia JSON al frontend
  });
});

app.listen(PORT, () => console.log(`Servidor en ${PORT}`));
