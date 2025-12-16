const { ipcRenderer } = require('electron');
const PhotoEditor = require('./src/services/photoEditor');

let editor = new PhotoEditor();
let currentImagePath = null;
let currentImageName = 'Untitled';
let zoomLevel = 1.0;

// Selection tool state
let activeSelectionTool = null;
let selectionStart = null;
let selectionPath = [];
let isDrawingSelection = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Photo Editor initialized');

    // Listen for image to edit
    ipcRenderer.on('edit-image', async (event, { filePath, fileName, buffer }) => {
        await loadImageForEditing(filePath || buffer, fileName);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                e.preventDefault();
                undo();
            } else if (e.key === 'y') {
                e.preventDefault();
                redo();
            } else if (e.key === 's') {
                e.preventDefault();
                saveImage();
            }
        }
    });
});

/**
 * Load image for editing
 */
async function loadImageForEditing(source, fileName = 'Untitled') {
    try {
        showLoading(true);

        console.log('=== Loading Image ===');
        console.log('Source type:', typeof source);
        console.log('Source is Buffer?', Buffer.isBuffer(source));
        console.log('Source is Uint8Array?', source instanceof Uint8Array);
        console.log('Source keys:', source ? Object.keys(source).slice(0, 10) : 'null');
        console.log('Source.type:', source?.type);
        console.log('Source.data exists?', !!source?.data);
        console.log('FileName:', fileName);

        currentImagePath = typeof source === 'string' ? source : null;
        currentImageName = fileName;

        // Convert buffer to data URL if needed
        let imageSource = source;

        // Check if source is a Uint8Array (from IPC, Buffers become Uint8Array)
        if (source instanceof Uint8Array) {
            console.log('Detected Uint8Array from IPC, length:', source.length);
            // Convert Uint8Array to Buffer
            const buffer = Buffer.from(source);
            console.log('Converted to Buffer, size:', buffer.length);

            // Convert buffer to base64 data URL
            const base64 = buffer.toString('base64');
            console.log('Base64 length:', base64.length);
            // Detect image type from file extension
            const ext = fileName.toLowerCase().split('.').pop();
            const mimeType = ext === 'png' ? 'image/png' :
                ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                    ext === 'gif' ? 'image/gif' :
                        ext === 'bmp' ? 'image/bmp' :
                            ext === 'webp' ? 'image/webp' : 'image/png';
            imageSource = `data:${mimeType};base64,${base64}`;
            console.log('Created data URL with mime type:', mimeType);
        }
        // Check if source is a buffer-like object (from IPC it might be serialized)
        else if (source && typeof source === 'object' && (source.type === 'Buffer' || source.data)) {
            console.log('Detected serialized Buffer from IPC');
            // Reconstruct Buffer from serialized data
            const bufferData = source.data || source;
            console.log('Buffer data length:', Array.isArray(bufferData) ? bufferData.length : 'not an array');
            const buffer = Buffer.from(bufferData);
            console.log('Reconstructed buffer size:', buffer.length);

            // Convert buffer to base64 data URL
            const base64 = buffer.toString('base64');
            console.log('Base64 length:', base64.length);
            // Detect image type from file extension
            const ext = fileName.toLowerCase().split('.').pop();
            const mimeType = ext === 'png' ? 'image/png' :
                ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                    ext === 'gif' ? 'image/gif' :
                        ext === 'bmp' ? 'image/bmp' :
                            ext === 'webp' ? 'image/webp' : 'image/png';
            imageSource = `data:${mimeType};base64,${base64}`;
            console.log('Created data URL with mime type:', mimeType);
        } else if (Buffer.isBuffer(source)) {
            console.log('Detected native Buffer');
            // Convert buffer to base64 data URL
            const base64 = source.toString('base64');
            // Detect image type from file extension
            const ext = fileName.toLowerCase().split('.').pop();
            const mimeType = ext === 'png' ? 'image/png' :
                ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                    ext === 'gif' ? 'image/gif' :
                        ext === 'bmp' ? 'image/bmp' :
                            ext === 'webp' ? 'image/webp' : 'image/png';
            imageSource = `data:${mimeType};base64,${base64}`;
            console.log('Created data URL from native Buffer');
        } else if (typeof source === 'string') {
            console.log('Source is string (file path or data URL)');
        } else {
            console.error('Unknown source type!', source);
        }

        console.log('Calling editor.loadImage...');
        const result = await editor.loadImage(imageSource);
        console.log('Image loaded successfully:', result);

        // Update UI
        document.getElementById('imageName').textContent = fileName;
        updateDimensions();
        renderCanvas();

        // Initialize resize panel values
        document.getElementById('resizeWidth').value = result.width;
        document.getElementById('resizeHeight').value = result.height;

        // Initialize crop panel values
        document.getElementById('cropWidth').value = result.width;
        document.getElementById('cropHeight').value = result.height;

        showLoading(false);
    } catch (error) {
        console.error('Error loading image:', error);
        console.error('Error stack:', error.stack);
        alert('Failed to load image: ' + error.message);
        showLoading(false);
    }
}

