/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { describe, expect, it } from 'vitest'
import type { PictureRenderNode, RenderSlide, ShapeRenderNode } from '@lycero/pptx-render'
import {
  auditSlideFindings,
  auditSlideLayout,
  checkDesignSystemTokens,
  computeVerticalBudget,
  countSlideWords,
  formatAudit,
} from '../src/slides/layout-audit'
import {
  fillEmptyLines,
  groupAtomsIntoLines,
  lineToRuns,
  needsSubtreeRaster,
  paintsBackgroundSeparately,
  pixelRatioFor,
  type Atom,
} from '../src/slides/scene-measure'

const W = 1280
const H = 720

function placedBox(x: number, y: number, w: number, h: number) {
  return {
    x,
    y,
    w,
    h,
    rotationDeg: 0,
    flipH: false,
    flipV: false,
    centerX: x + w / 2,
    centerY: y + h / 2,
  }
}

function textNode(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { text?: string; contentHeight?: number; runWidth?: number; wrap?: boolean } = {},
): ShapeRenderNode {
  const text = opts.text ?? 'Quarterly wins across regions'
  const contentHeight = opts.contentHeight ?? h
  const runWidth = opts.runWidth ?? Math.min(120, w)
  return {
    id,
    type: 'text',
    box: placedBox(x, y, w, h),
    sourceId: id,
    fill: { kind: 'none' },
    text: {
      lines: [
        {
          runs: [
            {
              text,
              x: 0,
              baselineY: 20,
              fontFamily: 'Arial',
              fontSizePx: 16,
              color: '#111111',
              bold: false,
              italic: false,
              underline: false,
              widthPx: runWidth,
            },
          ],
          top: 0,
          height: 20,
        },
      ],
      insets: { l: 0, t: 0, r: 0, b: 0 },
      anchor: 'top',
      fontScale: 1,
      contentHeight,
      wrap: opts.wrap ?? true,
    },
  }
}

function pictureNode(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<PictureRenderNode> = {},
): PictureRenderNode {
  return { id, type: 'picture', box: placedBox(x, y, w, h), sourceId: id, ...extra }
}

function slide(nodes: RenderSlide['nodes']): RenderSlide {
  return {
    widthPx: W,
    heightPx: H,
    scale: 1,
    background: { kind: 'solid', color: '#FFFFFF' },
    nodes,
  }
}

describe('auditSlideLayout clean pass', () => {
  it('passes widely separated text boxes', () => {
    const s = slide([textNode('a', 80, 80, 400, 100), textNode('b', 700, 400, 400, 100)])
    expect(auditSlideFindings(s)).toEqual([])
    expect(auditSlideLayout(s)).toEqual([])
    expect(formatAudit([])).toContain('Passed')
  })

  it('tolerates edge and overflow noise below the thresholds', () => {
    const s = slide([
      textNode('a', -4, 80, 400, 100, { contentHeight: 102 }),
      textNode('b', 700, 400, 300, 100, { runWidth: 303 }),
    ])
    expect(auditSlideFindings(s)).toEqual([])
  })
})

describe('auditSlideLayout out of bounds', () => {
  it('flags boxes past each canvas edge', () => {
    const s = slide([
      textNode('left', -30, 100, 200, 80),
      textNode('top', 100, -25, 200, 80),
      textNode('right', W - 100, 100, 200, 80),
      textNode('bottom', 100, H - 40, 200, 80),
    ])
    const findings = auditSlideFindings(s)
    expect(findings.map((f) => f.code)).toEqual([
      'out_of_bounds',
      'out_of_bounds',
      'out_of_bounds',
      'out_of_bounds',
    ])
    const messages = findings.map((f) => f.message)
    expect(messages[0]).toContain('past the left edge')
    expect(messages[1]).toContain('past the top edge')
    expect(messages[2]).toContain('past the right edge')
    expect(messages[3]).toContain('past the bottom edge')
    for (const f of findings) {
      expect(f.level).toBe('error')
      expect(f.suggest?.op).toBe('setTransform')
    }
  })
})

