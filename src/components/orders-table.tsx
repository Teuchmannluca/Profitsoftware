import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

interface Order {
  amazon_order_id: string;
  purchase_date: string;
  order_status: string;
  fulfillment_channel: string;
  ship_country: string | null;
  last_updated: string;
}

export function OrdersTable({ orders }: { orders: Order[] }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Package className="h-4 w-4 text-muted-foreground" />
            Recent Orders
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Last {orders.length}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No orders yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click Sync to pull orders from Amazon
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Order ID</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Channel</TableHead>
                  <TableHead className="text-xs">Country</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.amazon_order_id} className="group">
                    <TableCell className="font-mono text-xs">
                      {order.amazon_order_id}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(order.purchase_date).toLocaleDateString(
                        "en-GB",
                        { day: "2-digit", month: "short", year: "numeric" }
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          order.order_status === "Shipped"
                            ? "default"
                            : "secondary"
                        }
                        className="text-[10px] px-1.5 h-4"
                      >
                        {order.order_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {order.fulfillment_channel === "AFN" ? "FBA" : "FBM"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {order.ship_country ?? "—"}
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
