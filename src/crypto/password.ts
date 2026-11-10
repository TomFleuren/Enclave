export interface GeneratorOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
  /** Leaves out characters that are easy to confuse, such as l, I, 1, O and 0. */
  avoidAmbiguous: boolean;
}

export const GENERATOR_DEFAULTS: GeneratorOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: false,
};

export const GENERATOR_MIN_LENGTH = 8;
export const GENERATOR_MAX_LENGTH = 64;

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?';
const AMBIGUOUS = new Set('lI1O0o');

function characterSets(options: GeneratorOptions): string[] {
  const sets: string[] = [];
  if (options.lowercase) sets.push(LOWERCASE);
  if (options.uppercase) sets.push(UPPERCASE);
  if (options.digits) sets.push(DIGITS);
  if (options.symbols) sets.push(SYMBOLS);

  if (!options.avoidAmbiguous) return sets;
  return sets.map((set) => [...set].filter((character) => !AMBIGUOUS.has(character)).join(''));
}

/**
 * A uniformly distributed integer in [0, bound), from the platform CSPRNG.
 *
 * Values that would make the modulo uneven are thrown away and redrawn,
 * rather than accepting a small bias towards the low end of the range.
 */
export function randomInt(bound: number): number {
  if (!Number.isInteger(bound) || bound < 1 || bound > 0x1_0000_0000) {
    throw new RangeError('bound must be an integer between 1 and 2^32');
  }
  const limit = Math.floor(0x1_0000_0000 / bound) * bound;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0]!;
    if (value < limit) return value % bound;
  }
}

/**
 * Generates a random password that contains at least one character from every
 * selected set.
 *
 * Candidates are drawn uniformly from the whole pool and redrawn until one
 * satisfies that rule, so every valid password is equally likely. Patching a
 * missing character into a fixed position would not have that property.
 */
export function generatePassword(options: GeneratorOptions): string {
  const sets = characterSets(options);
  if (sets.length === 0) {
    throw new Error('Select at least one type of character.');
  }
  const length = Math.min(Math.max(Math.trunc(options.length), sets.length), GENERATOR_MAX_LENGTH);
  const pool = sets.join('');

  for (;;) {
    let candidate = '';
    for (let index = 0; index < length; index += 1) {
      candidate += pool[randomInt(pool.length)];
    }
    if (sets.every((set) => [...candidate].some((character) => set.includes(character)))) {
      return candidate;
    }
  }
}

/**
 * Entropy, in bits, of a password produced by `generatePassword`.
 *
 * This is the figure for a free draw from the pool. Requiring one character
 * from each set rules out a small share of candidates, so the true value is a
 * fraction of a bit lower at the lengths the generator allows.
 */
export function generatorEntropyBits(options: GeneratorOptions): number {
  const poolSize = characterSets(options).join('').length;
  if (poolSize === 0) return 0;
  return options.length * Math.log2(poolSize);
}

export interface StrengthEstimate {
  /** 0 (very weak) to 4 (strong). */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  bits: number;
}

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'] as const;

/**
 * A rough strength estimate for a password a person typed.
 *
 * It measures length and character variety and discounts repetition and
 * simple runs such as "aaaa" or "1234". It knows nothing about dictionary
 * words or leaked passwords, so treat the result as an upper bound: a common
 * phrase will score better here than it deserves.
 */
export function estimateStrength(password: string): StrengthEstimate {
  if (password.length === 0) {
    return { score: 0, label: STRENGTH_LABELS[0], bits: 0 };
  }

  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 33;

  // A character that repeats or continues a run from its predecessor adds
  // very little, so it only counts for a quarter.
  const characters = [...password];
  let effectiveLength = 0;
  characters.forEach((character, index) => {
    const previous = characters[index - 1];
    const step =
      previous === undefined ? Number.NaN : character.charCodeAt(0) - previous.charCodeAt(0);
    effectiveLength += step === 0 || Math.abs(step) === 1 ? 0.25 : 1;
  });

  // Few distinct characters means little variety, whatever the length.
  const distinct = new Set(characters).size;
  effectiveLength = Math.min(effectiveLength, distinct * 2);

  const bits = effectiveLength * Math.log2(poolSize);
  const score = bits < 30 ? 0 : bits < 45 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;

  return { score, label: STRENGTH_LABELS[score], bits };
}
