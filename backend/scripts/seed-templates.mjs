// One-off script: seed the 9 question templates (Simon's original fixed
// questions) into the QuestionTemplates table, and wipe the old test
// Exhibitions/Responses data left over from the pre-redesign schema
// (fixedAnswers/variableAnswers, variableQuestions) — confirmed disposable.
//
// Run after `terraform apply` has created the QuestionTemplates table:
//   node backend/scripts/seed-templates.mjs
//
// Uses the ambient AWS credential chain (same as the AWS CLI) and the
// region set in AWS_REGION / the default profile — this is a local
// operator script, not a Lambda handler, so it isn't bundled by esbuild.

import {
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION ?? 'eu-central-1';
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const EXHIBITIONS_TABLE = 'spicy-Exhibitions';
const RESPONSES_TABLE = 'spicy-Responses';
const QUESTION_TEMPLATES_TABLE = 'spicy-QuestionTemplates';

const templates = [
  {
    templateId: 'tpl_emotionExhibition',
    text: 'Wie sehr hat dich die Ausstellung berührt / bewegt / betroffen gemacht?',
    type: 'scale',
    section: 'exhibition',
    order: 0,
    min: 1,
    max: 6,
    labelMin: 'Null und nichts',
    labelMax: 'Volltreffer / im Innersten aufgewühlt',
  },
  {
    templateId: 'tpl_noteToArtist',
    text: 'Verfasse eine Notiz für den Künstler / die Künstlerin oder an spicy.',
    type: 'text',
    section: 'exhibition',
    order: 1,
  },
  {
    templateId: 'tpl_whatYouValue',
    text: 'Was schätzt / liebst du an dieser Ausstellung?',
    type: 'text',
    section: 'exhibition',
    order: 2,
  },
  {
    templateId: 'tpl_chiliRating',
    text: 'Wie viele Chili-Schoten bekommt spicy von dir?',
    type: 'scale',
    section: 'spicy',
    order: 0,
    min: 1,
    max: 6,
    displayVariant: 'chili',
  },
  {
    templateId: 'tpl_whatConvinces',
    text: 'Womit überzeugt dich der Kunstraum spicy besonders?',
    type: 'checkbox',
    section: 'spicy',
    order: 1,
    options: [
      { id: 'opt_access247', text: '24/7- Zugänglichkeit' },
      { id: 'opt_lowThreshold', text: 'Niederschwelliger Zugang zu Kunst' },
      { id: 'opt_artSelection', text: 'Auswahl der aktuellen Kunstposition' },
      { id: 'opt_digitalInfo', text: 'Digitale Informationen zur Ausstellung' },
      { id: 'opt_participation', text: 'Mitmach- Impulse und Aktivierung' },
      { id: 'opt_inclusion', text: 'Inklusion der Menschen vor Ort' },
      { id: 'opt_artNature', text: 'Verbindung von Kunst und Natur' },
      { id: 'opt_parkLocation', text: 'Die Lage im Park der Villa' },
    ],
  },
  {
    templateId: 'tpl_visitorType',
    text: 'Du bist...',
    type: 'checkbox',
    section: 'person',
    order: 0,
    options: [
      { id: 'opt_flaneurin', text: 'eine Park- Flaneurin' },
      { id: 'opt_zufallsgast', text: 'ein Zufallsgast' },
      { id: 'opt_inspirationsSuchende', text: 'eine Inspirations-Suchende' },
      { id: 'opt_kunstNerd', text: 'ein Kunst-Nerd' },
      { id: 'opt_verirrte', text: 'eine Verirrte' },
      { id: 'opt_stammgast', text: 'ein Stammgast' },
    ],
  },
  {
    templateId: 'tpl_distanceTravelled',
    text: 'Wie weit bist du „gegangen" für spicy?',
    type: 'slider',
    section: 'person',
    order: 1,
    options: [
      '20m', '500m', '1km', '3km', '5km', '10km', '25km', '50km',
      '75km', '100km', '150km', '200km', '200km+',
    ].map((label, i) => ({ id: `opt_dist${i}`, text: label })),
  },
  {
    templateId: 'tpl_websiteEase',
    text: 'Wie einfach ist es, die Website von spicy zu verstehen?',
    type: 'scale',
    section: 'homepage',
    order: 0,
    min: 1,
    max: 6,
    labelMin: 'Extrem einfach',
    labelMax: 'gar nicht einfach',
  },
  {
    templateId: 'tpl_howToImprove',
    text: 'Wie könnten wir den Kunstraum spicy und unsere Website noch verbessern?',
    type: 'text',
    section: 'homepage',
    order: 1,
  },
];

async function seedTemplates() {
  for (const template of templates) {
    await dynamo.send(new PutCommand({ TableName: QUESTION_TEMPLATES_TABLE, Item: template }));
    console.log(`  seeded ${template.templateId}`);
  }
}

async function wipeTable(tableName, keyAttrs) {
  const { Items: items = [] } = await dynamo.send(new ScanCommand({ TableName: tableName }));
  for (const item of items) {
    const Key = Object.fromEntries(keyAttrs.map((k) => [k, item[k]]));
    await dynamo.send(new DeleteCommand({ TableName: tableName, Key }));
  }
  console.log(`  wiped ${items.length} item(s) from ${tableName}`);
}

console.log(`Seeding QuestionTemplates (region ${REGION})...`);
await seedTemplates();

console.log('Wiping old test Exhibitions/Responses data (pre-redesign schema)...');
await wipeTable(RESPONSES_TABLE, ['exhibitionId', 'responseId']);
await wipeTable(EXHIBITIONS_TABLE, ['exhibitionId']);

console.log('Done.');
