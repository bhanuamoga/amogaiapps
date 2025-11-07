"use client";

import React, { useState, useEffect } from 'react';
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
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
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
  type: 'bar' | 'line' | 'pie' | 'doughnut';
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
    }[];
  };
  options?: Record<string, unknown>;
}

export interface TableData {
  columns: string[];
  rows: Array<Record<string, unknown>> | Array<Array<string>>;
}

export interface DataDisplayProps {
  title: string;
  chartConfig?: ChartConfig;
  tableData?: TableData;
  showChart?: boolean;
  showTable?: boolean;
  className?: string;
}

export const DataDisplay: React.FC<DataDisplayProps> = ({
  title,
  chartConfig,
  tableData,
  showChart = true,
  showTable = true,
  className = "",
}) => {
  const [activeTab, setActiveTab] = useState<'chart' | 'table'>('chart');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset to first page when table data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [tableData]);


  const renderChart = () => {
    try {
      if (!chartConfig) {
        return null;
      }

      const { type, data, options } = chartConfig;

      // Validate chart data structure
      if (!data || !data.labels || !data.datasets) {
        throw new Error('Invalid chart data structure');
      }

      // Truncate long labels for better display
      const truncatedLabels = data.labels.map((label: string) => {
        if (label.length > 15) {
          return label.substring(0, 12) + '...';
        }
        return label;
      });

      // Create truncated data with original labels for tooltips
      const truncatedData = {
        ...data,
        labels: truncatedLabels
      };

      const defaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top' as const,
          },
          title: {
            display: true,
            text: title,
          },
          tooltip: {
            callbacks: {
              title: function (context: { dataIndex: number }[]) {
                // Show full label in tooltip
                const index = context[0].dataIndex;
                return data.labels[index];
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45,
              maxTicksLimit: 10
            }
          }
        },
        ...options,
      };

      switch (type) {
        case 'bar':
          return <Bar data={truncatedData} options={defaultOptions} />;
        case 'line':
          return <Line data={truncatedData} options={defaultOptions} />;
        case 'pie':
          return <Pie data={truncatedData} options={defaultOptions} />;
        case 'doughnut':
          return <Doughnut data={truncatedData} options={defaultOptions} />;
        default:
          return <Bar data={truncatedData} options={defaultOptions} />;
      }
    } catch (error) {
      console.error('Error rendering chart:', error);
      return (
        <div className="flex items-center justify-center h-full bg-muted/20 rounded-lg border border-dashed border-muted-foreground/25">
          <div className="text-center p-4">
            <div className="text-muted-foreground text-sm">
              ⚠️ Chart rendering failed
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          </div>
        </div>
      );
    }
  };

  const renderTable = () => {
    try {
      if (!tableData) return null;
      
      const { columns, rows } = tableData;
      
      // Validate table data structure
      if (!columns || !Array.isArray(columns) || !rows || !Array.isArray(rows)) {
        throw new Error('Invalid table data structure');
      }

      // Check if rows are arrays of arrays (new format) or objects (old format)
      const isArrayFormat = rows.length > 0 && Array.isArray(rows[0]);

      const totalItems = rows.length;
      const totalPages = Math.ceil(totalItems / itemsPerPage);
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
      const currentRows = rows.slice(startIndex, endIndex);

      const handlePrevious = () => {
        setCurrentPage(prev => Math.max(prev - 1, 1));
      };

      const handleNext = () => {
        setCurrentPage(prev => Math.min(prev + 1, totalPages));
      };

      return (
        <div>
          <div className="overflow-x-auto rounded-xl">
            <table className="w-full divide-y divide-border/50">
              <thead className="bg-muted/30 backdrop-blur-sm">
                <tr>
                  {columns.map((column, index) => (
                    <th
                      key={index}
                      className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sm:px-6"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-transparent divide-y divide-border/30">
                {currentRows.map((row, rowIndex) => (
                  <tr key={startIndex + rowIndex} className="hover:bg-muted/20 transition-colors">
                    {columns.map((column, colIndex) => {
                      // Handle both array format (new) and object format (old)
                      const cellValue = isArrayFormat 
                        ? (row as Array<string>)[colIndex] 
                        : (row as Record<string, unknown>)[column];
                      
                      return (
                        <td
                          key={colIndex}
                          className={`px-3 py-4 text-sm text-foreground sm:px-6 ${colIndex === 0 ? 'max-w-[150px] sm:max-w-[200px] break-words' : 'whitespace-nowrap'
                            }`}
                          title={colIndex === 0 ? String(cellValue || '') : undefined}
                        >
                          {String(cellValue || '')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between mt-4 space-y-2 sm:space-y-0">
            <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
              Showing {startIndex + 1} to {endIndex} of {totalItems} entries
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrevious}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs sm:text-sm border border-input rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="text-xs sm:text-sm text-muted-foreground">
                {currentPage}/{totalPages}
              </span>
              <button
                onClick={handleNext}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs sm:text-sm border border-input rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      );
    } catch (error) {
      console.error('Error rendering table:', error);
      return (
        <div className="flex items-center justify-center h-32 bg-muted/20 rounded-lg border border-dashed border-muted-foreground/25">
          <div className="text-center p-4">
            <div className="text-muted-foreground text-sm">
              ⚠️ Table rendering failed
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          </div>
        </div>
      );
    }
  };

  const shouldShowTabs = showChart && showTable && chartConfig && tableData;

  return (
    <div className={`bg-transparent rounded-xl ${className}`}>
      <div className="p-3 sm:p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>

        {shouldShowTabs && (
          <div className='w-full flex justify-center'>
            <div className="flex space-x-2 mb-4 sm:mb-6 bg-muted/50 p-1 rounded-full w-full max-w-[350px]">
              <button
                onClick={() => setActiveTab('chart')}
                className={`flex-1 px-6 py-2 text-xs sm:text-sm font-medium rounded-full transition-all ${activeTab === 'chart'
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Chart
              </button>
              <button
                onClick={() => setActiveTab('table')}
                className={`flex-1 px-6 py-2 text-xs sm:text-sm font-medium rounded-full transition-all ${activeTab === 'table'
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Table
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {activeTab === 'chart' && showChart && chartConfig && (
            <div className="h-96">
              {renderChart()}
            </div>
          )}

          {activeTab === 'table' && showTable && tableData && (
            <div>
              {renderTable()}
            </div>
          )}

          {!shouldShowTabs && showChart && chartConfig && (
            <div className="h-96">
              {renderChart()}
            </div>
          )}

          {!shouldShowTabs && showTable && tableData && (
            <div>
              {renderTable()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};