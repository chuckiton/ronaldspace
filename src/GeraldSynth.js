import {
    GERALD_DISTORTION_DRIVE,
    GERALD_FREQUENCIES,
    GERALD_HARMONIC_GAINS
} from "./constants.js?v=20260722-gerald-live-wave";

const LETTER_INDEX = { G: 0, R: 1, L: 2, D: 3 };
const WAVEFORMS = ["sine", "sawtooth", "square", "triangle"];
const SCRUTINY_GAIN = [0, 0.018, 0.052, 0.105];

function distortionCurve(amount) {
    const samples = 2048;
    const curve = new Float32Array(samples);
    const drive = GERALD_DISTORTION_DRIVE[amount];

    for (let index = 0; index < samples; index += 1) {
        const x = index * 2 / (samples - 1) - 1;
        curve[index] = drive === 0
            ? x
            : Math.tanh(x * (1 + drive * 0.08)) / Math.tanh(1 + drive * 0.08);
    }
    return curve;
}

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
            frequency: GERALD_FREQUENCIES[indices[0]],
            waveform: WAVEFORMS[indices[1]],
            harmonics: indices[2],
            distortion: indices[3]
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
            harmonicGains: [],
            distortion: audio.createWaveShaper()
        };
        voice.distortion.oversample = "4x";

        for (let index = 0; index < 4; index += 1) {
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.connect(gain).connect(voice.distortion).connect(this.mixGain);
            oscillator.start();
            voice.oscillators.push(oscillator);
            voice.harmonicGains.push(gain);
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
            oscillator.frequency.setTargetAtTime(
                parameters.frequency * (index + 1),
                now,
                0.028
            );
            voice.harmonicGains[index].gain.setTargetAtTime(
                index <= parameters.harmonics
                    ? GERALD_HARMONIC_GAINS[index] * voiceLevel
                    : 0,
                now,
                0.025
            );
        });
        voice.distortion.curve = distortionCurve(parameters.distortion);
    }

    syncVoices() {
        const wanted = new Set(this.names);
        this.voices.forEach((voice, name) => {
            if (wanted.has(name)) return;
            voice.oscillators.forEach(oscillator => oscillator.stop());
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
            });
            await this.audioContext.close();
            this.audioContext = null;
            this.voices.clear();
            return;
        }
        if (!enabled || this.audioContext) return;

        this.audioContext = new AudioContext();
        const audio = this.audioContext;
        this.mixGain = audio.createGain();
        this.outputGain = audio.createGain();
        this.mixGain.gain.value = 0.58;
        this.outputGain.gain.value = SCRUTINY_GAIN[this.scrutiny];
        this.mixGain.connect(this.outputGain).connect(audio.destination);
        this.syncVoices();
    }
}
