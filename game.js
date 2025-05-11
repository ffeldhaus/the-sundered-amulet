// game.js - Core game logic, state management, and mechanics

import { GAME_CONFIG, UI_CONFIG, DUNGEON_CONFIG, PARTY_CONFIG, ARCHETYPES, ITEM_CONFIG, ENEMY_CONFIG } from './config.js';
import { getRandomInt, getRandomElement, shuffleArray, deepClone, clamp } from './utils.js';
import { addLogMessageToUI as UILog, updatePartyDisplay, updateInventoryUI, updateLogbook as updateUILogbookMapLevel, setResumeButtonState, showModal, clearItemDetailsOnModalClose } from './ui.js';
import { requestStartGameLoop, requestStopGameLoop } from './main.js';

// --- Game State Variables ---
let currentGameState = {
    player: { x: 1.5, y: 1.5, angle: 0 },
    party: [],
    activeCharacterIndex: 0,
    dungeonLevel: 1,
    gameMap: null,
    exploredMap: [],
    enemies: [],
    itemsOnMap: [],
    currentTurn: 'UNINITIALIZED',
    gameTime: 0,
    isGameActiveFlag: false,
    messageLogForSave: [],
};

// --- Character Class ---
class Character {
    constructor(archetypeId, name = null) {
        const archetype = ARCHETYPES.find(a => a.id === archetypeId);
        if (!archetype) throw new Error(`Archetype with ID "${archetypeId}" not found.`);

        this.id = `char_${Date.now()}_${getRandomInt(1000,9999)}`;
        this.name = name || archetype.name;
        this.archetype = deepClone(archetype);

        this.level = PARTY_CONFIG.initialLevel;
        this.xp = 0;
        this.nextLevelXp = GAME_CONFIG.baseNextLevelXp;

        this.baseStats = { ...this.archetype.baseStats };
        this.stats = { ...this.archetype.baseStats }; // Current effective stats
        this.currentHp = this.stats.hp;
        this.currentMp = this.stats.mp;

        this.inventory = [];
        this.equipment = {
            main_hand: null, off_hand: null, body: null, head: null,
            feet: null, amulet: null, ring1: null, ring2: null,
        };
        this.gold = 0;

        this.statusEffects = [];
        this.skills = [...(this.archetype.initialSkills || [])];
        this.spells = [...(this.archetype.initialSpells || [])];

        this.isAlive = true;
        this.hasActedThisTurn = false;

        this._applyInitialEquipment();
        this.recalculateStats();
    }

    _applyInitialEquipment() {
        if (this.archetype.initialEquipment) {
            for (const slotKey in this.archetype.initialEquipment) {
                const itemId = this.archetype.initialEquipment[slotKey];
                const itemData = ITEM_CONFIG.ITEM_BASES[itemId];
                if (itemData) {
                    const itemInstance = createItemInstance(itemId);
                    if (itemInstance) {
                        let actualSlot = itemInstance.slot ||
                            (itemInstance.type === ITEM_CONFIG.TYPES.WEAPON ? 'main_hand' :
                             itemInstance.type === ITEM_CONFIG.TYPES.ARMOR ? 'body' :
                             itemInstance.type === ITEM_CONFIG.TYPES.SHIELD ? 'off_hand' : null);
                        
                        if (actualSlot && this.canEquip(itemInstance, actualSlot)) {
                            this.equipItem(itemInstance, actualSlot, true);
                        } else {
                            // console.warn(`Could not initially equip ${itemId} for ${this.name} in slot ${actualSlot || 'inferred'}. Adding to inventory.`);
                            if(this.inventory.length < PARTY_CONFIG.inventorySlots) this.inventory.push(itemInstance);
                        }
                    }
                }
            }
        }
    }

    recalculateStats() {
        const effectiveBase = {...this.baseStats};
        for (let i = 1; i < this.level; i++) {
            for(const stat in this.archetype.levelUpBonuses) {
                effectiveBase[stat] = (effectiveBase[stat] || 0) + (this.archetype.levelUpBonuses[stat] || 0);
            }
        }
        this.stats = { ...effectiveBase };

        for (const slot in this.equipment) {
            const item = this.equipment[slot];
            if (item) {
                if (item.attack) this.stats.attack = (this.stats.attack || 0) + item.attack;
                if (item.defense) this.stats.defense = (this.stats.defense || 0) + item.defense;
                if (item.magic_bonus) this.stats.magic = (this.stats.magic || 0) + item.magic_bonus;
                // Use 'hp' and 'mp' from base stats for max, then add item bonuses
                if (item.hp_bonus) this.stats.hp = (this.stats.hp || 0) + item.hp_bonus;
                if (item.mp_bonus) this.stats.mp = (this.stats.mp || 0) + item.mp_bonus;
            }
        }
        this.stats.maxHp = this.stats.hp;
        this.stats.maxMp = this.stats.mp;
        this.currentHp = clamp(this.currentHp, 0, this.stats.maxHp);
        this.currentMp = clamp(this.currentMp, 0, this.stats.maxMp);
    }

    canEquip(item, targetSlot = null) {
        if (!item || !item.type) return false;
        const itemDesignatedSlot = item.slot ||
            (item.type === ITEM_CONFIG.TYPES.WEAPON ? 'main_hand' :
             item.type === ITEM_CONFIG.TYPES.ARMOR ? 'body' :
             item.type === ITEM_CONFIG.TYPES.SHIELD ? 'off_hand' :
             item.type === ITEM_CONFIG.TYPES.AMULET ? 'amulet' : null);
        if (!itemDesignatedSlot) return false;
        if (targetSlot) {
            if (targetSlot === itemDesignatedSlot) return true;
            if (itemDesignatedSlot === 'main_hand' && targetSlot === 'off_hand' && item.allow_offhand) return true;
            return false;
        }
        return true;
    }

