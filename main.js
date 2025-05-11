// main.js
// Main entry point for The Sundered Amulet - Enhanced Edition

import { GAME_CONFIG, DUNGEON_CONFIG, UI_CONFIG } from './config.js';
import AssetManager from './assets.js';
import MusicPlayer from './music.js';
// import SFXPlayer from './sfx.js'; // Uncomment when sfx.js is created
import {
    initializeUI, showModal, hideModal, updatePartyDisplay, addLogMessageToUI as UILogFromUI,
    clearItemDetailsOnModalClose, toggleMobilePanel, setResumeButtonState, updateInventoryUI, updateLogbook as updateUILogbookMapLevel
} from './ui.js';
import { initializeRenderer, drawGame, resizeGameElements } from './renderer.js';
import { initializeInput, enableGameInput, disableGameInput } from './input.js';
import {
    initializeGameState as initCoreGameState, // Renamed to avoid conflict
    loadGame,
    saveGame,
    startNewGame,
    isGameActive,
    getCurrentDungeonLevel,
    getParty,
    getActiveCharacter,
    getExploredMap,
    getPlayerPosition,
    getEnemies,
    getItemsOnMap,
    getGameTurn,
    setGameTurn,
    // endPlayerTurn, // game.js handles this internally after an action
    restartFullGame,
    playerAction, // Import directly
    setActiveCharacterIndex, // Import directly
    useInventoryItem, // Import directly
    equipInventoryItem, // Import directly
    dropInventoryItem // Import directly
} from './game.js';

// --- Global State (minimal, managed by modules) ---
let animationFrameId = null;

// --- Core Game Loop ---
function gameLoop() {
    if (!isGameActive()) {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        return;
    }

    const playerPos = getPlayerPosition();
    const party = getParty();
    const activeChar = getActiveCharacter();
    const enemies = getEnemies();
    const items = getItemsOnMap();
    const explored = getExploredMap();
    const level = getCurrentDungeonLevel();
    const gameMap = getGameMap(); // From game.js

    if (playerPos && party && activeChar && enemies && items && explored && gameMap) {
        drawGame(
            playerPos,
            party,
            activeChar.index,
            enemies,
            items,
            explored,
            level,
            gameMap
        );
    } else {
        console.warn("Game loop called with incomplete game state. Skipping frame.");
    }


    animationFrameId = requestAnimationFrame(gameLoop);
}

function stopGameLoop() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    console.log("Game loop stopped.");
}

export function requestStartGameLoop() {
    if (!animationFrameId && isGameActive()) {
        console.log("Requesting game loop start...");
        gameLoop();
    }
}
export function requestStopGameLoop() { // Export for game.js to call on game over
    stopGameLoop();
}


