import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Warehouse } from "lucide-react";

interface InventoryRow {
  sku: string;
  asin: string | null;
  fnsku: string | null;
  title: string | null;
  image_url: string | null;
  afn_fulfillable: number;
  afn_reserved: number;
  afn_inbound: number;
  afn_unsellable: number;
  total_quantity: number;
}

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Warehouse className="h-4 w-4 text-muted-foreground" />
            Product Inventory
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {rows.length} products
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Warehouse className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No products synced</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click Sync Inventory to pull products from Amazon
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[50px]">Image</TableHead>
                  <TableHead className="text-xs">Product</TableHead>
                  <TableHead className="text-xs">SKU</TableHead>
                  <TableHead className="text-xs">ASIN</TableHead>
                  <TableHead className="text-xs text-right">Fulfillable</TableHead>
                  <TableHead className="text-xs text-right">Reserved</TableHead>
                  <TableHead className="text-xs text-right">Inbound</TableHead>
                  <TableHead className="text-xs text-right">Unsellable</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.sku}>
                    <TableCell>
                      {row.image_url ? (
                        <Image
                          src={row.image_url}
                          alt={row.title ?? row.sku}
                          width={40}
                          height={40}
                          className="rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                          <Warehouse className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {row.title ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.sku}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.asin ?? "—"}
                    </TableCell>
                    <TableCell
                      className={`font-mono text-xs text-right ${
                        row.afn_fulfillable < 10
                          ? "text-destructive font-semibold"
                          : ""
                      }`}
                    >
                      {row.afn_fulfillable}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right">
                      {row.afn_reserved}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right">
                      {row.afn_inbound}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right">
                      {row.afn_unsellable}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right font-semibold">
                      {row.total_quantity}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
