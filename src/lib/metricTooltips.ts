export const METRIC_TOOLTIPS: Record<string, string> = {
  'Facilities per 100K Population':
    'Number of mental health facilities per 100,000 people in the district. Calculated as: (total facilities ÷ district population) × 100,000. Uses the supplied district population denominators and directory-derived records. Counts reflect current facility filters.',
  'Poverty Index':
    'District poverty indicator from the supplied dataset. Higher values indicate greater poverty burden; the exact source year and definition need verification.',
  'Literacy Rate':
    'District literacy percentage from the supplied BBS dataset. The KPI is the unweighted mean across selected districts.',
  'Urban Percent':
    'Percentage of the district population residing in urban areas. Source: BBS Census 2022.',
  'Population per Facility':
    'Average number of people per mental health facility in the district. This is a density measure, not a direct measure of access. Undefined where the indexed count is zero. Calculated as: district population ÷ total facilities.',
  'Facilities with Free Service':
    'Count of matching records with explicit free-service wording, including spelling and case variants. Unknown costs are excluded.',
  'Total Facilities': 'Count of directory records matching the active filters; not a verified facility census.',
  'Districts Covered': 'Number of districts with at least one matching indexed facility.',
  'Avg Poverty Index':
    'District poverty indicator from the supplied dataset. Higher values indicate greater poverty burden; the exact source year and definition need verification.',
  'Avg Literacy Rate':
    'District literacy percentage from the supplied BBS dataset. The KPI is the unweighted mean across selected districts.',
};