// --- Application Initialization ---
async function initializeApp() {
    console.log("Initializing The Sundered Amulet - Enhanced Edition...");

    try {
        await AssetManager.init(GAME_CONFIG.svgAssetPath);
        const svgContainer = document.getElementById('svgAssetContainer');
        if(svgContainer) svgContainer.innerHTML = AssetManager.getSVGDefsString();
        console.log("Asset Manager Initialized.");

        // Must initialize game state before UI so UI can query game state if needed (e.g. resume button)
        initCoreGameState(); // Initialize core game systems in game.js
        console.log("Core Game State Initialized.");


        initializeUI({
            onNewGame: handleNewGameRequest,
            onResumeGame: handleResumeGameRequest,
            onOpenSettings: handleOpenSettings,
            onOpenCredits: handleOpenCredits,
            onStartAdventure: handleStartAdventure,
            onCloseModal: handleCloseModal,
            onResetGameData: handleResetGameData,
            onToggleMobilePanel: (panelId) => toggleMobilePanel(panelId, `#${UI_CONFIG.sidePanelId}`),
            // Game action callbacks for ui.js to trigger game.js functions
            onPlayerAction: playerAction, // Pass game.js function directly
            onCharacterSelect: setActiveCharacterIndex, // Pass game.js function directly
            onUseItem: useInventoryItem,         // Pass game.js function directly
            onEquipItem: equipInventoryItem,       // Pass game.js function directly
            onDropItem: dropInventoryItem,        // Pass game.js function directly
            getGameCharacterForInventory: () => getActiveCharacter().character // Provide current char for inventory UI
        });
        console.log("UI Initialized.");

        MusicPlayer.init();
        // await SFXPlayer.init(); // Assuming SFXPlayer.init also returns a promise
        // await SFXPlayer.preloadAll(SFX_FILE_MAP); // Make sure SFX_FILE_MAP is defined and imported
        console.log("Audio Systems Initialized.");

        initializeRenderer(
            document.getElementById('gameCanvas'),
            document.getElementById('automapCanvas'),
            document.getElementById('automapCanvasModal')
        );
        console.log("Renderer Initialized.");

        initializeInput(); // Input handler last, as it might try to call game actions
        console.log("Input Handler Initialized.");

        // Check for saved game to enable/disable resume button
        const canResume = !!localStorage.getItem(GAME_CONFIG.saveKeyGameState); // Check if key exists
        setResumeButtonState(canResume);


        showModal(UI_CONFIG.mainMenuModalId);
        MusicPlayer.playTheme('MENU_THEME');

        window.addEventListener('resize', handleResize);
        handleResize();

        // Auto-save interval
        if (GAME_CONFIG.autoSaveInterval > 0) {
            setInterval(() => {
                if (isGameActive() && getGameTurn() === 'PLAYER') { // Only save if game is active and player's turn
                    saveGame();
                }
            }, GAME_CONFIG.autoSaveInterval);
        }

        console.log("Application Initialized Successfully.");

    } catch (error) {
        console.error("CRITICAL ERROR during application initialization:", error);
        document.body.innerHTML = `...`; // Error message as before
        return;
    }
}

// --- Event Handlers & Flow Control ---

function handleNewGameRequest() {
    stopGameLoop(); // Ensure no old game loop is running
    disableGameInput();
    hideModal(UI_CONFIG.mainMenuModalId);
    showModal(UI_CONFIG.partyConfigModalId);
    // MusicPlayer theme handled by modal display logic or remains MENU_THEME
}

function handleResumeGameRequest() {
    stopGameLoop(); // Stop any residual loop
    if (loadGame()) { // loadGame now handles UI updates and starting the player's turn.
        hideModal(UI_CONFIG.mainMenuModalId);
        document.getElementById(UI_CONFIG.gameContainerId).style.display = 'flex';
        enableGameInput();
        requestStartGameLoop(); // Start the game loop after successful load
        const themeToPlay = MusicPlayer.themes.DUNGEON_THEME ? 'DUNGEON_THEME' : 'MENU_THEME';
        MusicPlayer.playTheme(themeToPlay);
        // UILog("Game Loaded!", "var(--color-success)"); // game.js loadGame logs this
    } else {
        // UILog("Failed to load saved game. Starting new.", "var(--color-danger)"); // game.js logs this
        // If loadGame returns false, it means an error occurred or no save found.
        // UI should ideally reflect this (e.g. resume button stays disabled).
        // Forcing new game might be too aggressive here, let user decide.
        setResumeButtonState(false); // Ensure resume is disabled if load failed
        // Re-show main menu or offer new game if it was due to corruption.
        showModal(UI_CONFIG.mainMenuModalId);
    }
}

function handleStartAdventure(selectedArchetypeIds) {
    stopGameLoop();
    if (startNewGame(selectedArchetypeIds)) { // startNewGame now handles UI updates & player turn start
        hideModal(UI_CONFIG.partyConfigModalId);
        document.getElementById(UI_CONFIG.gameContainerId).style.display = 'flex';
        enableGameInput();
        requestStartGameLoop(); // Start the game loop
        const dungeonThemes = ['DUNGEON_THEME', 'DUNGEON_THEME_ALT'].filter(t => MusicPlayer.themes[t]);
        const themeToPlay = dungeonThemes.length > 0 ? dungeonThemes[Math.floor(Math.random() * dungeonThemes.length)] : 'MENU_THEME';
        MusicPlayer.playTheme(themeToPlay);
    } else {
        // UILog("Could not start. Party invalid.", "var(--color-danger)"); // game.js startNewGame should log this
    }
}

