"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Warehouse } from "lucide-react";
import { addCogsPeriod } from "@/actions/cogs-action";

interface Product {
  sku: string;
  asin: string | null;
  title: string | null;
  image_url: string | null;
}

export function AddCostForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedAsin, setSelectedAsin] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [prepCost, setPrepCost] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [notes, setNotes] = useState("");

  // ASIN search
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Deduplicate products by ASIN (only products with ASINs)
  const uniqueProducts = useMemo(() => {
    const seen = new Set<string>();
    return products.filter((p) => {
      if (!p.asin || seen.has(p.asin)) return false;
      seen.add(p.asin);
      return true;
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return uniqueProducts.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return uniqueProducts
      .filter(
        (p) =>
          p.asin?.toLowerCase().includes(q) ||
          p.title?.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [uniqueProducts, searchQuery]);

  const selectedProduct = uniqueProducts.find((p) => p.asin === selectedAsin);

  function resetForm() {
    setSelectedAsin("");
    setUnitCost("");
    setPrepCost("");
    setValidFrom("");
    setNotes("");
    setSearchQuery("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAsin || !unitCost || !validFrom) {
      setError("ASIN, Unit Cost, and Valid From are required.");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await addCogsPeriod({
      asin: selectedAsin,
      unitCost: parseFloat(unitCost),
      prepCost: parseFloat(prepCost || "0"),
      validFrom,
      notes: notes || undefined,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Failed to add cost period.");
      return;
    }

    resetForm();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="h-8 gap-1.5 text-xs" />
        }
      >
        <Plus className="h-3.5 w-3.5" />
        Add Cost
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Cost Period</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* ASIN Selector */}
          <div className="space-y-2">
            <Label htmlFor="asin-search">Product (ASIN)</Label>
            {selectedProduct ? (
              <div className="flex items-center gap-3 rounded-lg border p-2">
                {selectedProduct.image_url ? (
                  <Image
                    src={selectedProduct.image_url}
                    alt={selectedProduct.title ?? ""}
                    width={36}
                    height={36}
                    className="rounded object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded bg-muted">
                    <Warehouse className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">
                    {selectedProduct.title ?? "Untitled"}
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    {selectedProduct.asin}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setSelectedAsin("");
                    setSearchQuery("");
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="asin-search"
                    placeholder="Search by ASIN or product title..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="pl-8 text-xs"
                  />
                </div>
                {showDropdown && (
                  <div className="absolute z-50 mt-1 max-h-[200px] w-full overflow-auto rounded-md border bg-popover shadow-md">
                    {filteredProducts.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground text-center">
                        No products found
                      </p>
                    ) : (
                      filteredProducts.map((p) => (
                        <button
                          key={p.asin}
                          type="button"
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-accent transition-colors"
                          onClick={() => {
                            setSelectedAsin(p.asin!);
                            setShowDropdown(false);
                            setSearchQuery("");
                          }}
                        >
                          {p.image_url ? (
                            <Image
                              src={p.image_url}
                              alt={p.title ?? ""}
                              width={28}
                              height={28}
                              className="rounded object-cover"
                            />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded bg-muted">
                              <Warehouse className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate">
                              {p.title ?? "Untitled"}
                            </p>
                            <p className="text-[10px] font-mono text-muted-foreground">
                              {p.asin}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cost Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="unit-cost">Unit Cost (£)</Label>
              <Input
                id="unit-cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="font-mono text-xs"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prep-cost">Prep Fee (£)</Label>
              <Input
                id="prep-cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={prepCost}
                onChange={(e) => setPrepCost(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Valid From */}
          <div className="space-y-2">
            <Label htmlFor="valid-from">Valid From</Label>
            <Input
              id="valid-from"
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="text-xs"
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="e.g. Supplier price increase Q2 2025..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs resize-none"
              rows={2}
            />
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Saving..." : "Add Cost Period"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
