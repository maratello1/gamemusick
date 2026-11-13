import { ScenePacing, SceneTagId, SceneVector, VibeStateId } from '@/types/vibe';

export interface SceneTaxonomyEntry {
  tag: SceneTagId;
  nameRu: string;
  shortRu: string;
  descriptionRu: string;
  accentHex: string;
  energy: number;
  tension: number;
  valence: number;
  pacing: ScenePacing;
  legacyVibe: VibeStateId;
  ostMoodKeywords: string;
  customArtistModifiers: string;
}

export const SCENE_TAXONOMY: Record<string, SceneTaxonomyEntry> = {
  standby: {
    tag: 'standby',
    nameRu: 'Ожидание игры',
    shortRu: 'Ожидание',
    descriptionRu: 'Активная игра не обнаружена — спокойный фоновый поток',
    accentHex: '#64748B',
    energy: 12,
    tension: 8,
    valence: 10,
    pacing: 'still',
    legacyVibe: 'EXPLORE',
    ostMoodKeywords: 'calm ambient instrumental background lo-fichill',
    customArtistModifiers: 'chill instrumental acoustic atmospheric slow',
  },
  menu_lobby: {
    tag: 'menu_lobby',
    nameRu: 'Меню / Инвентарь / Лобби',
    shortRu: 'Меню / Лобби',
    descriptionRu: 'Подготовка, выбор героя, крафт, снаряжение или поиск матча',
    accentHex: '#818CF8',
    energy: 24,
    tension: 18,
    valence: 8,
    pacing: 'slow',
    legacyVibe: 'EXPLORE',
    ostMoodKeywords: 'main menu theme lobby preparation atmospheric synth ambient',
    customArtistModifiers: 'chill atmospheric groovy midtempo remix',
  },
  cozy_hub: {
    tag: 'cozy_hub',
    nameRu: 'Мирное убежище / Таверна',
    shortRu: 'Убежище',
    descriptionRu: 'Безопасный хаб, лагерь у костра, мирный город или торговец',
    accentHex: '#34D399',
    energy: 18,
    tension: 8,
    valence: 60,
    pacing: 'slow',
    legacyVibe: 'EXPLORE',
    ostMoodKeywords: 'peaceful town tavern hearth cozy acoustic lute ambient ost',
    customArtistModifiers: 'warm acoustic chill relaxing soft melody',
  },
  explore_wander: {
    tag: 'explore_wander',
    nameRu: 'Исследование мира',
    shortRu: 'Исследование',
    descriptionRu: 'Свободный путь по локации, поиск секретов, ритмичное движение',
    accentHex: '#10B981',
    energy: 32,
    tension: 24,
    valence: 15,
    pacing: 'steady',
    legacyVibe: 'EXPLORE',
    ostMoodKeywords: 'exploration ambient journey atmospheric soundtrack',
    customArtistModifiers: 'atmospheric midtempo driving groove studio',
  },
  vista_wonder: {
    tag: 'vista_wonder',
    nameRu: 'Панорама / Открытие мира',
    shortRu: 'Панорама',
    descriptionRu: 'Впечатляющий горизонт, вход в величественную локацию, рассвет',
    accentHex: '#EAB308',
    energy: 44,
    tension: 26,
    valence: 76,
    pacing: 'steady',
    legacyVibe: 'MAJESTIC',
    ostMoodKeywords: 'majestic sweeping orchestral vista wonder soaring theme ost',
    customArtistModifiers: 'uplifting soaring cinematic euphoric melodic',
  },
  stealth_infiltrate: {
    tag: 'stealth_infiltrate',
    nameRu: 'Стелс / Скрытность',
    shortRu: 'Стелс',
    descriptionRu: 'Тихое проникновение, тень, выслеживание цели без тревоги',
    accentHex: '#38BDF8',
    energy: 30,
    tension: 70,
    valence: -35,
    pacing: 'slow',
    legacyVibe: 'STEALTH',
    ostMoodKeywords: 'stealth espionage suspense minimal pulse dark synth ost',
    customArtistModifiers: 'dark minimal moody bassline late night',
  },
  horror_dread: {
    tag: 'horror_dread',
    nameRu: 'Хоррор / Саспенс / Угроза',
    shortRu: 'Саспенс',
    descriptionRu: 'Гнетущая темнота, клаустрофобия, близость опасности или монстра',
    accentHex: '#A855F7',
    energy: 26,
    tension: 86,
    valence: -80,
    pacing: 'slow',
    legacyVibe: 'STEALTH',
    ostMoodKeywords: 'horror dread unsettling dark ambient drone eerie tension ost',
    customArtistModifiers: 'dark eerie brooding haunting atmospheric',
  },
  dialogue_story: {
    tag: 'dialogue_story',
    nameRu: 'Сюжетный диалог / Расследование',
    shortRu: 'Диалог',
    descriptionRu: 'Разговор персонажей, лор, нуарное расследование и выбор реплик',
    accentHex: '#F472B6',
    energy: 20,
    tension: 38,
    valence: -8,
    pacing: 'slow',
    legacyVibe: 'DRAMA',
    ostMoodKeywords: 'emotional story dialogue piano strings subtle noir ost',
    customArtistModifiers: 'soft melancholic piano soulful calm acoustic',
  },
  tragedy_drama: {
    tag: 'tragedy_drama',
    nameRu: 'Драма / Трагедия / Гибель',
    shortRu: 'Драма',
    descriptionRu: 'Тяжелый поворот сюжета, потеря, мрачная эмоциональная кульминация',
    accentHex: '#9E1B32',
    energy: 28,
    tension: 64,
    valence: -86,
    pacing: 'slow',
    legacyVibe: 'DRAMA',
    ostMoodKeywords: 'tragic sorrowful emotional cello requiem mournful ost',
    customArtistModifiers: 'sad tragic emotional heartbreaking slow rock ballad',
  },
  respawn_downtime: {
    tag: 'respawn_downtime',
    nameRu: 'Респавн / Наблюдение',
    shortRu: 'Респавн',
    descriptionRu: 'Пауза после выбывания в онлайн-матче, передышка перед раундом',
    accentHex: '#6366F1',
    energy: 18,
    tension: 22,
    valence: -18,
    pacing: 'slow',
    legacyVibe: 'DRAMA',
    ostMoodKeywords: 'chill downtempo reflective lo-fi electronic break',
    customArtistModifiers: 'chill downtempo mellow dream pop night vibe',
  },
  skirmish_combat: {
    tag: 'skirmish_combat',
    nameRu: 'Стычка / Боевой экшен',
    shortRu: 'Бой',
    descriptionRu: 'Активное сражение, перестрелка или динамичная дуэль',
    accentHex: '#FF6A00',
    energy: 74,
    tension: 68,
    valence: -15,
    pacing: 'driving',
    legacyVibe: 'COMBAT',
    ostMoodKeywords: 'dynamic combat battle action rhythmic electronic rock ost',
    customArtistModifiers: 'energetic punchy driving intense hit track',
  },
  teamfight_clash: {
    tag: 'teamfight_clash',
    nameRu: 'Замес / Решающий клатч',
    shortRu: 'Клатч',
    descriptionRu: 'Высокий накал командного столкновения, предельная концентрация',
    accentHex: '#FB7185',
    energy: 86,
    tension: 88,
    valence: -10,
    pacing: 'frantic',
    legacyVibe: 'COMBAT',
    ostMoodKeywords: 'high adrenaline esports clash fast hard hitting rhythm ost',
    customArtistModifiers: 'high energy aggressive hype adrenaline bass heavy',
  },
  chase_escape: {
    tag: 'chase_escape',
    nameRu: 'Погоня / Побег / Таймер',
    shortRu: 'Погоня',
    descriptionRu: 'Стремительный отрыв от преследования, эвакуация под давлением',
    accentHex: '#F97316',
    energy: 82,
    tension: 92,
    valence: -45,
    pacing: 'frantic',
    legacyVibe: 'COMBAT',
    ostMoodKeywords: 'frantic chase escape urgent pulsing countdown synth percussion ost',
    customArtistModifiers: 'fast urgent relentless dark synth punk drive',
  },
  boss_climax: {
    tag: 'boss_climax',
    nameRu: 'Битва с Боссом / Кульминация',
    shortRu: 'Босс',
    descriptionRu: 'Эпическая схватка со сложным боссом или финальной фазой',
    accentHex: '#EF4444',
    energy: 95,
    tension: 96,
    valence: -25,
    pacing: 'frantic',
    legacyVibe: 'BOSSFIGHT',
    ostMoodKeywords: 'epic choir boss battle orchestral metal climax ost',
    customArtistModifiers: 'heavy epic massive climax metal industrial anthem',
  },
  victory_triumph: {
    tag: 'victory_triumph',
    nameRu: 'Победа / Триумф / Награда',
    shortRu: 'Триумф',
    descriptionRu: 'Успешное завершение тяжелой схватки, триумфальное остывание',
    accentHex: '#F59E0B',
    energy: 64,
    tension: 18,
    valence: 92,
    pacing: 'driving',
    legacyVibe: 'VICTORY',
    ostMoodKeywords: 'triumphant victory fanfare uplifting heroic relief theme ost',
    customArtistModifiers: 'triumphant celebratory uplifting anthem bright',
  },
};