function handleOpenSettings() {
    if (isGameActive()) MusicPlayer.pause();
    // Modals might be stacked, ensure previous is hidden if opening from another modal
    const currentVisibleModal = document.querySelector('.modal-overlay[style*="display: flex"]');
    if (currentVisibleModal && currentVisibleModal.id !== UI_CONFIG.settingsModalId) {
        hideModal(currentVisibleModal.id, false); // Don't trigger its close callback
    }
    showModal(UI_CONFIG.settingsModalId);
    // ui.js's showModal logic should call loadSettingsFromStorage
}

function handleOpenCredits() {
    if (isGameActive()) MusicPlayer.pause();
    const currentVisibleModal = document.querySelector('.modal-overlay[style*="display: flex"]');
    if (currentVisibleModal && currentVisibleModal.id !== UI_CONFIG.creditsModalId) {
        hideModal(currentVisibleModal.id, false);
    }
    showModal(UI_CONFIG.creditsModalId);
}

function handleCloseModal(modalId) {
    const gameWasActive = isGameActive();

    if (modalId === UI_CONFIG.settingsModalId || modalId === UI_CONFIG.creditsModalId) {
        if (gameWasActive && MusicPlayer.isMusicOn) {
            MusicPlayer.resume();
        } else if (!gameWasActive && document.getElementById(UI_CONFIG.mainMenuModalId)?.style.display !== 'flex') {
            // If no game was active and main menu isn't shown, re-show main menu
            showModal(UI_CONFIG.mainMenuModalId);
            MusicPlayer.playTheme('MENU_THEME');
        }
    } else if (modalId === UI_CONFIG.inventoryPanelId || modalId === UI_CONFIG.mapPanelId || modalId === UI_CONFIG.logbookModalId) {
         if (gameWasActive && MusicPlayer.isMusicOn && MusicPlayer.currentTheme) {
            MusicPlayer.resume();
        }
        if(modalId === UI_CONFIG.inventoryPanelId) clearItemDetailsOnModalClose(); // From ui.js
    }
    // Ensure input is re-enabled if game is active and no other modal is taking precedence
    if (gameWasActive && !document.querySelector('.modal-overlay[style*="display: flex"]')) {
        enableGameInput();
    } else if (gameWasActive) { // Another modal might have opened immediately
        disableGameInput();
    }
}

function handleResetGameData() {
    if (confirm("Are you sure you want to reset ALL game data? This includes saved games, party configurations, and settings.")) {
        stopGameLoop();
        disableGameInput();
        restartFullGame(); // game.js function to clear all its state
        // localStorage handled by game.js or here

        // Reset UI to initial state
        hideModal(null, true); // Close all modals forcefully
        document.getElementById(UI_CONFIG.gameContainerId).style.display = 'none';

        setResumeButtonState(false);
        showModal(UI_CONFIG.mainMenuModalId);
        MusicPlayer.playTheme('MENU_THEME');
        // ui.js needs to reset its internal party config state if any
        // selectedPartyArchetypes = []; updateSelectedPartyDisplay(); (if state lived here)
        UILog("All game data has been reset.", "var(--color-info)");
        console.log("All game data reset.");
    }
}


function handleResize() {
    resizeGameElements();
    // If game is active but loop is stopped (e.g. paused for a non-blocking modal), redraw
    if (isGameActive() && getGameTurn() !== null && !animationFrameId) {
        const playerPos = getPlayerPosition();
        const party = getParty();
        const activeChar = getActiveCharacter();
        const enemies = getEnemies();
        const items = getItemsOnMap();
        const explored = getExploredMap();
        const level = getCurrentDungeonLevel();
        const gameMap = getGameMap();
        if (playerPos && party && activeChar && enemies && items && explored && gameMap) {
            drawGame(playerPos, party, activeChar.index, enemies, items, explored, level, gameMap);
        }
    }
}

// --- Start the Application ---
window.onload = initializeApp;