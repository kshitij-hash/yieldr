"use client";

import React from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { YieldOpportunity } from "@/types";

interface YieldChartsProps {
  opportunities: YieldOpportunity[];
}

// Color palette for protocols
const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe"];

export const YieldCharts: React.FC<YieldChartsProps> = ({ opportunities }) => {
  // Prepare data for APY comparison bar chart
  const apyData = opportunities.map((opp) => ({
    name: opp.protocol,
    apy: opp.apy,
    fill: getProtocolColor(opp.protocol),
  }));

  // Prepare data for TVL pie chart
  const tvlData = opportunities.map((opp) => ({
    name: opp.protocol,
    value: opp.tvl,
  }));

  // Mock historical data (in production, this would come from backend)
  const historicalData = [
    { date: "2024-10-01", zest: 10.5, velar: 8.2, alex: 12.1 },
    { date: "2024-10-05", zest: 11.2, velar: 8.5, alex: 11.8 },
    { date: "2024-10-10", zest: 12.0, velar: 9.1, alex: 12.5 },
    { date: "2024-10-15", zest: 11.8, velar: 9.3, alex: 13.2 },
    { date: "2024-10-20", zest: 12.5, velar: 9.8, alex: 12.9 },
  ];

  function getProtocolColor(protocol: string): string {
    const index = opportunities.findIndex((opp) => opp.protocol === protocol);
    return COLORS[index % COLORS.length];
  }

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{
      name: string;
      value: number;
      color: string;
      dataKey?: string;
    }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{label}</p>
          {payload.map((entry, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}:{" "}
              {typeof entry.value === "number"
                ? entry.value.toFixed(2)
                : entry.value}
              {entry.name === "apy" ||
              (entry.dataKey && entry.dataKey.includes("apy"))
                ? "%"
                : ""}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yield Analytics</CardTitle>
        <CardDescription>
          Visual analysis of yield opportunities across protocols
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="bar" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bar">APY Comparison</TabsTrigger>
            <TabsTrigger value="line">Historical Trends</TabsTrigger>
            <TabsTrigger value="pie">TVL Distribution</TabsTrigger>
          </TabsList>

          {/* APY Bar Chart */}
          <TabsContent value="bar" className="mt-6">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={apyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-sm" />
                <YAxis
                  label={{
                    value: "APY (%)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                  className="text-sm"
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="apy" radius={[8, 8, 0, 0]}>
                  {apyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>

          {/* Historical Line Chart */}
          <TabsContent value="line" className="mt-6">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-sm" />
                <YAxis
                  label={{
                    value: "APY (%)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                  className="text-sm"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="zest"
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="velar"
                  stroke="#82ca9d"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="alex"
                  stroke="#ffc658"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>

          {/* TVL Pie Chart */}
          <TabsContent value="pie" className="mt-6">
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={tvlData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {tvlData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      return (
                        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                          <p className="font-semibold">{data.name}</p>
                          <p className="text-sm">
                            TVL: ${(data.value as number).toLocaleString()}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
