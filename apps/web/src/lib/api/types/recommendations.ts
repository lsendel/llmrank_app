export interface RecommendationConfidence {
  label: "High" | "Medium" | "Low";
  variant: "success" | "warning" | "destructive";
  score?: number;
}
