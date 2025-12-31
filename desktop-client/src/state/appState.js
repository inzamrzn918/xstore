// Global Application State

const activeSessions = new Map(); // customerID -> { sessionKey, lastSeen, files: [] }
const memoryStorage = new Map(); // fileId -> Buffer (for files < 20MB)
const chunkIndex = new Map(); // fileId -> { chunks: [], totalChunks, originalSize }
const clientFiles = new Map(); // clientId -> file[]
let receivedFiles = [];

// Configuration State
let shopConfig = {
    shopName: '',
    location: '',
    shopID: '',
    ip: '',
    port: 8888
};

let shopSettings = {
    webClient: true,
    mobileApp: true,
    maxFileSize: 100,
    autoDeleteHours: 0,
    soundNotifications: true,
    desktopNotifications: false,
    requireSession: true,
    sessionTimeout: 5,
    serverPort: 8888,
    blockedIPs: [],
    publicAccess: false,
    useCustomDomain: false,
    cloudflareToken: process.env.CLOUDFLARE_TOKEN || '',
    customHostname: process.env.CUSTOM_HOSTNAME || '',
    masterDomain: process.env.MASTER_DOMAIN || ''
};

// Server State
let httpServer = null;
let publicTunnel = null;
let publicURL = null;
let currentPreviewFile = null;
let selectedClientId = null;

module.exports = {
    activeSessions,
    memoryStorage,
    chunkIndex,
    clientFiles,
    get receivedFiles() { return receivedFiles; },
    set receivedFiles(val) { receivedFiles = val; },
    get shopConfig() { return shopConfig; },
    set shopConfig(val) { shopConfig = val; },
    get shopSettings() { return shopSettings; },
    set shopSettings(val) { shopSettings = val; },
    get httpServer() { return httpServer; },
    set httpServer(val) { httpServer = val; },
    get publicTunnel() { return publicTunnel; },
    set publicTunnel(val) { publicTunnel = val; },
    get publicURL() { return publicURL; },
    set publicURL(val) { publicURL = val; },
    get currentPreviewFile() { return currentPreviewFile; },
    set currentPreviewFile(val) { currentPreviewFile = val; },
    get selectedClientId() { return selectedClientId; },
    set selectedClientId(val) { selectedClientId = val; }
};
