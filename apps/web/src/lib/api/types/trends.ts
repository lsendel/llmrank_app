export interface Regression {
  category: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  severity: "critical" | "warning" | "info";
}
