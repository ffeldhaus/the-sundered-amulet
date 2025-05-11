// config.js

// --- Core Game Configuration ---
export const GAME_CONFIG = {
    gameTitle: "The Sundered Amulet - Enhanced Edition",
    version: "0.5.0-alpha", // Example version
    svgAssetPath: 'assets.svg', // Path to your consolidated SVG assets
    saveKeyPrefix: 'sunderedAmuletEE_',
    get saveKeyGameState() { return `${this.saveKeyPrefix}gameState`; },
    get saveKeyPartyConfig() { return `${this.saveKeyPrefix}partyConfig`; },
    get saveKeySettings() { return `${this.saveKeyPrefix}settings`; },
    maxLogMessages: 150,
    initialPlayerGold: 100,
    baseNextLevelXp: 100,
    xpMultiplierPerLevel: 1.65,
    autoSaveInterval: 300000, // milliseconds (5 minutes), 0 to disable
};

// --- UI Configuration ---
export const UI_CONFIG = {
    mainMenuModalId: 'mainMenuModal',
    partyConfigModalId: 'partyConfigModal',
    settingsModalId: 'settingsModal',
    logbookModalId: 'logbookModal',
    creditsModalId: 'creditsModal',
    inventoryPanelId: 'inventoryPanel',
    mapPanelId: 'mapPanel',
    gameContainerId: 'gameContainer',
    // Add other UI element IDs if frequently accessed
    touchControlsOverlayId: 'touchControlsOverlay',
    mobileActionsPanelId: 'mobileActionsPanel',
    sidePanelId: 'sidePanel',
    quickActionsBarId: 'quickActionsBar',
};

// --- Dungeon & Map Configuration ---
export const DUNGEON_CONFIG = {
    defaultMapWidth: 25, // Tiles
    defaultMapHeight: 25, // Tiles
    automapTileSize: 10, // Pixels for the small automap
    automapModalTileSize: 15, // Pixels for the large map modal
    maxRayDepth: 20, // How far rays are cast in 3D view (tiles)
    fov: Math.PI / 2.8, // Field of View (wider than before for a more expansive feel)
    rayCount: 240, // Number of rays for 3D rendering (higher for smoother walls)
    textureSize: 128, // Assumed pixel dimension for wall/sprite textures (for scaling)

    // Tile types (ensure these match usage in map generation and renderer)
    TILES: Object.freeze({
        EMPTY: -1, // Should not be rendered, or represents void
        FLOOR: 0,
        WALL: 1,
        STAIRS_DOWN: 2,
        DOOR_WOOD_CLOSED: 3,
        DOOR_WOOD_OPEN: 3.1, // Differentiate for rendering/logic
        CHEST_CLOSED: 4,
        CHEST_OPEN: 4.1,
        // Add more tile types: SECRET_DOOR, TRAP, WATER, LAVA, etc.
        // Example:
        // DOOR_STONE_CLOSED: 5,
        // DOOR_STONE_OPEN: 5.1,
        // ALTAR: 6,
    }),

    // Texture IDs (must match IDs in assets.svg)
    TEXTURE_IDS: Object.freeze({
        WALL_STONE_1: "wall-stone", // Default or variety 1
        WALL_STONE_BRICK: "wall-stone-brick", // New texture example
        WALL_DUNGEON_MOSS: "wall-dungeon-moss", // New texture example
        FLOOR_STONE_1: "floor-stone",
        FLOOR_DUNGEON_TILES: "floor-dungeon-tiles", // New texture example
        DOOR_WOOD_CLOSED: "door-wood-closed",
        DOOR_WOOD_OPEN: "door-wood-open",
        CHEST_CLOSED: "chest-closed",
        CHEST_OPEN: "chest-open",
        STAIRS_DOWN: "stairs-down",
        PARTY_MARKER: "party-marker",
    }),
};

// --- Party & Character Configuration ---
export const PARTY_CONFIG = {
    maxPartySize: 4,
    initialLevel: 1,
    inventorySlots: 16, // Increased inventory size
};

