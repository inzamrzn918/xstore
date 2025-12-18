const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;
let photoEditorWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    // Load main interface
    mainWindow.loadFile('index.html');

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC Handlers for P2P mode

// Get downloads folder path
ipcMain.on('get-downloads-path', (event) => {
    const downloadsPath = path.join(os.homedir(), 'Downloads');
    event.returnValue = downloadsPath;
});

// Open file in default application
ipcMain.on('open-file', (event, filePath) => {
    shell.openPath(filePath);
});

// Save file dialog
ipcMain.handle('save-file', async (event, { data, filename }) => {
    const { filePath } = await dialog.showSaveDialog({
        defaultPath: filename,
        filters: [
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (filePath) {
        fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
        return { success: true, path: filePath };
    }
    return { success: false };
});

// Print file - opens in new window with print preview
ipcMain.handle('print-file', async (event, { filePath, fileName }) => {
    try {
        const ext = path.extname(fileName).toLowerCase();

        // Create a new window for print preview
        const printWindow = new BrowserWindow({
            width: 900,
            height: 700,
            title: `Print: ${fileName}`,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: false,
            },
            autoHideMenuBar: true,
        });

        // For PDFs, load directly
        if (ext === '.pdf') {
            printWindow.loadFile(filePath);
        }
        // For images, create HTML to display them
        else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
            const imageHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Print: ${fileName}</title>
                    <style>
                        body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }
                        img { max-width: 100%; max-height: 90vh; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                        @media print { body { background: white; padding: 0; } img { max-height: none; } }
                    </style>
                </head>
                <body>
                    <img src="file://${filePath.replace(/\\/g, '/')}" alt="${fileName}">
                </body>
                </html>
            `;
            printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(imageHtml));
        }
        // For text files
        else if (ext === '.txt') {
            const content = fs.readFileSync(filePath, 'utf-8');
            const textHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Print: ${fileName}</title>
                    <style>
                        body { font-family: 'Courier New', monospace; padding: 40px; max-width: 800px; margin: 0 auto; background: #f5f5f5; }
                        pre { background: white; padding: 20px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); white-space: pre-wrap; word-wrap: break-word; }
                        @media print { body { background: white; padding: 20px; } pre { box-shadow: none; } }
                    </style>
                </head>
                <body>
                    <pre>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                </body>
                </html>
            `;
            printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(textHtml));
        }
        // For other files, try to load them
        else {
            printWindow.loadFile(filePath);
        }

        // Show print dialog after content loads
        printWindow.webContents.once('did-finish-load', () => {
            setTimeout(() => {
                printWindow.webContents.print({
                    silent: false,
                    printBackground: true,
                }, (success, errorType) => {
                    if (!success) console.log('Print failed:', errorType);
                    printWindow.close();
                });
            }, 500);
        });

        return { success: true };
    } catch (error) {
        console.error('Print error:', error);
        return { success: false, error: error.message };
    }
});

// Get local IP address
ipcMain.handle('get-local-ip', async () => {
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }

    return 'localhost';
});

// Photo Editor Handlers

// Open photo editor
ipcMain.handle('open-photo-editor', async (event, { filePath, fileName, buffer }) => {
    try {
        if (photoEditorWindow) {
            photoEditorWindow.focus();
            photoEditorWindow.webContents.send('edit-image', { filePath, fileName, buffer });
            return { success: true };
        }

        photoEditorWindow = new BrowserWindow({
            width: 1400,
            height: 900,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
            },
            title: 'Photo Editor - XStore',
            backgroundColor: '#1a1a1a',
        });

        photoEditorWindow.loadFile('photo-editor.html');

        // Open DevTools in development
        if (process.env.NODE_ENV === 'development') {
            photoEditorWindow.webContents.openDevTools();
        }

        photoEditorWindow.on('closed', () => {
            photoEditorWindow = null;
        });

        // Send image data once window is ready
        photoEditorWindow.webContents.once('did-finish-load', () => {
            photoEditorWindow.webContents.send('edit-image', { filePath, fileName, buffer });
        });

        return { success: true };
    } catch (error) {
        console.error('Error opening photo editor:', error);
        return { success: false, error: error.message };
    }
});

// Save edited image
ipcMain.handle('save-edited-image', async (event, { buffer, fileName }) => {
    try {
        const { filePath } = await dialog.showSaveDialog({
            defaultPath: fileName,
            filters: [
                { name: 'PNG Image', extensions: ['png'] },
                { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (filePath) {
            fs.writeFileSync(filePath, buffer);
            return { success: true, path: filePath };
        }
        return { success: false };
    } catch (error) {
        console.error('Error saving edited image:', error);
        return { success: false, error: error.message };
    }
});

// Close photo editor
ipcMain.on('close-photo-editor', () => {
    if (photoEditorWindow) {
        photoEditorWindow.close();
    }
});
