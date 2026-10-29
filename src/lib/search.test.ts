import { describe, expect, it } from 'vitest';
import { didYouMean, distance, normalize, score } from './search';

describe('search', () => {
  it('ignores case, accents and punctuation', () => {
    expect(normalize('Adjoa’s Créations!')).toBe('adjoas creations');
  });

  it('needs every word of the query to match somewhere', () => {
    const fields = [['Tema Community Welding Centre', 3], ['Welding', 2], ['Tema', 2]] as [string, number][];
    expect(score('welding tema', fields)).toBeGreaterThan(0);
    expect(score('welding kasoa', fields)).toBe(0);
    expect(score('', fields)).toBe(1);
  });

  it('ranks name matches above description matches, and whole words above parts', () => {
    const inName = score('weld', [['Accra Welding', 3], ['Learn to cut metal', 1]]);
    const inBlurb = score('weld', [['Accra Metal Works', 3], ['Learn to weld metal', 1]]);
    expect(inName).toBeGreaterThan(inBlurb);
    expect(score('hair', [['Hair Academy', 2]])).toBeGreaterThan(score('hair', [['Hairdressing Academy', 2]]));
  });

  it('matches the start of a word, and the middle only for 3+ letters', () => {
    expect(score('tai', [['Tailoring', 2]])).toBeGreaterThan(0);
    expect(score('lor', [['Tailoring', 2]])).toBeGreaterThan(0);
    expect(score('lo', [['Tailoring', 2]])).toBe(0);
  });

  it('needs whole words (or plurals) in descriptions', () => {
    expect(score('soap', [['Starter Toolkit', 3], ['Gloves and a soapstone', 1]])).toBe(0);
    expect(score('soaps', [['Herbal Soap', 3]])).toBeGreaterThan(0);
    expect(score('braid', [['Learn braids and weaves', 1]])).toBeGreaterThan(0);
  });

  it('suggests a spelling from the words in the data', () => {
    const vocab = ['Welding', 'Tema', 'Tailoring', 'Kaneshie'];
    expect(distance('weldng', 'welding')).toBe(1);
    expect(didYouMean('weldng tem', vocab)).toBe('welding tem'); // "tem" is a prefix of "tema", so it's left alone
    expect(didYouMean('kanesh', vocab)).toBeNull();
    expect(didYouMean('tayloring', vocab)).toBe('tailoring');
    expect(didYouMean('xyzzy', vocab)).toBeNull();
  });
});
