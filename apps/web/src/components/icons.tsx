interface IconProps {
  className?: string;
  size?: number;
}

export function IconMap({ className, size = 28 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Map paper */}
      <path d="M12 10C12 8 14 6 16 8L22 14V54L16 58C14 60 12 58 12 56V10Z" fill="#E8D5B7" stroke="#2D2D2D" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M22 14L42 8V48L22 54V14Z" fill="#7CC8F0" stroke="#2D2D2D" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M42 8L52 12C54 13 54 15 54 15V52C54 54 52 55 50 54L42 48V8Z" fill="#E8D5B7" stroke="#2D2D2D" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Land patches */}
      <path d="M24 18C27 16 30 20 28 24C26 28 22 26 24 22" fill="#8BC34A" stroke="#2D2D2D" strokeWidth="1.5" />
      <path d="M36 14C40 12 42 18 38 20C34 22 32 16 36 14Z" fill="#8BC34A" stroke="#2D2D2D" strokeWidth="1.5" />
      <path d="M26 38C30 36 34 40 30 44C26 48 22 42 26 38Z" fill="#8BC34A" stroke="#2D2D2D" strokeWidth="1.5" />
      {/* Dashed path */}
      <path d="M28 20L32 28L36 24L34 34L30 40" stroke="#2D2D2D" strokeWidth="2" strokeDasharray="3 3" strokeLinecap="round" />
      {/* Location pin */}
      <g transform="translate(28, 26)">
        <path d="M6 0C2.7 0 0 2.7 0 6C0 10.5 6 16 6 16S12 10.5 12 6C12 2.7 9.3 0 6 0Z" fill="#FF4444" stroke="#2D2D2D" strokeWidth="2" />
        <circle cx="6" cy="6" r="2.5" fill="white" />
      </g>
    </svg>
  );
}

export function IconTrophy({ className, size = 28 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Cup body */}
      <path d="M18 12H46V28C46 38 38 46 32 46C26 46 18 38 18 28V12Z" fill="#FFD700" stroke="#2D2D2D" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Shine */}
      <path d="M24 16V26C24 32 28 38 32 38" stroke="#FFF176" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      {/* Left handle */}
      <path d="M18 16H14C10 16 8 20 8 24C8 28 10 32 14 32H18" stroke="#2D2D2D" strokeWidth="2.5" fill="#FFB300" strokeLinejoin="round" />
      {/* Right handle */}
      <path d="M46 16H50C54 16 56 20 56 24C56 28 54 32 50 32H46" stroke="#2D2D2D" strokeWidth="2.5" fill="#FFB300" strokeLinejoin="round" />
      {/* Base */}
      <path d="M26 46V50H38V46" stroke="#2D2D2D" strokeWidth="2.5" fill="#FFB300" />
      <path d="M22 50H42V54H22V50Z" fill="#FFB300" stroke="#2D2D2D" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Star */}
      <path d="M32 20L34 26L40 26L35 30L37 36L32 32L27 36L29 30L24 26L30 26Z" fill="#FF6F00" stroke="#2D2D2D" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function IconGroup({ className, size = 28 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Back person */}
      <circle cx="42" cy="18" r="8" fill="#7C3AED" stroke="#2D2D2D" strokeWidth="2.5" />
      <path d="M30 56V44C30 38 35 34 42 34C49 34 54 38 54 44V56" fill="#7C3AED" stroke="#2D2D2D" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Front person */}
      <circle cx="24" cy="20" r="9" fill="#A855F7" stroke="#2D2D2D" strokeWidth="2.5" />
      <path d="M10 58V44C10 37 16 32 24 32C32 32 38 37 38 44V58" fill="#A855F7" stroke="#2D2D2D" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Face details */}
      <circle cx="21" cy="19" r="1.5" fill="#2D2D2D" />
      <circle cx="27" cy="19" r="1.5" fill="#2D2D2D" />
      <path d="M22 24C23 25.5 25 25.5 26 24" stroke="#2D2D2D" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconShop({ className, size = 28 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Building */}
      <path d="M10 28H54V56H10V28Z" fill="#FF8A80" stroke="#2D2D2D" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Roof awning */}
      <path d="M8 28L12 14H52L56 28" stroke="#2D2D2D" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M8 28C8 28 10 22 16 28C22 34 22 22 28 28C34 34 34 22 40 28C46 34 46 22 52 28C58 34 56 28 56 28" fill="#FF2D78" stroke="#2D2D2D" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Door */}
      <path d="M26 56V40C26 38 28 36 32 36C36 36 38 38 38 40V56" fill="#FFB74D" stroke="#2D2D2D" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Window */}
      <rect x="14" y="34" width="8" height="8" rx="1" fill="#7CC8F0" stroke="#2D2D2D" strokeWidth="2" />
      <rect x="44" y="34" width="8" height="8" rx="1" fill="#7CC8F0" stroke="#2D2D2D" strokeWidth="2" />
      {/* Door handle */}
      <circle cx="35" cy="46" r="1.5" fill="#2D2D2D" />
      {/* Percent badge */}
      <circle cx="50" cy="18" r="8" fill="#22D1C3" stroke="#2D2D2D" strokeWidth="2" />
      <text x="50" y="22" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">%</text>
    </svg>
  );
}

export function IconProfile({ className, size = 28 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Body/shield shape */}
      <path d="M32 4L52 14V32C52 44 42 54 32 60C22 54 12 44 12 32V14L32 4Z" fill="#22D1C3" stroke="#2D2D2D" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Inner lighter area */}
      <path d="M32 10L46 18V32C46 41 39 49 32 54C25 49 18 41 18 32V18L32 10Z" fill="#4DE8DB" stroke="none" />
      {/* Avatar circle */}
      <circle cx="32" cy="26" r="8" fill="#FFB74D" stroke="#2D2D2D" strokeWidth="2.5" />
      {/* Hair */}
      <path d="M24 24C24 18 28 16 32 16C36 16 40 18 40 24" fill="#5D4037" stroke="#2D2D2D" strokeWidth="2" />
      {/* Eyes */}
      <circle cx="29" cy="26" r="1.5" fill="#2D2D2D" />
      <circle cx="35" cy="26" r="1.5" fill="#2D2D2D" />
      {/* Smile */}
      <path d="M29 30C30 31.5 34 31.5 35 30" stroke="#2D2D2D" strokeWidth="1.5" strokeLinecap="round" />
      {/* Body hint */}
      <path d="M24 40C24 36 28 34 32 34C36 34 40 36 40 40V46C38 48 26 48 24 46V40Z" fill="#FFB74D" stroke="#2D2D2D" strokeWidth="2" />
      {/* Star badge */}
      <path d="M32 46L34 50L38 50L35 52.5L36 56L32 54L28 56L29 52.5L26 50L30 50Z" fill="#FFD700" stroke="#2D2D2D" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