/**
 * Render canvas to display
 */
function renderCanvas() {
    const canvas = document.getElementById('editorCanvas');
    const dataURL = editor.getDataURL();

    const img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        updateDimensions();
    };
    img.src = dataURL;
}

/**
 * Update dimensions display
 */
function updateDimensions() {
    const dims = editor.getDimensions();
    document.getElementById('imageDimensions').textContent =
        `${dims.width} × ${dims.height} px`;
}

/**
 * Show/hide loading overlay
 */
function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

/**
 * Show properties panel
 */
function showPanel(panelName) {
    // Hide all panels
    const panels = document.querySelectorAll('.panel');
    panels.forEach(panel => panel.style.display = 'none');

    // Show selected panel
    const panel = document.getElementById(panelName + 'Panel');
    if (panel) {
        panel.style.display = 'block';
    }
}

/**
 * Update slider value display
 */
function updateSliderValue(name, value) {
    document.getElementById(name + 'Value').textContent = value;
}

/**
 * Undo
 */
function undo() {
    if (editor.undo()) {
        renderCanvas();
    }
}

/**
 * Redo
 */
function redo() {
    if (editor.redo()) {
        renderCanvas();
    }
}

/**
 * Reset image
 */
function resetImage() {
    if (confirm('Reset image to original? This cannot be undone.')) {
        showLoading(true);
        editor.reset();
        renderCanvas();
        showLoading(false);
    }
}

/**
 * Resize image
 */
function applyResize() {
    const width = parseInt(document.getElementById('resizeWidth').value);
    const height = parseInt(document.getElementById('resizeHeight').value);
    const maintainAspect = document.getElementById('maintainAspect').checked;

    if (width > 0 && height > 0) {
        showLoading(true);
        setTimeout(() => {
            editor.resize(width, height, maintainAspect);
            renderCanvas();
            showLoading(false);
        }, 100);
    }
}

/**
 * Crop image
 */
function applyCrop() {
    const x = parseInt(document.getElementById('cropX').value);
    const y = parseInt(document.getElementById('cropY').value);
    const width = parseInt(document.getElementById('cropWidth').value);
    const height = parseInt(document.getElementById('cropHeight').value);

    if (width > 0 && height > 0) {
        showLoading(true);
        setTimeout(() => {
            editor.crop(x, y, width, height);
            renderCanvas();
            showLoading(false);
        }, 100);
    }
}

/**
 * Rotate image
 */
function rotateImage(degrees) {
    showLoading(true);
    setTimeout(() => {
        editor.rotate(degrees);
        renderCanvas();
        showLoading(false);
    }, 100);
}

/**
 * Flip horizontal
 */
function flipHorizontal() {
    showLoading(true);
    setTimeout(() => {
        editor.flipHorizontal();
        renderCanvas();
        showLoading(false);
    }, 100);
}

