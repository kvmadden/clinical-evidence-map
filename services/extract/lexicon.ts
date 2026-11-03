// Offline vocabulary for the reader. Real drug, condition and lab names, used
// against fictional rules. A word outside this vocabulary is never guessed into
// a drug or condition. It can still make a criterion "needs review" when it
// sits where a drug or value belongs.

export interface Product {
  name: string
  route: "subcutaneous" | "oral" | "intravenous"
  // Use or indication family the product is labeled for, when it matters.
  use?: string
}
export interface DrugEntry {
  generic: string
  brands: string[]
  abbreviations: string[]
  drugClass: string
  // Marketed strengths or labeled doses in mg, for plausibility checks on
  // requested and listed doses. An OCR misread such as 148 mg evolocumab is
  // not a marketed dose and goes to review.
  doses?: number[]
  products?: Product[]
}
export const DRUGS: DrugEntry[] = [
  {
    generic: "semaglutide",
    brands: ["ozempic", "wegovy", "rybelsus"],
    abbreviations: [],
    drugClass: "glp1",
    doses: [0.25, 0.5, 1, 1.7, 2, 2.4, 3, 7, 14],
    products: [
      { name: "ozempic", route: "subcutaneous", use: "type 2 diabetes" },
      { name: "wegovy", route: "subcutaneous", use: "weight management" },
      { name: "rybelsus", route: "oral", use: "type 2 diabetes" },
    ],
  },
  {
    generic: "dulaglutide",
    brands: ["trulicity"],
    abbreviations: [],
    drugClass: "glp1",
  },
  {
    generic: "liraglutide",
    brands: ["victoza", "saxenda"],
    abbreviations: [],
    drugClass: "glp1",
  },
  {
    generic: "tirzepatide",
    brands: ["mounjaro", "zepbound"],
    abbreviations: [],
    drugClass: "glp1",
  },
  {
    generic: "adalimumab",
    brands: ["humira", "hadlima", "hyrimoz", "cyltezo", "amjevita", "yusimry"],
    abbreviations: [],
    drugClass: "tnf",
    doses: [10, 20, 40, 80],
  },
  {
    generic: "evolocumab",
    brands: ["repatha"],
    abbreviations: [],
    drugClass: "pcsk9",
    doses: [140, 420],
  },
  {
    generic: "alirocumab",
    brands: ["praluent"],
    abbreviations: [],
    drugClass: "pcsk9",
    doses: [75, 150, 300],
  },
  {
    generic: "metformin",
    brands: ["glucophage", "glumetza", "fortamet", "riomet"],
    abbreviations: [],
    drugClass: "biguanide",
    doses: [500, 750, 850, 1000, 1500, 2000, 2550],
  },
  {
    generic: "methotrexate",
    brands: ["trexall", "otrexup", "rasuvo", "xatmep", "reditrex"],
    abbreviations: ["mtx"],
    drugClass: "antimetabolite",
  },
  {
    generic: "atorvastatin",
    brands: ["lipitor"],
    abbreviations: ["atorva"],
    drugClass: "statin",
    doses: [10, 20, 40, 80],
  },
  {
    generic: "rosuvastatin",
    brands: ["crestor"],
    abbreviations: ["rosuva"],
    drugClass: "statin",
    doses: [5, 10, 20, 40],
  },
  {
    generic: "simvastatin",
    brands: ["zocor"],
    abbreviations: [],
    drugClass: "statin",
  },
  {
    generic: "pravastatin",
    brands: ["pravachol"],
    abbreviations: [],
    drugClass: "statin",
  },
  {
    generic: "lovastatin",
    brands: ["mevacor", "altoprev"],
    abbreviations: [],
    drugClass: "statin",
  },
  {
    generic: "pitavastatin",
    brands: ["livalo", "zypitamag"],
    abbreviations: [],
    drugClass: "statin",
  },
  {
    generic: "fluvastatin",
    brands: ["lescol"],
    abbreviations: [],
    drugClass: "statin",
  },
  {
    generic: "ezetimibe",
    brands: ["zetia"],
    abbreviations: [],
    drugClass: "cholesterol-absorption",
  },
  {
    generic: "glipizide",
    brands: ["glucotrol"],
    abbreviations: [],
    drugClass: "sulfonylurea",
  },
  {
    generic: "glyburide",
    brands: ["diabeta", "glynase"],
    abbreviations: [],
    drugClass: "sulfonylurea",
  },
  {
    generic: "glimepiride",
    brands: ["amaryl"],
    abbreviations: [],
    drugClass: "sulfonylurea",
  },
  {
    generic: "sitagliptin",
    brands: ["januvia"],
    abbreviations: [],
    drugClass: "dpp4",
  },
  {
    generic: "empagliflozin",
    brands: ["jardiance"],
    abbreviations: [],
    drugClass: "sglt2",
  },
  {
    generic: "dapagliflozin",
    brands: ["farxiga"],
    abbreviations: [],
    drugClass: "sglt2",
  },
  {
    generic: "pioglitazone",
    brands: ["actos"],
    abbreviations: [],
    drugClass: "tzd",
  },
  {
    generic: "insulin glargine",
    brands: ["lantus", "basaglar", "toujeo", "semglee"],
    abbreviations: [],
    drugClass: "insulin",
  },
  {
    generic: "apremilast",
    brands: ["otezla"],
    abbreviations: [],
    drugClass: "pde4",
  },
  {
    generic: "cyclosporine",
    brands: ["neoral", "sandimmune", "gengraf"],
    abbreviations: [],
    drugClass: "calcineurin",
  },
  {
    generic: "acitretin",
    brands: ["soriatane"],
    abbreviations: [],
    drugClass: "retinoid",
  },
  {
    generic: "clobetasol",
    brands: ["temovate"],
    abbreviations: [],
    drugClass: "topical-steroid",
  },
  {
    generic: "naltrexone",
    brands: ["trexan", "revia"],
    abbreviations: [],
    drugClass: "opioid-antagonist",
  },
  {
    generic: "cholestyramine",
    brands: ["questran", "prevalite"],
    abbreviations: [],
    drugClass: "bile-acid",
  },
  {
    generic: "doxycycline",
    brands: ["vibramycin"],
    abbreviations: [],
    drugClass: "tetracycline",
  },
  {
    generic: "lisinopril",
    brands: ["zestril", "prinivil"],
    abbreviations: [],
    drugClass: "ace-inhibitor",
  },
  {
    generic: "metoprolol",
    brands: ["lopressor", "toprol"],
    abbreviations: [],
    drugClass: "beta-blocker",
  },
]
export const STATINS = DRUGS.filter((d) => d.drugClass === "statin").map(
  (d) => d.generic,
)

