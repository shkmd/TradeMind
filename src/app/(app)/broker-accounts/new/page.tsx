import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { NewBrokerAccountForm } from "./new-broker-account-form";

export default async function NewBrokerAccountPage() {
  await requireSession();
  const brokers = await prisma.broker.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Add a broker account"
        description="No broker credentials are collected on this step. Import a tradebook file or connect live from the account page after this."
      />
      <NewBrokerAccountForm brokers={brokers.map((b) => ({ code: b.code, name: b.name, isImplemented: b.isImplemented }))} />
    </div>
  );
}