/**
 * Flip vertical
 */
function flipVertical() {
    showLoading(true);
    setTimeout(() => {
        editor.flipVertical();
        renderCanvas();
        showLoading(false);
    }, 100);
}

/**
 * Apply brightness
 */
function applyBrightness() {
    const value = parseInt(document.getElementById('brightnessSlider').value);
    showLoading(true);
    setTimeout(() => {
        editor.adjustBrightness(value);
        renderCanvas();
        document.getElementById('brightnessSlider').value = 0;
        document.getElementById('brightnessValue').textContent = 0;
        showLoading(false);
    }, 100);
}

/**
 * Apply contrast
 */
function applyContrast() {
    const value = parseInt(document.getElementById('contrastSlider').value);
    showLoading(true);
    setTimeout(() => {
        editor.adjustContrast(value);
        renderCanvas();
        document.getElementById('contrastSlider').value = 0;
        document.getElementById('contrastValue').textContent = 0;
        showLoading(false);
    }, 100);
}

/**
 * Apply saturation
 */
function applySaturation() {
    const value = parseFloat(document.getElementById('saturationSlider').value);
    showLoading(true);
    setTimeout(() => {
        editor.adjustSaturation(value);
        renderCanvas();
        document.getElementById('saturationSlider').value = 1;
        document.getElementById('saturationValue').textContent = '1.0';
        showLoading(false);
    }, 100);
}

/**
 * Apply blur
 */
function applyBlur() {
    const radius = parseInt(document.getElementById('blurSlider').value);
    showLoading(true);
    setTimeout(() => {
        editor.blur(radius);
        renderCanvas();
        showLoading(false);
    }, 100);
}

/**
 * Apply filter
 */
function applyFilter(filterName) {
    showLoading(true);
    setTimeout(() => {
        switch (filterName) {
            case 'grayscale':
                editor.grayscale();
                break;
            case 'sepia':
                editor.sepia();
                break;
            case 'invert':
                editor.invert();
                break;
            case 'sharpen':
                editor.sharpen();
                break;
            case 'edge':
                editor.edgeDetect();
                break;
            case 'emboss':
                editor.emboss();
                break;
        }
        renderCanvas();
        showLoading(false);
    }, 100);
}

/**
 * Apply text
 */
function applyText() {
    const text = document.getElementById('textInput').value;
    const fontSize = parseInt(document.getElementById('fontSize').value);
    const color = document.getElementById('textColor').value;
    const x = parseInt(document.getElementById('textX').value);
    const y = parseInt(document.getElementById('textY').value);

    if (text) {
        showLoading(true);
        setTimeout(() => {
            editor.addText(text, x, y, {
                font: `${fontSize}px Arial`,
                color: color
            });
            renderCanvas();
            document.getElementById('textInput').value = '';
            showLoading(false);
        }, 100);
    }
}

/**
 * Apply shape
 */
function applyShape() {
    const type = document.getElementById('shapeType').value;
    const x = parseInt(document.getElementById('shapeX').value);
    const y = parseInt(document.getElementById('shapeY').value);
    const width = parseInt(document.getElementById('shapeWidth').value);
    const height = parseInt(document.getElementById('shapeHeight').value);
    const fillColor = document.getElementById('shapeFillColor').value;
    const strokeColor = document.getElementById('shapeStrokeColor').value;
    const lineWidth = parseInt(document.getElementById('shapeLineWidth').value);

    showLoading(true);
    setTimeout(() => {
        editor.drawShape(type, x, y, width, height, {
            fillColor: fillColor,
            strokeColor: strokeColor,
            lineWidth: lineWidth
        });
        renderCanvas();
        showLoading(false);
    }, 100);
}

/**
 * Zoom in
 */
function zoomIn() {
    zoomLevel = Math.min(3.0, zoomLevel + 0.1);
    updateZoom();
}

/**
 * Zoom out
 */
