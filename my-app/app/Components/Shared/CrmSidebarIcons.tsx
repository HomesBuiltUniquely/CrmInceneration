import { cn } from "@/lib/cn";

type CrmSidebarIconProps = {
  name: string;
  className?: string;
};

const SW = 1.75;

export const FLATICON_ICON_SRC: Record<string, string> = {
  "presales-dashboard-flaticon": "/icons/presales-dashboard-flaticon.png",
};

/** White-on-black PNGs rendered on the blue app tile via screen blend. */
const BLEND_SCREEN_ICON_SRC: Record<string, string> = {
  "crm-dashboard-flaticon": "/icons/crm-dashboard-icon.png",
  "crm-my-leads-flaticon": "/icons/crm-my-leads-icon.png",
  "crm-incentives-flaticon": "/icons/crm-incentives-icon.png",
  "crm-create-lead-flaticon": "/icons/crm-create-lead-icon.png",
  "crm-import-leads-flaticon": "/icons/crm-import-leads-icon.png",
  "crm-hub-calendar-flaticon": "/icons/crm-hub-calendar-icon.png",
  "crm-booking-token-flaticon": "/icons/crm-booking-token-icon.png",
  "design-module-flaticon": "/icons/design-module-icon.png",
  "designer-dashboard-flaticon": "/icons/designer-dashboard-icon.png",
  "appointment-flaticon": "/icons/appointment-icon.png",
  "admin-panel-flaticon": "/icons/admin-panel-icon.png",
};

const IMAGE_SIDEBAR_ICONS = new Set([
  ...Object.keys(FLATICON_ICON_SRC),
  ...Object.keys(BLEND_SCREEN_ICON_SRC),
]);

/** @deprecated dashboard uses inline SVG */
export const CRM_DASHBOARD_ICON_SRC = "/icons/crm-dashboard-icon.png";

export function isImageSidebarIcon(name: string): boolean {
  return IMAGE_SIDEBAR_ICONS.has(name);
}

