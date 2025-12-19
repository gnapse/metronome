// Browser global types for JSDoc type checking

interface Window {
  webkitAudioContext: typeof AudioContext;
  metronome: () => unknown;
}

declare const QrCreator: {
  render(options: {
    text: string;
    radius: number;
    ecLevel: 'L' | 'M' | 'Q' | 'H';
    fill: string;
    background: string | null;
    size: number;
  }, canvas: HTMLCanvasElement): void;
};

// Alpine.js types
declare const Alpine: {
  data(name: string, callback: () => unknown): void;
};
