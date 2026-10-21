/** A company with a scheduled campus visit (a dated PPT drive event this cycle). */
export interface CompanyVisit {
  company: string;
  sector: string | null;
  hrName: string | null;
  email: string | null;
  phoneNumber: string | null;
  /** YYYY-MM-DD */
  visitDate: string;
}

export interface CalendarData {
  visits: CompanyVisit[];
  /** Existing company names, so the form can reuse a company instead of duplicating it. */
  companyNames: string[];
}
