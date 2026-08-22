"use client";

import { GovernanceError } from "@/components/app";

export default function InventoryError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <GovernanceError {...props} surface="the AI system register" />;
}
