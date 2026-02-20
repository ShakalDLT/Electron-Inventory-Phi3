const { ipcRenderer } = require('electron');
const { db } = require('../services/dbService');
const phi3 = require('../services/phi3Service');
const fs = require('fs');
const path = require('path');

/**
 * SESIÓN Y PERMISOS (Estado Privado)
 */
let currentUser = null;

const ROLES = {
    ADMIN: 'ADMIN',
    USER: 'USER'
};

/**
 * CONTROL DE VENTANA
 */
const windowClose = () => ipcRenderer.send('window-control', 'close');
const windowMinimize = () => ipcRenderer.send('window-control', 'minimize');
const windowMaximize = () => ipcRenderer.send('window-control', 'maximize');

/**
 * MOTOR DE NAVEGACIÓN DINÁMICA (SPA)
 */
async function switchView(viewName) {
    // Protección: Si no hay usuario y no es la vista login, rebotar al login
    if (!currentUser && viewName !== 'login') {
        switchView('login');
        return;
    }

    // Gestión Visual
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-${viewName}`);
    if (activeBtn) activeBtn.classList.add('active');

    try {
        const viewPath = path.join(__dirname, 'views', `${viewName}.html`);
        const htmlContent = fs.readFileSync(viewPath, 'utf8');
        document.getElementById('view-loader').innerHTML = htmlContent;

        initializeViewData(viewName);
    } catch (error) {
        console.error(`Error de carga: ${viewName}`, error);
    }
}

/**
 * LÓGICA DE LOGIN (CONSULTA REAL A DB)
 */
async function handleLogin() {
    const userVal = document.getElementById('login-user').value.trim();
    const passVal = document.getElementById('login-pass').value.trim();
    const errorMsg = document.getElementById('login-error');
    const loginBtn = document.querySelector('.login-btn');

    if (!userVal || !passVal) return;

    loginBtn.disabled = true;
    loginBtn.innerText = "VERIFICANDO...";

    // Consulta blindada a la tabla de usuarios
    const query = `SELECT username, role FROM usuarios WHERE username = ? AND password = ?`;
    
    db.get(query, [userVal, passVal], (err, row) => {
        if (err || !row) {
            errorMsg.style.display = 'block';
            loginBtn.disabled = false;
            loginBtn.innerText = "ENTRAR AL SISTEMA";
            document.getElementById('login-pass').value = ""; // Limpiar por seguridad
            return;
        }

        // Login Exitoso
        currentUser = { name: row.username, role: row.role };
        
        // Actualizar UI
        document.getElementById('top-nav').style.display = 'flex';
        applyPermissions();
        
        // Redirección inteligente
        row.role === ROLES.ADMIN ? switchView('ia') : switchView('inventory');
    });
}

function logout() {
    currentUser = null;
    document.getElementById('top-nav').style.display = 'none';
    switchView('login');
}

/**
 * APLICAR PERMISOS DE INTERFAZ
 */
function applyPermissions() {
    const isAdmin = currentUser?.role === ROLES.ADMIN;
    
    // Visibilidad selectiva de botones
    const navItems = {
        'btn-ia': isAdmin,
        'btn-admin': isAdmin,
        'btn-inventory': true // Siempre visible para ambos
    };

    Object.keys(navItems).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = navItems[id] ? 'flex' : 'none';
    });

    // Mostrar nombre de usuario en el Nav si existe el contenedor
    const userSpan = document.getElementById('user-info');
    if (userSpan) userSpan.innerText = `${currentUser.name} (${currentUser.role})`;
}

/**
 * INICIALIZADOR DE DATOS POR CONTEXTO
 */
function initializeViewData(viewName) {
    switch (viewName) {
        case 'inventory':
            cargarInventarioCompleto();
            break;
        case 'admin':
            if (currentUser.role === ROLES.ADMIN) {
                cargarTablaCRUD();
                actualizarSelectProveedores();
            } else {
                switchView('inventory'); // Redirección forzada si intenta entrar por consola
            }
            break;
        case 'ia':
            if (currentUser.role !== ROLES.ADMIN) switchView('inventory');
            break;
    }
}

/**
 * OPERACIONES CRUD (PROTEGIDAS POR SOFTWARE)
 */
function agregarProducto() {
    if (currentUser?.role !== ROLES.ADMIN) return;

    const fields = {
        nombre: document.getElementById('form-nombre')?.value.trim(),
        sku: document.getElementById('form-sku')?.value.trim(),
        precio: parseFloat(document.getElementById('form-precio')?.value),
        stock: parseInt(document.getElementById('form-stock')?.value),
        id_prov: document.getElementById('form-proveedor')?.value
    };

    if (!fields.nombre || !fields.sku || isNaN(fields.precio)) return alert("Datos inválidos.");

    const query = `INSERT INTO productos (nombre, sku, precio_compra, stock_actual, id_proveedor) VALUES (?, ?, ?, ?, ?)`;
    
    db.run(query, [fields.nombre, fields.sku, fields.precio, fields.stock || 0, fields.id_prov], (err) => {
        if (err) alert("Error: SKU duplicado.");
        else {
            cargarTablaCRUD();
            limpiarFormularioAdmin();
        }
    });
}

function borrarProducto(id) {
    if (currentUser?.role !== ROLES.ADMIN) return;
    if (confirm("¿Eliminar registro?")) {
        db.run("DELETE FROM productos WHERE id_prod = ?", [id], () => cargarTablaCRUD());
    }
}

function editarProducto(id) {
    if (currentUser?.role !== ROLES.ADMIN) return;
    const nuevoStock = prompt("Nuevo Stock:");
    if (nuevoStock && !isNaN(nuevoStock)) {
        db.run("UPDATE productos SET stock_actual = ? WHERE id_prod = ?", [nuevoStock, id], () => {
            // Actualiza la vista donde estés
            if (document.getElementById('admin-table-container')) cargarTablaCRUD();
            else cargarInventarioCompleto();
        });
    }
}

/**
 * GESTIÓN DE IA (CON BLOQUEO DE SEGURIDAD)
 */
async function consultarIA() {
    if (currentUser?.role !== ROLES.ADMIN) return;
    
    const input = document.getElementById('ia-input');
    const consoleBox = document.getElementById('ia-console');
    const resultBox = document.getElementById('ia-data-container');
    
    if (!input || !input.value.trim()) return;

    try {
        consoleBox.innerHTML = '<span class="terminal-prefix">>_</span> <span class="pulse">Analizando DB...</span>';
        input.disabled = true;

        db.all("SELECT nombre, stock_actual, stock_minimo FROM productos", [], async (err, rows) => {
            const contexto = JSON.stringify(rows);
            const rta = await phi3.preguntar(`Contexto: ${contexto}. Consulta: ${input.value}`);
            
            consoleBox.innerHTML = '<span class="terminal-prefix">>_</span> Análisis finalizado.';
            resultBox.innerHTML = `<div class="ai-text-blob">${rta}</div>`;
        });
    } catch (e) {
        consoleBox.innerText = "❌ Error Crítico IA.";
    } finally {
        if (input) { input.disabled = false; input.value = ""; }
    }
}

/**
 * MOTOR DE RENDERIZADO DE TABLAS
 */
function renderTabla(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!data.length) {
        container.innerHTML = '<div class="empty-state">Sin registros.</div>';
        return;
    }

    let html = `<table><thead><tr>`;
    Object.keys(data[0]).forEach(key => html += `<th>${key.toUpperCase().replace('_', ' ')}</th>`);
    
    if (containerId === 'admin-table-container' && currentUser.role === ROLES.ADMIN) {
        html += `<th>ACCIONES</th>`;
    }
    
    html += `</tr></thead><tbody>`;

    data.forEach(row => {
        const isLow = (row.STOCK ?? row.stock_actual) <= (row.MIN ?? row.stock_minimo);
        html += `<tr class="${isLow ? 'row-warning' : ''}">`;
        Object.values(row).forEach(val => html += `<td>${val ?? '---'}</td>`);

        if (containerId === 'admin-table-container' && currentUser.role === ROLES.ADMIN) {
            html += `
                <td class="actions">
                    <button class="btn-sm btn-edit" onclick="editarProducto(${row.id_prod || row.ID})">✏️</button>
                    <button class="btn-sm btn-delete" onclick="borrarProducto(${row.id_prod || row.ID})">🗑️</button>
                </td>`;
        }
        html += `</tr>`;
    });
    container.innerHTML = html + `</tbody></table>`;
}

/**
 * CONSULTAS DB
 */
function cargarInventarioCompleto() {
    const query = `
        SELECT p.id_prod as ID, p.nombre, p.sku, p.stock_actual as STOCK, p.stock_minimo as MIN, prov.nombre as PROVEEDOR 
        FROM productos p 
        LEFT JOIN proveedores prov ON p.id_proveedor = prov.id_prov
    `;
    db.all(query, [], (err, rows) => { if (!err) renderTabla(rows, 'inventory-table-container'); });
}

function cargarTablaCRUD() {
    db.all("SELECT id_prod, nombre, sku, stock_actual, precio_compra FROM productos", [], (err, rows) => {
        if (!err) renderTabla(rows, 'admin-table-container');
    });
}

function actualizarSelectProveedores() {
    const select = document.getElementById('form-proveedor');
    if (!select) return;
    db.all("SELECT id_prov, nombre FROM proveedores", [], (err, rows) => {
        if (!err) {
            select.innerHTML = '<option value="">Seleccione...</option>' + 
                rows.map(p => `<option value="${p.id_prov}">${p.nombre}</option>`).join('');
        }
    });
}

function limpiarFormularioAdmin() {
    const form = document.getElementById('product-form');
    if (form) form.reset();
}

/**
 * ARRANQUE INICIAL
 */
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('top-nav').style.display = 'none';
    switchView('login');
});