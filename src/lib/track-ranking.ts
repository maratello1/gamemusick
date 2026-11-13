import fs from 'fs';
import path from 'path';
import { TrackItem } from '@/types/vibe';

export interface LearnedPreferenceWeights {
  artistWeights: Record<string, number>;
  genreWeights: Record<string, number>;
  gameProfiles: Record<string, { preferredGenres: string[]; favoriteArtists: string[] }>;
}

const USER_PLAYLISTS_PATH = path.join(process.cwd(), 'data', 'user-playlists.json');

export function loadLearnedPreferenceWeights(): LearnedPreferenceWeights {
  try {
    if (fs.existsSync(USER_PLAYLISTS_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(USER_PLAYLISTS_PATH, 'utf8'));
      const model = parsed?.aiLearningModel;
      if (model && typeof model === 'object') {
        return {
          artistWeights: model.artistWeights || {},
          genreWeights: model.genreWeights || {},
          gameProfiles: model.gameProfiles || {},
        };
      }
    }
  } catch {
    // ignore read/parse error
  }
  return { artistWeights: {}, genreWeights: {}, gameProfiles: {} };
}

/**
 * Re-ranks candidate tracks using historical completion vs fast-skip RL weights,
 * game-specific favorite artists, and strict exclusions (disliked + broken embed IDs).
 */
export function applyLearnedTrackRanking(
  tracks: TrackItem[],
  options: {
    weights?: LearnedPreferenceWeights;
    excludeIds?: Set<string>;
    gameProcess?: string;
  }
): TrackItem[] {
  const weights = options.weights || loadLearnedPreferenceWeights();
  const excludeIds = options.excludeIds || new Set<string>();
  const gameKey = (options.gameProcess || '').toLowerCase().trim();
  const gameFavArtists = new Set(
    (weights.gameProfiles[gameKey]?.favoriteArtists || []).map((a) => a.toLowerCase().trim())
  );

  const eligible = tracks.filter(
    (t) => !excludeIds.has(t.id) && (!t.videoId || !excludeIds.has(t.videoId))
  );
  const baseList = eligible.length > 0 ? eligible : tracks;

  return baseList
    .map((track, idx) => {
      const aKey = (track.artist || '').toLowerCase().trim();
      const gKey = (track.genreTag || '').toLowerCase().trim();
      const artistBoost = Number(weights.artistWeights[aKey] || 0) * 6;
      const genreBoost = Number(weights.genreWeights[gKey] || 0) * 4;
      const gameFavBoost = gameFavArtists.has(aKey) ? 14 : 0;

      // Preserve slight base order affinity while elevating preferred & demoting fast-skipped tracks
      const score = artistBoost + genreBoost + gameFavBoost - idx * 0.15;
      return { track, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.track);
}
