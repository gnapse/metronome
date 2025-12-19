class Metronome {
    constructor() {
        this.ws = null;
        this.audioContext = null;
        this.isPlaying = false;
        this.bpm = 120;
        this.timeSignature = '4/4';
        this.subdivisions = 'quarter';
        this.beatCount = 0;
        this.subdivisionCount = 0;
        this.intervalId = null;
        this.roomId = null;
        this.networkIP = null;
        this.lastTapTime = null;
        this.tapTimes = [];

        this.initRoom();
        this.initElements();
        this.initAudio();
        this.initWebSocket();
        this.attachEventListeners();
        this.updateBeatDisplay();
    }

    initRoom() {
        const urlParams = new URLSearchParams(window.location.search);
        this.roomId = urlParams.get('room');

        if (!this.roomId) {
            // Generate random room ID
            this.roomId = Math.random().toString(36).substring(2, 8);
            window.location.href = `${window.location.origin}${window.location.pathname}?room=${this.roomId}`;
            return;
        }

        document.getElementById('room-id').textContent = this.roomId;
    }

    initElements() {
        this.elements = {
            bpmValue: document.getElementById('bpm-value'),
            bpmSlider: document.getElementById('bpm-slider'),
            tempoMinus5: document.getElementById('tempo-minus-5'),
            tempoMinus1: document.getElementById('tempo-minus-1'),
            tempoPlus1: document.getElementById('tempo-plus-1'),
            tempoPlus5: document.getElementById('tempo-plus-5'),
            tempoDisplay: document.querySelector('.tempo-display'),
            timeSignature: document.getElementById('time-signature'),
            subdivisions: document.getElementById('subdivisions'),
            beatCircle: document.getElementById('beat-circle'),
            beatNumber: document.getElementById('beat-number'),
            connectionStatus: document.getElementById('connection-status'),
            copyLink: document.getElementById('copy-link')
        };
    }

    initAudio() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}?room=${this.roomId}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            this.elements.connectionStatus.textContent = 'Connected';
            this.elements.connectionStatus.className = 'connection-status connected';
        };

        this.ws.onclose = () => {
            this.elements.connectionStatus.textContent = 'Disconnected';
            this.elements.connectionStatus.className = 'connection-status';
            // Try to reconnect after 2 seconds
            setTimeout(() => this.initWebSocket(), 2000);
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'state') {
                this.updateFromRemote(data);
            }
        };
    }

    attachEventListeners() {
        this.elements.beatCircle.onclick = () => this.togglePlay();

        this.elements.bpmSlider.oninput = (e) => {
            this.setBpm(parseInt(e.target.value));
        };

        this.elements.tempoMinus5.onclick = () => this.setBpm(this.bpm - 5);
        this.elements.tempoMinus1.onclick = () => this.setBpm(this.bpm - 1);
        this.elements.tempoPlus1.onclick = () => this.setBpm(this.bpm + 1);
        this.elements.tempoPlus5.onclick = () => this.setBpm(this.bpm + 5);

        this.elements.timeSignature.onchange = (e) => {
            this.setTimeSignature(e.target.value);
        };

        this.elements.subdivisions.onchange = (e) => {
            this.setSubdivisions(e.target.value);
        };

        this.elements.tempoDisplay.onclick = () => this.handleTapTempo();

        this.elements.copyLink.onclick = () => {
            let linkUrl = window.location.href;

            // Use network IP if current host is localhost and we have a network IP
            if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && this.networkIP) {
                linkUrl = window.location.href.replace(window.location.hostname, this.networkIP);
            }

            navigator.clipboard.writeText(linkUrl);
            this.elements.copyLink.textContent = 'Copied!';
            setTimeout(() => {
                this.elements.copyLink.textContent = 'Copy Link';
            }, 1000);
        };
    }

    updateFromRemote(state) {
        // Update local state without triggering broadcast
        if (state.networkIP !== undefined) {
            this.networkIP = state.networkIP;
        }

        if (state.bpm !== undefined) {
            this.bpm = state.bpm;
            this.elements.bpmValue.textContent = this.bpm;
            this.elements.bpmSlider.value = this.bpm;
        }

        if (state.timeSignature !== undefined) {
            this.timeSignature = state.timeSignature;
            this.elements.timeSignature.value = this.timeSignature;
        }

        if (state.subdivisions !== undefined) {
            this.subdivisions = state.subdivisions;
            this.elements.subdivisions.value = this.subdivisions;
        }

        if (state.playing !== undefined) {
            if (state.playing !== this.isPlaying) {
                if (state.playing) {
                    this.startMetronome();
                } else {
                    this.stopMetronome();
                }
            }
        }
    }

    broadcastState() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'state',
                bpm: this.bpm,
                playing: this.isPlaying,
                timeSignature: this.timeSignature,
                subdivisions: this.subdivisions
            }));
        }
    }

    getSubdivisionMultiplier() {
        switch (this.subdivisions) {
            case 'quarter': return 1;
            case 'eighth': return 2;
            case 'sixteenth': return 4;
            default: return 1;
        }
    }

    getTickInterval() {
        const multiplier = this.getSubdivisionMultiplier();
        return (60000 / this.bpm) / multiplier;
    }

    togglePlay() {
        if (this.isPlaying) {
            this.stopMetronome();
        } else {
            this.startMetronome();
        }
        this.broadcastState();
    }

    startMetronome() {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.isPlaying = true;
        this.beatCount = 0;
        this.subdivisionCount = 0;
        this.updateBeatDisplay();

        this.tick(); // First beat immediately
        this.intervalId = setInterval(() => this.tick(), this.getTickInterval());
    }

    stopMetronome() {
        this.isPlaying = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.elements.beatCircle.classList.remove('active');
        this.updateBeatDisplay();
    }

    updateBeatDisplay() {
        if (this.isPlaying) {
            // Show beat number when playing
            const displayBeat = this.beatCount + 1;
            this.elements.beatNumber.innerHTML = displayBeat;
        } else {
            // Show play triangle when stopped
            this.elements.beatNumber.innerHTML = '<div class="play-triangle"></div>';
        }
    }

    tick() {
        const subdivisionMultiplier = this.getSubdivisionMultiplier();
        const beatsPerMeasure = parseInt(this.timeSignature.split('/')[0]);

        // Check if this is a main beat (quarter note)
        const isMainBeat = this.subdivisionCount % subdivisionMultiplier === 0;

        if (isMainBeat) {
            // Update beat display only on main beats
            this.visualBeat();
        }

        // Play different sounds for main beats vs subdivisions
        this.playClick(isMainBeat);

        // Advance subdivision count
        this.subdivisionCount++;

        // Advance beat count only on main beats
        if (isMainBeat) {
            this.beatCount = (this.beatCount + 1) % beatsPerMeasure;
            this.updateBeatDisplay();
        }
    }

    playClick(isMainBeat = true) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        if (isMainBeat) {
            // Main beats: First beat of measure is higher pitch
            oscillator.frequency.value = this.beatCount === 0 ? 1000 : 800;
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        } else {
            // Subdivisions: Lower pitch and quieter
            oscillator.frequency.value = 600;
            gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
        }

        oscillator.type = 'sine';
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    visualBeat() {
        this.elements.beatCircle.classList.add('active');
        setTimeout(() => {
            this.elements.beatCircle.classList.remove('active');
        }, 100);
    }

    setBpm(newBpm) {
        this.bpm = Math.max(40, Math.min(220, newBpm));
        this.elements.bpmValue.textContent = this.bpm;
        this.elements.bpmSlider.value = this.bpm;

        if (this.isPlaying) {
            clearInterval(this.intervalId);
            this.intervalId = setInterval(() => this.tick(), this.getTickInterval());
        }

        this.broadcastState();
    }

    setTimeSignature(newTimeSignature) {
        this.timeSignature = newTimeSignature;
        this.beatCount = 0; // Reset beat count
        this.subdivisionCount = 0; // Reset subdivision count
        this.broadcastState();
    }

    setSubdivisions(newSubdivisions) {
        this.subdivisions = newSubdivisions;
        this.subdivisionCount = 0; // Reset subdivision count

        // Update timing if currently playing
        if (this.isPlaying) {
            clearInterval(this.intervalId);
            this.intervalId = setInterval(() => this.tick(), this.getTickInterval());
        }

        this.broadcastState();
    }

    handleTapTempo() {
        const now = Date.now();

        if (this.lastTapTime) {
            this.tapTimes.push(now - this.lastTapTime);

            // Keep only last 4 taps
            if (this.tapTimes.length > 4) {
                this.tapTimes.shift();
            }

            if (this.tapTimes.length >= 2) {
                const avgInterval = this.tapTimes.reduce((a, b) => a + b) / this.tapTimes.length;
                const newBpm = Math.round(60000 / avgInterval);

                if (newBpm >= 40 && newBpm <= 220) {
                    this.setBpm(newBpm);
                }
            }
        }

        this.lastTapTime = now;

        // Reset if no tap for 3 seconds
        setTimeout(() => {
            if (Date.now() - this.lastTapTime >= 3000) {
                this.tapTimes = [];
                this.lastTapTime = null;
            }
        }, 3000);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new Metronome();
});