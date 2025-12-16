# 🖨️ PrintShare - Like UPI for Print Shops

A peer-to-peer file sharing system for print shops that works exactly like UPI payment QR codes - simple, fast, and secure.

**Built with:** Expo (Mobile) + Electron (Desktop)

---

## 🎯 How It Works (Like UPI QR)

### Architecture

```
┌─────────────────────┐
│  Print Shop Desktop │  Each shop has static QR
│  (Receiver Only)    │  (Like UPI Merchant QR)
│                     │
│  🏪 Shows QR Code   │
└──────────┬──────────┘
           │
           │ Customer scans QR
           │
┌──────────▼──────────┐
│   Customer Mobile   │
│   (Sender Only)     │
│                     │
│  1. Scan Shop QR    │
│  2. Select Files    │
│  3. Send to Print   │
└─────────────────────┘
```

### Key Features
- ✅ **Static Shop QR** - Each shop has one permanent QR code (like UPI)
- ✅ **No IP Configuration** - Everything automatic
- ✅ **Printable Files Only** - PDF, images, documents
- ✅ **Direct P2P Transfer** - No internet needed
- ✅ **Transfer History** - Track all sent files

---

## 🚀 Quick Start

### For Print Shop (Desktop)

1. **Install & Run**
   ```bash
   cd desktop-client
   npm install
   npm start
   ```

2. **First Time Setup**
   - Enter shop name (e.g., "Quick Print Services")
   - Enter location (optional)
   - Click "Save & Generate QR Code"

3. **Display QR Code**
   - Your permanent shop QR code will appear
   - Print it or display on screen
   - Customers scan this to connect

4. **Receive Files**
   - Files appear automatically in "Incoming Files"
   - Preview, open, or save files
   - Track statistics

### For Customers (Mobile)

1. **Install Expo Go** from Play Store/App Store

2. **Run Development Server**
   ```bash
   cd mobile-app
   npm install
   npm start
   ```

3. **Scan Development QR** with Expo Go app

4. **Use the App**
   - Tap "Scan Shop QR Code"
   - Scan the print shop's QR code
   - Select files to print (PDF, images, docs)
   - Tap "Send to Shop"
   - Done!

---

## 📱 User Flow

### Customer Journey

1. **Walk into Print Shop**
   - See shop's QR code displayed

2. **Open PrintShare App**
   - Tap "Scan Shop QR Code"
   - Point camera at shop's QR

3. **Connected!**
   - App shows shop name and location
   - Ready to send files

4. **Select Files**
   - Tap "Select Files"
   - Choose PDF, images, or documents
   - Can select multiple files

5. **Send**
   - Tap "Send to [Shop Name]"
   - Files transfer directly
   - See confirmation

6. **Done!**
   - Files appear on shop's computer
   - Shop can print immediately

### Shop Owner Journey

1. **One-Time Setup**
   - Open desktop app
   - Enter shop details
   - Generate QR code

2. **Display QR**
   - Print QR code poster
   - Or show on screen
   - Customers scan this

3. **Receive Files**
   - Files appear automatically
   - Preview before printing
   - Open in default app
   - Print directly

4. **Manage Files**
   - View all received files
   - See customer info
   - Delete old files
   - Track statistics

---

## 🔒 Security & Privacy

- **Local Network Only** - Files never go to internet
- **Same WiFi Required** - Shop and customer must be on same network
- **Session-Based** - Each connection is temporary
- **No Cloud Storage** - Everything stays local
- **Printable Files Only** - Limited to safe file types

---

## 📦 Supported File Types

### Documents
- PDF (`.pdf`)
- Word (`.doc`, `.docx`)
- Excel (`.xls`, `.xlsx`)
- Text (`.txt`)

### Images
- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- GIF (`.gif`)
- WebP (`.webp`)

### Archives
- ZIP (`.zip`)
- RAR (`.rar`)

---

## 🛠️ Technical Details

### Desktop (Electron)
- **Static QR Code** - Contains shop ID, IP, and port
- **HTTP Server** - Receives files on port 8888
- **File Management** - Preview, open, delete files
- **Statistics** - Track total files, size, today's count
- **Auto IP Detection** - Finds local network IP automatically

### Mobile (Expo/React Native)
- **QR Scanner** - Uses device camera
- **File Picker** - Select multiple files
- **HTTP Upload** - Direct file transfer
- **Transfer History** - Remember recent shops
- **Progress Tracking** - Show upload progress

### Communication
- **QR Code Format**:
  ```json
  {
    "type": "printshare",
    "shopName": "Quick Print",
    "shopID": "SHOP-ABC123",
    "ip": "192.168.1.100",
    "port": 8888,
    "location": "Main Street"
  }
  ```

