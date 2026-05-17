import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Amazon Profit Tracker</h1>
      <p className="mt-2 text-muted-foreground">
        Logged in as {user.email}
      </p>
    </main>
  );
}
