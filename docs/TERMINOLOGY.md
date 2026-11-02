# Bundled terminology subset

Retrieved November 1, 2026. Runtime lookup is offline, with exact string matches only. No complete terminology database or clinical coding claim is made.

The ingredient codes were checked using the NLM RxNav properties API. The endpoint for each row returns the ingredient name and `tty=IN`.

| Ingredient | RxNorm identifier | Public source |
| --- | --- | --- |
| semaglutide | 1991302 | [NLM](https://rxnav.nlm.nih.gov/REST/rxcui/1991302/properties.json) |
| adalimumab | 327361 | [NLM](https://rxnav.nlm.nih.gov/REST/rxcui/327361/properties.json) |
| evolocumab | 1665684 | [NLM](https://rxnav.nlm.nih.gov/REST/rxcui/1665684/properties.json) |
| metformin | 6809 | [NLM](https://rxnav.nlm.nih.gov/REST/rxcui/6809/properties.json) |
| methotrexate | 6851 | [NLM](https://rxnav.nlm.nih.gov/REST/rxcui/6851/properties.json) |
| atorvastatin | 83367 | [NLM](https://rxnav.nlm.nih.gov/REST/rxcui/83367/properties.json) |

The synthetic phrase “Type 2 diabetes mellitus” maps to E11.9, diabetes without complications. This deliberately small example does not infer complications. Plaque psoriasis maps to L40.0, psoriasis vulgaris. Severity remains in the observed phrase and is not encoded by that code. See the [CMS ICD-10-CM source](https://www.cms.gov/medicare/coding-billing/icd-10-codes) and [CMS psoriasis measure specification](https://qpp.cms.gov/docs/QPP_quality_measure_specifications/CQM-Measures/2026_Measure_410_MIPSCQM.pdf).

The font assets are Roboto Mono and Kalam from the Google Fonts public repository. Each font's OFL license is included alongside the font. The rendered glyph outlines are embedded in generated synthetic images, with no runtime font download.

The E11.9 description is also directly listed in the [CMS diagnosis mapping table](https://www.cms.gov/regulations-and-guidance/guidance/transmittals/downloads/r1504otn.pdf). Only the terminology mapping is used, not a coverage policy.
