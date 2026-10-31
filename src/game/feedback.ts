/**
 * In-game rating and review, sent into the team's Google Form. The form is described by its
 * "pre-filled link" (Google Forms: three dots > Get pre-filled link), filled in with sample
 * answers so we can tell the questions apart:
 *
 *   - the star question answered with 5 (a 1 to 5 scale, or a choice such as "5 stars")
 *   - the review question answered with the word review
 *   - optionally a question answered with the word nickname, and one with the word mode
 *
 * From that link we get where to send answers (…/formResponse) and each question's entry id.
 */

export interface FeedbackForm {
  /** Where answers are posted. */
  action: string;
  /** Entry id of the star question, and its answer with the number swapped in (e.g. "{n} stars"). */
  stars: { entry: string; template: string };
  review?: string;
  nickname?: string;
  mode?: string;
}

export interface FeedbackAnswer {
  stars: number;
  review: string;
  nickname: string;
  mode: string;
}

/** Reads a Google Forms pre-filled link; null if it isn't one or has no star question. */
export function parsePrefilledLink(link: string): FeedbackForm | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.hostname !== 'docs.google.com' || !/\/forms\/(u\/\d+\/)?d\//.test(url.pathname)) return null;
  const action = `${url.origin}${url.pathname.replace(/\/(viewform|formResponse|edit)$/, '')}/formResponse`;
  let stars: FeedbackForm['stars'] | undefined;
  const out: Omit<FeedbackForm, 'action' | 'stars'> = {};
  for (const [key, raw] of url.searchParams) {
    if (!/^entry\.\d+$/.test(key)) continue;
    const v = raw.trim();
    const low = v.toLowerCase();
    if (!stars && /\d/.test(v)) stars = { entry: key, template: v.replace(/\d+/, '{n}') };
    else if (low === 'review') out.review = key;
    else if (low === 'nickname') out.nickname = key;
    else if (low === 'mode') out.mode = key;
  }
  return stars ? { action, stars, ...out } : null;
}

/** The form fields to post for one answer. */
export function feedbackBody(form: FeedbackForm, a: FeedbackAnswer): URLSearchParams {
  const body = new URLSearchParams();
  const n = Math.max(1, Math.min(5, Math.round(a.stars)));
  body.set(form.stars.entry, form.stars.template.replace('{n}', String(n)));
  if (form.review && a.review.trim()) body.set(form.review, a.review.trim().slice(0, 1000));
  if (form.nickname) body.set(form.nickname, a.nickname);
  if (form.mode) body.set(form.mode, a.mode);
  return body;
}
