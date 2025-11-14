"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import { Card } from "@/components/ui/card";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export interface ChartConfig {
  type: "bar" | "line" | "pie" | "doughnut";
  title?: string;
  data: {
    labels: any[];
    datasets: {
      label: string;
      data: any[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
    }[];
  };
  options?: Record<string, unknown>;
}

export interface TableColumn {
  key: string;
  header: string;
}

export interface TableData {
  title?: string;
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
  summary?: string;
}

interface DataDisplayProps {
  title?: string;
  chartConfig?: ChartConfig;
  tableData?: TableData;
  showChart?: boolean;
  showTable?: boolean;
  className?: string;
}

const itemsPerPage = 10;

export default function DataDisplay({
  title = "Visualization",
  chartConfig,
  tableData,
  showChart = true,
  showTable = true,
  className = "",
}: DataDisplayProps) {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [tableData]);

  const renderedChart = useMemo(() => {
    if (!chartConfig?.data || !chartConfig.data.datasets.length) {
      return <div className="text-muted-foreground p-4 text-center">No chart data</div>;
    }

    const colors = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#3B82F6"];

    const datasets = chartConfig.data.datasets.map((ds, i) => ({
      ...ds,
      data: ds.data.map((v) => Number(v)),
      backgroundColor: ds.backgroundColor || colors[i % colors.length],
      borderColor: ds.borderColor || colors[i % colors.length],
      borderWidth: 2,
    }));

    const chartData = {
      labels: chartConfig.data.labels,
      datasets,
    };

    switch (chartConfig.type) {
      case "bar":
        return <Bar data={chartData} options={chartConfig.options} />;
      case "line":
        return <Line data={chartData} options={chartConfig.options} />;
      case "pie":
        return <Pie data={chartData} options={chartConfig.options} />;
      case "doughnut":
        return <Doughnut data={chartData} options={chartConfig.options} />;
      default:
        return <Bar data={chartData} options={chartConfig.options} />;
    }
  }, [chartConfig]);

  const renderTable = () => {
    if (!tableData?.rows?.length || !tableData.columns?.length) {
      return <div className="text-muted-foreground p-4 text-center">No table data</div>;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const slicedRows = tableData.rows.slice(start, start + itemsPerPage);

    return (
      <>
        <div className="overflow-x-auto border rounded-xl p-2">
          <table className="w-full border-collapse">
            <thead className="bg-muted/40 text-sm">
              <tr>
                {tableData.columns.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-left font-medium">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slicedRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t">
                  {tableData.columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-sm">
                      {String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tableData.summary && (
          <p className="text-center text-xs mt-3 italic">{tableData.summary}</p>
        )}
      </>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {showChart && chartConfig && (
        <Card className="p-6 shadow-md">
          <h3 className="text-lg font-semibold mb-4">{title} - Chart</h3>
          <div className="h-[380px]">{renderedChart}</div>
        </Card>
      )}

      {showTable && tableData && (
        <Card className="p-6 shadow-md">
          <h3 className="text-lg font-semibold mb-4">{title} - Table</h3>
          {renderTable()}
        </Card>
      )}
    </div>
  );
}