describe('auditSlideLayout off slide', () => {
  it('reports a box with no canvas intersection once, as off_slide, with a clamp suggestion', () => {
    const s = slide([
      textNode('gone', W + 50, 100, 200, 80),
      textNode('edge', W - 100, 300, 200, 80),
      textNode('above', 100, -200, 200, 80),
    ])
    const findings = auditSlideFindings(s)
    expect(findings.map((f) => [f.el, f.code])).toEqual([
      ['gone', 'off_slide'],
      ['edge', 'out_of_bounds'],
      ['above', 'off_slide'],
    ])
    const gone = findings[0]!
    expect(gone.level).toBe('error')
    expect(gone.message).toContain('entirely outside the slide')
    expect(gone.message).toContain('past the right edge')
    expect(gone.suggest).toEqual({
      op: 'setTransform',
      target: { el: 'gone' },
      box: { x: (W - 200) * 9525, y: 100 * 9525, cx: 200 * 9525, cy: 80 * 9525 },
    })
    expect(findings[2]!.suggest?.box).toMatchObject({ x: 100 * 9525, y: 0 })
  })

  it('reports a thin line just past the edge as off_slide despite the edge tolerance', () => {
    const s = slide([textNode('rule', 100, H + 2, 400, 4)])
    const findings = auditSlideFindings(s)
    expect(findings.map((f) => f.code)).toEqual(['off_slide'])
    expect(findings[0]!.message).toContain('6px past the bottom edge')
    expect(findings[0]!.suggest?.box).toMatchObject({ y: (H - 4) * 9525 })
  })

  it('keeps a box touching the edge from outside as out_of_bounds', () => {
    const s = slide([textNode('touch', W, 100, 200, 80)])
    expect(auditSlideFindings(s).map((f) => f.code)).toEqual(['out_of_bounds'])
  })
})