// Names that sit one or two letters from a different drug. A pharmacist
// clarifies these instead of accepting either reading. This list is a small
// heuristic, not a complete look-alike table.
export const LOOK_ALIKES: Record<string, string> = {
  trexan: "trexall",
}

// Words used to correct small misspellings of condition names. Words of seven
// or more letters are corrected, and only to a single nearest entry.
export const CLINICAL_WORDS = [
  "diabetes",
  "mellitus",
  "psoriasis",
  "plaque",
  "moderate",
  "severe",
  "atherosclerotic",
  "cardiovascular",
  "disease",
  "coronary",
  "artery",
  "myocardial",
  "infarction",
  "hyperlipidemia",
  "prediabetes",
  "obesity",
  "psoriatic",
  "arthritis",
  "hidradenitis",
  "suppurativa",
  "hypertension",
  "established",
]

export interface ConditionEntry {
  value: string
  // The criteria family the condition belongs to, if any.
  family?: "t2dm" | "psoriasis" | "ascvd"
  patterns: RegExp[]
  // ICD-10-CM code prefixes a pharmacist reads as this condition.
  icd?: RegExp
}
// Order matters: specific phrases come before general ones.
export const CONDITIONS: ConditionEntry[] = [
  {
    value: "prediabetes",
    patterns: [/\bpre-?diabetes\b/i, /\bimpaired fasting glucose\b/i],
    icd: /^R73\.0/,
  },
  {
    value: "type 2 diabetes mellitus",
    family: "t2dm",
    patterns: [
      /\btype\s*(?:2|ii|two)\s+diabetes(?:\s+mellitus)?\b/i,
      /\bdiabetes\s+mellitus,?\s+type\s*(?:2|ii|two)\b/i,
      /\btype\s*(?:2|ii)\s+dm\b/i,
      /\bt2dm\b/i,
      /\bt2d\b/i,
      /\bdm\s*(?:2|ii)\b/i,
      /\bdm\s+type\s*(?:2|ii)\b/i,
      /\bniddm\b/i,
    ],
    icd: /^E11(?:\.|$)/,
  },
  {
    value: "type 1 diabetes mellitus",
    patterns: [
      /\btype\s*(?:1|i|one)\s+diabetes\b/i,
      /\bt1dm\b/i,
      /\bdm\s*1\b/i,
    ],
    icd: /^E10(?:\.|$)/,
  },
  {
    value: "diabetes, type not stated",
    family: "t2dm",
    patterns: [/\bdiabetes(?:\s+mellitus)?\b/i, /\bDM\b/],
    icd: /^E1[134](?:\.|$)/,
  },
  {
    value: "obesity",
    patterns: [
      /\bobesity\b/i,
      /\bobese\b/i,
      /\boverweight\b/i,
      /\bweight\s+(?:loss|reduction|management)\b/i,
      /\bappetite\s+suppression\b/i,
    ],
    icd: /^E66(?:\.|$)/,
  },
  {
    value: "moderate-to-severe plaque psoriasis",
    family: "psoriasis",
    patterns: [
      /\b(?<!mild[- ]to[- ])(?<!mild[- ])(?:moderate|mod)(?:(?:\s*(?:-|–|to|\/)\s*)+|\s+)(?:severe\s+|sev\s+)?(?:chronic\s+)?plaque\s+psoriasis\b/i,
      /\b(?<!mild[- ]to[- ])(?:moderate|mod)\s*[-/]\s*(?:severe|sev)\s+(?:chronic\s+)?plaque\s+psoriasis\b/i,
      /\bsevere\s+(?:chronic\s+)?plaque\s+psoriasis\b/i,
      /\bplaque\s+psoriasis,?\s+(?:moderate|mod)(?:\s*(?:-|to)\s*|\s+)severe\b/i,
      /\bplaque\s+psoriasis,?\s+(?:moderate|severe)\b(?!\s*(?:-|to)\s*mild)/i,
      /\bpsoriasis\s+vulgaris,?\s+(?:moderate|severe)(?:\s*(?:-|to)\s*severe)?\b/i,
    ],
  },
  {
    value: "mild plaque psoriasis",
    family: "psoriasis",
    patterns: [
      /\bmild(?:\s*(?:-|to)\s*moderate)?\s+(?:chronic\s+)?plaque\s+psoriasis\b/i,
      /\bplaque\s+psoriasis,?\s+mild\b/i,
    ],
  },
  {
    value: "plaque psoriasis",
    family: "psoriasis",
    patterns: [
      /\bplaque\s+psoriasis\b/i,
      /\bpsoriasis\s+vulgaris\b/i,
      /\bchronic\s+plaque\s+psoriasis\b/i,
    ],
    icd: /^L40\.0/,
  },
  {
    value: "psoriatic arthritis",
    patterns: [/\bpsoriatic\s+arthritis\b/i, /\bPsA\b/],
    icd: /^L40\.5/,
  },
  {
    value: "psoriasis",
    family: "psoriasis",
    patterns: [/\bpsoriasis\b/i, /\bPsO\b/],
    icd: /^L40(?:\.|$)/,
  },
  {
    value: "hidradenitis suppurativa",
    patterns: [/\bhidradenitis(?:\s+suppurativa)?\b/i],
    icd: /^L73\.2/,
  },
  {
    value: "familial hypercholesterolemia",
    patterns: [/\bfamilial\s+hypercholesterol(?:a)?emia\b/i, /\bHeFH\b/],
    icd: /^E78\.01/,
  },
  {
    value: "primary hyperlipidemia",
    patterns: [
      /\bprimary\s+hyperlipidemia\b/i,
      /\bhyperlipidemia\b/i,
      /\bhypercholesterol(?:a)?emia\b/i,
      /\bdyslipidemia\b/i,
    ],
    icd: /^E78(?:\.|$)/,
  },
  {
    value: "atherosclerotic cardiovascular disease",
    family: "ascvd",
    patterns: [
      /\batherosclerotic\s+cardiovascular\s+disease\b/i,
      /\bASCVD\b/i,
      /\bcoronary\s+(?:artery|heart)\s+disease\b/i,
      /\bCAD\b/,
      /\bCHD\b/,
      /\bischemic\s+heart\s+disease\b/i,
      /\bmyocardial\s+infarction\b/i,
      /\b(?:N?STEMI|MI)\b/,
      /\bheart\s+attack\b/i,
      /\bacute\s+coronary\s+syndrome\b/i,
      /\b(?:s\/p|status\s+post)\s+(?:PCI|CABG|stent|coronary)/i,
      /\bPCI\b/,
      /\bCABG\b/,
      /\bcoronary\s+(?:artery\s+)?(?:bypass|stent|revasculari[sz]ation)\b/i,
      /\b(?:coronary|cardiac|drug-eluting)\s+stent\b/i,
      /\bwith\s+(?:a\s+|prior\s+)?stent\b/i,
      /\bperipheral\s+arter(?:y|ial)\s+disease\b/i,
      /\bPAD\b/,
      /\bischemic\s+stroke\b/i,
      /\bstable\s+angina\b/i,
      /\bTIA\b/,
    ],
    icd: /^(?:I2[0-5]|I63|I70|Z95\.[15])/,
  },
  { value: "hypertension", patterns: [/\bhypertension\b/i, /\bHTN\b/] },
  { value: "seasonal allergies", patterns: [/\bseasonal\s+allergies\b/i] },
]

