export interface PlatformReadinessResult {
  platform: string;
  score: number;
  grade: string;
  tips: string[];
  checks: {
    factor: string;
    label: string;
    importance: "critical" | "important" | "recommended";
    pass: boolean;
  }[];
}
