// renderer.js - Handles all canvas drawing operations

import { DUNGEON_CONFIG, UI_CONFIG } from './config.js';
import AssetManager from './assets.js';
import { normalizeAngle, clamp, degreesToRadians } from './utils.js'; // Added clamp and degreesToRadians

// --- Canvas Contexts & Settings ---
let mainCtx = null;
let automapCtx = null;
let automapModalCtx = null;

let screenWidth = 0;
let screenHeight = 0;
let automapCanvasWidth = 0;
let automapCanvasHeight = 0;
let automapModalCanvasWidth = 0;
let automapModalCanvasHeight = 0;

const textureCache = new Map();
const spriteCache = new Map();
let wallSlicesCache = { zBuffer: [] }; // Cache for wall slices zBuffer

// --- Initialization ---
export function initializeRenderer(mainCanvas, automapSideCanvas, automapModalCanvas) {
    mainCtx = mainCanvas.getContext('2d');
    automapCtx = automapSideCanvas.getContext('2d');
    automapModalCtx = automapModalCanvas.getContext('2d');

    if (!mainCtx || !automapCtx || !automapModalCtx) {
        console.error("Renderer: Failed to get canvas contexts.");
        return false;
    }
    resizeGameElements();
    preloadCommonTextures();
    console.log("Renderer initialized.");
    return true;
}

async function preloadCommonTextures() {
    const commonTextureIds = [
        DUNGEON_CONFIG.TEXTURE_IDS.WALL_STONE_1,
        DUNGEON_CONFIG.TEXTURE_IDS.FLOOR_STONE_1,
        DUNGEON_CONFIG.TEXTURE_IDS.DOOR_WOOD_CLOSED,
        DUNGEON_CONFIG.TEXTURE_IDS.DOOR_WOOD_OPEN,
        DUNGEON_CONFIG.TEXTURE_IDS.CHEST_CLOSED,
        DUNGEON_CONFIG.TEXTURE_IDS.CHEST_OPEN,
        DUNGEON_CONFIG.TEXTURE_IDS.STAIRS_DOWN, // For potential 3D rendering if desired
        DUNGEON_CONFIG.TEXTURE_IDS.PARTY_MARKER,
    ];
    // Add common enemy/item icons if known upfront
    const commonSpriteIds = ['enemy-goblin', 'enemy-skeleton', 'icon-potion', 'icon-sword'];

    const texturePromises = [...commonTextureIds, ...commonSpriteIds].map(id => {
        const cacheToUse = commonTextureIds.includes(id) ? textureCache : spriteCache;
        const dimensions = commonTextureIds.includes(id) ?
            { width: DUNGEON_CONFIG.textureSize, height: DUNGEON_CONFIG.textureSize } :
            { width: 64, height: 64 }; // Default sprite size for preloading

        if (!cacheToUse.has(id)) {
            const img = AssetManager.getSymbolAsImage(id, dimensions);
            cacheToUse.set(id, img);
            return new Promise(resolve => {
                if (img.complete) resolve();
                else {
                    img.onload = resolve;
                    img.onerror = () => { console.warn(`Renderer: Failed to preload texture/sprite ${id}`); resolve(); };
                }
            });
        }
        return Promise.resolve();
    });
    await Promise.all(texturePromises);
    console.log("Renderer: Common textures and sprites pre-cached.");
}