export const QUICK_SCENE_ORDER: SceneTagId[] = [
  'menu_lobby',
  'cozy_hub',
  'explore_wander',
  'vista_wonder',
  'horror_dread',
  'stealth_infiltrate',
  'dialogue_story',
  'tragedy_drama',
  'chase_escape',
  'skirmish_combat',
  'teamfight_clash',
  'boss_climax',
  'victory_triumph',
];

export function mapSceneTagToLegacyVibe(
  tag: SceneTagId,
  energy = 30,
  tension = 25,
  valence = 0
): VibeStateId {
  const known = SCENE_TAXONOMY[tag];
  if (known) return known.legacyVibe;
  if (energy >= 88 && tension >= 85) return 'BOSSFIGHT';
  if (energy >= 58 || (tension >= 82 && valence > -60)) return 'COMBAT';
  if (valence >= 55 && energy >= 35) return 'MAJESTIC';
  if (tension >= 65 && energy < 55) return 'STEALTH';
  if (valence <= -45) return 'DRAMA';
  return 'EXPLORE';
}

export function legacyVibeToSceneTag(vibe: VibeStateId, isOnline = false): SceneTagId {
  switch (vibe) {
    case 'BOSSFIGHT':
      return 'boss_climax';
    case 'COMBAT':
      return isOnline ? 'teamfight_clash' : 'skirmish_combat';
    case 'STEALTH':
      return 'stealth_infiltrate';
    case 'DRAMA':
      return 'tragedy_drama';
    case 'MAJESTIC':
      return 'vista_wonder';
    case 'VICTORY':
      return 'victory_triumph';
    case 'EXPLORE':
    default:
      return isOnline ? 'menu_lobby' : 'explore_wander';
  }
}