    equipItem(item, slotToEquipIn = null, isInitialEquip = false) {
        const targetSlot = slotToEquipIn || item.slot ||
            (item.type === ITEM_CONFIG.TYPES.WEAPON ? 'main_hand' :
             item.type === ITEM_CONFIG.TYPES.ARMOR ? 'body' :
             item.type === ITEM_CONFIG.TYPES.SHIELD ? 'off_hand' :
             item.type === ITEM_CONFIG.TYPES.AMULET ? 'amulet' : null);

        if (!this.canEquip(item, targetSlot)) {
            if(!isInitialEquip) addLogMessage(`${this.name} cannot equip ${item.name}${targetSlot ? ` in ${targetSlot}` : ''}.`, 'orange');
            return false;
        }
        if (!targetSlot || !this.equipment.hasOwnProperty(targetSlot)) {
             if(!isInitialEquip) addLogMessage(`Invalid equipment slot "${targetSlot}" for ${item.name}.`, 'orange');
             return false;
        }

        if (targetSlot === 'main_hand' && item.slot === 'two_hand' && this.equipment.off_hand) {
            this.unequipItem('off_hand', isInitialEquip);
        }
        if (targetSlot === 'off_hand' && this.equipment.main_hand?.slot === 'two_hand') {
            this.unequipItem('main_hand', isInitialEquip);
        }

        if (this.equipment[targetSlot]) {
            this.unequipItem(targetSlot, isInitialEquip);
        }

        this.equipment[targetSlot] = item;
        if (!isInitialEquip) {
            const itemIndex = this.inventory.indexOf(item);
            if (itemIndex > -1) this.inventory.splice(itemIndex, 1);
        }
        this.recalculateStats();
        if (!isInitialEquip) addLogMessage(`${this.name} equipped ${item.name}.`, 'var(--color-info)');
        return true;
    }

    unequipItem(slot, isDuringInitialEquip = false) {
        if (this.equipment[slot]) {
            const unequippedItem = this.equipment[slot];
            if (!isDuringInitialEquip) {
                if (this.inventory.length < PARTY_CONFIG.inventorySlots) {
                    this.inventory.push(unequippedItem);
                    addLogMessage(`${this.name} unequipped ${unequippedItem.name}.`, 'var(--color-info)');
                } else {
                    addLogMessage(`Inventory full. Cannot unequip ${unequippedItem.name}. Dropping it.`, 'orange');
                    createMapItem(unequippedItem, currentGameState.player.x, currentGameState.player.y);
                }
            }
            this.equipment[slot] = null;
            this.recalculateStats();
            return true;
        }
        return false;
    }

    isEquipped(item) {
        for (const slot in this.equipment) {
            if (this.equipment[slot] && this.equipment[slot].id === item.id) return true; // Compare by unique ID
        }
        return false;
    }

    takeDamage(amount) {
        if (!this.isAlive) return;
        const actualDamage = Math.max(0, amount);
        this.currentHp = Math.max(0, this.currentHp - actualDamage);
        addLogMessage(`${this.name} takes ${actualDamage} damage. (${this.currentHp}/${this.stats.maxHp})`, 'var(--color-danger)');
        if (this.currentHp === 0) {
            this.isAlive = false;
            this.hasActedThisTurn = true;
            addLogMessage(`${this.name} has fallen!`, 'var(--color-danger)');
            checkGameOver();
        }
    }