function zoomOut() {
    zoomLevel = Math.max(0.1, zoomLevel - 0.1);
    updateZoom();
}

/**
 * Zoom to fit
 */
function zoomFit() {
    zoomLevel = 1.0;
    updateZoom();
}

/**
 * Update zoom
 */
function updateZoom() {
    const canvas = document.getElementById('editorCanvas');
    canvas.style.transform = `scale(${zoomLevel})`;
    document.getElementById('zoomLevel').textContent = Math.round(zoomLevel * 100) + '%';
}

/**
 * Save image
 */
async function saveImage() {
    try {
        const buffer = editor.getBuffer('png');
        const result = await ipcRenderer.invoke('save-edited-image', {
            buffer: buffer,
            fileName: currentImageName
        });

        if (result.success) {
            alert('Image saved successfully!');
        } else {
            alert('Failed to save image');
        }
    } catch (error) {
        console.error('Error saving image:', error);
        alert('Failed to save image: ' + error.message);
    }
}

/**
 * Close editor
 */
function closeEditor() {
    if (confirm('Close editor? Unsaved changes will be lost.')) {
        ipcRenderer.send('close-photo-editor');
    }
}

// ==================== LAYER MANAGEMENT ====================

/**
 * Toggle layers panel
 */
function toggleLayersPanel() {
    const panel = document.getElementById('layersPanel');
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'flex';

    if (!isVisible) {
        updateLayersList();
    }
}

/**
 * Add new layer
 */
function addNewLayer() {
    const layerInfo = editor.addLayer();
    updateLayersList();
    renderCanvas();
}

/**
 * Delete current layer
 */
function deleteCurrentLayer() {
    try {
        const activeIndex = getActiveLayerIndex();
        if (activeIndex >= 0) {
            if (confirm('Delete this layer?')) {
                editor.deleteLayer(activeIndex);
                updateLayersList();
                renderCanvas();
            }
        }
    } catch (error) {
        alert(error.message);
    }
}

/**
 * Duplicate current layer
 */
function duplicateCurrentLayer() {
    const activeIndex = getActiveLayerIndex();
    if (activeIndex >= 0) {
        editor.duplicateLayer(activeIndex);
        updateLayersList();
        renderCanvas();
    }
}

/**
 * Merge current layer down
 */
function mergeCurrentLayer() {
    try {
        const activeIndex = getActiveLayerIndex();
        if (activeIndex >= 0) {
            if (confirm('Merge this layer with the layer below?')) {
                editor.mergeLayerDown(activeIndex);
                updateLayersList();
                renderCanvas();
            }
        }
    } catch (error) {
        alert(error.message);
    }
}

/**
 * Flatten all layers
 */
function flattenAllLayers() {
    if (confirm('Flatten all layers? This cannot be undone.')) {
        editor.flattenLayers();
        updateLayersList();
        renderCanvas();
    }
}

/**
 * Change layer opacity
 */
function changeLayerOpacity(value) {
    document.getElementById('layerOpacityValue').textContent = value;
    const activeIndex = getActiveLayerIndex();
    if (activeIndex >= 0) {
        editor.setLayerOpacity(activeIndex, parseInt(value));
        renderCanvas();
    }
}

/**
 * Change layer blend mode
 */
function changeLayerBlendMode() {
    const blendMode = document.getElementById('layerBlendMode').value;
    const activeIndex = getActiveLayerIndex();
    if (activeIndex >= 0) {
        editor.setLayerBlendMode(activeIndex, blendMode);
        renderCanvas();
    }
}

/**
 * Get active layer index
 */
function getActiveLayerIndex() {
    const layerInfo = editor.getLayerInfo();
    return layerInfo.findIndex(layer => layer.isActive);
}

/**
 * Update layers list UI
 */
