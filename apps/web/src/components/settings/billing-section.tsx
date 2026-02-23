"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreditCard, ArrowRight } from "lucide-react";

export function BillingSection() {
  return (
    <div className="pt-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Billing</CardTitle>
          </div>
          <CardDescription>
            Manage your subscription, plan, and payment history on the dedicated
            billing page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/billing">
            <Button>
              Go to Billing
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
