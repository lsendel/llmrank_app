import type { Metadata } from "next";
import {
  breadcrumbSchema,
  faqSchema,
  JsonLd,
  productOffersSchema,
} from "@/components/seo/json-ld";
import { PricingPageLayout } from "./_components/pricing-page-sections";
import {
  PRICING_BREADCRUMB_ITEMS,
  PRICING_FAQ,
  PRICING_PAGE_METADATA,
  PRICING_PRODUCT_OFFERS,
} from "./pricing-page-helpers";

export const metadata: Metadata = PRICING_PAGE_METADATA;

export default function PricingPage() {
  return (
    <>
      <JsonLd data={productOffersSchema(PRICING_PRODUCT_OFFERS)} />
      <JsonLd data={breadcrumbSchema(PRICING_BREADCRUMB_ITEMS)} />
      <JsonLd data={faqSchema(PRICING_FAQ)} />
      <PricingPageLayout />
    </>
  );
}
