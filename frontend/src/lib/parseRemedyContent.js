import { getRemedyImage, detectElements } from './remedyAssets';

/**
 * Strips conversational markdown noise, bullet markers, and greetings.
 */
function cleanItemText(raw) {
  return raw
    .replace(/^[0-9]+[.)]\s*|^[-*•]\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/^hello again[!,.]?\s*/i, '')
    .replace(/^certainly[!,.]?\s*/i, '')
    .replace(/^here are some.*?:/i, '')
    .replace(/^instant nature cure remedies:?/i, '')
    .trim();
}

/**
 * Formats section items into a clean title and distinct, non-redundant instruction steps.
 */
function processSectionItems(items, defaultTitle) {
  if (!items || items.length === 0) {
    return {
      title: defaultTitle,
      steps: ['Apply consistently as a daily restorative practice.']
    };
  }

  const first = items[0];
  let title = defaultTitle;
  let cleanSteps = [];

  // If first item contains "Title: Description" pattern
  if (first.includes(':') && first.indexOf(':') < 40) {
    const parts = first.split(':');
    const potentialTitle = parts[0].trim();
    if (potentialTitle.length >= 3 && potentialTitle.length <= 35) {
      title = potentialTitle;
      const remainder = parts.slice(1).join(':').trim();
      if (remainder.length > 5) {
        cleanSteps.push(remainder);
      }
    } else {
      cleanSteps.push(first);
    }
  } else if (first.length <= 32 && !first.endsWith('.')) {
    title = first;
  } else {
    // It's a sentence/paragraph, so keep default clean title and put the text in steps
    cleanSteps.push(first);
  }

  // Process subsequent items
  for (let i = 1; i < items.length; i++) {
    let item = items[i];
    // Strip redundant title prefixes like "Hydration and Diet: ..."
    if (item.toLowerCase().startsWith(title.toLowerCase() + ':')) {
      item = item.substring(title.length + 1).trim();
    }
    // Filter conversational filler
    if (
      item.toLowerCase().includes('keeping the mind active') &&
      items.length > 2
    ) {
      continue;
    }
    if (item.length > 4) {
      cleanSteps.push(item);
    }
  }

  // Ensure steps has content
  if (cleanSteps.length === 0) {
    const fallbackText = first.replace(title, '').replace(/^[:\s-]+/, '').trim();
    cleanSteps.push(fallbackText || first);
  }

  return { title, steps: cleanSteps.slice(0, 3) };
}

/**
 * Parses an assistant message to check if it contains structured Naturopathic remedies.
 * Returns structured card data if remedy patterns are detected;
 * otherwise returns { isStructured: false, rawContent: content } to render normal markdown.
 */
