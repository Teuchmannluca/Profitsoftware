import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings-form";
import { getSettings } from "@/actions/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const settings = await getSettings();

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <main className="pl-[240px]">
        <PageHeader
          title="Settings"
          subtitle="Business & VAT configuration"
        />

        <div className="p-8 max-w-3xl">
          <SettingsForm initialSettings={settings} />
        </div>
      </main>
    </div>
  );
}
