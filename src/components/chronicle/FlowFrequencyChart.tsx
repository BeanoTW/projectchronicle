import { useMemo } from 'react';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

interface Props {
  /** Sorted ASC, valid dates only */
  dates: Date[];
}

const WINDOW_DAYS = 14;

const FlowFrequencyChart = ({ dates }: Props) => {
  const chartData = useMemo(() => {
    if (dates.length < 3) return [];

    const first = dates[0];
    const last = dates[dates.length - 1];
    const totalSpan = differenceInDays(last, first);

    if (totalSpan < 2) return [];

    // Build rolling windows
    const data: { label: string; count: number; windowStart: Date }[] = [];
    let windowStart = first;

    while (windowStart <= last) {
      const windowEnd = addDays(windowStart, WINDOW_DAYS - 1);
      const count = dates.filter(
        d => d >= windowStart && d <= windowEnd
      ).length;

      data.push({
        label: format(windowStart, 'MMM yyyy'),
        count,
        windowStart,
      });

      windowStart = addDays(windowStart, WINDOW_DAYS);
    }

    return data;
  }, [dates]);

  if (chartData.length < 2) return null;

  return (
    <div className="w-full h-[100px] mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            strokeOpacity={0.3}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            fill="url(#flowGrad)"
            dot={{
              r: 2.5,
              fill: 'hsl(var(--primary))',
              stroke: 'hsl(var(--background))',
              strokeWidth: 1,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FlowFrequencyChart;
