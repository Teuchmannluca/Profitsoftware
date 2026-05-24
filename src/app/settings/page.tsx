import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { PageHeader } from "@/components/page-header";
import { MainContent } from "@/components/main-content";
import { SettingsForm } from "@/components/settings-form";
import { getSettings } from "@/actions/settings";
import { getExpenses } from "@/actions/expenses";
import { ExpensesForm } from "@/components/expenses-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [settings, expenses] = await Promise.all([
    getSettings(),
    getExpenses(),
  ]);

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <MainContent>
        <PageHeader
          title="Settings"
          subtitle="Business & VAT configuration"
        />

        <div className="p-4 md:p-8 max-w-3xl space-y-6">
          <SettingsForm initialSettings={settings} />
          <ExpensesForm initialExpenses={expenses} />
        </div>
      </MainContent>
    </div>
  );
}
