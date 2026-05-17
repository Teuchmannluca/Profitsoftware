"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Package } from "lucide-react";
import type { ProductCard } from "@/lib/queries/product";

export function ProductSearch({ products }: { products: ProductCard[] }) {
  const [query, setQuery] = useState("");

  const filtered = products.filter((p) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (p.title?.toLowerCase().includes(q) ?? false) ||
      p.asin.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by title, ASIN, or SKU..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Product grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-2xl bg-indigo-50 p-4 mb-4">
            <Package className="h-6 w-6 text-indigo-400" />
          </div>
          <p className="text-sm font-semibold text-foreground">No products found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try a different search term
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((product) => (
            <Link key={product.asin} href={`/product/${product.asin}`}>
              <Card className="overflow-hidden shadow-card ring-1 ring-border/50 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Product image */}
                    <div className="flex-shrink-0 h-[60px] w-[60px] rounded-lg bg-muted/50 overflow-hidden flex items-center justify-center">
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt={product.title ?? product.asin}
                          width={60}
                          height={60}
                          className="object-contain"
                        />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground/40" />
                      )}
                    </div>

                    {/* Product info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {product.title ?? "Untitled Product"}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        {product.asin}
                      </p>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 pt-1">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                            Revenue
                          </p>
                          <p className="text-sm font-bold font-mono text-foreground">
                            £{product.totalRevenue.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                            Units
                          </p>
                          <p className="text-sm font-bold font-mono text-foreground">
                            {product.totalUnits}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                            Stock
                          </p>
                          <p className="text-sm font-bold font-mono text-foreground">
                            {product.currentStock}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
