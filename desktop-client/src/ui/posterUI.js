const QRCode = require('qrcode');
const { shopConfig, shopSettings, publicURL } = require('../state/appState');

async function generateAndPrintPoster() {
    console.log('[Poster] Generating printable poster...');

    // 1. Prepare Data
    const usePublic = shopSettings.publicAccess && publicURL;
    const baseURL = usePublic ? publicURL : `http://${shopConfig.ip}:${shopConfig.port}`;
    const qrData = `${baseURL}/web?shop=${shopConfig.shopID}`;
    const shopName = shopConfig.shopName || 'PrintShare Shop';
    const location = shopConfig.location || '';

    // 2. Generate High-Res QR Code for Print
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, qrData, {
        width: 800, // High resolution for print
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
    });
    const qrImage = qrCanvas.toDataURL('image/png');

    // 3. Create Print Template
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    margin: 0;
                    padding: 40px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    color: #1f2937;
                    height: 100vh;
                    box-sizing: border-box;
                }
                .brand {
                    font-size: 48px;
                    font-weight: 800;
                    color: #6366f1;
                    margin-bottom: 20px;
                }
                .shop-name {
                    font-size: 72px;
                    font-weight: 900;
                    margin-bottom: 10px;
                    line-height: 1.1;
                }
                .location {
                    font-size: 24px;
                    color: #6b7280;
                    margin-bottom: 40px;
                }
                .qr-wrapper {
                    border: 15px solid #f3f4f6;
                    border-radius: 40px;
                    padding: 30px;
                    background: white;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.05);
                    margin-bottom: 40px;
                }
                .qr-image {
                    width: 500px;
                    height: 500px;
                }
                .instructions {
                    font-size: 32px;
                    font-weight: 600;
                    margin-bottom: 10px;
                }
                .sub-instructions {
                    font-size: 18px;
                    color: #6b7280;
                    margin-bottom: 30px;
                }
                .url {
                    font-family: monospace;
                    font-size: 20px;
                    color: #6366f1;
                    padding: 10px 20px;
                    background: #f5f7ff;
                    border-radius: 10px;
                }
                @media print {
                    body { padding: 0; height: auto; }
                    .qr-wrapper { box-shadow: none; border: 1px solid #eee; }
                }
            </style>
        </head>
        <body>
            <div class="brand">🖨️ PrintShare</div>
            <div class="shop-name">${shopName}</div>
            ${location ? `<div class="location">📍 ${location}</div>` : ''}
            
            <div class="qr-wrapper">
                <img src="${qrImage}" class="qr-image" />
            </div>
            
            <div class="instructions">Scan and Upload Files</div>
            <div class="sub-instructions">Accepting PDF, Images, and Documents</div>
            
            <div class="url">${baseURL}/web</div>
        </body>
        </html>
    `;

    // 4. Trigger Print
    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();

        // Wait for images to load before printing
        printWindow.onload = () => {
            printWindow.print();
            // Optional: close the window after print dialog is closed
            // printWindow.close();
        };
    } else {
        alert('Could not open print window. Please allow popups.');
    }
}

module.exports = {
    generateAndPrintPoster
};