function updateLayersList() {
    const layersList = document.getElementById('layersList');
    const layerInfo = editor.getLayerInfo();

    layersList.innerHTML = '';

    // Display layers in reverse order (top to bottom)
    for (let i = layerInfo.length - 1; i >= 0; i--) {
        const layer = layerInfo[i];
        const layerItem = createLayerItem(layer, i);
        layersList.appendChild(layerItem);
    }

    // Update opacity and blend mode controls for active layer
    const activeLayer = layerInfo.find(l => l.isActive);
    if (activeLayer) {
        document.getElementById('layerOpacity').value = activeLayer.opacity;
        document.getElementById('layerOpacityValue').textContent = activeLayer.opacity;
        document.getElementById('layerBlendMode').value = activeLayer.blendMode;
    }
}

/**
 * Create layer item element
 */
function createLayerItem(layer, index) {
    const div = document.createElement('div');
    div.className = 'layer-item' + (layer.isActive ? ' active' : '') + (layer.locked ? ' locked' : '');
    div.onclick = () => selectLayer(index);

    // Visibility toggle
    const visBtn = document.createElement('button');
    visBtn.className = 'layer-visibility';
    visBtn.innerHTML = layer.visible ? '👁️' : '🚫';
    visBtn.onclick = (e) => {
        e.stopPropagation();
        toggleLayerVisibility(index);
    };
    div.appendChild(visBtn);

    // Thumbnail (placeholder for now)
    const thumb = document.createElement('div');
    thumb.className = 'layer-thumbnail';
    thumb.innerHTML = '🖼️';
    div.appendChild(thumb);

    // Layer info
    const info = document.createElement('div');
    info.className = 'layer-info';

    const name = document.createElement('div');
    name.className = 'layer-name';
    name.textContent = layer.name;
    if (layer.locked) {
        name.innerHTML += ' <span class="layer-lock-icon">🔒</span>';
    }
    info.appendChild(name);

    const details = document.createElement('div');
    details.className = 'layer-details';
    details.textContent = `${layer.blendMode} • ${layer.opacity}%`;
    info.appendChild(details);

    div.appendChild(info);

    // Layer controls
    const controls = document.createElement('div');
    controls.className = 'layer-controls';

    if (!layer.locked) {
        const upBtn = document.createElement('button');
        upBtn.innerHTML = '↑';
        upBtn.title = 'Move Up';
        upBtn.onclick = (e) => {
            e.stopPropagation();
            moveLayerUp(index);
        };
        controls.appendChild(upBtn);

        const downBtn = document.createElement('button');
        downBtn.innerHTML = '↓';
        downBtn.title = 'Move Down';
        downBtn.onclick = (e) => {
            e.stopPropagation();
            moveLayerDown(index);
        };
        controls.appendChild(downBtn);
    }

    div.appendChild(controls);

    return div;
}

/**
 * Select layer
 */
function selectLayer(index) {
    editor.setActiveLayer(index);
    updateLayersList();
}

/**
 * Toggle layer visibility
 */
function toggleLayerVisibility(index) {
    editor.toggleLayerVisibility(index);
    updateLayersList();
    renderCanvas();
}

/**
 * Move layer up
 */
function moveLayerUp(index) {
    editor.moveLayerUp(index);
    updateLayersList();
    renderCanvas();
}

/**
 * Move layer down
 */
function moveLayerDown(index) {
    editor.moveLayerDown(index);
    updateLayersList();
    renderCanvas();
}

// ==================== SELECTION TOOLS ====================

/**
 * Activate selection tool
 */
