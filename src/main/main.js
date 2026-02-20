const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { initDB } = require('../services/dbService');

/**
 * CONFIGURACIÓN DE VENTANA PRINCIPAL
 * Blindaje: Sin marco nativo y gestión de estados de ventana.
 */
function createWindow() {
    // Inicialización de persistencia
    initDB();

    const win = new BrowserWindow({
        width: 1300,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        frame: false, // ELIMINA LA BARRA NATIVA
        backgroundColor: '#1e293b', // Evita el "flash" blanco al cargar
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // Para uso de require en renderer (Nivel desarrollo/título)
            enableRemoteModule: true
        }
    });

    win.loadFile('src/renderer/index.html');

    // --- GESTIÓN DE BOTONES CUSTOM TITLE BAR (IPC) ---
    
    ipcMain.on('window-control', (event, action) => {
        const webContents = event.sender;
        const window = BrowserWindow.fromWebContents(webContents);
        
        if (!window) return;

        switch (action) {
            case 'minimize':
                window.minimize();
                break;
            case 'maximize':
                if (window.isMaximized()) {
                    window.unmaximize();
                } else {
                    window.maximize();
                }
                break;
            case 'close':
                window.close();
                break;
        }
    });

    // Gestión de links externos (Papeleo/PDFs)
    ipcMain.on('open-external', (event, url) => {
        shell.openExternal(url);
    });

    // Opcional: Auto-abrir devtools si estás en desarrollo
    // win.webContents.openDevTools();
}

/**
 * SEGURIDAD Y TOLERANCIA A FALLOS (CMMI 5)
 */

// Captura de errores para evitar cierres inesperados del proceso principal
process.on('uncaughtException', (error) => {
    console.error('CRITICAL ERROR:', error);
    // Aquí podrías añadir un logger a archivo
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});