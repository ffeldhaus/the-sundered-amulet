// assets.js - Asset Management

import { GAME_CONFIG, DUNGEON_CONFIG } from './config.js'; // For SVG path and texture IDs
import { $ } from './utils.js'; // For DOM manipulation if injecting SVG defs

const AssetManager = {
    svgDocument: null,
    svgDefsString: '', // Store the <defs> content as a string
    imageCache: new Map(), // Using a Map for potentially better performance with object keys
    isInitialized: false,
    initPromise: null,

    /**
     * Initializes the AssetManager by loading SVG assets.
     * @param {string} [svgPath=GAME_CONFIG.svgAssetPath] - Path to the SVG file.
     * @returns {Promise<void>} A promise that resolves when assets are loaded.
     */
    init(svgPath = GAME_CONFIG.svgAssetPath) {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise(async (resolve, reject) => {
            if (this.isInitialized) {
                resolve();
                return;
            }

            try {
                const response = await fetch(svgPath);
                if (!response.ok) {
                    throw new Error(`Failed to load SVG assets from '${svgPath}': ${response.status} ${response.statusText}`);
                }
                const svgText = await response.text();

                const parser = new DOMParser();
                const doc = parser.parseFromString(svgText, "image/svg+xml");

                const parserError = doc.querySelector("parsererror");
                if (parserError) {
                    console.error("Error parsing SVG file:", parserError.textContent);
                    throw new Error("Error parsing SVG file. Check console for details.");
                }

                this.svgDocument = doc;

                // Extract and store the <defs> section as a string
                const defsElement = this.svgDocument.querySelector('defs');
                if (defsElement) {
                    this.svgDefsString = defsElement.outerHTML;
                } else {
                    console.warn("No <defs> section found in SVG asset file.");
                    this.svgDefsString = ''; // Ensure it's an empty string
                }
                
                this.isInitialized = true;
                console.log("Asset Manager: SVG assets loaded and processed successfully.");
                resolve();
            } catch (error) {
                console.error("Asset Manager: Error initializing -", error);
                this.isInitialized = false; // Ensure it's marked as not initialized on error
                reject(error);
            }
        });
        return this.initPromise;
    },

    /**
     * Returns the string content of the <defs> tag from the loaded SVG.
     * This can be injected into the main HTML document.
     * @returns {string} The <defs>...</defs> string or an empty string if not available.
     */
    getSVGDefsString() {
        if (!this.isInitialized) {
            console.warn("AssetManager: getSVGDefsString called before initialization.");
            return '';
        }
        return this.svgDefsString;
    },

    /**
     * Retrieves an SVG symbol as a pre-rendered Image object.
     * Caches images for performance.
     * @param {string} symbolId - The ID of the symbol in assets.svg.
     * @param {{width: number, height: number, color?: string, strokeColor?: string, strokeWidth?: number}} [options] - Rendering options.
     * @returns {HTMLImageElement} An Image object (might be loading initially).
     */
    getSymbolAsImage(symbolId, options = { width: 100, height: 100 }) {
        if (!this.isInitialized || !this.svgDocument) {
            console.warn(`AssetManager: Attempted to get symbol "${symbolId}" before initialization or SVG document not loaded.`);
            return this._getPlaceholderImage(options.width, options.height, symbolId);
        }

        const { width, height } = options;
        const cacheKey = `${symbolId}_${width}x${height}_${options.color || ''}_${options.strokeColor || ''}_${options.strokeWidth || ''}`;

        if (this.imageCache.has(cacheKey)) {
            return this.imageCache.get(cacheKey);
        }

        const symbolNode = this.svgDocument.getElementById(symbolId);
        if (!symbolNode) {
            console.warn(`AssetManager: Symbol ID "${symbolId}" not found. Returning placeholder.`);
            const placeholder = this._getPlaceholderImage(width, height, symbolId);
            this.imageCache.set(cacheKey, placeholder);
            return placeholder;
        }

        // Create a new SVG string for this specific symbol with desired dimensions and styles
        // This allows for more flexibility than just <use> if complex styling is needed per instance.
        const svgInstanceString = this._createSVGInstanceString(symbolNode, symbolId, options);

        const img = new Image(width, height);
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgInstanceString)}`;
        
        // Add error handling for image loading itself
        img.onerror = () => {
            console.error(`AssetManager: Failed to load image for symbol "${symbolId}" from data URI.`);
            // Optionally, replace with a more specific error placeholder in cache
            const errorPlaceholder = this._getPlaceholderImage(width, height, symbolId, true);
            this.imageCache.set(cacheKey, errorPlaceholder); // Cache the error placeholder
            // If this image element was already returned, its src won't update,
            // but future calls for this cacheKey will get the error placeholder.
        };
        
        this.imageCache.set(cacheKey, img);
        return img;
    },

    /**
     * Creates an SVG string for a single symbol instance with specific dimensions and styling.
     * @private
     */
    _createSVGInstanceString(symbolNode, symbolId, options) {
        const { width, height, color, strokeColor, strokeWidth } = options;
        const viewBox = symbolNode.getAttribute('viewBox') || `0 0 ${symbolNode.getAttribute('width') || width} ${symbolNode.getAttribute('height') || height}`;

        // Clone the symbol to modify it if needed (e.g., for dynamic colors)
        // For simplicity here, we're just wrapping a <use> element.
        // For dynamic coloring, you'd need to inline the symbol's content and apply styles.
        let symbolContent = `<use xlink:href="#${symbolId}" width="${width}" height="${height}"`;
        if (color) symbolContent += ` fill="${color}"`;
        // Note: Applying stroke here might override internal symbol strokes.
        // More complex styling would involve deeper SVG manipulation or CSS variables within the SVG.
        if (strokeColor) symbolContent += ` stroke="${strokeColor}"`;
        if (strokeWidth) symbolContent += ` stroke-width="${strokeWidth}"`;
        symbolContent += ` />`;

        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="${viewBox}">${this.svgDefsString}<g>${symbolContent}</g></svg>`;
        // We include this.svgDefsString in case the symbol itself <use>s other defs like gradients or filters.
        // Wrapping symbolContent in <g> is good practice.
    },


    /**
     * Generates an HTML string for an <svg> element using a <use> tag to reference a symbol.
     * @param {string} symbolId - The ID of the symbol in assets.svg.
     * @param {string} [classes=""] - CSS classes for the <svg> element.
     * @param {string | number} [width="100%"] - Width of the SVG.
     * @param {string | number} [height="100%"] - Height of the SVG.
     * @returns {string} HTML string for the <svg> element.
     */
    getUseElementString(symbolId, classes = "", width = "100%", height = "100%") {
        if (!this.isInitialized || !this.svgDocument) {
            console.warn(`AssetManager: getUseElementString for "${symbolId}" called before init or no SVG doc.`);
            // Fallback to a placeholder if necessary, or an empty string.
            // For UI elements, often better to ensure it's always a valid SVG string.
            symbolId = DUNGEON_CONFIG.TEXTURE_IDS.PARTY_MARKER; // Default to something visible
        }

        const symbolNode = this.svgDocument ? this.svgDocument.getElementById(symbolId) : null;
        let effectiveSymbolId = symbolId;

        if (!symbolNode) {
            console.warn(`AssetManager: Symbol ID "${symbolId}" for getUseElementString not found. Using placeholder.`);
            effectiveSymbolId = "portrait-placeholder"; // Ensure this placeholder exists in assets.svg
            // Check if placeholder itself exists
            if (!this.svgDocument || !this.svgDocument.getElementById(effectiveSymbolId)) {
                console.error("AssetManager: Critical - Placeholder 'portrait-placeholder' not found in SVG assets.");
                return `<svg class="${classes}" width="${width}" height="${height}" viewBox="0 0 24 24" fill="red"><rect width="24" height="24"/><text x="12" y="16" text-anchor="middle" font-size="12" fill="white">ERR</text></svg>`;
            }
        }
        
        // Preserve aspect ratio using viewBox from the symbol if available
        const actualSymbolNode = this.svgDocument.getElementById(effectiveSymbolId);
        const viewBox = actualSymbolNode?.getAttribute('viewBox') || '0 0 100 100';


        return `<svg class="${classes}" width="${width}" height="${height}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet"><use xlink:href="#${effectiveSymbolId}"></use></svg>`;
    },

    /**
     * Creates a placeholder image (e.g., a colored square with text).
     * @private
     */
    _getPlaceholderImage(width, height, text = '?', isError = false) {
        const img = new Image(width, height);
        const bgColor = isError ? '#FF0000' : '#555555'; // Red for error, grey for normal placeholder
        const textColor = '#FFFFFF';
        const fontSize = Math.min(width, height) / 2;

        const placeholderSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                <rect width="100%" height="100%" fill="${bgColor}"/>
                <text x="50%" y="50%" dy=".3em" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}px" fill="${textColor}">
                    ${isError ? 'ERR' : text.substring(0,1)}
                </text>
            </svg>`;
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(placeholderSvg)}`;
        return img;
    },

    /**
     * Preloads a list of symbols as images.
     * @param {Array<string>} symbolIds - Array of symbol IDs to preload.
     * @param {{width: number, height: number}} [options] - Common rendering options for all preloaded images.
     * @returns {Promise<void>} A promise that resolves when all specified images are loaded or have errored.
     */
    async preloadSymbolsAsImages(symbolIds, options = { width: 100, height: 100 }) {
        if (!this.isInitialized) {
            await this.init(); // Ensure initialization
        }

        const preloadPromises = symbolIds.map(id => {
            return new Promise((resolve) => {
                const img = this.getSymbolAsImage(id, options);
                if (img.complete) {
                    resolve();
                } else {
                    img.onload = () => resolve();
                    img.onerror = () => resolve(); // Resolve even on error so Promise.all doesn't reject early
                }
            });
        });

        await Promise.all(preloadPromises);
        console.log(`AssetManager: Preloaded ${symbolIds.length} symbols as images.`);
    },

    /**
     * Clears the image cache.
     */
    clearCache() {
        this.imageCache.clear();
        console.log("AssetManager: Image cache cleared.");
    }
};

export default AssetManager;