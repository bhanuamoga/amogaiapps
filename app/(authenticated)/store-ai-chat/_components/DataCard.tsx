"use client";

import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, CreditCard, BarChart3 } from 'lucide-react';

export interface DataCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    period: string;
    trend: 'up' | 'down';
  };
  icon?: 'dollar' | 'cart' | 'credit' | 'chart';
  className?: string;
}

const iconMap = {
  dollar: DollarSign,
  cart: ShoppingCart,
  credit: CreditCard,
  chart: BarChart3,
};

export const DataCard: React.FC<DataCardProps> = ({
  title,
  value,
  change,
  icon,
  className = "",
}) => {
  const IconComponent = icon ? iconMap[icon] : null;
  const isPositiveChange = change?.trend === 'up';

  return (
    <div className={`bg-transparent rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {change && (
            <div className="flex items-center mt-2">
              {isPositiveChange ? (
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span
                className={`text-sm font-medium ${
                  isPositiveChange ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {isPositiveChange ? '+' : ''}{change.value}% from {change.period}
              </span>
            </div>
          )}
        </div>
        {IconComponent && (
          <div className="ml-4">
            <IconComponent className="h-8 w-8 text-muted-foreground opacity-50" />
          </div>
        )}
      </div>
    </div>
  );
};

export interface DataCardGridProps {
  cards: DataCardProps[];
  className?: string;
}

export const DataCardGrid: React.FC<DataCardGridProps> = ({
  cards,
  className = "",
}) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${className}`}>
      {cards.map((card, index) => (
        <DataCard key={index} {...card} />
      ))}
    </div>
  );
};
