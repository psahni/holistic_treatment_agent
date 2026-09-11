import { parseRemedyContent } from '../src/lib/parseRemedyContent';

describe('parseRemedyContent Utility', () => {
  test('returns isStructured: false for greeting or clarification messages', () => {
    const greeting = "Welcome to NatureCure AI. Please tell me about the main health challenge you are facing today.";
    const result = parseRemedyContent(greeting);
    expect(result.isStructured).toBe(false);
    expect(result.rawContent).toBe(greeting);
  });

  test('returns isStructured: false for vague query clarifications', () => {
    const clarification = "Could you please clarify where the pain is located and how long you have had it?";
    const result = parseRemedyContent(clarification);
    expect(result.isStructured).toBe(false);
  });

  test('correctly parses structured remedy content into bento cards', () => {
    const remedyText = `
Here are instant Nature Cure remedies for your acid reflux:

🌿 **Instant Nature Cure Remedies**:
- CCF Tea: Boil 1 tsp cumin, coriander, and fennel seeds in 500ml water.
- Drink ash gourd juice in the morning on an empty stomach.

💧 **Hydrotherapy**:
- Cold wet pack on abdomen for 15 mins post-dinner to ease digestive fire.

🧘 **Mind & Breathwork**:
- Sheetali cooling breath: 5 mins slow breathing through curled tongue.

⚠️ **Safety & Red Flags**:
- Avoid fried food and immediate post-meal reclining. Consult doctor if severe chest pain occurs.
    `;

    const result = parseRemedyContent(remedyText);
    expect(result.isStructured).toBe(true);
    expect(result.elements.length).toBeGreaterThan(0);
    expect(result.kitchen.title).toBeDefined();
    expect(result.hydrotherapy.title).toBeDefined();
    expect(result.breath.title).toBeDefined();
    expect(result.safety).toContain('Avoid fried food');
  });
});
