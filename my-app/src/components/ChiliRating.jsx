export default function ChiliRating({ level }) {
  return <span className="chili-rating" aria-hidden="true">
    {Array.from({ length: 3 }, (_, index) => (
      <svg key={index} className={`chili-icon${index >= level ? ' chili-icon-muted' : ''}`} viewBox="0 0 32 40" focusable="false">
        <path d="M19 11C25 9 29 13 28 20C26 30 17 36 4 37C13 32 14 27 14 20C14 16 15 12 19 11Z" fill="#ed383f" stroke="#251722" strokeWidth="2" strokeLinejoin="round" />
        <path d="M17 13L20 9C19 5 21 2 25 2L26 6C23 6 23 8 24 10L27 13L22 12L20 15Z" fill="#54a64b" stroke="#251722" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ))}
  </span>;
}