export interface LabEntry {
  name: string
  unit: string
  pattern: RegExp
}
// OCR often reads the 1 in A1c as l, I or |, in A1c and in HbA1c alike.
export const LABS: LabEntry[] = [
  {
    name: "A1c",
    unit: "%",
    // Case-sensitive on purpose: "ALC" (a blood count) is not A1c.
    pattern:
      /(?:\b(?:[Hh][Bb]|[Hh]gb|HGB)\s?A[1lI|][cC]\b|\b[Hh]emoglobin\s+A[1lI|][cC]\b|\b[Gg]lyc(?:at)?ed\s+[Hh]a?emoglobin\b|\b[Gg]lycohemoglobin\b|\bA[1lI|][cC]\b|\ba1c\b)/,
  },
  {
    name: "BSA",
    unit: "%",
    pattern:
      /(?:%\s?BSA\b|\bBSA\b(?:\s+involvement)?|\bbody\s+surface\s+area\b(?:\s+involvement)?)/i,
  },
  {
    name: "LDL-C",
    unit: "mg/dL",
    pattern:
      /(?<![\w-])(?:direct\s+)?(?:ldl(?:\s*-\s*c\b|\s+cholesterol\b|-cholesterol\b|-c\b)?|low[- ]density\s+lipoprotein(?:\s+cholesterol)?)(?![\w])/i,
  },
]

