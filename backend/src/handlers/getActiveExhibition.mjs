// GET /exhibitions/active
//
// Active state is derived from dates at request time — never stored as a flag.
// Returns 200 in all cases with a `status` discriminator so the frontend can
// show the right screen without treating 4xx as a normal flow.

import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../lib/dynamoClient.mjs';

const EXHIBITIONS_TABLE = process.env.EXHIBITIONS_TABLE;

// Trim to YYYY-MM-DD in UTC so ISO date strings compare lexicographically.
// Lexicographic order == chronological order for YYYY-MM-DD, so plain string
// comparison works for all date range checks below.
const todayUTC = () => new Date().toISOString().slice(0, 10);

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async () => {
  const today = todayUTC();

  const { Items: exhibitions = [] } = await dynamo.send(
    new ScanCommand({ TableName: EXHIBITIONS_TABLE })
  );

  // ── Case 1: one or more active exhibitions ─────────────────────────────────
  // startDate <= today <= endDate  (ISO string lex comparison)
  const active = exhibitions.filter(
    (ex) => ex.startDate <= today && today <= ex.endDate
  );

  if (active.length === 1) {
    return json(200, {
      status: 'active',
      exhibition: active[0], // includes questions the frontend renders
    });
  }

  if (active.length > 1) {
    // Overlapping date ranges — let the frontend show a picker screen.
    // Lightweight list only; the frontend fetches the full exhibition
    // (including questions) once the visitor picks one.
    return json(200, {
      status: 'multiple',
      exhibitions: active.map((ex) => ({
        exhibitionId: ex.exhibitionId,
        name: ex.name,
        startDate: ex.startDate,
        endDate: ex.endDate,
      })),
    });
  }

  // ── Case 2: no active exhibition, but at least one finished ───────────────
  // Finished = endDate < today; pick the one with the most recent endDate.
  const finished = exhibitions
    .filter((ex) => ex.endDate < today)
    .sort((a, b) => b.endDate.localeCompare(a.endDate));

  if (finished.length > 0) {
    const last = finished[0];
    return json(200, {
      status: 'closed',
      // Frontend uses name + endDate for the "feedback closed" message.
      lastExhibition: {
        exhibitionId: last.exhibitionId,
        name: last.name,
        endDate: last.endDate,
      },
    });
  }

  // ── Case 3: no exhibitions exist at all ───────────────────────────────────
  return json(200, { status: 'none' });
};
