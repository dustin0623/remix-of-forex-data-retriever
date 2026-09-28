/** Every Forex Factory HTML selector lives here, so markup changes touch one file. */
export const FF_SELECTORS = {
  row: "tr.calendar__row[data-event-id]",
  currency: "td.calendar__currency",
  title: ".calendar__event-title",
  impactIcon: "td.calendar__impact span[class*='impact']",
  actual: "td.calendar__actual",
  forecast: "td.calendar__forecast",
  previous: "td.calendar__previous",
} as const;
