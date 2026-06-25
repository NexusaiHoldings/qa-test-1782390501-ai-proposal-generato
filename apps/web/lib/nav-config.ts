export interface NavItem {
  label: string;
  href: string;
}

/**
 * Top navigation configuration consumed by the substrate <TopNav />.
 * Includes links to every feature page in the MVP scope.
 */
export const NAV_CONFIG: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Conversation", href: "/conversation" },
  { label: "Work", href: "/work" },
  { label: "Artifacts", href: "/artifact" },
  { label: "Approvals", href: "/approval" },
  { label: "Direct", href: "/direct" },
];
