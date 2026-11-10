import {
  LayoutDashboard,
  BookOpen,
  Hash,
  Bot,
  HelpCircle,
  Mail,
  Home,
  Server,
  ShieldCheck,
  ListChecks,
  FileClock,
  Gauge,
  FileBarChart,
  Users,
  FileText,
  DoorOpen,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  name: string;
  href: string;
  icon?: LucideIcon;
  children?: { name: string; href: string }[];
};

export const publicNav: NavItem[] = [
  { name: "Home", href: "/", icon: Home },
  { name: "Govi Advisor", href: "/govi", icon: Bot },
  { name: "FAQ", href: "/faq", icon: HelpCircle },
  { name: "Contact", href: "/contact", icon: Mail },
];

export type NavGroup = { label: string; items: NavItem[] };

/** Signed-in navigation, grouped the way the sidebar presents it. */
export const authedNavGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Govi", href: "/govi", icon: Sparkles },
    ],
  },
  {
    label: "Governance",
    items: [
      { name: "Inventory", href: "/inventory", icon: Server },
      { name: "Gates", href: "/gates", icon: DoorOpen },
      { name: "Compliance", href: "/compliance", icon: ShieldCheck },
      { name: "Maturity", href: "/maturity", icon: Gauge },
      { name: "Tasks", href: "/tasks", icon: ListChecks },
    ],
  },
  {
    label: "Evidence",
    items: [
      { name: "Library", href: "/library", icon: FileText },
      { name: "Audit", href: "/audit", icon: FileClock },
      { name: "Report", href: "/report", icon: FileBarChart },
    ],
  },
  {
    label: "Learn",
    items: [
      { name: "Playbooks", href: "/playbooks", icon: BookOpen },
      { name: "Topics", href: "/topics", icon: Hash },
    ],
  },
  {
    label: "Organization",
    items: [
      { name: "Team", href: "/team", icon: Users },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

/** Flat list (mobile menu). */
export const authedNav: NavItem[] = authedNavGroups.flatMap((g) => g.items);

/**
 * Whether a nav item is the current page. "/" is matched exactly, except that
 * the signed-in dashboard is served at both "/" and "/dashboard" (the sign-in
 * callback lands on the latter), so "/dashboard" also lights up the "/" item.
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname === "/dashboard";
  return pathname.startsWith(href);
}