    gainXp(amount) {
        if (!this.isAlive) return;
        this.xp += amount;
        addLogMessage(`${this.name} gains ${amount} XP.`, 'lightgreen');
        while (this.xp >= this.nextLevelXp && this.isAlive) { // Check isAlive in loop, could die from effect that gives XP
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.xp -= this.nextLevelXp;
        this.nextLevelXp = Math.floor(this.nextLevelXp * GAME_CONFIG.xpMultiplierPerLevel);

        for(const stat in this.archetype.levelUpBonuses) {
            this.baseStats[stat] = (this.baseStats[stat] || 0) + (this.archetype.levelUpBonuses[stat] || 0);
        }
        this.recalculateStats();
        this.currentHp = this.stats.maxHp;
        this.currentMp = this.stats.maxMp;
        addLogMessage(`${this.name} reached Level ${this.level}! Stats increased. HP/MP restored.`, 'var(--color-gold-highlight)');
    }

    canUseRanged() {
        const mainHand = this.equipment.main_hand;
        if(mainHand && mainHand.ranged){
            // TODO: Check ammo if applicable
            return true;
        }
        return false;
    }
}

class GameMap {
    constructor(width, height) {
        this.width = width; this.height = height; this.tiles = []; this.rooms = [];
        this._generateSimpleDungeon();
    }
    _generateSimpleDungeon() {
        this.tiles = Array(this.height).fill(null).map(() => Array(this.width).fill(null).map(() => ({ type: DUNGEON_CONFIG.TILES.WALL })));
        this.rooms = [];
        const numRooms = getRandomInt(6, 10);

        for (let i = 0; i < numRooms; i++) {
            const rW = getRandomInt(4, 8); const rH = getRandomInt(4, 8);
            const rX = getRandomInt(1, this.width - rW - 2); const rY = getRandomInt(1, this.height - rH - 2);
            const newRoom = { x: rX, y: rY, width: rW, height: rH, connected: false, id: i, center: { x: rX + Math.floor(rW/2), y: rY + Math.floor(rH/2) }};
            let overlaps = false;
            for (const room of this.rooms) {
                if (rX < room.x + room.width + 1 && rX + rW + 1 > room.x && rY < room.y + room.height + 1 && rY + rH + 1 > room.y) {
                    overlaps = true; break;
                }
            }
            if (!overlaps) this.rooms.push(newRoom);
        }

        if (this.rooms.length === 0) {
            const cX = Math.floor(this.width/4), cY = Math.floor(this.height/4), cW = Math.floor(this.width/2), cH = Math.floor(this.height/2);
            this.rooms.push({ x: cX, y: cY, width: cW, height: cH, connected: true, id: 0, center: { x: cX + Math.floor(cW/2), y: cY + Math.floor(cH/2) }});
        }
        this.rooms.sort((a, b) => a.center.x - b.center.x); // Sort to make corridors somewhat logical

        this.rooms.forEach(room => {
            for (let y = room.y; y < room.y + room.height; y++) {
                for (let x = room.x; x < room.x + room.width; x++) {
                    if (this.tiles[y] && this.tiles[y][x]) this.tiles[y][x] = { type: DUNGEON_CONFIG.TILES.FLOOR };
                }
            }
        });

        for (let i = 0; i < this.rooms.length -1; i++) {
            const rA = this.rooms[i]; const rB = this.rooms[i+1];
            const cAx = rA.center.x, cAy = rA.center.y, cBx = rB.center.x, cBy = rB.center.y;
            for (let x = Math.min(cAx, cBx); x <= Math.max(cAx, cBx); x++) if(this.tiles[cAy] && this.tiles[cAy][x]) this.tiles[cAy][x] = { type: DUNGEON_CONFIG.TILES.FLOOR };
            for (let y = Math.min(cAy, cBy); y <= Math.max(cAy, cBy); y++) if(this.tiles[y] && this.tiles[y][cBx]) this.tiles[y][cBx] = { type: DUNGEON_CONFIG.TILES.FLOOR };
        }

        this.rooms.forEach(room => { // Add doors
            for (let y = room.y -1; y <= room.y + room.height; y++) {
                for (let x = room.x -1; x <= room.x + room.width; x++) {
                    if ((x === room.x-1 || x === room.x+room.width || y === room.y-1 || y === room.y+room.height) && // On border
                        this.getTile(x,y).type === DUNGEON_CONFIG.TILES.WALL) { // Is a wall
                        // Check if it leads to a floor tile (corridor)
                        if ((this.getTile(x-1,y).type === DUNGEON_CONFIG.TILES.FLOOR && this.getTile(x+1,y).type === DUNGEON_CONFIG.TILES.FLOOR && (y >= room.y && y < room.y+room.height)) || // Horizontal door
                            (this.getTile(x,y-1).type === DUNGEON_CONFIG.TILES.FLOOR && this.getTile(x,y+1).type === DUNGEON_CONFIG.TILES.FLOOR && (x >= room.x && x < room.x+room.width))) { // Vertical door
                            if(Math.random() < 0.3) this.tiles[y][x] = { type: DUNGEON_CONFIG.TILES.DOOR_WOOD_CLOSED, isOpen: false };
                        }
                    }
                }
            }
        });
        const lastRoom = this.rooms[this.rooms.length - 1];
        if(lastRoom) this.tiles[lastRoom.center.y][lastRoom.center.x] = { type: DUNGEON_CONFIG.TILES.STAIRS_DOWN };
        else this.tiles[this.height-2][this.width-2] = {type: DUNGEON_CONFIG.TILES.STAIRS_DOWN}; // fallback
    }
    getTile(x, y) { return (this.tiles[y] && this.tiles[y][x]) ? this.tiles[y][x] : { type: DUNGEON_CONFIG.TILES.EMPTY }; }
    isSolid(x, y, checkClosedDoors = false) {
        const tile = this.getTile(x, y);
        return tile.type === DUNGEON_CONFIG.TILES.WALL || (checkClosedDoors && tile.type === DUNGEON_CONFIG.TILES.DOOR_WOOD_CLOSED && !tile.isOpen);
    }
    isTileVisibleToPlayer(tileX, tileY, playerPos) {
        const mDist = Math.abs(tileX - playerPos.x) + Math.abs(tileY - playerPos.y);
        if (mDist > DUNGEON_CONFIG.maxRayDepth * 0.9) return false;
        let x0 = Math.floor(playerPos.x); let y0 = Math.floor(playerPos.y);
        let x1 = Math.floor(tileX); let y1 = Math.floor(tileY);
        let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = dx + dy, e2;
        while (true) {
            if (x0 === x1 && y0 === y1) return true;
            if (this.isSolid(x0, y0, true) && !(x0 === Math.floor(playerPos.x) && y0 === Math.floor(playerPos.y))) return false;
            e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
    }
}

export function initializeGameState() { /* as before */ }
function _initializeExploredMap() { /* as before */ }

export function startNewGame(partyArchetypeIds) {
    console.log("GAME: Starting new game...");
    initializeGameState(); // Fresh state, this should create gameMap

    // ---- DEBUG LOG ----
    console.log("GAME: gameMap after initializeGameState:", currentGameState.gameMap);
    if (!currentGameState.gameMap) {
        console.error("CRITICAL: gameMap is null immediately after initializeGameState()!");
        // If this happens, the issue is within initializeGameState or GameMap constructor
        currentGameState.gameMap = new GameMap(DUNGEON_CONFIG.defaultMapWidth, DUNGEON_CONFIG.defaultMapHeight); // Try to re-create it
        console.log("GAME: gameMap re-created:", currentGameState.gameMap);
        if (!currentGameState.gameMap.rooms) { // Further debug GameMap constructor
             console.error("CRITICAL: gameMap re-created but has no rooms property!");
             currentGameState.gameMap.rooms = []; // Initialize rooms if missing after construction
        }
    }
    // ---- END DEBUG LOG ----


    if (!partyArchetypeIds || partyArchetypeIds.length === 0 || partyArchetypeIds.length > PARTY_CONFIG.maxPartySize) {
        UILog("Invalid party configuration for new game.", "var(--color-danger)"); 
        return false;
    }
    currentGameState.party = partyArchetypeIds.map(id => new Character(id));
    if (currentGameState.party.length > 0 && currentGameState.party[0]) {
        currentGameState.party[0].gold = GAME_CONFIG.initialPlayerGold;
    }


    // Ensure gameMap and rooms exist before trying to access them
    if (currentGameState.gameMap && currentGameState.gameMap.rooms && currentGameState.gameMap.rooms.length > 0) {
        const firstRoom = currentGameState.gameMap.rooms[0];
        currentGameState.player.x = firstRoom.center.x + 0.5;
        currentGameState.player.y = firstRoom.center.y + 0.5;
    } else {
        console.warn("GAME: No rooms found in gameMap or gameMap is invalid. Placing player at default.");
        currentGameState.player.x = 1.5; 
        currentGameState.player.y = 1.5; 
    }
    currentGameState.player.angle = getRandomElement([0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]);

    _populateLevel(); 
    _revealInitialArea();
    currentGameState.isGameActiveFlag = true; 
    setGameTurn('PLAYER');
    updateFullUI(); 
    UILog(`Welcome, adventurers! Level ${currentGameState.dungeonLevel} awaits.`, 'var(--color-gold-highlight)');
    console.log("GAME: New game started successfully.");
    return true;
}

function _populateLevel() {
    currentGameState.enemies = []; currentGameState.itemsOnMap = []; const map = currentGameState.gameMap;
    const numEnemies = getRandomInt(Math.floor(map.rooms.length * 0.4), Math.floor(map.rooms.length * 0.7));
    for (let i = 0; i < numEnemies; i++) {
        const enemyBaseId = getRandomElement(Object.keys(ENEMY_CONFIG.ENEMY_BASES));
        if (enemyBaseId) {
            const enemy = createEnemyInstance(enemyBaseId, currentGameState.dungeonLevel);
            const room = getRandomElement(map.rooms.filter(r => r !== map.rooms[0])); // Not in first room
            if (room && enemy) placeEntityInRoom(enemy, room, (x,y) => !isEnemyAt(x,y) && (Math.abs(x - currentGameState.player.x) > 3 || Math.abs(y - currentGameState.player.y) > 3) );
        }
    }
    const numItems = getRandomInt(Math.floor(map.rooms.length * 0.15), Math.floor(map.rooms.length * 0.35));
    for (let i = 0; i < numItems; i++) {
        const itemBaseId = getRandomElement(Object.keys(ITEM_CONFIG.ITEM_BASES).filter(id => ITEM_CONFIG.ITEM_BASES[id].type !== ITEM_CONFIG.TYPES.QUEST));
        if (itemBaseId) {
            const item = createItemInstance(itemBaseId, currentGameState.dungeonLevel);
            const room = getRandomElement(map.rooms);
            if (room && item) placeEntityInRoom(item, room, (x,y) => !currentGameState.itemsOnMap.some(it => it.x === x && it.y === iy) && !isEnemyAt(x,y) );
        }
    }
}

function placeEntityInRoom(entity, room, placementCondition) {
    for(let attempts = 0; attempts < 15; attempts++){
        const ex = getRandomInt(room.x, room.x + room.width - 1);
        const ey = getRandomInt(room.y, room.y + room.height - 1);
        if (currentGameState.gameMap.getTile(ex, ey).type === DUNGEON_CONFIG.TILES.FLOOR && placementCondition(ex,ey)) {
            entity.x = ex; entity.y = ey;
            if(entity.currentHp !== undefined) currentGameState.enemies.push(entity); // It's an enemy
            else currentGameState.itemsOnMap.push(entity); // It's an item
            return true;
        }
    }
    return false;
}

function _revealInitialArea() {
    const px = Math.floor(currentGameState.player.x);
    const py = Math.floor(currentGameState.player.y);
    revealTile(px, py);
    // Reveal adjacent tiles
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            revealTile(px + dx, py + dy);
        }
    }
}

