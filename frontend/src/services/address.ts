export type AddressParts = {
  houseNo: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
};

export type AddressErrors = Partial<Record<keyof AddressParts, string>>;

export const EMPTY_ADDRESS: AddressParts = {
  houseNo: '',
  area: '',
  city: '',
  state: '',
  pincode: '',
};

const STATES = [
  'Andaman & Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra & Nagar Haveli and Daman & Diu',
  'Daman & Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu & Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

export const INDIAN_STATES: string[] = [...STATES];

/** Common abbreviations and older/official spellings, keyed by normalised token. */
const STATE_ALIASES: Record<string, string> = {
  ap: 'Andhra Pradesh',
  arunachal: 'Arunachal Pradesh',
  ar: 'Arunachal Pradesh',
  as: 'Assam',
  br: 'Bihar',
  ch: 'Chandigarh',
  chhattisgarh: 'Chhattisgarh',
  cg: 'Chhattisgarh',
  'dadra and nagar haveli and daman and diu': 'Dadra & Nagar Haveli and Daman & Diu',
  'daman and diu': 'Daman & Diu',
  'new delhi': 'Delhi',
  nct: 'Delhi',
  ndl: 'Delhi',
  dl: 'Delhi',
  gj: 'Gujarat',
  gujarat: 'Gujarat',
  hr: 'Haryana',
  haryana: 'Haryana',
  hp: 'Himachal Pradesh',
  jk: 'Jammu & Kashmir',
  'jammu and kashmir': 'Jammu & Kashmir',
  jhr: 'Jharkhand',
  jharkhand: 'Jharkhand',
  ka: 'Karnataka',
  karnataka: 'Karnataka',
  kl: 'Kerala',
  kerala: 'Kerala',
  mp: 'Madhya Pradesh',
  'madhya pradesh': 'Madhya Pradesh',
  mh: 'Maharashtra',
  maharashtra: 'Maharashtra',
  maha: 'Maharashtra',
  mn: 'Manipur',
  ml: 'Meghalaya',
  mz: 'Mizoram',
  nl: 'Nagaland',
  od: 'Odisha',
  orissa: 'Odisha',
  odisha: 'Odisha',
  py: 'Puducherry',
  pondicherry: 'Puducherry',
  puducherry: 'Puducherry',
  pb: 'Punjab',
  rj: 'Rajasthan',
  raj: 'Rajasthan',
  rajasthan: 'Rajasthan',
  sk: 'Sikkim',
  sikkim: 'Sikkim',
  tn: 'Tamil Nadu',
  tamilnadu: 'Tamil Nadu',
  'tamil nadu': 'Tamil Nadu',
  ts: 'Telangana',
  tg: 'Telangana',
  telangana: 'Telangana',
  tr: 'Tripura',
  tripura: 'Tripura',
  up: 'Uttar Pradesh',
  'uttar pradesh': 'Uttar Pradesh',
  uk: 'Uttarakhand',
  uttarakhand: 'Uttarakhand',
  'uttar khand': 'Uttarakhand',
  wb: 'West Bengal',
  'west bengal': 'West Bengal',
};

const STATE_BY_NAME = new Map<string, string>([
  ...STATES.map((s) => [normaliseStateToken(s), s] as const),
  ...Object.entries(STATE_ALIASES),
]);

const PIN_RE = /^\d{6}$/;
const HOUSE_NUMBER_RE = /^\d+[a-z]?(\s*[-/]\s*\d+[a-z]?)?$/i;
const HOUSE_WORD_RE =
  /\b(flat|house|hs|block|blk|tower|apartment|apt|plot|villa|door|residence|lodge|bunglow|bungalow)\b/i;

function normaliseStateToken(token: string): string {
  return token.toLowerCase().replace(/[.\s]+/g, ' ').trim();
}

function canonicalState(token: string): string {
  return STATE_BY_NAME.get(normaliseStateToken(token)) || '';
}

/**
 * A token that starts with a number, or names a building type, is almost
 * certainly the house/street line rather than a locality or city.
 */
function looksLikeHouseLine(token: string): boolean {
  const value = token.trim();
  return HOUSE_NUMBER_RE.test(value) || HOUSE_WORD_RE.test(value);
}

export function composeAddress(parts: AddressParts): string {
  return [parts.houseNo, parts.area, parts.city, parts.state, parts.pincode]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * Parse a stored `full_address` back into individual fields.
 *
 * Fields are identified by content rather than by position: pincode and state
 * are matched by shape and name, and the remaining tokens are read in the
 * order the address is composed (house, area, city). This keeps addresses that
 * omit the state or pincode from having their fields shifted into each other.
 */
export function splitAddress(full: string): AddressParts {
  const tokens = (full || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (tokens.length === 0) return { ...EMPTY_ADDRESS };

  let pincode = '';
  let state = '';
  const rest: string[] = [];

  for (const token of tokens) {
    if (!pincode && PIN_RE.test(token)) {
      pincode = token;
      continue;
    }
    if (!state) {
      const matched = canonicalState(token);
      if (matched) {
        state = matched;
        continue;
      }
    }
    rest.push(token);
  }

  const n = rest.length;
  if (n === 0) return { houseNo: '', area: '', city: '', state, pincode };

  if (n === 1) {
    return looksLikeHouseLine(rest[0])
      ? { houseNo: rest[0], area: '', city: '', state, pincode }
      : { houseNo: '', area: '', city: rest[0], state, pincode };
  }

  if (n === 2) {
    return looksLikeHouseLine(rest[0])
      ? { houseNo: rest[0], area: rest[1], city: '', state, pincode }
      : { houseNo: '', area: rest[0], city: rest[1], state, pincode };
  }

  return {
    houseNo: rest.slice(0, n - 2).join(', '),
    area: rest[n - 2],
    city: rest[n - 1],
    state,
    pincode,
  };
}

export function applyDetails(details: Record<string, string>): AddressParts {
  return {
    houseNo: [details.house_number, details.road].filter(Boolean).join(', '),
    area: details.suburb || details.neighbourhood || '',
    city: details.city || details.town || details.village || details.city_district || '',
    state: details.state || '',
    pincode: details.postcode || '',
  };
}

export function validateAddress(parts: AddressParts): AddressErrors {
  const errors: AddressErrors = {};
  if (!parts.houseNo.trim()) errors.houseNo = 'Enter the house or flat number';
  if (!parts.area.trim()) errors.area = 'Enter your area or locality';
  if (!parts.city.trim()) errors.city = 'Enter the city';
  if (!parts.state.trim()) errors.state = 'Enter the state';
  if (!parts.pincode.trim()) errors.pincode = 'Enter the pincode';
  else if (!/^\d{6}$/.test(parts.pincode.trim())) errors.pincode = 'Pincode must be 6 digits';
  return errors;
}

export function isAddressValid(parts: AddressParts): boolean {
  return Object.keys(validateAddress(parts)).length === 0;
}

/** Field labels in composition order, used for summaries and error lists. */
export const ADDRESS_FIELDS: { key: keyof AddressParts; label: string }[] = [
  { key: 'houseNo', label: 'House/Flat No' },
  { key: 'area', label: 'Area' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pincode', label: 'Pincode' },
];

/** Human-readable list of the fields still missing from an address. */
export function missingAddressFields(errors: AddressErrors): string[] {
  return ADDRESS_FIELDS.filter((f) => errors[f.key]).map((f) => f.label);
}
