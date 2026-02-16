import React from "react";
import {
  Svg,
  G,
  Line,
  Polyline,
  Circle,
  Text,
  Rect,
} from "@react-pdf/renderer";

interface DataPoint {
  label: string;
  value: number;
}

interface Series {
  name: string;
  data: DataPoint[];
  color: string;
}

interface Props {
  series: Series[];
  width?: number;
  height?: number;
  title?: string;
  minY?: number;
  maxY?: number;
}

export function PdfLineChart({
  series,
  width = 450,
  height = 200,
  title,
  minY = 0,
  maxY = 100,
}: Props) {
  if (series.length === 0 || series[0].data.length === 0) return null;

  const hasLegend = series.length > 1;
  const padding = {
    top: title ? 30 : 10,
    right: 20,
    bottom: hasLegend ? 50 : 30,
    left: 40,
  };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const points = series[0].data.length;

  function x(i: number) {
    return padding.left + (i / Math.max(points - 1, 1)) * chartW;
  }
  function y(val: number) {
    return padding.top + chartH - ((val - minY) / (maxY - minY)) * chartH;
  }

  // Y-axis gridlines
  const gridLines = [0, 25, 50, 75, 100].filter((v) => v >= minY && v <= maxY);

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {title && (
        <Text
          x={width / 2}
          y={18}
          textAnchor="middle"
          style={{
            fontSize: 11,
            fontFamily: "Helvetica-Bold",
            fill: "#1f2937",
          }}
        >
          {title}
        </Text>
      )}

      {/* Grid */}
      {gridLines.map((val) => (
        <G key={val}>
          <Line
            x1={padding.left}
            y1={y(val)}
            x2={width - padding.right}
            y2={y(val)}
            stroke="#e5e7eb"
            strokeWidth={0.5}
          />
          <Text
            x={padding.left - 6}
            y={y(val) + 3}
            textAnchor="end"
            style={{
              fontSize: 8,
              fontFamily: "Helvetica",
              fill: "#9ca3af",
            }}
          >
            {String(val)}
          </Text>
        </G>
      ))}

      {/* X-axis labels (skip duplicates from same-day crawls) */}
      {series[0].data.map((d, i, arr) => {
        const isDuplicate = i > 0 && arr[i - 1].label === d.label;
        if (isDuplicate) return null;
        return (
          <Text
            key={i}
            x={x(i)}
            y={height - (hasLegend ? 22 : 6)}
            textAnchor="middle"
            style={{
              fontSize: 7,
              fontFamily: "Helvetica",
              fill: "#9ca3af",
            }}
          >
            {d.label}
          </Text>
        );
      })}

      {/* Lines + dots for each series */}
      {series.map((s) => {
        const polyPoints = s.data
          .map((d, i) => `${x(i)},${y(d.value)}`)
          .join(" ");
        return (
          <G key={s.name}>
            <Polyline
              points={polyPoints}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
            />
            {s.data.map((d, i) => (
              <Circle key={i} cx={x(i)} cy={y(d.value)} r={3} fill={s.color} />
            ))}
          </G>
        );
      })}

      {/* Legend */}
      {hasLegend &&
        series.map((s, i) => (
          <G key={s.name}>
            <Rect
              x={padding.left + i * 100}
              y={height - 14}
              width={10}
              height={10}
              fill={s.color}
              rx={2}
            />
            <Text
              x={padding.left + i * 100 + 14}
              y={height - 5}
              style={{
                fontSize: 8,
                fontFamily: "Helvetica",
                fill: "#374151",
              }}
            >
              {s.name}
            </Text>
          </G>
        ))}
    </Svg>
  );
}
