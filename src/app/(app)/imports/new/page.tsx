import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/rbac";
import { getBrokerAccount } from "@/server/services/broker-account.service";
import { listBrokerAccounts } from "@/server/services/broker-account.service";
import { PageHeader } from "@/components/shared/page-header";
import { ImportWizard } from "./import-wizard";
import { EmptyState } from "@/components/shared/empty-state";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function NewImportPage({
  searchParams,
}: {
  searchParams: Promise<{ brokerAccountId?: string }>;
}) {
  const session = await requireSession();
  const { brokerAccountId } = await searchParams;

  if (!brokerAccountId) {
    const accounts = await listBrokerAccounts(session.user.id);
    const importCapableAccount = accounts.find((a) => a.broker.isImplemented);
    if (importCapableAccount) redirect(`/imports/new?brokerAccountId=${importCapableAccount.id}`);

    return (
      <EmptyState
        icon={Link2}
        title="Select a broker account first"
        description="Add a broker account, then come back here to import your tradebook."
        action={
          <Button asChild>
            <Link href="/broker-accounts/new">Add broker account</Link>
          </Button>
        }
      />
    );
  }

  const account = await getBrokerAccount(session.user.id, brokerAccountId);
  if (!account) redirect("/broker-accounts");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Import Tradebook"
        description={`${account.broker.name} — ${account.nickname}`}
      />
      <ImportWizard brokerAccountId={account.id} brokerCode={account.broker.code} brokerName={account.broker.name} />
    </div>
  );
}
