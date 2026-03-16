import { render, screen } from "@testing-library/react";
import { WizardStepper } from "./wizard-stepper";

const STEPS = ["Website", "Crawl Scope", "Competitors", "Launch"];

describe("WizardStepper", () => {
  it("renders all step labels", () => {
    render(<WizardStepper steps={STEPS} currentStep={0} />);
    for (const step of STEPS) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
  });

  it("marks current step as active", () => {
    render(<WizardStepper steps={STEPS} currentStep={1} />);
    const step = screen.getByText("Crawl Scope").closest("[data-step]");
    expect(step).toHaveAttribute("data-state", "active");
  });

  it("marks completed steps", () => {
    render(<WizardStepper steps={STEPS} currentStep={2} />);
    const step = screen.getByText("Website").closest("[data-step]");
    expect(step).toHaveAttribute("data-state", "completed");
  });
});