export function revealTile(x, y) {
    if (x >= 0 && x < currentGameState.gameMap.width && y >= 0 && y < currentGameState.gameMap.height) {
        currentGameState.exploredMap[y][x] = true;
    }
}

// --- Turn Management ---
export function setGameTurn(turn) {
    currentGameState.currentTurn = turn;
    console.log("Turn set to:", turn); // Debug
    if (turn === 'PLAYER') {
        currentGameState.party.forEach(char => {
            if (char.isAlive) char.hasActedThisTurn = false;
        });
        // Any start-of-player-turn effects
    } else if (turn === 'ENEMY') {
        // Enemy AI will be processed
        processEnemyTurns();
    } else if (turn === 'GAME_OVER') {
        requestStopGameLoop();
        addLogMessage("GAME OVER. Your adventure ends here.", 'var(--color-danger)');
        // UI might show a game over screen/modal
    }
    updateFullUI(); // Update UI to reflect turn changes (e.g., enable/disable action buttons)
}

export function endPlayerTurn(characterIndex = currentGameState.activeCharacterIndex) {
    if (currentGameState.currentTurn !== 'PLAYER') return;

    const char = currentGameState.party[characterIndex];
    if (char && char.isAlive) {
        char.hasActedThisTurn = true;
    }

    const allLivingPlayerCharsActed = currentGameState.party
        .filter(p => p.isAlive)
        .every(p => p.hasActedThisTurn);

    if (allLivingPlayerCharsActed) {
        setGameTurn('ENEMY');
    } else {
        // Select next available character automatically if needed
        let nextActive = (currentGameState.activeCharacterIndex + 1) % currentGameState.party.length;
        while(!currentGameState.party[nextActive].isAlive || currentGameState.party[nextActive].hasActedThisTurn) {
            nextActive = (nextActive + 1) % currentGameState.party.length;
            if (nextActive === (currentGameState.activeCharacterIndex + 1) % currentGameState.party.length) break; // Full loop, shouldn't happen if allLivingPlayerCharsActed is false
        }
        if (currentGameState.party[nextActive].isAlive && !currentGameState.party[nextActive].hasActedThisTurn) {
            currentGameState.activeCharacterIndex = nextActive;
        }
        updateFullUI();
    }
}

function processEnemyTurns() {
    if (currentGameState.currentTurn !== 'ENEMY' || !currentGameState.isGameActiveFlag) return;
    let anyEnemyActed = false;
    currentGameState.enemies.forEach(enemy => {
        if (enemy.currentHp > 0 && currentGameState.isGameActiveFlag) { // check isGameActive again in case game ended
            anyEnemyActed = true;
            const playerTileX = Math.floor(currentGameState.player.x); const playerTileY = Math.floor(currentGameState.player.y);
            const dxPlayer = playerTileX - enemy.x; const dyPlayer = playerTileY - enemy.y;

            if (Math.abs(dxPlayer) <= 1 && Math.abs(dyPlayer) <= 1 && (dxPlayer !== 0 || dyPlayer !== 0)) {
                const targetCharacter = getRandomElement(currentGameState.party.filter(p => p.isAlive));
                if (targetCharacter) {
                    UILog(`${enemy.name} attacks ${targetCharacter.name}!`, 'orange');
                    let damage = Math.max(1, enemy.stats.attack - targetCharacter.stats.defense);
                    damage = Math.floor(damage * getRandomFloat(0.75, 1.25));
                    targetCharacter.takeDamage(damage); // takeDamage will log the actual damage
                }
            } else { // Move
                let moveX = 0, moveY = 0;
                if (dxPlayer !== 0) moveX = dxPlayer > 0 ? 1 : -1;
                if (dyPlayer !== 0) moveY = dyPlayer > 0 ? 1 : -1;

                const nextX = enemy.x + moveX; const nextY = enemy.y + moveY;
                const altNextX = enemy.x + moveX; const altNextY = enemy.y; // Try horizontal first
                const altNextY2 = enemy.y + moveY; const altNextX2 = enemy.x; // Then vertical

                if (moveX !== 0 && moveY !== 0) { // Diagonal preference
                    if (!currentGameState.gameMap.isSolid(nextX, nextY, true) && !isEnemyAt(nextX, nextY)) { enemy.x = nextX; enemy.y = nextY; }
                    else if (!currentGameState.gameMap.isSolid(altNextX, altNextY, true) && !isEnemyAt(altNextX, altNextY)) { enemy.x = altNextX; }
                    else if (!currentGameState.gameMap.isSolid(altNextX2, altNextY2, true) && !isEnemyAt(altNextX2, altNextY2)) { enemy.y = altNextY2; }
                } else if (moveX !== 0) { // Pure horizontal
                     if (!currentGameState.gameMap.isSolid(nextX, enemy.y, true) && !isEnemyAt(nextX, enemy.y)) enemy.x = nextX;
                } else if (moveY !== 0) { // Pure vertical
                     if (!currentGameState.gameMap.isSolid(enemy.x, nextY, true) && !isEnemyAt(enemy.x, nextY)) enemy.y = nextY;
                }
            }
        }
    });
    if (currentGameState.currentTurn !== 'GAME_OVER' && currentGameState.isGameActiveFlag) setGameTurn('PLAYER');
}

