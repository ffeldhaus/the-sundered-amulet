// utils.js - General utility functions

/**
 * Generates a random integer between min (inclusive) and max (inclusive).
 * @param {number} min - The minimum possible value.
 * @param {number} max - The maximum possible value.
 * @returns {number} A random integer within the specified range.
 */
export function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random float between min (inclusive) and max (exclusive).
 * @param {number} min - The minimum possible value.
 * @param {number} max - The maximum possible value (exclusive).
 * @returns {number} A random float within the specified range.
 */
export function getRandomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Selects a random element from an array.
 * @param {Array<T>} arr - The array to select from.
 * @returns {T | undefined} A random element from the array, or undefined if the array is empty.
 */
export function getRandomElement(arr) {
    if (!arr || arr.length === 0) {
        return undefined;
    }
    return arr[getRandomInt(0, arr.length - 1)];
}

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @param {Array<T>} arr - The array to shuffle.
 * @returns {Array<T>} The shuffled array (same instance).
 */
export function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]; // ES6 swap
    }
    return arr;
}

/**
 * Clamps a number between a minimum and maximum value.
 * @param {number} num - The number to clamp.
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} The clamped number.
 */
export function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}

/**
 * Performs a linear interpolation between two values.
 * @param {number} a - The start value.
 * @param {number} b - The end value.
 * @param {number} t - The interpolation factor (0.0 to 1.0).
 * @returns {number} The interpolated value.
 */
export function lerp(a, b, t) {
    return a * (1 - t) + b * t;
}

/**
 * Calculates the distance between two 2D points.
 * @param {number} x1 - X-coordinate of the first point.
 * @param {number} y1 - Y-coordinate of the first point.
 * @param {number} x2 - X-coordinate of the second point.
 * @param {number} y2 - Y-coordinate of the second point.
 * @returns {number} The distance between the two points.
 */
export function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Debounces a function: ensures it's only called after a certain delay
 * since the last time it was invoked.
 * @param {Function} func - The function to debounce.
 * @param {number} delay - The debounce delay in milliseconds.
 * @returns {Function} The debounced function.
 */
export function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * Throttles a function: ensures it's only called at most once
 * within a specified time window.
 * @param {Function} func - The function to throttle.
 * @param {number} limit - The throttle time window in milliseconds.
 * @returns {Function} The throttled function.
 */
export function throttle(func, limit) {
    let inThrottle = false;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} str - The string to capitalize.
 * @returns {string} The string with its first letter capitalized.
 */
export function capitalizeFirstLetter(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generates a simple unique ID (for client-side use, not cryptographically secure).
 * Often useful for temporary DOM element IDs or in-memory object tracking.
 * @param {string} [prefix='id_'] - Optional prefix for the ID.
 * @returns {string} A unique ID string.
 */
export function generateSimpleUID(prefix = 'uid_') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

/**
 * Deeply clones a simple JSON-like object (no functions, Date, RegExp, etc.).
 * For more complex objects, consider a library like lodash.cloneDeep.
 * @param {object} obj - The object to clone.
 * @returns {object} A deep clone of the object.
 */
export function deepClone(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj; // Not an object, or null
    }
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (e) {
        console.error("deepClone failed for object:", obj, e);
        // Fallback or throw error, depending on how critical this is
        // For simple game state, this is usually sufficient.
        // For complex objects with methods or non-serializable types, this will fail.
        const clone = Array.isArray(obj) ? [] : {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                clone[key] = deepClone(obj[key]);
            }
        }
        return clone;
    }
}

/**
 * Formats a number by adding commas as thousands separators.
 * @param {number} num - The number to format.
 * @returns {string} The formatted number string.
 */
export function formatNumberWithCommas(num) {
    if (num === null || num === undefined) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * A simple wrapper for querySelector to reduce boilerplate.
 * @param {string} selector - The CSS selector.
 * @param {Element} [parentElement=document] - The parent element to search within.
 * @returns {Element | null} The first matching element or null.
 */
export function $(selector, parentElement = document) {
    return parentElement.querySelector(selector);
}

/**
 * A simple wrapper for querySelectorAll to reduce boilerplate.
 * Returns an Array instead of a NodeList.
 * @param {string} selector - The CSS selector.
 * @param {Element} [parentElement=document] - The parent element to search within.
 * @returns {Array<Element>} An array of matching elements.
 */
export function $$(selector, parentElement = document) {
    return Array.from(parentElement.querySelectorAll(selector));
}


// --- Game Specific Utilities (can be moved to a game_utils.js if this file grows too large) ---

/**
 * Normalizes an angle to be between 0 and 2*PI.
 * @param {number} angle - The angle in radians.
 * @returns {number} The normalized angle.
 */
export function normalizeAngle(angle) {
    angle = angle % (2 * Math.PI);
    if (angle < 0) {
        angle += (2 * Math.PI);
    }
    return angle;
}

/**
 * Converts degrees to radians.
 * @param {number} degrees
 * @returns {number} radians
 */
export function degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Converts radians to degrees.
 * @param {number} radians
 * @returns {number} degrees
 */
export function radiansToDegrees(radians) {
    return radians * (180 / Math.PI);
}

/**
 * Checks if a specific bit is set in a bitmask.
 * @param {number} mask - The bitmask.
 * @param {number} bit - The bit to check (e.g., 1, 2, 4, 8...).
 * @returns {boolean} True if the bit is set, false otherwise.
 */
export function hasFlag(mask, bit) {
    return (mask & bit) === bit;
}


// Example of a weighted random selection, useful for loot tables or enemy spawns
/**
 * Selects an item from a list based on weights.
 * Example: const items = [{id: 'a', weight: 10}, {id: 'b', weight: 1}, {id: 'c', weight: 5}];
 * getRandomWeighted(items) will pick 'a' more often.
 * @param {Array<{weight: number, ...any}>} weightedArray - Array of objects, each with a 'weight' property.
 * @returns {object | undefined} The selected item or undefined if input is invalid.
 */
export function getRandomWeighted(weightedArray) {
    if (!weightedArray || weightedArray.length === 0) return undefined;

    let totalWeight = 0;
    for (const item of weightedArray) {
        totalWeight += (item.weight || 0);
    }

    if (totalWeight <= 0) return getRandomElement(weightedArray); // Fallback if no valid weights

    let randomNum = getRandomFloat(0, totalWeight);
    for (const item of weightedArray) {
        if (randomNum < (item.weight || 0)) {
            return item;
        }
        randomNum -= (item.weight || 0);
    }
    return weightedArray[weightedArray.length - 1]; // Should not be reached if logic is correct
}