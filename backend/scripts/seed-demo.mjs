// Reusable seed script: resets Exhibitions/Responses to a known, rich demo
// state — 5 exhibitions covering every lifecycle state (closed, active,
// overlapping-active, not-yet-active) with realistic response data so the
// admin dashboard, CSV export, and the multi-exhibition picker screen all
// have something real to show.
//
// Re-runnable any time: always wipes Exhibitions + Responses first, then
// rebuilds the same 5 exhibitions from scratch (deterministic ids, seeded
// RNG for response data). QuestionTemplates is read-only here — run
// seed-templates.mjs first if it's empty.
//
//   node backend/scripts/seed-demo.mjs
//
// Uses the ambient AWS credential chain (same as the AWS CLI) and the
// region set in AWS_REGION / the default profile — this is a local
// operator script, not a Lambda handler, so it isn't bundled by esbuild.

import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { SECTION_KEYS } from '../src/lib/sections.mjs';

const REGION = process.env.AWS_REGION ?? 'eu-central-1';
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const EXHIBITIONS_TABLE = 'Exhibitions';
const RESPONSES_TABLE = 'Responses';
const QUESTION_TEMPLATES_TABLE = 'QuestionTemplates';

// ── Seeded RNG (mulberry32) — deterministic per exhibition, so re-running
// this script produces byte-identical response data every time. ──────────────
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffled(rng, arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickSubset(rng, options, min, max) {
  const count = Math.min(options.length, min + Math.floor(rng() * (max - min + 1)));
  return shuffled(rng, options).slice(0, count);
}

// Mild positive skew (visitors who bother answering tend to lean positive)
// while still covering every step of the range across enough responses.
function weightedScale(rng, min, max) {
  const n = max - min + 1;
  const weights = Array.from({ length: n }, (_, i) => i + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < n; i++) {
    r -= weights[i];
    if (r <= 0) return min + i;
  }
  return max;
}

function opts(prefix, labels) {
  return labels.map((text, i) => ({ id: `opt_${prefix}${i}`, text }));
}

// ── Dates ──────────────────────────────────────────────────────────────────

function isoDateOffset(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const TODAY = isoDateOffset(0);

function randomTimestampBetween(rng, startDateStr, endDateStrInclusive) {
  const start = Date.parse(`${startDateStr}T00:00:00Z`);
  const end = Date.parse(`${endDateStrInclusive}T23:59:59Z`);
  const t = start + rng() * Math.max(0, end - start);
  return new Date(t).toISOString();
}

// ── Question assembly ──────────────────────────────────────────────────────
// Mirrors what the admin's "+ Neu" flow does client-side (exhibition-edit.ts
// mapTemplateToQuestion): each exhibition gets its own independent copy of
// every question template, plus a couple of freeform "variable" questions
// appended after them in the same section.

function buildQuestions(slug, templates, def) {
  const nextOrderBySection = {};
  const questions = [];
  const textPoolsById = {};

  for (const t of templates) {
    nextOrderBySection[t.section] = Math.max(nextOrderBySection[t.section] ?? -1, t.order) + 1;
    const id = `q_${slug}_${t.templateId}`;
    questions.push({
      id,
      text: t.text,
      type: t.type,
      section: t.section,
      order: t.order,
      ...(t.options ? { options: t.options } : {}),
      ...(t.min != null ? { min: t.min } : {}),
      ...(t.max != null ? { max: t.max } : {}),
      ...(t.labelMin ? { labelMin: t.labelMin } : {}),
      ...(t.labelMax ? { labelMax: t.labelMax } : {}),
      ...(t.displayVariant ? { displayVariant: t.displayVariant } : {}),
      sourceTemplateId: t.templateId,
    });
    if (t.type === 'text' && def.templateTextPools[t.templateId]) {
      textPoolsById[id] = def.templateTextPools[t.templateId];
    }
  }

  for (const extra of def.extraQuestions) {
    const order = nextOrderBySection[extra.section] ?? 0;
    nextOrderBySection[extra.section] = order + 1;
    const id = `q_${slug}_${extra.idSuffix}`;
    questions.push({
      id,
      text: extra.text,
      type: extra.type,
      section: extra.section,
      order,
      ...(extra.options ? { options: extra.options } : {}),
      ...(extra.min != null ? { min: extra.min } : {}),
      ...(extra.max != null ? { max: extra.max } : {}),
      ...(extra.labelMin ? { labelMin: extra.labelMin } : {}),
      ...(extra.labelMax ? { labelMax: extra.labelMax } : {}),
    });
    if (extra.type === 'text' && extra.textPool) {
      textPoolsById[id] = extra.textPool;
    }
  }

  return { questions, textPoolsById };
}

// ── Response generation ────────────────────────────────────────────────────

function generateAnswerForQuestion(rng, q, textPool) {
  if (q.type === 'scale') {
    if (rng() < 0.08) return undefined; // some blank
    return weightedScale(rng, q.min ?? 1, q.max ?? 6);
  }
  if (q.type === 'checkbox') {
    if (rng() < 0.12) return undefined; // some blank
    const picks = pickSubset(rng, q.options ?? [], 1, Math.min(3, (q.options ?? []).length || 1));
    return picks.map((o) => o.id);
  }
  if (q.type === 'slider') {
    if (rng() < 0.1) return undefined; // some blank
    return pickOne(rng, q.options ?? [])?.id;
  }
  // text — left blank more often, matching real free-text completion rates
  if (!textPool || rng() < 0.4) return undefined;
  return pickOne(rng, textPool);
}

function generateAnswers(rng, questions, textPoolsById) {
  const answers = {};
  for (const q of questions) {
    const value = generateAnswerForQuestion(rng, q, textPoolsById[q.id]);
    if (value !== undefined) answers[q.id] = value;
  }
  return answers;
}

// ── Demo exhibition definitions ────────────────────────────────────────────
// Dates are relative offsets from "today" (in days) so the script stays
// correct — closed/active/upcoming — no matter when it's re-run.

const DEFS = [
  {
    slug: 'las12lunas',
    name: 'Las 12 Lunas',
    startOffsetDays: -75,
    endOffsetDays: -30,
    responseCount: 18,
    seed: 1001,
    extraQuestions: [
      {
        idSuffix: 'vq_mondphase',
        text: 'Welche Mondphase hat dich in der Ausstellung am meisten angesprochen?',
        type: 'checkbox',
        section: 'exhibition',
        options: opts('mondphase', ['Neumond', 'Zunehmender Mond', 'Vollmond', 'Abnehmender Mond']),
      },
      {
        idSuffix: 'vq_zeitgefuehl',
        text: 'Wie stark hat dich das Thema der Mondzyklen zum Nachdenken über Zeit gebracht?',
        type: 'scale',
        section: 'spicy',
        min: 1,
        max: 6,
        labelMin: 'Gar nicht',
        labelMax: 'Sehr stark',
      },
    ],
    templateTextPools: {
      tpl_noteToArtist: [
        'Die Installation hat mich richtig mitgenommen — man spürt die Arbeit dahinter.',
        'Danke für diesen ruhigen, fast meditativen Moment mitten im Park.',
        'Ich hätte gern noch mehr über die einzelnen Mondphasen erfahren.',
        'Wunderschön umgesetzt, besonders bei Dämmerlicht.',
        'Bitte mehr davon — genau die Art von Kunst, die spicy ausmacht.',
      ],
      tpl_whatYouValue: [
        'Die Verbindung von Naturzyklen und Kunst.',
        'Dass man sich Zeit nehmen musste, um alles zu sehen.',
        'Die ruhige, fast stille Atmosphäre.',
        'Wie unterschiedlich jede Mondphase dargestellt wurde.',
      ],
      tpl_howToImprove: [
        'Vielleicht kleine Erklärtafeln zu den einzelnen Phasen.',
        'Mehr Sitzgelegenheiten zum Verweilen.',
        'Alles war stimmig, nichts zu verbessern.',
      ],
    },
  },
  {
    slug: 'fuerdiekatz',
    name: 'Für die Katz',
    startOffsetDays: -150,
    endOffsetDays: -95,
    responseCount: 16,
    seed: 2002,
    extraQuestions: [
      {
        idSuffix: 'vq_klischee',
        text: 'Welches Katzen-Klischee hat dich am meisten zum Schmunzeln gebracht?',
        type: 'checkbox',
        section: 'exhibition',
        options: opts('klischee', ['Neugier', 'Unabhängigkeit', 'Faulheit', 'Verspieltheit', 'Geheimnisvoll']),
      },
      {
        idSuffix: 'vq_hundkatze',
        text: 'Wärst du selbst eher Hund oder Katze? Erzähl uns kurz warum.',
        type: 'text',
        section: 'person',
      },
    ],
    templateTextPools: {
      tpl_noteToArtist: [
        'Herrlich ironisch — der Titel passt perfekt zur Ausstellung.',
        'Hat mich zum Lachen gebracht, aber auch zum Nachdenken.',
        'So viel Witz in einer Kunstausstellung habe ich selten gesehen.',
        'Bitte mehr von diesem trockenen Humor.',
      ],
      tpl_whatYouValue: [
        'Den Humor und die Selbstironie.',
        'Dass Kunst auch mal nicht bierernst sein darf.',
        'Die Leichtigkeit der ganzen Ausstellung.',
      ],
      tpl_howToImprove: [
        'Vielleicht ein Katzenmotiv zum Mitnehmen als Andenken.',
        'Vollkommen in Ordnung so, bitte nichts ändern.',
      ],
      vq_hundkatze: [
        'Katze — ich schätze meine Unabhängigkeit genauso.',
        'Eindeutig Hund, ich freue mich einfach über alles zu sehr.',
        'Katze, ganz klar. Neugierig, aber auf eigene Bedingungen.',
        'Hund — treu und ein bisschen tollpatschig, das bin ich auch.',
      ],
    },
  },
  {
    slug: 'bioinformatik3d',
    name: 'BioInformatik 3D',
    startOffsetDays: -10,
    endOffsetDays: 20,
    responseCount: 13,
    seed: 3003,
    extraQuestions: [
      {
        idSuffix: 'vq_futuristisch',
        text: 'Wie futuristisch fühlte sich die Ausstellung für dich an?',
        type: 'scale',
        section: 'exhibition',
        min: 1,
        max: 6,
        labelMin: 'Vertraut',
        labelMax: 'Wie aus einer anderen Zeit',
      },
      {
        idSuffix: 'vq_faszination',
        text: 'Welche Form hat dich am meisten fasziniert?',
        type: 'checkbox',
        section: 'spicy',
        options: opts('faszination', ['DNA-Strukturen', 'Zellwachstum', 'Künstliche Intelligenz', 'Bioprinting', 'Neuronale Netze']),
      },
    ],
    templateTextPools: {
      tpl_noteToArtist: [
        'Beeindruckend, wie organisch die 3D-Drucke wirken.',
        'Habe noch nie Biologie und Technik so verwoben gesehen.',
        'Die Detailtiefe der Strukturen ist unglaublich.',
        'Fühlte mich wie in einem Labor der Zukunft.',
      ],
      tpl_whatYouValue: [
        'Die Präzision der 3D-gedruckten Formen.',
        'Wie zugänglich komplexe Wissenschaft gemacht wurde.',
        'Die Verbindung von Natur und Technologie.',
      ],
      tpl_howToImprove: [
        'Ein QR-Code mit weiterführenden Infos wäre toll.',
        'Vielleicht ein kurzes Video zum Entstehungsprozess.',
      ],
    },
  },
  {
    slug: 'graffiti2030',
    name: 'Graffiti 2030',
    startOffsetDays: -5,
    endOffsetDays: 25,
    responseCount: 14,
    seed: 4004,
    extraQuestions: [
      {
        idSuffix: 'vq_aspekt',
        text: 'Welcher Aspekt der Graffiti-Kunst hat dich am meisten angesprochen?',
        type: 'checkbox',
        section: 'exhibition',
        options: opts('aspekt', ['Farbwahl', 'Botschaft / Statement', 'Technik', 'Größe / Format', 'Ort der Anbringung']),
      },
      {
        idSuffix: 'vq_lautstaerke',
        text: 'Wie "laut" empfandest du die Farbgebung?',
        type: 'slider',
        section: 'spicy',
        options: opts('lautstaerke', ['Sehr leise', 'Leise', 'Ausgewogen', 'Laut', 'Schreiend laut']),
      },
    ],
    templateTextPools: {
      tpl_noteToArtist: [
        'Endlich Street Art, die man ernst nehmen darf und soll.',
        'Die Farben schreien förmlich Zukunft.',
        'Mutig, laut, genau richtig für den Park.',
        'Hat mich an meine eigene Jugend erinnert — toll gemacht.',
      ],
      tpl_whatYouValue: [
        'Die Rohheit und Ehrlichkeit der Technik.',
        'Dass Street Art hier einen echten Rahmen bekommt.',
        'Die Botschaften hinter den Werken.',
      ],
      tpl_howToImprove: [
        'Mehr Infos zu den beteiligten Künstler:innen wären schön.',
        'Eine Nacht-Beleuchtung würde die Farben noch mehr zur Geltung bringen.',
      ],
    },
  },
  {
    slug: 'raumdesschweigens',
    name: 'Raum des Schweigens',
    startOffsetDays: 14,
    endOffsetDays: 60,
    responseCount: 0, // not yet active — can't have responses before it starts
    seed: 5005,
    extraQuestions: [
      {
        idSuffix: 'vq_aushalten',
        text: 'Wie lange konntest du die Stille im Raum aushalten, bevor sie unangenehm wurde?',
        type: 'scale',
        section: 'exhibition',
        min: 1,
        max: 6,
        labelMin: 'Nur Sekunden',
        labelMax: 'Am liebsten für immer',
      },
      {
        idSuffix: 'vq_ausgeloest',
        text: 'Was hat die Stille in dir ausgelöst?',
        type: 'text',
        section: 'person',
      },
    ],
    templateTextPools: {
      tpl_noteToArtist: [],
      tpl_whatYouValue: [],
      tpl_howToImprove: [],
      vq_ausgeloest: [],
    },
  },
];

// ── DynamoDB helpers ───────────────────────────────────────────────────────

async function wipeTable(tableName, keyAttrs) {
  const { Items: items = [] } = await dynamo.send(new ScanCommand({ TableName: tableName }));
  for (const item of items) {
    const Key = Object.fromEntries(keyAttrs.map((k) => [k, item[k]]));
    await dynamo.send(new DeleteCommand({ TableName: tableName, Key }));
  }
  console.log(`  wiped ${items.length} item(s) from ${tableName}`);
}

async function loadTemplates() {
  const { Items: templates = [] } = await dynamo.send(
    new ScanCommand({ TableName: QUESTION_TEMPLATES_TABLE })
  );
  if (templates.length === 0) {
    throw new Error(
      `${QUESTION_TEMPLATES_TABLE} is empty — run backend/scripts/seed-templates.mjs first.`
    );
  }
  return [...templates].sort((a, b) => {
    const sd = SECTION_KEYS.indexOf(a.section) - SECTION_KEYS.indexOf(b.section);
    return sd !== 0 ? sd : a.order - b.order;
  });
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Seeding demo data (region ${REGION})...`);

  console.log('Wiping existing Exhibitions/Responses...');
  await wipeTable(RESPONSES_TABLE, ['exhibitionId', 'responseId']);
  await wipeTable(EXHIBITIONS_TABLE, ['exhibitionId']);

  const templates = await loadTemplates();

  const summary = [];

  for (const def of DEFS) {
    const rng = mulberry32(def.seed);
    const { questions, textPoolsById } = buildQuestions(def.slug, templates, def);

    const startDate = isoDateOffset(def.startOffsetDays);
    const endDate = isoDateOffset(def.endOffsetDays);
    const exhibitionId = `exhibition_demo_${def.slug}`;
    const createdAt = new Date(Date.parse(`${startDate}T09:00:00Z`)).toISOString();

    await dynamo.send(
      new PutCommand({
        TableName: EXHIBITIONS_TABLE,
        Item: { exhibitionId, name: def.name, startDate, endDate, questions, createdAt },
      })
    );

    // Responses may only fall between startDate and min(endDate, today) —
    // never in the future, and never before the exhibition opened.
    const responseWindowEnd = endDate < TODAY ? endDate : TODAY;
    let inserted = 0;

    if (def.responseCount > 0 && startDate <= responseWindowEnd) {
      for (let i = 0; i < def.responseCount; i++) {
        const answers = generateAnswers(rng, questions, textPoolsById);
        const submittedAt = randomTimestampBetween(rng, startDate, responseWindowEnd);
        const responseId = `${Date.parse(submittedAt)}_${randomUUID().slice(0, 8)}`;

        await dynamo.send(
          new PutCommand({
            TableName: RESPONSES_TABLE,
            Item: { exhibitionId, responseId, answers, submittedAt },
          })
        );
        inserted++;
      }
    }

    const status =
      endDate < TODAY ? 'CLOSED' : startDate > TODAY ? 'NOT YET ACTIVE' : 'ACTIVE';

    summary.push({ name: def.name, status, startDate, endDate, responses: inserted });
    console.log(`  ${def.name}: ${status}, ${startDate} → ${endDate}, ${inserted} response(s)`);
  }

  console.log('\n── Summary ──────────────────────────────────────────────');
  for (const s of summary) {
    console.log(`${s.name.padEnd(20)} ${s.status.padEnd(16)} ${s.startDate} → ${s.endDate}   ${s.responses} response(s)`);
  }
  console.log('Done.');
}

await main();
