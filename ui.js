// ui.js - Handles UI interactions, DOM updates, and modal management.

import { GAME_CONFIG, UI_CONFIG, PARTY_CONFIG, ARCHETYPES, ITEM_CONFIG, DUNGEON_CONFIG, SOUND_CONFIG } from './config.js';
import AssetManager from './assets.js';
import { $, $$, capitalizeFirstLetter, formatNumberWithCommas } from './utils.js';
import MusicPlayer from './music.js';
// import SFXPlayer from './sfx.js';

const DOMElements = {
    mainMenuModal: null, partyConfigModal: null, settingsModal: null,
    logbookModal: null, creditsModal: null, inventoryPanel: null, mapPanel: null,
    archetypeGrid: null, selectedPartyGrid: null, logbookContent: null, creditsContent: null,
    inventoryCharName: null, inventoryCharStats: null, inventoryCharPortrait: null,
    inventoryGrid: null, equippedWeaponName: null, equippedArmorName: null,
    itemDetailContent: null, itemActionsContainer: null,
    mapDungeonLevelModal: null, automapCanvasModalContainer: null,
    gameContainer: null, partyDisplay: null, mapDungeonLevelIndicator: null,
    sidePanel: null, quickActionsBar: null, mobileActionsPanel: null,
    newGameBtn: null, resumeGameBtn: null, settingsBtn: null, creditsBtn: null,
    startGameButton: null, backToMainMenuFromPartyConfigBtn: null,
    closeSettingsBtn: null, resetPartyAndDataBtn: null, closeLogbookBtn: null, closeCreditsBtn: null,
    closeInventoryBtn: null, closeMapBtn: null,
    musicToggle: null, sfxToggle: null, volumeSlider: null,
    touchControlsOverlay: null,
};

let UIActions = {
    onNewGame: () => console.warn("UI: onNewGame callback not set"),
    onResumeGame: () => console.warn("UI: onResumeGame callback not set"),
    onOpenSettings: () => console.warn("UI: onOpenSettings callback not set"),
    onOpenCredits: () => console.warn("UI: onOpenCredits callback not set"),
    onStartAdventure: (partyCfg) => console.warn("UI: onStartAdventure callback not set", partyCfg),
    onCloseModal: (modalId) => console.warn("UI: onCloseModal callback not set", modalId),
    onResetGameData: () => console.warn("UI: onResetGameData callback not set"),
    onToggleMobilePanel: (panelId) => console.warn("UI: onToggleMobilePanel callback not set", panelId),
    onPlayerAction: (actionType, params) => console.warn("UI: onPlayerAction callback not set", actionType, params),
    onCharacterSelect: (charIndex) => console.warn("UI: onCharacterSelect callback not set", charIndex),
    onUseItem: (characterIndex, itemSlotIndex) => console.warn("UI: onUseItem callback not set", characterIndex, itemSlotIndex),
    onEquipItem: (characterIndex, itemSlotIndex) => console.warn("UI: onEquipItem callback not set", characterIndex, itemSlotIndex),
    onDropItem: (characterIndex, itemSlotIndex) => console.warn("UI: onDropItem callback not set", characterIndex, itemSlotIndex),
    getGameCharacterForInventory: () => { console.warn("UI: getGameCharacterForInventory callback not set"); return null; },
};

let currentOpenModal = null;
let selectedPartyArchetypes = [];
let activeCharacterForInventoryUI = null;
let selectedInventoryItemUI = null;

