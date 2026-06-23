// Generates the "Time per project" Base, templating the folder filter to the
// configured session folder so the rollup never points at a stale path.
export function buildBaseFile(sessionFolder: string): string {
	return `filters:
  and:
    - file.inFolder("${sessionFolder}")
    - 'file.ext == "md"'
formulas:
  total_h: '(duration / 60).round(2)'
properties:
  duration:
    displayName: "Minutes"
  formula.total_h:
    displayName: "Hours"
views:
  - type: table
    name: "Time per project"
    groupBy:
      property: project
      direction: ASC
    order:
      - file.name
      - project
      - duration
      - formula.total_h
      - date
    summaries:
      duration: Sum
      formula.total_h: Sum
`;
}
