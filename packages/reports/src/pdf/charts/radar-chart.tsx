import React from "react";
import { Svg, Line, Polygon, Circle, Text } from "@react-pdf/renderer";

interface Props {
  scores: {
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
  };
  size?: number;
}

const LABELS = ["Technical", "Content", "AI Readiness", "Performance"];

export function PdfRadarChart({ scores, size = 200 }: Props) {
  const pad = 40; // padding for labels outside the chart area
  const vb = size + pad * 2;
  const cx = vb / 2;
  const cy = vb / 2;
  const r = (size - 60) / 2;

  const values = [
    scores.technical,
    scores.content,
    scores.aiReadiness,
    scores.performance,
  ];
  const angles = values.map((_, i) => (i * 2 * Math.PI) / 4 - Math.PI / 2);

  function point(angle: number, radius: number): string {
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }

  // Grid rings at 25%, 50%, 75%, 100%
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Data polygon
  const dataPoints = values
    .map((v, i) => point(angles[i], (v / 100) * r))
    .join(" ");

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`}>
      {/* Grid rings */}
      {rings.map((ring) => (
        <Polygon
          key={ring}
          points={angles.map((a) => point(a, r * ring)).join(" ")}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={0.5}
        />
      ))}

      {/* Axis lines */}
      {angles.map((a, i) => (
        <Line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + r * Math.cos(a)}
          y2={cy + r * Math.sin(a)}
          stroke="#d1d5db"
          strokeWidth={0.5}
        />
      ))}

      {/* Data area */}
      <Polygon
        points={dataPoints}
        fill="#4f46e5"
        fillOpacity={0.15}
        stroke="#4f46e5"
        strokeWidth={2}
      />

      {/* Data points */}
      {values.map((v, i) => {
        const px = cx + (v / 100) * r * Math.cos(angles[i]);
        const py = cy + (v / 100) * r * Math.sin(angles[i]);
        return <Circle key={i} cx={px} cy={py} r={3} fill="#4f46e5" />;
      })}

      {/* Labels */}
      {LABELS.map((label, i) => {
        const lx = cx + (r + 18) * Math.cos(angles[i]);
        const ly = cy + (r + 18) * Math.sin(angles[i]);
        return (
          <Text
            key={i}
            x={lx}
            y={ly + 3}
            textAnchor="middle"
            style={{
              fontSize: 8,
              fontFamily: "Helvetica",
              fill: "#374151",
            }}
          >
            {label}
          </Text>
        );
      })}

      {/* Score values */}
      {values.map((v, i) => {
        const lx = cx + (r + 8) * Math.cos(angles[i]);
        const ly = cy + (r + 8) * Math.sin(angles[i]);
        return (
          <Text
            key={`v-${i}`}
            x={lx}
            y={ly + 12}
            textAnchor="middle"
            style={{
              fontSize: 7,
              fontFamily: "Helvetica-Bold",
              fill: "#4f46e5",
            }}
          >
            {String(Math.round(v))}
          </Text>
        );
      })}
    </Svg>
  );
}
