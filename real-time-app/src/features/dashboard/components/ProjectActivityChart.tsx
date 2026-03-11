"use client";

import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const data = [
  { day: "Mon", edits: 3 },
  { day: "Tue", edits: 7 },
  { day: "Wed", edits: 4 },
  { day: "Thu", edits: 8 },
  { day: "Fri", edits: 5 },
  { day: "Sat", edits: 2 },
  { day: "Sun", edits: 6 },
];

export default function ProjectActivityChart() {
  return (
    <div className="rounded-xl bg-panel p-8 text-sm text-muted-foreground w-full mt-4">
      <p className="font-semibold text-white mb-4">Commits This Week</p>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                backgroundColor: "#030a0d",
                borderColor: "#20454f",
              }}
              labelStyle={{ color: "#73e8c4" }}
              cursor={{ stroke: "#20454f", strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="edits"
              stroke="#73e8c4"
              strokeWidth={2}
              dot={{ r: 3, fill: "#73e8c4" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