export function initializeUI(callbacks) {
    UIActions = { ...UIActions, ...callbacks };

    console.log("UI: Initializing...");

    const getElement = (id, parent = document, isOptional = false) => {
        const el = parent ? parent.querySelector(`#${id}`) : document.querySelector(`#${id}`);
        if (!el && !isOptional) {
            console.warn(`UI Init: Required DOM Element not found with ID: #${id} ${parent !== document && parent ? `within parent ${parent.id || parent.tagName}`: ''}`);
        }
        return el;
    };

    // Cache global modals and containers first
    DOMElements.mainMenuModal = getElement(UI_CONFIG.mainMenuModalId);
    DOMElements.partyConfigModal = getElement(UI_CONFIG.partyConfigModalId);
    DOMElements.settingsModal = getElement(UI_CONFIG.settingsModalId);
    DOMElements.logbookModal = getElement(UI_CONFIG.logbookModalId);
    DOMElements.creditsModal = getElement(UI_CONFIG.creditsModalId);
    DOMElements.inventoryPanel = getElement(UI_CONFIG.inventoryPanelId);
    DOMElements.mapPanel = getElement(UI_CONFIG.mapPanelId);
    DOMElements.gameContainer = getElement(UI_CONFIG.gameContainerId);
    DOMElements.sidePanel = getElement(UI_CONFIG.sidePanelId);
    DOMElements.mobileActionsPanel = getElement(UI_CONFIG.mobileActionsPanelId);
    DOMElements.touchControlsOverlay = getElement(UI_CONFIG.touchControlsOverlayId, document, true); // Optional

    // Cache elements within their respective parents
    if (DOMElements.mainMenuModal) {
        DOMElements.newGameBtn = getElement('newGameBtn', DOMElements.mainMenuModal);
        DOMElements.resumeGameBtn = getElement('resumeGameBtn', DOMElements.mainMenuModal);
        DOMElements.settingsBtn = getElement('settingsBtn', DOMElements.mainMenuModal);
        DOMElements.creditsBtn = getElement('creditsBtn', DOMElements.mainMenuModal);
    }
    if (DOMElements.partyConfigModal) {
        DOMElements.archetypeGrid = getElement('archetypeGrid', DOMElements.partyConfigModal);
        DOMElements.selectedPartyGrid = getElement('selectedPartyGrid', DOMElements.partyConfigModal);
        DOMElements.startGameButton = getElement('startGameButton', DOMElements.partyConfigModal);
        DOMElements.backToMainMenuFromPartyConfigBtn = getElement('backToMainMenuFromPartyConfigBtn', DOMElements.partyConfigModal);
    }
    if (DOMElements.settingsModal) {
        DOMElements.closeSettingsBtn = getElement('closeSettingsBtn', DOMElements.settingsModal);
        DOMElements.resetPartyAndDataBtn = getElement('resetPartyAndDataBtn', DOMElements.settingsModal);
        DOMElements.musicToggle = getElement('musicToggle', DOMElements.settingsModal);
        DOMElements.sfxToggle = getElement('sfxToggle', DOMElements.settingsModal);
        DOMElements.volumeSlider = getElement('volumeSlider', DOMElements.settingsModal);
    }
    if (DOMElements.logbookModal) {
        DOMElements.logbookContent = getElement('logbookContent', DOMElements.logbookModal);
        DOMElements.closeLogbookBtn = getElement('closeLogbookBtn', DOMElements.logbookModal);
    }
    if(DOMElements.creditsModal){
        DOMElements.creditsContent = getElement('creditsContent', DOMElements.creditsModal, true); // Optional
        DOMElements.closeCreditsBtn = getElement('closeCreditsBtn', DOMElements.creditsModal);
    }
    if (DOMElements.inventoryPanel) {
        DOMElements.inventoryCharName = getElement('inventoryCharacterName', DOMElements.inventoryPanel);
        DOMElements.inventoryCharStats = getElement('inventoryCharStats', DOMElements.inventoryPanel);
        DOMElements.inventoryCharPortrait = getElement('inventoryCharPortrait', DOMElements.inventoryPanel);
        DOMElements.inventoryGrid = getElement('inventoryGrid', DOMElements.inventoryPanel);
        DOMElements.equippedWeaponName = getElement('equippedWeaponName', DOMElements.inventoryPanel);
        DOMElements.equippedArmorName = getElement('equippedArmorName', DOMElements.inventoryPanel);
        DOMElements.itemDetailContent = getElement('itemDetailContent', DOMElements.inventoryPanel);
        DOMElements.itemActionsContainer = getElement('itemActions', DOMElements.inventoryPanel);
        DOMElements.closeInventoryBtn = getElement('closeInventory', DOMElements.inventoryPanel);
    }
    if (DOMElements.mapPanel) {
        DOMElements.mapDungeonLevelModal = getElement('mapDungeonLevel', DOMElements.mapPanel);
        DOMElements.automapCanvasModalContainer = getElement('mapCanvasContainerModal', DOMElements.mapPanel);
        DOMElements.closeMapBtn = getElement('closeMap', DOMElements.mapPanel);
    }
    if (DOMElements.gameContainer) {
        DOMElements.partyDisplay = getElement('partyDisplay', DOMElements.gameContainer);
    }
    DOMElements.mapDungeonLevelIndicator = getElement('mapDungeonLevelIndicator'); // Global ID
    if(DOMElements.sidePanel){
        DOMElements.quickActionsBar = getElement(UI_CONFIG.quickActionsBarId, DOMElements.sidePanel, true);
    }


    // --- Bind Initial Event Listeners ---
    DOMElements.newGameBtn?.addEventListener('click', () => { console.log("UI: New Game button DOM element found and listener invoked."); UIActions.onNewGame(); });
    DOMElements.resumeGameBtn?.addEventListener('click', () => { console.log("UI: Resume Game button DOM element found and listener invoked."); UIActions.onResumeGame(); });
    DOMElements.settingsBtn?.addEventListener('click', () => { console.log("UI: Settings button DOM element found and listener invoked."); loadSettingsFromStorage(); UIActions.onOpenSettings(); });
    DOMElements.creditsBtn?.addEventListener('click', () => { console.log("UI: Credits button DOM element found and listener invoked."); UIActions.onOpenCredits(); });

    DOMElements.startGameButton?.addEventListener('click', () => UIActions.onStartAdventure(selectedPartyArchetypes.map(a => a.id)));
    DOMElements.backToMainMenuFromPartyConfigBtn?.addEventListener('click', () => { hideModal(UI_CONFIG.partyConfigModalId); showModal(UI_CONFIG.mainMenuModalId); MusicPlayer.playTheme('MENU_THEME'); });
    DOMElements.archetypeGrid?.addEventListener('click', handleArchetypeSelection);
    DOMElements.selectedPartyGrid?.addEventListener('click', handleRemoveArchetypeFromPartyGrid);

    DOMElements.closeSettingsBtn?.addEventListener('click', () => hideModal(UI_CONFIG.settingsModalId));
    DOMElements.resetPartyAndDataBtn?.addEventListener('click', UIActions.onResetGameData);
    DOMElements.musicToggle?.addEventListener('change', handleSettingChange);
    DOMElements.sfxToggle?.addEventListener('change', handleSettingChange);
    DOMElements.volumeSlider?.addEventListener('input', handleSettingChange);

    DOMElements.closeLogbookBtn?.addEventListener('click', () => hideModal(UI_CONFIG.logbookModalId));
    DOMElements.closeCreditsBtn?.addEventListener('click', () => hideModal(UI_CONFIG.creditsModalId));
    DOMElements.closeInventoryBtn?.addEventListener('click', () => hideModal(UI_CONFIG.inventoryPanelId));
    DOMElements.closeMapBtn?.addEventListener('click', () => hideModal(UI_CONFIG.mapPanelId));

    DOMElements.inventoryGrid?.addEventListener('click', handleInventoryGridClick);
    DOMElements.inventoryGrid?.addEventListener('mouseover', handleInventoryGridMouseOver);
    DOMElements.inventoryGrid?.addEventListener('mouseout', handleInventoryGridMouseOut);
    DOMElements.itemActionsContainer?.addEventListener('click', handleItemActionClick);

    populateQuickActions(); populateMobileActions();
    populateArchetypeGrid(); updateSelectedPartyDisplay();
    loadSettingsFromStorage();
    window.addEventListener('keydown', handleGlobalKeydown);
    console.log("UI: Initialization complete.");
}