// --- Resize Handling ---
export function resizeGameElements() {
    const mainViewContainer = document.querySelector('.main-view-container');
    if (!mainViewContainer || !mainCtx) return;

    const containerWidth = mainViewContainer.clientWidth;
    const containerHeight = mainViewContainer.clientHeight;
    const aspectRatio = 16 / 9;

    if (containerWidth / containerHeight > aspectRatio) {
        screenHeight = containerHeight;
        screenWidth = Math.floor(screenHeight * aspectRatio);
    } else {
        screenWidth = containerWidth;
        screenHeight = Math.floor(screenWidth / aspectRatio);
    }

    mainCtx.canvas.width = screenWidth;
    mainCtx.canvas.height = screenHeight;

    const mapCanvasContainerAutomap = document.getElementById('mapCanvasContainerAutomap');
    const mapData = DUNGEON_CONFIG; // Assuming default for now, gameMap might not exist yet
    const mapWidthTiles = mapData.defaultMapWidth;
    const mapHeightTiles = mapData.defaultMapHeight;

    if (mapCanvasContainerAutomap && automapCtx) {
        automapCanvasWidth = mapCanvasContainerAutomap.clientWidth;
        automapCanvasHeight = Math.floor(automapCanvasWidth / (mapWidthTiles / mapHeightTiles || 1));
        automapCtx.canvas.width = mapWidthTiles * mapData.automapTileSize;
        automapCtx.canvas.height = mapHeightTiles * mapData.automapTileSize;
        automapCtx.canvas.style.width = `${automapCanvasWidth}px`;
        automapCtx.canvas.style.height = `${automapCanvasHeight}px`;
    }

    const mapCanvasContainerModal = document.getElementById('mapCanvasContainerModal');
    if (mapCanvasContainerModal && automapModalCtx) {
        automapModalCanvasWidth = mapCanvasContainerModal.clientWidth;
        automapModalCanvasHeight = Math.floor(automapModalCanvasWidth / (mapWidthTiles / mapHeightTiles || 1));
        automapModalCtx.canvas.width = mapWidthTiles * mapData.automapModalTileSize;
        automapModalCtx.canvas.height = mapHeightTiles * mapData.automapModalTileSize;
        automapModalCtx.canvas.style.width = `${automapModalCanvasWidth}px`;
        automapModalCtx.canvas.style.height = `${automapModalCanvasHeight}px`;
    }
}


// --- Main Game Drawing Function ---
export function drawGame(player, party, activeCharacterIndex, enemies, itemsOnMap, exploredMap, dungeonLevel, gameMap) {
    if (!mainCtx || !gameMap) return;

    drawBackground();
    wallSlicesCache = castRays(player, gameMap); // Update wallSlicesCache
    drawWalls(wallSlicesCache, gameMap); // Pass gameMap for tile data

    const spritesToRender = prepareSprites(player, enemies, itemsOnMap, gameMap, exploredMap, wallSlicesCache.zBuffer);
    drawSprites(spritesToRender, player); // Pass player for distance calculations

    if (automapCtx) drawAutomap(automapCtx, player, exploredMap, gameMap, DUNGEON_CONFIG.automapTileSize);
    if (document.getElementById(UI_CONFIG.mapPanelId)?.style.display === 'block' && automapModalCtx) {
        drawAutomap(automapModalCtx, player, exploredMap, gameMap, DUNGEON_CONFIG.automapModalTileSize);
    }
}

// --- Background Drawing ---
function drawBackground() { /* (No changes from previous version) */
    mainCtx.fillStyle = 'var(--color-ceiling, #221e18)';
    mainCtx.fillRect(0, 0, screenWidth, screenHeight / 2);

    const floorTextureId = DUNGEON_CONFIG.TEXTURE_IDS.FLOOR_STONE_1;
    let floorImg = textureCache.get(floorTextureId);
    if (!floorImg) {
        floorImg = AssetManager.getSymbolAsImage(floorTextureId, { width: DUNGEON_CONFIG.textureSize, height: DUNGEON_CONFIG.textureSize });
        textureCache.set(floorTextureId, floorImg);
    }

    if (floorImg && floorImg.complete && floorImg.naturalWidth > 0) {
        const pattern = mainCtx.createPattern(floorImg, 'repeat');
        mainCtx.fillStyle = pattern || 'var(--color-floor-base, #403325)';
    } else {
        mainCtx.fillStyle = 'var(--color-floor-base, #403325)';
    }
    mainCtx.fillRect(0, screenHeight / 2, screenWidth, screenHeight / 2); // Corrected height
}


