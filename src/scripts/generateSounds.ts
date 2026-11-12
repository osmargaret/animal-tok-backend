import fs from "fs";
import path from "path";

// Generate a valid 44.1kHz 16-bit PCM WAV file with melodic tones
function generateMelodicWav(
  durationSec: number,
  notes: { freq: number; dur: number; type?: "sine" | "square" | "triangle" }[]
): Buffer {
  const sampleRate = 44100;
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const totalSamples = Math.floor(sampleRate * durationSec);
  const dataSize = totalSamples * numChannels * bytesPerSample;
  const fileSize = 44 + dataSize;

  const buffer = Buffer.alloc(fileSize);

  // RIFF identifier
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // ByteRate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  let currentSample = 0;

  for (let s = 0; s < totalSamples; s++) {
    const t = s / sampleRate;

    // Find current note in loop
    const patternDuration = notes.reduce((acc, n) => acc + n.dur, 0);
    const loopT = t % patternDuration;

    let accumulatedT = 0;
    let activeNote = notes[0];
    for (const n of notes) {
      if (loopT >= accumulatedT && loopT < accumulatedT + n.dur) {
        activeNote = n;
        break;
      }
      accumulatedT += n.dur;
    }

    const noteT = loopT - accumulatedT;
    const env = Math.max(0, 1 - noteT / activeNote.dur); // decay envelope

    let sampleVal = 0;
    if (activeNote.freq > 0) {
      const wave = Math.sin(2 * Math.PI * activeNote.freq * t);
      const harmonic = 0.3 * Math.sin(4 * Math.PI * activeNote.freq * t);
      sampleVal = (wave + harmonic) * env * 0.45;
    }

    // Add rhythmic kick pulse every 0.5s
    const beatT = t % 0.5;
    if (beatT < 0.08) {
      const kickFreq = 120 * (1 - beatT / 0.08) + 40;
      sampleVal += 0.4 * Math.sin(2 * Math.PI * kickFreq * beatT) * (1 - beatT / 0.08);
    }

    // Clamp
    sampleVal = Math.max(-1, Math.min(1, sampleVal));
    const intSample = Math.floor(sampleVal * 32767);
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  return buffer;
}

const soundsDir = path.join(__dirname, "../../uploads/sounds");
if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true });
}

// 1. Golden Hour Bounce (Major Chords: C - G - Am - F)
const track1 = generateMelodicWav(15, [
  { freq: 261.63, dur: 0.5 }, { freq: 329.63, dur: 0.5 }, { freq: 392.00, dur: 0.5 }, { freq: 523.25, dur: 0.5 },
  { freq: 196.00, dur: 0.5 }, { freq: 246.94, dur: 0.5 }, { freq: 293.66, dur: 0.5 }, { freq: 392.00, dur: 0.5 },
  { freq: 220.00, dur: 0.5 }, { freq: 261.63, dur: 0.5 }, { freq: 329.63, dur: 0.5 }, { freq: 440.00, dur: 0.5 },
  { freq: 174.61, dur: 0.5 }, { freq: 220.00, dur: 0.5 }, { freq: 261.63, dur: 0.5 }, { freq: 349.23, dur: 0.5 },
]);
fs.writeFileSync(path.join(soundsDir, "track1.wav"), track1);

// 2. Agility Sprint Beat (Electro fast tempo)
const track2 = generateMelodicWav(15, [
  { freq: 440.00, dur: 0.25 }, { freq: 554.37, dur: 0.25 }, { freq: 659.25, dur: 0.25 }, { freq: 880.00, dur: 0.25 },
  { freq: 493.88, dur: 0.25 }, { freq: 587.33, dur: 0.25 }, { freq: 739.99, dur: 0.25 }, { freq: 987.77, dur: 0.25 },
]);
fs.writeFileSync(path.join(soundsDir, "track2.wav"), track2);

// 3. Cute Cat Nap (Lofi Purr - gentle relaxing pentatonic)
const track3 = generateMelodicWav(15, [
  { freq: 329.63, dur: 1.0 }, { freq: 392.00, dur: 1.0 }, { freq: 440.00, dur: 1.0 }, { freq: 523.25, dur: 1.0 },
  { freq: 440.00, dur: 1.0 }, { freq: 392.00, dur: 1.0 }, { freq: 329.63, dur: 2.0 },
]);
fs.writeFileSync(path.join(soundsDir, "track3.wav"), track3);

// 4. Happy Puppy Walk (Bouncy major melody)
const track4 = generateMelodicWav(15, [
  { freq: 523.25, dur: 0.35 }, { freq: 587.33, dur: 0.35 }, { freq: 659.25, dur: 0.35 }, { freq: 698.46, dur: 0.35 },
  { freq: 783.99, dur: 0.7 },  { freq: 659.25, dur: 0.7 },  { freq: 523.25, dur: 0.7 },
]);
fs.writeFileSync(path.join(soundsDir, "track4.wav"), track4);

// 5. Pet Gaming Zone (8-bit arcade arpeggio)
const track5 = generateMelodicWav(15, [
  { freq: 261.63, dur: 0.2 }, { freq: 329.63, dur: 0.2 }, { freq: 392.00, dur: 0.2 }, { freq: 523.25, dur: 0.2 },
  { freq: 659.25, dur: 0.2 }, { freq: 523.25, dur: 0.2 }, { freq: 392.00, dur: 0.2 }, { freq: 329.63, dur: 0.2 },
]);
fs.writeFileSync(path.join(soundsDir, "track5.wav"), track5);

// 6. Funny Animal Fails (Playful quirky bounce)
const track6 = generateMelodicWav(15, [
  { freq: 392.00, dur: 0.25 }, { freq: 415.30, dur: 0.25 }, { freq: 440.00, dur: 0.5 },
  { freq: 349.23, dur: 0.25 }, { freq: 329.63, dur: 0.25 }, { freq: 293.66, dur: 0.5 },
]);
fs.writeFileSync(path.join(soundsDir, "track6.wav"), track6);

console.log("✅ All 6 sound tracks generated successfully in uploads/sounds!");

