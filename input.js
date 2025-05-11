// input.js - Handles player input from keyboard and touch

import { UI_CONFIG } from './config.js';
import { playerAction, getActiveCharacter, setActiveCharacterIndex, getParty, isGameActive, getGameTurn } from './game.js'; // To call game actions
import { showModal, toggleTouchControls } from './ui.js'; // To interact with UI if needed

// --- Input State ---
let inputEnabled = false;
let keyStates = {}; // Tracks currently pressed keys for continuous actions (e.g., holding down move)

// --- Configuration (can be expanded to load from user settings) ---
const KEY_BINDINGS = {
    // Movement & Turning
    MOVE_FORWARD: ['ArrowUp', 'w', 'W'],
    MOVE_BACKWARD: ['ArrowDown', 's', 'S'],
    TURN_LEFT: ['ArrowLeft', 'a', 'A'],
    TURN_RIGHT: ['ArrowRight', 'd', 'D'],
    // Actions
    INTERACT_PRIMARY: ['Enter', 'e', 'E', ' '], // Spacebar for interaction
    // UI & Character
    TOGGLE_INVENTORY: ['i', 'I', 'b', 'B'], // B for Bag
    TOGGLE_MAP: ['m', 'M'],
    TOGGLE_LOGBOOK: ['l', 'L'],
    NEXT_CHARACTER: ['c', 'C', 'Tab'], // Tab to cycle characters
    PREVIOUS_CHARACTER: ['Shift+Tab'], // Example for combined key
    // Character selection by number (handled slightly differently)
    SELECT_CHAR_1: ['1'], SELECT_CHAR_2: ['2'],
    SELECT_CHAR_3: ['3'], SELECT_CHAR_4: ['4'],
    // Game Menu / Escape is handled globally by ui.js for modals
};

// --- Initialization ---
export function initializeInput() {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Touch Controls Setup (if the overlay exists)
    const touchOverlay = document.getElementById(UI_CONFIG.touchControlsOverlayId);
    if (touchOverlay) {
        // Use event delegation on the overlay
        touchOverlay.addEventListener('touchstart', handleTouchStart, { passive: false });
        // touchOverlay.addEventListener('touchend', handleTouchEnd); // If needed for release actions
        // By default, hide touch controls unless on a touch device (can be refined)
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        toggleTouchControls(isTouchDevice);
    }
    console.log("Input Handler Initialized.");
}

export function enableGameInput() {
    inputEnabled = true;
    console.log("Game input enabled.");
}

export function disableGameInput() {
    inputEnabled = false;
    keyStates = {}; // Clear any pressed keys when disabling
    console.log("Game input disabled.");
}

// --- Keyboard Input Handling ---
function handleKeyDown(event) {
    if (!inputEnabled || !isGameActive() || getGameTurn() !== 'PLAYER') {
        // Global keydowns (like Escape for modals) are handled in ui.js
        // Here we only care about game actions when it's player's turn and input is active.
        return;
    }

    const key = event.shiftKey && event.key !== 'Shift' ? `Shift+${event.key}` : event.key;
    keyStates[key] = true;

    // Prevent default browser actions for game keys (e.g., space scrolling, arrow keys)
    let actionTaken = false;

    if (KEY_BINDINGS.MOVE_FORWARD.includes(key)) {
        playerAction('move', { direction: 'forward' });
        actionTaken = true;
    } else if (KEY_BINDINGS.MOVE_BACKWARD.includes(key)) {
        playerAction('move', { direction: 'backward' });
        actionTaken = true;
    } else if (KEY_BINDINGS.TURN_LEFT.includes(key)) {
        playerAction('move', { direction: 'turn_left' });
        actionTaken = true;
    } else if (KEY_BINDINGS.TURN_RIGHT.includes(key)) {
        playerAction('move', { direction: 'turn_right' });
        actionTaken = true;
    } else if (KEY_BINDINGS.INTERACT_PRIMARY.includes(key)) {
        playerAction('interact', {});
        actionTaken = true;
    } else if (KEY_BINDINGS.TOGGLE_INVENTORY.includes(key)) {
        showModal(UI_CONFIG.inventoryPanelId); // UI module handles opening logic
        actionTaken = true;
    } else if (KEY_BINDINGS.TOGGLE_MAP.includes(key)) {
        showModal(UI_CONFIG.mapPanelId);
        actionTaken = true;
    } else if (KEY_BINDINGS.TOGGLE_LOGBOOK.includes(key)) {
        showModal(UI_CONFIG.logbookModalId);
        actionTaken = true;
    } else if (KEY_BINDINGS.NEXT_CHARACTER.includes(key) && !event.shiftKey) { // Tab without Shift
        cycleCharacter(1); // Next
        actionTaken = true;
    } else if (KEY_BINDINGS.PREVIOUS_CHARACTER.includes(key) || (KEY_BINDINGS.NEXT_CHARACTER.includes('Tab') && event.key === 'Tab' && event.shiftKey)) { // Shift+Tab
        cycleCharacter(-1); // Previous
        actionTaken = true;
    } else if (KEY_BINDINGS.SELECT_CHAR_1.includes(key)) {
        selectCharacterByIndex(0); actionTaken = true;
    } else if (KEY_BINDINGS.SELECT_CHAR_2.includes(key)) {
        selectCharacterByIndex(1); actionTaken = true;
    } else if (KEY_BINDINGS.SELECT_CHAR_3.includes(key)) {
        selectCharacterByIndex(2); actionTaken = true;
    } else if (KEY_BINDINGS.SELECT_CHAR_4.includes(key)) {
        selectCharacterByIndex(3); actionTaken = true;
    }

    if (actionTaken) {
        event.preventDefault(); // Prevent default browser behavior for game actions
    }
}

