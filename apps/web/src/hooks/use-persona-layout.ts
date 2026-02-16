import {
  PERSONA_WIDGET_ORDER,
  DEFAULT_WIDGET_ORDER,
  type DashboardWidgetId,
} from "@llm-boost/shared";
import { getFeatureFlag } from "@/lib/telemetry";

type Persona = keyof typeof PERSONA_WIDGET_ORDER;

export function usePersonaLayout(persona: string | null | undefined): {
  widgetOrder: DashboardWidgetId[];
  isPersonalized: boolean;
} {
  const flagValue = getFeatureFlag("persona-dashboard");
  const flagOn = flagValue === true || flagValue === "true";

  if (flagOn && persona && persona in PERSONA_WIDGET_ORDER) {
    return {
      widgetOrder: PERSONA_WIDGET_ORDER[persona as Persona],
      isPersonalized: true,
    };
  }

  return { widgetOrder: [...DEFAULT_WIDGET_ORDER], isPersonalized: false };
}
