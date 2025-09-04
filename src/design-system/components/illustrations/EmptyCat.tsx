interface EmptyCatProps {
  className?: string;
}

export function EmptyCat({ className = "w-24 h-24" }: EmptyCatProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Cat Body */}
      <ellipse 
        cx="100" 
        cy="120" 
        rx="45" 
        ry="35" 
        fill="none" 
        stroke="#666666" 
        strokeWidth="2"
      />
      
      {/* Cat Head */}
      <circle 
        cx="100" 
        cy="70" 
        r="35" 
        fill="none" 
        stroke="#666666" 
        strokeWidth="2"
      />
      
      {/* Cat Ears */}
      <path 
        d="M75 45 L85 25 L95 45" 
        fill="none" 
        stroke="#666666" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M105 45 L115 25 L125 45" 
        fill="none" 
        stroke="#666666" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      
      {/* Cat Eyes */}
      <circle cx="88" cy="65" r="3" fill="#666666" />
      <circle cx="112" cy="65" r="3" fill="#666666" />
      
      {/* Cat Nose */}
      <path 
        d="M100 75 L95 82 L105 82 Z" 
        fill="#666666"
      />
      
      {/* Cat Mouth */}
      <path 
        d="M100 82 Q95 88 90 85" 
        fill="none" 
        stroke="#666666" 
        strokeWidth="2" 
        strokeLinecap="round"
      />
      <path 
        d="M100 82 Q105 88 110 85" 
        fill="none" 
        stroke="#666666" 
        strokeWidth="2" 
        strokeLinecap="round"
      />
      
      {/* Cat Whiskers */}
      <line x1="65" y1="70" x2="80" y2="72" stroke="#666666" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="65" y1="78" x2="80" y2="78" stroke="#666666" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="120" y1="72" x2="135" y2="70" stroke="#666666" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="120" y1="78" x2="135" y2="78" stroke="#666666" strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Cat Tail */}
      <path 
        d="M145 110 Q160 100 165 85 Q170 70 160 60" 
        fill="none" 
        stroke="#666666" 
        strokeWidth="2" 
        strokeLinecap="round"
      />
      
      {/* Cat Paws */}
      <ellipse cx="80" cy="150" rx="8" ry="5" fill="none" stroke="#666666" strokeWidth="1.5" />
      <ellipse cx="120" cy="150" rx="8" ry="5" fill="none" stroke="#666666" strokeWidth="1.5" />
    </svg>
  );
}