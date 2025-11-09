"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DashboardView({ insights = {} }) {
  // ======== Safe Data Mapping ========
  const salaryData =
    insights?.salaryRanges && insights.salaryRanges.length > 0
      ? insights.salaryRanges.map((item) => ({
          role: item.role || "Unknown Role",
          min: item.min || 0,
          median: item.median || 0,
          max: item.max || 0,
        }))
      : [
          { role: "Software Engineer", min: 80, median: 120, max: 150 },
           { role: "Data Scientist", min: 90, median: 135, max: 180 }, 
           { role: "DevOps Engineer", min: 95, median: 130, max: 160 }, 
           { role: "Frontend Developer", min: 70, median: 110, max: 145 }, 
           { role: "Backend Developer", min: 85, median: 125, max: 155 },
            { role: "Project Manager", min: 100, median: 140, max: 170 },
        ];

  const topSkills =
    insights?.topSkills?.length > 0
      ? insights.topSkills
      : ["Python", "Java", "JavaScript", "Cloud", "Agile"];

  const industryTrends =
    insights?.keyTrends?.length > 0
      ? insights.keyTrends
      : [
          "AI and Automation driving 60% of tech innovation.",
          "Remote work increasing demand for cloud infrastructure.",
          "Upskilling in data-driven roles becoming crucial.",
        ];

  const recommendedSkills =
    insights?.recommendedSkills?.length > 0
      ? insights.recommendedSkills
      : [
          "TensorFlow / PyTorch",
          "AWS / Azure Cloud",
          "Data Visualization",
          "MLOps Fundamentals",
        ];

  // ======== Derived data with fallback & parsing ========
  const rawGrowth =
    typeof insights?.growthRate === "string"
      ? parseFloat(insights.growthRate.replace("%", "")) || 0
      : typeof insights?.growthRate === "number"
      ? insights.growthRate
      : 12.0; // fallback

  const growthRate = Math.min(Math.max(rawGrowth, 0), 100); // keep within 0–100

  const marketOutlook = insights?.marketOutlook || "Neutral";
  const demandLevel = insights?.demandLevel || "Medium";

  // ======== JSX RETURN ========
  return (
    <div className="p-6 space-y-8 bg-[#0a0a0a] min-h-screen text-white">
      {/* ============ Top 4 Stats Section ============ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Market Outlook */}
        <Card className="bg-[#111111] border border-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-400 text-sm">
              Market Outlook
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{marketOutlook}</p>
            <p className="text-xs text-gray-500 mt-1">Next update in 7 days</p>
          </CardContent>
        </Card>


        {/* Industry Growth */}
         <Card className="bg-[#111111] border border-gray-800"> 
          <CardHeader> 
            <CardTitle className="text-gray-400 text-sm"> Industry Growth </CardTitle> 
            </CardHeader> 
            <CardContent>
               <p className="text-2xl font-bold text-white"> {insights?.industryGrowth || "12.0%"} </p>
                <div className="w-full h-2 bg-gray-800 rounded mt-2">
                   <div className="h-2 bg-gray-400 rounded" style={{ width: insights?.growthBar || "60%" }} ></div>
                    </div> 
                    </CardContent>
                     </Card>
        {/* Demand Level */}
        <Card className="bg-[#111111] border border-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-400 text-sm">
              Demand Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{demandLevel}</p>
            <div className="w-full h-2 bg-gray-800 rounded mt-2">
              <div
                className={`h-2 rounded transition-all duration-500 ${
                  demandLevel === "High"
                    ? "bg-green-500"
                    : demandLevel === "Low"
                    ? "bg-red-500"
                    : "bg-yellow-500"
                }`}
                style={{
                  width:
                    demandLevel === "High"
                      ? "85%"
                      : demandLevel === "Medium"
                      ? "60%"
                      : "40%",
                }}
              ></div>
            </div>
          </CardContent>
        </Card>

        {/* Top Skills */}
        <Card className="bg-[#111111] border border-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-400 text-sm">Top Skills</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 mt-2">
            {topSkills.map((skill, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-gray-800 text-sm rounded-md text-gray-300"
              >
                {skill}
              </span>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ============ Middle Section (Trends + Recommended Skills) ============ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Industry Trends */}
        <Card className="bg-[#111111] border border-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-300">Industry Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 mt-2 text-gray-400 text-sm">
              {industryTrends.map((trend, idx) => (
                <li
                  key={idx}
                  className="border-l-2 border-gray-700 pl-3 hover:text-gray-200 transition"
                >
                  {trend}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Recommended Skills */}
        <Card className="bg-[#111111] border border-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-300">
              Recommended Skills
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 mt-2">
            {recommendedSkills.map((skill, idx) => (
              <span
                key={idx}
                className="px-3 py-2 bg-gray-800 text-sm rounded-md text-gray-300 hover:bg-gray-700 transition"
              >
                {skill}
              </span>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ============ Salary Ranges Chart ============ */}
      <Card className="bg-[#111111] border border-gray-800">
        <CardHeader>
          <CardTitle className="text-gray-300">Salary Ranges by Role</CardTitle>
          <p className="text-sm text-gray-500">
            Displaying minimum, median, and maximum salaries (in thousands)
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salaryData}>
                <XAxis dataKey="role" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "none",
                    color: "#f9fafb",
                  }}
                />
                <Bar dataKey="min" fill="#374151" radius={[4, 4, 0, 0]} />
                <Bar dataKey="median" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="max" fill="#60A5FA" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