describe('auditSlideLayout picture distortion', () => {
  const sizes: Record<string, { w: number; h: number }> = {
    stretched: { w: 800, h: 400 },
    cropped: { w: 800, h: 400 },
    close: { w: 800, h: 400 },
    poster: { w: 800, h: 400 },
  }
  const opts = { pictureSize: (id: string) => sizes[id] }

  it('flags a box whose aspect strays from the source and shrinks the longer side, centred', () => {
    const s = slide([pictureNode('stretched', 100, 100, 400, 400)])
    const findings = auditSlideFindings(s, undefined, opts)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      code: 'picture_distorted',
      level: 'warning',
      el: 'stretched',
      expected_ratio: 2,
      actual_ratio: 1,
      distortion_pct: 50,
    })
    expect(findings[0]!.message).toContain('Picture distorted')
    expect(findings[0]!.suggest).toEqual({
      op: 'setTransform',
      target: { el: 'stretched' },
      box: { x: 100 * 9525, y: 200 * 9525, cx: 400 * 9525, cy: 200 * 9525 },
    })
  })

  it('shrinks a square logo in a banner box to the banner height instead of growing it', () => {
    const s = slide([pictureNode('logo', 100, 100, 600, 100)])
    const findings = auditSlideFindings(s, undefined, { pictureSize: () => ({ w: 256, h: 256 }) })
    expect(findings.map((f) => f.code)).toEqual(['picture_distorted'])
    expect(findings[0]!.suggest!.box).toEqual({
      x: 350 * 9525,
      y: 100 * 9525,
      cx: 100 * 9525,
      cy: 100 * 9525,
    })
  })

  it('grows instead when shrinking would leave the picture under 24px', () => {
    const s = slide([pictureNode('strip', 100, 300, 600, 10)])
    const findings = auditSlideFindings(s, undefined, { pictureSize: () => ({ w: 256, h: 256 }) })
    expect(findings[0]!.suggest!.box).toEqual({
      x: 100 * 9525,
      y: 5 * 9525,
      cx: 600 * 9525,
      cy: 600 * 9525,
    })
  })

  it('compares against the cropped source region and tolerates 5%', () => {
    const s = slide([
      pictureNode('cropped', 100, 100, 300, 300, { srcRect: { l: 0.25, t: 0, r: 0.25, b: 0 } }),
      pictureNode('close', 500, 100, 400, 196),
    ])
    expect(auditSlideFindings(s, undefined, opts)).toEqual([])
  })

  it('skips poster frames, unknown sizes and audits without a size lookup', () => {
    const s = slide([
      pictureNode('poster', 100, 100, 400, 400, { media: 'video' }),
      pictureNode('unknown', 600, 100, 400, 400),
    ])
    expect(auditSlideFindings(s, undefined, opts)).toEqual([])
    expect(auditSlideFindings(slide([pictureNode('stretched', 100, 100, 400, 400)]))).toEqual([])
  })

  it('scales a corrected picture down when the true aspect would not fit the canvas', () => {
    const s = slide([pictureNode('square', 0, 0, W, 1400)])
    const findings = auditSlideFindings(s, undefined, {
      pictureSize: () => ({ w: 400, h: 400 }),
    })
    expect(findings.map((f) => f.code)).toEqual(['out_of_bounds', 'picture_distorted'])
    expect(findings[1]!.suggest!.box).toEqual({
      x: ((W - H) / 2) * 9525,
      y: 0,
      cx: H * 9525,
      cy: H * 9525,
    })
    expect(findings[0]!.suggest).toEqual(findings[1]!.suggest)
  })

  // The distortion loop used to push one finding per picture with no budget
  // gate, while every sibling section reserves ISSUE_RESERVE slots for the
  // sections after it. 14 stretched pictures therefore filled MAX_ISSUES (12)
  // before section 3 ran, and section 3's `findings.length >= budgetFor(0)`
  // broke on its first iteration: the slide's real overlaps were never
  // reported, and two distortion warnings were silently dropped by the final
  // slice. The write->verify->fix loop never sees overlaps on image-heavy
  // slides, which is exactly when they are most likely.
  it('reserves budget for overlap when pictures exhaust the issue budget', () => {
    const distorted = (i: number) => pictureNode(`stretched${i}`, 40 + i * 8, 40, 200, 200)
    const opts = { pictureSize: () => ({ w: 800, h: 400 }) }
    const overlaps = [textNode('overA', 700, 500, 200, 100), textNode('overB', 750, 520, 200, 100)]

    // the same slide reports overlaps at 0/2/4/8 pictures ...
    for (const n of [0, 2, 4, 8]) {
      const s = slide([...Array.from({ length: n }, (_, i) => distorted(i)), ...overlaps])
      const findings = auditSlideFindings(s, undefined, opts)
      expect(findings.filter((f) => f.code === 'overlap').length).toBeGreaterThan(0)
      expect(findings.length).toBeLessThanOrEqual(12)
    }

    // ... and still must at 14, where the distortion loop alone would fill the cap
    const s = slide([...Array.from({ length: 14 }, (_, i) => distorted(i)), ...overlaps])
    const findings = auditSlideFindings(s, undefined, opts)
    const codes = findings.map((f) => f.code)
    expect(codes.filter((c) => c === 'picture_distorted').length).toBe(10)
    expect(codes).toContain('overlap')
    expect(findings.length).toBeLessThanOrEqual(12)
  })
})

describe('auditSlideLayout text overflow', () => {
  it('flags content taller than the box with a taller suggestion', () => {
    const s = slide([textNode('tall', 100, 100, 400, 40, { contentHeight: 100 })])
    const findings = auditSlideFindings(s)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ code: 'text_overflow', level: 'error', el: 'tall' })
    expect(findings[0]!.message).toContain('exceeds the box height by 60px')
    expect(findings[0]!.overflowPx).toBe(60)
    expect(findings[0]!.suggest?.op).toBe('setTransform')
  })

  it('flags a line wider than the box as a width warning', () => {
    const s = slide([textNode('wide', 100, 100, 200, 80, { runWidth: 300 })])
    const findings = auditSlideFindings(s)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ code: 'text_overflow_width', level: 'warning' })
    expect(findings[0]!.message).toContain('exceeds the box width by 100px')
    expect(findings[0]!.suggest?.op).toBe('setTransform')
  })
})

