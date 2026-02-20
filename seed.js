const { db } = require('./src/services/dbService');

console.log("🚀 Iniciando proceso de seed con integridad referencial...");

// Envolvemos todo en un proceso serializado
db.serialize(() => {
    // 1. Iniciar Transacción (Seguridad de Nivel Profesional)
    db.run("BEGIN TRANSACTION");

    try {
        // 2. Limpieza con Reseteo de Contadores (Vaciamos y reiniciamos IDs)
        db.run("DELETE FROM historial_precios");
        db.run("DELETE FROM productos");
        db.run("DELETE FROM proveedores");
        db.run("DELETE FROM sqlite_sequence WHERE name IN ('proveedores', 'productos', 'historial_precios')");

        console.log("🧹 Limpieza de tablas completada.");

        // 3. Inserción de Proveedores
        const stmtProv = db.prepare("INSERT INTO proveedores (nombre, contacto, email, telefono) VALUES (?, ?, ?, ?)");
        stmtProv.run("TecnoChile", "Carlos Ruiz", "ventas@tecnochile.cl", "+56912345678");
        stmtProv.run("Importadora Omega", "Lucía Sanz", "lsanz@omega.com", "+56987654321");
        stmtProv.finalize();

        // 4. Inserción de Productos
        // Usamos los IDs explícitos para asegurar que el mapeo sea perfecto en el seed
        const stmtProd = db.prepare(`
            INSERT INTO productos (id_prod, nombre, sku, precio_compra, stock_actual, stock_minimo, id_proveedor) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        // Productos de TecnoChile (ID Proveedor: 1)
        stmtProd.run(1, "Monitor 24' LED", "MON24-001", 120000, 3, 5, 1);
        stmtProd.run(2, "Teclado Mecánico RGB", "KB-RGB-02", 45000, 15, 10, 1);
        stmtProd.run(3, "Mouse Gamer G502", "MS-G502", 35000, 2, 8, 1);

        // Productos de Importadora Omega (ID Proveedor: 2)
        stmtProd.run(4, "Cable HDMI 4K 3m", "HDMI-4K3", 8500, 50, 20, 2);
        stmtProd.run(5, "Hub USB-C 7 en 1", "HUB-71", 28000, 4, 10, 2);
        stmtProd.run(6, "Cargador Notebook Uni", "CH-UNI-90", 15000, 12, 5, 2);
        stmtProd.finalize();

        // 5. Inserción de Historial (Datos de telemetría para Phi-3)
        const stmtHist = db.prepare("INSERT INTO historial_precios (id_producto, precio_registrado, fecha) VALUES (?, ?, ?)");
        // Simulamos fluctuación de precios para el Monitor (ID: 1)
        stmtHist.run(1, 115000, '2026-01-15 10:00:00');
        stmtHist.run(1, 118000, '2026-02-01 14:30:00');
        // El Mouse (ID: 3) bajó de precio
        stmtHist.run(3, 38000, '2026-01-10 09:00:00');
        stmtHist.finalize();

        // 6. Confirmar Cambios
        db.run("COMMIT", (err) => {
            if (err) throw err;
            console.log("✅ Transacción exitosa: Base de datos poblada.");
            console.log("📊 Datos listos para análisis con Phi-3.");
        });

    } catch (error) {
        // Si algo falla, deshacemos todo para no dejar la DB a medias
        db.run("ROLLBACK");
        console.error("❌ Error crítico en el Seed (Se hizo Rollback):", error.message);
    }
});