function activateSelectionTool(tool) {
    activeSelectionTool = tool;

    // Update button states
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${tool}SelectBtn`)?.classList.add('active');

    // Setup canvas event listeners
    const canvas = document.getElementById('editorCanvas');
    canvas.style.cursor = 'crosshair';

    // Remove old listeners and add new ones
    canvas.onmousedown = handleSelectionMouseDown;
    canvas.onmousemove = handleSelectionMouseMove;
    canvas.onmouseup = handleSelectionMouseUp;
}

/**
 * Handle mouse down for selection
 */
function handleSelectionMouseDown(e) {
    if (!activeSelectionTool) return;

    const rect = e.target.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;

    isDrawingSelection = true;
    selectionStart = { x, y };
    selectionPath = [{ x, y }];

    if (activeSelectionTool === 'wand') {
        // Magic wand - immediate selection
        const tolerance = parseInt(document.getElementById('wandTolerance').value) || 32;
        editor.selectMagicWand(Math.floor(x), Math.floor(y), tolerance, true);
        renderCanvas();
        drawSelectionOverlay();
        isDrawingSelection = false;
    }
}

/**
 * Handle mouse move for selection
 */
function handleSelectionMouseMove(e) {
    if (!isDrawingSelection || !activeSelectionTool) return;

    const rect = e.target.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;

    if (activeSelectionTool === 'lasso') {
        selectionPath.push({ x, y });
        // Draw preview
        drawSelectionPreview();
    } else if (activeSelectionTool === 'rectangle' || activeSelectionTool === 'ellipse') {
        // Draw preview rectangle/ellipse
        drawSelectionPreview(x, y);
    }
}

/**
 * Handle mouse up for selection
 */
function handleSelectionMouseUp(e) {
    if (!isDrawingSelection || !activeSelectionTool) return;

    const rect = e.target.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;

    isDrawingSelection = false;

    if (activeSelectionTool === 'rectangle') {
        const width = x - selectionStart.x;
        const height = y - selectionStart.y;
        editor.selectRectangle(
            Math.min(selectionStart.x, x),
            Math.min(selectionStart.y, y),
            Math.abs(width),
            Math.abs(height)
        );
    } else if (activeSelectionTool === 'ellipse') {
        const width = x - selectionStart.x;
        const height = y - selectionStart.y;
        editor.selectEllipse(
            Math.min(selectionStart.x, x),
            Math.min(selectionStart.y, y),
            Math.abs(width),
            Math.abs(height)
        );
    } else if (activeSelectionTool === 'lasso') {
        if (selectionPath.length > 2) {
            editor.selectLasso(selectionPath);
        }
    }

    renderCanvas();
    drawSelectionOverlay();
    selectionPath = [];
}

/**
 * Draw selection preview
 */
function drawSelectionPreview(currentX, currentY) {
    renderCanvas();

    const canvas = document.getElementById('editorCanvas');
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    if (activeSelectionTool === 'rectangle' && selectionStart) {
        const width = currentX - selectionStart.x;
        const height = currentY - selectionStart.y;
        ctx.strokeRect(selectionStart.x, selectionStart.y, width, height);
    } else if (activeSelectionTool === 'ellipse' && selectionStart) {
        const width = currentX - selectionStart.x;
        const height = currentY - selectionStart.y;
        const cx = selectionStart.x + width / 2;
        const cy = selectionStart.y + height / 2;
        const rx = Math.abs(width / 2);
        const ry = Math.abs(height / 2);

        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.stroke();
    } else if (activeSelectionTool === 'lasso' && selectionPath.length > 0) {
        ctx.beginPath();
        ctx.moveTo(selectionPath[0].x, selectionPath[0].y);
        for (let i = 1; i < selectionPath.length; i++) {
            ctx.lineTo(selectionPath[i].x, selectionPath[i].y);
        }
        ctx.stroke();
    }

    ctx.restore();
}

/**
 * Draw selection overlay (marching ants)
 */
function drawSelectionOverlay() {
    const selectionInfo = editor.getSelectionInfo();
    if (!selectionInfo.active || !selectionInfo.bounds) return;

    const canvas = document.getElementById('editorCanvas');
    const ctx = canvas.getContext('2d');
    const bounds = selectionInfo.bounds;

    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.restore();
}

/**
 * Select all
 */
function selectAllImage() {
    editor.selectAll();
    renderCanvas();
    drawSelectionOverlay();
}

/**
 * Deselect all
 */
function deselectAll() {
    editor.deselect();
    activeSelectionTool = null;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));

    const canvas = document.getElementById('editorCanvas');
    canvas.style.cursor = 'default';
    canvas.onmousedown = null;
    canvas.onmousemove = null;
    canvas.onmouseup = null;

    renderCanvas();
}

/**
 * Invert selection
 */
function invertSelectionOp() {
    editor.invertSelection();
    renderCanvas();
    drawSelectionOverlay();
}

/**
 * Apply feather to selection
 */
function applyFeather() {
    const radius = parseInt(document.getElementById('featherRadius').value) || 5;
    editor.featherSelection(radius);
    renderCanvas();
    drawSelectionOverlay();
}

/**
 * Grow selection
 */
function applyGrow() {
    const pixels = parseInt(document.getElementById('growPixels').value) || 5;
    editor.growSelection(pixels);
    renderCanvas();
    drawSelectionOverlay();
}

/**
 * Shrink selection
 */
function applyShrink() {
    const pixels = parseInt(document.getElementById('shrinkPixels').value) || 5;
    editor.shrinkSelection(pixels);
    renderCanvas();
    drawSelectionOverlay();
}

/**
 * Fill selected area
 */
function fillSelectedArea() {
    const color = document.getElementById('fillColor').value;
    editor.fillSelection(color);
    renderCanvas();
    drawSelectionOverlay();
}

/**
 * Stroke selected area
 */
function strokeSelectedArea() {
    const color = document.getElementById('strokeColor').value;
    const width = parseInt(document.getElementById('strokeWidth').value) || 2;
    editor.strokeSelection(color, width);
    renderCanvas();
    drawSelectionOverlay();
}

// ==================== LAYOUT TOGGLE ====================

/**
 * Toggle PS7.0 classic layout
 */
function togglePS70Layout() {
    document.body.classList.toggle('ps70-layout');

    // Save preference
    const isPS70 = document.body.classList.contains('ps70-layout');
    localStorage.setItem('ps70-layout', isPS70);
}

// Load layout preference on startup
document.addEventListener('DOMContentLoaded', () => {
    const savedLayout = localStorage.getItem('ps70-layout');
    if (savedLayout === 'true') {
        document.body.classList.add('ps70-layout');
    }
});

// Make functions available globally
window.showPanel = showPanel;
window.updateSliderValue = updateSliderValue;
window.undo = undo;
window.redo = redo;
window.resetImage = resetImage;
window.applyResize = applyResize;
window.applyCrop = applyCrop;
window.rotateImage = rotateImage;
window.flipHorizontal = flipHorizontal;
window.flipVertical = flipVertical;
window.applyBrightness = applyBrightness;
window.applyContrast = applyContrast;
window.applySaturation = applySaturation;
window.applyBlur = applyBlur;
window.applyFilter = applyFilter;
window.applyText = applyText;
window.applyShape = applyShape;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.zoomFit = zoomFit;
window.saveImage = saveImage;
window.closeEditor = closeEditor;

// Layer management
window.toggleLayersPanel = toggleLayersPanel;
window.addNewLayer = addNewLayer;
window.deleteCurrentLayer = deleteCurrentLayer;
window.duplicateCurrentLayer = duplicateCurrentLayer;
window.mergeCurrentLayer = mergeCurrentLayer;
window.flattenAllLayers = flattenAllLayers;
window.changeLayerOpacity = changeLayerOpacity;
window.changeLayerBlendMode = changeLayerBlendMode;

// Selection tools
window.activateSelectionTool = activateSelectionTool;
window.selectAllImage = selectAllImage;
window.deselectAll = deselectAll;
window.invertSelectionOp = invertSelectionOp;
window.applyFeather = applyFeather;
window.applyGrow = applyGrow;
window.applyShrink = applyShrink;
window.fillSelectedArea = fillSelectedArea;
window.strokeSelectedArea = strokeSelectedArea;

// Layout toggle
window.togglePS70Layout = togglePS70Layout;
