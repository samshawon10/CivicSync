import { memo } from 'react';

/**
 * Single, dependency-free icon system (Lucide geometry, MIT licensed).
 * Every icon shares one 24x24 grid, one stroke weight and rounded joins so the
 * administration shell never mixes icon styles.
 */
const paths = {
  dashboard: ['M3 3h7v7H3z', 'M14 3h7v5h-7z', 'M14 12h7v9h-7z', 'M3 14h7v7H3z'],
  siren: ['M7 18v-6a5 5 0 0 1 10 0v6', 'M5 21h14', 'M10 6l1-3 1 3', 'M3.5 9.5 1 8', 'M22.5 9.5 20 8'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 2 8 2 8H4s2-1 2-8', 'M10.3 21a1.9 1.9 0 0 0 3.4 0'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M20 20l-4-4'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
  monitor: ['M3 4h18v12H3z', 'M8 20h8', 'M12 16v4'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronUp: ['M6 15l6-6 6 6'],
  chevronRight: ['M9 6l6 6-6 6'],
  chevronLeft: ['M15 6l-6 6 6 6'],
  arrowRight: ['M4 12h16', 'M14 6l6 6-6 6'],
  arrowUpRight: ['M7 17 17 7', 'M8 7h9v9'],
  arrowLeft: ['M20 12H4', 'M10 6l-6 6 6 6'],
  users: ['M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 6a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z', 'M22 20v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  user: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
  userPlus: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M19 8v6', 'M22 11h-6'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  shieldCheck: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
  shieldAlert: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M12 8v4', 'M12 16h.01'],
  building: ['M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17', 'M15 9h4a1 1 0 0 1 1 1v11', 'M2 21h20', 'M8 7h3', 'M8 11h3', 'M8 15h3'],
  briefcase: ['M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z', 'M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2', 'M3 13h18'],
  layers: ['M12 2 3 7l9 5 9-5-9-5z', 'M3 12l9 5 9-5', 'M3 17l9 5 9-5'],
  map: ['M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2z', 'M9 3v16', 'M15 5v16'],
  mapPin: ['M12 22s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12z', 'M12 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  activity: ['M3 12h4l3 8 4-16 3 8h4'],
  gauge: ['M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M13.4 12.6 20 6', 'M3 20a9 9 0 1 1 18 0'],
  chartBar: ['M3 21h18', 'M6 10v8', 'M11 6v12', 'M16 13v5', 'M21 3v18'],
  chartLine: ['M3 3v18h18', 'M6 15l4-5 4 3 5-7'],
  chartPie: ['M12 3a9 9 0 1 0 9 9h-9z', 'M14 3.5A9 9 0 0 1 20.5 10H14z'],
  trendingUp: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  alertTriangle: ['M12 4 2.5 20h19z', 'M12 10v4', 'M12 18h.01'],
  alertCircle: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8v4', 'M12 16h.01'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 11v5', 'M12 8h.01'],
  check: ['M4 12.5 9 17.5 20 6.5'],
  checkCircle: ['M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z', 'M8.5 12.5 11 15l4.5-5'],
  xCircle: ['M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z', 'M9 9l6 6', 'M15 9l-6 6'],
  helpCircle: ['M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z', 'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1 .9-1 1.7', 'M12 17h.01'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7.5V12l3 2'],
  calendar: ['M4 5h16v16H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  filter: ['M3 5h18l-7 8v6l-4 2v-8z'],
  download: ['M12 3v12', 'M7 11l5 5 5-5', 'M4 21h16'],
  upload: ['M12 21V9', 'M7 13l5-5 5 5', 'M4 3h16'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  pencil: ['M4 20h4l10-10-4-4L4 16z', 'M14 6l4 4'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6'],
  eye: ['M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z', 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'],
  eyeOff: ['M3 3l18 18', 'M10.6 6.2A9.6 9.6 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-2.6 3.3', 'M6.4 8.1A17.5 17.5 0 0 0 2 12s3.6 6 10 6a10 10 0 0 0 4-.8'],
  settings: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1 2 2 0 1 1-4 0 1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.4a2 2 0 1 1 4 0 1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20 11a2 2 0 1 1 0 4z'],
  sliders: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  scroll: ['M6 3h11a2 2 0 0 1 2 2v13a3 3 0 0 0 3 3H8a3 3 0 0 1-3-3V6', 'M6 3a2 2 0 0 0-2 2v1h4', 'M9 8h7', 'M9 12h7', 'M9 16h4'],
  fileText: ['M6 2h8l5 5v15H6z', 'M14 2v5h5', 'M9 13h6', 'M9 17h6'],
  clipboard: ['M9 3h6v3H9z', 'M8 5H6v16h12V5h-2', 'M9 12h6', 'M9 16h4'],
  folder: ['M3 6h6l2 2h10v12H3z'],
  inbox: ['M3 12h5l1 3h6l1-3h5', 'M5 4h14l2 8v8H3v-8z'],
  server: ['M4 4h16v6H4z', 'M4 14h16v6H4z', 'M8 7h.01', 'M8 17h.01'],
  database: ['M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z', 'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'],
  hardDrive: ['M4 6h16v12H4z', 'M4 14h16', 'M8 17h.01'],
  zap: ['M13 2 4 14h7l-1 8 9-12h-7z'],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  key: ['M15 8a5 5 0 1 0-4.6 5H13l2 2 2-2 2 2 2-2-3.4-3.4A5 5 0 0 0 15 8z'],
  globe: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z'],
  phone: ['M5 3h3l2 5-2 1.5a12 12 0 0 0 6.5 6.5L16 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z'],
  mail: ['M3 5h18v14H3z', 'M3 6l9 7 9-7'],

  megaphone: ['M3 11v3l12 5V6z', 'M15 8a4 4 0 0 1 0 8', 'M6 14v5h3'],
  refresh: ['M21 12a9 9 0 1 1-3-6.7', 'M21 4v5h-5'],
  logout: ['M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4', 'M10 12H3', 'M7 8l-4 4 4 4'],
  externalLink: ['M14 4h6v6', 'M20 4 10 14', 'M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5'],
  moreHorizontal: ['M6 12h.01', 'M12 12h.01', 'M18 12h.01'],
  command: ['M9 3a3 3 0 1 1-3 3v12a3 3 0 1 1 3-3h6a3 3 0 1 1 3 3V6a3 3 0 1 1-3 3z'],
  sparkles: ['M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z', 'M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z'],
  cpu: ['M6 6h12v12H6z', 'M10 10h4v4h-4z', 'M9 2v3', 'M15 2v3', 'M9 19v3', 'M15 19v3', 'M2 9h3', 'M2 15h3', 'M19 9h3', 'M19 15h3'],
  network: ['M9 2h6v4H9z', 'M2 16h6v4H2z', 'M16 16h6v4h-6z', 'M12 6v5', 'M5 16v-3h14v3'],
  flame: ['M12 2c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z'],
  heart: ['M12 20s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.6 12 20 12 20z'],
  car: ['M5 12h14', 'M4 16l1.5-6h13L20 16', 'M6.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'M17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'M4 16h16'],
  droplet: ['M12 3s6 6.4 6 10.5A6 6 0 0 1 6 13.5C6 9.4 12 3 12 3z'],
  wrench: ['M14.5 6a4.5 4.5 0 1 0 3 8l3 3-2.5 2.5-3-3a4.5 4.5 0 0 1-6-6z'],
  hospital: ['M4 3h16v18H4z', 'M12 8v6', 'M9 11h6'],
  target: ['M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M12 12h.01'],
  timer: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M12 8v4l3 2', 'M9 2h6'],
  columns: ['M4 4h16v16H4z', 'M10 4v16', 'M16 4v16'],
  grid: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  table: ['M3 5h18v14H3z', 'M3 10h18', 'M3 15h18', 'M9 5v14'],
  copy: ['M9 9h11v11H9z', 'M15 5H4v11h2'],
  star: ['M12 3.5l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.9l6.1-.8z'],
  send: ['M22 2 11 13', 'M22 2l-7 20-4-9-9-4z'],
  radio: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M5.6 5.6a9 9 0 0 0 0 12.8', 'M18.4 5.6a9 9 0 0 1 0 12.8', 'M8.5 8.5a5 5 0 0 0 0 7', 'M15.5 8.5a5 5 0 0 1 0 7'],
  wifi: ['M5 12.5a11 11 0 0 1 14 0', 'M8.5 15.5a6 6 0 0 1 7 0', 'M12 19h.01', 'M2 9a16 16 0 0 1 20 0'],
  panelLeft: ['M3 4h18v16H3z', 'M9 4v16'],
  keyboard: ['M2 6h20v12H2z', 'M6 10h.01', 'M10 10h.01', 'M14 10h.01', 'M18 10h.01', 'M7 14h10'],
  circle: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'],
  dot: ['M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z'],
  building2: ['M6 21V7l6-4 6 4v14', 'M2 21h20', 'M10 21v-4h4v4', 'M10 9h.01', 'M14 9h.01', 'M10 13h.01', 'M14 13h.01'],
  route: ['M6 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', 'M18 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', 'M8 7h6a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8h6'],
  clipboardList: ['M9 3h6v3H9z', 'M8 5H6v16h12V5h-2', 'M9 11h6', 'M9 15h4'],
  box: ['M12 2 3 6.5v11L12 22l9-4.5v-11z', 'M3 6.5 12 11l9-4.5', 'M12 11v11'],
  userCheck: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M16 11l2 2 4-4']
};

export const iconNames = Object.keys(paths);

function Icon({ name, size = 18, strokeWidth = 1.75, className = '', title, ...rest }) {
  const shape = paths[name] || paths.circle;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {shape.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

export default memo(Icon);

