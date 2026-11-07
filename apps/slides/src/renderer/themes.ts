/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/**
 * Built-in theme presets (Design tab theme gallery) — full color + font schemes.
 *
 * Each set = the 12 OOXML clrScheme slots + latin fonts for headings/body. On apply, the main
 * process rewrites theme*.xml in the package (scheme-referenced colors follow), and remaps the
 * deck's explicit srgbClr colors onto the new palette (neutrals
 * move along the dk1<->lt1 axis, chromatic colors map to accent1..6 by frequency, changing hue
 * only while keeping lightness) — so decks with explicit colors can also be reskinned in one click.
 *
 * Slot semantics: dk1=body text color, lt1=page background, dk2/lt2=secondary dark/light,
 * accent1..6=accent colors, hlink/folHlink=hyperlink colors.
 */

export interface SlideThemePreset {
  id: string
  name: string
  colors: Record<string, string>
  majorFont?: string
  minorFont?: string
}

const scheme = (
  dk1: string,
  lt1: string,
  dk2: string,
  lt2: string,
  accents: [string, string, string, string, string, string],
  hlink: string,
): Record<string, string> => ({
  dk1,
  lt1,
  dk2,
  lt2,
  accent1: accents[0],
  accent2: accents[1],
  accent3: accents[2],
  accent4: accents[3],
  accent5: accents[4],
  accent6: accents[5],
  hlink,
  folHlink: '954F72',
})

