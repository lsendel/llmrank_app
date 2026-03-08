export interface ScoringProfile {
  id: string;
  name: string;
  weights: {
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
  };
  disabledFactors: string[];
  isDefault: boolean;
  createdAt: string;
}