function handleGlobalKeydown(event) { /* (as before) */
    if (event.key === 'Escape' && currentOpenModal) {
        hideModal(currentOpenModal);
    }
}

export function showModal(modalId, focusElementSelector = null) {
    console.log(`UI: Attempting to show modal: ${modalId}`);
    const modalKey = modalId.replace(/-/g, '_'); // Convert kebab-case ID to camelCase key if needed
    const modal = DOMElements[modalKey] || $(`#${modalId}`);

    if (modal) {
        if (currentOpenModal && currentOpenModal !== modalId) {
            console.log(`UI: Hiding previous modal ${currentOpenModal} before showing ${modalId}`);
            hideModal(currentOpenModal, false);
        }
        modal.style.display = 'flex';
        currentOpenModal = modalId;
        console.log(`UI: Modal ${modalId} shown. CurrentOpenModal: ${currentOpenModal}`);
        // SFXPlayer.play(SOUND_CONFIG.SFX_KEYS.UI_MODAL_OPEN);
        if (modalId === UI_CONFIG.settingsModalId) loadSettingsFromStorage();
        if (modalId === UI_CONFIG.inventoryPanelId) {
            const charForInv = UIActions.getGameCharacterForInventory ? UIActions.getGameCharacterForInventory() : null;
            if (charForInv) {
                updateInventoryUI(charForInv);
            } else {
                addLogMessage("No active character to show inventory for.", "orange");
                hideModal(modalId); return;
            }
        }
        const focusTarget = focusElementSelector ? $(focusElementSelector, modal) : $('button:not([disabled]), input, [tabindex="0"]', modal);
        focusTarget?.focus();
    } else {
        console.warn(`UI: Modal with ID "${modalId}" (key: ${modalKey}) not found in DOMElements or DOM.`);
    }
}

export function hideModal(modalId, triggerCloseCallback = true) {
    const modalToHide = modalId || currentOpenModal;
    if (!modalToHide) return;
    console.log(`UI: Attempting to hide modal: ${modalToHide}`);

    const modalKey = modalToHide.replace(/-/g, '_');
    const modalElement = DOMElements[modalKey] || $(`#${modalToHide}`);

    if (modalElement) {
        modalElement.style.display = 'none';
        console.log(`UI: Modal ${modalToHide} hidden.`);
        // SFXPlayer.play(SOUND_CONFIG.SFX_KEYS.UI_MODAL_CLOSE);
        if (triggerCloseCallback && UIActions.onCloseModal) UIActions.onCloseModal(modalToHide);
        if (currentOpenModal === modalToHide) currentOpenModal = null;
        if (modalToHide === UI_CONFIG.inventoryPanelId) clearItemDetailsOnModalClose();
    } else {
         console.warn(`UI: Modal to hide with ID "${modalToHide}" (key: ${modalKey}) not found.`);
    }
}