// --- Combat & Actions ---
// (To be expanded significantly)
export function playerAction(actionType, params) {
    if (currentGameState.currentTurn !== 'PLAYER') return;
    const activeChar = currentGameState.party[currentGameState.activeCharacterIndex];
    if (!activeChar || !activeChar.isAlive || activeChar.hasActedThisTurn) {
        addLogMessage("Cannot act now.", "orange");
        return;
    }

    switch (actionType) {
        case 'move': // { dx, dy } or { direction: 'forward'/'backward'/'turn_left'/'turn_right'}
            handlePlayerMove(params);
            break;
        case 'interact':
            handlePlayerInteract();
            break;
        case 'melee':
        case 'ranged':
        case 'magic':
            handlePlayerCombatAction(actionType);
            break;
        // case 'defend':
        // case 'use_skill':
        // case 'open_inventory': // This should be handled by UI directly mostly
        default:
            addLogMessage(`Action type "${actionType}" not yet implemented.`, "grey");
            // For unknown actions that should consume a turn:
            // activeChar.hasActedThisTurn = true;
            // endPlayerTurn();
            return; // Don't end turn if action is purely UI or not turn-consuming
    }
    // Most actions will call endPlayerTurn() themselves if they consume the turn.
}

function handlePlayerMove(params) {
    const activeChar = currentGameState.party[currentGameState.activeCharacterIndex];
    let newX = currentGameState.player.x;
    let newY = currentGameState.player.y;
    let newAngle = currentGameState.player.angle;
    let moved = false;

    if (params.direction) {
        const moveSpeed = 1.0; // Move one tile
        switch(params.direction) {
            case 'forward':
                newX += Math.cos(currentGameState.player.angle) * moveSpeed;
                newY += Math.sin(currentGameState.player.angle) * moveSpeed;
                break;
            case 'backward':
                newX -= Math.cos(currentGameState.player.angle) * moveSpeed;
                newY -= Math.sin(currentGameState.player.angle) * moveSpeed;
                break;
            case 'turn_left':
                newAngle = normalizeAngle(currentGameState.player.angle - Math.PI / 2);
                break;
            case 'turn_right':
                newAngle = normalizeAngle(currentGameState.player.angle + Math.PI / 2);
                break;
        }
    } else if (params.dx !== undefined && params.dy !== undefined) { // Direct tile move (not typical for 1st person)
        newX += params.dx;
        newY += params.dy;
    }

    const targetTileX = Math.floor(newX);
    const targetTileY = Math.floor(newY);

    if (newAngle !== currentGameState.player.angle) { // Turn action
        currentGameState.player.angle = newAngle;
        // Turning might or might not consume a full turn depending on game rules
        // For now, assume turning is quick and doesn't end turn or just updates view.
        // If turns are very granular, it could:
        // activeChar.hasActedThisTurn = true;
        // endPlayerTurn();
        updateFullUI(); // To re-render view if turn doesn't end
        return; // If only turning, don't proceed to movement collision
    }


    if (!currentGameState.gameMap.isSolid(targetTileX, targetTileY, true)) {
        currentGameState.player.x = newX;
        currentGameState.player.y = newY;
        moved = true;
        revealTile(targetTileX, targetTileY);
        // Reveal surrounding tiles if desired
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                revealTile(targetTileX + dx, targetTileY + dy);
            }
        }

        // Check for items on the new tile
        const itemIndexOnTile = currentGameState.itemsOnMap.findIndex(item =>
            Math.floor(item.x) === targetTileX && Math.floor(item.y) === targetTileY
        );
        if (itemIndexOnTile !== -1) {
            pickupItemFromMap(itemIndexOnTile);
        }
        // Check for map events (e.g. stairs)
        const currentTile = currentGameState.gameMap.getTile(targetTileX, targetTileY);
        if (currentTile.type === DUNGEON_CONFIG.TILES.STAIRS_DOWN) {
            addLogMessage("You found stairs leading down...", "var(--color-gold)");
            // Action to descend should be explicit, not automatic on move
        }

    } else {
        addLogMessage("Blocked!", "orange");
        // SFXPlayer.play('sfx_bump_wall');
    }

    if(moved){
        activeChar.hasActedThisTurn = true;
        endPlayerTurn();
    } else {
        updateFullUI(); // Redraw if blocked but no turn end
    }
}

function handlePlayerInteract() {
    const activeChar = currentGameState.party[currentGameState.activeCharacterIndex];
    const lookDirX = Math.round(Math.cos(currentGameState.player.angle));
    const lookDirY = Math.round(Math.sin(currentGameState.player.angle));
    const lookX = Math.floor(currentGameState.player.x + lookDirX);
    const lookY = Math.floor(currentGameState.player.y + lookDirY);
    const tileInFront = currentGameState.gameMap.getTile(lookX, lookY);

    let actionTaken = false;
    if (tileInFront.type === DUNGEON_CONFIG.TILES.DOOR_WOOD_CLOSED || tileInFront.type === DUNGEON_CONFIG.TILES.DOOR_WOOD_OPEN) {
        tileInFront.isOpen = !tileInFront.isOpen;
        tileInFront.type = tileInFront.isOpen ? DUNGEON_CONFIG.TILES.DOOR_WOOD_OPEN : DUNGEON_CONFIG.TILES.DOOR_WOOD_CLOSED;
        UILog(tileInFront.isOpen ? "Door opened." : "Door closed."); actionTaken = true;
    } else if (tileInFront.type === DUNGEON_CONFIG.TILES.CHEST_CLOSED) {
        UILog("You open the chest!", "var(--color-info)");
        tileInFront.type = DUNGEON_CONFIG.TILES.CHEST_OPEN;
        for(let i=0; i<getRandomInt(1,3); i++){
            const itemBaseId = getRandomElement(Object.keys(ITEM_CONFIG.ITEM_BASES).filter(id => ITEM_CONFIG.ITEM_BASES[id].type !== ITEM_CONFIG.TYPES.QUEST));
            if(itemBaseId){ const loot = createItemInstance(itemBaseId); if (loot) {
                UILog(`Found ${loot.name}.`, 'var(--color-gold)');
                if(activeChar.inventory.length < PARTY_CONFIG.inventorySlots) activeChar.inventory.push(loot);
                else createMapItem(loot, lookX + 0.5, lookY + 0.5); // Drop at chest
            }}
        }
        actionTaken = true;
    } else if (currentGameState.gameMap.getTile(Math.floor(currentGameState.player.x), Math.floor(currentGameState.player.y)).type === DUNGEON_CONFIG.TILES.STAIRS_DOWN) {
        descendToNextLevel(); actionTaken = true; // Descending is an action itself
    } else { UILog("Nothing interesting to interact with in that direction.", "grey"); }

    if (actionTaken) { activeChar.hasActedThisTurn = true; endPlayerTurn(); }
    else updateFullUI(); // Redraw if no action taken
}

