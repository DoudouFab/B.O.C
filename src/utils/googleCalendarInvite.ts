import {
  auth,
  clearCachedCalendarAccessToken,
  getCachedCalendarAccessToken,
  requestCalendarAccessToken,
} from '../firebase';

export interface CalendarInvitePayload {
  summary: string;
  description: string;
  location?: string;
  start: Date;
  end: Date;
  attendeeEmails: string[];
}

export async function sendGoogleCalendarInvites(
  payload: CalendarInvitePayload
): Promise<{ htmlLink?: string; attendeesCount: number; organizerEmail: string }> {
  const attendees = Array.from(
    new Set(
      payload.attendeeEmails
        .map((e) => e.trim())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    )
  ).map((email) => ({ email }));

  if (attendees.length === 0) {
    throw new Error('Aucun destinataire valide sélectionné.');
  }

  const timeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Brussels';

  const body = {
    summary: payload.summary,
    location: payload.location || undefined,
    description: payload.description,
    start: {
      dateTime: payload.start.toISOString(),
      timeZone,
    },
    end: {
      dateTime: payload.end.toISOString(),
      timeZone,
    },
    attendees,
  };

  const executePost = async (accessToken: string) =>
    fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

  let token =
    getCachedCalendarAccessToken() || (await requestCalendarAccessToken());
  let res = await executePost(token);

  if (res.status === 401 || res.status === 403) {
    clearCachedCalendarAccessToken();
    token = await requestCalendarAccessToken();
    res = await executePost(token);
  }

  if (!res.ok) {
    let detail = `Erreur Google Calendar (${res.status})`;
    try {
      const errJson = (await res.json()) as {
        error?: { message?: string };
      };
      if (errJson?.error?.message) {
        detail = errJson.error.message;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(detail);
  }

  const created = (await res.json()) as {
    htmlLink?: string;
    organizer?: { email?: string };
    creator?: { email?: string };
  };
  return {
    htmlLink: created.htmlLink,
    attendeesCount: attendees.length,
    organizerEmail:
      created.organizer?.email ||
      created.creator?.email ||
      auth.currentUser?.email ||
      '',
  };
}
