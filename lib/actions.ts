import { Appliance, BackupResult, LIMITS, Priority, applianceMonthlyKwh, clamp, DAYS_PER_MONTH } from './energy';

export interface ActionItem {
  id: string;
  title: string;
  detail: string;
  type: 'free' | 'purchase';
  savingsKwh: number | null;
  savingsPKR: number | null;
  /** 1 = easy, 3 = hard */
  effort: 1 | 2 | 3;
  /** 1 = barely noticeable, 3 = real comfort cost */
  comfortCost: 1 | 2 | 3;
  confidence: 'high' | 'medium' | 'low';
  /** Explicit assumption behind the estimate, if any. */
  assumption?: string;
  score: number;
}

const CONFIDENCE_WEIGHT = { high: 1, medium: 0.75, low: 0.5 } as const;
const LED_REPLACEMENT_WATTS = 10;

/**
 * Ranking: score = (estimated PKR impact ÷ largest impact) × confidence weight × 10
 *                  ÷ (effort + comfort cost + 2 if equipment must be bought).
 * Higher is better. Savings are estimates from the user's own inputs, not guarantees.
 */
export function buildActions(
  appliances: Appliance[],
  rate: number,
  options: { backup?: BackupResult; priorities?: Priority[] } = {},
): ActionItem[] {
  const r = clamp(rate, 0, LIMITS.rate);
  const drafts: Omit<ActionItem, 'score'>[] = [];

  for (const a of appliances) {
    const monthly = applianceMonthlyKwh(a);
    if (monthly <= 0 || a.kind === 'fridge') continue;
    const hours = clamp(a.hoursPerDay, 0, LIMITS.hoursPerDay);

    const trimHours = Math.min(1, hours);
    const trimKwh = (clamp(a.watts, 0, LIMITS.watts) * clamp(a.quantity, 0, LIMITS.quantity) * trimHours * DAYS_PER_MONTH) / 1000;
    const comfortCost: 1 | 2 | 3 = a.kind === 'ac' ? 3 : a.kind === 'light' ? 1 : 2;
    drafts.push({
      id: `trim-${a.id}`,
      title: `Use ${a.name.toLowerCase()} ${trimHours === 1 ? '1 hour' : `${trimHours} h`} less per day`,
      detail:
        a.kind === 'ac'
          ? 'Try a slightly higher thermostat setting or pre-cool before peak heat instead of running it continuously. Keep it on for anyone vulnerable to heat.'
          : a.kind === 'light'
            ? 'Switch lights off in empty rooms and rely on daylight where you can.'
            : 'Switch it off when nobody is using it.',
      type: 'free',
      savingsKwh: trimKwh,
      savingsPKR: trimKwh * r,
      effort: 1,
      comfortCost,
      confidence: a.kind === 'ac' ? 'medium' : 'high',
      assumption:
        a.kind === 'ac'
          ? 'Compressors cycle, so real AC savings per hour can be lower than nameplate watts suggest.'
          : undefined,
    });

    if (a.kind === 'light' && clamp(a.watts, 0, LIMITS.watts) >= 2 * LED_REPLACEMENT_WATTS) {
      const ledKwh = ((a.watts - LED_REPLACEMENT_WATTS) * clamp(a.quantity, 0, LIMITS.quantity) * hours * DAYS_PER_MONTH) / 1000;
      drafts.push({
        id: `led-${a.id}`,
        title: `Replace ${a.name.toLowerCase()} with LED bulbs`,
        detail: 'Needs a small purchase. Check bulb wattage and fitting before buying.',
        type: 'purchase',
        savingsKwh: ledKwh,
        savingsPKR: ledKwh * r,
        effort: 2,
        comfortCost: 1,
        confidence: 'medium',
        assumption: `Assumes replacement bulbs of ${LED_REPLACEMENT_WATTS} W each.`,
      });
    }
  }

  const maxPKR = Math.max(1, ...drafts.map((d) => d.savingsPKR ?? 0));
  const scored: ActionItem[] = drafts.map((d) => {
    const friction = d.effort + d.comfortCost + (d.type === 'purchase' ? 2 : 0);
    const impact = (d.savingsPKR ?? 0) / maxPKR;
    return { ...d, score: Math.round(((impact * CONFIDENCE_WEIGHT[d.confidence] * 10) / friction) * 100) / 100 };
  });
  scored.sort((a, b) => b.score - a.score);

  const backup = options.backup;
  if (backup && backup.feasible === false && backup.requiredNominalWh) {
    const item: ActionItem = {
      id: 'backup-capacity',
      title: 'Close your backup gap',
      detail: `Under your assumptions the selected loads need about ${Math.round(backup.requiredNominalWh).toLocaleString()} Wh of nominal battery capacity for the duration you set. Shrink the load list or add capacity; use qualified installation.`,
      type: 'purchase',
      savingsKwh: null,
      savingsPKR: null,
      effort: 3,
      comfortCost: 1,
      confidence: 'medium',
      score: 0,
    };
    if (options.priorities?.includes('backup')) scored.unshift(item);
    else scored.push(item);
  }
  return scored.slice(0, 6);
}
