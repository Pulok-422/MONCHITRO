import { METRIC_TOOLTIPS } from '@/lib/metricTooltips';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  text?: string;
  label?: string;
}

export default function MetricInfoTooltip({ text, label }: Props) {
  const content = text ?? (label ? METRIC_TOOLTIPS[label] : undefined);

  if (!content) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${label ?? 'metric'}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>

      <TooltipContent
        side="top"
        align="center"
        sideOffset={6}
        className="max-w-[240px] rounded-lg border-0 bg-gray-900 p-2 text-[11px] leading-relaxed text-white shadow-lg"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
