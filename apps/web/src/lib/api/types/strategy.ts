export interface ExtractedFact {
  type: string;
  content: string;
  sourceSentence: string;
  citabilityScore: number;
}

export interface SemanticGapResponse {
  userFacts: ExtractedFact[];
  competitorFacts: ExtractedFact[];
  densityGap: number;
}

export interface StrategyPersona {
  name: string;
  role: string;
  demographics: string;
  goals: string[];
  pains: string[];
  keywords: string[];
  typicalQueries: string[];
}

export interface StrategyCompetitor {
  id: string;
  projectId: string;
  domain: string;
  createdAt: string;
}

export interface GapAnalysisResult {
  missingElements: string[];
  recommendation: string;
}
