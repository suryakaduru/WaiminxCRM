import { WidgetSkeletonLoader } from '@/page-layout/widgets/components/WidgetSkeletonLoader';
import { useGraphWidgetAggregateQuery } from '@/page-layout/widgets/graph/hooks/useGraphWidgetAggregateQuery';
import { type GraphColor } from '@/page-layout/widgets/graph/types/GraphColor';
import { assertAggregateChartWidgetOrThrow } from '@/page-layout/widgets/graph/utils/assertAggregateChartWidget';
import { createGraphColorRegistry } from '@/page-layout/widgets/graph/utils/createGraphColorRegistry';
import { getColorScheme } from '@/page-layout/widgets/graph/utils/getColorScheme';
import { useCurrentWidget } from '@/page-layout/widgets/hooks/useCurrentWidget';
import { lazy, Suspense, useContext } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { ThemeContext } from 'twenty-ui/theme-constants';

const GraphWidgetAggregateChart = lazy(() =>
  import('@/page-layout/widgets/graph/graph-widget-aggregate-chart/components/GraphWidgetAggregateChart').then(
    (module) => ({
      default: module.GraphWidgetAggregateChart,
    }),
  ),
);

export const GraphWidgetAggregateChartRenderer = () => {
  const widget = useCurrentWidget();
  const { theme } = useContext(ThemeContext);

  assertAggregateChartWidgetOrThrow(widget);

  const { value, loading } = useGraphWidgetAggregateQuery({
    objectMetadataItemId: widget.objectMetadataId,
    configuration: widget.configuration,
  });

  // Configured color is stored as a graph color name (e.g. "blue"); "auto"
  // or unset keeps the default primary text color. Resolve via the same
  // registry the bar/pie charts use so the name maps to a real color.
  const colorName = widget.configuration.color;
  const resolvedColor =
    isDefined(colorName) && colorName !== 'auto'
      ? getColorScheme({
          registry: createGraphColorRegistry(theme.color),
          colorName: colorName as GraphColor,
        }).solid
      : undefined;

  if (loading) {
    return <WidgetSkeletonLoader />;
  }

  return (
    <Suspense fallback={<WidgetSkeletonLoader />}>
      <GraphWidgetAggregateChart
        value={value ?? '-'}
        prefix={widget.configuration.prefix ?? undefined}
        suffix={widget.configuration.suffix ?? undefined}
        color={resolvedColor}
      />
    </Suspense>
  );
};