function handlePlayerCombatAction(actionType) {
    const activeChar = currentGameState.party[currentGameState.activeCharacterIndex];
    // Determine target: For simplicity, assume target is in front if melee/ranged
    // Magic might have different targeting rules (AoE, specific target selection)
    const lookX = Math.floor(currentGameState.player.x + Math.cos(currentGameState.player.angle));
    const lookY = Math.floor(currentGameState.player.y + Math.sin(currentGameState.player.angle));

    const targetEnemy = currentGameState.enemies.find(e => e.x === lookX && e.y === lookY && e.currentHp > 0);

    if (!targetEnemy && (actionType === 'melee' || actionType === 'ranged')) {
        addLogMessage("No target in front.", "orange");
        // Optionally consume turn for a missed attack attempt, or allow re-aiming.
        // For now, let's say it consumes the action:
        activeChar.hasActedThisTurn = true;
        endPlayerTurn();
        return;
    }

    // TODO: Implement detailed combat logic based on actionType, character stats, enemy stats, equipment, spells, etc.
    if (actionType === 'melee') {
        if(targetEnemy){
            addLogMessage(`${activeChar.name} attacks ${targetEnemy.name} with ${activeChar.equipment.main_hand?.name || 'fists'}!`, 'lightblue');
            // Simplified combat:
            const damage = Math.max(1, activeChar.stats.attack - targetEnemy.stats.defense);
            targetEnemy.currentHp -= damage;
            addLogMessage(`${targetEnemy.name} takes ${damage} damage. (${targetEnemy.currentHp}/${targetEnemy.stats.maxHp})`, 'var(--color-danger)');
            if (targetEnemy.currentHp <= 0) onEnemyDefeated(targetEnemy);
        }
    } else if (actionType === 'ranged') {
        // Check for ranged weapon, ammo, line of sight, range
        if (!activeChar.canUseRanged()) {
            addLogMessage(`${activeChar.name} needs a ranged weapon.`, 'orange');
        } else if (targetEnemy) {
            addLogMessage(`${activeChar.name} shoots at ${targetEnemy.name}!`, 'lightgreen');
            const damage = Math.max(1, activeChar.stats.attack - targetEnemy.stats.defense); // Ranged attack might use different stat or have modifiers
            targetEnemy.currentHp -= damage;
            addLogMessage(`${targetEnemy.name} takes ${damage} damage. (${targetEnemy.currentHp}/${targetEnemy.stats.maxHp})`, 'var(--color-danger)');
            if (targetEnemy.currentHp <= 0) onEnemyDefeated(targetEnemy);
        }
    } else if (actionType === 'magic') {
        const manaCost = 10; // Example
        if (activeChar.currentMp < manaCost) {
            addLogMessage(`${activeChar.name} doesn't have enough mana!`, 'orange');
        } else {
            activeChar.currentMp -= manaCost;
            addLogMessage(`${activeChar.name} casts a spell! (Effect TBD)`, 'cyan');
            // Apply spell effect to targetEnemy or area
            if (targetEnemy) {
                const spellDamage = activeChar.stats.magic + 10; // Example
                targetEnemy.currentHp -= spellDamage;
                addLogMessage(`${targetEnemy.name} takes ${spellDamage} magic damage.`, 'var(--color-danger)');
                if (targetEnemy.currentHp <= 0) onEnemyDefeated(targetEnemy);
            }
        }
    }

    activeChar.hasActedThisTurn = true;
    endPlayerTurn();
}


// --- Item Management ---
function createItemInstance(itemBaseId, level = 1) {
    const base = ITEM_CONFIG.ITEM_BASES[itemBaseId];
    if (!base) {
        console.warn(`Item base ID "${itemBaseId}" not found.`);
        return null;
    }
    // Simple clone for now. Later, apply affixes, level scaling, etc.
    const instance = deepClone(base);
    instance.id = `iteminst_${Date.now()}_${getRandomInt(1000,9999)}`; // Unique instance ID
    // Example scaling:
    if (instance.attack) instance.attack = Math.round(instance.attack * (1 + (level - 1) * 0.1));
    if (instance.defense) instance.defense = Math.round(instance.defense * (1 + (level - 1) * 0.1));
    instance.value = Math.round(instance.value * (1 + (level - 1) * 0.15));
    return instance;
}
function createMapItem(itemData, x, y) {
    const mapItem = { ...itemData, x, y }; // Add position
    currentGameState.itemsOnMap.push(mapItem);
}

function pickupItemFromMap(itemIndexOnMap) {
    const item = currentGameState.itemsOnMap[itemIndexOnMap];
    const activeChar = currentGameState.party[currentGameState.activeCharacterIndex];

    if (activeChar.inventory.length < PARTY_CONFIG.inventorySlots) {
        activeChar.inventory.push(item);
        currentGameState.itemsOnMap.splice(itemIndexOnMap, 1);
        addLogMessage(`${activeChar.name} picked up ${item.name}.`, 'var(--color-success)');
        // SFXPlayer.play(SOUND_CONFIG.SFX_KEYS.ITEM_PICKUP);
        if (document.getElementById(UI_CONFIG.inventoryPanelId)?.style.display === 'block') {
            updateInventoryUI(activeChar); // Refresh if inventory is open
        }
    } else {
        addLogMessage(`${activeChar.name}'s inventory is full. Cannot pick up ${item.name}.`, 'orange');
    }
}

