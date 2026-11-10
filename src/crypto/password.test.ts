import { describe, expect, it } from 'vitest';
import type { GeneratorOptions } from './password';
import {
  estimateStrength,
  generatePassword,
  GENERATOR_DEFAULTS,
  generatorEntropyBits,
  randomInt,
} from './password';

describe('randomInt', () => {
  it('stays within the bound', () => {
    for (let index = 0; index < 2000; index += 1) {
      const value = randomInt(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });

  it('reaches every value', () => {
    const seen = new Set<number>();
    for (let index = 0; index < 2000; index += 1) seen.add(randomInt(7));
    expect(seen.size).toBe(7);
  });

  it('rejects an invalid bound', () => {
    expect(() => randomInt(0)).toThrow(RangeError);
    expect(() => randomInt(1.5)).toThrow(RangeError);
  });
});

describe('generatePassword', () => {
  it('has the requested length', () => {
    expect(generatePassword({ ...GENERATOR_DEFAULTS, length: 32 })).toHaveLength(32);
  });

  it('contains every selected type of character', () => {
    for (let index = 0; index < 200; index += 1) {
      const password = generatePassword({ ...GENERATOR_DEFAULTS, length: 8 });
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[^a-zA-Z0-9]/);
    }
  });

  it('contains only the selected types of character', () => {
    const options: GeneratorOptions = {
      length: 40,
      lowercase: false,
      uppercase: false,
      digits: true,
      symbols: false,
      avoidAmbiguous: false,
    };
    expect(generatePassword(options)).toMatch(/^[0-9]{40}$/);
  });

  it('leaves out ambiguous characters when asked', () => {
    for (let index = 0; index < 200; index += 1) {
      const password = generatePassword({ ...GENERATOR_DEFAULTS, avoidAmbiguous: true });
      expect(password).not.toMatch(/[lI1O0o]/);
    }
  });

  it('does not repeat itself', () => {
    const passwords = new Set<string>();
    for (let index = 0; index < 100; index += 1) passwords.add(generatePassword(GENERATOR_DEFAULTS));
    expect(passwords.size).toBe(100);
  });

  it('refuses to generate from nothing', () => {
    expect(() =>
      generatePassword({
        ...GENERATOR_DEFAULTS,
        lowercase: false,
        uppercase: false,
        digits: false,
        symbols: false,
      }),
    ).toThrow('at least one');
  });
});

describe('generatorEntropyBits', () => {
  it('is length times log2 of the pool size', () => {
    const digitsOnly: GeneratorOptions = {
      length: 10,
      lowercase: false,
      uppercase: false,
      digits: true,
      symbols: false,
      avoidAmbiguous: false,
    };
    expect(generatorEntropyBits(digitsOnly)).toBeCloseTo(10 * Math.log2(10));
  });
});

describe('estimateStrength', () => {
  it('scores an empty password as very weak', () => {
    expect(estimateStrength('')).toEqual({ score: 0, label: 'Very weak', bits: 0 });
  });

  it('is not impressed by repetition or runs', () => {
    expect(estimateStrength('aaaaaaaaaaaaaaaaaaaa').score).toBe(0);
    expect(estimateStrength('12345678901234567890').score).toBeLessThanOrEqual(1);
    expect(estimateStrength('abcdefghijklmnop').score).toBeLessThanOrEqual(1);
  });

  it('scores short passwords low and long varied ones high', () => {
    expect(estimateStrength('Tr0ub4').score).toBeLessThanOrEqual(1);
    expect(estimateStrength('q7#Lw9!xZp2$Vm8&Rt4').score).toBe(4);
  });

  it('scores a generated password as strong', () => {
    expect(estimateStrength(generatePassword(GENERATOR_DEFAULTS)).score).toBe(4);
  });
});
