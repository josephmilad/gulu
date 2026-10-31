import type { SVGProps } from "react";

function Svg({ children, ...p }: SVGProps<SVGSVGElement>) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" {...p}>
      {children}
    </svg>
  );
}

export const SearchIcon = () => (<Svg><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>);
export const HeartIcon = () => (<Svg><path d="M12 20.5s-7.5-4.4-9.3-9.2C1.5 8 3.7 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.6 0 5.8 3.5 4.6 6.8-1.8 4.8-9.3 9.2-9.3 9.2z" /></Svg>);
export const HomeIcon = () => (<Svg><path d="M3.5 10.5 12 4l8.5 6.5V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z" /></Svg>);
export const GridIcon = () => (<Svg><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></Svg>);
export const SlidersIcon = () => (<Svg><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></Svg>);
export const SortIcon = () => (<Svg><path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" /></Svg>);
export const XIcon = () => (<Svg><path d="M6 6l12 12M18 6 6 18" /></Svg>);
export const ChevronLeft = () => (<Svg><path d="M15 5l-7 7 7 7" /></Svg>);
export const ChevronRight = () => (<Svg><path d="M9 5l7 7-7 7" /></Svg>);
export const ArrowUpRight = () => (<Svg style={{ width: 18, height: 18 }}><path d="M7 17 17 7M9 7h8v8" /></Svg>);