export function CrmSidebarIcon({ name, className }: CrmSidebarIconProps) {
  const blendSrc = BLEND_SCREEN_ICON_SRC[name];
  if (blendSrc) {
    return (
      <img
        src={blendSrc}
        alt=""
        aria-hidden="true"
        className={cn("h-5 w-5 object-contain mix-blend-screen", className)}
      />
    );
  }

  const imageSrc = FLATICON_ICON_SRC[name];
  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt=""
        aria-hidden="true"
        className={cn("h-5 w-5 object-contain", className)}
      />
    );
  }

  const baseProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className: cn("h-5 w-5", className),
  };

  switch (name) {
    case "layout-dashboard":
      return (
        <svg {...baseProps}>
          <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth={SW} />
          <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth={SW} />
          <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth={SW} />
          <rect x="13" y="13" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth={SW} />
        </svg>
      );
    case "leads":
      return (
        <svg {...baseProps}>
          <path
            d="M4.5 5.5H19.5L15.5 11.5H8.5L4.5 5.5Z"
            stroke="currentColor"
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          <path
            d="M8.5 11.5L6.5 18.5H17.5L15.5 11.5"
            stroke="currentColor"
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          <circle cx="12" cy="15.5" r="1.1" fill="currentColor" />
        </svg>
      );
    case "user-plus":
      return (
        <svg {...baseProps}>
          <circle cx="9.5" cy="8.5" r="3" stroke="currentColor" strokeWidth={SW} />
          <path
            d="M4.5 18.5C5.2 16.2 7.1 14.8 9.5 14.8C11.9 14.8 13.8 16.2 14.5 18.5"
            stroke="currentColor"
            strokeWidth={SW}
            strokeLinecap="round"
          />
          <path d="M17.5 8V14" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <path d="M14.5 11H20.5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "file-spreadsheet":
      return (
        <svg {...baseProps}>
          <path
            d="M7 4.5H14.2L18 8.3V19.5H7C5.9 19.5 5 18.6 5 17.5V6.5C5 5.4 5.9 4.5 7 4.5Z"
            stroke="currentColor"
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          <path d="M14 4.5V8.5H18" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
          <path d="M8 11.5H15.5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <path d="M8 14.5H15.5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <path d="M8 17H12.5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <path
            d="M16.5 15.5L18.5 13.5L20.5 15.5"
            stroke="currentColor"
            strokeWidth={SW}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "trophy":
      return (
        <svg {...baseProps}>
          <path
            d="M8 5.5H16V8.5C16 10.4 14.7 12 13 12.3V14.5H11V12.3C9.3 12 8 10.4 8 8.5V5.5Z"
            stroke="currentColor"
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          <path d="M10 14.5H14V16.5H10V14.5Z" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
          <path d="M9 16.5H15V18.5H9V16.5Z" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
          <path d="M6.5 6H5C5 8.2 6.4 10 8.3 10.4" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <path d="M17.5 6H19C19 8.2 17.6 10 15.7 10.4" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...baseProps}>
          <rect x="4" y="8.5" width="16" height="10" rx="2" stroke="currentColor" strokeWidth={SW} />
          <path d="M9 8.5V7.5C9 6.7 9.7 6 10.5 6H13.5C14.3 6 15 6.7 15 7.5V8.5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <path d="M4 12.5H20" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "headset":
      return (
        <svg {...baseProps}>
          <path
            d="M5.5 12.5V11.5C5.5 8.46 8.46 5.5 12 5.5C15.54 5.5 18.5 8.46 18.5 11.5V12.5"
            stroke="currentColor"
            strokeWidth={SW}
            strokeLinecap="round"
          />
          <rect x="4" y="12" width="3.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth={SW} />
          <rect x="16.5" y="12" width="3.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth={SW} />
          <path d="M7.5 17.5H10.5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "booking-token":
      return (
        <svg {...baseProps}>
          <circle cx="9" cy="14" r="4.5" stroke="currentColor" strokeWidth={SW} />
          <path
            d="M12.5 10.5L16.5 6.5C17.3 5.7 18.5 5.7 19.3 6.5C20.1 7.3 20.1 8.5 19.3 9.3L15.3 13.3"
            stroke="currentColor"
            strokeWidth={SW}
            strokeLinecap="round"
          />
          <path d="M7.5 14H10.5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <path d="M9 12.5V15.5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "users":
      return (
        <svg {...baseProps}>
          <circle cx="9" cy="8.5" r="3" stroke="currentColor" strokeWidth={SW} />
          <path
            d="M4 18.5C4.8 16 6.7 14.5 9 14.5C11.3 14.5 13.2 16 14 18.5"
            stroke="currentColor"
            strokeWidth={SW}
            strokeLinecap="round"
          />
          <path
            d="M16.5 9.5C17.8 9.9 18.7 11.1 18.7 12.5C18.7 13.4 18.3 14.2 17.6 14.8"
            stroke="currentColor"
            strokeWidth={SW}
            strokeLinecap="round"
          />
          <path
            d="M15.5 18.5C16 17.2 17.1 16.2 18.5 15.8"
            stroke="currentColor"
            strokeWidth={SW}
            strokeLinecap="round"
          />
        </svg>
      );
    case "chart":
      return (
        <svg {...baseProps}>
          <path d="M4 19H20" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <path d="M7 17V11" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <path d="M12 17V7" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <path d="M17 17V13" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "plus":
      return (
        <svg {...baseProps}>
          <path d="M12 5V19" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <path d="M5 12H19" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "upload":
      return (
        <svg {...baseProps}>
          <path d="M12 15V5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <path d="M8.5 8.5L12 5L15.5 8.5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 15.5V17C5 18.1 5.9 19 7 19H17C18.1 19 19 18.1 19 17V15.5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...baseProps}>
          <rect x="4" y="5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth={SW} />
          <path d="M8 3.8V6.2" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <path d="M16 3.8V6.2" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <path d="M4 9H20" stroke="currentColor" strokeWidth={SW} />
          <rect x="8" y="12" width="3" height="3" rx="0.6" fill="currentColor" />
        </svg>
      );
    case "palette":
      return (
        <svg {...baseProps}>
          <path
            d="M12 4C7.58 4 4 7.13 4 11C4 13.76 6.02 16 8.5 16H9.27C10.23 16 11 16.77 11 17.73C11 18.98 12.02 20 13.27 20H13.5C17.64 20 21 16.64 21 12.5C21 7.81 17.08 4 12 4Z"
            stroke="currentColor"
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          <circle cx="8" cy="11" r="1" fill="currentColor" />
          <circle cx="11" cy="8" r="1" fill="currentColor" />
          <circle cx="15" cy="8.5" r="1" fill="currentColor" />
          <circle cx="16.5" cy="12.5" r="1" fill="currentColor" />
        </svg>
      );
    case "settings":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth={SW} />
          <path
            d="M12 4.2V6.2M12 17.8V19.8M4.2 12H6.2M17.8 12H19.8M6.1 6.1L7.5 7.5M16.5 16.5L17.9 17.9M17.9 6.1L16.5 7.5M7.5 16.5L6.1 17.9"
            stroke="currentColor"
            strokeWidth={SW}
            strokeLinecap="round"
          />
        </svg>
      );
    case "wrench":
      return (
        <svg {...baseProps}>
          <path
            d="M14.5 6.5A4 4 0 0 0 18 12L11 19L8 16L15 9A4 4 0 0 0 14.5 6.5Z"
            stroke="currentColor"
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          <path d="M6 18L4 20" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "id-card":
      return (
        <svg {...baseProps}>
          <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth={SW} />
          <circle cx="9" cy="11" r="2" stroke="currentColor" strokeWidth={1.6} />
          <path d="M6.8 15C7.4 14 8.1 13.5 9 13.5C9.9 13.5 10.6 14 11.2 15" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
          <path d="M13.5 10H17.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
          <path d="M13.5 13H17.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...baseProps}>
          <path d="M7 4.5H17V19.5L15 18L13 19.5L11 18L9 19.5L7 18V4.5Z" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
          <path d="M9.5 9H14.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
          <path d="M9.5 12H14.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      );
    case "home":
      return (
        <svg {...baseProps}>
          <path d="M4 11.5L12 5L20 11.5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6.5 10.8V19H17.5V10.8" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
          <path d="M10.2 19V14H13.8V19" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
        </svg>
      );
    case "gift":
      return (
        <svg {...baseProps}>
          <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth={SW} />
          <path d="M12 10V20" stroke="currentColor" strokeWidth={SW} />
          <path d="M4 13.5H20" stroke="currentColor" strokeWidth={SW} />
          <path d="M12 10H8.8A1.8 1.8 0 1 1 10.4 7.2L12 10Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
          <path d="M12 10H15.2A1.8 1.8 0 1 0 13.6 7.2L12 10Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
      );
    case "folder":
      return (
        <svg {...baseProps}>
          <path d="M3.8 8.2A2.2 2.2 0 0 1 6 6H9L10.7 7.6H18A2.2 2.2 0 0 1 20.2 9.8V17A2.2 2.2 0 0 1 18 19.2H6A2.2 2.2 0 0 1 3.8 17V8.2Z" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...baseProps}>
          <path d="M12 4.5L13.4 8.3L17.2 9.7L13.4 11.1L12 14.9L10.6 11.1L6.8 9.7L10.6 8.3L12 4.5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
          <path d="M18.5 4.8L19 6.2L20.4 6.7L19 7.2L18.5 8.6L18 7.2L16.6 6.7L18 6.2L18.5 4.8Z" fill="currentColor" />
        </svg>
      );
    case "grid":
      return (
        <svg {...baseProps}>
          <rect x="4" y="4" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth={SW} />
          <rect x="14" y="4" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth={SW} />
          <rect x="4" y="14" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth={SW} />
          <rect x="14" y="14" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth={SW} />
        </svg>
      );
    case "note":
      return (
        <svg {...baseProps}>
          <path d="M7 4.5H14.5L18 8V19.5H7C5.9 19.5 5 18.6 5 17.5V6.5C5 5.4 5.9 4.5 7 4.5Z" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
          <path d="M14 4.5V8H17.5" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
          <path d="M8.5 11H14.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
          <path d="M8.5 14H14.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      );
    case "map-pin":
      return (
        <svg {...baseProps}>
          <path d="M12 20C12 20 18 14.5 18 10A6 6 0 1 0 6 10C6 14.5 12 20 12 20Z" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth={SW} />
        </svg>
      );
    case "clock":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth={SW} />
          <path d="M12 8V12L14.5 14" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "message":
      return (
        <svg {...baseProps}>
          <path d="M6 17.5L4.5 19V7C4.5 5.9 5.4 5 6.5 5H17.5C18.6 5 19.5 5.9 19.5 7V14C19.5 15.1 18.6 16 17.5 16H7.5L6 17.5Z" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
        </svg>
      );
    case "box":
      return (
        <svg {...baseProps}>
          <path d="M12 3.5L19 7.5V16.5L12 20.5L5 16.5V7.5L12 3.5Z" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
          <path d="M5 7.5L12 11.5L19 7.5" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
          <path d="M12 11.5V20.5" stroke="currentColor" strokeWidth={SW} />
        </svg>
      );
    case "check-circle":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth={SW} />
          <path d="M8.5 12.2L10.7 14.3L15.5 9.7" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "activity":
      return (
        <svg {...baseProps}>
          <path d="M4 12H8L10 7L14 17L16 12H20" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "bell":
      return (
        <svg {...baseProps}>
          <path d="M8 18H16" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <path d="M9 18C9.3 19.2 10.4 20 11.7 20H12.3C13.6 20 14.7 19.2 15 18" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <path d="M18 15H6L7.2 13.4V10.5C7.2 7.74 9.44 5.5 12.2 5.5C14.96 5.5 17.2 7.74 17.2 10.5V13.4L18 15Z" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
        </svg>
      );
    case "pen-ruler":
      return (
        <svg {...baseProps}>
          <path d="M4 18.5L14.5 8L16 9.5L5.5 20H4V18.5Z" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
          <path d="M12.5 5.5L18.5 11.5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <path d="M8 16L10 18" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth={SW} />
        </svg>
      );
  }
}

/** Semantic icon per apps-launcher item id. */
export function resolveAppLauncherIcon(itemId: string, fallbackIcon?: string): string {
  const iconByItem: Record<string, string> = {
    "crm-dashboard": "crm-dashboard-flaticon",
    "presales-dashboard": "presales-dashboard-flaticon",
    "crm-my-leads": "crm-my-leads-flaticon",
    "presales-my-leads": "crm-my-leads-flaticon",
    "crm-incentives": "crm-incentives-flaticon",
    "crm-create-lead": "crm-create-lead-flaticon",
    "presales-create-lead": "crm-create-lead-flaticon",
    "crm-import-leads": "crm-import-leads-flaticon",
    "crm-hub-calendar": "crm-hub-calendar-flaticon",
    "design-appointment": "appointment-flaticon",
    "crm-sales-managers": "briefcase",
    "crm-presales-executives": "headset",
    "crm-booking-token": "crm-booking-token-flaticon",
    "design-designer-dashboard": "designer-dashboard-flaticon",
    "design-module": "design-module-flaticon",
    "design-create-user": "user-plus",
    "admin-panel": "admin-panel-flaticon",
  };

  return iconByItem[itemId] ?? fallbackIcon ?? "grid";
}

/** Lighter Hows blue tile behind white blend icons. */
const HOWS_FLATICON_TILE = {
  idle: "bg-[#6BC5F0]",
  active: "bg-[#4DB8EE] ring-2 ring-[#1DA1E6]/25",
} as const;

function flaticonTileTone() {
  return HOWS_FLATICON_TILE;
}

const ICON_TILE_TONES: Record<string, { idle: string; active: string }> = {
  "layout-dashboard": {
    idle: "from-[#dbeafe] to-[#bfdbfe] text-[#1d4ed8]",
    active: "from-[#2563eb] to-[#1d4ed8] text-white",
  },
  "crm-dashboard-flaticon": flaticonTileTone(),
  "presales-dashboard-flaticon": flaticonTileTone(),
  "crm-my-leads-flaticon": flaticonTileTone(),
  "crm-incentives-flaticon": flaticonTileTone(),
  "crm-create-lead-flaticon": flaticonTileTone(),
  "crm-import-leads-flaticon": flaticonTileTone(),
  "crm-hub-calendar-flaticon": flaticonTileTone(),
  "crm-booking-token-flaticon": flaticonTileTone(),
  "design-module-flaticon": flaticonTileTone(),
  "designer-dashboard-flaticon": flaticonTileTone(),
  "appointment-flaticon": flaticonTileTone(),
  "admin-panel-flaticon": flaticonTileTone(),
  leads: {
    idle: "from-[#cffafe] to-[#a5f3fc] text-[#0e7490]",
    active: "from-[#0891b2] to-[#0e7490] text-white",
  },
  "user-plus": {
    idle: "from-[#d1fae5] to-[#a7f3d0] text-[#047857]",
    active: "from-[#059669] to-[#047857] text-white",
  },
  "file-spreadsheet": {
    idle: "from-[#ffedd5] to-[#fed7aa] text-[#c2410c]",
    active: "from-[#ea580c] to-[#c2410c] text-white",
  },
  calendar: {
    idle: "from-[#ede9fe] to-[#ddd6fe] text-[#6d28d9]",
    active: "from-[#7c3aed] to-[#6d28d9] text-white",
  },
  trophy: {
    idle: "from-[#fef3c7] to-[#fde68a] text-[#b45309]",
    active: "from-[#d97706] to-[#b45309] text-white",
  },
  briefcase: {
    idle: "from-[#e0e7ff] to-[#c7d2fe] text-[#4338ca]",
    active: "from-[#4f46e5] to-[#4338ca] text-white",
  },
  headset: {
    idle: "from-[#ccfbf1] to-[#99f6e4] text-[#0f766e]",
    active: "from-[#0d9488] to-[#0f766e] text-white",
  },
  "booking-token": {
    idle: "from-[#ccfbf1] to-[#99f6e4] text-[#0f766e]",
    active: "from-[#0d9488] to-[#0f766e] text-white",
  },
  palette: {
    idle: "from-[#fce7f3] to-[#fbcfe8] text-[#be185d]",
    active: "from-[#db2777] to-[#be185d] text-white",
  },
  "pen-ruler": {
    idle: "from-[#fce7f3] to-[#fbcfe8] text-[#be185d]",
    active: "from-[#db2777] to-[#be185d] text-white",
  },
  settings: {
    idle: "from-[#e2e8f0] to-[#cbd5e1] text-[#475569]",
    active: "from-[#64748b] to-[#475569] text-white",
  },
  chart: {
    idle: "from-[#dbeafe] to-[#bfdbfe] text-[#1d4ed8]",
    active: "from-[#2563eb] to-[#1d4ed8] text-white",
  },
  users: {
    idle: "from-[#cffafe] to-[#a5f3fc] text-[#0e7490]",
    active: "from-[#0891b2] to-[#0e7490] text-white",
  },
  plus: {
    idle: "from-[#d1fae5] to-[#a7f3d0] text-[#047857]",
    active: "from-[#059669] to-[#047857] text-white",
  },
  upload: {
    idle: "from-[#ffedd5] to-[#fed7aa] text-[#c2410c]",
    active: "from-[#ea580c] to-[#c2410c] text-white",
  },
  receipt: {
    idle: "from-[#ccfbf1] to-[#99f6e4] text-[#0f766e]",
    active: "from-[#0d9488] to-[#0f766e] text-white",
  },
};

export function appIconTileClass(icon: string, isActive: boolean): string {
  const tone = ICON_TILE_TONES[icon] ?? ICON_TILE_TONES["layout-dashboard"];
  const isSolidTile = tone.idle.startsWith("bg-[");
  return cn(
    "transition-colors duration-200 ease-out",
    isSolidTile ? "" : "bg-gradient-to-br",
    isActive
      ? `${tone.active} shadow-sm`
      : `${tone.idle} ${isSolidTile ? "group-hover:brightness-105" : "group-hover:brightness-[1.02]"}`,
  );
}