export function getSceneTaxonomy(tag: SceneTagId): SceneTaxonomyEntry {
  return SCENE_TAXONOMY[tag] || SCENE_TAXONOMY.explore_wander;
}

export function computePacing(energy: number, tension: number): ScenePacing {
  const drive = energy * 0.72 + tension * 0.28;
  if (drive < 15) return 'still';
  if (drive < 35) return 'slow';
  if (drive < 60) return 'steady';
  if (drive < 82) return 'driving';
  return 'frantic';
}

export interface TelemetryClassificationInput {
  isStandby: boolean;
  detectedProcess: string;
  windowTitle: string;
  gameGenre?: string;
  isOnlineGame: boolean;
  motionDelta: number;
  crimsonIndex: number;
  brightness: number;
  lumaVariance?: number;
  gameAudioPeak?: number;
  captureBlocked?: boolean;
  warmth?: number;
  coolness?: number;
  saturation?: number;
  cursorTravel?: number;
  attackApm?: number;
  moveApm?: number;
  isCutscene?: boolean;
  isNewLocation?: boolean;
  isRespawnSpectating?: boolean;
  sceneHint?: string;
  combatThreshold: number;
  bossSensitivity: number;
  stealthLumaThreshold: number;
  dialogueText?: string;
  dialogueEmotion?: string;
  director?: {
    sceneType?: string;
    sceneTag?: string;
    vibe?: VibeStateId;
    mood?: string;
    tension?: number;
    energy?: number;
    valence?: number;
    summary?: string;
    musicStyle?: string;
    hasGeminiVision?: boolean;
    aiProvider?: string;
  } | null;
}

