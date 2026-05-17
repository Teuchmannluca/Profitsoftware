import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Order {
  amazon_order_id: string;
  purchase_date: string;
  order_status: string;
  fulfillment_channel: string;
  ship_country: string | null;
  last_updated: string;
}

export function OrdersTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No orders yet. Click &quot;Sync Orders&quot; to pull from Amazon.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order ID</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Channel</TableHead>
          <TableHead>Country</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.amazon_order_id}>
            <TableCell className="font-mono text-xs">
              {order.amazon_order_id}
            </TableCell>
            <TableCell>
              {new Date(order.purchase_date).toLocaleDateString("en-GB")}
            </TableCell>
            <TableCell>
              <Badge variant={order.order_status === "Shipped" ? "default" : "secondary"}>
                {order.order_status}
              </Badge>
            </TableCell>
            <TableCell>{order.fulfillment_channel}</TableCell>
            <TableCell>{order.ship_country ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
