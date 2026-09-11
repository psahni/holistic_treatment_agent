import { getRemedyImage, detectElements } from './remedyAssets';

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
    (lower.includes('remed') && lower.includes('step'));

  // Markers that indicate it's purely a clarification, greeting, or intake question
  const isGreetingOrClarification = 
    (lower.includes('could you please clarify') || lower.includes('may i know your age') || lower.includes('welcome to naturecure')) &&
    !hasRemedyKeywords;

  if (!hasRemedyKeywords || isGreetingOrClarification) {
    return { isStructured: false, rawContent: content };
  }

  // Detect active Naturopathy elements (💧 Water, 🔥 Fire, etc.)
  const elements = detectElements(content);

  // Sections extraction using regex & line splitting
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

  let kitchenItems = [];
  let hydrotherapyItems = [];
  let breathItems = [];
  let safetyItems = [];

  let currentSection = 'general';

  for (const line of lines) {
    const lLower = line.toLowerCase();
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

    // Clean bullets
    const cleanLine = line.replace(/^[0-9]+[.)]\s*|^[-*•]\s*/, '').replace(/\*\*/g, '').trim();
    if (!cleanLine || cleanLine.length < 5) continue;

    if (currentSection === 'safety') {
      safetyItems.push(cleanLine);
    } else if (currentSection === 'hydrotherapy') {
      hydrotherapyItems.push(cleanLine);
    } else if (currentSection === 'breath') {
      breathItems.push(cleanLine);
    } else {
      // General remedies / kitchen
      kitchenItems.push(cleanLine);
    }
  }

  // Fallback: If kitchen items got all items and others are empty, distribute reasonably
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
      return it.includes('breath') || it.includes('pranayama') || it.includes('walk') || it.includes('stress') || it.includes('sleep');
    });
    if (breathCandidates.length > 0) {
      breathItems = breathCandidates;
      kitchenItems = kitchenItems.filter(item => !breathCandidates.includes(item));
    }
  }

  // Construct structured data objects
  const kitchenTitle = kitchenItems[0] ? kitchenItems[0].split(':')[0] : 'Herbal Kitchen Infusion';
  const kitchenSteps = kitchenItems.slice(0, 4);

  const hydroTitle = hydrotherapyItems[0] ? hydrotherapyItems[0].split(':')[0] : 'Cold Wet Abdominal Pack';
  const hydroSteps = hydrotherapyItems.slice(0, 3);

  // Extract timing/duration if mentioned (e.g., "15 mins", "10 minutes")
  const durationMatch = content.match(/(\d+[\s-]*(?:mins?|minutes?|hours?))/i);
  const durationBadge = durationMatch ? durationMatch[1] : '15 mins';

  const breathTitle = breathItems[0] ? breathItems[0].split(':')[0] : 'Restorative Deep Breathing';
  const breathSteps = breathItems.slice(0, 3);

  const safetyAlert = safetyItems.length > 0
    ? safetyItems.join(' · ')
    : 'Avoid heavy, greasy meals. If symptoms worsen or persist for more than 48 hours, consult a healthcare provider.';

  return {
    isStructured: true,
    rawContent: content,
    elements,
    kitchen: {
      title: kitchenTitle,
      steps: kitchenSteps,
      image: getRemedyImage(kitchenTitle + ' ' + kitchenSteps.join(' '), 'kitchen')
    },
    hydrotherapy: {
      title: hydroTitle,
      duration: durationBadge,
      steps: hydroSteps,
      image: getRemedyImage(hydroTitle + ' ' + hydroSteps.join(' '), 'hydrotherapy')
    },
    breath: {
      title: breathTitle,
      steps: breathSteps,
      image: getRemedyImage(breathTitle + ' ' + breathSteps.join(' '), 'breath')
    },
    safety: safetyAlert
  };
}
