// ===========================
// Global State
// ===========================
let shopInfo = null;
let selectedFiles = [];
let sessionKey = null;
let customerID = null;
let heartbeatInterval = null;
let cameraStream = null;
let currentCamera = 'user'; // 'user' for front, 'environment' for back

// ===========================
// Initialization
// ===========================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('PrintShare Web Client initialized');

    // Get shop ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const shopId = urlParams.get('shop');

    if (!shopId) {
        showError('Invalid URL', 'Shop ID not found in URL. Please scan the QR code again.');
        return;
    }

    // Connect to shop
    await connectToShop(shopId);

    // Setup event listeners
    setupEventListeners();
});

// ===========================
// Connection & Session
// ===========================
async function connectToShop(shopId) {
    try {
        updateStatus('connecting', 'Connecting...');

        // Fetch shop information
        const response = await fetch('/info');
        if (!response.ok) throw new Error('Failed to fetch shop info');

        shopInfo = await response.json();

        // Verify shop ID matches
        if (shopInfo.shopID !== shopId) {
            throw new Error('Shop ID mismatch');
        }

        // Display shop information
        displayShopInfo();

        // Start session
        await startSession();

        // Show app
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('app').style.display = 'block';

        updateStatus('connected', 'Connected');
        showToast('Connected to ' + shopInfo.shopName, 'success');

    } catch (error) {
        console.error('Connection error:', error);
        showError('Connection Failed', 'Could not connect to the print shop. Please make sure you are on the same WiFi network.');
    }
}

async function startSession() {
    // Generate customer ID and session key
    customerID = 'WEB-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    sessionKey = generateSessionKey();
    const deviceName = getDeviceName();

    try {
        const response = await fetch('/session/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                customerID,
                sessionKey,
                deviceName
            })
        });

        if (!response.ok) throw new Error('Session start failed');

        console.log('Session started:', customerID);

        // Start heartbeat
        startHeartbeat();

        // End session on page unload
        window.addEventListener('beforeunload', endSession);

    } catch (error) {
        console.error('Session start error:', error);
        throw error;
    }
}

function startHeartbeat() {
    // Send heartbeat every 10 seconds
    heartbeatInterval = setInterval(async () => {
        try {
            const response = await fetch('/session/heartbeat', {
                method: 'POST',
                headers: {
                    'X-Customer-ID': customerID
                }
            });

            if (response.status === 404) {
                // Session lost on server, try to reconnect
                console.warn('Session lost, reconnecting...');
                await startSession();
            }
        } catch (error) {
            console.error('Heartbeat error:', error);
            // If server is unreachable, we'll just wait for the next interval
        }
    }, 10000);
}

async function endSession() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }

    try {
        await fetch('/session/end', {
            method: 'POST',
            headers: {
                'X-Customer-ID': customerID
            }
        });
    } catch (error) {
        console.error('Session end error:', error);
    }
}

function generateSessionKey() {
    return Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 16).toString(16)
    ).join('');
}

// ===========================
// UI Updates
// ===========================
function displayShopInfo() {
    document.getElementById('shopName').textContent = shopInfo.shopName;
    document.getElementById('shopLocation').textContent = shopInfo.location || '';
    document.getElementById('shopId').textContent = shopInfo.shopID;
    document.title = `PrintShare - ${shopInfo.shopName}`;
}

function updateStatus(type, text) {
    const statusBadge = document.getElementById('connectionStatus');
    statusBadge.className = `status-badge status-${type}`;
    statusBadge.querySelector('.status-text').textContent = text;
}

