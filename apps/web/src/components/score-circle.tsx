"use client";

import { useEffect, useState } from "react";
import { cn, scoreColor } from "@/lib/utils";
import { letterGrade } from "@llm-boost/shared";

function getStrokeColor(score: number): string {
  if (score >= 80) return "stroke-success";
  if (score >= 60) return "stroke-warning";
  if (score >= 40) return "stroke-orange-500";
  return "stroke-destructive";
}

interface ScoreCircleProps {
  score: number;
  size?: number;
  label?: string;
  className?: string;
}

export function ScoreCircle({
  score,
  size = 120,
  label,
  className,
}: ScoreCircleProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (animatedScore / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 100);
    return () => clearTimeout(timer);
  }, [score]);

  const grade = letterGrade(score);
  const colorClass = scoreColor(score);
  const strokeClass = getStrokeColor(score);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/30"
          />
          {/* Score circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={cn(strokeClass, "transition-all duration-1000 ease-out")}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-3xl font-bold", colorClass)}>{grade}</span>
          <span className="text-sm text-muted-foreground">{score}</span>
        </div>
      </div>
      {label && (
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
