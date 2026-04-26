import type { Nutrition } from '@/lib/notion';

// FDA 2020 daily reference values used for %DV calculation
const DV = {
  totalFat:           78,   // g
  saturatedFat:       20,   // g
  cholesterol:        300,  // mg
  sodium:             2300, // mg
  potassium:          4700, // mg
  totalCarbohydrates: 275,  // g
  dietaryFiber:       28,   // g
  addedSugars:        50,   // g
  protein:            50,   // g
};

function pdv(value: number, dv: number) {
  return `${Math.round((value / dv) * 100)}%`;
}

// A single nutrient row. Always renders — shows "NaN" when value is null.
function Row({
  name,
  value,
  unit,
  dv,
  indent = 0,
  bold = true,
}: {
  name: string;
  value: number | null;
  unit: string;
  dv?: number;
  indent?: 0 | 1 | 2; // 0 = flush, 1 = one level, 2 = two levels
  bold?: boolean;
}) {
  const isNaN = value === null;
  const displayAmt = isNaN ? 'NaN' : `${value}${unit}`;
  const displayPdv = !isNaN && dv !== undefined ? pdv(value!, dv) : null;

  const pl = indent === 2 ? 'pl-10' : indent === 1 ? 'pl-6' : '';

  return (
    <div
      className={`flex items-baseline justify-between border-b border-black py-[2px] text-sm leading-snug ${pl}`}
    >
      <span>
        <span className={bold ? 'font-bold' : 'font-normal'}>{name}</span>{' '}
        <span className={`font-normal ${isNaN ? 'text-gray-400' : ''}`}>
          {displayAmt}
        </span>
      </span>
      {displayPdv !== null && (
        <span className="font-bold tabular-nums">{displayPdv}</span>
      )}
    </div>
  );
}

// Vitamin / mineral entry at the bottom of the label (value already is %DV)
function Micro({ name, value }: { name: string; value: number | null }) {
  return (
    <span>
      {name} {value !== null ? `${value}%` : <span className="text-gray-400">NaN</span>}
    </span>
  );
}

export default function NutritionFacts({
  nutrition,
  servings,
}: {
  nutrition: Nutrition;
  servings: number | null;
}) {
  // Hide the whole panel only if every single field is null
  const hasAny = Object.values(nutrition).some((v) => v !== null);
  if (!hasAny) return null;

  return (
    // Always white / black — the FDA label is a physical-world artefact
    <div className="border-[3px] border-black bg-white text-black w-full max-w-xs select-none">

      {/* ── Header ── */}
      <div className="px-2 pt-1 pb-1 border-b-[10px] border-black">
        <p className="font-black leading-none tracking-tight" style={{ fontSize: '2rem' }}>
          Nutrition Facts
        </p>
        {servings !== null && (
          <p className="text-sm mt-0.5">{servings} serving{servings !== 1 ? 's' : ''} per recipe</p>
        )}
        <div className="flex justify-between items-baseline mt-1">
          <span className="text-sm font-bold">Serving size</span>
          <span className="text-sm font-bold">per serving</span>
        </div>
      </div>

      {/* ── Calories ── */}
      <div className="px-2 border-b-[5px] border-black pt-1 pb-0.5">
        <p className="text-xs font-bold">Amount Per Serving</p>
        <div className="flex items-end justify-between">
          <span className="text-xl font-bold leading-none">Calories</span>
          <span
            className={`font-black leading-none tabular-nums ${nutrition.calories === null ? 'text-gray-400 text-3xl' : ''}`}
            style={nutrition.calories !== null ? { fontSize: '2.75rem' } : undefined}
          >
            {nutrition.calories ?? 'NaN'}
          </span>
        </div>
      </div>

      {/* ── % DV header ── */}
      <div className="px-2 border-b border-black py-px text-right">
        <span className="text-xs font-bold">% Daily Value*</span>
      </div>

      {/* ── Main nutrients ── */}
      <div className="px-2">
        <Row name="Total Fat"            value={nutrition.totalFat}           unit="g"  dv={DV.totalFat} />
        <Row name="Saturated Fat"        value={nutrition.saturatedFat}       unit="g"  dv={DV.saturatedFat}       indent={1} bold={false} />
        <Row name="Trans Fat"            value={nutrition.transFat}           unit="g"                             indent={1} bold={false} />
        <Row name="Polyunsaturated Fat"  value={nutrition.polyunsaturatedFat} unit="g"                             indent={1} bold={false} />
        <Row name="Monounsaturated Fat"  value={nutrition.monounsaturatedFat} unit="g"                             indent={1} bold={false} />
        <Row name="Cholesterol"          value={nutrition.cholesterol}        unit="mg" dv={DV.cholesterol} />
        <Row name="Sodium"               value={nutrition.sodium}             unit="mg" dv={DV.sodium} />
        <Row name="Potassium"            value={nutrition.potassium}          unit="mg" dv={DV.potassium} />
        <Row name="Total Carbohydrates"  value={nutrition.totalCarbohydrates} unit="g"  dv={DV.totalCarbohydrates} />
        <Row name="Dietary Fiber"        value={nutrition.dietaryFiber}       unit="g"  dv={DV.dietaryFiber}       indent={1} bold={false} />
        <Row name="Sugars"               value={nutrition.sugars}             unit="g"                             indent={1} bold={false} />
        <Row name="Added Sugars"         value={nutrition.addedSugars}        unit="g"  dv={DV.addedSugars}        indent={2} bold={false} />
        <Row name="Sugar Alcohols"       value={nutrition.sugarAlcohols}      unit="g"                             indent={1} bold={false} />

        {/* Thick bar before Protein */}
        <div className="-mx-2 px-2 border-b-[7px] border-black">
          <Row name="Protein" value={nutrition.protein} unit="g" dv={DV.protein} />
        </div>
      </div>

      {/* ── Micronutrients ── */}
      <div className="px-2 py-1 border-b-[3px] border-black text-sm">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          <Micro name="Vitamin D" value={nutrition.vitaminD} />
          <span className="text-gray-300 select-none">•</span>
          <Micro name="Vitamin A" value={nutrition.vitaminA} />
          <span className="text-gray-300 select-none">•</span>
          <Micro name="Vitamin C" value={nutrition.vitaminC} />
          <span className="text-gray-300 select-none">•</span>
          <Micro name="Calcium"   value={nutrition.calcium} />
          <span className="text-gray-300 select-none">•</span>
          <Micro name="Iron"      value={nutrition.iron} />
        </div>
      </div>

      {/* ── Footnote ── */}
      <div className="px-2 pt-1 pb-1.5">
        <p className="text-[0.6rem] leading-tight text-black">
          * The % Daily Value (DV) tells you how much a nutrient in a serving
          contributes to a daily diet. 2,000 calories a day is used for general
          nutrition advice.
        </p>
      </div>
    </div>
  );
}