function handleKeyUp(event) {
    const key = event.shiftKey && event.key !== 'Shift' ? `Shift+${event.key}` : event.key;
    delete keyStates[key];
}

// --- Character Selection Logic ---
function cycleCharacter(direction) {
    const party = getParty();
    if (!party || party.length === 0) return;

    const currentActiveData = getActiveCharacter();
    let currentIndex = currentActiveData.index;
    let attempts = 0;

    do {
        currentIndex = (currentIndex + direction + party.length) % party.length;
        attempts++;
    } while ((!party[currentIndex].isAlive || party[currentIndex].hasActedThisTurn) && attempts < party.length * 2);
    // The hasActedThisTurn check allows cycling to characters who can still act.

    if (party[currentIndex].isAlive) { // Only switch if the found character is alive
        setActiveCharacterIndex(currentIndex);
    }
}

function selectCharacterByIndex(index) {
    const party = getParty();
    if (party && index >= 0 && index < party.length) {
        if (party[index].isAlive) { // Can select alive characters even if they've acted
            setActiveCharacterIndex(index);
        } else {
            // Optionally provide feedback: "Character is incapacitated"
        }
    }
}

// --- Touch Input Handling ---
function handleTouchStart(event) {
    if (!inputEnabled || !isGameActive() || getGameTurn() !== 'PLAYER') return;

    event.preventDefault(); // Prevent default touch actions like scrolling or zooming

    const target = event.target.closest('.touch-zone');
    if (!target) return;

    const action = target.dataset.action;
    if (!action) return;

    // SFXPlayer.play(SOUND_CONFIG.SFX_KEYS.UI_BUTTON_CLICK); // Haptic feedback too?

    switch (action) {
        case 'turn-left':
            playerAction('move', { direction: 'turn_left' });
            break;
        case 'move-forward':
            playerAction('move', { direction: 'forward' });
            break;
        case 'turn-right':
            playerAction('move', { direction: 'turn_right' });
            break;
        case 'action': // Main interaction button
            playerAction('interact', {});
            break;
        case 'prev-char':
            cycleCharacter(-1);
            break;
        case 'next-char':
            cycleCharacter(1);
            break;
        default:
            console.warn("Unknown touch action:", action);
    }
}

// Optional: handleTouchEnd if you need to detect release for certain actions
// function handleTouchEnd(event) {
//     if (!inputEnabled) return;
//     // Logic for touch release if needed
// }


// --- Gamepad Support (Placeholder - Requires more extensive implementation) ---
// function initializeGamepad() {
//     window.addEventListener("gamepadconnected", (event) => {
//         console.log("Gamepad connected:", event.gamepad);
//         // Start polling for gamepad input
//         pollGamepad();
//     });
//     window.addEventListener("gamepaddisconnected", (event) => {
//         console.log("Gamepad disconnected:", event.gamepad);
//         // Stop polling
//     });
// }

// function pollGamepad() {
//     if (!inputEnabled || !isGameActive() || getGameTurn() !== 'PLAYER') {
//         requestAnimationFrame(pollGamepad);
//         return;
//     }
//     const gamepads = navigator.getGamepads();
//     if (!gamepads[0]) { // Assuming first connected gamepad
//         requestAnimationFrame(pollGamepad);
//         return;
//     }
//     const gp = gamepads[0];

//     // Example: D-pad or analog stick for movement
//     // const xAxis = gp.axes[0];
//     // const yAxis = gp.axes[1];
//     // if (yAxis < -0.5) playerAction('move', { direction: 'forward' });
//     // else if (yAxis > 0.5) playerAction('move', { direction: 'backward' });
//     // if (xAxis < -0.5) playerAction('move', { direction: 'turn_left' });
//     // else if (xAxis > 0.5) playerAction('move', { direction: 'turn_right' });

//     // Example: Button press for interaction
//     // if (gp.buttons[0].pressed) playerAction('interact', {}); // 'A' button on Xbox controller

//     requestAnimationFrame(pollGamepad);
// }

// Call initializeGamepad() in initializeInput if you want to add gamepad support.