describe('auditSlideLayout overlap', () => {
  it('flags two intersecting text boxes', () => {
    const s = slide([textNode('a', 100, 100, 200, 100), textNode('b', 150, 120, 200, 100)])
    const findings = auditSlideFindings(s)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ code: 'overlap', level: 'warning', el: 'a' })
    expect(findings[0]!.els).toEqual(['a', 'b'])
    expect(findings[0]!.message).toContain('intersect by 150')
    expect(auditSlideLayout(s)).toHaveLength(1)
    expect(formatAudit(auditSlideLayout(s))).toContain('Found 1 issue')
  })

  it('flags text on image but ignores image on image', () => {
    const textOnImage = slide([
      textNode('caption', 100, 100, 200, 100),
      pictureNode('photo', 150, 120, 200, 100),
    ])
    expect(auditSlideFindings(textOnImage).map((f) => f.code)).toEqual(['overlap'])

    const imageOnImage = slide([
      pictureNode('one', 100, 100, 200, 100),
      pictureNode('two', 150, 120, 200, 100),
    ])
    expect(auditSlideFindings(imageOnImage)).toEqual([])
  })

  it('ignores decoration nodes and full-canvas background blocks', () => {
    const decorated = textNode('deco', 150, 120, 200, 100)
    const s = slide([textNode('main', 100, 100, 200, 100), { ...decorated, decoration: true }])
    expect(auditSlideFindings(s)).toEqual([])

    const backdrop = textNode('backdrop', 0, 0, 1200, 650, { text: 'Backdrop block' })
    const small = textNode('small', 100, 100, 200, 100)
    expect(auditSlideFindings(slide([backdrop, small]))).toEqual([])
  })
})

describe('auditSlideLayout issue budget', () => {
  const pair = (): RenderSlide['nodes'] => [
    textNode('a', 500, 300, 200, 100),
    textNode('b', 550, 320, 200, 100),
  ]

  it('keeps reporting overlap findings after the text passes fill the cap', () => {
    const overflowing = Array.from({ length: 20 }, (_, i) =>
      textNode(`tall${i}`, 40, 20 + i * 34, 200, 20, { contentHeight: 90 }),
    )
    const findings = auditSlideFindings(slide([...overflowing, ...pair()]))
    expect(findings.filter((f) => f.code === 'text_overflow')).toHaveLength(8)
    expect(findings.filter((f) => f.code === 'overlap')).toHaveLength(1)
    expect(findings.length).toBeLessThanOrEqual(12)
  })

  it('keeps reporting overlap findings after the out-of-bounds pass fills the cap', () => {
    const stray = Array.from({ length: 20 }, (_, i) =>
      textNode(`stray${i}`, -200 - i, 20 + i * 50, 120, 40),
    )
    const findings = auditSlideFindings(slide([...stray, ...pair()]))
    const offSlide = findings.filter((f) => f.code === 'off_slide' || f.code === 'out_of_bounds')
    expect(offSlide).toHaveLength(6)
    expect(findings.filter((f) => f.code === 'overlap')).toHaveLength(1)
    expect(findings.length).toBeLessThanOrEqual(12)
  })

  it('never exceeds the total cap when every category overflows', () => {
    const nodes: RenderSlide['nodes'] = []
    for (let i = 0; i < 12; i++) {
      nodes.push(textNode(`stray${i}`, -200 - i, 20 + i * 50, 120, 40))
      nodes.push(textNode(`tall${i}`, 40, 20 + i * 34, 200, 20, { contentHeight: 90 }))
      nodes.push(textNode(`overA${i}`, 700 + i, 500, 200, 100))
      nodes.push(textNode(`overB${i}`, 750 + i, 520, 200, 100))
    }
    const findings = auditSlideFindings(slide(nodes))
    expect(findings).toHaveLength(12)
    expect(findings.filter((f) => f.code === 'overlap').length).toBeGreaterThan(0)
  })

  it('leaves an under-budget slide untouched', () => {
    const s = slide([
      textNode('tall', 40, 20, 200, 20, { contentHeight: 90 }),
      textNode('a', 500, 300, 200, 100),
      textNode('b', 550, 320, 200, 100),
    ])
    expect(auditSlideFindings(s).map((f) => f.code)).toEqual(['text_overflow', 'overlap'])
  })
})

