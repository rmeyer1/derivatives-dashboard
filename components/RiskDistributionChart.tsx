'use client';

import { useState } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RiskDistributionItem {
  strategy: string;
  collateral: number;
  percentage: number;
}

interface RiskDistributionChartProps {
  data: RiskDistributionItem[];
  loading?: boolean;
}

const STRATEGY_COLORS: Record<string, string> = {
  'Cash Secured Put': '#3b82f6',
  'Covered Call': '#22c55e',
  'Bull Put Spread': '#a855f7',
  'Put Credit Spread': '#a855f7',
  'Call Credit Spread': '#f97316',
  'Call Debit Spread': '#ec4899',
  'Put Debit Spread': '#06b6d4',
  'Iron Condor': '#6366f1',
  'Custom': '#6b7280',
};

export function RiskDistributionChart({ data, loading = false }: RiskDistributionChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Risk Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse bg-gray-200 rounded-full h-40 w-40" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Risk Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No open positions
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalCollateral = data.reduce((sum, item) => sum + item.collateral, 0);

  const chartData = data.map(item => ({
    name: item.strategy,
    value: item.collateral,
    percentage: item.percentage,
    color: STRATEGY_COLORS[item.strategy] || '#6b7280'
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-medium">{item.name}</p>
          <p className="text-muted-foreground">
            Collateral: ${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-muted-foreground">{item.percentage.toFixed(1)}% of total</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Risk Distribution</CardTitle>
        <p className="text-xs text-muted-foreground">
          Total BP at Risk: ${totalCollateral.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    stroke={activeIndex === index ? '#fff' : 'none'}
                    strokeWidth={activeIndex === index ? 3 : 0}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 grid grid-cols-2 gap-2">
          {data.map((item) => (
            <div 
              key={item.strategy}
              className="flex items-center justify-between p-2 rounded bg-muted/50 text-xs"
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: STRATEGY_COLORS[item.strategy] || '#6b7280' }}
                />
                <span className="truncate">{item.strategy}</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                ${(item.collateral / 1000).toFixed(1)}k
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
