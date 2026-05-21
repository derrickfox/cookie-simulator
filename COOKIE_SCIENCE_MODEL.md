<!--
AI_CHANGE:
Tool: Codex
Model: GPT-5
Timestamp: 2026-05-21T17:10:13-04:00
Purpose: Documents the audited simulator behavior and the evidence-backed cookie science model.
Reason: The recipe model is becoming more scientific, so future agents need a clear map of assumptions, source evidence, and tunable heuristics.
-->

# Cookie Science Model

## Current Simulator Audit

The app currently calculates all recipe outcomes in `src/main.jsx` inside `bakeModel(recipe)`. That function transforms slider values into 3D rendering parameters: radius, height, dough color, rim browning, burn level, gloss, roughness, visible chip count, and short labels for doneness and spread.

Modeled input variables before this update:

| Variable | Existing behavior |
| --- | --- |
| Flour | Adds structure and reduces spread. |
| Butter | Adds moisture/fat, increases spread and surface gloss. |
| Brown sugar | Adds sugar load and a brown-sugar ratio used for browning. |
| White sugar | Adds sugar load and spread. |
| Eggs | Adds moisture and structure. |
| Vanilla | Adds a small amount of moisture. |
| Baking soda | Adds leavening/rise only; pH was not modeled explicitly. |
| Salt | Adds a small structure modifier only. |
| Chocolate chips | Controls visible chip count and chip scale. Chips are rendered as softened domes, not liquid pools. |
| Oven temperature | Increases bake/doneness and lightly affects spread. |
| Cook time | Increases bake/doneness and reduces puff. |

Predicted outcomes before this update:

| Outcome | Existing behavior |
| --- | --- |
| Spread/diameter | Predicted by a combined moisture, sugar, structure, and heat score. |
| Thickness/rise | Predicted from baking soda, egg, structure, spread, and time. |
| Browning/color | Predicted from heat, time, sugar, brown-sugar ratio, and moisture. |
| Rim browning/burn | Separate edge bake and burn values darken the rim and alert label. |
| Doneness | Label derived from a single bake score. |
| Chips | Visible count and size based on chocolate-chip slider. |
| Surface texture | Mostly geometric/random visual texture; not tied to moisture, pH, or bake state. |

Important gaps before this update:

- Baking powder was absent, so soda and powder could not behave differently.
- pH was implicit, even though sodium bicarbonate affects browning and flavor through alkalinity.
- Dough temperature, chilling/resting time, butter state, pan heat transfer, flour protein, and dough-piece size were absent.
- Moisture loss, crispness, chewiness, edge-vs-center gradients, and center softness were not explicit outputs.
- Browning was directional and useful visually, but it did not distinguish surface drying, water activity, pH, pan heat, and cookie mass.

## Food-Science Findings Used

Strong enough to model directionally:

- Baking time and temperature drive moisture loss, surface drying, browning, texture hardening, and Maillard/HMF/acrylamide-related chemistry. Several cookie/biscuit studies track moisture, dimensions, color, texture, and thermal reaction products during baking.
- Water activity and surface moisture matter. HMF formation in cookies rises sharply after water activity drops below a critical dry-surface region; high dough moisture should delay browning until enough water evaporates.
- Sugar type and level matter. Sucrose and reducing sugars affect spread, browning chemistry, water availability, and texture. Brown sugar behaves as a moisture-retaining, flavor-rich sugar source; white sugar pushes spread and crispness more strongly in this simplified chocolate-chip-cookie model.
- Sodium bicarbonate affects more than gas. It contributes CO2 but also keeps cookie pH alkaline, changing browning chemistry and flavor. Baking powder contributes gas with included acids, so it should raise/puff the cookie without raising pH as strongly.
- Fat level and fat state affect spread and tenderness. More fat generally increases flow/spread and tenderness. Melted or warm fat lets the dough flow before structure sets; colder dough/fat spreads less.
- Flour quality affects spread. Cookie-flour methods use diameter and stack height to evaluate flour; lower water absorption and lower protein are associated with larger cookie spread, while stronger/higher-protein flour tends to hold shape.
- Cookie geometry matters. Larger/thicker cookies have lower surface-area-to-volume ratios, so they should lose moisture more slowly and show a stronger soft-center/crisp-edge gradient.
- Heat transfer matters. Forced/efficient heat transfer dehydrates and bakes biscuits faster than static transfer; pan conductivity/color is a reasonable consumer-level proxy.
- Chocolate chips should stay as softened inclusions. Food Research International work on chocolate chips in cookies supports the idea that chips can melt/soften during baking while remaining localized inclusions after cooling, aided by the surrounding dough and fat migration.

Approximate or lower-confidence:

- Exact equations for home chocolate-chip cookies are not directly available from the cited industrial/model-cookie papers, so this app uses calibrated heuristics rather than fake precision.
- Brown sugar vs white sugar behavior depends on formulation, acidity, molasses level, and water balance. The simulator models common chocolate-chip-cookie behavior, not every cookie style.
- Pan type is modeled as a heat-transfer multiplier, not a full conduction/radiation/convection solver.
- Acrylamide/HMF chemistry is not output directly. The same drivers are used only to inform browning/dryness/doneness because toxicant prediction would imply a precision the app does not have.