export const ARCHETYPES = Object.freeze([
    // Enhanced stats and more distinct roles
    {
        id: 'warrior', name: "Warrior",
        description: "A master of melee combat, excelling in both offense and defense.",
        baseStats: { hp: 120, mp: 20, attack: 12, defense: 10, magic: 3, resistance: 5, speed: 8 },
        spellcaster: false,
        portraitSVG: 'portrait-warrior',
        iconSVG: 'icon-sword', // For quick identification
        initialEquipment: { weapon: 'shortsword_basic', armor: 'leather_jerkin_basic' },
        levelUpBonuses: { hp: 15, mp: 2, attack: 2, defense: 1.5, magic: 0.2, resistance: 0.5, speed: 0.3 }
    },
    {
        id: 'mage', name: "Mage",
        description: "Commands potent arcane energies to decimate foes or protect allies.",
        baseStats: { hp: 70, mp: 80, attack: 5, defense: 4, magic: 15, resistance: 8, speed: 7 },
        spellcaster: true,
        portraitSVG: 'portrait-mage',
        iconSVG: 'icon-staff', // Placeholder, use appropriate icon
        initialEquipment: { weapon: 'staff_apprentice', armor: 'robes_novice' },
        initialSpells: ['magic_missile', 'minor_heal'],
        levelUpBonuses: { hp: 8, mp: 10, attack: 0.5, defense: 0.3, magic: 2.5, resistance: 1, speed: 0.2 }
    },
    {
        id: 'ranger', name: "Ranger",
        description: "A skilled archer and survivalist, at home in the wilderness and dungeons.",
        baseStats: { hp: 95, mp: 40, attack: 10, defense: 6, magic: 5, resistance: 6, speed: 10 },
        spellcaster: "hybrid", // Can learn some nature/utility spells
        portraitSVG: 'portrait-ranger',
        iconSVG: 'icon-bow', // Placeholder
        initialEquipment: { weapon: 'shortbow_hunting', armor: 'studded_leather_basic' },
        initialSkills: ['aimed_shot', 'track_enemies'],
        levelUpBonuses: { hp: 10, mp: 4, attack: 1.5, defense: 0.8, magic: 0.5, resistance: 0.7, speed: 0.5 }
    },
    {
        id: 'knight', name: "Knight",
        description: "A stalwart defender clad in heavy armor, protecting the weak.",
        baseStats: { hp: 150, mp: 15, attack: 10, defense: 15, magic: 2, resistance: 10, speed: 5 },
        spellcaster: false,
        portraitSVG: 'portrait-knight',
        iconSVG: 'icon-shield',
        initialEquipment: { weapon: 'longsword_basic', armor: 'chainmail_full', shield: 'shield_heater' },
        initialAbilities: ['shield_bash', 'taunt'],
        levelUpBonuses: { hp: 18, mp: 1, attack: 1.2, defense: 2, magic: 0.1, resistance: 1.2, speed: 0.1 }
    },
    {
        id: 'rogue', name: "Rogue",
        description: "A master of stealth and subterfuge, striking from the shadows.",
        baseStats: { hp: 85, mp: 30, attack: 11, defense: 5, magic: 4, resistance: 4, speed: 12 },
        spellcaster: false,
        portraitSVG: 'portrait-rogue',
        iconSVG: 'icon-dagger', // Placeholder
        initialEquipment: { weapon: 'dagger_sharp', armor: 'leather_shadow' },
        initialSkills: ['backstab', 'detect_traps', 'lockpick'],
        levelUpBonuses: { hp: 9, mp: 3, attack: 1.8, defense: 0.6, magic: 0.3, resistance: 0.4, speed: 0.8 }
    },
    {
        id: 'cleric', name: "Cleric",
        description: "A devout servant of the divine, healing wounds and smiting evil.",
        baseStats: { hp: 90, mp: 65, attack: 8, defense: 7, magic: 10, resistance: 9, speed: 6 },
        spellcaster: true,
        portraitSVG: 'portrait-cleric',
        iconSVG: 'icon-holy-symbol', // Placeholder
        initialEquipment: { weapon: 'mace_blessed', armor: 'scale_mail_holy', shield: 'shield_round_holy' },
        initialSpells: ['major_heal', 'bless', 'turn_undead'],
        levelUpBonuses: { hp: 10, mp: 7, attack: 0.8, defense: 1, magic: 1.5, resistance: 1.2, speed: 0.2 }
    }
    // Add more archetypes with distinct playstyles
]);


