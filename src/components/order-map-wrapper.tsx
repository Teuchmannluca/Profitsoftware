"use client";

import dynamic from "next/dynamic";
import type { PostcodeCluster } from "@/app/map/page";

const OrderMap = dynamic(() => import("@/components/order-map"), { ssr: false });

export function OrderMapWrapper({ clusters }: { clusters: PostcodeCluster[] }) {
  return <OrderMap clusters={clusters} />;
}
