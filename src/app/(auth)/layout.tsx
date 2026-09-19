import Link from "next/link";
import { LineChart } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-nav p-10 text-nav-foreground lg:flex">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <LineChart className="h-6 w-6" />
          TradeMind India
        </Link>
        <div className="space-y-4">
          <p className="font-serif text-3xl leading-snug">
            Connect every broker. Consolidate every holding and trade. Understand your true
            performance, behaviour and risk in one place.
          </p>
          <p className="text-sm text-nav-foreground/70">
            We don&apos;t just track trades. We calculate the cost of trading mistakes.
          </p>
        </div>
        <p className="text-xs text-nav-foreground/50">
          For informational and analytical use only. Not investment advice.
        </p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
