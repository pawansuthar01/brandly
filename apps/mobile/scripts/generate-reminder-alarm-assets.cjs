const fs = require("node:fs");
const path = require("node:path");

const directory = path.resolve(__dirname, "../assets/sounds");
const durationSeconds = 120;
const outputSampleRate = 8_000;
const outputSamples = durationSeconds * outputSampleRate;

function findDataChunk(buffer) {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === "data") return { offset: offset + 8, size: chunkSize };
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  throw new Error("WAV data chunk not found");
}

function readMonoSamples(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Expected a PCM WAV file");
  }
  const format = buffer.readUInt16LE(20);
  const channels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);
  const supportedPcm = format === 1 && [16, 24, 32].includes(bitsPerSample);
  const supportedFloat = format === 3 && bitsPerSample === 32;
  if ((!supportedPcm && !supportedFloat) || channels < 1) {
    throw new Error(`Expected PCM 16/24/32-bit or 32-bit float WAV audio (format=${format}, bits=${bitsPerSample})`);
  }
  const data = findDataChunk(buffer);
  const bytesPerSample = bitsPerSample / 8;
  const frameBytes = channels * bytesPerSample;
  const frames = Math.floor(Math.min(data.size, buffer.length - data.offset) / frameBytes);
  const samples = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      const offset = data.offset + frame * frameBytes + channel * bytesPerSample;
      if (supportedFloat) sum += buffer.readFloatLE(offset);
      else if (bitsPerSample === 16) sum += buffer.readInt16LE(offset) / 32768;
      else if (bitsPerSample === 24) sum += buffer.readIntLE(offset, 3) / 8388608;
      else sum += buffer.readInt32LE(offset) / 2147483648;
    }
    samples[frame] = sum / channels;
  }
  return { samples, sampleRate };
}

function resample(samples, sourceRate) {
  const length = Math.max(1, Math.round(samples.length * outputSampleRate / sourceRate));
  const output = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const sourcePosition = index * sourceRate / outputSampleRate;
    const left = Math.min(samples.length - 1, Math.floor(sourcePosition));
    const right = Math.min(samples.length - 1, left + 1);
    const fraction = sourcePosition - left;
    output[index] = samples[left] + (samples[right] - samples[left]) * fraction;
  }
  return output;
}

function writePcmWav(name, samples, sampleRate) {
  const pcm = Buffer.alloc(samples.length * 2);
  for (let index = 0; index < samples.length; index += 1) {
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[index])) * 32767), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(path.join(directory, name), Buffer.concat([header, pcm]));
}

function writeAlarmWav(name, source) {
  const pcm = Buffer.alloc(outputSamples * 2);
  const sourceSamples = resample(source.samples, source.sampleRate);
  for (let index = 0; index < outputSamples; index += 1) {
    const value = Math.max(-1, Math.min(1, sourceSamples[index % sourceSamples.length]));
    pcm.writeInt16LE(Math.round(value * 32767), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(outputSampleRate, 24);
  header.writeUInt32LE(outputSampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(path.join(directory, name), Buffer.concat([header, pcm]));
}

for (const file of fs.readdirSync(directory).filter((item) => item.endsWith(".wav") && !item.endsWith("_alarm.wav"))) {
  const input = fs.readFileSync(path.join(directory, file));
  const source = readMonoSamples(input);
  if (input.readUInt16LE(20) !== 1 || input.readUInt16LE(22) !== 1 || input.readUInt16LE(34) !== 16) {
    writePcmWav(file, source.samples, source.sampleRate);
  }
  writeAlarmWav(file.replace(/\.wav$/i, "_alarm.wav"), source);
}

console.log(`Generated ${fs.readdirSync(directory).filter((item) => item.endsWith("_alarm.wav")).length} two-minute alarm sounds at ${outputSampleRate}Hz.`);