// --- The rest of ui.js (populateArchetypeGrid, handleArchetypeSelection, etc.) remains largely the same as the last full version you provided ---
// Make sure that any addLogMessage calls are now UILog from game.js if you want them in the game's central log.
// For UI-specific feedback that shouldn't be in the game log, you can keep a local addLogMessage or use alerts/status bars.
// For this fix, I'll assume UILog is the one imported from game.js and used for persistent messages.
// If addLogMessage was meant for temporary UI feedback here, it'd be a separate function.
// For now, I'll keep ui.js's internal addLogMessage for UI feedback if needed and ensure game.js has its own.

// This ui.js internal addLogMessage is for feedback that might not need to go into the persistent game log.
// Game logic should use the addLogMessage exported from game.js for persistent logs.
function addLogMessage(message, color = 'var(--color-text-light)') {
    if (!DOMElements.logbookContent) {
        console.log(`UI LOG (no DOM element): ${message}`);
        return;
    }
    // ... (rest of the addLogMessage specific to UI, if different from game's persistent log)
    // For simplicity now, let's assume all important messages go through game.js's addLogMessage
    // which then calls the UI update. So this function might not be strictly needed here
    // if all user-facing messages are channeled through game.js's log.
    // For now, I will keep it for potential UI-only feedback.
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message; messageDiv.style.color = color;
    DOMElements.logbookContent.appendChild(messageDiv);
    if (DOMElements.logbookContent.children.length > GAME_CONFIG.maxLogMessages) {
        DOMElements.logbookContent.removeChild(DOMElements.logbookContent.firstChild);
    }
    DOMElements.logbookContent.scrollTop = DOMElements.logbookContent.scrollHeight;
}


// --- Party Configuration UI ---
function populateArchetypeGrid() { /* (as provided previously) */
    if (!DOMElements.archetypeGrid) return;
    DOMElements.archetypeGrid.innerHTML = ARCHETYPES.map(arch => `
        <div class="archetype-card" data-archetype-id="${arch.id}" role="button" tabindex="0" aria-label="Select ${arch.name}">
            <div class="portrait">${AssetManager.getUseElementString(arch.portraitSVG || 'portrait-placeholder', '', '60px', '60px')}</div>
            <h4>${arch.name}</h4>
            <p class="text-xs italic">${arch.description || 'No description.'}</p>
            <p class="text-xs">HP: ${arch.baseStats.hp}, MP: ${arch.baseStats.mp}</p>
            <p class="text-xs">Atk: ${arch.baseStats.attack}, Def: ${arch.baseStats.defense}</p>
        </div>
    `).join('');
}
function handleArchetypeSelection(event) { /* (as provided previously - uses internal addLogMessage) */
    const card = event.target.closest('.archetype-card');
    if (!card) return;
    const archetypeId = card.dataset.archetypeId;
    const archetype = ARCHETYPES.find(a => a.id === archetypeId);
    if (!archetype) return;
    if (selectedPartyArchetypes.length < PARTY_CONFIG.maxPartySize) {
        if (!selectedPartyArchetypes.some(a => a.id === archetypeId)) selectedPartyArchetypes.push(archetype);
        else addLogMessage(`${archetype.name} is already selected.`, 'var(--color-info)');
    } else addLogMessage(`Party is full (Max ${PARTY_CONFIG.maxPartySize} members).`, 'var(--color-info)');
    updateSelectedPartyDisplay();
}
function handleRemoveArchetypeFromPartyGrid(event) { /* (as provided previously) */
    const button = event.target.closest('.remove-btn');
    if(!button) return;
    const archetypeId = button.dataset.removeId;
    if(archetypeId) removeArchetypeFromParty(archetypeId);
}
function removeArchetypeFromParty(archetypeId) { /* (as provided previously) */
    selectedPartyArchetypes = selectedPartyArchetypes.filter(a => a.id !== archetypeId);
    updateSelectedPartyDisplay();
}
function updateSelectedPartyDisplay() { /* (as provided previously) */
    if (!DOMElements.selectedPartyGrid || !DOMElements.startGameButton) return;
    DOMElements.selectedPartyGrid.innerHTML = '';
    for (let i = 0; i < PARTY_CONFIG.maxPartySize; i++) {
        const slot = document.createElement('div'); slot.classList.add('selected-party-slot');
        if (selectedPartyArchetypes[i]) {
            const arch = selectedPartyArchetypes[i]; slot.classList.add('filled');
            slot.innerHTML = `<div class="portrait">${AssetManager.getUseElementString(arch.portraitSVG, '', '50px', '50px')}</div><div class="name">${arch.name}</div><button class="remove-btn" data-remove-id="${arch.id}" aria-label="Remove ${arch.name}">Remove</button>`;
        } else slot.textContent = `Slot ${i + 1}`;
        DOMElements.selectedPartyGrid.appendChild(slot);
    }
    const isPartyFull = selectedPartyArchetypes.length === PARTY_CONFIG.maxPartySize;
    DOMElements.startGameButton.disabled = !isPartyFull; DOMElements.startGameButton.setAttribute('aria-disabled', String(!isPartyFull));
}


