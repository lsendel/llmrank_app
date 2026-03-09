import type { Metadata } from "next";
import {
  JsonLd,
  faqSchema,
  organizationSchema,
  softwareApplicationSchema,
} from "@/components/seo/json-ld";
import { HomePageLayout } from "./_components/home-page-sections";
import { HOME_PAGE_FAQ_ITEMS, HOME_PAGE_METADATA } from "./home-page-helpers";

export const metadata: Metadata = HOME_PAGE_METADATA;

export default function HomePage() {
  return (
    <>
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd data={organizationSchema()} />
      <JsonLd data={faqSchema(HOME_PAGE_FAQ_ITEMS)} />
      <HomePageLayout />
    </>
  );
}