describe('open-slide parity: density, bullet wrap, DesignSystem tokens, vertical budget & scene', () => {
  it('warns with bullet_wrap when a bullet paragraph wraps onto multiple lines', () => {
    const multiLineBullet: ShapeRenderNode = {
      id: 'b1',
      type: 'text',
      box: placedBox(80, 120, 400, 120),
      sourceId: 'b1',
      fill: { kind: 'none' },
      text: {
        lines: [
          {
            paraStart: true,
            top: 0,
            height: 24,
            runs: [
              {
                text: '•',
                x: 0,
                baselineY: 18,
                fontFamily: 'Arial',
                fontSizePx: 16,
                color: '#111111',
                bold: false,
                italic: false,
                underline: false,
                widthPx: 12,
                isBullet: true,
              },
              {
                text: 'First line of bullet that is too long',
                x: 18,
                baselineY: 18,
                fontFamily: 'Arial',
                fontSizePx: 16,
                color: '#111111',
                bold: false,
                italic: false,
                underline: false,
                widthPx: 300,
              },
            ],
          },
          {
            paraStart: false,
            top: 24,
            height: 24,
            runs: [
              {
                text: 'and spills onto a second line',
                x: 18,
                baselineY: 42,
                fontFamily: 'Arial',
                fontSizePx: 16,
                color: '#111111',
                bold: false,
                italic: false,
                underline: false,
                widthPx: 220,
              },
            ],
          },
        ],
        contentHeight: 48,
        insets: { l: 0, t: 0, r: 0, b: 0 },
        anchor: 'top',
        fontScale: 1,
        wrap: true,
      },
    }
    const findings = auditSlideFindings(slide([multiLineBullet]))
    expect(findings.some((f) => f.code === 'bullet_wrap' && f.bulletLines === 2)).toBe(true)
  })

  it('warns with text_density when total words on a slide exceed the threshold', () => {
    const fiftyFiveWords = Array.from({ length: 55 }, (_, i) => `word${i + 1}`).join(' ')
    const dense = textNode('dense', 80, 80, 1000, 400, { text: fiftyFiveWords })
    const s = slide([dense])
    expect(countSlideWords(s)).toBe(55)
    const findings = auditSlideFindings(s)
    expect(findings.some((f) => f.code === 'text_density' && f.wordCount === 55)).toBe(true)
  })

  it('checks DesignSystem tokens (bg, text, accent, muted) and flags off-palette colors', () => {
    const ds = {
      name: 'Keynote Warm',
      palette: {
        bg: '#F4F2EB',
        text: '#1C1B18',
        accent: '#8B3A1A',
        muted: '#6E6A60',
      },
    }
    const cleanNode = textNode('clean', 80, 80, 400, 80)
    cleanNode.text!.lines[0]!.runs[0]!.color = '#1C1B18'
    cleanNode.fill = { kind: 'solid', color: '#8B3A1A' }
    const cleanSlide: RenderSlide = {
      ...slide([cleanNode]),
      background: { kind: 'solid', color: '#F4F2EB' },
    }
    expect(checkDesignSystemTokens(cleanSlide, ds).offTokenColors).toEqual([])
    expect(auditSlideFindings(cleanSlide, (id) => id, { designSystem: ds })).toEqual([])

    const rogueNode = textNode('rogue', 80, 200, 400, 80)
    rogueNode.fill = { kind: 'solid', color: '#FF00FF' }
    rogueNode.text!.lines[0]!.runs[0]!.color = '#1C1B18'
    const dirtySlide: RenderSlide = {
      ...cleanSlide,
      nodes: [cleanNode, rogueNode],
    }
    const findings = auditSlideFindings(dirtySlide, (id) => id, { designSystem: ds })
    expect(
      findings.some(
        (f) => f.code === 'design_token_mismatch' && f.offTokenColors?.includes('#FF00FF'),
      ),
    ).toBe(true)
  })

  it('computes vertical budget math accurately for 1280x720 slides', () => {
    const fits = computeVerticalBudget(
      [
        { fontSizePx: 16, lineHeight: 1.2, lines: 1 },
        { fontSizePx: 48, lineHeight: 1.15, lines: 2 },
        { fontSizePx: 21, lineHeight: 1.4, lines: 2 },
      ],
      [12, 20],
      64,
      720,
    )
    expect(fits.usableHeightPx).toBe(592)
    expect(fits.fits).toBe(true)
    expect(fits.overflowPx).toBe(0)

    const overflows = computeVerticalBudget(
      [
        { fontSizePx: 64, lineHeight: 1.2, lines: 4 },
        { fontSizePx: 32, lineHeight: 1.4, lines: 8 },
      ],
      [32, 32],
      80,
      720,
    )
    expect(overflows.usableHeightPx).toBe(560)
    expect(overflows.fits).toBe(false)
    expect(overflows.overflowPx).toBeGreaterThan(0)
  })

  it('groups scene atoms into lines, fills empty lines, and classifies hybrid raster layers', () => {
    const baseStyle = {
      fontFamily: 'Inter',
      fontSizePx: 20,
      fontWeight: 400,
      italic: false,
      underline: false,
      strike: false,
      color: { hex: '111111', alpha: 1 },
      letterSpacingPx: 0,
    }
    const atoms: Atom[] = [
      {
        text: 'Hello ',
        rect: { x: 10, y: 10, w: 50, h: 24 },
        styleKey: 'a',
        style: baseStyle,
        preserveSpaces: false,
      },
      {
        text: 'world ',
        rect: { x: 60, y: 10, w: 55, h: 24 },
        styleKey: 'a',
        style: baseStyle,
        preserveSpaces: false,
      },
      {
        text: 'wrapped',
        rect: { x: 10, y: 58, w: 70, h: 24 },
        styleKey: 'a',
        style: baseStyle,
        preserveSpaces: false,
      },
    ]
    const lines = groupAtomsIntoLines(atoms)
    expect(lines).toHaveLength(2)
    expect(lineToRuns(lines[0]!)).toEqual([{ text: 'Hello world', style: baseStyle }])

    // 48px jump vs 24px pitch when a third line is at y=82 -> fills 1 blank line between y=10 and y=58
    const threeLines = groupAtomsIntoLines([
      ...atoms,
      {
        text: 'third',
        rect: { x: 10, y: 82, w: 50, h: 24 },
        styleKey: 'a',
        style: baseStyle,
        preserveSpaces: false,
      },
    ])
    const filled = fillEmptyLines(threeLines)
    expect(filled).toHaveLength(4)
    expect(filled[1]!.atoms).toHaveLength(0)

    expect(pixelRatioFor({ w: 400, h: 300 })).toBe(2)
    expect(needsSubtreeRaster({ filter: 'blur(12px)' })).toBe(true)
    expect(needsSubtreeRaster({ filter: 'none' })).toBe(false)
    expect(
      paintsBackgroundSeparately({
        backgroundImage: 'radial-gradient(circle, #fff, #000)',
      }),
    ).toBe(true)
  })
})
