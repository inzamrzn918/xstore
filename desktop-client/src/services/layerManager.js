/**
 * Layer Manager for Photo Editor
 * Manages layers similar to Photoshop 7.0
 */

const { createCanvas } = require('canvas');

class Layer {
    constructor(name, width, height, isBackground = false) {
        this.id = Date.now() + Math.random();
        this.name = name;
        this.canvas = createCanvas(width, height);
        this.ctx = this.canvas.getContext('2d');
        this.visible = true;
        this.opacity = 100;
        this.blendMode = 'normal';
        this.locked = isBackground;
        this.isBackground = isBackground;
    }

    getCanvas() {
        return this.canvas;
    }

    getContext() {
        return this.ctx;
    }

    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(100, opacity));
    }

    setBlendMode(mode) {
        this.blendMode = mode;
    }

    setVisible(visible) {
        this.visible = visible;
    }

    setName(name) {
        this.name = name;
    }

    duplicate() {
        const newLayer = new Layer(this.name + ' copy', this.canvas.width, this.canvas.height);
        newLayer.ctx.drawImage(this.canvas, 0, 0);
        newLayer.opacity = this.opacity;
        newLayer.blendMode = this.blendMode;
        newLayer.visible = this.visible;
        return newLayer;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    resize(width, height) {
        const tempCanvas = createCanvas(this.canvas.width, this.canvas.height);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.canvas, 0, 0);

        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.drawImage(tempCanvas, 0, 0, width, height);
    }
}

class LayerManager {
    constructor() {
        this.layers = [];
        this.activeLayerIndex = -1;
        this.compositeCanvas = null;
        this.compositeCtx = null;
    }

    /**
     * Initialize with a background layer
     */
    initialize(width, height, imageData = null) {
        this.layers = [];
        this.compositeCanvas = createCanvas(width, height);
        this.compositeCtx = this.compositeCanvas.getContext('2d');

        // Create background layer
        const bgLayer = new Layer('Background', width, height, true);
        if (imageData) {
            bgLayer.ctx.drawImage(imageData, 0, 0);
        } else {
            bgLayer.ctx.fillStyle = '#ffffff';
            bgLayer.ctx.fillRect(0, 0, width, height);
        }

        this.layers.push(bgLayer);
        this.activeLayerIndex = 0;
    }

    /**
     * Add a new layer
     */
    addLayer(name = null, insertAbove = true) {
        if (!name) {
            name = `Layer ${this.layers.length}`;
        }

        const width = this.compositeCanvas.width;
        const height = this.compositeCanvas.height;
        const newLayer = new Layer(name, width, height);

        if (insertAbove && this.activeLayerIndex >= 0) {
            this.layers.splice(this.activeLayerIndex + 1, 0, newLayer);
            this.activeLayerIndex++;
        } else {
            this.layers.push(newLayer);
            this.activeLayerIndex = this.layers.length - 1;
        }

        return newLayer;
    }

    /**
     * Delete a layer
     */
    deleteLayer(index) {
        if (this.layers.length <= 1) {
            throw new Error('Cannot delete the last layer');
        }

        if (index < 0 || index >= this.layers.length) {
            throw new Error('Invalid layer index');
        }

        if (this.layers[index].isBackground && this.layers.length > 1) {
            throw new Error('Cannot delete background layer when other layers exist');
        }

        this.layers.splice(index, 1);

        // Adjust active layer index
        if (this.activeLayerIndex >= this.layers.length) {
            this.activeLayerIndex = this.layers.length - 1;
        }
    }

    /**
     * Duplicate a layer
     */
    duplicateLayer(index) {
        if (index < 0 || index >= this.layers.length) {
            throw new Error('Invalid layer index');
        }

        const duplicated = this.layers[index].duplicate();
        this.layers.splice(index + 1, 0, duplicated);
        this.activeLayerIndex = index + 1;

        return duplicated;
    }

    /**
     * Move layer up
     */
    moveLayerUp(index) {
        if (index <= 0 || index >= this.layers.length) {
            return false;
        }

        [this.layers[index], this.layers[index - 1]] = [this.layers[index - 1], this.layers[index]];

        if (this.activeLayerIndex === index) {
            this.activeLayerIndex = index - 1;
        } else if (this.activeLayerIndex === index - 1) {
            this.activeLayerIndex = index;
        }

        return true;
    }