export function classifyTelemetryToSceneVector(
  input: TelemetryClassificationInput
): { sceneVector: SceneVector; inferredVibe: VibeStateId; intensity: number } {
  if (input.isStandby) {
    const entry = SCENE_TAXONOMY.standby;
    return {
      sceneVector: {
        sceneTag: 'standby',
        sceneNameRu: entry.nameRu,
        energy: entry.energy,
        tension: entry.tension,
        valence: entry.valence,
        pacing: entry.pacing,
        musicBrief: entry.ostMoodKeywords,
        confidence: 98,
        source: 'standby',
        accentHex: entry.accentHex,
      },
      inferredVibe: 'EXPLORE',
      intensity: 10,
    };
  }

  const combatThresh = Math.max(24, Math.min(72, input.combatThreshold || 40));
  const bossThresh = Math.max(66, Math.min(96, input.bossSensitivity || 82));
  const stealthLuma = Math.max(18, Math.min(58, input.stealthLumaThreshold || 38));
  const lumaVar = input.lumaVariance ?? 18;
  const audioPeak = typeof input.gameAudioPeak === 'number' ? input.gameAudioPeak : -1;
  const pixelsUsable = !input.captureBlocked;
  const warmth = input.warmth ?? 0;
  const audioCombatBoost = audioPeak >= 68 && input.motionDelta >= 22 ? 12 : audioPeak >= 45 && input.motionDelta >= 32 ? 6 : 0;
  const silentMenuDamp = audioPeak === 0 && input.motionDelta < 20 ? -8 : 0;
  const cursorTravel = input.cursorTravel ?? 0;
  const attackApm = input.attackApm ?? 0;
  const moveApm = input.moveApm ?? 0;
  const genreUpper = (input.gameGenre || '').toUpperCase();

  // Compute raw continuous sensor intensity (0..100)
  const crimsonBoost = input.crimsonIndex >= 18 ? Math.min(24, Math.round(input.crimsonIndex * 0.4)) : 0;
  const rawEnergy = Math.max(
    8,
    Math.min(100, Math.round(input.motionDelta + crimsonBoost + audioCombatBoost + silentMenuDamp))
  );

  // Base continuous vector estimated from local vision + input telemetry
  let sceneTag: SceneTagId = input.isOnlineGame ? 'menu_lobby' : 'explore_wander';
  let energy = rawEnergy;
  let tension = Math.min(100, Math.round(rawEnergy * 0.65 + input.crimsonIndex * 0.55));
  let valence = input.brightness >= 45 ? 18 : -12;
  let source: SceneVector['source'] = 'sensor';
  let customNameRu: string | undefined;
  let customBrief: string | undefined;

  const hint = (input.sceneHint || '').toUpperCase();
  const dirType = (input.director?.sceneType || '').toLowerCase();
  const dirTag = (input.director?.sceneTag || '').toLowerCase();
  const dialogueText = (input.dialogueText || '').trim();
  const dEmotion = (input.dialogueEmotion || '').toUpperCase();

  // 1. Online respawn / spectating takes priority over noisy spectate cam
  if (input.isRespawnSpectating || hint === 'RESPAWN') {
    const t = SCENE_TAXONOMY.respawn_downtime;
    sceneTag = 'respawn_downtime';
    energy = t.energy;
    tension = t.tension;
    valence = t.valence;
  }
  // 2. Boss climax (hardware boss bar OR sustained high combat climax >= learned boss threshold)
  else if (
    !input.isOnlineGame &&
    (hint === 'BOSSFIGHT' || rawEnergy >= bossThresh || (input.crimsonIndex >= 50 && rawEnergy >= combatThresh + 14))
  ) {
    sceneTag = 'boss_climax';
    energy = Math.max(88, rawEnergy);
    tension = Math.max(90, Math.min(100, rawEnergy + 8));
    valence = -30;
  }
  // 3. Chase / escape detection (high movement + sustained danger flash, low stationary attack clicks)
  else if (
    !input.isOnlineGame &&
    (hint === 'CHASE_ESCAPE' ||
      (moveApm >= 3 && attackApm === 0 && input.motionDelta >= Math.max(combatThresh - 4, 34) && input.crimsonIndex >= 22))
  ) {
    sceneTag = 'chase_escape';
    energy = Math.max(76, rawEnergy);
    tension = Math.max(88, Math.min(100, rawEnergy + 15));
    valence = -48;
  }
  // 4. Active Combat (skirmish vs online teamfight clash)
  else if (rawEnergy >= combatThresh || hint === 'COMBAT' || hint === 'TEAMFIGHT') {
    if (input.isOnlineGame && (rawEnergy >= combatThresh + 20 || hint === 'TEAMFIGHT' || attackApm >= 6)) {
      sceneTag = 'teamfight_clash';
      energy = Math.max(82, rawEnergy);
      tension = Math.max(84, tension);
      valence = -12;
    } else {
      sceneTag = 'skirmish_combat';
      energy = Math.max(66, rawEnergy);
      tension = Math.max(62, tension);
      valence = -15;
    }
  }
  // 5. OCR Victory / Triumph or Drama Dialogue / Cutscene
  else if (dEmotion === 'VICTORY' || hint === 'VICTORY') {
    sceneTag = 'victory_triumph';
    energy = 62;
    tension = 20;
    valence = 92;
    source = 'ocr';
  } else if (dialogueText.length >= 4 && (dEmotion === 'DRAMA' || dEmotion === 'TRAGEDY')) {
    sceneTag = 'tragedy_drama';
    energy = 24;
    tension = 64;
    valence = -84;
    source = 'ocr';
  } else if (input.isCutscene || dialogueText.length >= 4) {
    sceneTag = 'dialogue_story';
    energy = 20;
    tension = dEmotion === 'COMBAT' ? 60 : 38;
    valence = dEmotion === 'MAJESTIC' ? 40 : -10;
    source = dialogueText.length >= 4 ? 'ocr' : 'sensor';
  }
  // 6. New majestic area / bright scenic vista
  else if (input.isNewLocation || hint === 'VISTA_WONDER' || (input.brightness >= 58 && lumaVar >= 18 && attackApm === 0 && rawEnergy < 30)) {
    sceneTag = 'vista_wonder';
    energy = Math.max(36, Math.min(54, rawEnergy + 18));
    tension = 24;
    valence = 76;
  }
  // 7. Horror dread vs Stealth infiltration
  else if (
    hint === 'HORROR_DREAD' ||
    (pixelsUsable &&
      input.brightness <= stealthLuma &&
      (genreUpper === 'HORROR' || (lumaVar <= 12 && input.brightness < 26) || input.crimsonIndex >= 30) &&
      rawEnergy < combatThresh)
  ) {
    sceneTag = 'horror_dread';
    energy = Math.max(20, Math.min(42, rawEnergy));
    tension = Math.max(76, Math.min(94, 62 + input.crimsonIndex));
    valence = -78;
  } else if (
    hint === 'STEALTH' ||
    (pixelsUsable && input.brightness <= stealthLuma && !input.isOnlineGame && warmth < 18)
  ) {
    sceneTag = 'stealth_infiltrate';
    energy = Math.max(24, Math.min(45, rawEnergy));
    tension = 68;
    valence = -35;
  }
  // 8. Menu / Inventory / Draft Lobby vs Cozy Safe Hub vs Wander
  else if (
    hint === 'MENU_LOBBY' ||
    (cursorTravel >= 180 && attackApm === 0 && moveApm === 0) ||
    (input.isOnlineGame && rawEnergy < 24 && attackApm === 0)
  ) {
    sceneTag = 'menu_lobby';
    energy = 22;
    tension = 18;
    valence = 8;
  } else if (hint === 'COZY_HUB' || (input.brightness >= 42 && rawEnergy <= 18 && input.crimsonIndex === 0)) {
    sceneTag = 'cozy_hub';
    energy = 18;
    tension = 10;
    valence = 56;
  } else {
    sceneTag = 'explore_wander';
    energy = Math.max(24, Math.min(52, rawEnergy));
    tension = 24;
    valence = input.brightness >= 40 ? 22 : -8;
  }

  // Enrich / fuse with Gemini Vision or Rich Local Director when available
  const dir = input.director;
  if (dir && !input.isStandby) {
    const dirHasRichVector =
      typeof dir.energy === 'number' || typeof dir.tension === 'number' || Boolean(dir.sceneTag);
    const dirHasGemini = Boolean(dir.hasGeminiVision);
    const dirHasCvOcr = dir.aiProvider === 'cv_ocr';

    // If hardware sensor says clear active combat, hardware latency wins for instant kick-in;
    // otherwise Vision Director / OpenCV+OCR refines semantic scene nuance (menu, tavern, horror, vista, cutscenes, etc.)
    const hardwareUrgentCombat = rawEnergy >= combatThresh || hint === 'BOSSFIGHT' || hint === 'CHASE_ESCAPE';

    if ((dirHasGemini || dirHasCvOcr || dirHasRichVector) && !hardwareUrgentCombat) {
      source = dirHasGemini ? 'vision' : dirHasCvOcr ? 'ocr' : source;
      if (dirTag && dirTag !== 'exploration' && dirTag !== 'explore') {
        if (SCENE_TAXONOMY[dirTag]) {
          sceneTag = dirTag;
        } else if (/menu|pause|lobby|inventory|draft|shop/.test(dirTag)) {
          sceneTag = 'menu_lobby';
        } else if (/tavern|hub|safe|camp|cozy|town/.test(dirTag)) {
          sceneTag = 'cozy_hub';
        } else if (/horror|dread|scary|dark/.test(dirTag)) {
          sceneTag = 'horror_dread';
        } else if (/chase|escape|run|pursuit/.test(dirTag)) {
          sceneTag = 'chase_escape';
        } else if (/stealth|sneak/.test(dirTag)) {
          sceneTag = 'stealth_infiltrate';
        } else if (/boss|climax/.test(dirTag)) {
          sceneTag = 'boss_climax';
        } else if (/victory|win|triumph/.test(dirTag)) {
          sceneTag = 'victory_triumph';
        } else {
          // Preserve custom semantic tag from Gemini Vision with readable label
          sceneTag = dirTag.replace(/\s+/g, '_').slice(0, 40);
          customNameRu = dir.summary
            ? dir.summary.split(/[.,!]/)[0].slice(0, 48).trim()
            : dir.mood || dir.sceneType || sceneTag;
        }
      } else if (dirType.includes('menu') || dirType.includes('lobby') || dirType.includes('draft')) {
        sceneTag = 'menu_lobby';
      } else if (dirType.includes('horror') || dirType.includes('dread') || dirType.includes('scary')) {
        sceneTag = 'horror_dread';
      } else if (dirType.includes('cozy') || dirType.includes('tavern') || dirType.includes('safe') || dirType.includes('camp')) {
        sceneTag = 'cozy_hub';
      } else if (dirType.includes('chase') || dirType.includes('escape')) {
        sceneTag = 'chase_escape';
      } else if (dirType.includes('vista') || dirType.includes('panorama') || dirType.includes('new_location')) {
        sceneTag = 'vista_wonder';
      } else if (dirType.includes('boss')) {
        sceneTag = 'boss_climax';
      } else if (dirType.includes('cutscene') || dirType.includes('dialogue') || dirType.includes('drama')) {
        sceneTag = dir.valence !== undefined && dir.valence < -45 ? 'tragedy_drama' : 'dialogue_story';
      } else if (dirType.includes('stealth')) {
        sceneTag = 'stealth_infiltrate';
      } else if (dirType.includes('victory') || dirType.includes('triumph')) {
        sceneTag = 'victory_triumph';
      }

      if (typeof dir.energy === 'number' && Number.isFinite(dir.energy)) {
        energy = Math.max(0, Math.min(100, Math.round(dir.energy)));
      }
      if (typeof dir.tension === 'number' && Number.isFinite(dir.tension)) {
        // Vision Director v1 used 1..10 without vector fields; v3 uses 0..100
        const isLegacyTenScale = dir.energy === undefined && dir.valence === undefined && !dir.sceneTag;
        tension =
          isLegacyTenScale && dir.tension <= 10
            ? Math.round(dir.tension * 10)
            : Math.max(0, Math.min(100, Math.round(dir.tension)));
      }
      if (typeof dir.valence === 'number' && Number.isFinite(dir.valence)) {
        valence = Math.max(-100, Math.min(100, Math.round(dir.valence)));
      }
      if (dir.musicStyle && dir.musicStyle.trim().length > 4) {
        customBrief = dir.musicStyle.trim();
      }
    }
  }

  const tax = getSceneTaxonomy(sceneTag);
  const finalBrief = customBrief || tax.ostMoodKeywords;
  const legacyVibe = mapSceneTagToLegacyVibe(sceneTag, energy, tension, valence);

  return {
    sceneVector: {
      sceneTag,
      sceneNameRu: customNameRu || tax.nameRu,
      energy: Math.max(0, Math.min(100, Math.round(energy))),
      tension: Math.max(0, Math.min(100, Math.round(tension))),
      valence: Math.max(-100, Math.min(100, Math.round(valence))),
      pacing: computePacing(energy, tension),
      musicBrief: finalBrief,
      confidence: source === 'vision' ? 92 : source === 'ocr' ? 88 : 80,
      source,
      accentHex: tax.accentHex,
    },
    inferredVibe: legacyVibe,
    intensity: Math.max(rawEnergy, energy),
  };
}