// --- Raycasting Logic ---
function castRays(player, gameMap) {
    const wallSlices = [];
    const zBuffer = new Array(DUNGEON_CONFIG.rayCount).fill(Infinity);
    const angleStep = DUNGEON_CONFIG.fov / DUNGEON_CONFIG.rayCount;
    let currentAngle = normalizeAngle(player.angle - DUNGEON_CONFIG.fov / 2);

    for (let i = 0; i < DUNGEON_CONFIG.rayCount; i++) {
        const rayCos = Math.cos(currentAngle);
        const raySin = Math.sin(currentAngle);
        let distToWall = Infinity;
        let hitWall = false;
        let hitHorizontal = false;
        let wallTileX = 0, wallTileY = 0;
        let wallTileData = null; // Store the full tile object
        let textureXFraction = 0;

        // Horizontal Intersections
        if (raySin !== 0) {
            const yStep = (raySin > 0) ? 1 : -1;
            const firstY = (raySin > 0) ? Math.floor(player.y) + 1 : Math.ceil(player.y) - 1;
            const dY = firstY - player.y;
            const dX = dY * (rayCos / raySin); // dx = dy / tan(angle)
            let currentX = player.x + dX;
            let currentY = firstY;
            const xInc = yStep * (rayCos / raySin);

            for (let depth = 0; depth < DUNGEON_CONFIG.maxRayDepth; depth++) {
                const mapX = Math.floor(currentX);
                const mapY = (raySin > 0) ? Math.floor(currentY) : Math.floor(currentY) - 1;

                if (mapX < 0 || mapX >= gameMap.width || mapY < 0 || mapY >= gameMap.height) break;

                const tile = gameMap.getTile(mapX, mapY);
                if (gameMap.isSolid(mapX, mapY, true)) { // True checks closed doors
                    const dist = distance(player.x, player.y, currentX, currentY);
                    if (dist < distToWall) {
                        distToWall = dist;
                        hitWall = true;
                        hitHorizontal = true;
                        wallTileX = mapX;
                        wallTileY = mapY;
                        wallTileData = tile;
                        textureXFraction = currentX - mapX;
                    }
                    break;
                }
                currentX += xInc;
                currentY += yStep;
            }
        }

        // Vertical Intersections
        if (rayCos !== 0) {
            const xStep = (rayCos > 0) ? 1 : -1;
            const firstX = (rayCos > 0) ? Math.floor(player.x) + 1 : Math.ceil(player.x) - 1;
            const dX = firstX - player.x;
            const dY = dX * (raySin / rayCos); // dy = dx * tan(angle)
            let currentX = firstX;
            let currentY = player.y + dY;
            const yInc = xStep * (raySin / rayCos);

            for (let depth = 0; depth < DUNGEON_CONFIG.maxRayDepth; depth++) {
                const mapY = Math.floor(currentY);
                const mapX = (rayCos > 0) ? Math.floor(currentX) : Math.floor(currentX) - 1;

                if (mapX < 0 || mapX >= gameMap.width || mapY < 0 || mapY >= gameMap.height) break;

                const tile = gameMap.getTile(mapX, mapY);
                if (gameMap.isSolid(mapX, mapY, true)) {
                    const dist = distance(player.x, player.y, currentX, currentY);
                    if (dist < distToWall) {
                        distToWall = dist;
                        hitWall = true;
                        hitHorizontal = false; // Vertical hit
                        wallTileX = mapX;
                        wallTileY = mapY;
                        wallTileData = tile;
                        textureXFraction = currentY - mapY;
                    }
                    break;
                }
                currentX += xStep;
                currentY += yInc;
            }
        }


        if (hitWall && distToWall < DUNGEON_CONFIG.maxRayDepth) {
            const correctedDist = distToWall * Math.cos(normalizeAngle(currentAngle - player.angle));
            zBuffer[i] = correctedDist;
            const wallHeight = Math.max(1, Math.floor((screenHeight / correctedDist) * 0.9)); // World scale
            const wallTop = (screenHeight / 2) - (wallHeight / 2);

            let textureId;
            switch (wallTileData.type) {
                case DUNGEON_CONFIG.TILES.DOOR_WOOD_CLOSED:
                    textureId = wallTileData.isOpen ? DUNGEON_CONFIG.TEXTURE_IDS.DOOR_WOOD_OPEN : DUNGEON_CONFIG.TEXTURE_IDS.DOOR_WOOD_CLOSED;
                    break;
                case DUNGEON_CONFIG.TILES.DOOR_WOOD_OPEN: // Should be caught by isOpen above if type remains same
                     textureId = DUNGEON_CONFIG.TEXTURE_IDS.DOOR_WOOD_OPEN;
                    break;
                case DUNGEON_CONFIG.TILES.CHEST_CLOSED:
                     textureId = wallTileData.isOpen ? DUNGEON_CONFIG.TEXTURE_IDS.CHEST_OPEN : DUNGEON_CONFIG.TEXTURE_IDS.CHEST_CLOSED;
                    break;
                case DUNGEON_CONFIG.TILES.CHEST_OPEN:
                     textureId = DUNGEON_CONFIG.TEXTURE_IDS.CHEST_OPEN;
                    break;
                case DUNGEON_CONFIG.TILES.WALL:
                default:
                    textureId = wallTileData.textureId || DUNGEON_CONFIG.TEXTURE_IDS.WALL_STONE_1; // Allow tile specific texture
            }

            wallSlices.push({
                x: i, height: wallHeight, top: wallTop,
                textureId: textureId,
                textureX: Math.floor(textureXFraction * DUNGEON_CONFIG.textureSize),
                distance: correctedDist, hitHorizontal: hitHorizontal,
                tileData: wallTileData, // Pass full tile data for more complex rendering later
            });
        } else {
            zBuffer[i] = DUNGEON_CONFIG.maxRayDepth;
        }
        currentAngle = normalizeAngle(currentAngle + angleStep);
    }
    wallSlices.zBuffer = zBuffer;
    return wallSlices;
}

