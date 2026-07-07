/** Unicode Extended_Pictographic characters for the habit icon emoji picker. */
import { ISO_FLAG_REGION_CODES, isoCodeToFlagEmoji } from './isoFlagRegionCodes';

const EMOJI_CODE_POINT_RANGES: [number, number][] = [
  [0x2300, 0x23ff],
  [0x2600, 0x27bf],
  [0x2b00, 0x2bff],
  [0x1f000, 0x1f02f],
  [0x1f0a0, 0x1f0ff],
  [0x1f100, 0x1f1ff],
  [0x1f200, 0x1f2ff],
  [0x1f300, 0x1f5ff],
  [0x1f600, 0x1f64f],
  [0x1f680, 0x1f6ff],
  [0x1f700, 0x1f77f],
  [0x1f780, 0x1f7ff],
  [0x1f800, 0x1f8ff],
  [0x1f900, 0x1f9ff],
  [0x1fa00, 0x1fa6f],
  [0x1fa70, 0x1faff],
  [0x1fb00, 0x1fbff],
];

const EMOJI_SEQUENCES = [
  '©️',
  '®️',
  '™️',
  '#️⃣',
  '*️⃣',
  '0️⃣',
  '1️⃣',
  '2️⃣',
  '3️⃣',
  '4️⃣',
  '5️⃣',
  '6️⃣',
  '7️⃣',
  '8️⃣',
  '9️⃣',
  '🏳️',
  '🏴',
  '🏁',
  '🚩',
  '🎌',
  '🏳️‍🌈',
  '🏳️‍⚧️',
  '🏴‍☠️',
  '👨‍💻',
  '👩‍💻',
  '👨‍⚕️',
  '👩‍⚕️',
  '👨‍🍳',
  '👩‍🍳',
  '🧑‍🚀',
  '👨‍🚀',
  '👩‍🚀',
  '🧑‍🎨',
  '👨‍🎨',
  '👩‍🎨',
  '👨‍👩‍👧',
  '👨‍👩‍👧‍👦',
  '👨‍👨‍👦',
  '👩‍👩‍👧',
  '🧑‍🤝‍🧑',
  '👫',
  '👬',
  '👭',
  '💏',
  '💑',
  '🐕‍🦺',
  '🐈‍⬛',
  '🐻‍❄️',
  '❤️‍🔥',
  '❤️‍🩹',
  '🫱‍🫲',
  '🧑‍🦰',
  '🧑‍🦱',
  '🧑‍🦳',
  '🧑‍🦲',
];

export type EmojiCategoryId =
  | 'smileys'
  | 'people'
  | 'animals'
  | 'food'
  | 'activities'
  | 'travel'
  | 'objects'
  | 'symbols'
  | 'flags';

export const EMOJI_CATEGORY_TABS: { id: EmojiCategoryId; label: string }[] = [
  { id: 'smileys', label: 'Smileys' },
  { id: 'people', label: 'People' },
  { id: 'animals', label: 'Nature' },
  { id: 'food', label: 'Food' },
  { id: 'activities', label: 'Activities' },
  { id: 'travel', label: 'Travel' },
  { id: 'objects', label: 'Objects' },
  { id: 'symbols', label: 'Symbols' },
  { id: 'flags', label: 'Flags' },
];

function isRegionalIndicatorFlag(emoji: string): boolean {
  const codePoints = significantCodePoints(emoji);
  return (
    codePoints.length >= 2 &&
    codePoints.every((codePoint) => inRange(codePoint, 0x1f1e6, 0x1f1ff))
  );
}

function isSpecialFlagEmoji(emoji: string): boolean {
  const primary = significantCodePoints(emoji)[0];
  if (!primary) return false;
  return (
    primary === 0x1f3f3 ||
    primary === 0x1f3f4 ||
    primary === 0x1f6a9 ||
    primary === 0x1f38c ||
    primary === 0x1f3c1
  );
}

function isFlagEmoji(emoji: string): boolean {
  return isRegionalIndicatorFlag(emoji) || isSpecialFlagEmoji(emoji);
}

function isEmojiCharacter(value: string): boolean {
  return /\p{Extended_Pictographic}/u.test(value) || isFlagEmoji(value);
}

