import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { PageHeader } from "@/components/page-header";
import { MainContent } from "@/components/main-content";
import { getNotificationProfiles, getNotificationHistory } from "@/actions/notifications";
import { NotificationPageClient } from "@/components/notification-page-client";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profiles, history] = await Promise.all([
    getNotificationProfiles(),
    getNotificationHistory(30),
  ]);

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <MainContent>
        <PageHeader
          title="Notifications"
          subtitle="Manage daily email & Slack notification profiles"
        />

        <div className="p-4 md:p-8">
          <NotificationPageClient
            initialProfiles={profiles}
            initialHistory={history}
          />
        </div>
      </MainContent>
    </div>
  );
}