// --- Wall Drawing ---
function drawWalls(wallSlicesData) { // Renamed parameter to avoid conflict
    const sliceWidth = screenWidth / DUNGEON_CONFIG.rayCount;
    if (!wallSlicesData || !wallSlicesData.zBuffer) return; // Guard clause

    wallSlicesData.forEach(slice => {
        let textureImg = textureCache.get(slice.textureId);
        if (!textureImg) {
            textureImg = AssetManager.getSymbolAsImage(slice.textureId, { width: DUNGEON_CONFIG.textureSize, height: DUNGEON_CONFIG.textureSize });
            textureCache.set(slice.textureId, textureImg);
        }

        if (textureImg && textureImg.complete && textureImg.naturalWidth > 0) {
            let brightness = 1 - (slice.distance / (DUNGEON_CONFIG.maxRayDepth * 0.8)); // Adjusted shading distance
            brightness = clamp(brightness, 0.2, 1.0);
            if (slice.hitHorizontal) brightness *= 0.85;

            mainCtx.globalAlpha = brightness;
            const texX = clamp(slice.textureX, 0, DUNGEON_CONFIG.textureSize -1); // Ensure texX is within bounds

            mainCtx.drawImage(
                textureImg,
                texX, 0, 1, DUNGEON_CONFIG.textureSize,
                slice.x * sliceWidth, slice.top, sliceWidth + 0.5, slice.height
            );
            mainCtx.globalAlpha = 1.0;
        } else {
            // Fallback color if texture still loading or errored
            const shade = Math.floor(clamp(150 - slice.distance * 10, 30, 120));
            mainCtx.fillStyle = `rgb(${shade},${Math.floor(shade*0.9)},${Math.floor(shade*0.8)})`;
            mainCtx.fillRect(slice.x * sliceWidth, slice.top, sliceWidth + 0.5, slice.height);
        }
    });
}

// --- Sprite Rendering ---
function prepareSprites(player, enemies, itemsOnMap, gameMap, exploredMap, zBuffer) { /* (No major changes from previous, ensure svgIcon is used) */
    const allSprites = [];
    enemies.forEach(enemy => {
        if (!gameMap.isTileVisibleToPlayer(enemy.x, enemy.y, player) && (!exploredMap[Math.floor(enemy.y)] || !exploredMap[Math.floor(enemy.y)][Math.floor(enemy.x)])) return;
        allSprites.push({ type: 'enemy', entity: enemy, x: enemy.x + 0.5, y: enemy.y + 0.5, svgIcon: enemy.svgIcon || 'enemy-goblin', zOffset: 0 });
    });
    itemsOnMap.forEach(item => {
        if (!gameMap.isTileVisibleToPlayer(item.x, item.y, player) && (!exploredMap[Math.floor(item.y)] || !exploredMap[Math.floor(item.y)][Math.floor(item.x)])) return;
        allSprites.push({ type: 'item', entity: item, x: item.x + 0.5, y: item.y + 0.5, svgIcon: item.svgIcon || 'icon-potion-generic', zOffset: -0.2 });
    });

    const visibleSprites = [];
    allSprites.forEach(sprite => {
        const dx = sprite.x - player.x; const dy = sprite.y - player.y;
        sprite.dist = Math.sqrt(dx * dx + dy * dy);
        if (sprite.dist < 0.3 || sprite.dist > DUNGEON_CONFIG.maxRayDepth - 0.5) return;

        let angleToSprite = normalizeAngle(Math.atan2(dy, dx));
        let angleDiff = normalizeAngle(angleToSprite - player.angle);
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;

        const fovWithMargin = DUNGEON_CONFIG.fov / 2 + degreesToRadians(5);
        if (Math.abs(angleDiff) < fovWithMargin) {
            sprite.angleDiff = angleDiff; // Store for perspective correction
            sprite.screenX = Math.tan(angleDiff) * (screenWidth / 2) + (screenWidth / 2);
            visibleSprites.push(sprite);
        }
    });
    visibleSprites.sort((a, b) => b.dist - a.dist);
    return visibleSprites;
}

