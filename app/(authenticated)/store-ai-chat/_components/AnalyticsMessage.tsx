"use client";

import React from 'react';
import { DataDisplay, ChartConfig, TableData } from './DataDisplay';
import { DataCardGrid, DataCardProps } from './DataCard';

export interface AnalyticsData {
  type: 'data_display' | 'data_cards';
  title: string;
  chartConfig?: ChartConfig;
  tableData?: TableData;
  showChart?: boolean;
  showTable?: boolean;
  cards?: DataCardProps[];
  className?: string;
}

export interface AnalyticsMessageProps {
  data: AnalyticsData;
  className?: string;
}

export const AnalyticsMessage: React.FC<AnalyticsMessageProps> = ({
  data,
  className = "",
}) => {
  const renderContent = () => {
    switch (data.type) {
      case 'data_display':
        return (
          <DataDisplay
            title={data.title}
            chartConfig={data.chartConfig}
            tableData={data.tableData}
            showChart={data.showChart}
            showTable={data.showTable}
            className={className}
          />
        );

      case 'data_cards':
        return (
          <div className={className}>
            <h3 className="text-lg font-semibold text-foreground mb-4">{data.title}</h3>
            {data.cards && <DataCardGrid cards={data.cards} />}
          </div>
        );

      default:
        return null;
    }
  };

  return <>{renderContent()}</>;
};