// --- Item Configuration ---
export const ITEM_CONFIG = {
    TYPES: Object.freeze({
        WEAPON: 'weapon',
        ARMOR: 'armor',
        SHIELD: 'shield', // Separate from armor for distinct slot
        POTION: 'potion',
        SCROLL: 'scroll',
        AMULET: 'amulet',
        RING: 'ring',
        QUEST: 'quest',
        GOLD: 'gold',
        MISC: 'misc',
    }),
    // Base item definitions (specific instances will be generated from these)
    // This allows for more structured item generation (e.g., a "Rusty Longsword" vs "Elven Longsword")
    // by combining base items with prefixes/suffixes or material types.
    ITEM_BASES: Object.freeze({
        // Weapons
        dagger_sharp: { name: "Sharp Dagger", type: 'weapon', slot: 'main_hand', attack: 5, value: 20, svgIcon: 'icon-dagger', description: "A well-sharpened dagger." },
        shortsword_basic: { name: "Basic Shortsword", type: 'weapon', slot: 'main_hand', attack: 8, value: 35, svgIcon: 'icon-sword', description: "A standard shortsword." },
        longsword_basic: { name: "Basic Longsword", type: 'weapon', slot: 'main_hand', attack: 12, value: 60, svgIcon: 'icon-longsword', description: "A common longsword." },
        staff_apprentice: { name: "Apprentice Staff", type: 'weapon', slot: 'two_hand', attack: 4, magic_bonus: 3, mp_bonus: 10, value: 50, svgIcon: 'icon-staff', description: "A simple staff for novice mages." },
        shortbow_hunting: { name: "Hunting Shortbow", type: 'weapon', slot: 'two_hand', attack: 7, ranged: true, value: 45, svgIcon: 'icon-bow', description: "A light bow for hunting." },
        mace_blessed: { name: "Blessed Mace", type: 'weapon', slot: 'main_hand', attack: 9, bonus_vs_undead: 5, value: 70, svgIcon: 'icon-mace', description: "A mace imbued with holy energy." },

        // Armor
        robes_novice: { name: "Novice Robes", type: 'armor', slot: 'body', defense: 2, resistance: 3, value: 25, svgIcon: 'icon-robes', description: "Simple robes for an aspiring magic user." },
        leather_jerkin_basic: { name: "Basic Leather Jerkin", type: 'armor', slot: 'body', defense: 5, value: 40, svgIcon: 'icon-leather-armor', description: "A sturdy piece of leather armor." },
        studded_leather_basic: { name: "Studded Leather", type: 'armor', slot: 'body', defense: 7, value: 65, svgIcon: 'icon-studded-armor', description: "Leather armor reinforced with metal studs." },
        chainmail_full: { name: "Full Chainmail", type: 'armor', slot: 'body', defense: 12, speed_penalty: -1, value: 150, svgIcon: 'icon-chainmail', description: "A full suit of interlocking metal rings." },
        scale_mail_holy: { name: "Holy Scale Mail", type: 'armor', slot: 'body', defense: 10, resistance: 5, value: 120, svgIcon: 'icon-scalemail', description: "Scale armor blessed for protection." },
        leather_shadow: { name: "Shadow Leather", type: 'armor', slot: 'body', defense: 6, stealth_bonus: 2, value: 80, svgIcon: 'icon-shadow-armor', description: "Darkened leather that blends with shadows." },

        // Shields
        shield_heater: { name: "Heater Shield", type: 'shield', slot: 'off_hand', defense: 4, value: 50, svgIcon: 'icon-shield-heater', description: "A standard knightly shield." },
        shield_round_holy: { name: "Holy Round Shield", type: 'shield', slot: 'off_hand', defense: 3, resistance: 2, value: 60, svgIcon: 'icon-shield-round', description: "A blessed round shield." },

        // Potions (effects defined in game logic or item module)
        potion_minor_healing: { name: "Minor Healing Potion", type: 'potion', effect: 'heal_hp', magnitude: 25, value: 15, svgIcon: 'icon-potion-health', description: "Restores a small amount of health." },
        potion_minor_mana: { name: "Minor Mana Potion", type: 'potion', effect: 'restore_mp', magnitude: 20, value: 20, svgIcon: 'icon-potion-mana', description: "Restores a small amount of mana." },
    }),
    // Define prefixes, suffixes, materials for item generation later
    ITEM_AFFIXES: {
        prefixes: [
            { id: "rusty", name_mod: "Rusty ", attack_mod: -0.2, defense_mod: -0.1, value_mod: 0.5 },
            { id: "elven", name_mod: "Elven ", attack_mod: 1.1, speed_mod: 0.1, value_mod: 1.5, svgIcon_suffix: "_elven" },
            // ... more
        ],
        suffixes: [
            { id: "of_fire", name_mod: " of Fire", damage_type: "fire", elemental_damage: 5, value_mod: 1.3 },
            // ... more
        ]
    }
};