function drawSprites(spritesToRender, player) {
    if (!wallSlicesCache.zBuffer) return; // Ensure zBuffer is available

    spritesToRender.forEach(sprite => {
        // Perspective correction for distance
        const correctedDist = sprite.dist * Math.cos(sprite.angleDiff);
        if (correctedDist <= 0.1) return; // Avoid division by zero or extreme sizes

        const spriteBaseSize = DUNGEON_CONFIG.textureSize * 0.8; // Base size of sprite relative to texture size
        let spriteHeight = (spriteBaseSize / correctedDist) * (screenHeight / DUNGEON_CONFIG.textureSize) * 0.9 ; // Project based on screen height factor
        spriteHeight = clamp(spriteHeight, 15, screenHeight * 1.1); // Min/max sprite screen size
        const spriteWidth = spriteHeight; // Assuming square sprites

        const spriteTop = (screenHeight / 2) - (spriteHeight / 2) + ((sprite.zOffset || 0) * spriteHeight) + (screenHeight / correctedDist * 0.1); // Small vertical offset based on distance

        const spriteScreenXCenter = sprite.screenX;
        const spriteScreenXStart = spriteScreenXCenter - spriteWidth / 2;

        // Occlusion check for each column the sprite covers
        let firstVisibleColumn = -1, lastVisibleColumn = -1;
        const sliceWidth = screenWidth / DUNGEON_CONFIG.rayCount;

        for (let col = Math.floor(spriteScreenXStart / sliceWidth); col < Math.ceil((spriteScreenXStart + spriteWidth) / sliceWidth); col++) {
            if (col >= 0 && col < DUNGEON_CONFIG.rayCount) {
                if (correctedDist < wallSlicesCache.zBuffer[col]) {
                    if (firstVisibleColumn === -1) firstVisibleColumn = col;
                    lastVisibleColumn = col;
                } else if (firstVisibleColumn !== -1) { // Part of sprite is occluded, stop checking this segment
                    break;
                }
            }
        }

        if (firstVisibleColumn === -1) return; // Sprite is fully occluded


        let spriteImg = spriteCache.get(sprite.svgIcon);
        if (!spriteImg) {
            spriteImg = AssetManager.getSymbolAsImage(sprite.svgIcon, { width: 64, height: 64 }); // Default sprite res
            spriteCache.set(sprite.svgIcon, spriteImg);
        }

        if (spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0) {
            const brightness = clamp(1 - (correctedDist / (DUNGEON_CONFIG.maxRayDepth * 0.7)), 0.25, 1.0);
            mainCtx.globalAlpha = brightness;

            // Calculate visible portion of the sprite
            const visibleSpriteScreenXStart = firstVisibleColumn * sliceWidth;
            const visibleSpriteScreenWidth = (lastVisibleColumn - firstVisibleColumn + 1) * sliceWidth;
            
            // Calculate corresponding texture coordinates for the visible part
            const textureStartX = Math.max(0, (visibleSpriteScreenXStart - spriteScreenXStart) / spriteWidth);
            const textureVisibleWidth = visibleSpriteScreenWidth / spriteWidth;

            if(textureStartX < 1 && textureVisibleWidth > 0) {
                mainCtx.drawImage(
                    spriteImg,
                    textureStartX * spriteImg.naturalWidth, // sx
                    0,                                       // sy
                    textureVisibleWidth * spriteImg.naturalWidth, // sWidth
                    spriteImg.naturalHeight,                 // sHeight
                    visibleSpriteScreenXStart,               // dx
                    spriteTop,                               // dy
                    visibleSpriteScreenWidth,                // dWidth
                    spriteHeight                             // dHeight
                );
            }
            mainCtx.globalAlpha = 1.0;

            if (sprite.type === 'enemy' && sprite.entity.currentHp < sprite.entity.stats.maxHp && sprite.dist < 10) {
                const barWidth = clamp(spriteWidth * 0.5, 20, 60);
                const barHeight = clamp(spriteHeight * 0.05, 4, 8);
                const barX = spriteScreenXCenter - barWidth / 2;
                const barY = spriteTop - barHeight - 3;
                const hpRatio = sprite.entity.currentHp / sprite.entity.stats.maxHp;

                mainCtx.fillStyle = '#3a1a1a'; // Dark red background
                mainCtx.fillRect(barX, barY, barWidth, barHeight);
                mainCtx.fillStyle = hpRatio > 0.6 ? 'var(--color-success)' : hpRatio > 0.3 ? 'var(--color-xp)' : 'var(--color-danger)';
                mainCtx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
                mainCtx.strokeStyle = '#111'; mainCtx.lineWidth = 1;
                mainCtx.strokeRect(barX, barY, barWidth, barHeight);
            }
        }
    });
}


