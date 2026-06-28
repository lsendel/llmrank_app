import { describe, it, expect } from "vitest";
import { hasSummaryHeading } from "../summary-heading";

describe("hasSummaryHeading", () => {
  it("matches English summary headings", () => {
    for (const h of [
      "Summary",
      "In Summary",
      "Key Takeaways",
      "Key Takeaway",
      "TL;DR",
      "TLDR",
      "Conclusion",
      "Conclusions",
      "Overview",
      "Highlights",
      "In Brief",
    ]) {
      expect(hasSummaryHeading([h])).toBe(true);
    }
  });

  it("matches accented, non-English summary headings (diacritic-folded)", () => {
    const cases = [
      "Resumen", // es
      "En Resumen", // es
      "Conclusión", // es (accented)
      "Puntos Clave", // es
      "Zusammenfassung", // de
      "Fazit", // de
      "Überblick", // de (accented)
      "Das Wichtigste", // de
      "Résumé", // fr (accented)
      "En Bref", // fr
      "L’essentiel", // fr (curly apostrophe)
      "Resumo", // pt
      "Conclusão", // pt (accented)
      "Visão Geral", // pt (accented)
      "Pontos-chave", // pt (hyphen)
      "Riassunto", // it
      "In Sintesi", // it
      "Samenvatting", // nl
      "In Het Kort", // nl
    ];
    for (const h of cases) {
      expect(hasSummaryHeading([h]), h).toBe(true);
    }
  });

  it("matches when the summary heading is one of several", () => {
    expect(
      hasSummaryHeading(["Cómo Funciona", "Servicios", "En Resumen"]),
    ).toBe(true);
  });

  it("does not match non-summary headings, including Spanish ones", () => {
    for (const h of [
      "Cómo Funciona",
      "Preguntas Frecuentes",
      "About Us",
      "Services",
      "Servicios",
      "Contact",
      "Introduction",
    ]) {
      expect(hasSummaryHeading([h]), h).toBe(false);
    }
  });

  it("does not match a keyword embedded inside a larger word (\\b boundaries)", () => {
    // "overview" is a substring of "overviewer", but the trailing \b rejects it
    expect(hasSummaryHeading(["Overviewer Tools"])).toBe(false);
    expect(hasSummaryHeading(["Summarized Findings"])).toBe(false);
    expect(hasSummaryHeading([])).toBe(false);
  });
});