export const THEME_PRESETS: SlideThemePreset[] = [
  {
    id: 'office',
    name: 'Office',
    colors: scheme(
      '000000',
      'FFFFFF',
      '44546A',
      'E7E6E6',
      ['4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47'],
      '0563C1',
    ),
    majorFont: 'Calibri Light',
    minorFont: 'Calibri',
  },
  {
    id: 'ember',
    name: 'Ember',
    colors: scheme(
      '2B1B14',
      'FFFFFF',
      '632B1A',
      'F7EBE6',
      ['C43E1C', 'E97132', 'FFC000', '8A3B12', 'D98F73', 'A33517'],
      'C43E1C',
    ),
    majorFont: 'Trebuchet MS',
    minorFont: 'Calibri',
  },
  {
    id: 'indigo',
    name: 'Indigo',
    colors: scheme(
      '1F2A44',
      'FFFFFF',
      '3B4C77',
      'E8ECF6',
      ['2E4FA3', '5B79C7', '8FA6DE', 'E97132', '31A5A0', '7030A0'],
      '2E4FA3',
    ),
    majorFont: 'Segoe UI',
    minorFont: 'Segoe UI',
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: scheme(
      '1E2B20',
      'FFFFFF',
      '375E43',
      'E9F2EB',
      ['217346', '4EA72E', '92D050', 'FFC000', '3E8E8B', '70AD47'],
      '217346',
    ),
    majorFont: 'Candara',
    minorFont: 'Candara',
  },
  {
    id: 'cream',
    name: 'Cream',
    colors: scheme(
      '3B3226',
      'FBF6EC',
      '6E5F49',
      'F0E7D5',
      ['C0A062', '8A6D3B', 'B65C33', '6E8B5E', '4E7CA1', '9E5D74'],
      '8A6D3B',
    ),
    majorFont: 'Georgia',
    minorFont: 'Georgia',
  },
  {
    id: 'rose',
    name: 'Rose',
    colors: scheme(
      '3A1F33',
      'FFFFFF',
      '6E3A62',
      'F8ECF4',
      ['B44582', 'D96FA8', 'E9A6C9', '7030A0', 'E97132', '4E7CA1'],
      'B44582',
    ),
    majorFont: 'Trebuchet MS',
    minorFont: 'Calibri',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    colors: scheme(
      'F2F2F2',
      '1E1E1E',
      'D9D9D9',
      '333333',
      ['4FC3F7', 'FFB74D', '81C784', 'BA68C8', 'E57373', '90A4AE'],
      '4FC3F7',
    ),
    majorFont: 'Segoe UI',
    minorFont: 'Segoe UI',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    colors: scheme(
      'EAF2FF',
      '0F1C2E',
      'BCD0EC',
      '1E3350',
      ['4A9EDE', '63C7B2', 'F2C14E', 'E4718D', '9B8CDE', '7FB069'],
      '6FB3EC',
    ),
    majorFont: 'Calibri Light',
    minorFont: 'Calibri',
  },
  // Open-Slide Showcase Theme Presets (extracted from open-slide/apps/demo)
  {
    id: 'openslide-quire',
    name: 'Quire Apple',
    colors: scheme(
      '1D1D1F',
      'FFFFFF',
      '6E6E73',
      'F5F5F7',
      ['0071E3', '147CE5', '34C759', 'FF9F0A', 'AF52DE', 'FF375F'],
      '0071E3',
    ),
    majorFont: 'Segoe UI',
    minorFont: 'Segoe UI',
  },
  {
    id: 'openslide-lattice',
    name: 'Lattice Dark',
    colors: scheme(
      'EDEDED',
      '0A0A0A',
      'A1A1A1',
      '161616',
      ['52A8FF', '45A557', 'F75F8F', 'F5A623', '7928CA', '50E3C2'],
      '52A8FF',
    ),
    majorFont: 'Segoe UI',
    minorFont: 'Segoe UI',
  },
  {
    id: 'openslide-northfold',
    name: 'Northfold Swiss',
    colors: scheme(
      '141414',
      'F3F1EC',
      '85817A',
      'E9E6DF',
      ['E8471C', '1F7A4C', '2B5B84', 'B8860B', '5A5751', 'C83E18'],
      'E8471C',
    ),
    majorFont: 'Arial',
    minorFont: 'Arial',
  },
  {
    id: 'openslide-fieldwork',
    name: 'Fieldwork Notion',
    colors: scheme(
      '191919',
      'FFFEFC',
      '5F5E5B',
      'F7F6F3',
      ['E8553B', '2B6CB0', '2F855A', 'D69E2E', 'B83280', '6B46C1'],
      '2B6CB0',
    ),
    majorFont: 'Georgia',
    minorFont: 'Calibri',
  },
  {
    id: 'openslide-marlow',
    name: 'Marlow Terminal',
    colors: scheme(
      'ECE6D6',
      '0B0A08',
      '9C9484',
      '1C1914',
      ['FFB21A', '56D08B', 'FF5A4E', '4DA3FF', 'D49B27', '8E8676'],
      'FFB21A',
    ),
    majorFont: 'Consolas',
    minorFont: 'Calibri',
  },
  {
    id: 'openslide-pommi',
    name: 'Pommi Series B',
    colors: scheme(
      '151313',
      'FFF3DF',
      '6E665E',
      'FFFCF6',
      ['FF5A2C', 'FFD23F', '7EDDB0', '98A6FF', 'FFB0D0', 'E0481E'],
      'FF5A2C',
    ),
    majorFont: 'Trebuchet MS',
    minorFont: 'Calibri',
  },
  {
    id: 'openslide-aero',
    name: 'Aero Kinetic',
    colors: scheme(
      'FFFFFF',
      '4B1DFF',
      'D8D4F2',
      '280E99',
      ['D8FF2E', 'FF4A3D', '00E5FF', 'FFB800', 'B39DDB', 'FF80AB'],
      'D8FF2E',
    ),
    majorFont: 'Arial Black',
    minorFont: 'Arial',
  },
  {
    id: 'openslide-halden',
    name: 'Halden Industrial',
    colors: scheme(
      'F4F3EF',
      '08090B',
      '8C8F96',
      '14161B',
      ['FF7A2F', '38BDF8', '34D399', 'FBBF24', 'A1A1AA', 'E15A14'],
      'FF7A2F',
    ),
    majorFont: 'Arial',
    minorFont: 'Calibri',
  },
  {
    id: 'openslide-arden',
    name: 'Arden Blueprint',
    colors: scheme(
      'EEF5FF',
      '0F3B6E',
      '9DBEE0',
      '0C3360',
      ['8FD8FF', 'FFD27A', '6EE7B7', 'FCA5A5', '60A5FA', '93C5FD'],
      '8FD8FF',
    ),
    majorFont: 'Consolas',
    minorFont: 'Calibri',
  },
  {
    id: 'openslide-solenne',
    name: 'Solenne Biotech',
    colors: scheme(
      '0C1A24',
      'F2F5F4',
      '66767F',
      'E3ECEA',
      ['0A8F7F', '1D6FA5', '2E8B57', 'D97706', '4F46E5', '0F766E'],
      '0A8F7F',
    ),
    majorFont: 'Calibri',
    minorFont: 'Calibri',
  },
  {
    id: 'openslide-stackyard',
    name: 'Stackyard Dev',
    colors: scheme(
      '0B0B0B',
      'FBF3E2',
      '4A463F',
      'EDE3CE',
      ['3D5AFE', 'FFE14D', '5CF2B4', 'FF6FB5', 'FF6E40', '2962FF'],
      '3D5AFE',
    ),
    majorFont: 'Consolas',
    minorFont: 'Calibri',
  },
  {
    id: 'openslide-ardent',
    name: 'Ardent Luxury',
    colors: scheme(
      '1B0F0A',
      'F6F0E8',
      '6E5C53',
      'EFE7DC',
      ['E0127A', 'FF6A13', '9B2C2C', 'B7791F', '805AD5', '4A5568'],
      'E0127A',
    ),
    majorFont: 'Georgia',
    minorFont: 'Calibri',
  },
]
