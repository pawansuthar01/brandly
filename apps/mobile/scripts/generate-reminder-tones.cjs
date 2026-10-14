const fs = require("node:fs");
const path = require("node:path");

const sampleRate = 22050;
const outputDir = path.join(__dirname, "..", "assets", "sounds");

const tones = [
  ["soft_chime", 8.0, [[523.25, 0.0, 0.45], [659.25, 0.22, 0.55], [783.99, 0.46, 0.68]]],
  ["bright_bell", 8.5, [[880, 0.0, 0.32], [1174.66, 0.16, 0.48], [1567.98, 0.31, 0.64]]],
  ["focus_pulse", 9.0, [[392, 0.0, 0.45], [392, 0.55, 0.45], [523.25, 1.0, 0.55]]],
  ["morning_rise", 10.0, [[261.63, 0.0, 0.42], [329.63, 0.32, 0.5], [392, 0.65, 0.58], [523.25, 0.98, 0.72]]],
  ["warm_double", 8.5, [[329.63, 0.0, 0.38], [329.63, 0.48, 0.38], [493.88, 0.7, 0.56]]],
  ["clear_triangle", 8.0, [[659.25, 0.0, 0.45], [783.99, 0.28, 0.5], [1046.5, 0.56, 0.68]]],
  ["gentle_wave", 10.0, [[293.66, 0.0, 0.72], [369.99, 0.45, 0.8], [440, 0.92, 1.0]]],
  ["short_alert", 8.0, [[740, 0.0, 0.22], [740, 0.31, 0.22]]],
  ["deep_note", 9.0, [[196, 0.0, 0.78], [246.94, 0.52, 0.76]]],
  ["sparkle_sequence", 10.0, [[783.99, 0.0, 0.3], [987.77, 0.24, 0.4], [1174.66, 0.49, 0.5], [1567.98, 0.78, 0.72], [1975.53, 1.15, 0.9]]],
];

function writeTone(name, duration, notes) {
  const sampleCount = Math.ceil(sampleRate * duration);
  const buffer = Buffer.alloc(44 + sampleCount * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + sampleCount * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(sampleCount * 2, 40);

  const patternDuration = Math.max(...notes.map(([, start, length]) => start + length)) + 0.28;
  const repeatedNotes = [];
  for (let offset = 0; offset < duration; offset += patternDuration) {
    for (const [frequency, start, length] of notes) {
      repeatedNotes.push([frequency, start + offset, length]);
    }
  }

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    let sample = 0;
    for (const [frequency, start, length] of repeatedNotes) {
      const elapsed = time - start;
      if (elapsed < 0 || elapsed > length) continue;
      const attack = Math.min(1, elapsed / 0.025);
      const release = Math.min(1, (length - elapsed) / 0.18);
      const envelope = attack * release;
      sample += Math.sin(2 * Math.PI * frequency * elapsed) * envelope * 0.24;
      sample += Math.sin(2 * Math.PI * frequency * 2 * elapsed) * envelope * 0.04;
    }
    const clipped = Math.max(-1, Math.min(1, sample));
    buffer.writeInt16LE(Math.round(clipped * 32767), 44 + index * 2);
  }

  fs.writeFileSync(path.join(outputDir, `${name}.wav`), buffer);
}

fs.mkdirSync(outputDir, { recursive: true });
for (const [name, duration, notes] of tones) writeTone(name, duration, notes);
console.log(`Generated ${tones.length} reminder tones in ${outputDir}`);
