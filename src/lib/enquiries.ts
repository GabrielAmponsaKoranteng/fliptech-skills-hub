import type { Enquiry } from '../types';

/** A centre's enquiries, newest first. */
export const centreEnquiries = (all: Enquiry[], providerId: string): Enquiry[] =>
  all.filter((e) => e.providerId === providerId).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
