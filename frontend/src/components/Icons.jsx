const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const SearchIcon = (p) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);

export const ArrowRight = (p) => (
  <svg {...base} {...p}><path d="M4 12h16M14 6l6 6-6 6" /></svg>
);

export const ArrowLeft = (p) => (
  <svg {...base} {...p}><path d="M20 12H4M10 6l-6 6 6 6" /></svg>
);
