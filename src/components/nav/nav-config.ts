import type { RoleKey } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Wallet,
  PieChart,
  Building2,
  TrendingUp,
  Landmark,
  Gift,
  GitBranch,
  FileText,
  LineChart,
  BookOpen,
  NotebookPen,
  CalendarCheck,
  CalendarRange,
  Paperclip,
  ShieldAlert,
  ScrollText,
  AlertTriangle,
  Brain,
  TrendingDown,
  ArrowDownToLine,
  Network,
  BarChart3,
  Layers,
  Target,
  Clock,
  Scale,
  Receipt,
  Sparkles,
  MessageSquare,
  Lightbulb,
  FileBarChart,
  FlaskConical,
  FileSpreadsheet,
  Link2,
  Upload,
  Bell,
  Settings,
  CreditCard,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: RoleKey[];
}

export interface NavSection {
  label: string | null;
  items: NavItem[];
}

const ALL_ROLES: RoleKey[] = ["TRADER", "MENTOR", "ACCOUNTANT", "ADMINISTRATOR"];

export const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [{ label: "Overview", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Portfolio",
    items: [
      { label: "Consolidated Holdings", href: "/portfolio/holdings", icon: Wallet },
      { label: "Asset Allocation", href: "/portfolio/asset-allocation", icon: PieChart },
      { label: "Sector Exposure", href: "/portfolio/sector-exposure", icon: Building2 },
      { label: "Portfolio Performance", href: "/portfolio/performance", icon: TrendingUp },
      { label: "Dividends", href: "/portfolio/dividends", icon: Landmark },
      { label: "Corporate Actions", href: "/portfolio/corporate-actions", icon: Gift },
      { label: "Investment Thesis", href: "/portfolio/theses", icon: FileText },
    ],
  },
  {
    label: "Trading",
    items: [
      { label: "Open Positions", href: "/trading/open-positions", icon: LineChart },
      { label: "Closed Trades", href: "/trading/trades", icon: BookOpen },
      { label: "Executions", href: "/trading/executions", icon: GitBranch },
      { label: "Options Strategies", href: "/trading/strategies", icon: Layers },
      { label: "Manual vs Algo", href: "/trading/manual-vs-algo", icon: Network },
      { label: "Trading Calendar", href: "/trading/calendar", icon: CalendarRange },
    ],
  },
  {
    label: "Journal",
    items: [
      { label: "Daily Journal", href: "/journal/daily", icon: NotebookPen },
      { label: "Trade Journal", href: "/trading/trades", icon: BookOpen },
      { label: "Weekly Review", href: "/journal/weekly-review", icon: CalendarCheck },
      { label: "Monthly Review", href: "/journal/monthly-review", icon: CalendarRange },
      { label: "Screenshots & Attachments", href: "/journal/attachments", icon: Paperclip },
    ],
  },
  {
    label: "Risk & Behaviour",
    items: [
      { label: "Risk Dashboard", href: "/risk/dashboard", icon: ShieldAlert },
      { label: "Trading Rules", href: "/risk/rules", icon: ScrollText },
      { label: "Rule Violations", href: "/risk/violations", icon: AlertTriangle },
      { label: "Behavioural Losses", href: "/risk/behavioural-losses", icon: Brain },
      { label: "Drawdowns", href: "/risk/drawdowns", icon: TrendingDown },
      { label: "Profit Give-Back", href: "/risk/give-back", icon: ArrowDownToLine },
      { label: "Cross-Broker Exposure", href: "/risk/cross-broker-exposure", icon: Network },
    ],
  },
  {
    label: "Analytics",
    items: [
      { label: "Performance", href: "/analytics/performance", icon: BarChart3 },
      { label: "Strategy Analysis", href: "/analytics/strategy", icon: Layers },
      { label: "Setup Analysis", href: "/analytics/setup", icon: Target },
      { label: "Time Analysis", href: "/analytics/time", icon: Clock },
      { label: "Broker Comparison", href: "/analytics/broker-comparison", icon: Scale },
      { label: "Charges Analysis", href: "/analytics/charges", icon: Receipt },
    ],
  },
  {
    label: "AI Coach",
    items: [
      { label: "AI Chat", href: "/ai-coach/chat", icon: MessageSquare },
      { label: "AI Insights", href: "/ai-coach/insights", icon: Lightbulb },
      { label: "Weekly Coach Report", href: "/ai-coach/weekly-report", icon: FileBarChart },
      { label: "Monthly Coach Report", href: "/ai-coach/monthly-report", icon: FileBarChart },
      { label: "Scenario Simulator", href: "/ai-coach/scenario-simulator", icon: FlaskConical },
    ],
  },
  {
    label: null,
    items: [
      { label: "Reports & Tax", href: "/reports", icon: FileSpreadsheet, roles: ["TRADER", "ACCOUNTANT", "ADMINISTRATOR"] },
      { label: "Broker Accounts", href: "/broker-accounts", icon: Link2, roles: ["TRADER", "ADMINISTRATOR"] },
      { label: "Imports", href: "/imports", icon: Upload, roles: ["TRADER", "ADMINISTRATOR"] },
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Billing", href: "/billing", icon: CreditCard, roles: ["TRADER", "ADMINISTRATOR"] },
    ],
  },
];

export function isRouteAllowed(item: NavItem, roles: RoleKey[]): boolean {
  const allowed = item.roles ?? ALL_ROLES;
  return roles.some((r) => allowed.includes(r));
}

export function visibleNavSections(roles: RoleKey[]): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isRouteAllowed(item, roles)),
  })).filter((section) => section.items.length > 0);
}

export const PRIMARY_INSIGHTS_ICON = Sparkles;