// --- Settings UI ---
function loadSettingsFromStorage() { /* (as provided previously) */
    const savedSettingsString = localStorage.getItem(GAME_CONFIG.saveKeySettings);
    let settings = { musicOn: true, sfxOn: true, masterVolume: SOUND_CONFIG.defaultMasterVolume };
    if (savedSettingsString) { try { const saved = JSON.parse(savedSettingsString); settings = { ...settings, ...saved }; } catch (e) { console.error("Error parsing settings:", e); }}
    if (DOMElements.musicToggle) DOMElements.musicToggle.checked = settings.musicOn;
    if (DOMElements.sfxToggle) DOMElements.sfxToggle.checked = settings.sfxOn; 
    if (DOMElements.volumeSlider) DOMElements.volumeSlider.value = settings.masterVolume;
    MusicPlayer.toggleMusic(settings.musicOn);
    MusicPlayer.setVolume(settings.masterVolume * SOUND_CONFIG.defaultMusicVolume);
    // if (typeof SFXPlayer !== 'undefined' && SFXPlayer.isInitialized) {
    //     SFXPlayer.toggleSFX(settings.sfxOn);
    //     SFXPlayer.setMasterVolume(settings.masterVolume);
    // }
}
function handleSettingChange() { /* (as provided previously - uses internal addLogMessage) */
    const settings = {
        musicOn: DOMElements.musicToggle?.checked ?? true,
        sfxOn: DOMElements.sfxToggle?.checked ?? true,
        masterVolume: parseFloat(DOMElements.volumeSlider?.value ?? SOUND_CONFIG.defaultMasterVolume)
    };
    localStorage.setItem(GAME_CONFIG.saveKeySettings, JSON.stringify(settings));
    MusicPlayer.toggleMusic(settings.musicOn);
    MusicPlayer.setVolume(settings.masterVolume * SOUND_CONFIG.defaultMusicVolume);
    // if (typeof SFXPlayer !== 'undefined' && SFXPlayer.isInitialized) {
    //     SFXPlayer.toggleSFX(settings.sfxOn);
    //     SFXPlayer.setMasterVolume(settings.masterVolume);
    // }
    addLogMessage("Settings saved.", "var(--color-success)");
}


