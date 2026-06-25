export interface NavLink {
  label: string;
  href: string;
}

export interface NavGroup {
  label: string;
  links: NavLink[];
}

export interface NavConfig {
  primary: NavLink[];
  groups: NavGroup[];
}

/** Top navigation consumed by the substrate <TopNav />. */
export const NAV_CONFIG: NavConfig = {
  primary: [
    { label: "Home", href: "/" },
    { label: "Assistant", href: "/assistant" },
    { label: "Work", href: "/work" },
    { label: "Approvals", href: "/approval" },
    { label: "Artifacts", href: "/artifact" },
  ],
  groups: [
    {
      label: "Tools",
      links: [
        { label: "Files", href: "/files" },
        { label: "Notifications", href: "/notifications" },
        { label: "Support", href: "/support" },
        { label: "Developers", href: "/developers" },
      ],
    },
  ],
};