export function useInventoryItem(characterIndex, itemSlotIndex) {
    const character = currentGameState.party[characterIndex];
    const item = character?.inventory[itemSlotIndex];
    if (!item || character.hasActedThisTurn || !character.isAlive) {
        addLogMessage("Cannot use item now.", "orange"); return;
    }

    if (item.type === ITEM_CONFIG.TYPES.POTION) {
        // Example potion effect
        if (item.effect === 'heal_hp') {
            character.currentHp = Math.min(character.stats.maxHp, character.currentHp + item.magnitude);
            addLogMessage(`${character.name} used ${item.name}, healing ${item.magnitude} HP.`, 'var(--color-success)');
        } else if (item.effect === 'restore_mp') {
             character.currentMp = Math.min(character.stats.maxMp, character.currentMp + item.magnitude);
            addLogMessage(`${character.name} used ${item.name}, restoring ${item.magnitude} MP.`, 'var(--color-info)');
        }
        // SFXPlayer.play(SOUND_CONFIG.SFX_KEYS.POTION_DRINK);
        character.inventory.splice(itemSlotIndex, 1); // Consume item
        character.hasActedThisTurn = true;
        endPlayerTurn(characterIndex);
    } else {
        addLogMessage(`${item.name} cannot be used this way.`, "grey");
    }
}

export function equipInventoryItem(characterIndex, itemSlotIndex) {
    const character = currentGameState.party[characterIndex];
    const item = character?.inventory[itemSlotIndex];
     if (!item || character.hasActedThisTurn || !character.isAlive) {
        addLogMessage("Cannot equip item now.", "orange"); return;
    }

    if (character.isEquipped(item)) { // If it's already equipped, this action means unequip
        const slot = Object.keys(character.equipment).find(s => character.equipment[s] === item);
        if(slot) character.unequipItem(slot);
    } else {
        character.equipItem(item); // equipItem handles moving from inventory
    }
    character.hasActedThisTurn = true; // Equipping usually takes an action
    endPlayerTurn(characterIndex);
}

export function dropInventoryItem(characterIndex, itemSlotIndex) {
    const character = currentGameState.party[characterIndex];
    const item = character?.inventory[itemSlotIndex];
    if (!item || !character.isAlive) {
        addLogMessage("Cannot drop item now.", "orange"); return;
    }
    // No turn cost to drop usually, unless specific game rules
    character.inventory.splice(itemSlotIndex, 1);
    createMapItem(item, currentGameState.player.x, currentGameState.player.y);
    addLogMessage(`${character.name} dropped ${item.name}.`, "grey");
    updateInventoryUI(character); // Refresh inventory immediately
}

// --- Enemy Management ---
function createEnemyInstance(enemyBaseId, level = 1) {
    const base = ENEMY_CONFIG.ENEMY_BASES[enemyBaseId];
    if (!base) {
        console.warn(`Enemy base ID "${enemyBaseId}" not found.`);
        return null;
    }
    const instance = deepClone(base);
    instance.id = `enemyinst_${Date.now()}_${getRandomInt(1000,9999)}`;
    instance.stats = { ...base.baseStats };
    // Scale stats by level (example)
    instance.stats.hp = Math.round(instance.stats.hp * (1 + (level - 1) * 0.2));
    instance.currentHp = instance.stats.hp;
    instance.stats.attack = Math.round(instance.stats.attack * (1 + (level - 1) * 0.15));
    instance.stats.defense = Math.round(instance.stats.defense * (1 + (level - 1) * 0.15));
    instance.stats.xp = Math.round(instance.stats.xp * (1 + (level - 1) * 0.25));
    instance.stats.gold = Math.round(instance.stats.gold * (1 + (level - 1) * 0.2));
    return instance;
}

function isEnemyAt(x,y) {
    return currentGameState.enemies.some(e => Math.floor(e.x) === x && Math.floor(e.y) === y && e.currentHp > 0);
}

function onEnemyDefeated(enemy) {
    addLogMessage(`${enemy.name} is defeated!`, 'var(--color-success)');
    // SFXPlayer.play(SOUND_CONFIG.SFX_KEYS.ENEMY_DEATH_GENERIC);

    // Distribute XP and Gold
    const xpGained = enemy.stats.xp;
    const goldGained = enemy.stats.gold;
    const alivePartyMembers = currentGameState.party.filter(p => p.isAlive);
    if (alivePartyMembers.length > 0) {
        const xpPerMember = Math.floor(xpGained / alivePartyMembers.length);
        alivePartyMembers.forEach(member => {
            member.xp += xpPerMember;
            // Check for level up (implement Character.gainXp(amount) which checks for level up)
            addLogMessage(`${member.name} gains ${xpPerMember} XP.`, 'lightgreen');
        });
        currentGameState.party[0].gold += goldGained; // First character gets party gold for now
        addLogMessage(`Party finds ${goldGained} gold.`, 'var(--color-gold)');
    }

    // Drop loot
    // TODO: Implement loot tables from ENEMY_CONFIG
    if (Math.random() < 0.3) { // 30% chance to drop an item
        const itemBaseId = getRandomElement(Object.keys(ITEM_CONFIG.ITEM_BASES).filter(id => ITEM_CONFIG.ITEM_BASES[id].type !== ITEM_CONFIG.TYPES.QUEST));
        if (itemBaseId) {
            const droppedItem = createItemInstance(itemBaseId, currentGameState.dungeonLevel);
            if (droppedItem) {
                createMapItem(droppedItem, enemy.x, enemy.y);
                addLogMessage(`${enemy.name} dropped ${droppedItem.name}!`, 'var(--color-info)');
            }
        }
    }

    // Remove enemy from game state
    currentGameState.enemies = currentGameState.enemies.filter(e => e.id !== enemy.id);
}


// --- Game Over & Level Progression ---
function checkGameOver() {
    if (currentGameState.party.every(p => !p.isAlive)) {
        setGameTurn('GAME_OVER');
    }
}

function descendToNextLevel() {
    addLogMessage(`Descending to Level ${currentGameState.dungeonLevel + 1}...`, 'var(--color-gold-highlight)');
    currentGameState.dungeonLevel++;
    currentGameState.gameMap = new GameMap(DUNGEON_CONFIG.defaultMapWidth, DUNGEON_CONFIG.defaultMapHeight); // New map
    _initializeExploredMap();
    
    currentGameState.player.x = 1.5; // Reset player position
    currentGameState.player.y = 1.5;
    currentGameState.player.angle = Math.PI / 2;

    _populateLevel(); // Populate new level with enemies/items
    _revealInitialArea();
    
    setGameTurn('PLAYER'); // Player starts on new level
    updateFullUI(); // Update map display, level indicators etc.
    saveGame(); // Auto-save on level change
}

