const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../inventory.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Error al abrir la base de datos', err);
    else {
        console.log('Base de datos conectada en:', dbPath);
        // CRÍTICO: Activar soporte para claves foráneas
        db.run("PRAGMA foreign_keys = ON");
    }
});

const initDB = () => {
    db.serialize(() => {
        // 1. Tabla de Proveedores
        db.run(`CREATE TABLE IF NOT EXISTS proveedores (
            id_prov INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            contacto TEXT,
            email TEXT,
            telefono TEXT
        )`);

        // 2. Tabla de Productos
        db.run(`CREATE TABLE IF NOT EXISTS productos (
            id_prod INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            sku TEXT UNIQUE,
            precio_compra REAL,
            stock_actual INTEGER DEFAULT 0,
            stock_minimo INTEGER DEFAULT 5,
            id_proveedor INTEGER,
            FOREIGN KEY(id_proveedor) REFERENCES proveedores(id_prov) ON DELETE SET NULL
        )`);

        // 3. Tabla de Historial de Precios
        db.run(`CREATE TABLE IF NOT EXISTS historial_precios (
            id_hist INTEGER PRIMARY KEY AUTOINCREMENT,
            id_producto INTEGER,
            precio_registrado REAL,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(id_producto) REFERENCES productos(id_prod) ON DELETE CASCADE
        )`);

        // 4. NUEVA: Tabla de Usuarios (Seguridad y Roles)
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id_user INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('ADMIN', 'USER')),
            last_login TIMESTAMP
        )`);

        // 5. TRIGGER: Automatización de Historial
        db.run(`
            CREATE TRIGGER IF NOT EXISTS log_precio_update
            AFTER UPDATE OF precio_compra ON productos
            BEGIN
                INSERT INTO historial_precios (id_producto, precio_registrado)
                VALUES (new.id_prod, new.precio_compra);
            END
        `);

        // 6. SEMBRADO (SEEDING): Crear Admin por defecto si no existe
        // Usuario: admin | Pass: admin123
        db.get("SELECT count(*) as count FROM usuarios", (err, row) => {
            if (!err && row.count === 0) {
                console.log("Primer inicio detectado: Creando cuentas maestras...");
                db.run(`INSERT INTO usuarios (username, password, role) VALUES 
                    ('admin', 'admin123', 'ADMIN'),
                    ('operador', 'user123', 'USER')`);
            }
        });
    });
};

module.exports = { db, initDB };