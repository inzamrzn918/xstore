/**
 * Photo Editor Module
 * Comprehensive image editing capabilities for XStore
 * Now with Photoshop 7.0-style layers and selection support
 */

const { createCanvas, loadImage, Image } = require('canvas');
const fs = require('fs');
const path = require('path');
const { LayerManager } = require('./layerManager');
const Selection = require('./selectionManager');

class PhotoEditor {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.originalImage = null;
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 20;

        // Layer system
        this.layerManager = new LayerManager();
        this.useLayerSystem = true; // Toggle for layer-based editing

        // Selection system
        this.selection = null;
        this.selectionVisible = true;
    }

    /**
     * Load an image from file path, buffer, or data URL
     */
    async loadImage(source) {
        try {
            let imageData;

            console.log('Loading image, source type:', typeof source);
            console.log('Is Buffer?', Buffer.isBuffer(source));
            console.log('Source preview:', typeof source === 'string' ? source.substring(0, 100) : 'Not a string');

            if (Buffer.isBuffer(source)) {
                console.log('Loading from Buffer');
                imageData = source;
            } else if (typeof source === 'string') {
                // Check if it's a data URL
                if (source.startsWith('data:')) {
                    console.log('Loading from data URL');
                    // It's a data URL, use it directly
                    imageData = source;
                } else {
                    console.log('Loading from file path');
                    // It's a file path
                    imageData = fs.readFileSync(source);
                }
            } else {
                console.error('Invalid source type:', typeof source, source);
                throw new Error('Invalid image source - must be Buffer, file path, or data URL');
            }

            const img = await loadImage(imageData);
            this.originalImage = img;

            // Create canvas with image dimensions
            this.canvas = createCanvas(img.width, img.height);
            this.ctx = this.canvas.getContext('2d');
            this.ctx.drawImage(img, 0, 0);

            // Initialize layer system
            if (this.useLayerSystem) {
                this.layerManager.initialize(img.width, img.height, img);
            }

            // Save initial state
            this.saveState();

            return {
                width: img.width,
                height: img.height,
                success: true
            };
        } catch (error) {
            console.error('Error loading image:', error);
            throw error;
        }
    }

    /**
     * Save current state to history
     */
    saveState() {
        // Remove any states after current index
        this.history = this.history.slice(0, this.historyIndex + 1);

        // Save current canvas state
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.history.push(imageData);
        this.historyIndex++;

        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    /**
     * Undo last operation
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const imageData = this.history[this.historyIndex];
            this.ctx.putImageData(imageData, 0, 0);
            return true;
        }
        return false;
    }

    /**
     * Redo last undone operation
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const imageData = this.history[this.historyIndex];
            this.ctx.putImageData(imageData, 0, 0);
            return true;
        }
        return false;
    }

    /**
     * Reset to original image
     */
    reset() {
        if (this.originalImage) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(this.originalImage, 0, 0);
            this.saveState();
        }
    }

    /**
     * Resize image
     */
    resize(width, height, maintainAspectRatio = true) {
        if (maintainAspectRatio) {
            const aspectRatio = this.canvas.width / this.canvas.height;
            if (width && !height) {
                height = width / aspectRatio;
            } else if (height && !width) {
                width = height * aspectRatio;
            }
        }

        const tempCanvas = createCanvas(this.canvas.width, this.canvas.height);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.canvas, 0, 0);

        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.drawImage(tempCanvas, 0, 0, width, height);

        this.saveState();
    }

    /**
     * Crop image
     */
    crop(x, y, width, height) {
        const tempCanvas = createCanvas(width, height);
        const tempCtx = tempCanvas.getContext('2d');

        const imageData = this.ctx.getImageData(x, y, width, height);
        tempCtx.putImageData(imageData, 0, 0);

        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.drawImage(tempCanvas, 0, 0);

        this.saveState();
    }

    /**
     * Rotate image
     */
    rotate(degrees) {
        const radians = (degrees * Math.PI) / 180;
        const cos = Math.abs(Math.cos(radians));
        const sin = Math.abs(Math.sin(radians));

        const newWidth = this.canvas.width * cos + this.canvas.height * sin;
        const newHeight = this.canvas.width * sin + this.canvas.height * cos;

        const tempCanvas = createCanvas(this.canvas.width, this.canvas.height);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.canvas, 0, 0);

        this.canvas.width = newWidth;
        this.canvas.height = newHeight;
        this.ctx = this.canvas.getContext('2d');

        this.ctx.translate(newWidth / 2, newHeight / 2);
        this.ctx.rotate(radians);
        this.ctx.drawImage(tempCanvas, -tempCanvas.width / 2, -tempCanvas.height / 2);
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);

        this.saveState();
    }

    /**
     * Flip image horizontally
     */
    flipHorizontal() {
        const tempCanvas = createCanvas(this.canvas.width, this.canvas.height);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.canvas, 0, 0);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.translate(this.canvas.width, 0);
        this.ctx.scale(-1, 1);
        this.ctx.drawImage(tempCanvas, 0, 0);
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);

        this.saveState();
    }

    /**
     * Flip image vertically
     */
    flipVertical() {
        const tempCanvas = createCanvas(this.canvas.width, this.canvas.height);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.canvas, 0, 0);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.translate(0, this.canvas.height);
        this.ctx.scale(1, -1);
        this.ctx.drawImage(tempCanvas, 0, 0);
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);

        this.saveState();
    }

    /**
     * Adjust brightness
     */
    adjustBrightness(value) {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, Math.max(0, data[i] + value));     // R
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + value)); // G
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + value)); // B
        }

        this.ctx.putImageData(imageData, 0, 0);
        this.saveState();
    }

    /**
     * Adjust contrast
     */
    adjustContrast(value) {
        const factor = (259 * (value + 255)) / (255 * (259 - value));
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
            data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
            data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
        }

        this.ctx.putImageData(imageData, 0, 0);
        this.saveState();
    }

    /**
     * Adjust saturation
     */
    adjustSaturation(value) {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;

            data[i] = Math.min(255, Math.max(0, gray + value * (r - gray)));
            data[i + 1] = Math.min(255, Math.max(0, gray + value * (g - gray)));
            data[i + 2] = Math.min(255, Math.max(0, gray + value * (b - gray)));
        }

        this.ctx.putImageData(imageData, 0, 0);
        this.saveState();
    }

    /**
     * Convert to grayscale
     */
    grayscale() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }

        this.ctx.putImageData(imageData, 0, 0);
        this.saveState();
    }

    /**
     * Apply sepia filter
     */
    sepia() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
            data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
            data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
        }

        this.ctx.putImageData(imageData, 0, 0);
        this.saveState();
    }

    /**
     * Invert colors
     */
    invert() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
        }

        this.ctx.putImageData(imageData, 0, 0);
        this.saveState();
    }

    /**
     * Apply blur effect
     */
    blur(radius = 5) {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const blurred = this.gaussianBlur(imageData, radius);
        this.ctx.putImageData(blurred, 0, 0);
        this.saveState();
    }

    /**
     * Gaussian blur implementation
     */
    gaussianBlur(imageData, radius) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const output = new Uint8ClampedArray(data);

        const kernel = this.createGaussianKernel(radius);
        const kernelSize = kernel.length;
        const half = Math.floor(kernelSize / 2);

        // Horizontal pass
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, a = 0;

                for (let k = 0; k < kernelSize; k++) {
                    const px = Math.min(width - 1, Math.max(0, x + k - half));
                    const offset = (y * width + px) * 4;
                    const weight = kernel[k];

                    r += data[offset] * weight;
                    g += data[offset + 1] * weight;
                    b += data[offset + 2] * weight;
                    a += data[offset + 3] * weight;
                }

                const offset = (y * width + x) * 4;
                output[offset] = r;
                output[offset + 1] = g;
                output[offset + 2] = b;
                output[offset + 3] = a;
            }
        }

        // Vertical pass
        const temp = new Uint8ClampedArray(output);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, a = 0;

                for (let k = 0; k < kernelSize; k++) {
                    const py = Math.min(height - 1, Math.max(0, y + k - half));
                    const offset = (py * width + x) * 4;
                    const weight = kernel[k];

                    r += temp[offset] * weight;
                    g += temp[offset + 1] * weight;
                    b += temp[offset + 2] * weight;
                    a += temp[offset + 3] * weight;
                }

                const offset = (y * width + x) * 4;
                output[offset] = r;
                output[offset + 1] = g;
                output[offset + 2] = b;
                output[offset + 3] = a;
            }
        }

        return new ImageData(output, width, height);
    }

    /**
     * Create Gaussian kernel
     */
    createGaussianKernel(radius) {
        const sigma = radius / 3;
        const size = 2 * radius + 1;
        const kernel = new Array(size);
        let sum = 0;

        for (let i = 0; i < size; i++) {
            const x = i - radius;
            kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
            sum += kernel[i];
        }

        // Normalize
        for (let i = 0; i < size; i++) {
            kernel[i] /= sum;
        }

        return kernel;
    }

    /**
     * Sharpen image
     */
    sharpen() {
        const kernel = [
            0, -1, 0,
            -1, 5, -1,
            0, -1, 0
        ];
        this.applyConvolution(kernel);
        this.saveState();
    }

    /**
     * Apply edge detection
     */
    edgeDetect() {
        const kernel = [
            -1, -1, -1,
            -1, 8, -1,
            -1, -1, -1
        ];
        this.applyConvolution(kernel);
        this.saveState();
    }

    /**
     * Apply emboss effect
     */
    emboss() {
        const kernel = [
            -2, -1, 0,
            -1, 1, 1,
            0, 1, 2
        ];
        this.applyConvolution(kernel);
        this.saveState();
    }

    /**
     * Apply convolution matrix
     */
    applyConvolution(kernel) {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const output = new Uint8ClampedArray(data.length);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let r = 0, g = 0, b = 0;

                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const offset = ((y + ky) * width + (x + kx)) * 4;
                        const weight = kernel[(ky + 1) * 3 + (kx + 1)];

                        r += data[offset] * weight;
                        g += data[offset + 1] * weight;
                        b += data[offset + 2] * weight;
                    }
                }

                const offset = (y * width + x) * 4;
                output[offset] = Math.min(255, Math.max(0, r));
                output[offset + 1] = Math.min(255, Math.max(0, g));
                output[offset + 2] = Math.min(255, Math.max(0, b));
                output[offset + 3] = data[offset + 3];
            }
        }

        this.ctx.putImageData(new ImageData(output, width, height), 0, 0);
    }

    /**
     * Add text to image
     */
    addText(text, x, y, options = {}) {
        const {
            font = '30px Arial',
            color = '#000000',
            align = 'left',
            baseline = 'top',
            maxWidth = null
        } = options;

        this.ctx.font = font;
        this.ctx.fillStyle = color;
        this.ctx.textAlign = align;
        this.ctx.textBaseline = baseline;

        if (maxWidth) {
            this.ctx.fillText(text, x, y, maxWidth);
        } else {
            this.ctx.fillText(text, x, y);
        }

        this.saveState();
    }

    /**
     * Draw shape
     */
    drawShape(type, x, y, width, height, options = {}) {
        const {
            fillColor = null,
            strokeColor = '#000000',
            lineWidth = 2
        } = options;

        this.ctx.lineWidth = lineWidth;
        this.ctx.strokeStyle = strokeColor;

        if (fillColor) {
            this.ctx.fillStyle = fillColor;
        }

        this.ctx.beginPath();

        switch (type) {
            case 'rectangle':
                this.ctx.rect(x, y, width, height);
                break;
            case 'circle':
                const radius = Math.min(width, height) / 2;
                this.ctx.arc(x + width / 2, y + height / 2, radius, 0, 2 * Math.PI);
                break;
            case 'ellipse':
                this.ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, 2 * Math.PI);
                break;
        }

        if (fillColor) {
            this.ctx.fill();
        }
        this.ctx.stroke();

        this.saveState();
    }

    /**
     * Get image as buffer
     */
    getBuffer(format = 'png', quality = 0.9) {
        const mimeType = format === 'jpeg' || format === 'jpg' ? 'image/jpeg' : 'image/png';
        return this.canvas.toBuffer(mimeType, { quality });
    }

    /**
     * Get image as data URL
     */
    getDataURL(format = 'png', quality = 0.9) {
        const mimeType = format === 'jpeg' || format === 'jpg' ? 'image/jpeg' : 'image/png';
        return this.canvas.toDataURL(mimeType, quality);
    }

    /**
     * Save image to file
     */
    saveToFile(filePath, format = 'png', quality = 0.9) {
        const buffer = this.getBuffer(format, quality);
        fs.writeFileSync(filePath, buffer);
        return filePath;
    }

    /**
     * Get image dimensions
     */
    getDimensions() {
        return {
            width: this.canvas.width,
            height: this.canvas.height
        };
    }

    // ==================== LAYER MANAGEMENT ====================

    /**
     * Add a new layer
     */
    addLayer(name = null) {
        const layer = this.layerManager.addLayer(name);
        this.updateComposite();
        this.saveState();
        return this.layerManager.getLayerInfo();
    }

    /**
     * Delete a layer
     */
    deleteLayer(index) {
        this.layerManager.deleteLayer(index);
        this.updateComposite();
        this.saveState();
        return this.layerManager.getLayerInfo();
    }

    /**
     * Duplicate a layer
     */
    duplicateLayer(index) {
        this.layerManager.duplicateLayer(index);
        this.updateComposite();
        this.saveState();
        return this.layerManager.getLayerInfo();
    }

    /**
     * Set active layer
     */
    setActiveLayer(index) {
        this.layerManager.setActiveLayer(index);
        return this.layerManager.getLayerInfo();
    }

    /**
     * Move layer up
     */
    moveLayerUp(index) {
        if (this.layerManager.moveLayerUp(index)) {
            this.updateComposite();
            this.saveState();
        }
        return this.layerManager.getLayerInfo();
    }

    /**
     * Move layer down
     */
    moveLayerDown(index) {
        if (this.layerManager.moveLayerDown(index)) {
            this.updateComposite();
            this.saveState();
        }
        return this.layerManager.getLayerInfo();
    }

    /**
     * Set layer opacity
     */
    setLayerOpacity(index, opacity) {
        const layers = this.layerManager.getLayers();
        if (index >= 0 && index < layers.length) {
            layers[index].setOpacity(opacity);
            this.updateComposite();
            this.saveState();
        }
        return this.layerManager.getLayerInfo();
    }

    /**
     * Set layer blend mode
     */
    setLayerBlendMode(index, blendMode) {
        const layers = this.layerManager.getLayers();
        if (index >= 0 && index < layers.length) {
            layers[index].setBlendMode(blendMode);
            this.updateComposite();
            this.saveState();
        }
        return this.layerManager.getLayerInfo();
    }

    /**
     * Toggle layer visibility
     */
    toggleLayerVisibility(index) {
        const layers = this.layerManager.getLayers();
        if (index >= 0 && index < layers.length) {
            layers[index].setVisible(!layers[index].visible);
            this.updateComposite();
        }
        return this.layerManager.getLayerInfo();
    }

    /**
     * Rename layer
     */
    renameLayer(index, name) {
        const layers = this.layerManager.getLayers();
        if (index >= 0 && index < layers.length) {
            layers[index].setName(name);
        }
        return this.layerManager.getLayerInfo();
    }

    /**
     * Merge layer down
     */
    mergeLayerDown(index) {
        this.layerManager.mergeDown(index);
        this.updateComposite();
        this.saveState();
        return this.layerManager.getLayerInfo();
    }

    /**
     * Flatten all layers
     */
    flattenLayers() {
        this.layerManager.flatten();
        this.updateComposite();
        this.saveState();
        return this.layerManager.getLayerInfo();
    }

    /**
     * Get layer information
     */
    getLayerInfo() {
        return this.layerManager.getLayerInfo();
    }

    /**
     * Get active layer context for drawing
     */
    getActiveLayerContext() {
        const layer = this.layerManager.getActiveLayer();
        return layer ? layer.getContext() : this.ctx;
    }

    /**
     * Update composite canvas from all layers
     */
    updateComposite() {
        if (this.useLayerSystem) {
            const composite = this.layerManager.getComposite();
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(composite, 0, 0);
        }
    }

    /**
     * Get current canvas (composite of all layers)
     */
    getCurrentCanvas() {
        if (this.useLayerSystem) {
            return this.layerManager.getComposite();
        }
        return this.canvas;
    }

    // ==================== SELECTION TOOLS ====================

    /**
     * Initialize selection for current canvas size
     */
    initializeSelection() {
        if (!this.selection || this.selection.width !== this.canvas.width || this.selection.height !== this.canvas.height) {
            this.selection = new Selection(this.canvas.width, this.canvas.height);
        }
    }

    /**
     * Create rectangular selection
     */
    selectRectangle(x, y, width, height) {
        this.initializeSelection();
        this.selection.fromRectangle(x, y, width, height);
        return this.getSelectionInfo();
    }

    /**
     * Create elliptical selection
     */
    selectEllipse(x, y, width, height) {
        this.initializeSelection();
        this.selection.fromEllipse(x, y, width, height);
        return this.getSelectionInfo();
    }

    /**
     * Create lasso selection from path
     */
    selectLasso(points) {
        this.initializeSelection();
        this.selection.fromPath(points);
        return this.getSelectionInfo();
    }

    /**
     * Create magic wand selection
     */
    selectMagicWand(x, y, tolerance = 32, contiguous = true) {
        this.initializeSelection();
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.selection.fromColor(imageData, x, y, tolerance, contiguous);
        return this.getSelectionInfo();
    }

    /**
     * Select all
     */
    selectAll() {
        this.initializeSelection();
        this.selection.selectAll();
        return this.getSelectionInfo();
    }

    /**
     * Deselect
     */
    deselect() {
        if (this.selection) {
            this.selection.deselect();
        }
        return this.getSelectionInfo();
    }

    /**
     * Invert selection
     */
    invertSelection() {
        if (this.selection && this.selection.active) {
            this.selection.invert();
        }
        return this.getSelectionInfo();
    }

    /**
     * Feather selection
     */
    featherSelection(radius) {
        if (this.selection && this.selection.active) {
            this.selection.applyFeather(radius);
        }
        return this.getSelectionInfo();
    }

    /**
     * Grow selection
     */
    growSelection(pixels) {
        if (this.selection && this.selection.active) {
            this.selection.grow(pixels);
        }
        return this.getSelectionInfo();
    }

    /**
     * Shrink selection
     */
    shrinkSelection(pixels) {
        if (this.selection && this.selection.active) {
            this.selection.shrink(pixels);
        }
        return this.getSelectionInfo();
    }

    /**
     * Select similar colors
     */
    selectSimilar(tolerance = 32) {
        if (this.selection && this.selection.active) {
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            this.selection.selectSimilar(imageData, tolerance);
        }
        return this.getSelectionInfo();
    }

    /**
     * Transform selection
     */
    transformSelection(x, y, width, height) {
        if (this.selection && this.selection.active) {
            this.selection.transform(x, y, width, height);
        }
        return this.getSelectionInfo();
    }

    /**
     * Get selection info
     */
    getSelectionInfo() {
        if (!this.selection || !this.selection.active) {
            return { active: false };
        }

        return {
            active: true,
            bounds: this.selection.bounds,
            feather: this.selection.feather,
            hasPath: this.selection.path !== null
        };
    }

    /**
     * Check if selection is active
     */
    hasSelection() {
        return this.selection && this.selection.active;
    }

    /**
     * Get selection mask
     */
    getSelectionMask() {
        if (!this.selection || !this.selection.active) {
            return null;
        }
        return this.selection.mask;
    }

    /**
     * Apply operation only to selected area
     */
    applyToSelection(operation) {
        if (!this.hasSelection()) {
            // No selection, apply to entire image
            operation();
            return;
        }

        // Save original image
        const originalData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        // Apply operation
        operation();

        // Get result
        const resultData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        // Blend based on selection mask
        const mask = this.selection.mask;
        for (let i = 0; i < mask.length; i++) {
            const alpha = mask[i] / 255;
            const idx = i * 4;

            resultData.data[idx] = originalData.data[idx] * (1 - alpha) + resultData.data[idx] * alpha;
            resultData.data[idx + 1] = originalData.data[idx + 1] * (1 - alpha) + resultData.data[idx + 1] * alpha;
            resultData.data[idx + 2] = originalData.data[idx + 2] * (1 - alpha) + resultData.data[idx + 2] * alpha;
        }

        this.ctx.putImageData(resultData, 0, 0);
    }

    /**
     * Copy selected area
     */
    copySelection() {
        if (!this.hasSelection()) {
            return null;
        }

        const bounds = this.selection.bounds;
        const imageData = this.ctx.getImageData(bounds.x, bounds.y, bounds.width, bounds.height);
        const mask = this.selection.mask;

        // Apply mask to copied data
        for (let y = 0; y < bounds.height; y++) {
            for (let x = 0; x < bounds.width; x++) {
                const maskIdx = (bounds.y + y) * this.canvas.width + (bounds.x + x);
                const dataIdx = (y * bounds.width + x) * 4;
                const alpha = mask[maskIdx] / 255;

                imageData.data[dataIdx + 3] *= alpha;
            }
        }

        return imageData;
    }

    /**
     * Cut selected area
     */
    cutSelection() {
        const copied = this.copySelection();
        if (copied) {
            this.deleteSelection();
        }
        return copied;
    }

    /**
     * Delete selected area
     */
    deleteSelection() {
        if (!this.hasSelection()) {
            return;
        }

        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const mask = this.selection.mask;

        for (let i = 0; i < mask.length; i++) {
            const alpha = mask[i] / 255;
            const idx = i * 4;

            // Make transparent based on selection
            imageData.data[idx] = imageData.data[idx] * (1 - alpha);
            imageData.data[idx + 1] = imageData.data[idx + 1] * (1 - alpha);
            imageData.data[idx + 2] = imageData.data[idx + 2] * (1 - alpha);
            imageData.data[idx + 3] = imageData.data[idx + 3] * (1 - alpha);
        }

        this.ctx.putImageData(imageData, 0, 0);
        this.saveState();
    }

    /**
     * Fill selection with color
     */
    fillSelection(color) {
        if (!this.hasSelection()) {
            return;
        }

        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const mask = this.selection.mask;

        // Parse color (assuming hex format #RRGGBB)
        const r = parseInt(color.substr(1, 2), 16);
        const g = parseInt(color.substr(3, 2), 16);
        const b = parseInt(color.substr(5, 2), 16);

        for (let i = 0; i < mask.length; i++) {
            const alpha = mask[i] / 255;
            if (alpha > 0) {
                const idx = i * 4;
                imageData.data[idx] = r * alpha + imageData.data[idx] * (1 - alpha);
                imageData.data[idx + 1] = g * alpha + imageData.data[idx + 1] * (1 - alpha);
                imageData.data[idx + 2] = b * alpha + imageData.data[idx + 2] * (1 - alpha);
            }
        }

        this.ctx.putImageData(imageData, 0, 0);
        this.saveState();
    }

    /**
     * Stroke selection (draw outline)
     */
    strokeSelection(color, width = 1) {
        if (!this.hasSelection() || !this.selection.bounds) {
            return;
        }

        // Find edge pixels
        const mask = this.selection.mask;
        const edges = new Set();

        for (let y = 0; y < this.canvas.height; y++) {
            for (let x = 0; x < this.canvas.width; x++) {
                const idx = y * this.canvas.width + x;
                if (mask[idx] > 0) {
                    // Check if this is an edge pixel
                    const isEdge =
                        (x > 0 && mask[idx - 1] === 0) ||
                        (x < this.canvas.width - 1 && mask[idx + 1] === 0) ||
                        (y > 0 && mask[idx - this.canvas.width] === 0) ||
                        (y < this.canvas.height - 1 && mask[idx + this.canvas.width] === 0);

                    if (isEdge) {
                        edges.add(`${x},${y}`);
                    }
                }
            }
        }

        // Draw stroke
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.beginPath();

        edges.forEach(coord => {
            const [x, y] = coord.split(',').map(Number);
            this.ctx.rect(x, y, 1, 1);
        });

        this.ctx.stroke();
        this.saveState();
    }
}


module.exports = PhotoEditor;