## Implemented Model Shape

The new model should live in a dedicated module and expose named intermediate scores:

- `heatIndex`: normalized oven temperature.
- `timeIndex`: normalized bake time.
- `thermalLoad`: combined heat/time/pan load.
- `formulaMoisture`: ingredient water/fat moisture potential.
- `moistureLoss`: evaporative loss from thermal load, pan transfer, surface area, and dough temperature.
- `moistureRemaining`: final relative moisture, used for chewiness and gloss.
- `pHScore`: alkalinity from baking soda, buffered down by baking powder acids and brown sugar acidity.
- `structureScore`: flour, flour protein, egg, salt, size, and leavening support.
- `fatFlowScore`: butter amount, butter state, dough temperature, and chilling effect.
- `spreadScore`: fat flow, sugar mobility, moisture, heat, flour absorption, structure, and size.
- `riseScore`: gas from soda and powder plus structure, reduced by spread and long bake collapse.
- `browningScore`: thermal load, dry-surface state, sugar chemistry, pH, egg protein, and pan transfer.
- `crispness`, `chewiness`, `edgeDoneness`, `centerDoneness`, and `edgeCenterGradient`.

The model remains intentionally heuristic. Its job is to make slider movement physically plausible and fun, not to predict lab measurements.

## Variable Effects Table

| Variable/process | Expected effects in simulator | Confidence |
| --- | --- | --- |
| Higher oven temperature | More browning, faster moisture loss, more edge doneness/crispness; may limit spread by setting edges faster at high heat. | High |
| Longer bake time | More moisture loss, browning, crispness, hardness, and doneness; lower moisture and chewiness. | High |
| More butter/fat | More spread and tenderness; less perceived dryness/hardness at moderate bake. | Medium-high |
| Melted/warm butter | More early flow/spread and lower height than softened/cold butter. | Medium |
| Chilled dough/rest | Less spread and usually taller cookies because fat melts later and dough sets sooner. | Medium-high |
| More brown sugar | More moisture retention, chewiness, darker/toffee notes; slightly less crisp than white sugar. | Medium |
| More white sugar | More spread and crispness; contributes browning after breakdown but less moisture retention than brown sugar. | Medium |
| More egg/liquid | More water and protein; can increase structure and browning, but high moisture delays drying/browning. | Medium |
| More baking soda | Higher pH, more browning, some leavening/spread, possible alkaline flavor when excessive. | High |
| More baking powder | More gas/rise/structure without a strong pH increase; less browning impact than soda. | High |
| More flour | More structure and water absorption; less spread, taller/cakier result. | High |
| Higher flour protein | More structure/chew and lower spread. | Medium-high |
| More salt | Flavor balance and small structure/ionic effects; not a major geometry driver. | Low-medium |
| More chips | More inclusions and visible chips; tiny reduction in spread because inclusions interrupt flow. | Medium |
| Larger/thicker dough piece | Larger final cookie, slower moisture loss, softer center, stronger edge-center gradient. | High |
| Dark/high-transfer pan | Faster edge/bottom browning, drying, and set. | Medium |

## Sources Consulted

- Hu et al. (2022), "Effects of baking factors and recipes on the quality of butter cookies..." Current Research in Food Science: https://www.sciencedirect.com/science/article/pii/S2665927122000843
- Walker, Seetharaman, and Goldstein (2012), "Characterizing physicochemical changes of cookies baked in a commercial oven": https://experts.umn.edu/en/publications/characterizing-physicochemical-changes-of-cookies-baked-in-a-comm/
- Schouten et al. (2022), "Formation of acrylamide in biscuits during baking under different heat transfer conditions": https://www.sciencedirect.com/science/article/pii/S0023643821016947
- Gokmen et al. (2008), "Effect of leavening agents and sugars on the formation of hydroxymethylfurfural in cookies during baking": https://research.hacettepe.edu.tr/en/publications/effect-of-leavening-agents-and-sugars-on-the-formation-of-hydroxy-3/
- van der Sman (2021), "Thermodynamic description of the chemical leavening in biscuits": https://www.sciencedirect.com/science/article/pii/S2665927121000198
- Canali et al. (2020), "Influence of different baking powders on physico-chemical, sensory and volatile compounds in biscuits...": https://doi.org/10.1007/s13197-020-04418-1
- Courel et al. (2009), "Effects of Formulation and Baking Conditions on Neo-formed Contaminants in Model Cookies": https://cjfs.agriculturejournals.cz/pdfs/cjf/2009/10/132.pdf
- USDA ARS, "Baking Quality of Cookie Flour": https://www.ars.usda.gov/midwest-area/wooster-oh/corn-soybean-and-wheat-quality-research/docs/baking-quality-of-cookie-flour/
- "Bloom on chocolate chips baked in cookies," Food Research International: https://www.sciencedirect.com/science/article/abs/pii/S0963996912001743
- "Examination of the effects of chilling time on the spreading of cookies": https://ojs.library.ubc.ca/index.php/expedition/article/view/196120
