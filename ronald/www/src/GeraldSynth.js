import {
    GERALD_CHORUS_GAINS,
    GERALD_FREQUENCIES,
    GERALD_LOW_PASS_CUTOFF_CENTER,
    GERALD_LOW_PASS_CUTOFF_DEPTH,
    GERALD_LOW_PASS_SWEEP_RATES
} from "./constants.js";

const LETTER_INDEX = { G: 0, R: 1, L: 2, D: 3 };
const WAVEFORMS = ["sine", "sawtooth", "square", "triangle"];
// Keep hover quiet, but make click and inspection reliably audible across
// laptop speakers and browser output levels.
const SCRUTINY_GAIN = [0, 0.065, 0.2, 0.38];

export class GeraldSynth {
    constructor() {
        this.names = [];
        this.scrutiny = 0;
        this.audioContext = null;
        this.voices = new Map();
    }

    parameters(name) {
        const indices = [name[0], name[2], name[4], name[5]]
            .map(letter => LETTER_INDEX[letter]);
        return {
            waveform: WAVEFORMS[indices[0]],
            noteIndex: indices[1],
            frequency: GERALD_FREQUENCIES[indices[1]],
            chorusNotes: 3 - indices[2],
            sweepRate: GERALD_LOW_PASS_SWEEP_RATES[indices[3]]
        };
    }

    setName(name) {
        this.setNames(name ? [name] : []);
    }

    setNames(names) {
        this.names = [...new Set(names.filter(Boolean))];
        if (this.audioContext) this.syncVoices();
    }

    setScrutiny(level) {
        this.scrutiny = Math.max(0, Math.min(3, level));
        if (this.audioContext) {
            this.outputGain.gain.setTargetAtTime(
                SCRUTINY_GAIN[this.scrutiny],
                this.audioContext.currentTime,
                0.055
            );
        }
    }

    setVisible(visible) {
        if (!visible && this.audioContext) this.setEnabled(false);
    }

    createVoice(name) {
        const audio = this.audioContext;
        const voice = {
            name,
            oscillators: [],
            noteGains: [],
            filter: audio.createBiquadFilter(),
            filterLfo: audio.createOscillator(),
            filterLfoDepth: audio.createGain()
        };
        voice.filter.type = "lowpass";
        voice.filter.Q.value = 0.7;
        voice.filter.frequency.value = GERALD_LOW_PASS_CUTOFF_CENTER;
        voice.filterLfo.type = "sine";
        voice.filterLfoDepth.gain.value = GERALD_LOW_PASS_CUTOFF_DEPTH;
        voice.filterLfo.connect(voice.filterLfoDepth).connect(voice.filter.frequency);
        voice.filterLfo.start();

        for (let index = 0; index < 4; index += 1) {
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.connect(gain)
                .connect(voice.filter)
                .connect(this.mixGain);
            oscillator.start();
            voice.oscillators.push(oscillator);
            voice.noteGains.push(gain);
        }
        this.updateVoice(voice, name);
        return voice;
    }

    updateVoice(voice, name) {
        voice.name = name;
        const parameters = this.parameters(name);
        const now = this.audioContext.currentTime;
        const voiceLevel = 1 / Math.sqrt(Math.max(1, this.names.length));

        voice.oscillators.forEach((oscillator, index) => {
            oscillator.type = parameters.waveform;
            const arpeggioStep = parameters.noteIndex + index;
            const noteIndex = arpeggioStep % GERALD_FREQUENCIES.length;
            const octave = Math.floor(arpeggioStep / GERALD_FREQUENCIES.length);
            oscillator.frequency.setTargetAtTime(
                GERALD_FREQUENCIES[noteIndex] * (2 ** octave),
                now,
                0.028
            );
            voice.noteGains[index].gain.setTargetAtTime(
                index <= parameters.chorusNotes
                    ? GERALD_CHORUS_GAINS[index] * voiceLevel
                    : 0,
                now,
                0.025
            );
        });
        voice.filterLfo.frequency.setTargetAtTime(parameters.sweepRate, now, 0.04);
    }

    syncVoices() {
        const wanted = new Set(this.names);
        this.voices.forEach((voice, name) => {
            if (wanted.has(name)) return;
            voice.oscillators.forEach(oscillator => oscillator.stop());
            voice.filterLfo.stop();
            this.voices.delete(name);
        });
        this.names.forEach(name => {
            const voice = this.voices.get(name) ?? this.createVoice(name);
            this.voices.set(name, voice);
            this.updateVoice(voice, name);
        });
    }

    async setEnabled(enabled) {
        if (!enabled && this.audioContext) {
            this.voices.forEach(voice => {
                voice.oscillators.forEach(oscillator => oscillator.stop());
                voice.filterLfo.stop();
            });
            await this.audioContext.close();
            this.audioContext = null;
            this.voices.clear();
            return;
        }
        if (!enabled) return;
        if (this.audioContext) {
            if (this.audioContext.state === "suspended") {
                await this.audioContext.resume();
            }
            return;
        }

        const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (!AudioContextClass) return;

        this.audioContext = new AudioContextClass();
        const audio = this.audioContext;
        this.mixGain = audio.createGain();
        this.outputGain = audio.createGain();
        this.mixGain.gain.value = 0.58;
        this.outputGain.gain.value = SCRUTINY_GAIN[this.scrutiny];
        this.mixGain.connect(this.outputGain).connect(audio.destination);
        this.syncVoices();
        if (audio.state === "suspended") {
            await audio.resume();
        }
    }
}
