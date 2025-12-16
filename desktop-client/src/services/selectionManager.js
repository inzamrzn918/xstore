/**
 * Selection Manager for Photo Editor
 * Handles all selection operations similar to Photoshop 7.0
 */

const { createCanvas } = require('canvas');

class Selection {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.mask = null; // Alpha mask for selection (0-255)
        this.bounds = null; // { x, y, width, height }
        this.feather = 0;
        this.active = false;
        this.marchingAnts = true;
        this.path = null; // For lasso and other path-based selections
    }

    /**
     * Create selection from rectangle
     */
    fromRectangle(x, y, width, height) {
        this.mask = new Uint8ClampedArray(this.width * this.height);
        this.mask.fill(0);

        const x1 = Math.max(0, Math.floor(x));
        const y1 = Math.max(0, Math.floor(y));
        const x2 = Math.min(this.width, Math.ceil(x + width));
        const y2 = Math.min(this.height, Math.ceil(y + height));

        for (let py = y1; py < y2; py++) {
            for (let px = x1; px < x2; px++) {
                const idx = py * this.width + px;
                this.mask[idx] = 255;
            }
        }

        this.bounds = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
        this.active = true;
    }

    /**
     * Create selection from ellipse
     */
    fromEllipse(x, y, width, height) {
        this.mask = new Uint8ClampedArray(this.width * this.height);
        this.mask.fill(0);

        const cx = x + width / 2;
        const cy = y + height / 2;
        const rx = width / 2;
        const ry = height / 2;

        const x1 = Math.max(0, Math.floor(x));
        const y1 = Math.max(0, Math.floor(y));
        const x2 = Math.min(this.width, Math.ceil(x + width));
        const y2 = Math.min(this.height, Math.ceil(y + height));

        for (let py = y1; py < y2; py++) {
            for (let px = x1; px < x2; px++) {
                const dx = (px - cx) / rx;
                const dy = (py - cy) / ry;
                const dist = dx * dx + dy * dy;

                if (dist <= 1) {
                    const idx = py * this.width + px;
                    this.mask[idx] = 255;
                }
            }
        }

        this.bounds = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
        this.active = true;
    }

    /**
     * Create selection from path (lasso)
     */
    fromPath(points) {
        if (points.length < 3) return;

        this.mask = new Uint8ClampedArray(this.width * this.height);
        this.mask.fill(0);

        // Find bounds
        let minX = this.width, minY = this.height;
        let maxX = 0, maxY = 0;

        for (const point of points) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        }

        // Use scanline algorithm to fill polygon
        for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
            const intersections = [];

            for (let i = 0; i < points.length; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % points.length];

                if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
                    const x = p1.x + (y - p1.y) * (p2.x - p1.x) / (p2.y - p1.y);
                    intersections.push(x);
                }
            }

            intersections.sort((a, b) => a - b);

            for (let i = 0; i < intersections.length; i += 2) {
                if (i + 1 < intersections.length) {
                    const x1 = Math.max(0, Math.floor(intersections[i]));
                    const x2 = Math.min(this.width, Math.ceil(intersections[i + 1]));

                    for (let x = x1; x < x2; x++) {
                        const idx = y * this.width + x;
                        if (idx >= 0 && idx < this.mask.length) {
                            this.mask[idx] = 255;
                        }
                    }
                }
            }
        }

        this.bounds = {
            x: Math.floor(minX),
            y: Math.floor(minY),
            width: Math.ceil(maxX - minX),
            height: Math.ceil(maxY - minY)
        };
        this.active = true;
        this.path = points;
    }

    /**
     * Create selection from color (magic wand)
     */
    fromColor(imageData, x, y, tolerance = 32, contiguous = true) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        this.mask = new Uint8ClampedArray(width * height);
        this.mask.fill(0);

        // Get target color
        const idx = (y * width + x) * 4;
        const targetR = data[idx];
        const targetG = data[idx + 1];
        const targetB = data[idx + 2];

        if (contiguous) {
            // Flood fill algorithm
            const stack = [{ x, y }];
            const visited = new Set();

            while (stack.length > 0) {
                const { x: px, y: py } = stack.pop();
                const key = `${px},${py}`;

                if (visited.has(key)) continue;
                if (px < 0 || px >= width || py < 0 || py >= height) continue;

                const pidx = (py * width + px) * 4;
                const r = data[pidx];
                const g = data[pidx + 1];
                const b = data[pidx + 2];

                const diff = Math.sqrt(
                    Math.pow(r - targetR, 2) +
                    Math.pow(g - targetG, 2) +
                    Math.pow(b - targetB, 2)
                );

                if (diff <= tolerance) {
                    visited.add(key);
                    this.mask[py * width + px] = 255;

                    stack.push({ x: px + 1, y: py });
                    stack.push({ x: px - 1, y: py });
                    stack.push({ x: px, y: py + 1 });
                    stack.push({ x: px, y: py - 1 });
                }
            }
        } else {
            // Select all similar colors
            for (let py = 0; py < height; py++) {
                for (let px = 0; px < width; px++) {
                    const pidx = (py * width + px) * 4;
                    const r = data[pidx];
                    const g = data[pidx + 1];
                    const b = data[pidx + 2];

                    const diff = Math.sqrt(
                        Math.pow(r - targetR, 2) +
                        Math.pow(g - targetG, 2) +
                        Math.pow(b - targetB, 2)
                    );

                    if (diff <= tolerance) {
                        this.mask[py * width + px] = 255;
                    }
                }
            }
        }

        this.updateBounds();
        this.active = true;
    }

    /**
     * Update bounds from mask
     */
    updateBounds() {
        let minX = this.width, minY = this.height;
        let maxX = 0, maxY = 0;
        let hasSelection = false;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.mask[y * this.width + x] > 0) {
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                    hasSelection = true;
                }
            }
        }

        if (hasSelection) {
            this.bounds = {
                x: minX,
                y: minY,
                width: maxX - minX + 1,
                height: maxY - minY + 1
            };
        } else {
            this.bounds = null;
        }
    }

    /**
     * Feather selection
     */
    applyFeather(radius) {
        if (radius <= 0) return;

        const original = new Uint8ClampedArray(this.mask);
        const kernel = this.createGaussianKernel(radius);
        const kernelSize = kernel.length;
        const half = Math.floor(kernelSize / 2);

        // Horizontal pass
        const temp = new Uint8ClampedArray(this.mask.length);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let sum = 0;
                for (let k = 0; k < kernelSize; k++) {
                    const px = Math.min(this.width - 1, Math.max(0, x + k - half));
                    sum += original[y * this.width + px] * kernel[k];
                }
                temp[y * this.width + x] = sum;
            }
        }

        // Vertical pass
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let sum = 0;
                for (let k = 0; k < kernelSize; k++) {
                    const py = Math.min(this.height - 1, Math.max(0, y + k - half));
                    sum += temp[py * this.width + x] * kernel[k];
                }
                this.mask[y * this.width + x] = Math.min(255, Math.max(0, sum));
            }
        }

        this.feather = radius;
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

        for (let i = 0; i < size; i++) {
            kernel[i] /= sum;
        }

        return kernel;
    }

    /**
     * Invert selection
     */
    invert() {
        for (let i = 0; i < this.mask.length; i++) {
            this.mask[i] = 255 - this.mask[i];
        }
        this.updateBounds();
    }

    /**
     * Grow selection
     */
    grow(pixels) {
        const original = new Uint8ClampedArray(this.mask);

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = y * this.width + x;
                if (original[idx] > 0) {
                    // Expand in all directions
                    for (let dy = -pixels; dy <= pixels; dy++) {
                        for (let dx = -pixels; dx <= pixels; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                                const nidx = ny * this.width + nx;
                                this.mask[nidx] = 255;
                            }
                        }
                    }
                }
            }
        }

        this.updateBounds();
    }

    /**
     * Shrink selection
     */
    shrink(pixels) {
        const original = new Uint8ClampedArray(this.mask);
        this.mask.fill(0);

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = y * this.width + x;
                if (original[idx] > 0) {
                    // Check if all surrounding pixels are selected
                    let allSelected = true;
                    for (let dy = -pixels; dy <= pixels && allSelected; dy++) {
                        for (let dx = -pixels; dx <= pixels && allSelected; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                                const nidx = ny * this.width + nx;
                                if (original[nidx] === 0) {
                                    allSelected = false;
                                }
                            } else {
                                allSelected = false;
                            }
                        }
                    }
                    if (allSelected) {
                        this.mask[idx] = 255;
                    }
                }
            }
        }

        this.updateBounds();
    }

    /**
     * Select similar (expand selection to similar colors)
     */
    selectSimilar(imageData, tolerance = 32) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        // Get colors from current selection
        const selectedColors = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (this.mask[idx] > 0) {
                    const pidx = idx * 4;
                    selectedColors.push({
                        r: data[pidx],
                        g: data[pidx + 1],
                        b: data[pidx + 2]
                    });
                }
            }
        }

        // Select all pixels with similar colors
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const pidx = idx * 4;
                const r = data[pidx];
                const g = data[pidx + 1];
                const b = data[pidx + 2];

                for (const color of selectedColors) {
                    const diff = Math.sqrt(
                        Math.pow(r - color.r, 2) +
                        Math.pow(g - color.g, 2) +
                        Math.pow(b - color.b, 2)
                    );

                    if (diff <= tolerance) {
                        this.mask[idx] = 255;
                        break;
                    }
                }
            }
        }

        this.updateBounds();
    }

    /**
     * Deselect all
     */
    deselect() {
        this.mask = null;
        this.bounds = null;
        this.active = false;
        this.path = null;
    }

    /**
     * Select all
     */
    selectAll() {
        this.mask = new Uint8ClampedArray(this.width * this.height);
        this.mask.fill(255);
        this.bounds = { x: 0, y: 0, width: this.width, height: this.height };
        this.active = true;
    }

    /**
     * Check if point is selected
     */
    isSelected(x, y) {
        if (!this.active || !this.mask) return false;
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        return this.mask[y * this.width + x] > 0;
    }

    /**
     * Get selection mask as ImageData
     */
    getMaskImageData() {
        if (!this.mask) return null;

        const imageData = new Uint8ClampedArray(this.width * this.height * 4);
        for (let i = 0; i < this.mask.length; i++) {
            const alpha = this.mask[i];
            imageData[i * 4] = 255;
            imageData[i * 4 + 1] = 255;
            imageData[i * 4 + 2] = 255;
            imageData[i * 4 + 3] = alpha;
        }

        return imageData;
    }

    /**
     * Transform selection
     */
    transform(x, y, width, height) {
        if (!this.bounds) return;

        const scaleX = width / this.bounds.width;
        const scaleY = height / this.bounds.height;
        const offsetX = x - this.bounds.x;
        const offsetY = y - this.bounds.y;

        const newMask = new Uint8ClampedArray(this.width * this.height);

        for (let py = 0; py < this.height; py++) {
            for (let px = 0; px < this.width; px++) {
                const srcX = Math.floor((px - offsetX) / scaleX + this.bounds.x);
                const srcY = Math.floor((py - offsetY) / scaleY + this.bounds.y);

                if (srcX >= 0 && srcX < this.width && srcY >= 0 && srcY < this.height) {
                    const srcIdx = srcY * this.width + srcX;
                    const dstIdx = py * this.width + px;
                    newMask[dstIdx] = this.mask[srcIdx];
                }
            }
        }

        this.mask = newMask;
        this.updateBounds();
    }
}

module.exports = Selection;