export function parseRemedyContent(content) {
  if (!content || typeof content !== 'string') {
    return { isStructured: false, rawContent: '' };
  }

  const lower = content.toLowerCase();

  // Markers that indicate remedy advice is present
  const hasRemedyKeywords = 
    lower.includes('instant nature cure remedies') ||
    lower.includes('nature cure remedies') ||
    lower.includes('kitchen pharmacy') ||
    lower.includes('hydrotherapy') ||
    lower.includes('diet therapy') ||
    (lower.includes('remed') && (lower.includes('tea') || lower.includes('pack') || lower.includes('breath')));

  // Markers that indicate it's purely a clarification, greeting, or intake question
  const isGreetingOrClarification = 
    (lower.includes('could you please clarify') || lower.includes('may i know your age') || lower.includes('welcome to naturecure')) &&
    !hasRemedyKeywords;

  if (!hasRemedyKeywords || isGreetingOrClarification) {
    return { isStructured: false, rawContent: content };
  }

  // Detect active Naturopathy elements (💧 Water, 🔥 Fire, etc.)
  const elements = detectElements(content);

  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

  let kitchenItems = [];
  let hydrotherapyItems = [];
  let breathItems = [];
  let safetyItems = [];

  let currentSection = 'kitchen';

  for (const line of lines) {
    const lLower = line.toLowerCase();
    
    // Ignore pure section headers
    if (
      lLower === 'instant nature cure remedies:' ||
      lLower === 'remedies:' ||
      lLower.startsWith('## ') ||
      lLower.startsWith('### ')
    ) {
      continue;
    }

    if (lLower.includes('safety') || lLower.includes('red flag') || lLower.includes('caution') || lLower.includes('warning') || lLower.includes('⚠️')) {
      currentSection = 'safety';
      continue;
    }
    if (lLower.includes('hydrotherapy') || lLower.includes('pack') || lLower.includes('bath') || lLower.includes('compress') || lLower.includes('steam')) {
      currentSection = 'hydrotherapy';
    } else if (lLower.includes('pranayama') || lLower.includes('breath') || lLower.includes('mind') || lLower.includes('yoga') || lLower.includes('rest') || lLower.includes('sheetali')) {
      currentSection = 'breath';
    } else if (lLower.includes('kitchen') || lLower.includes('tea') || lLower.includes('diet') || lLower.includes('drink') || lLower.includes('juice') || lLower.includes('infusion')) {
      currentSection = 'kitchen';
    }

    const cleanLine = cleanItemText(line);
    if (!cleanLine || cleanLine.length < 4) continue;

    if (currentSection === 'safety') {
      safetyItems.push(cleanLine);
    } else if (currentSection === 'hydrotherapy') {
      hydrotherapyItems.push(cleanLine);
    } else if (currentSection === 'breath') {
      breathItems.push(cleanLine);
    } else {
      kitchenItems.push(cleanLine);
    }
  }

  // Distribute items if one category grabbed all
  if (hydrotherapyItems.length === 0 && kitchenItems.length > 2) {
    const hydroCandidates = kitchenItems.filter(item => {
      const it = item.toLowerCase();
      return it.includes('water') || it.includes('pack') || it.includes('bath') || it.includes('compress') || it.includes('steam');
    });
    if (hydroCandidates.length > 0) {
      hydrotherapyItems = hydroCandidates;
      kitchenItems = kitchenItems.filter(item => !hydroCandidates.includes(item));
    }
  }

  if (breathItems.length === 0 && kitchenItems.length > 2) {
    const breathCandidates = kitchenItems.filter(item => {
      const it = item.toLowerCase();
      return it.includes('breath') || it.includes('pranayama') || it.includes('walk') || it.includes('stress') || it.includes('sleep') || it.includes('mind');
    });
    if (breathCandidates.length > 0) {
      breathItems = breathCandidates;
      kitchenItems = kitchenItems.filter(item => !breathCandidates.includes(item));
    }
  }

  // Process sections into clean titles and steps
  const processedKitchen = processSectionItems(kitchenItems, 'Herbal Kitchen Infusion');
  const processedHydro = processSectionItems(hydrotherapyItems, 'Cold Wet Abdominal Pack');
  const processedBreath = processSectionItems(breathItems, 'Restorative Deep Breathing');

  // Extract timing/duration if mentioned
  const durationMatch = content.match(/(\d+[\s-]*(?:mins?|minutes?|hours?))/i);
  const durationBadge = durationMatch ? durationMatch[1] : '15 mins';

  const safetyAlert = safetyItems.length > 0
    ? safetyItems.join(' · ')
    : 'Avoid heavy or processed foods. If acute symptoms persist or worsen, consult a certified AYUSH practitioner.';

  return {
    isStructured: true,
    rawContent: content,
    elements,
    kitchen: {
      title: processedKitchen.title,
      steps: processedKitchen.steps,
      image: getRemedyImage(processedKitchen.title + ' ' + processedKitchen.steps.join(' '), 'kitchen')
    },
    hydrotherapy: {
      title: processedHydro.title,
      duration: durationBadge,
      steps: processedHydro.steps,
      image: getRemedyImage(processedHydro.title + ' ' + processedHydro.steps.join(' '), 'hydrotherapy')
    },
    breath: {
      title: processedBreath.title,
      steps: processedBreath.steps,
      image: getRemedyImage(processedBreath.title + ' ' + processedBreath.steps.join(' '), 'breath')
    },
    safety: safetyAlert
  };
}