// --- Enemy Configuration ---
export const ENEMY_CONFIG = {
    // Base enemy definitions
    ENEMY_BASES: Object.freeze({
        goblin_grunt: {
            name: "Goblin Grunt",
            description: "A small, aggressive humanoid that often attacks in groups.",
            baseStats: { hp: 30, attack: 8, defense: 4, speed: 9, xp: 15, gold: 5 },
            svgIcon: 'enemy-goblin', // Must match an ID in assets.svg
            lootTable: ['potion_minor_healing_common', 'dagger_rusty_common', 'gold_small_common'],
            abilities: ['quick_strike'],
            ai_type: 'melee_aggressive'
        },
        skeleton_warrior: {
            name: "Skeleton Warrior",
            description: "The reanimated bones of a fallen warrior, relentless and unfeeling.",
            baseStats: { hp: 50, attack: 10, defense: 8, speed: 6, xp: 25, gold: 10 },
            svgIcon: 'enemy-skeleton',
            immunities: ['poison', 'bleed'],
            vulnerabilities: ['blunt', 'holy'],
            lootTable: ['shortsword_basic_uncommon', 'shield_old_common', 'gold_medium_common'],
            abilities: ['bone_shield', 'relentless_assault'],
            ai_type: 'melee_defender'
        },
        cave_spider: {
            name: "Cave Spider",
            description: "A large, venomous arachnid lurking in dark places.",
            baseStats: { hp: 40, attack: 7, defense: 3, speed: 10, xp: 20, gold: 3 },
            svgIcon: 'enemy-spider', // Needs new SVG
            abilities: ['poison_bite', 'web_shot'],
            lootTable: ['spider_silk_common', 'potion_antidote_uncommon'],
            ai_type: 'melee_ambusher'
        }
        // Add more diverse enemies
    }),
    ENEMY_MODIFIERS: { // For generating champion/elite versions
        champion: { name_prefix: "Champion ", stat_multiplier: 1.5, xp_multiplier: 2, gold_multiplier: 2, abilities_bonus: 1 },
        alpha: { name_prefix: "Alpha ", stat_multiplier: 1.3, xp_multiplier: 1.5, gold_multiplier: 1.5, svgIcon_suffix: "_alpha"},
    }
};

// --- Sound Configuration (basic, can be expanded) ---
export const SOUND_CONFIG = {
    volumeSettingsKey: `${GAME_CONFIG.saveKeyPrefix}soundVolume`, // For individual sound type volumes
    defaultMasterVolume: 0.5,
    defaultMusicVolume: 0.7, // Relative to master
    defaultSfxVolume: 0.8,   // Relative to master

    // Define specific sound effect keys to be used with sfx.js
    SFX_KEYS: Object.freeze({
        UI_BUTTON_CLICK: 'ui_click',
        UI_MODAL_OPEN: 'ui_modal_open',
        UI_MODAL_CLOSE: 'ui_modal_close',
        PLAYER_MOVE_STONE: 'player_move_stone',
        PLAYER_ATTACK_SWORD: 'player_attack_sword',
        PLAYER_ATTACK_BOW: 'player_attack_bow',
        PLAYER_SPELL_CAST: 'player_spell_cast',
        ENEMY_HIT: 'enemy_hit',
        ENEMY_DEATH_GENERIC: 'enemy_death_generic',
        ITEM_PICKUP: 'item_pickup',
        DOOR_OPEN_WOOD: 'door_open_wood',
        DOOR_CLOSE_WOOD: 'door_close_wood',
        CHEST_OPEN: 'chest_open',
        LEVEL_UP: 'level_up',
        POTION_DRINK: 'potion_drink',
    }),
};