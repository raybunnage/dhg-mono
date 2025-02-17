import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export async function extractAudio(videoUrl: string): Promise<ArrayBuffer> {
  const ffmpeg = new FFmpeg();
  await ffmpeg.load();
  
  const videoData = await fetch(videoUrl).then(r => r.arrayBuffer());
  await ffmpeg.writeFile('input.mp4', new Uint8Array(videoData));
  
  // Extract audio as mp3
  await ffmpeg.exec(['-i', 'input.mp4', '-vn', '-acodec', 'libmp3lame', 'output.mp3']);
  
  const data = await ffmpeg.readFile('output.mp3');
  return data.buffer;
} 