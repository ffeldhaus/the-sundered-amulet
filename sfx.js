// sfx.js - Sound Effects Manager

import { SOUND_CONFIG, GAME_CONFIG } from './config.js';
import { getRandomElement } from './utils.js';

// --- SFX Player State & Configuration ---
const SFXPlayer = {
    players: {}, // Stores Tone.Player instances, keyed by sfxKey from SOUND_CONFIG.SFX_KEYS
    isSFXOn: true,
    masterVolumeNode: null, // Main volume control for all SFX
    sfxDirectory: './assets/sfx/', // Base directory for sound effect files
    sfxFileFormat: '.wav', // Or .mp3, .ogg etc.

    isInitialized: false,
    initPromise: null,

    /**
     * Initializes the SFXPlayer.
     * Sets up the master volume node.
     * Preloading can be done here or on demand.
     */
    init() {
        if (this.initPromise) {
            return this.initPromise;
        }
        this.initPromise = new Promise(async (resolve, reject) => {
            if (typeof Tone === 'undefined') {
                console.error("SFXPlayer: Tone.js is not loaded. SFX will not work.");
                this.isInitialized = false;
                reject(new Error("Tone.js not found for SFXPlayer."));
                return;
            }

            try {
                // Ensure Tone.js audio context is started (if not already by MusicPlayer)
                if (Tone.context.state !== 'running') {
                    await Tone.start();
                }

                this.masterVolumeNode = new Tone.Volume(Tone.gainToDb(SOUND_CONFIG.defaultMasterVolume * SOUND_CONFIG.defaultSfxVolume)).toDestination();
                
                // Load settings (this should be called from main.js after SFXPlayer.init)
                // For now, we assume defaults or that main.js will call setMasterVolume / toggleSFX soon.
                this.loadSFXSettings();


                this.isInitialized = true;
                console.log("SFXPlayer Initialized.");
                resolve();

            } catch (error) {
                console.error("SFXPlayer: Error during initialization -", error);
                this.isInitialized = false;
                reject(error);
            }
        });
        return this.initPromise;
    },

    /**
     * Loads a single sound effect or an array of sound effects for a given key.
     * If an array of filenames is provided, one will be chosen randomly when played.
     * @param {string} sfxKey - The key from SOUND_CONFIG.SFX_KEYS.
     * @param {string | string[]} filenames - A single filename or an array of filenames (without extension).
     * @returns {Promise<void>}
     */
    async load(sfxKey, filenames) {
        if (!this.isInitialized) {
            console.warn(`SFXPlayer: Cannot load "${sfxKey}" - SFXPlayer not initialized.`);
            await this.init(); // Attempt to initialize if not already
            if (!this.isInitialized) return; // Still failed
        }
        if (this.players[sfxKey]) {
            // console.log(`SFXPlayer: Sound for "${sfxKey}" already loaded or loading.`);
            return; // Already loaded or loading
        }

        const urls = (Array.isArray(filenames) ? filenames : [filenames])
            .map(name => `${this.sfxDirectory}${name}${this.sfxFileFormat}`);

        try {
            if (urls.length === 1) {
                const player = new Tone.Player(urls[0]).connect(this.masterVolumeNode);
                await Tone.loaded(); // Wait for this specific player
                this.players[sfxKey] = { type: 'single', player: player, variations: 1 };
            } else {
                // For multiple files per key, create an array of players
                const variationPlayers = [];
                for (const url of urls) {
                    const player = new Tone.Player(url).connect(this.masterVolumeNode);
                    variationPlayers.push(player);
                }
                await Tone.loaded(); // Wait for all players in this group
                this.players[sfxKey] = { type: 'multiple', players: variationPlayers, variations: variationPlayers.length };
            }
            // console.log(`SFXPlayer: Loaded sound for "${sfxKey}".`);
        } catch (error) {
            console.error(`SFXPlayer: Error loading sound for "${sfxKey}" with files [${filenames.join(', ')}]:`, error);
            // Optionally remove the key if loading failed partially for 'multiple'
            delete this.players[sfxKey];
        }
    },

    /**
     * Preloads a map of SFX keys to their filenames.
     * @param {Object<string, string|string[]>} sfxMap - e.g., { 'UI_CLICK': 'click1', 'SWORD_HIT': ['sword_hit1', 'sword_hit2'] }
     * @returns {Promise<void>}
     */
    async preloadAll(sfxMap) {
        if (!this.isInitialized) await this.init();
        
        const loadPromises = [];
        for (const key in sfxMap) {
            if (SOUND_CONFIG.SFX_KEYS[key]) { // Ensure the key is valid
                loadPromises.push(this.load(SOUND_CONFIG.SFX_KEYS[key], sfxMap[key]));
            } else {
                console.warn(`SFXPlayer: Invalid SFX key during preload: "${key}"`);
            }
        }
        await Promise.all(loadPromises);
        console.log("SFXPlayer: All specified sound effects preloaded.");
    },


    /**
     * Plays a sound effect.
     * @param {string} sfxKey - The key from SOUND_CONFIG.SFX_KEYS.
     * @param {object} [options] - Playback options.
     * @param {number} [options.volume] - Relative volume adjustment (0 to 1, applied multiplicatively with master). Tone.js uses dB.
     * @param {number} [options.delay] - Delay before playing, in seconds.
     * @param {number} [options.playbackRate] - Speed of playback (1 is normal).
     */
    play(sfxKey, options = {}) {
        if (!this.isInitialized || !this.isSFXOn) {
            return;
        }

        const sfxData = this.players[sfxKey];
        if (!sfxData) {
            console.warn(`SFXPlayer: Sound for key "${sfxKey}" not found or not loaded. Attempting to load on demand.`);
            // On-demand loading (simple case: assuming sfxKey matches a filename)
            // This part needs a mapping from sfxKey to actual filenames if not preloaded.
            // For now, let's assume it would have been preloaded via a map.
            // If you want true on-demand, you'd need that sfxMap available here.
            // this.load(sfxKey, sfxKey.toLowerCase()).then(() => {
            //     if (this.players[sfxKey]) this._executePlay(this.players[sfxKey], options);
            // });
            return;
        }
        this._executePlay(sfxData, options);
    },

    _executePlay(sfxData, options) {
        let playerToUse;
        if (sfxData.type === 'single') {
            playerToUse = sfxData.player;
        } else if (sfxData.type === 'multiple' && sfxData.players.length > 0) {
            playerToUse = getRandomElement(sfxData.players);
        }

        if (playerToUse && playerToUse.loaded) {
            // Tone.Player doesn't have a per-play volume method easily like Web Audio API's GainNode.
            // For per-play volume changes without creating new players or complex routing,
            // you might adjust the player's main volume, play, then revert.
            // Or, for more complex needs, each player could have its own gain node.
            // For now, we'll rely on the master volume and potential global category volumes.

            if (options.playbackRate) {
                playerToUse.playbackRate = clamp(options.playbackRate, 0.1, 4);
            } else {
                playerToUse.playbackRate = 1.0; // Reset to normal
            }

            const delayTime = options.delay ? `+${options.delay}` : undefined;
            playerToUse.start(delayTime);
        } else if (playerToUse && !playerToUse.loaded) {
            console.warn(`SFXPlayer: Player for a sound was not loaded. State: ${playerToUse.state}`);
            // It might be better to wait for load then play.
            playerToUse.onload = () => playerToUse.start();
        }
    },

    /**
     * Stops a specific sound or all sounds.
     * @param {string} [sfxKey] - If provided, stops this specific sound. Otherwise, stops all.
     */
    stop(sfxKey) {
        if (!this.isInitialized) return;

        if (sfxKey && this.players[sfxKey]) {
            const sfxData = this.players[sfxKey];
            if (sfxData.type === 'single') {
                sfxData.player.stop();
            } else if (sfxData.type === 'multiple') {
                sfxData.players.forEach(p => p.stop());
            }
        } else if (!sfxKey) { // Stop all
            for (const key in this.players) {
                const sfxData = this.players[key];
                if (sfxData.type === 'single') {
                    sfxData.player.stop();
                } else if (sfxData.type === 'multiple') {
                    sfxData.players.forEach(p => p.stop());
                }
            }
        }
    },

    /**
     * Sets the master volume for all sound effects.
     * @param {number} volumeLevel - Volume from 0.0 to 1.0.
     */
    setMasterVolume(volumeLevel) {
        if (this.masterVolumeNode) {
            const actualVolume = clamp(volumeLevel, 0, 1) * SOUND_CONFIG.defaultSfxVolume; // SFX volume relative to master
            this.masterVolumeNode.volume.value = Tone.gainToDb(actualVolume);
        }
        this.saveSFXSettings();
    },

    /**
     * Toggles all sound effects on or off.
     * @param {boolean} isOn
     */
    toggleSFX(isOn) {
        this.isSFXOn = isOn;
        if (!this.isSFXOn) {
            this.stop(); // Stop all currently playing SFX if turning off
        }
        this.saveSFXSettings();
    },
    
    /**
     * Saves current SFX settings (on/off, volume) to localStorage.
     */
    saveSFXSettings() {
        const settings = {
            sfxOn: this.isSFXOn,
            // Master volume is global, SFX sub-volume might be more complex
            // For simplicity, we might just save the sfxOn state here.
            // The master volume is handled by the global settings save.
        };
        // localStorage.setItem(SOUND_CONFIG.sfxSettingsKey, JSON.stringify(settings)); // Need a new key in config
    },

    /**
     * Loads SFX settings from localStorage.
     */
    loadSFXSettings() {
        // const savedSettingsString = localStorage.getItem(SOUND_CONFIG.sfxSettingsKey);
        // if (savedSettingsString) {
        //     try {
        //         const saved = JSON.parse(savedSettingsString);
        //         this.isSFXOn = saved.sfxOn !== undefined ? saved.sfxOn : true;
        //     } catch (e) { console.error("SFXPlayer: Error parsing saved SFX settings", e); }
        // }
        // This is simplified. Usually, main settings load handles UI, then applies to audio modules.
        // For now, ensure UI settings drive this via toggleSFX and setMasterVolume from ui.js/main.js
    }
};

export default SFXPlayer;

// Example of how you might map SFX_KEYS to actual files for preloading:
/*
export const SFX_FILE_MAP = {
    [SOUND_CONFIG.SFX_KEYS.UI_BUTTON_CLICK]: 'ui_click_soft', // filename without extension
    [SOUND_CONFIG.SFX_KEYS.PLAYER_MOVE_STONE]: ['footstep_stone1', 'footstep_stone2', 'footstep_stone3'],
    [SOUND_CONFIG.SFX_KEYS.PLAYER_ATTACK_SWORD]: ['sword_swing1', 'sword_whoosh2'],
    [SOUND_CONFIG.SFX_KEYS.ENEMY_HIT]: ['flesh_hit1', 'flesh_hit2'],
    // ... and so on for all keys defined in SOUND_CONFIG.SFX_KEYS
};

// In main.js, after SFXPlayer.init():
// import SFXPlayer, { SFX_FILE_MAP } from './sfx.js';
// ...
// await SFXPlayer.preloadAll(SFX_FILE_MAP);
*/