/**
 * Compute continuous perceptual distance (0..100) between two scenes so hysteresis
 * prevents erratic rapid skipping while responding promptly to genuine scene changes.
 */
export function computeSceneDistance(a: SceneVector, b: SceneVector): number {
  const eDiff = Math.abs(a.energy - b.energy);
  const tDiff = Math.abs(a.tension - b.tension);
  const vDiff = Math.abs(a.valence - b.valence) * 0.5;
  const tagPenalty = a.sceneTag === b.sceneTag ? 0 : 28;
  return Math.min(100, Math.round(eDiff * 0.45 + tDiff * 0.35 + vDiff * 0.2 + tagPenalty));
}

/**
 * Synthesize a continuous SceneVector from an arbitrary user or AI text prompt
 * (e.g. "Дождливый киберпанк город, ночное расследование").
 */
export function resolveSceneFromTextPrompt(prompt: string): SceneVector {
  const q = prompt.toLowerCase();
  let tag: SceneTagId = 'explore_wander';
  let energy = 40;
  let tension = 35;
  let valence = 0;

  if (/босс|boss|финал|дракон|титан/.test(q)) {
    tag = 'boss_climax';
    energy = 94;
    tension = 96;
    valence = -25;
  } else if (/погон|убег|побег|chase|escape|таймер|эваку/.test(q)) {
    tag = 'chase_escape';
    energy = 82;
    tension = 92;
    valence = -45;
  } else if (/хоррор|страх|ужас|монстр|тьма|подвал|horror|dread|dark/.test(q)) {
    tag = 'horror_dread';
    energy = 26;
    tension = 86;
    valence = -80;
  } else if (/стелс|скрыт|тихо|шпион|stealth|infiltrat/.test(q)) {
    tag = 'stealth_infiltrate';
    energy = 32;
    tension = 70;
    valence = -35;
  } else if (/таверн|костер|убежищ|лагер|дом|отдых|cozy|tavern|camp|hub/.test(q)) {
    tag = 'cozy_hub';
    energy = 18;
    tension = 10;
    valence = 60;
  } else if (/меню|лобби|инвентар|крафт|магазин|драфт|menu|lobby|shop/.test(q)) {
    tag = 'menu_lobby';
    energy = 22;
    tension = 18;
    valence = 8;
  } else if (/драм|трагед|смерт|потер|груст|печал|дожд|sad|tragic|noir|rain/.test(q)) {
    tag = 'tragedy_drama';
    energy = 26;
    tension = 60;
    valence = -78;
  } else if (/побед|триумф|наград|victory|triumph/.test(q)) {
    tag = 'victory_triumph';
    energy = 66;
    tension = 18;
    valence = 92;
  } else if (/панорам|космос|горизонт|велич|рассвет|vista|cosmic|majestic/.test(q)) {
    tag = 'vista_wonder';
    energy = 44;
    tension = 26;
    valence = 76;
  } else if (/бой|перестрел|драк|схват|замес|клатч|combat|fight|shoot/.test(q)) {
    tag = 'skirmish_combat';
    energy = 76;
    tension = 70;
    valence = -15;
  } else if (/диалог|сюжет|разговор|квест|dialogue|story|talk/.test(q)) {
    tag = 'dialogue_story';
    energy = 20;
    tension = 36;
    valence = -10;
  }

  const base = getSceneTaxonomy(tag);
  return {
    sceneTag: tag,
    sceneNameRu: prompt.trim().slice(0, 48) || base.nameRu,
    energy,
    tension,
    valence,
    pacing: computePacing(energy, tension),
    musicBrief: `${prompt.trim()} ${base.ostMoodKeywords}`.trim(),
    confidence: 95,
    source: 'manual',
    accentHex: base.accentHex,
  };
}

