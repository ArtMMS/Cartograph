export interface TravelMode {
  id: string;
  name: string;
  icon: string;
  /** Average speed while moving, in km/h. */
  kmPerHour: number;
  /** Hours of travel per day (the rest is rest, camp, meals…). */
  hoursPerDay: number;
}

/**
 * Travel modes, roughly based on D&D 5e overland travel.
 * Edit the numbers here to match your table's rules.
 */
export const TRAVEL_MODES: readonly TravelMode[] = [
  { id: 'walk', name: 'On foot', icon: '🚶', kmPerHour: 4.8, hoursPerDay: 8 }, // 3 mph, 24 mi/day
  { id: 'horse', name: 'Horseback', icon: '🐎', kmPerHour: 8, hoursPerDay: 8 },
  { id: 'cart', name: 'Cart / wagon', icon: '🛒', kmPerHour: 4, hoursPerDay: 8 },
  { id: 'boat', name: 'Sailing ship', icon: '⛵', kmPerHour: 3.2, hoursPerDay: 24 }, // 2 mph, sails day and night
  { id: 'fly', name: 'Flying mount', icon: '🦅', kmPerHour: 12.8, hoursPerDay: 8 }, // 8 mph (80 ft speed)
];

export interface TravelTime {
  /** Full travel days. */
  days: number;
  /** Hours and minutes travelled on the last (partial) day. */
  hours: number;
  minutes: number;
  /** Total time actually moving, in minutes. */
  movingMinutes: number;
}

/** How long a distance takes, split into travel days of `hoursPerDay`. */
export function travelTime(km: number, mode: TravelMode): TravelTime {
  const movingMinutes = Math.round((km / mode.kmPerHour) * 60);
  const minutesPerDay = mode.hoursPerDay * 60;
  const days = Math.floor(movingMinutes / minutesPerDay);
  const rest = movingMinutes - days * minutesPerDay;
  return { days, hours: Math.floor(rest / 60), minutes: rest % 60, movingMinutes };
}

/** Always shows days, hours and minutes: "2 days, 4 h, 50 min". */
export function formatTravelTime(t: TravelTime): string {
  return `${t.days} ${t.days === 1 ? 'day' : 'days'}, ${t.hours} h, ${t.minutes} min`;
}

/** "20 h 50 min" */
export function formatMinutes(total: number): string {
  return `${Math.floor(total / 60)} h ${total % 60} min`;
}