- **File Upload**: HTTP POST to `http://{ip}:{port}/upload`
- **No Backend Server** - Pure P2P communication

---

## 📊 Desktop Features

### Main Screen
- **Static QR Code Display** - Always visible
- **Shop Information** - Name, IP, ID
- **Incoming Files List** - Real-time updates
- **File Preview** - View before printing
- **Statistics Dashboard** - Total files, size, today's count

### File Management
- **Preview** - Click to preview file
- **Open** - Open in default application
- **Delete** - Remove old files
- **Auto-Save** - Files saved to `~/PrintShare/`

### Settings
- **Change Shop Details** - Update name/location
- **Regenerate QR** - Create new shop ID
- **View Statistics** - Detailed analytics

---

## 📱 Mobile Features

### Main Screen
- **Scan QR Button** - Large, prominent
- **Recent Shops** - Quick access to previous shops
- **Transfer History** - See all sent files

### Connected Mode
- **Shop Info Card** - Shows connected shop
- **File Selection** - Multi-file picker
- **Upload Progress** - Real-time progress bar
- **Send Button** - Clear call-to-action

### History
- **File Name** - What was sent
- **Shop Name** - Where it was sent
- **Timestamp** - When it was sent
- **Status** - Success/Failed

---

## 🐛 Troubleshooting

### Desktop Issues

**"Cannot start server"**
- Port 8888 might be in use
- App will auto-increment to 8889, 8890, etc.
- Check firewall settings

**"QR code not generating"**
- Check network connection
- Ensure WiFi is connected
- Restart application

**"Files not appearing"**
- Check firewall allows incoming connections
- Verify mobile is on same WiFi
- Check `~/PrintShare/` folder

### Mobile Issues

**"Cannot scan QR code"**
- Grant camera permission
- Ensure good lighting
- Hold steady on QR code

**"Upload failed"**
- Check WiFi connection
- Ensure same network as shop
- Try smaller files first
- Check file type is supported

**"Shop not found"**
- Verify shop's desktop app is running
- Check both on same WiFi network
- Rescan QR code

---

## 🎨 Customization

### Desktop - Change Shop Details
1. Click "Change Shop Details" button
2. Update shop name or location
3. Click "Save & Generate QR Code"
4. New QR code will be generated

### Mobile - Clear History
- History is stored locally
- Uninstall/reinstall app to clear
- Or wait for 50+ entries (auto-cleanup)

---

## 📁 File Locations

### Desktop
- **Config**: `~/.printshare/config.json`
- **Received Files**: `~/PrintShare/`
- **File List**: `~/.printshare/received_files.json`

### Mobile
- **History**: `{DocumentDirectory}/print_history.json`
- **Temp Files**: Expo cache (auto-cleaned)

---

## 🚀 Building for Production

### Desktop Installers

```bash
cd desktop-client

# Add to package.json:
"build:win": "electron-builder --win",
"build:mac": "electron-builder --mac",
"build:linux": "electron-builder --linux"

# Build
npm run build:win
```

### Mobile APK/IPA

```bash
cd mobile-app

# Install EAS CLI
npm install -g eas-cli

# Configure
eas build:configure

# Build Android APK
eas build --platform android --profile preview

# Build iOS
eas build --platform ios
```

---

## 💡 Use Cases

### Print Shops
- Customer file submission
- Document printing
- Photo printing
- Bulk file transfers

### Copy Centers
- Student assignments
- Business documents
- Presentations
- Certificates

### Photo Studios
- Event photos
- Portrait sessions
- Product photography
- Wedding photos

### Offices
- Visitor file sharing
- Conference materials
- Training documents
- Quick file exchange

---

## 🎯 Advantages Over Traditional Methods

| Method | PrintShare | USB/Email | Cloud Upload |
|--------|-----------|-----------|--------------|
| **Speed** | ⚡ Instant | 🐌 Slow | 🐌 Slow |
| **Privacy** | 🔒 100% Local | ⚠️ Physical | ❌ Internet |
| **Setup** | ✅ Scan QR | ❌ Plug/Login | ❌ Account |
| **Cost** | ✅ Free | 💰 USB Cost | 💰 Data Cost |
| **Security** | ✅ P2P | ⚠️ Device Risk | ❌ Cloud Risk |

---

## 📈 Future Enhancements

- [ ] Print job queue management
- [ ] Payment integration
- [ ] File format conversion
- [ ] Print preview
- [ ] Multi-shop support
- [ ] Cloud backup option
- [ ] Receipt generation
- [ ] Customer accounts

---

## 🤝 Support

For issues or questions:
1. Check troubleshooting section
2. Verify both devices on same WiFi
3. Restart both applications
4. Check firewall settings

---

**Made with ❤️ for seamless printing**

**No Internet • No Configuration • Just Scan & Print**
