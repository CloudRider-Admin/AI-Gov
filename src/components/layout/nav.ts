import {
  LayoutDashboard,
  BookOpen,
  Hash,
  Bot,
  HelpCircle,
  Mail,
  Home,
  Tag,
  Server,
  ShieldCheck,
  ListChecks,
  FileClock,
  Gauge,
  FileBarChart,
  Users,
  FileText,
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
  { name: "Pricing", href: "/pricing", icon: Tag },
  { name: "FAQ", href: "/faq", icon: HelpCircle },
  { name: "Contact", href: "/contact", icon: Mail },
];

export const authedNav: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Govi", href: "/govi", icon: Bot },
  { name: "Maturity", href: "/maturity", icon: Gauge },
  { name: "Inventory", href: "/inventory", icon: Server },
  { name: "Compliance", href: "/compliance", icon: ShieldCheck },
  { name: "Tasks", href: "/tasks", icon: ListChecks },
  { name: "Library", href: "/library", icon: FileText },
  { name: "Audit", href: "/audit", icon: FileClock },
  { name: "Report", href: "/report", icon: FileBarChart },
  { name: "Team", href: "/team", icon: Users },
  { name: "Playbooks", href: "/playbooks", icon: BookOpen },
  { name: "Topics", href: "/topics", icon: Hash },
];
