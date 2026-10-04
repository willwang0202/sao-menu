/** Line glyphs in the weight of the SAO menu's original icons. */
const paths = {
  ring: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  bolt: <path d="M13 3 6 13h5l-1 8 7-10h-5l1-8Z" />,
  browser: <><path d="M3 7c6-3 12-3 18 0v10c-6-3-12-3-18 0Z" /><path d="M3 10.5c6-2.5 12-2.5 18 0" /></>,
  hand: <path d="M8 13V6a1.5 1.5 0 0 1 3 0v5m0-6a1.5 1.5 0 0 1 3 0v6m0-4a1.5 1.5 0 0 1 3 0v6c0 4-2.5 7-6 7s-5-2-7-5l-1.5-2.5a1.5 1.5 0 0 1 2.5-1.5L8 13" />,
  friends: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" /><path d="M16 5a3 3 0 0 1 0 6m2 3c2 .8 3 3 3 6" /></>,
  download: <><path d="M12 4v11m0 0-4-4m4 4 4-4" /><path d="M5 20h14" /></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
} as const;

export function Icon({ name, size = 20 }: { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