export const ROUTES: { canonical: string; pattern: RegExp }[] = [
  {
    canonical: "subcutaneous",
    pattern: /\b(?:sc|sq|subq|sub-q|subcut|subcutaneous(?:ly)?|s\.c\.)\b/i,
  },
  { canonical: "oral", pattern: /\b(?:po|p\.o\.|by mouth|oral(?:ly)?)\b/i },
  {
    canonical: "intravenous",
    pattern: /\b(?:iv|i\.v\.|intravenous(?:ly)?)\b/i,
  },
]

const NUM_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fourteen: 14,
  twenty: 20,
  thirty: 30,
}
export const numberWord = (s: string) =>
  /^\d+(?:\.\d+)?$/.test(s) ? Number(s) : NUM_WORDS[s.toLowerCase()]
export const NUMBER = `(?:\\d+(?:\\.\\d+)?|${Object.keys(NUM_WORDS).join("|")})`

// Frequency phrases. Each entry gives the canonical schedule and the days
// between doses, so equivalent written forms compare equal.
export const FREQUENCIES: {
  canonical: string
  intervalDays: number | null
  pattern: RegExp
}[] = [
  {
    canonical: "every 2 weeks",
    intervalDays: 14,
    pattern:
      /\b(?:every\s+(?:other|2|two|second)\s+(?:wks?|weeks?)|every\s+(?:14|fourteen)\s+days?|[qg]\.?\s?2\s?(?:wks?|weeks?|w)\b|[qg]\.?\s?14\s?(?:d|days?)\b|eow\b|qow\b|once\s+every\s+(?:2|two)\s+weeks?|biweekly)/i,
  },
  {
    canonical: "every 4 weeks",
    intervalDays: 28,
    pattern:
      /\b(?:every\s+(?:4|four)\s+(?:wks?|weeks?)|every\s+(?:28|twenty-eight)\s+days?|q\.?\s?4\s?(?:wks?|weeks?|w)\b|q\.?\s?28\s?(?:d|days?)\b)/i,
  },
  {
    canonical: "three times weekly",
    intervalDays: null,
    pattern:
      /\b(?:three\s+times\s+(?:a\s+|per\s+)?week(?:ly)?|3\s*(?:times|x)\s*(?:a\s+|per\s+|\/\s*)?w(?:ee)?k(?:ly)?|tiw\b)/i,
  },
  {
    canonical: "twice weekly",
    intervalDays: null,
    pattern:
      /\b(?:twice\s+(?:a\s+|per\s+)?week(?:ly)?|2\s*(?:times|x)\s*(?:a\s+|per\s+|\/\s*)?w(?:ee)?k(?:ly)?|biw\b)/i,
  },
  {
    canonical: "three times daily",
    intervalDays: null,
    pattern:
      /\b(?:three\s+times\s+(?:a\s+|per\s+)?day|three\s+times\s+daily|3\s*(?:times|x)\s*(?:a\s+|per\s+|\/\s*)?(?:day|daily)|t\.?i\.?d\.?\b|q\s?8\s?h\b)/i,
  },
  {
    canonical: "twice daily",
    intervalDays: 0.5,
    pattern:
      /\b(?:twice\s+(?:daily|a\s+day|per\s+day)|b\.i\.d\.?|bid\b|q\s?12\s?h\b|2\s*(?:times|x)\s*(?:a\s+|per\s+|\/\s*)?(?:day|daily)|every\s+12\s+hours)/i,
  },
  {
    canonical: "weekly",
    intervalDays: 7,
    pattern:
      /\b(?:once\s+(?:a\s+|each\s+|per\s+|every\s+)?week(?:ly)?|weekly|every\s+(?:7|seven)\s+days?|every\s+week|each\s+week|per\s+week|q\.?\s?(?:1\s?)?(?:wk|w)\b\.?|q\.\s?wk\b|[qg]wk\b|[qg]w\b|[qg]\.?\s?7\s?(?:d|days?)\b|1\s*x\s*(?:\/\s*)?w(?:ee)?k\b|\/\s*week\b)/i,
  },
  {
    canonical: "monthly",
    intervalDays: 30,
    pattern:
      /\b(?:once\s+(?:a\s+|each\s+|per\s+)?month(?:ly)?|monthly|every\s+month|q\.?\s?(?:1\s?)?month\b|qmonth\b|q\s?mo\b)/i,
  },
  {
    canonical: "every other day",
    intervalDays: 2,
    pattern: /\b(?:every\s+other\s+day|q\.?o\.?d\.?\b|q48h\b)/i,
  },
  {
    canonical: "daily",
    intervalDays: 1,
    pattern:
      /\b(?:once\s+(?:a\s+|per\s+)?day|once\s+daily|daily|q\.?d\.?\b|qday\b|every\s+day|each\s+day|at\s+bedtime|nightly|every\s+(?:night|evening|morning)|qhs\b|q\.?h\.?s\.?\b|qam\b|qpm\b|in\s+the\s+(?:evening|morning)|1\s*x\s*(?:\/\s*)?day\b|\/\s*day\b)/i,
  },
  {
    canonical: "once",
    intervalDays: null,
    pattern:
      /\b(?:once\b(?!\s+(?:a|each|per|every|daily|weekly|monthly|week|day|month|every))|single\s+dose|one\s+time|x\s?1\s+dose)/i,
  },
]