    /**
     * Move layer down
     */
    moveLayerDown(index) {
        if (index < 0 || index >= this.layers.length - 1) {
            return false;
        }

        [this.layers[index], this.layers[index + 1]] = [this.layers[index + 1], this.layers[index]];

        if (this.activeLayerIndex === index) {
            this.activeLayerIndex = index + 1;
        } else if (this.activeLayerIndex === index + 1) {
            this.activeLayerIndex = index;
        }

        return true;
    }

    /**
     * Set active layer
     */
    setActiveLayer(index) {
        if (index < 0 || index >= this.layers.length) {
            throw new Error('Invalid layer index');
        }
        this.activeLayerIndex = index;
    }

    /**
     * Get active layer
     */
    getActiveLayer() {
        if (this.activeLayerIndex < 0 || this.activeLayerIndex >= this.layers.length) {
            return null;
        }
        return this.layers[this.activeLayerIndex];
    }

    /**
     * Get all layers
     */
    getLayers() {
        return this.layers;
    }

    /**
     * Merge layer down
     */
    mergeDown(index) {
        if (index <= 0 || index >= this.layers.length) {
            throw new Error('Cannot merge this layer');
        }

        const upperLayer = this.layers[index];
        const lowerLayer = this.layers[index - 1];

        // Draw upper layer onto lower layer
        const tempCanvas = this.compositeCanvas;
        const tempCtx = this.compositeCtx;
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Apply blending
        this.drawLayerOnCanvas(lowerLayer, tempCtx);
        this.drawLayerOnCanvas(upperLayer, tempCtx);

        // Copy result to lower layer
        lowerLayer.ctx.clearRect(0, 0, lowerLayer.canvas.width, lowerLayer.canvas.height);
        lowerLayer.ctx.drawImage(tempCanvas, 0, 0);

        // Remove upper layer
        this.layers.splice(index, 1);

        if (this.activeLayerIndex >= this.layers.length) {
            this.activeLayerIndex = this.layers.length - 1;
        }
    }

    /**
     * Flatten all layers
     */
    flatten() {
        const flattened = this.getComposite();

        // Create new background layer
        const bgLayer = new Layer('Background', this.compositeCanvas.width, this.compositeCanvas.height, true);
        bgLayer.ctx.drawImage(flattened, 0, 0);

        this.layers = [bgLayer];
        this.activeLayerIndex = 0;
    }

    /**
     * Apply blending mode
     */
    drawLayerOnCanvas(layer, targetCtx) {
        if (!layer.visible) return;

        const oldAlpha = targetCtx.globalAlpha;
        const oldComposite = targetCtx.globalCompositeOperation;

        targetCtx.globalAlpha = layer.opacity / 100;
        targetCtx.globalCompositeOperation = this.getBlendModeOperation(layer.blendMode);

        targetCtx.drawImage(layer.canvas, 0, 0);

        targetCtx.globalAlpha = oldAlpha;
        targetCtx.globalCompositeOperation = oldComposite;
    }

    /**
     * Get composite operation for blend mode
     */
    getBlendModeOperation(blendMode) {
        const blendModes = {
            'normal': 'source-over',
            'multiply': 'multiply',
            'screen': 'screen',
            'overlay': 'overlay',
            'darken': 'darken',
            'lighten': 'lighten',
            'color-dodge': 'color-dodge',
            'color-burn': 'color-burn',
            'hard-light': 'hard-light',
            'soft-light': 'soft-light',
            'difference': 'difference',
            'exclusion': 'exclusion',
            'hue': 'hue',
            'saturation': 'saturation',
            'color': 'color',
            'luminosity': 'luminosity'
        };

        return blendModes[blendMode] || 'source-over';
    }

    /**
     * Get composite of all layers
     */
    getComposite() {
        this.compositeCtx.clearRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);

        // Draw layers from bottom to top
        for (let i = 0; i < this.layers.length; i++) {
            this.drawLayerOnCanvas(this.layers[i], this.compositeCtx);
        }

        return this.compositeCanvas;
    }

    /**
     * Resize all layers
     */
    resizeAll(width, height) {
        for (const layer of this.layers) {
            layer.resize(width, height);
        }

        this.compositeCanvas.width = width;
        this.compositeCanvas.height = height;
        this.compositeCtx = this.compositeCanvas.getContext('2d');
    }

    /**
     * Get layer info for UI
     */
    getLayerInfo() {
        return this.layers.map((layer, index) => ({
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            blendMode: layer.blendMode,
            locked: layer.locked,
            isBackground: layer.isBackground,
            isActive: index === this.activeLayerIndex,
            index: index
        }));
    }
}

module.exports = { LayerManager, Layer };