// --- Utility and Helper Functions ---
function updateFullUI() {
    updatePartyDisplay(currentGameState.party, currentGameState.activeCharacterIndex);
    // Only update inventory if it's open and we have an active character for it
    const inventoryPanel = document.getElementById(UI_CONFIG.inventoryPanelId);
    if (inventoryPanel?.style.display === 'block' && currentGameState.party[currentGameState.activeCharacterIndex]) {
        updateInventoryUI(currentGameState.party[currentGameState.activeCharacterIndex]);
    }
    updateUILogbook(currentGameState.dungeonLevel); // Updates dungeon level in UI
}

// --- Save & Load ---
export function saveGame() {
    if (!currentGameState.isGameActiveFlag) {
        addLogMessage("No active game to save.", "orange");
        return;
    }
    try {
        // Clone state to avoid issues if it's modified while stringifying (unlikely here but good practice)
        const stateToSave = deepClone(currentGameState);
        // GameMap instance cannot be directly serialized, save its relevant data
        stateToSave.gameMapData = {
            width: stateToSave.gameMap.width,
            height: stateToSave.gameMap.height,
            tiles: stateToSave.gameMap.tiles, // This assumes tiles are simple objects
        };
        delete stateToSave.gameMap; // Remove the instance

        localStorage.setItem(GAME_CONFIG.saveKeyGameState, JSON.stringify(stateToSave));
        // Save party configuration (archetype IDs) if not already handled by character creation flow
        const partyArchetypeIds = currentGameState.party.map(char => char.archetype.id);
        localStorage.setItem(GAME_CONFIG.saveKeyPartyConfig, JSON.stringify(partyArchetypeIds));

        addLogMessage("Game Saved!", "var(--color-success)");
    } catch (e) {
        console.error("Error saving game:", e);
        addLogMessage("Failed to save game.", "var(--color-danger)");
    }
}

export function loadGame() {
    const savedStateString = localStorage.getItem(GAME_CONFIG.saveKeyGameState);
    if (!savedStateString) { setResumeButtonState(false); return false; }
    try {
        const loadedData = JSON.parse(savedStateString);
        const mapInstance = new GameMap(loadedData.gameMapData.width, loadedData.gameMapData.height);
        mapInstance.tiles = loadedData.gameMapData.tiles; mapInstance.rooms = loadedData.gameMapData.rooms || [];
        loadedData.gameMap = mapInstance; delete loadedData.gameMapData;
        currentGameState = { ...currentGameState, ...loadedData }; // Base merge

        currentGameState.party = loadedData.party.map(charData => {
            const character = new Character(charData.archetype.id, charData.name); // Use archetype.id from saved charData
            Object.keys(charData).forEach(key => {
                if (key !== 'archetype' && character.hasOwnProperty(key)) {
                    if (['equipment', 'inventory', 'statusEffects', 'stats', 'baseStats'].includes(key)) {
                        character[key] = deepClone(charData[key]);
                    } else {
                        character[key] = charData[key];
                    }
                }
            });
            // Re-link item instances in equipment and inventory if they were just plain data
            // This is complex. For now, assume they are simple enough or handle in Character class reconstruction.
            // A robust item system would re-create item instances based on saved item IDs/properties.
            // For now, we ensure `recalculateStats` is called which uses the loaded equipment objects.
            character.recalculateStats();
            return character;
        });
        
        currentGameState.isGameActiveFlag = true; setResumeButtonState(true);
        updateFullUI(); UILog("Game Loaded.", "var(--color-success)");
        (currentGameState.messageLogForSave || []).forEach(log => UILog(log.message, log.color));
        currentGameState.messageLogForSave = []; // Clear after restoring
        return true;
    } catch (e) {
        console.error("Error loading game:", e);
        UILog("Failed to load. Data might be corrupt.", "var(--color-danger)");
        localStorage.removeItem(GAME_CONFIG.saveKeyGameState); localStorage.removeItem(GAME_CONFIG.saveKeyPartyConfig);
        setResumeButtonState(false); return false;
    }
}

export function restartFullGame() {
    // Called by UI when user confirms reset
    initializeGameState(); // Resets currentGameState to its initial empty/default state
    currentGameState.isGameActiveFlag = false;
    // UI module will handle showing main menu etc.
}


// --- Getters for external modules (read-only access to state) ---
export const getPlayerPosition = () => ({ ...currentGameState.player });
export const getParty = () => currentGameState.party; // Consider returning deepClone if mutations are risky
export const getActiveCharacter = () => ({
    character: currentGameState.party[currentGameState.activeCharacterIndex],
    index: currentGameState.activeCharacterIndex
});
export const getCurrentDungeonLevel = () => currentGameState.dungeonLevel;
export const getGameMap = () => currentGameState.gameMap; // Be careful with direct mutation
export const getExploredMap = () => currentGameState.exploredMap;
export const getEnemies = () => currentGameState.enemies;
export const getItemsOnMap = () => currentGameState.itemsOnMap;
export const getGameTurn = () => currentGameState.currentTurn;
export const isGameActive = () => currentGameState.isGameActiveFlag;

export const setActiveCharacterIndex = (index) => {
    if (index >= 0 && index < currentGameState.party.length && currentGameState.party[index].isAlive) {
        currentGameState.activeCharacterIndex = index;
        addLogMessage(`${currentGameState.party[index].name} selected.`, 'var(--color-info)');
        updateFullUI(); // Refresh UI, e.g. active character highlight
    }
};

// Override global addLogMessage to also store to save buffer if game module is loaded
const originalUILog = UILog;
function addLogMessage(message, color = 'var(--color-text-light)') {
    originalUILog(message, color); // Call the UI logger
    if (currentGameState && currentGameState.messageLogForSave) { // Check if game state is initialized
        currentGameState.messageLogForSave.push({ message, color, timestamp: Date.now() });
        if (currentGameState.messageLogForSave.length > GAME_CONFIG.maxLogMessages / 2) { // Keep save log smaller
            currentGameState.messageLogForSave.shift();
        }
    }
}
// Expose our wrapped addLogMessage if other modules need to log through game state
export { addLogMessage };