// ===========================
// Event Listeners
// ===========================
function setupEventListeners() {
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const cameraBtn = document.getElementById('cameraBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const clearFilesBtn = document.getElementById('clearFilesBtn');
    const sendMoreBtn = document.getElementById('sendMoreBtn');
    const retryBtn = document.getElementById('retryBtn');

    // File input - reset value after selection to allow re-selecting same files
    fileInput.addEventListener('change', handleFileSelect);
    fileInput.addEventListener('click', (e) => {
        // Reset value to allow selecting same file again
        e.target.value = '';
    });

    // Drop zone - only trigger on direct clicks, not on label clicks
    dropZone.addEventListener('click', (e) => {
        // Prevent double trigger when clicking the label
        if (e.target.tagName !== 'LABEL' && !e.target.closest('label')) {
            fileInput.click();
        }
    });
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // Camera
    cameraBtn.addEventListener('click', openCamera);
    document.getElementById('closeCameraBtn').addEventListener('click', closeCamera);
    document.getElementById('captureBtn').addEventListener('click', capturePhoto);
    document.getElementById('switchCameraBtn').addEventListener('click', switchCamera);

    // Upload
    uploadBtn.addEventListener('click', uploadFiles);
    clearFilesBtn.addEventListener('click', clearFiles);
    sendMoreBtn.addEventListener('click', resetUpload);
    retryBtn.addEventListener('click', resetUpload);
}

// ===========================
// File Selection
// ===========================
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
        addFiles(files);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    const files = Array.from(event.dataTransfer.files);
    addFiles(files);
}

function addFiles(files) {
    // Filter valid files
    const validFiles = files.filter(file => {
        const validTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'application/zip', 'application/x-rar-compressed'
        ];

        return validTypes.includes(file.type) ||
            file.name.match(/\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx|txt|zip|rar)$/i);
    });

    if (validFiles.length === 0) {
        showToast('No valid files selected. Please select images, PDFs, or documents.', 'error');
        return;
    }

    // Check for large files and warn user
    const largeFiles = validFiles.filter(f => f.size > 50 * 1024 * 1024); // >50MB
    if (largeFiles.length > 0) {
        const fileNames = largeFiles.map(f => f.name).join(', ');
        showToast(`Large file(s) detected: ${fileNames}. Upload may take longer.`, 'info');
    }

    // Add to selected files (avoid duplicates)
    validFiles.forEach(file => {
        const isDuplicate = selectedFiles.some(f =>
            f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
        );
        if (!isDuplicate) {
            selectedFiles.push(file);
        }
    });

    updateFilesList();

    const addedCount = validFiles.length;
    if (addedCount > 0) {
        showToast(`${addedCount} file(s) added`, 'success');
    }
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFilesList();
}

function clearFiles() {
    selectedFiles = [];
    updateFilesList();
    // Reset file input
    const fileInput = document.getElementById('fileInput');
    fileInput.value = '';
}

function updateFilesList() {
    const filesList = document.getElementById('filesList');
    const filesContainer = document.getElementById('filesContainer');
    const fileCount = document.getElementById('fileCount');
    const uploadBtnContainer = document.getElementById('uploadBtnContainer');

    if (selectedFiles.length === 0) {
        filesList.style.display = 'none';
        uploadBtnContainer.style.display = 'none';
        return;
    }

    filesList.style.display = 'block';
    uploadBtnContainer.style.display = 'block';
    fileCount.textContent = selectedFiles.length;

    filesContainer.innerHTML = selectedFiles.map((file, index) => `
        <div class="file-item">
            <div class="file-item-icon">${getFileIcon(file)}</div>
            <div class="file-item-details">
                <div class="file-item-name">${file.name}</div>
                <div class="file-item-size">${formatFileSize(file.size)}</div>
            </div>
            <button class="file-item-remove" onclick="removeFile(${index})">×</button>
        </div>
    `).join('');
}

// ===========================
// Camera Capture
// ===========================
async function openCamera() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');

    try {
        // Request camera permission
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentCamera },
            audio: false
        });

        video.srcObject = cameraStream;
        modal.style.display = 'flex';

        // Check if device has multiple cameras
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        if (videoDevices.length > 1) {
            document.getElementById('switchCameraBtn').style.display = 'inline-flex';
        }

    } catch (error) {
        console.error('Camera error:', error);
        showToast('Could not access camera. Please grant camera permission.', 'error');
    }
}

function closeCamera() {
    const modal = document.getElementById('cameraModal');

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    modal.style.display = 'none';
}