function buildFlagEmojis(): string[] {
  const flags = new Set<string>();

  for (const isoCode of ISO_FLAG_REGION_CODES) {
    flags.add(isoCodeToFlagEmoji(isoCode));
  }

  for (const emoji of EMOJI_SEQUENCES) {
    if (isFlagEmoji(emoji)) {
      flags.add(emoji);
    }
  }

  return [...flags].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function significantCodePoints(emoji: string): number[] {
  return [...emoji]
    .map((char) => char.codePointAt(0)!)
    .filter((codePoint) => codePoint !== 0xfe0f && codePoint !== 0x200d);
}

function inRange(codePoint: number, start: number, end: number): boolean {
  return codePoint >= start && codePoint <= end;
}

function anyInRange(codePoints: number[], start: number, end: number): boolean {
  return codePoints.some((codePoint) => inRange(codePoint, start, end));
}

export function getEmojiCategory(emoji: string): EmojiCategoryId {
  if (isFlagEmoji(emoji)) {
    return 'flags';
  }

  const codePoints = significantCodePoints(emoji);
  const primary = codePoints[0];
  if (!primary) return 'symbols';

  if (
    inRange(primary, 0x1f600, 0x1f64f) ||
    inRange(primary, 0x1f910, 0x1f92f) ||
    inRange(primary, 0x1f970, 0x1f978) ||
    inRange(primary, 0x1fae0, 0x1faf6)
  ) {
    return 'smileys';
  }

  if (
    anyInRange(codePoints, 0x1f466, 0x1f487) ||
    anyInRange(codePoints, 0x1f574, 0x1f575) ||
    anyInRange(codePoints, 0x1f590, 0x1f594) ||
    anyInRange(codePoints, 0x1f645, 0x1f647) ||
    anyInRange(codePoints, 0x1f64d, 0x1f64f) ||
    anyInRange(codePoints, 0x1f6b4, 0x1f6b6) ||
    anyInRange(codePoints, 0x1f918, 0x1f91f) ||
    anyInRange(codePoints, 0x1f926, 0x1f937) ||
    anyInRange(codePoints, 0x1f9b5, 0x1f9bb) ||
    anyInRange(codePoints, 0x1f9cd, 0x1f9df) ||
    primary === 0x1f385 ||
    primary === 0x1f6c0 ||
    primary === 0x1f57a ||
    primary === 0x1f9d1
  ) {
    return 'people';
  }

  if (
    anyInRange(codePoints, 0x1f400, 0x1f43f) ||
    anyInRange(codePoints, 0x1f980, 0x1f9ae) ||
    anyInRange(codePoints, 0x1f330, 0x1f344) ||
    anyInRange(codePoints, 0x1f304, 0x1f321) ||
    anyInRange(codePoints, 0x1f3d4, 0x1f3df) ||
    anyInRange(codePoints, 0x1f333, 0x1f335) ||
    anyInRange(codePoints, 0x1f340, 0x1f342) ||
    primary === 0x1f308 ||
    inRange(primary, 0x26c4, 0x26c5)
  ) {
    return 'animals';
  }

  if (
    anyInRange(codePoints, 0x1f32d, 0x1f37f) ||
    anyInRange(codePoints, 0x1f950, 0x1f96f) ||
    anyInRange(codePoints, 0x1fad0, 0x1fadf) ||
    primary === 0x2615
  ) {
    return 'food';
  }

  if (
    anyInRange(codePoints, 0x1f3a0, 0x1f3ff) ||
    anyInRange(codePoints, 0x1f938, 0x1f939) ||
    anyInRange(codePoints, 0x1f3c0, 0x1f3df) ||
    anyInRange(codePoints, 0x1f947, 0x1f94f) ||
    inRange(primary, 0x26bd, 0x26be) ||
    primary === 0x1f93d ||
    primary === 0x1f93e
  ) {
    return 'activities';
  }

  if (
    anyInRange(codePoints, 0x1f680, 0x1f6ff) ||
    anyInRange(codePoints, 0x1f3e0, 0x1f3ef) ||
    anyInRange(codePoints, 0x26f2, 0x26fa) ||
    anyInRange(codePoints, 0x1f5fc, 0x1f5ff) ||
    anyInRange(codePoints, 0x1f6e0, 0x1f6ec)
  ) {
    return 'travel';
  }

  if (
    anyInRange(codePoints, 0x1f4a0, 0x1f5fb) ||
    anyInRange(codePoints, 0x1f9e0, 0x1f9ff) ||
    anyInRange(codePoints, 0x231a, 0x231b) ||
    anyInRange(codePoints, 0x23e9, 0x23f3) ||
    anyInRange(codePoints, 0x1f4bb, 0x1f4ff) ||
    anyInRange(codePoints, 0x1f50b, 0x1f56f) ||
    anyInRange(codePoints, 0x1f576, 0x1f579) ||
    anyInRange(codePoints, 0x1f58b, 0x1f58d)
  ) {
    return 'objects';
  }

  return 'symbols';
}

function buildAllEmojis(): string[] {
  const emojis = new Set<string>(buildFlagEmojis());

  for (const [start, end] of EMOJI_CODE_POINT_RANGES) {
    for (let codePoint = start; codePoint <= end; codePoint++) {
      const emoji = String.fromCodePoint(codePoint);
      if (/\p{Extended_Pictographic}/u.test(emoji)) {
        emojis.add(emoji);
      }
    }
  }

  for (const emoji of EMOJI_SEQUENCES) {
    if (isEmojiCharacter(emoji)) {
      emojis.add(emoji);
    }
  }

  return [...emojis].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function buildEmojisByCategory(): Record<EmojiCategoryId, string[]> {
  const grouped = Object.fromEntries(
    EMOJI_CATEGORY_TABS.map(({ id }) => [id, [] as string[]])
  ) as Record<EmojiCategoryId, string[]>;

  for (const emoji of buildAllEmojis()) {
    grouped[getEmojiCategory(emoji)].push(emoji);
  }

  return grouped;
}

export const ALL_EMOJIS = buildAllEmojis();
export const EMOJIS_BY_CATEGORY = buildEmojisByCategory();

export function isKnownEmoji(icon: string): boolean {
  return ALL_EMOJIS.includes(icon);
}

export function findCategoryForEmoji(icon: string): EmojiCategoryId {
  if (!isKnownEmoji(icon)) return 'smileys';
  return getEmojiCategory(icon);
}