// --- Automap Drawing ---
function drawAutomap(ctx, player, exploredMap, gameMap, tileSize) {
    if (!ctx || !gameMap || !exploredMap) return;
    const mapWidthTiles = gameMap.width; const mapHeightTiles = gameMap.height;
    ctx.canvas.width = mapWidthTiles * tileSize; ctx.canvas.height = mapHeightTiles * tileSize;
    ctx.fillStyle = 'var(--color-bg-darkest, #0a0603)'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (let y = 0; y < mapHeightTiles; y++) {
        for (let x = 0; x < mapWidthTiles; x++) {
            if (!exploredMap[y] || !exploredMap[y][x]) continue;
            const tile = gameMap.getTile(x, y); let color;
            switch(tile.type) {
                case DUNGEON_CONFIG.TILES.FLOOR: color = 'var(--color-stone-medium, #605040)'; break;
                case DUNGEON_CONFIG.TILES.STAIRS_DOWN: color = 'var(--color-gold-light, #daa520)'; break;
                case DUNGEON_CONFIG.TILES.CHEST_CLOSED:
                case DUNGEON_CONFIG.TILES.CHEST_OPEN: color = 'var(--color-info, #2980b9)'; break;
                case DUNGEON_CONFIG.TILES.DOOR_WOOD_CLOSED:
                case DUNGEON_CONFIG.TILES.DOOR_WOOD_OPEN: color = tile.isOpen ? 'var(--color-gold, #b8860b)' : 'var(--color-wood-dark)'; break; // Open doors brighter
                case DUNGEON_CONFIG.TILES.WALL:
                default: color = 'var(--color-stone-dark, #302010)';
            }
            ctx.fillStyle = color; ctx.fillRect(x * tileSize, y * tileSize, tileSize - 0.5, tileSize - 0.5); // Small gap for grid
        }
    }
    const playerMarkerId = DUNGEON_CONFIG.TEXTURE_IDS.PARTY_MARKER;
    let playerMarkerImg = textureCache.get(playerMarkerId);
    if(!playerMarkerImg) {
        playerMarkerImg = AssetManager.getSymbolAsImage(playerMarkerId, {width: tileSize * 1.5, height: tileSize * 1.5}); // Make marker slightly larger
        textureCache.set(playerMarkerId, playerMarkerImg);
    }

    if (playerMarkerImg && playerMarkerImg.complete && playerMarkerImg.naturalWidth > 0) {
        ctx.save();
        ctx.translate(player.x * tileSize, player.y * tileSize); // Center of player's current tile
        ctx.rotate(player.angle + Math.PI/2); // Add PI/2 because typical SVGs might be 'upright'
        const markerSize = tileSize * 1.2;
        ctx.drawImage(playerMarkerImg, -markerSize / 2, -markerSize / 2, markerSize, markerSize);
        ctx.restore();
    } else {
        ctx.fillStyle = 'var(--color-success, #33dd33)'; ctx.beginPath();
        ctx.arc(player.x * tileSize, player.y * tileSize, tileSize / 2.5, 0, 2 * Math.PI); ctx.fill();
    }
}