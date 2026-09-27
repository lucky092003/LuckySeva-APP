import { describe, expect, it } from 'vitest';
import {
  EMPTY_ADDRESS,
  applyDetails,
  composeAddress,
  isAddressValid,
  splitAddress,
  validateAddress,
} from './address';

describe('splitAddress', () => {
  it('reads a fully populated address', () => {
    expect(splitAddress('12, Baner, Pune, Maharashtra, 411045')).toEqual({
      houseNo: '12',
      area: 'Baner',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411045',
    });
  });

  it('does not shift fields when the state is missing', () => {
    // The old parser popped the last four tokens positionally, so this used to
    // come back as area: "12", city: "Baner", state: "Pune".
    expect(splitAddress('12, Baner, Pune')).toEqual({
      houseNo: '12',
      area: 'Baner',
      city: 'Pune',
      state: '',
      pincode: '',
    });
  });

  it('does not shift fields when the pincode is missing', () => {
    expect(splitAddress('Flat 101, Baner, Pune, Maharashtra')).toEqual({
      houseNo: 'Flat 101',
      area: 'Baner',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '',
    });
  });

  it('keeps a comma separated house line together', () => {
    expect(splitAddress('Flat 101, Tower B, Baner, Pune, Maharashtra, 411045')).toEqual({
      houseNo: 'Flat 101, Tower B',
      area: 'Baner',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411045',
    });
  });

  it('recognises state abbreviations and old spellings', () => {
    expect(splitAddress('12, Baner, Pune, MH, 411045').state).toBe('Maharashtra');
    expect(splitAddress('12, Bhubaneswar, Orissa, 751001').state).toBe('Odisha');
    expect(splitAddress('12, Gandhinagar, Gujarat, 382030').state).toBe('Gujarat');
  });

  it('is case and whitespace insensitive', () => {
    expect(splitAddress('  12 ,  baner ,  PUNE ,  maharashtra ,  411045 ')).toEqual({
      houseNo: '12',
      area: 'baner',
      city: 'PUNE',
      state: 'Maharashtra',
      pincode: '411045',
    });
  });

  it('guesses the right field for one or two remaining tokens', () => {
    expect(splitAddress('Pune')).toMatchObject({ houseNo: '', area: '', city: 'Pune' });
    expect(splitAddress('12')).toMatchObject({ houseNo: '12', area: '', city: '' });
    expect(splitAddress('12, Baner')).toMatchObject({ houseNo: '12', area: 'Baner', city: '' });
    expect(splitAddress('Baner, Pune')).toMatchObject({ houseNo: '', area: 'Baner', city: 'Pune' });
  });

  it('round trips a composed address', () => {
    const parts = { houseNo: '12', area: 'Baner', city: 'Pune', state: 'Maharashtra', pincode: '411045' };
    expect(splitAddress(composeAddress(parts))).toEqual(parts);
  });

  it('handles empty and junk input', () => {
    expect(splitAddress('')).toEqual(EMPTY_ADDRESS);
    expect(splitAddress('  ,  , ')).toEqual(EMPTY_ADDRESS);
  });

  it('only treats a standalone 6 digit token as a pincode', () => {
    expect(splitAddress('12, Baner, Pune, 411').pincode).toBe('');
  });
});

describe('composeAddress', () => {
  it('joins fields in order and skips blanks', () => {
    expect(composeAddress({ houseNo: '12', area: '', city: 'Pune', state: '', pincode: '411045' })).toBe(
      '12, Pune, 411045'
    );
  });

  it('trims stray whitespace', () => {
    expect(composeAddress({ houseNo: ' 12 ', area: ' Baner', city: '', state: '', pincode: '' })).toBe('12, Baner');
  });
});

describe('validateAddress', () => {
  const valid = { houseNo: '12', area: 'Baner', city: 'Pune', state: 'Maharashtra', pincode: '411045' };

  it('accepts a complete address', () => {
    expect(validateAddress(valid)).toEqual({});
    expect(isAddressValid(valid)).toBe(true);
  });

  it('requires every field', () => {
    const errors = validateAddress(EMPTY_ADDRESS);
    expect(Object.keys(errors).sort()).toEqual(['area', 'city', 'houseNo', 'pincode', 'state']);
    expect(isAddressValid(EMPTY_ADDRESS)).toBe(false);
  });

  it('rejects a pincode that is not 6 digits', () => {
    expect(validateAddress({ ...valid, pincode: '411' }).pincode).toMatch(/6 digits/);
    expect(validateAddress({ ...valid, pincode: '4110456' }).pincode).toMatch(/6 digits/);
    expect(validateAddress({ ...valid, pincode: '41104a' }).pincode).toMatch(/6 digits/);
  });

  it('treats whitespace-only values as missing', () => {
    expect(validateAddress({ ...valid, city: '   ' }).city).toBeTruthy();
  });
});

describe('applyDetails', () => {
  it('maps reverse geocoder fields onto the form', () => {
    expect(
      applyDetails({
        house_number: '12',
        road: 'MG Road',
        suburb: 'Baner',
        city: 'Pune',
        state: 'Maharashtra',
        postcode: '411045',
      })
    ).toEqual({ houseNo: '12, MG Road', area: 'Baner', city: 'Pune', state: 'Maharashtra', pincode: '411045' });
  });

  it('falls back through the locality aliases', () => {
    expect(applyDetails({ city_district: 'Pune', state: 'Maharashtra' }).city).toBe('Pune');
    expect(applyDetails({ village: 'Shivajinagar' }).city).toBe('Shivajinagar');
  });

  it('returns empty strings for an unknown location', () => {
    expect(applyDetails({})).toEqual(EMPTY_ADDRESS);
  });
});