export function buildSemanticTrackQueries(params: {
  audioMode: 'game-vibe' | 'custom';
  sceneTag: string;
  energy: number;
  tension: number;
  valence: number;
  musicBrief?: string;
  artists: string[];
  genres: string[];
  gameTitle?: string;
  vocalPref?: string;
  languagePref?: string;
}): string[] {
  const tax = getSceneTaxonomy(params.sceneTag);
  const { energy, tension, valence, audioMode } = params;
  const instrTag = params.vocalPref === 'instrumental' ? 'instrumental' : '';
  const langTag = params.languagePref === 'ru' ? 'русский' : '';

  if (audioMode === 'custom') {
    let modifier = tax.customArtistModifiers;
    if (params.sceneTag === 'menu_lobby' || params.sceneTag === 'cozy_hub') {
      modifier = 'chill acoustic atmospheric studio';
    } else if (energy < 35 && valence <= -35) {
      modifier = 'sad dark slow acoustic emotional';
    } else if (energy < 45 && tension >= 60) {
      modifier = 'dark brooding moody haunting atmospheric';
    } else if (valence >= 60 && energy >= 40) {
      modifier = 'uplifting euphoric melodic anthem';
    } else if (energy >= 84) {
      modifier = 'heavy intense energetic hit track';
    } else if (tension >= 80 && energy >= 60) {
      modifier = 'fast urgent driving intense song';
    } else if (energy >= 58) {
      modifier = 'energetic punchy driving groove';
    }

    const queries: string[] = [];
    const cleanArtists = params.artists.map((a) => a.trim()).filter(Boolean);
    for (const artist of cleanArtists.slice(0, 4)) {
      queries.push(`${artist} ${modifier} ${instrTag} ${langTag}`.replace(/\s+/g, ' ').trim());
    }
    if (params.genres.length > 0) {
      const gStr = params.genres.slice(0, 2).join(' ');
      queries.push(`${gStr} ${modifier} ${instrTag}`.replace(/\s+/g, ' ').trim());
    }
    if (queries.length === 0) {
      queries.push(`Deftones Kavinsky ${modifier}`.trim());
    }
    return queries;
  }

  // audioMode === 'game-vibe'
  const rawBrief = (params.musicBrief || tax.ostMoodKeywords)
    .replace(/soundtrack|ost/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 6)
    .join(' ');

  const gClean = (params.gameTitle || '')
    .replace(/\.exe$/i, '')
    .replace(/Ожидание игры/i, '')
    .trim();

  const queries: string[] = [];
  if (gClean.length > 1) {
    queries.push(`${gClean} ${rawBrief} ost`.replace(/\s+/g, ' ').trim());
    queries.push(`${gClean} ${tax.ostMoodKeywords.split(' ').slice(0, 4).join(' ')} music`.replace(/\s+/g, ' ').trim());
  }
  queries.push(`${rawBrief} video game soundtrack ${instrTag}`.replace(/\s+/g, ' ').trim());
  return queries;
}