// Field labels, by the role of the field. A label is matched case-insensitively
// after any checkbox mark and before a ":", "|", "?", "=" or " - " separator.
export const LABELS: Record<string, RegExp> = {
  age: /^(?:pt\.?\s+|patient(?:'s)?\s+|current\s+)?age(?:\s+(?:stated|entered|today|confirmed|now|at\s+request|\(years\)|in\s+years))?$|^years\s+of\s+age$|^aged?$/i,
  // A bare "Request:" label is the requested medication unless its value is
  // only a date. That case is handled where dates are read.
  requestDate:
    /^(?:(?:pa\s+|prior\s+authorization\s+)?request(?:ed)?\s+(?:date|entered|filed|written|authored|prepared|submitted|sent|made|completed)|date\s+(?:of\s+)?(?:request|submission|requested|submitted|completed|written|prepared|signed)|letter\s+date|order\s+date|submission(?:\s+date)?|submitted|date\s+submitted|sent|date\s+sent|written|date\s+written|prepared|filed|authored|entered|entry\s+date|dated|completed|date\s+completed|form\s+date|request\s+date\s+recorded\s+in\s+note)$/i,
  bareDate: /^date$/i,
  receivedDate:
    /^(?:fax\s+)?(?:received|rec'?d|receipt)(?:\s+(?:date|by\s+plan|on))?$|^date\s+received$|^fax(?:ed)?(?:\s+date)?$/i,
  indication:
    /^(?:indication(?:\s+for\s+(?:this\s+)?request)?|requested\s+indication|reason(?:\s+for\s+(?:this\s+)?(?:request|referral|treatment))?|reason\s+for\s+[a-z][a-z-]+|requested\s+for|requested\s+(?:use|purpose)|purpose|treatment\s+purpose|intended\s+use|use|diagnosis(?:\s+for\s+(?:this\s+)?request)?|primary\s+diagnosis|dx|icd-?10(?:-cm)?(?:\s+code)?|diagnosis\s+code|why\s+now|why|condition|treating)$/i,
  assessment:
    /^(?:assessment|impression|a|clinical\s+impression|assessment\s+and\s+plan|a\/p)$/i,
  history:
    /^(?:past\s+medical\s+history|pmh|pmhx|medical\s+history|history|hx|past\s+history|problem\s+list|past\s+problem\s+list|active\s+problems?|problems?|archived\s+problems?|historical\s+problems?|chronic\s+conditions?|comorbidities)$/i,
  family: /^(?:family\s+history|fhx|fh|family\s+hx)$/i,
  social: /^(?:social\s+history|shx|sh)$/i,
  allergies:
    /^(?:allergies|allergy|drug\s+allergies|intolerances|allergies\s+and\s+intolerances|adverse\s+reactions)$/i,
  request:
    /^(?:request|requested|request(?:ed)?\s+(?:medication|drug|agent|product|therapy)|medication\s+requested|drug\s+requested|drug\s+sought|agent\s+sought|medicine\s+sought|medication\s+sought|product|agent|agent\s+selected|which\s+injectable|injectable|rx|rx\s+requested|prescription|new\s+prescription|order|medication|drug|requested\s+agent)$/i,
  amountOnly:
    /^(?:what\s+strength|strength|amount\s+per\s+injection|maintenance\s+amount|amount)$/i,
  frequencyOnly: /^(?:how\s+often|interval|maintenance\s+interval|frequency)$/i,
  dose: /^(?:dose|dose\s+and\s+frequency|dosage|dose\s*\/\s*frequency|strength\s+and\s+schedule|directions|sig|requested\s+sig|order\s+directions|maintenance|maintenance\s+(?:order|dose|to\s+dispense|directions)|prescription\s+maintenance|regimen|requested\s+(?:dose|regimen)|plan|p|what\s+strength|strength|amount\s+per\s+injection|maintenance\s+amount|how\s+often|interval|maintenance\s+interval|frequency)$/i,
  medications:
    /^(?:current(?:\s+(?:requested\s+therapy|medications?|meds|therapy|therapies|regimen))?|medications?|medication\s+list|med\s+list|meds|active\s+(?:medications?|meds|therapies)|home\s+medications?|reconciled\s+medication\s+list|medication\s+list\s+brought\s+to\s+visit|active\s+therapies(?:\s+copied\s+from\s+visit)?|outside\s+medications?)$/i,
  prior:
    /^(?:prior\s+therapies\s+tried|prior\s+therap(?:y|ies)|prior|previous\s+(?:treatment|therapy|systemic|statin|glucose\s+medicine|medications?)|step\s+therapy|tried|med\s+trials|medication\s+trials|trials?|earlier\s+(?:treatment|tablets|therapy|systemic)|past\s+therapy|treatment\s+history|medication\s+history|prior\s+(?:regimen|tablets|medications?|treatments?)|systemic\s+history|other\s+(?:oral\s+medication\s+course|lipid\s+tablet\s+trial|systemic\s+course)|additional\s+(?:systemic\s+course|lipid\s+tablet\s+trial)|previous\s+systemic)$/i,
  labs: /^(?:labs?|laboratory|lab\s+results?|chemistry|lipid\s+panel|laboratory\s+(?:slip|enclosure|results?)|results?)$/i,
}

// Section headings by role. Unknown headings start an "unknown" section, so a
// heading never inherits the meaning of the one before it.
export const SECTION_ROLES: { role: string; pattern: RegExp }[] = [
  { role: "family", pattern: /\bfamily\s+(?:history|hx)\b/i },
  { role: "social", pattern: /\bsocial\s+history\b/i },
  {
    role: "allergies",
    pattern: /\ballerg|intoleran(?:ce|ces)\s+list|adverse\s+reactions/i,
  },
  {
    role: "medications",
    pattern:
      /\b(?:current\s+medications?|medication\s+list|med\s+list|active\s+(?:medications?|therapies)|reconciled\s+medication|medication\s+list\s+brought|active\s+therapies|home\s+medications?)\b/i,
  },
  {
    role: "history",
    pattern:
      /\b(?:medication\s+(?:history|course|exposure|record|trials?)|treatment\s+(?:record|history|course)|therapy\s+record|prior\s+(?:regimen|therap(?:y|ies)|treatments?)|past\s+therapy|earlier\s+treatment|previous\s+treatment|systemic\s+history|step\s+therapy|medication\s+discussion)\b/i,
  },
  {
    role: "problems",
    pattern:
      /\b(?:problem\s+list|past\s+medical\s+history|medical\s+history|pmh|diagnoses)\b/i,
  },
  {
    role: "labs",
    pattern:
      /\b(?:labs?(?:\s+and\s+measurements)?|laboratory(?:\s+(?:slip|enclosure|results?))?|lab\s+results?|skin\s+worksheet|measurements?|vitals?)\b/i,
  },
  {
    role: "notes",
    pattern:
      /\b(?:clinical\s+notes?|progress\s+notes?|visit\s+notes?|consult(?:ation)?\s+(?:summary|notes?)|soap)\b/i,
  },
  {
    role: "request",
    pattern:
      /\b(?:request(?:ing)?|prior\s+authorization|authorization|referral|letter|access\s+(?:form|record)|intake|questions|checklist|worksheet|submission|form|entry)\b/i,
  },
  { role: "plan", pattern: /\bplan\b/i },
  { role: "assessment", pattern: /\b(?:assessment|impression)\b/i },
]

// Context triggers for clinical mentions. Before-triggers apply when they
// precede the mention in the same clause; after-triggers when they follow it.
export const CONTEXT = {
  negatedBefore:
    /\b(?:no|not|without|denies|denied|deny|negative\s+for|never|no\s+(?:history|hx|h\/o|evidence|sign|signs|known)\s+of|free\s+of|absence\s+of|ruled\s+out|rules\s+out|r\/o\s+negative|not\s+on|not\s+taking|never\s+(?:tried|took|taken|started|used))\b[^,;.]*$/i,
  // Words that look like negation but are not, such as "no complications of".
  pseudoNegation:
    /\b(?:no\s+(?:complications?|change|increase|decrease|improvement|response|acute|significant\s+change)\s+(?:of|in|from|with|to)?|not\s+only|no\s+doubt|without\s+complications?)\b[^,;.]*$/i,
  negatedAfter:
    /^\s*[,;:(-]?\s*(?:was\s+|has\s+been\s+|is\s+)?(?:ruled\s+out|excluded|negative|not\s+present|absent|not\s+confirmed|resolved|denied|declined)\b/i,
  uncertainBefore:
    /\b(?:possible|possibly|probable|probably|suspected|suspect|suspicion\s+of|suspicious\s+for|rule\s+out|r\/o|query|questionable|concern\s+for|concerning\s+for|consider|considering|presumed|presumptive|likely|cannot\s+(?:exclude|rule\s+out)|evaluate\s+for|evaluation\s+for|work-?up\s+for|differential|versus|vs\.?|\?)\s*[^,;.]*$/i,
  uncertainAfter:
    /^\s*[,;:(-]?\s*(?:\?|vs\.?\b|versus\b|unlikely\b|not\s+confirmed\b|unconfirmed\b|pending\b|to\s+be\s+confirmed\b|suspected\b|possible\b|probable\b|per\s+patient(?:\s+report)?\b|by\s+(?:patient\s+)?report\b|confirmation\s+pending\b|evaluation\s+(?:remains\s+)?(?:open|pending)\b|further\s+(?:diagnostic\s+)?(?:review|work-?up|evaluation)\b|being\s+evaluated\b)/i,
  family:
    /\b(?:mother|mom|father|dad|sister|brother|sibling|parent|parents|grandmother|grandfather|grandparent|aunt|uncle|cousin|son|daughter|maternal|paternal|family\s+(?:history|hx)|fhx|fh\s*:)\b/i,
  historical:
    /\b(?:history\s+of|hx\s+of|h\/o|prior\s+history|remote\s+history|in\s+remission|resolved|previously\s+(?:diagnosed|treated)|former|past\s+history\s+of)\b[^,;.]*$/i,
  noLongerCurrent: /\b(?:in\s+remission|resolved|no\s+longer)\b/i,
  hypothetical:
    /\b(?:at\s+risk\s+(?:for|of)|risk\s+(?:of|for)|risk\s+factors?\s+for|prevent(?:ion|ing)?\s+of|primary\s+prevention|to\s+prevent|screen(?:ing)?\s+for|if\b|plan(?:ned|ning)?\s+(?:to\s+)?(?:start|begin|use|try)?|will\s+(?:start|begin|try|consider)|may\s+(?:need|start|try)|candidate\s+for|consider(?:ing)?\s+(?:starting|a\s+trial)?|would\s+(?:start|try)|future|next\s+step)\b[^,;.]*$/i,
  hypotheticalAfter:
    /^\s*[,;:(-]?\s*(?:planned|if\b|to\s+be\s+started|pending\s+approval|is\s+planned|was\s+planned|will\s+be|risk\b|prevention\b|primary\s+prevention\b)/i,
  declined:
    /\b(?:declined|refused|deferred|not\s+started|never\s+started|patient\s+preference\s+not\s+to)\b/i,
  corrected:
    /\b(?:incorrect|error|entered\s+in\s+error|wrong|corrected\s+to|correction|supersed(?:es|ed)|replaces?\s+(?:prior|previous)|amended|strike|struck)\b/i,
}

// Outcome vocabulary for a treatment episode.
export const OUTCOMES = {
  contraindication:
    /\b(?:contraindicat(?:ed|ion|ions)|not\s+a\s+candidate|cannot\s+(?:use|take|receive)|unable\s+to\s+(?:use|take)|must\s+avoid|avoid(?:ed)?\s+(?:due\s+to|because))\b/i,
  intolerance:
    /\b(?:intoleran(?:t|ce)|could\s+not\s+tolerate|couldn't\s+tolerate|unable\s+to\s+tolerate|not\s+tolerated|did\s+not\s+tolerate|side\s+effects?|adverse\s+(?:effects?|reactions?|events?)|allerg(?:y|ic)|reaction)\b/i,
  stopped:
    /\b(?:stopped|discontinued|d\/c'?d|d\/c|dc'?d|held|ceased|quit|stopping|discontinuation)\b/i,
  efficacy:
    /\b(?:inadequate(?:\s+\w+)?\s+response|insufficient\s+response|suboptimal\s+(?:response|control)|partial\s+response|failed|failure|treatment\s+failure|no\s+improvement|did\s+not\s+(?:respond|improve|work|help)|not\s+effective|ineffective|lack\s+of\s+(?:efficacy|response)|not\s+at\s+goal|above\s+goal|(?:goal|target)[^.;]{0,30}not\s+(?:met|reached|achieved)|remained\s+(?:high|elevated|above)|still\s+(?:high|elevated|above)|failed\s+to\s+(?:clear|control|improve|reach))\b/i,
  nonClinical:
    /\b(?:cost|copay|price|afford|insurance|coverage|formulary|prior\s+auth|access|supply|shortage|patient\s+preference|preference|preferred|moved|relocated|lost\s+to\s+follow-?up|non-?adheren(?:t|ce)|adherence|forgot|ran\s+out)\b/i,
  // Clinical reasons that make a stop an intolerance or contraindication.
  adverse:
    /\b(?:nausea|vomit\w*|diarrh(?:e|o)a|gi\b|gastro\w*|abdominal|bloating|cramp\w*|upset|dyspepsia|myalgi\w*|muscle\s+(?:pain|aches?|weakness)|myopathy|myositis|rhabdo\w*|ck\b|cpk|creatine\s+kinase|alt\b|ast\b|lfts?|liver\s+(?:enzymes?|injury|toxicity)|transaminase\w*|hepato\w*|hepatitis|rash|hives|urticaria|itch\w*|pruritus|hypoglyc\w*|lactic\s+acidosis|acidosis|renal|kidney|egfr|ckd|creatinine|cirrhosis|pancreatitis|cytopenia\w*|neutropenia|anemia|leukopenia|thrombocytopenia|mouth\s+sores?|stomatitis|mucositis|fatigue|headache|dizz\w*|alopecia|hair\s+loss|pneumonitis|infection\w*|tb\b|tuberculosis|pregnan\w*|conception|breast-?feeding|lactation|alcohol|etoh|interaction|elevat\w+|toxicity|intolerance|anaphyla\w*|angioedema|swelling)\b/i,
}

// A word's clinical category, used by the privacy step to keep clinical and
// form words and to report when one was removed. Null for other words.
const FORM_WORDS = new Set(
  [
    "request",
    "requested",
    "requesting",
    "prescription",
    "prescriber",
    "treating",
    "treatment",
    "intended",
    "order",
    "maintenance",
    "injection",
    "injectable",
    "teaching",
    "numeric",
    "additional",
    "drug",
    "diet",
    "medication",
    "medications",
    "dose",
    "dosage",
    "known",
    "established",
    "history",
    "diagnosis",
    "indication",
    "assessment",
    "plan",
    "labs",
    "laboratory",
    "result",
    "results",
    "therapy",
    "therapies",
    "clinical",
    "notes",
    "course",
    "record",
    "regimen",
    "trial",
    "prior",
    "previous",
    "earlier",
    "current",
    "active",
    "reason",
    "purpose",
    "agent",
    "product",
    "sought",
    "strength",
    "interval",
    "frequency",
    "directions",
    "sig",
    "skin",
    "surface",
    "area",
    "measurement",
    "examination",
    "estimate",
    "worksheet",
    "checklist",
    "questions",
    "submission",
    "intake",
    "summary",
    "consult",
    "letter",
    "form",
    "visit",
    "follow",
    "referral",
    "access",
    "record",
    "entry",
    "pharmacy",
    "specialty",
    "dispensing",
    "lipid",
    "statin",
    "tablets",
    "tablet",
    "capsule",
    "pen",
    "syringe",
    "supplies",
    "storage",
    "education",
    "counseling",
    "teaching",
    "delivery",
    "preference",
    "return",
    "attestation",
    "signature",
    "date",
    "dated",
    "written",
    "prepared",
    "sept",
    "sep",
    // Form column and field words that sit where a name could.
    "age",
    "sex",
    "gender",
    "name",
    "dob",
    "weight",
    "height",
    "allergies",
    "phone",
    "member",
    "status",
    "start",
    "stop",
    "test",
    "value",
    "units",
    "comments",
    "female",
    "male",
    "years",
    "outcome",
    "response",
  ].map((w) => w.toLowerCase()),
)
const CONDITION_WORDS =
  /^(?:diabet\w*|mellitus|psoria\w*|plaque\w*|vulgaris|arthritis|athero\w*|cardiovascular|coronary|heart|artery|arterial|myocardial|infarction|stroke|stent|angina|ischemi\w*|peripheral|hyperlipid\w*|hypercholest\w*|dyslipid\w*|familial|obesity|obese|hypertension|prediabetes|hidradenitis|suppurativa|disease|moderate|severe|mild|chronic|established|suspected|possible|probable|type|cad|ascvd|mi|chd|pci|cabg|pad|tia|n?stemi|t2dm|t2d|dm|dm2|niddm|htn|hld|ckd|pso|copd|chf|cva|ihd|pvd|afib)$/i
const LAB_WORDS =
  /^(?:a1c|hba1c|hgba1c|hemoglobin|glucose|cholesterol|ldl|ldlc|hdl|bsa|pasi|egfr|creatinine|alt|ast|lipid|lipids|panel|triglycerides)$/i
const DRUG_WORDS = new Set(
  DRUGS.flatMap((d) => [d.generic, ...d.brands, ...d.abbreviations])
    .flatMap((n) => n.split(" "))
    .map((w) => w.toLowerCase()),
)
export function clinicalCategory(word: string): string | null {
  const w = word.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (!w) return null
  if (DRUG_WORDS.has(w)) return "drug"
  if (CONDITION_WORDS.test(w)) return "condition"
  if (LAB_WORDS.test(w)) return "lab"
  if (FORM_WORDS.has(w)) return "form"
  return null
}