// --- Game UI Updates ---
export function updatePartyDisplay(party, activeCharacterIndex) { /* (as provided previously) */
    if (!DOMElements.partyDisplay || !party) return;
    DOMElements.partyDisplay.innerHTML = party.map((member, index) => {
        const isActive = index === activeCharacterIndex && member.isAlive;
        const isFallen = !member.isAlive;
        let weaponIconHtml = '';
        if (member.equipment.main_hand && (member.equipment.main_hand.svgIcon || member.archetype.iconSVG)) {
            weaponIconHtml = AssetManager.getUseElementString(member.equipment.main_hand.svgIcon || member.archetype.iconSVG, 'weapon-icon');
        } else if(member.archetype.iconSVG) {
             weaponIconHtml = AssetManager.getUseElementString(member.archetype.iconSVG, 'weapon-icon');
        }
        return `
            <div class="party-member ${isActive ? 'active' : ''} ${isFallen ? 'fallen' : ''}" 
                 data-member-index="${index}" role="button" tabindex="0" aria-label="${member.name}, Level ${member.level} ${capitalizeFirstLetter(member.archetype.id)}">
                <div class="party-member-portrait">
                    ${AssetManager.getUseElementString(member.archetype.portraitSVG || 'portrait-placeholder')}
                </div>
                <div class="party-member-info">
                    <div class="party-member-name">${member.name} ${weaponIconHtml}</div>
                    <div class="party-member-hp" aria-label="Health ${member.currentHp} of ${member.stats.maxHp}">HP: ${member.currentHp}/${member.stats.maxHp}</div>
                    <div class="stat-bar" title="Health: ${(member.currentHp / member.stats.maxHp * 100).toFixed(0)}%">
                        <div class="stat-bar-fill" style="width:${(member.currentHp / member.stats.maxHp) * 100}%;"></div>
                    </div>
                    ${member.stats.maxMp > 0 ? `
                    <div class="party-member-mp" aria-label="Mana ${member.currentMp} of ${member.stats.maxMp}">MP: ${member.currentMp}/${member.stats.maxMp}</div>
                    <div class="stat-bar" title="Mana: ${(member.stats.maxMp > 0 ? (member.currentMp / member.stats.maxMp) * 100 : 0).toFixed(0)}%">
                        <div class="stat-bar-fill stat-bar-fill-mp" style="width:${(member.stats.maxMp > 0 ? (member.currentMp / member.stats.maxMp) : 0) * 100}%;"></div>
                    </div>` : ''}
                    <div class="text-xs mt-1">Lvl ${member.level} ${capitalizeFirstLetter(member.archetype.id)}</div>
                </div>
                <div class="party-member-actions">
                    <button class="action-icon melee-action" data-action="melee" title="Melee Attack" ${isFallen || member.hasActedThisTurn ? 'disabled' : ''} aria-disabled="${isFallen || member.hasActedThisTurn}">⚔️</button>
                    ${member.canUseRanged && member.canUseRanged() ? `<button class="action-icon ranged-action" data-action="ranged" title="Ranged Attack" ${isFallen || member.hasActedThisTurn ? 'disabled' : ''} aria-disabled="${isFallen || member.hasActedThisTurn}">🏹</button>` : ''}
                    ${member.archetype.spellcaster || member.archetype.spellcaster === 'hybrid' ? `<button class="action-icon magic-icon" data-action="magic" title="Cast Spell" ${isFallen || member.hasActedThisTurn ? 'disabled' : ''} aria-disabled="${isFallen || member.hasActedThisTurn}">✨</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
    $$('.party-member', DOMElements.partyDisplay).forEach(card => {
        card.addEventListener('click', (e) => {
            const memberIndex = parseInt(card.dataset.memberIndex, 10);
            if (isNaN(memberIndex)) return;
            const targetButton = e.target.closest('.action-icon');
            if (targetButton && !targetButton.disabled) {
                const action = targetButton.dataset.action;
                if (action) UIActions.onPlayerAction(action, { characterIndex: memberIndex });
            } else if (!card.classList.contains('fallen')) { UIActions.onCharacterSelect(memberIndex); }
        });
    });
}
export function updateInventoryUI(character) { /* (as provided previously) */
    if (!DOMElements.inventoryPanel || !character) return;
    activeCharacterForInventoryUI = character;
    DOMElements.inventoryCharName.textContent = character.name;
    DOMElements.inventoryCharPortrait.innerHTML = AssetManager.getUseElementString(character.archetype.portraitSVG || 'portrait-placeholder', '', '100%', '100%');
    let statsHtml = `<p><span>Level:</span> <span>${character.level} ${capitalizeFirstLetter(character.archetype.id)}</span></p>`;
    statsHtml += `<p><span>HP:</span> <span style="color: var(--color-hp);">${character.currentHp} / ${character.stats.maxHp}</span></p>`;
    if(character.stats.maxMp > 0) statsHtml += `<p><span>MP:</span> <span style="color: var(--color-mp);">${character.currentMp} / ${character.stats.maxMp}</span></p>`;
    statsHtml += `<p><span>XP:</span> <span style="color: var(--color-xp);">${character.xp} / ${character.nextLevelXp}</span></p><hr>`;
    statsHtml += `<p><span>Attack:</span> <span>${character.stats.attack} (Base: ${character.baseStats.attack})</span></p>`;
    statsHtml += `<p><span>Defense:</span> <span>${character.stats.defense} (Base: ${character.baseStats.defense})</span></p>`;
    if(character.archetype.spellcaster || character.archetype.spellcaster === 'hybrid') {
        statsHtml += `<p><span>Magic:</span> <span>${character.stats.magic} (Base: ${character.baseStats.magic})</span></p>`;
        statsHtml += `<p><span>Resistance:</span> <span>${character.stats.resistance} (Base: ${character.baseStats.resistance})</span></p>`;
    }
    statsHtml += `<p><span>Speed:</span> <span>${character.stats.speed} (Base: ${character.baseStats.speed})</span></p><hr>`;
    const partyGoldHolder = UIActions.getPartyGoldHolder ? UIActions.getPartyGoldHolder() : character; // Assume for now char holds it
    statsHtml += `<p><span>Gold (Party):</span> <span style="color: var(--color-gold-highlight);">${formatNumberWithCommas(partyGoldHolder.gold || 0)}</span></p>`;
    DOMElements.inventoryCharStats.innerHTML = statsHtml;
    DOMElements.inventoryGrid.innerHTML = '';
    for (let i = 0; i < PARTY_CONFIG.inventorySlots; i++) {
        const item = character.inventory[i]; const slot = document.createElement('div'); slot.classList.add('inventory-slot'); slot.dataset.slotIndex = i;
        if (item) {
            slot.innerHTML = AssetManager.getUseElementString(item.svgIcon || ITEM_CONFIG.ITEM_BASES.potion_minor_healing.svgIcon, '', '32px', '32px');
            slot.dataset.itemId = item.id; const tooltip = document.createElement('span'); tooltip.classList.add('item-name-tooltip'); tooltip.textContent = item.name; slot.appendChild(tooltip);
            if (character.isEquipped(item)) slot.classList.add('equipped');
        } DOMElements.inventoryGrid.appendChild(slot);
    }
    DOMElements.equippedWeaponName.textContent = character.equipment.main_hand?.name || 'None';
    DOMElements.equippedArmorName.textContent = character.equipment.body?.name || 'None';
    clearItemDetailsDisplay();
}
function handleInventoryGridClick(event) { /* (as provided previously) */
    const slot = event.target.closest('.inventory-slot');
    if (!slot || !activeCharacterForInventoryUI) return;
    const slotIndex = parseInt(slot.dataset.slotIndex, 10); if (isNaN(slotIndex)) return;
    const item = activeCharacterForInventoryUI.inventory[slotIndex];
    if (item) { selectedInventoryItemUI = {item: item, slotIndex: slotIndex}; displayItemDetails(item, activeCharacterForInventoryUI.isEquipped(item)); }
    else clearItemDetailsDisplay();
}
function handleInventoryGridMouseOver(event) { /* (as provided previously) */
    const slot = event.target.closest('.inventory-slot');
    if (!slot || !activeCharacterForInventoryUI || selectedInventoryItemUI) return;
    const slotIndex = parseInt(slot.dataset.slotIndex, 10); if (isNaN(slotIndex)) return;
    const item = activeCharacterForInventoryUI.inventory[slotIndex];
    if(item) displayItemDetails(item, activeCharacterForInventoryUI.isEquipped(item), false);
}
function handleInventoryGridMouseOut(event) { /* (as provided previously) */
     const slot = event.target.closest('.inventory-slot');
    if(!slot || selectedInventoryItemUI) return;
    if (!event.relatedTarget || !slot.contains(event.relatedTarget)) clearItemDetailsDisplay(false);
}
function displayItemDetails(item, isEquipped, showActions = true) { /* (as provided previously) */
    if (!DOMElements.itemDetailContent || !item) { clearItemDetailsDisplay(); return; }
    let detailsHTML = `<h3 class="panel-title" style="color: var(--color-text-dark);">${item.name} (${capitalizeFirstLetter(item.type)})</h3>`;
    detailsHTML += `<p>${item.description || 'An ordinary item.'}</p><hr>`;
    if (item.attack) detailsHTML += `<p>Attack: <span style="color:var(--color-success);">${item.attack}</span> ${item.ranged ? '(Ranged)' : ''}</p>`;
    if (item.defense) detailsHTML += `<p>Defense: <span style="color:var(--color-info);">${item.defense}</span></p>`;
    if (item.magic_bonus) detailsHTML += `<p>Magic Power: <span style="color:var(--color-mp);">${item.magic_bonus}</span></p>`;
    if (item.hp_bonus) detailsHTML += `<p>Max HP Bonus: <span style="color:var(--color-hp);">${item.hp_bonus}</span></p>`;
    if (item.mp_bonus) detailsHTML += `<p>Max MP Bonus: <span style="color:var(--color-mp);">${item.mp_bonus}</span></p>`;
    if (item.resistance) detailsHTML += `<p>Resistance: <span style="color:var(--color-parchment-darker);">${item.resistance}</span></p>`;
    if (item.effect && item.type === ITEM_CONFIG.TYPES.POTION && item.magnitude) {
        detailsHTML += `<p>Effect: ${capitalizeFirstLetter(item.effect.replace('_', ' '))} (+${item.magnitude})</p>`;
    }
    detailsHTML += `<p>Value: <span style="color:var(--color-gold);">${formatNumberWithCommas(item.value || 0)}g</span></p>`;
    DOMElements.itemDetailContent.innerHTML = detailsHTML;
    if (showActions) updateItemActionButtons(item, isEquipped); else DOMElements.itemActionsContainer.innerHTML = '';
}
function updateItemActionButtons(item, isEquipped) { /* (as provided previously) */
    if (!DOMElements.itemActionsContainer || !item || !selectedInventoryItemUI || selectedInventoryItemUI.item.id !== item.id) return;
    let actionsHtml = ''; const itemInventorySlotIndex = selectedInventoryItemUI.slotIndex;
    if (item.type === ITEM_CONFIG.TYPES.WEAPON || item.type === ITEM_CONFIG.TYPES.ARMOR || item.type === ITEM_CONFIG.TYPES.SHIELD || item.type === ITEM_CONFIG.TYPES.AMULET) {
        actionsHtml += `<button class="button" data-action="equip" data-item-slot-index="${itemInventorySlotIndex}">${isEquipped ? 'Unequip' : 'Equip'}</button>`;
    } else if (item.type === ITEM_CONFIG.TYPES.POTION || item.type === ITEM_CONFIG.TYPES.SCROLL) {
        actionsHtml += `<button class="button" data-action="use" data-item-slot-index="${itemInventorySlotIndex}">Use</button>`;
    }
    actionsHtml += `<button class="button secondary" data-action="drop" data-item-slot-index="${itemInventorySlotIndex}">Drop</button>`;
    DOMElements.itemActionsContainer.innerHTML = actionsHtml;
}
function clearItemDetailsDisplay(clearSelectedItem = true) { /* (as provided previously) */
    if (DOMElements.itemDetailContent) DOMElements.itemDetailContent.innerHTML = '<p class="placeholder-text">Select an item to see details.</p>';
    if (DOMElements.itemActionsContainer) DOMElements.itemActionsContainer.innerHTML = '';
    if (clearSelectedItem) selectedInventoryItemUI = null;
}
export function clearItemDetailsOnModalClose() { clearItemDetailsDisplay(true); activeCharacterForInventoryUI = null; }

function handleItemActionClick(event) { /* (as provided previously) */
    const button = event.target.closest('button[data-action]');
    if (!button || !activeCharacterForInventoryUI) return;
    const action = button.dataset.action; const itemSlotIndex = parseInt(button.dataset.itemSlotIndex, 10);
    if (isNaN(itemSlotIndex) || !activeCharacterForInventoryUI.inventory[itemSlotIndex]) { console.error("Item action with invalid item/index", itemSlotIndex, activeCharacterForInventoryUI.inventory[itemSlotIndex]); return; }
    
    // Find the actual index of activeCharacterForInventoryUI in the game's party array
    const gameParty = UIActions.getGameParty ? UIActions.getGameParty() : [];
    const charActualIndex = gameParty.findIndex(char => char.id === activeCharacterForInventoryUI.id);

    if (charActualIndex === -1) { console.error("Could not get actual character index for item action."); return; }
    switch (action) {
        case 'equip': UIActions.onEquipItem(charActualIndex, itemSlotIndex); break;
        case 'use': UIActions.onUseItem(charActualIndex, itemSlotIndex); break;
        case 'drop': UIActions.onDropItem(charActualIndex, itemSlotIndex); break;
    }
    clearItemDetailsDisplay();
}

export function updateLogbook(level) { /* (as provided previously, but renamed in game.js to updateUILogbookMapLevel) */
    if (DOMElements.mapDungeonLevelIndicator) DOMElements.mapDungeonLevelIndicator.textContent = level;
    if (DOMElements.mapDungeonLevelModal) DOMElements.mapDungeonLevelModal.textContent = level;
}
// The primary addLogMessage is now exported from game.js, which calls this one.
// This function is kept here if UI needs to log something that game.js doesn't know about.
export function addLogMessageToUI(message, color = 'var(--color-text-light)') {
    if (!DOMElements.logbookContent) { console.log(`UI LOG (no DOM element for logbook): ${message}`); return; }
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message; messageDiv.style.color = color;
    DOMElements.logbookContent.appendChild(messageDiv);
    if (DOMElements.logbookContent.children.length > GAME_CONFIG.maxLogMessages) {
        DOMElements.logbookContent.removeChild(DOMElements.logbookContent.firstChild);
    }
    DOMElements.logbookContent.scrollTop = DOMElements.logbookContent.scrollHeight;
}

// --- Side Panel & Mobile Actions ---
function populateQuickActions() { /* (as provided previously, but corrected modal opening) */
    if (!DOMElements.quickActionsBar) return;
    const actions = [
        { id: 'actionCharacter', text: 'Character', icon: '👤', modalId: UI_CONFIG.inventoryPanelId },
        { id: 'actionMap', text: 'Map', icon: '🗺️', modalId: UI_CONFIG.mapPanelId },
        { id: 'actionLogbook', text: 'Logbook', icon: '📜', modalId: UI_CONFIG.logbookModalId },
        { id: 'actionMenu', text: 'Menu', icon: '⚙️', callback: UIActions.onOpenSettings }
    ];
    DOMElements.quickActionsBar.innerHTML = actions.map(action => `...`).join(''); // Same HTML as before
    actions.forEach(action => {
        const btn = $(`#${action.id}`, DOMElements.quickActionsBar);
        btn?.addEventListener('click', () => {
            if (action.callback) action.callback();
            else if (action.modalId) {
                console.log(`UI: Quick action to open modal: ${action.modalId}`);
                showModal(action.modalId); MusicPlayer.pause();
            }
        });
    });
}
function populateMobileActions() { /* (as provided previously) */
    if (!DOMElements.mobileActionsPanel) return;
    $('#mobileMenuToggle', DOMElements.mobileActionsPanel)?.addEventListener('click', () => UIActions.onToggleMobilePanel(UI_CONFIG.sidePanelId));
    $('#mobileCharacterToggle', DOMElements.mobileActionsPanel)?.addEventListener('click', () => { UIActions.onToggleMobilePanel(null); showModal(UI_CONFIG.inventoryPanelId); MusicPlayer.pause(); });
    $('#mobileMapToggle', DOMElements.mobileActionsPanel)?.addEventListener('click', () => { UIActions.onToggleMobilePanel(null); showModal(UI_CONFIG.mapPanelId); MusicPlayer.pause(); });
    $('#mobileLogToggle', DOMElements.mobileActionsPanel)?.addEventListener('click', () => { UIActions.onToggleMobilePanel(null); showModal(UI_CONFIG.logbookModalId); MusicPlayer.pause(); });
}
export function toggleMobilePanel(panelId, mainPanelSelector = `#${UI_CONFIG.sidePanelId}`) { /* (as before) */
    const panelToToggle = panelId ? $(`#${panelId}`) : $(mainPanelSelector);
    panelToToggle?.classList.toggle('mobile-visible');
}
export function toggleTouchControls(show) { /* (as before) */
    if (DOMElements.touchControlsOverlay) DOMElements.touchControlsOverlay.style.display = show ? 'grid' : 'none';
}
export function setResumeButtonState(enabled) { /* (as before) */
    if(DOMElements.resumeGameBtn) {
        DOMElements.resumeGameBtn.disabled = !enabled;
        DOMElements.resumeGameBtn.setAttribute('aria-disabled', String(!enabled));
    }
}