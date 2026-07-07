// The 4 fixed sections (formerly the 4 hardcoded survey pages). Every
// question — template-derived or freeform — is assigned to exactly one of
// these via its `section` key. The set itself is not admin-editable.

export const SECTIONS = [
  { key: 'exhibition', title: 'Zur Ausstellung' },
  { key: 'spicy',      title: 'Zu spicy' },
  { key: 'person',     title: 'Zur Person' },
  { key: 'homepage',   title: 'Zur Homepage' },
];

export const SECTION_KEYS = SECTIONS.map((s) => s.key);
