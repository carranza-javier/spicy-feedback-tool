import { VariableQuestion } from '../core/services/api';

export interface QuestionDef {
  key: string;
  label: string;
  // 'slider' is a distinct labelled-category type: stores the selected
  // stop's label string (not a number), rendered by DistanceSlider only —
  // never confuse with 'scale', which stores a plain numeric value.
  type: 'scale' | 'checkbox' | 'text' | 'slider';
  min?: number;
  max?: number;
  labelMin?: string;
  labelMax?: string;
  options?: string[];
}

export interface PageDef {
  title: string;
  questions: QuestionDef[];
}

export const FIXED_PAGES: PageDef[] = [
  {
    title: 'Zur Ausstellung',
    questions: [
      {
        key: 'emotionExhibition',
        label: 'Wie sehr hat dich die Ausstellung berührt / bewegt / betroffen gemacht?',
        type: 'scale',
        min: 0, max: 10,
        labelMin: 'Null und nichts',
        labelMax: 'Volltreffer / im Innersten aufgewühlt',
      },
      {
        key: 'noteToArtist',
        label: 'Verfasse eine Notiz für den Künstler / die Künstlerin oder an spicy.',
        type: 'text',
      },
      {
        key: 'whatYouValue',
        label: 'Was schätzt / liebst du an dieser Ausstellung?',
        type: 'text',
      },
    ],
  },
  {
    title: 'Zu spicy',
    questions: [
      {
        key: 'chiliRating',
        label: 'Wie viele Chili-Schoten bekommt spicy von dir?',
        type: 'scale',
        min: 1, max: 5,
      },
      {
        key: 'whatConvinces',
        label: 'Womit überzeugt dich der Kunstraum spicy besonders?',
        type: 'checkbox',
        options: [
          '24/7- Zugänglichkeit',
          'Niederschwelliger Zugang zu Kunst',
          'Auswahl der aktuellen Kunstposition',
          'Digitale Informationen zur Ausstellung',
          'Mitmach- Impulse und Aktivierung',
          'Inklusion der Menschen vor Ort',
          'Verbindung von Kunst und Natur',
          'Die Lage im Park der Villa',
        ],
      },
    ],
  },
  {
    title: 'Zur Person',
    questions: [
      {
        key: 'visitorType',
        label: 'Du bist...',
        type: 'checkbox',
        options: [
          'eine Park- Flaneurin',
          'ein Zufallsgast',
          'eine Inspirations-Suchende',
          'ein Kunst-Nerd',
          'eine Verirrte',
          'ein Stammgast',
        ],
      },
      {
        key: 'distanceTravelled',
        label: 'Wie weit bist du „gegangen" für spicy?',
        type: 'slider',
        options: [
          '20m', '500m', '1km', '3km', '5km', '10km', '25km', '50km',
          '75km', '100km', '150km', '200km', '200km+',
        ],
      },
    ],
  },
  {
    title: 'Zur Homepage',
    questions: [
      {
        key: 'websiteEase',
        label: 'Wie einfach ist es, die Website von spicy zu verstehen?',
        type: 'scale',
        min: 0, max: 10,
        labelMin: 'Extrem einfach',
        labelMax: 'gar nicht einfach',
      },
      {
        key: 'howToImprove',
        label: 'Wie könnten wir den Kunstraum spicy und unsere Website noch verbessern?',
        type: 'text',
      },
    ],
  },
];

export const FIXED_QUESTION_KEYS = new Set<string>([
  'emotionExhibition', 'noteToArtist', 'whatYouValue',
  'chiliRating', 'whatConvinces',
  'visitorType', 'distanceTravelled',
  'websiteEase', 'howToImprove',
]);

export function mapVariableQuestion(vq: VariableQuestion): QuestionDef {
  return {
    key: vq.id,
    label: vq.text,
    type: vq.type,
    options: vq.options,
    min: vq.min,
    max: vq.max,
    labelMin: vq.labelMin,
    labelMax: vq.labelMax,
  };
}