async function switchCamera() {
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }

    await openCamera();
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const context = canvas.getContext('2d');

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0);

    // Convert canvas to blob
    canvas.toBlob((blob) => {
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        addFiles([file]);
        closeCamera();
        showToast('Photo captured!', 'success');
    }, 'image/jpeg', 0.9);
}

// ===========================
// File Upload
// ===========================
async function uploadFiles() {
    if (selectedFiles.length === 0) return;

    const uploadBtn = document.getElementById('uploadBtn');
    const progressSection = document.getElementById('progressSection');
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    const progressText = document.getElementById('progressText');
    const progressDetails = document.getElementById('progressDetails');

    uploadBtn.disabled = true;
    progressSection.style.display = 'block';

    let uploadedCount = 0;
    const totalFiles = selectedFiles.length;

    try {
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];

            progressText.textContent = `Uploading ${file.name}...`;
            progressDetails.textContent = `File ${i + 1} of ${totalFiles}`;

            await uploadFile(file, (progress) => {
                const totalProgress = ((i + progress) / totalFiles) * 100;
                progressFill.style.width = totalProgress + '%';
                progressPercent.textContent = Math.round(totalProgress) + '%';
            });

            uploadedCount++;
        }

        // Success
        showSuccess();

    } catch (error) {
        console.error('Upload error:', error);
        showError('Upload Failed', error.message || 'An error occurred while uploading files. Please try again.');
    } finally {
        uploadBtn.disabled = false;
    }
}

async function uploadFile(file, onProgress) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
                const progress = event.loaded / event.total;
                onProgress(progress);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                reject(new Error('Upload failed with status ' + xhr.status));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Network error'));
        });

        xhr.open('POST', '/upload');
        xhr.setRequestHeader('X-Customer-ID', customerID);
        xhr.setRequestHeader('X-Session-Key', sessionKey);
        xhr.send(formData);
    });
}

// ===========================
// UI States
// ===========================
function showSuccess() {
    document.querySelector('.upload-section').style.display = 'none';
    document.getElementById('successMessage').style.display = 'block';
}

function showError(title, message) {
    document.getElementById('loadingScreen').style.display = 'none';
    document.querySelector('.upload-section').style.display = 'none';
    document.getElementById('errorTitle').textContent = title;
    document.getElementById('errorText').textContent = message;
    document.getElementById('errorMessage').style.display = 'block';
    updateStatus('error', 'Error');
}

function resetUpload() {
    clearFiles();
    document.getElementById('successMessage').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('progressSection').style.display = 'none';
    document.querySelector('.upload-section').style.display = 'block';
    updateStatus('connected', 'Connected');
}

// ===========================
// Toast Notifications
// ===========================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===========================
// Utility Functions
// ===========================
function getFileIcon(file) {
    const name = file.name.toLowerCase();

    if (name.match(/\.(jpg|jpeg|png|gif|webp)$/)) return '🖼️';
    if (name.match(/\.pdf$/)) return '📄';
    if (name.match(/\.(doc|docx)$/)) return '📝';
    if (name.match(/\.(xls|xlsx)$/)) return '📊';
    if (name.match(/\.txt$/)) return '📃';
    if (name.match(/\.(zip|rar)$/)) return '📦';

    return '📎';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getDeviceName() {
    const ua = navigator.userAgent;
    let os = "Unknown Device";
    let browser = "Web Client";

    // Detect OS
    if (ua.indexOf("Android") !== -1) os = "Android";
    else if (ua.indexOf("iPhone") !== -1) os = "iPhone";
    else if (ua.indexOf("iPad") !== -1) os = "iPad";
    else if (ua.indexOf("Windows") !== -1) os = "Windows";
    else if (ua.indexOf("Macintosh") !== -1) os = "Mac";
    else if (ua.indexOf("Linux") !== -1) os = "Linux";

    // Detect Browser
    if (ua.indexOf("Chrome") !== -1) browser = "Chrome";
    else if (ua.indexOf("Safari") !== -1) browser = "Safari";
    else if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
    else if (ua.indexOf("Edge") !== -1) browser = "Edge";

    return `${os} ${browser}`;
}

// Make functions globally accessible
window.removeFile = removeFile;
