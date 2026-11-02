import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { TrackItem } from '@/types/vibe';

export const dynamic = 'force-dynamic';

const AUDIO_EXTS = new Set(['.mp3', '.flac', '.wav', '.m4a', '.ogg']);

function scanAudioFiles(dirPath: string, results: TrackItem[] = [], maxFiles = 50): TrackItem[] {
  if (results.length >= maxFiles) return results;
  try {
    if (!fs.existsSync(dirPath)) return results;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        scanAudioFiles(fullPath, results, maxFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (AUDIO_EXTS.has(ext)) {
          const base = path.basename(entry.name, ext);
          const parts = base.split(' - ');
          const artist = parts.length > 1 ? parts[0].trim() : 'Локальный файл ПК';
          const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : base;

          results.push({
            id: `local-${Buffer.from(fullPath).toString('base64').slice(0, 24)}`,
            videoId: '',
            title,
            artist,
            album: path.basename(dirPath),
            duration: ext.replace('.', '').toUpperCase(),
            thumbnail: 'https://i.ytimg.com/vi/MV_3Dpw-BRY/hqdefault.jpg',
            previewUrl: `/api/local-music?stream=${encodeURIComponent(fullPath)}`,
            vibe: 'EXPLORE',
            genreTag: 'Локальный аудиофайл',
            localPath: fullPath,
          });
        }
      }
    }
  } catch {
    // ignore permission errors
  }
  return results;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const streamFile = searchParams.get('stream');

  // Stream a local audio file from disk
  if (streamFile) {
    try {
      if (!fs.existsSync(streamFile)) {
        return new NextResponse('File not found', { status: 404 });
      }
      const ext = path.extname(streamFile).toLowerCase();
      if (!AUDIO_EXTS.has(ext)) {
        return new NextResponse('Unsupported file type', { status: 403 });
      }
      const buffer = fs.readFileSync(streamFile);
      const mimeMap: Record<string, string> = {
        '.mp3': 'audio/mpeg',
        '.flac': 'audio/flac',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.ogg': 'audio/ogg',
      };
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mimeMap[ext] || 'audio/mpeg',
          'Content-Length': String(buffer.length),
        },
      });
    } catch {
      return new NextResponse('Error reading file', { status: 500 });
    }
  }

  const customDir = searchParams.get('dir')?.trim();
  const defaultMusicDir = path.join(os.homedir(), 'Music');
  const targetDir = customDir || defaultMusicDir;

  const files = scanAudioFiles(targetDir);
  return NextResponse.json({
    directory: targetDir,
    count: files.length,
    tracks: files,
  });
}
