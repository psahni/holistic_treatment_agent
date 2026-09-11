/**
 * Holistic Naturopathy Asset Registry
 * Provides static image lookups, elemental mappings, and graceful category fallbacks.
 * 0ms latency, zero runtime AI bandwidth.
 */

export const ELEMENTS = [
  {
    id: 'water',
    name: 'Water',
    sanskrit: 'Jala',
    icon: '💧',
    image: '/images/remedies/elements/water.svg',
    keywords: ['hydrotherapy', 'water', 'pack', 'bath', 'compress', 'steam', 'hydration', 'wet sheet', 'flush']
  },
  {
    id: 'fire',
    name: 'Fire',
    sanskrit: 'Agni',
    icon: '🔥',
    image: '/images/remedies/elements/fire.svg',
    keywords: ['digestion', 'metabolism', 'sun', 'warmth', 'heat', 'agni', 'fever', 'acid', 'circulatory']
  },
  {
    id: 'air',
    name: 'Air',
    sanskrit: 'Vayu',
    icon: '🍃',
    image: '/images/remedies/elements/air.svg',
    keywords: ['pranayama', 'breath', 'breathing', 'vayu', 'nervous', 'anxiety', 'lungs', 'inhalation', 'oxygen']
  },
  {
    id: 'earth',
    name: 'Earth',
    sanskrit: 'Prithvi',
    icon: '🌍',
    image: '/images/remedies/elements/earth.svg',
    keywords: ['mud', 'diet', 'food', 'nutrition', 'clay', 'grounding', 'herbs', 'seed', 'vegetable', 'sprouts']
  },
  {
    id: 'space',
    name: 'Space',
    sanskrit: 'Akasha',
    icon: '🌌',
    image: '/images/remedies/elements/space.svg',
    keywords: ['fasting', 'rest', 'sleep', 'intermittent', 'quiet', 'meditation', 'akasha', 'detox', 'cleanse']
  }
];

const REMEDY_MAP = {
  // Kitchen Pharmacy
  'cumin': '/images/remedies/kitchen/ccf_tea.svg',
  'coriander': '/images/remedies/kitchen/ccf_tea.svg',
  'fennel': '/images/remedies/kitchen/ccf_tea.svg',
  'ccf': '/images/remedies/kitchen/ccf_tea.svg',
  'tea': '/images/remedies/kitchen/ccf_tea.svg',
  'ash gourd': '/images/remedies/kitchen/ash_gourd.svg',
  'petha': '/images/remedies/kitchen/ash_gourd.svg',
  'juice': '/images/remedies/kitchen/ash_gourd.svg',
  'alkaline': '/images/remedies/kitchen/ash_gourd.svg',
  'ginger': '/images/remedies/kitchen/ginger_infusion.svg',
  'lemon': '/images/remedies/kitchen/ginger_infusion.svg',
  'triphala': '/images/remedies/kitchen/default_tea.svg',
  'turmeric': '/images/remedies/kitchen/default_tea.svg',

  // Hydrotherapy
  'cold pack': '/images/remedies/hydrotherapy/cold_pack.svg',
  'abdominal pack': '/images/remedies/hydrotherapy/cold_pack.svg',
  'wet pack': '/images/remedies/hydrotherapy/cold_pack.svg',
  'compress': '/images/remedies/hydrotherapy/cold_pack.svg',
  'ice': '/images/remedies/hydrotherapy/cold_pack.svg',
  'steam': '/images/remedies/hydrotherapy/steam_inhalation.svg',
  'inhalation': '/images/remedies/hydrotherapy/steam_inhalation.svg',
  'vapour': '/images/remedies/hydrotherapy/steam_inhalation.svg',
  'foot bath': '/images/remedies/hydrotherapy/foot_bath.svg',
  'foot soak': '/images/remedies/hydrotherapy/foot_bath.svg',
  'hip bath': '/images/remedies/hydrotherapy/default_hydro.svg',
  'hydrotherapy': '/images/remedies/hydrotherapy/default_hydro.svg',

  // Breath & Mind
  'sheetali': '/images/remedies/breath_mind/sheetali.svg',
  'cooling breath': '/images/remedies/breath_mind/sheetali.svg',
  'sitkari': '/images/remedies/breath_mind/sheetali.svg',
  'pranayama': '/images/remedies/breath_mind/pranayama.svg',
  'anulom': '/images/remedies/breath_mind/pranayama.svg',
  'alternate nostril': '/images/remedies/breath_mind/pranayama.svg',
  'box breathing': '/images/remedies/breath_mind/pranayama.svg',
  '4-7-8': '/images/remedies/breath_mind/pranayama.svg',
  'breathwork': '/images/remedies/breath_mind/pranayama.svg',
  'meditation': '/images/remedies/breath_mind/default_meditation.svg',
  'relaxation': '/images/remedies/breath_mind/default_meditation.svg',
  'yoga': '/images/remedies/breath_mind/default_meditation.svg',
  'asana': '/images/remedies/breath_mind/default_meditation.svg',
  'shavasana': '/images/remedies/breath_mind/default_meditation.svg'
};

export const CATEGORY_FALLBACKS = {
  kitchen: '/images/remedies/kitchen/default_tea.svg',
  hydrotherapy: '/images/remedies/hydrotherapy/default_hydro.svg',
  breath: '/images/remedies/breath_mind/default_meditation.svg',
  general: '/images/remedies/kitchen/default_tea.svg'
};

/**
 * Resolves the best-matched local image URL for a given title or description.
 * Falls back to category default if no exact keyword is matched.
 */
export function getRemedyImage(titleOrText, category = 'kitchen') {
  if (!titleOrText) return CATEGORY_FALLBACKS[category] || CATEGORY_FALLBACKS.general;
  const lower = titleOrText.toLowerCase();

  for (const [keyword, path] of Object.entries(REMEDY_MAP)) {
    if (lower.includes(keyword)) {
      return path;
    }
  }

  return CATEGORY_FALLBACKS[category] || CATEGORY_FALLBACKS.general;
}

/**
 * Detects which of the 5 Nature Cure elements are active based on the remedy content.
 * Guarantees at least 1-2 elements are returned for visual richness.
 */
export function detectElements(fullText) {
  if (!fullText) return [ELEMENTS[0], ELEMENTS[1]];
  const lower = fullText.toLowerCase();

  const matched = ELEMENTS.filter(elem =>
    elem.keywords.some(k => lower.includes(k))
  );

  // Fallback if none matched
  if (matched.length === 0) {
    return [ELEMENTS[0], ELEMENTS[1]]; // Water & Fire by default
  }

  return matched.slice(0, 3); // Max 3 elements displayed in header
}
