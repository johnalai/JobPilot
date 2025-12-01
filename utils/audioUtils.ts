// This file contains utility functions for audio encoding and decoding,
// specifically for handling raw PCM data as required by the Gemini Live API.

/**
 * Decodes a Base64 string into a Uint8Array.
 * @param base64 The Base64 string to decode.
 * @returns A Uint8Array representing the decoded binary data.
 */
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encodes a Uint8Array into a Base64 string.
 * @param bytes The Uint8Array to encode.
 * @returns A Base64 string.
 */
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes raw PCM audio data (Uint8Array) into an AudioBuffer.
 * This is specific to the Gemini Live API output which is raw PCM.
 * @param data The Uint8Array containing raw PCM audio data (typically 16-bit signed integers).
 * @param ctx The AudioContext to create the AudioBuffer with.
 * @param sampleRate The sample rate of the audio data.
 * @param numChannels The number of audio channels (e.g., 1 for mono).
 * @returns A Promise that resolves with an AudioBuffer.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert 16-bit signed integer to float between -1.0 and 1.0
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Creates a Blob object for PCM audio data.
 * @param data A Float32Array of audio samples (typically from AudioBuffer.getChannelData).
 * @returns A Blob object with the specified MIME type.
 */
export function createBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768; // Convert Float32 to Int16
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000', // The supported audio MIME type
  };
}