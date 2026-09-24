export const NICKNAME_MIN = 2
export const NICKNAME_MAX = 20

/** Turkish letters and spaces only — keeps nicknames name-like and hard to abuse. */
const NICKNAME_PATTERN = /^[A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû]+(?: [A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû]+)*$/

const ASCII: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
}

function fold(value: string) {
  return value.toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, (char) => ASCII[char] ?? char)
}

/**
 * Roots blocked anywhere in the folded name. Only unambiguous roots here — short ones
 * ("sik", "mal") would block real names like "Işık", so they are matched as whole words.
 */
const BLOCKED_ANYWHERE = [
  'orospu',
  'orosbu',
  'siktir',
  'sikik',
  'sikerim',
  'yarrak',
  'yarak',
  'pezevenk',
  'kahpe',
  'kaltak',
  'gerizekali',
  'serefsiz',
  'haysiyetsiz',
  'dangalak',
  'pust',
  'gavat',
  'ibne',
  'aminakoy',
  'kodumun',
]
const BLOCKED_WORDS = new Set([
  'amk',
  'amq',
  'aq',
  'mk',
  'oc',
  'pic',
  'sik',
  'got',
  'mal',
  'salak',
  'aptal',
  'it',
  'ahmak',
  'embesil',
])

export type NicknameProblem = 'too-short' | 'too-long' | 'characters' | 'inappropriate'

export const NICKNAME_MESSAGES: Record<NicknameProblem, string> = {
  'too-short': 'Adın en az 2 harf olmalı.',
  'too-long': 'Adın en fazla 20 harf olabilir.',
  characters: 'Yalnızca harf ve boşluk kullanabilirsin.',
  inappropriate: 'Bu ad olmaz. Başka bir ad dener misin? 🙂',
}

/** Collapses spaces and trims — what we store. */
export function cleanNickname(input: string) {
  return input.replace(/\s+/g, ' ').trim()
}

export function checkNickname(input: string): NicknameProblem | null {
  const value = cleanNickname(input)
  if ([...value].length < NICKNAME_MIN) return 'too-short'
  if ([...value].length > NICKNAME_MAX) return 'too-long'
  if (!NICKNAME_PATTERN.test(value)) return 'characters'

  const folded = fold(value)
  const joined = folded.replace(/[^a-z]/g, '')
  if (BLOCKED_ANYWHERE.some((root) => joined.includes(root))) return 'inappropriate'
  if (folded.split(/\s+/).some((word) => BLOCKED_WORDS.has(word))) return 'inappropriate'
  return null
}

/** Capitalises each word with Turkish rules: "ayşe nur" → "Ayşe Nur", "ilker" → "İlker". */
export function formatNickname(input: string) {
  return cleanNickname(input)
    .split(' ')
    .map((word) => word.charAt(0).toLocaleUpperCase('tr') + word.slice(1))
    .join(' ')
}
