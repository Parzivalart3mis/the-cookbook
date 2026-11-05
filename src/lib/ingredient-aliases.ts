/** Explicit equivalents only. Forms and named blends stay distinct. */
const GROUPS = [
  ['haldi', 'haldi powder', 'turmeric', 'turmeric powder', 'ground turmeric'],
  ['jeera', 'jira', 'cumin', 'cumin seeds', 'jeera seeds', 'whole cumin', 'sabut jeera'],
  ['jeera powder', 'cumin powder', 'ground cumin', 'ground jeera'],
  ['dhaniya powder', 'dhania powder', 'coriander powder', 'ground coriander'],
  ['hara dhaniya', 'hara dhania', 'fresh coriander', 'coriander leaves', 'cilantro', 'cilantro leaves'],
  ['lal mirch powder', 'lal mirchi powder', 'lal mircha powder', 'red chilli powder', 'red chili powder'],
  ['tej patta', 'tejpatta', 'bay leaf', 'bay leaves'],
  ['hing', 'heeng', 'asafoetida'],
  ['methi dana', 'methi seeds', 'fenugreek seeds'],
  ['kasuri methi', 'kasoori methi', 'dried fenugreek leaves'],
  ['besan', 'gram flour', 'chickpea flour'],
  ['sooji', 'suji', 'rava', 'semolina'],
  ['aata', 'atta', 'whole wheat flour', 'wholewheat flour'],
  ['dahi', 'curd', 'yogurt', 'yoghurt', 'plain yogurt', 'plain yoghurt'],
  ['chaas', 'chach', 'chhach', 'buttermilk'],
  ['kabuli chana', 'white chickpeas', 'chickpeas', 'chickpea', 'chole'],
  ['kala chana', 'black chickpeas', 'black chickpea'],
  ['toor dal', 'tuvar dal', 'arhar dal', 'split pigeon peas'],
] as const;

function normalized(value: string): string {
  return value.toLowerCase().replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
const keys = new Map<string, string>();
for (const group of GROUPS) for (const name of group) keys.set(normalized(name), group[0]);

export function ingredientAliasKey(value: string): string | undefined {
  // Do not strip fresh/raw/whole/powder: fresh turmeric is not haldi powder.
  return keys.get(normalized(value));
}
