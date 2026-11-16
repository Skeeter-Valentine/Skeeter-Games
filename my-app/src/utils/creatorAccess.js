// Creator accounts (see functions/creators.js): which gauntlets a creator may
// open before they go live. `creator` is { allDays, days } or null.
export function canPreviewDay(creator, day) {
  if (!creator || typeof day !== 'string') return false;
  return creator.allDays === true || (Array.isArray(creator.days) && creator.days.includes(day));
}

// The upcoming days (from `days`, in order) a creator may open.
export const previewDays = (creator, days) => days.filter(day => canPreviewDay(creator, day));

// "All upcoming gauntlets", "Fri, Nov 20", "3 gauntlets: Nov 20, 21, 27".
export function accessSummary(access, today) {
  if (access?.allDays) return 'All upcoming gauntlets';
  const days = (access?.days ?? []).filter(day => !today || day >= today);
  if (!days.length) return 'No upcoming gauntlets';
  const label = day => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${days.length} ${days.length === 1 ? 'gauntlet' : 'gauntlets'}: ${days.map(label).join(', ')}`;
}

// The upcoming days a creator is invited to, adding or removing one.
export function withDay(creator, day, invited) {
  const days = (creator?.days ?? []).filter(d => d !== day);
  return invited ? [...days, day].sort() : days;
}
