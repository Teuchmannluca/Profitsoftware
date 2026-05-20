import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { PageHeader } from "@/components/page-header";
import { MainContent } from "@/components/main-content";
import { ProductSearch } from "@/components/product-search";
import { getProductCards } from "@/lib/queries/product";

export const dynamic = "force-dynamic";

export default async function ProductPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const products = await getProductCards();

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <MainContent>
        <PageHeader
          title="Product Insight"
          subtitle="Deep dive into product performance"
        />

        <div className="p-8">
          <ProductSearch products={products} />
        </div>
      </MainContent>
    </div>
  );
}
