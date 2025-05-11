// music.js

const MusicPlayer = {
    melodySynth: null,
    harmonySynth: null,
    melodySequencer: null,
    harmonySequencer: null,
    currentTheme: null,
    volumeNode: null,
    isMusicOn: true, // Default, will be updated by loadSettings
    themes: {
        MENU_THEME: {
            melody: [
                { time: "0:0:0", note: "G4", duration: "4n" }, { time: "0:1:0", note: "C5", duration: "4n" },
                { time: "0:2:0", note: "E5", duration: "4n" }, { time: "0:3:0", note: "G5", duration: "2n" },
                { time: "1:0:0", note: "F5", duration: "4n" }, { time: "1:1:0", note: "D5", duration: "4n" },
                { time: "1:2:0", note: "B4", duration: "4n" }, { time: "1:3:0", note: "C5", duration: "2n" },
                { time: "2:0:0", note: "E5", duration: "4n" }, { time: "2:1:0", note: "G5", duration: "4n" },
                { time: "2:2:0", note: "C6", duration: "4n" }, { time: "2:3:0", note: "B5", duration: "2n" },
                { time: "3:0:0", note: "A5", duration: "4n" }, { time: "3:1:0", note: "F5", duration: "4n" },
                { time: "3:2:0", note: "D5", duration: "4n" }, { time: "3:3:0", note: "E5", duration: "1m" }
            ],
            harmony: [
                { time: "0:0:0", note: "C3", duration: "1m"}, { time: "0:0:0", note: "E3", duration: "1m"},
                { time: "0:0:0", note: "G3", duration: "1m"}, { time: "1:0:0", note: "F3", duration: "1m"},
                { time: "1:0:0", note: "A3", duration: "1m"}, { time: "1:0:0", note: "C4", duration: "1m"},
                { time: "2:0:0", note: "G3", duration: "1m"}, { time: "2:0:0", note: "B3", duration: "1m"},
                { time: "2:0:0", note: "D4", duration: "1m"}, { time: "3:0:0", note: "C3", duration: "1m"},
                { time: "3:0:0", note: "E3", duration: "1m"}, { time: "3:0:0", note: "G3", duration: "1m"}
            ],
            tempo: "100bpm",
            loopLength: "4m"
        },
        DUNGEON_THEME: {
            melody: [
                { time: "0:0:0", note: "C2", duration: "1n." }, { time: "0:3:0", note: "D#2", duration: "8n" },
                { time: "1:0:0", note: "D2", duration: "2n" }, { time: "1:2:0", note: "F2", duration: "2n" },
                { time: "2:0:0", note: "C2", duration: "1n." }, { time: "2:3:0", note: "A#1", duration: "8n" },
                { time: "3:0:0", note: "G#1", duration: "1m"}, { time: "4:0:0", note: "C2", duration: "2n"},
                { time: "4:2:0", note: "D#2", duration: "2n"}, { time: "5:0:0", note: "F2", duration: "1n"},
                { time: "6:0:0", note: "D2", duration: "2n." }, { time: "6:3:0", note: "C2", duration: "8n" },
                { time: "7:0:0", note: "A#1", duration: "1m"}
            ],
            harmony: [
                { time: "0:0:0", note: "C1", duration: "2m"}, { time: "2:0:0", note: "F1", duration: "2m"},
                { time: "4:0:0", note: "G1", duration: "2m"}, { time: "6:0:0", note: "D1", duration: "2m"}
            ],
            tempo: "50bpm",
            loopLength: "8m"
        },
        DUNGEON_THEME_ALT: {
            melody: [
                { time: "0:0:0", note: "E2", duration: "1n" }, { time: "1:0:0", note: "G2", duration: "2n" },
                { time: "1:2:0", note: "F#2", duration: "2n" }, { time: "2:0:0", note: "E2", duration: "1n" },
                { time: "3:0:0", note: "B1", duration: "1m"}, { time: "4:0:0", note: "D2", duration: "1n" },
                { time: "5:0:0", note: "C#2", duration: "2n" }, { time: "5:2:0", note: "B1", duration: "2n" },
                { time: "6:0:0", note: "A1", duration: "1m"}
            ],
            harmony: [
                { time: "0:0:0", note: "E1", duration: "2m"}, { time: "2:0:0", note: "A1", duration: "2m"},
                { time: "4:0:0", note: "D1", duration: "2m"}, { time: "6:0:0", note: "G1", duration: "2m"}
            ],
            tempo: "45bpm",
            loopLength: "8m"
        },
    },

    init: function() {
        if (typeof Tone === 'undefined') {
            console.error("Tone.js is not loaded. MusicPlayer cannot initialize.");
            return;
        }
        this.melodySynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle8" },
            envelope: { attack: 0.05, decay: 0.2, sustain: 0.4, release: 0.8 },
            volume: -10
        }).toDestination();

        this.harmonySynth = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 1.5,
            modulationIndex: 3,
            envelope: { attack: 0.1, decay: 0.5, sustain: 0.2, release: 1.2 },
            volume: -18
        }).toDestination();

        this.volumeNode = new Tone.Volume(-10).toDestination(); // Default volume
        this.melodySynth.connect(this.volumeNode);
        this.harmonySynth.connect(this.volumeNode);

        // loadSettings will be called from index.html after MusicPlayer.init()
        // to ensure DOM elements for settings are available.
        // It will then call MusicPlayer.setVolume and MusicPlayer.toggleMusic.
        if (typeof loadSettings === 'function') {
             // This ensures that if loadSettings is available, it can immediately
             // set the initial volume and music state based on saved preferences.
            loadSettings();
        } else {
            console.warn("loadSettings function not found during MusicPlayer.init. Initial settings might not be applied.");
        }
    },

    playTheme: async function(themeType = 'MENU_THEME') {
        if (!this.isMusicOn || !this.melodySynth || !this.harmonySynth) return;
        if (typeof Tone === 'undefined') return;

        if (Tone.context.state !== 'running') {
            try {
                await Tone.start();
            } catch (e) {
                console.warn("Tone.start() failed. Audio context might not be resumable by user gesture.", e);
                // Potentially inform the user they need to interact with the page for sound.
                return;
            }
        }

        if (this.melodySequencer) {
            this.melodySequencer.stop().clear().dispose();
            this.melodySequencer = null;
        }
        if (this.harmonySequencer) {
            this.harmonySequencer.stop().clear().dispose();
            this.harmonySequencer = null;
        }

        const theme = this.themes[themeType] || this.themes.MENU_THEME;
        this.currentTheme = themeType;

        this.melodySequencer = new Tone.Part((time, value) => {
            this.melodySynth.triggerAttackRelease(value.note, value.duration, time);
        }, theme.melody).start(0);
        this.melodySequencer.loop = true;
        this.melodySequencer.loopEnd = theme.loopLength;

        if (theme.harmony && this.harmonySynth) {
            this.harmonySequencer = new Tone.Part((time, value) => {
                this.harmonySynth.triggerAttackRelease(value.note, value.duration, time);
            }, theme.harmony).start(0);
            this.harmonySequencer.loop = true;
            this.harmonySequencer.loopEnd = theme.loopLength;
        }

        Tone.Transport.bpm.value = parseInt(theme.tempo);
        if (Tone.Transport.state !== "started") {
            Tone.Transport.start();
        }
    },

    stop: function() {
        if (typeof Tone === 'undefined') return;
        if (this.melodySequencer) {
            this.melodySequencer.stop().clear().dispose();
            this.melodySequencer = null;
        }
        if (this.harmonySequencer) {
            this.harmonySequencer.stop().clear().dispose();
            this.harmonySequencer = null;
        }
        this.currentTheme = null;
        if (Tone.Transport.state === "started") {
            Tone.Transport.pause(); // Use pause instead of stop to allow easy restart with current settings
        }
    },

    setVolume: function(value) { // value is 0 to 1
        if (typeof Tone === 'undefined' || !this.volumeNode) return;
        const dB = Tone.gainToDb(parseFloat(value));
        this.volumeNode.volume.linearRampToValueAtTime(dB, Tone.now() + 0.1);
    },

    toggleMusic: function(isOn) {
        this.isMusicOn = isOn;
        if (this.isMusicOn && this.currentTheme) {
            this.playTheme(this.currentTheme);
        } else if (!this.isMusicOn) {
            this.stop();
        }
    }
};

export default MusicPlayer;