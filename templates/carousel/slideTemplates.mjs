import { buildMoodBackground } from './moodBackground.mjs';

// Builds Satori element trees (plain object form, no JSX) for each slide type.
// Canvas is 1080x1350 (4:5 portrait — Instagram's tallest supported ratio,
// maximizes readable space for carousels).

const CANVAS = { width: 1080, height: 1350 };

function header(brand, accountHandle, categoryLabel) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 48,
        position: 'relative',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: 28, fontWeight: 700, color: brand.primaryColor, display: 'flex' },
            children: accountHandle,
          },
        },
        categoryLabel
          ? {
              type: 'div',
              props: {
                style: {
                  fontSize: 22,
                  fontWeight: 400,
                  color: brand.secondaryColor,
                  border: `2px solid ${brand.secondaryColor}`,
                  borderRadius: 999,
                  padding: '8px 24px',
                  display: 'flex',
                },
                children: categoryLabel.toUpperCase(),
              },
            }
          : { type: 'div', props: { children: '' } },
      ],
    },
  };
}

function footer(brand, index, total, photoCredit) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 'auto',
        position: 'relative',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column' },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    width: 200,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#222233',
                    display: 'flex',
                    position: 'relative',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          width: `${Math.round((index / total) * 200)}px`,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: brand.primaryColor,
                          display: 'flex',
                        },
                      },
                    },
                  ],
                },
              },
              // Small, unobtrusive on-image credit — satisfies Pexels' API
              // attribution requirement without cluttering the caption.
              // Only shown for real Pexels photos (photographer field
              // present) — Pollinations illustrations have no attribution
              // requirement, so no credit line for those.
              photoCredit?.photographer
                ? {
                    type: 'div',
                    props: {
                      style: { fontSize: 15, color: 'rgba(255,255,255,0.55)', marginTop: 10, display: 'flex' },
                      children: `Photo: ${photoCredit.photographer} / Pexels`,
                    },
                  }
                : { type: 'div', props: { children: '' } },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: 24, color: '#888899', display: 'flex' },
            children: `${index}/${total}`,
          },
        },
      ],
    },
  };
}

/**
 * Wraps a slide's content in the shared frame. Background priority:
 *   1. A real photo (Pexels, matched to the slide's imageQuery) if one
 *      was successfully fetched — this is the primary look.
 *   2. The procedural mood-gradient background as an automatic fallback
 *      when no photo is available (API key missing, fetch failed, or
 *      nothing matched the search) — so a slide never renders plain.
 */
function buildFrame(brand, contentChildren, imageQuery, backgroundPhoto) {
  const backgroundLayers = backgroundPhoto
    ? [
        {
          type: 'img',
          props: {
            src: backgroundPhoto.dataUri,
            style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundImage: `linear-gradient(180deg, ${brand.backgroundColor}D9 0%, ${brand.backgroundColor}70 32%, ${brand.backgroundColor}F5 80%)`,
              display: 'flex',
            },
          },
        },
      ]
    : buildMoodBackground(imageQuery, brand);

  return {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        padding: 64,
        fontFamily: 'Poppins',
        color: '#FFFFFF',
        overflow: 'hidden',
      },
      children: [...backgroundLayers, ...contentChildren],
    },
  };
}

const TEXT_SHADOW = '0 4px 20px rgba(0,0,0,0.55)';

export function buildTitleSlide(slide, { brand, accountHandle, categoryLabel, index, total, backgroundPhoto }) {
  const children = [
    header(brand, accountHandle, categoryLabel),
    {
      type: 'div',
      props: {
        style: { display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
        children: {
          type: 'div',
          props: {
            style: {
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.15,
              textAlign: 'center',
              display: 'flex',
              textShadow: TEXT_SHADOW,
            },
            children: slide.text,
          },
        },
      },
    },
    footer(brand, index, total, backgroundPhoto),
  ];
  return { element: buildFrame(brand, children, slide.imageQuery, backgroundPhoto), canvas: CANVAS };
}

export function buildBodySlide(slide, { brand, accountHandle, categoryLabel, index, total, backgroundPhoto }) {
  const children = [
    header(brand, accountHandle, categoryLabel),
    {
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', position: 'relative' },
        children: [
          slide.heading
            ? {
                type: 'div',
                props: {
                  style: {
                    fontSize: 44,
                    fontWeight: 700,
                    color: brand.primaryColor,
                    marginBottom: 32,
                    display: 'flex',
                    textShadow: TEXT_SHADOW,
                  },
                  children: slide.heading,
                },
              }
            : { type: 'div', props: { children: '' } },
          {
            type: 'div',
            props: {
              style: {
                fontSize: 40,
                fontWeight: 400,
                lineHeight: 1.4,
                display: 'flex',
                textShadow: TEXT_SHADOW,
              },
              children: slide.text,
            },
          },
          // Hindi meaning, when present (English Vault) — uses the Hind
          // font specifically, since Poppins has no Devanagari glyphs.
          slide.hindiMeaning
            ? {
                type: 'div',
                props: {
                  style: {
                    fontSize: 34,
                    fontWeight: 400,
                    fontFamily: 'Hind',
                    color: brand.secondaryColor,
                    marginTop: 24,
                    display: 'flex',
                    textShadow: TEXT_SHADOW,
                  },
                  children: slide.hindiMeaning,
                },
              }
            : { type: 'div', props: { children: '' } },
        ],
      },
    },
    footer(brand, index, total, backgroundPhoto),
  ];
  return { element: buildFrame(brand, children, slide.imageQuery, backgroundPhoto), canvas: CANVAS };
}

/**
 * "Wrong vs Right" comparison slide — a high-engagement format for
 * language learning: a struck-through/red wrong usage next to a
 * highlighted correct one, side by side.
 */
export function buildComparisonSlide(slide, { brand, accountHandle, categoryLabel, index, total, backgroundPhoto }) {
  const card = (label, text, color, bgTint) => ({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: bgTint,
        border: `2px solid ${color}`,
        borderRadius: 20,
        padding: 28,
        marginBottom: 24,
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: 30, fontWeight: 700, color, marginBottom: 10, display: 'flex' },
            children: label,
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: 32, fontWeight: 400, color: '#FFFFFF', display: 'flex', lineHeight: 1.35 },
            children: text,
          },
        },
      ],
    },
  });

  const children = [
    header(brand, accountHandle, categoryLabel),
    {
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', position: 'relative' },
        children: [
          card('❌ WRONG', slide.wrong, '#FF3B3B', 'rgba(255,59,59,0.12)'),
          card('✅ RIGHT', slide.right, '#00FF88', 'rgba(0,255,136,0.12)'),
        ],
      },
    },
    footer(brand, index, total, backgroundPhoto),
  ];
  return { element: buildFrame(brand, children, slide.imageQuery, backgroundPhoto), canvas: CANVAS };
}

export function buildCtaSlide(slide, { brand, accountHandle, categoryLabel, index, total, backgroundPhoto }) {
  const children = [
    header(brand, accountHandle, categoryLabel),
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                fontSize: 56,
                fontWeight: 700,
                textAlign: 'center',
                marginBottom: 40,
                display: 'flex',
                textShadow: TEXT_SHADOW,
              },
              children: slide.text,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: 30,
                fontWeight: 600,
                color: brand.backgroundColor,
                backgroundColor: brand.primaryColor,
                borderRadius: 999,
                padding: '20px 48px',
                display: 'flex',
              },
              children: `Follow ${accountHandle}`,
            },
          },
        ],
      },
    },
    footer(brand, index, total, backgroundPhoto),
  ];
  return { element: buildFrame(brand, children, slide.imageQuery, backgroundPhoto), canvas: CANVAS };
}

/**
 * "News card" — a single-image post format (not a multi-slide carousel):
 * a centered monogram badge at top, a two-tone headline (highlight word(s)
 * in the accent color, rest in white — mirrors how real news headline
 * cards style the key entity), a divider, then a body paragraph filling
 * the rest of the frame, with small branding in the bottom-left corner.
 */
export function buildNewsCardSlide(slide, { brand, accountHandle, backgroundPhoto }) {
  const badge = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 140,
        height: 140,
        borderRadius: 28,
        backgroundColor: brand.primaryColor,
        marginBottom: 40,
        alignSelf: 'center',
      },
      children: {
        type: 'div',
        props: {
          style: { fontSize: 56, fontWeight: 700, color: brand.backgroundColor, display: 'flex' },
          children: (slide.badgeInitials || accountHandle.replace('@', '').slice(0, 2)).toUpperCase(),
        },
      },
    },
  };

  const headline = {
    type: 'div',
    props: {
      style: {
        fontSize: 58,
        fontWeight: 700,
        lineHeight: 1.2,
        display: 'flex',
        flexWrap: 'wrap',
        textShadow: TEXT_SHADOW,
        marginBottom: 28,
      },
      children: [
        slide.headlineHighlight
          ? { type: 'span', props: { style: { color: brand.secondaryColor }, children: `${slide.headlineHighlight} ` } }
          : null,
        { type: 'span', props: { style: { color: '#FFFFFF' }, children: slide.headlineRest || slide.text || '' } },
      ].filter(Boolean),
    },
  };

  const divider = {
    type: 'div',
    props: {
      style: { width: '100%', height: 4, backgroundColor: brand.secondaryColor, display: 'flex', marginBottom: 32 },
    },
  };

  const body = {
    type: 'div',
    props: {
      style: {
        fontSize: 32,
        fontWeight: 400,
        lineHeight: 1.5,
        color: 'rgba(255,255,255,0.92)',
        display: 'flex',
        textShadow: TEXT_SHADOW,
      },
      children: slide.body || slide.text || '',
    },
  };

  const hindiSummary = slide.hindiSummary
    ? {
        type: 'div',
        props: {
          style: {
            fontSize: 28,
            fontWeight: 400,
            fontFamily: 'Hind',
            color: brand.secondaryColor,
            marginTop: 24,
            display: 'flex',
            textShadow: TEXT_SHADOW,
          },
          children: slide.hindiSummary,
        },
      }
    : null;

  const brandFooter = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        marginTop: 'auto',
        fontSize: 24,
        fontWeight: 600,
        color: brand.primaryColor,
      },
      children: accountHandle,
    },
  };

  const children = [badge, headline, divider, body, hindiSummary, brandFooter].filter(Boolean);
  return { element: buildFrame(brand, children, slide.imageQuery, backgroundPhoto), canvas: CANVAS };
}

function getDoodleSvg(type, accentColor) {
  const commonProps = {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  let shapes = [];

  switch (type) {
    case 'confused_user':
      shapes = [
        { type: 'circle', props: { cx: 200, cy: 120, r: 35, stroke: '#111111', strokeWidth: 5, fill: 'none', ...commonProps } },
        { type: 'line', props: { x1: 200, y1: 155, x2: 200, y2: 250, stroke: '#111111', strokeWidth: 5, ...commonProps } },
        { type: 'path', props: { d: 'M 200 180 L 160 200 L 175 230', stroke: '#111111', strokeWidth: 5, fill: 'none', ...commonProps } },
        { type: 'path', props: { d: 'M 200 180 Q 240 180 240 140 Q 240 110 215 110', stroke: '#111111', strokeWidth: 5, fill: 'none', ...commonProps } },
        { type: 'line', props: { x1: 200, y1: 250, x2: 160, y2: 330, stroke: '#111111', strokeWidth: 5, ...commonProps } },
        { type: 'line', props: { x1: 200, y1: 250, x2: 240, y2: 330, stroke: '#111111', strokeWidth: 5, ...commonProps } }
      ];
      break;

    case 'hacker':
      shapes = [
        { type: 'line', props: { x1: 50, y1: 320, x2: 350, y2: 320, stroke: '#111111', strokeWidth: 5, ...commonProps } },
        { type: 'path', props: { d: 'M 200 320 L 280 320 L 300 290 L 220 290 Z', stroke: '#111111', strokeWidth: 5, fill: '#FFFFFF', ...commonProps } },
        { type: 'path', props: { d: 'M 220 290 L 220 210 L 290 210 L 280 290 Z', stroke: '#111111', strokeWidth: 5, fill: '#FFFFFF', ...commonProps } },
        { type: 'path', props: { d: 'M 100 320 C 100 230 120 180 150 160', stroke: '#111111', strokeWidth: 5, fill: 'none', ...commonProps } },
        { type: 'circle', props: { cx: 160, cy: 130, r: 25, stroke: '#111111', strokeWidth: 5, fill: '#FFFFFF', ...commonProps } },
        { type: 'path', props: { d: 'M 135 130 C 135 70 185 70 185 130 Z', stroke: '#111111', strokeWidth: 5, fill: '#111111', ...commonProps } },
        { type: 'path', props: { d: 'M 140 220 L 190 240 L 215 295', stroke: '#111111', strokeWidth: 5, fill: 'none', ...commonProps } }
      ];
      break;

    case 'server_network':
      shapes = [
        { type: 'rect', props: { x: 60, y: 80, width: 120, height: 60, rx: 8, stroke: '#111111', strokeWidth: 5, fill: '#FFFFFF', ...commonProps } },
        { type: 'line', props: { x1: 80, y1: 110, x2: 140, y2: 110, stroke: '#111111', strokeWidth: 4, ...commonProps } },
        { type: 'circle', props: { cx: 160, cy: 110, r: 6, fill: accentColor } },
        { type: 'rect', props: { x: 60, y: 170, width: 120, height: 60, rx: 8, stroke: '#111111', strokeWidth: 5, fill: '#FFFFFF', ...commonProps } },
        { type: 'line', props: { x1: 80, y1: 200, x2: 140, y2: 200, stroke: '#111111', strokeWidth: 4, ...commonProps } },
        { type: 'circle', props: { cx: 160, cy: 200, r: 6, fill: '#111111' } },
        { type: 'rect', props: { x: 60, y: 260, width: 120, height: 60, rx: 8, stroke: '#111111', strokeWidth: 5, fill: '#FFFFFF', ...commonProps } },
        { type: 'line', props: { x1: 80, y1: 290, x2: 140, y2: 290, stroke: '#111111', strokeWidth: 4, ...commonProps } },
        { type: 'circle', props: { cx: 160, cy: 290, r: 6, fill: accentColor } },
        { type: 'circle', props: { cx: 280, cy: 200, r: 35, stroke: '#111111', strokeWidth: 5, fill: '#FFFFFF', ...commonProps } },
        { type: 'line', props: { x1: 180, y1: 110, x2: 250, y2: 180, stroke: '#111111', strokeWidth: 4, strokeDasharray: '8,8', ...commonProps } },
        { type: 'line', props: { x1: 180, y1: 200, x2: 245, y2: 200, stroke: '#111111', strokeWidth: 4, strokeDasharray: '8,8', ...commonProps } },
        { type: 'line', props: { x1: 180, y1: 290, x2: 250, y2: 220, stroke: '#111111', strokeWidth: 4, strokeDasharray: '8,8', ...commonProps } }
      ];
      break;

    case 'secured':
      shapes = [
        { type: 'path', props: { d: 'M 120 100 C 180 80 220 80 280 100 C 280 180 260 240 200 300 C 140 240 120 180 120 100 Z', stroke: '#111111', strokeWidth: 5, fill: '#FFFFFF', ...commonProps } },
        { type: 'path', props: { d: 'M 160 190 L 190 220 L 240 160', stroke: accentColor, strokeWidth: 8, fill: 'none', ...commonProps } }
      ];
      break;

    case 'attack':
      shapes = [
        { type: 'rect', props: { x: 80, y: 100, width: 240, height: 160, rx: 10, stroke: '#111111', strokeWidth: 5, fill: '#FFFFFF', ...commonProps } },
        { type: 'path', props: { d: 'M 170 260 L 150 320 L 250 320 L 230 260 Z', stroke: '#111111', strokeWidth: 5, fill: '#FFFFFF', ...commonProps } },
        { type: 'path', props: { d: 'M 220 40 L 170 150 L 210 150 L 180 250', stroke: accentColor, strokeWidth: 6, fill: 'none', ...commonProps } }
      ];
      break;

    case 'cloud_database':
      shapes = [
        { type: 'path', props: { d: 'M 120 150 C 120 130 140 110 160 120 C 170 100 210 90 230 110 C 250 95 280 110 280 130 C 295 140 295 170 280 180 L 120 180 Z', stroke: '#111111', strokeWidth: 5, fill: '#FFFFFF', ...commonProps } },
        { type: 'path', props: { d: 'M 150 250 C 150 240 250 240 250 250 L 250 310 C 250 320 150 320 150 310 Z', stroke: '#111111', strokeWidth: 5, fill: '#FFFFFF', ...commonProps } },
        { type: 'path', props: { d: 'M 150 270 C 150 260 250 260 250 270', stroke: '#111111', strokeWidth: 4, fill: 'none', ...commonProps } },
        { type: 'path', props: { d: 'M 150 290 C 150 280 250 280 250 290', stroke: '#111111', strokeWidth: 4, fill: 'none', ...commonProps } },
        { type: 'path', props: { d: 'M 200 190 L 200 230 M 190 220 L 200 230 L 210 220', stroke: accentColor, strokeWidth: 5, fill: 'none', ...commonProps } }
      ];
      break;

    case 'ransomware':
      shapes = [
        { type: 'circle', props: { cx: 120, cy: 220, r: 25, stroke: '#111111', strokeWidth: 5, fill: 'none', ...commonProps } },
        { type: 'line', props: { x1: 120, y1: 245, x2: 120, y2: 310, stroke: '#111111', strokeWidth: 5, ...commonProps } },
        { type: 'path', props: { d: 'M 90 280 L 110 230 M 150 280 L 130 230', stroke: '#111111', strokeWidth: 5, fill: 'none', ...commonProps } },
        { type: 'line', props: { x1: 120, y1: 310, x2: 95, y2: 370, stroke: '#111111', strokeWidth: 5, ...commonProps } },
        { type: 'line', props: { x1: 120, y1: 310, x2: 145, y2: 370, stroke: '#111111', strokeWidth: 5, ...commonProps } },
        { type: 'rect', props: { x: 200, y: 220, width: 140, height: 100, rx: 8, stroke: '#111111', strokeWidth: 5, fill: '#FFFFFF', ...commonProps } },
        { type: 'path', props: { d: 'M 230 320 L 310 320', stroke: '#111111', strokeWidth: 5, ...commonProps } }
      ];
      break;

    case 'phishing':
      shapes = [
        { type: 'path', props: { d: 'M 280 40 L 280 200 C 280 240 240 240 240 210', stroke: '#111111', strokeWidth: 5, fill: 'none', ...commonProps } },
        { type: 'path', props: { d: 'M 240 210 L 250 200', stroke: '#111111', strokeWidth: 5, ...commonProps } },
        { type: 'rect', props: { x: 100, y: 160, width: 140, height: 90, rx: 8, stroke: '#111111', strokeWidth: 5, fill: '#FFFFFF', ...commonProps } },
        { type: 'path', props: { d: 'M 100 160 L 170 210 L 240 160', stroke: '#111111', strokeWidth: 4, fill: 'none', ...commonProps } }
      ];
      break;

    case 'explainer':
      shapes = [
        { type: 'circle', props: { cx: 100, cy: 160, r: 25, stroke: '#111111', strokeWidth: 5, fill: 'none', ...commonProps } },
        { type: 'line', props: { x1: 100, y1: 185, x2: 100, y2: 270, stroke: '#111111', strokeWidth: 5, ...commonProps } },
        { type: 'line', props: { x1: 100, y1: 210, x2: 220, y2: 170, stroke: '#111111', strokeWidth: 5, ...commonProps } },
        { type: 'line', props: { x1: 100, y1: 270, x2: 75, y2: 340, stroke: '#111111', strokeWidth: 5, ...commonProps } },
        { type: 'line', props: { x1: 100, y1: 270, x2: 125, y2: 340, stroke: '#111111', strokeWidth: 5, ...commonProps } },
        { type: 'rect', props: { x: 180, y: 80, width: 180, height: 130, rx: 8, stroke: '#111111', strokeWidth: 5, fill: '#FFFFFF', ...commonProps } },
        { type: 'path', props: { d: 'M 210 180 L 250 130 L 290 160 L 330 100', stroke: accentColor, strokeWidth: 6, fill: 'none', ...commonProps } }
      ];
      break;

    case 'summary':
    default:
      shapes = [
        { type: 'rect', props: { x: 80, y: 100, width: 40, height: 40, rx: 6, stroke: '#111111', strokeWidth: 4, fill: '#FFFFFF', ...commonProps } },
        { type: 'path', props: { d: 'M 90 120 L 100 130 L 115 110', stroke: accentColor, strokeWidth: 5, fill: 'none', ...commonProps } },
        { type: 'line', props: { x1: 140, y1: 120, x2: 320, y2: 120, stroke: '#111111', strokeWidth: 5, ...commonProps } },
        { type: 'rect', props: { x: 80, y: 180, width: 40, height: 40, rx: 6, stroke: '#111111', strokeWidth: 4, fill: '#FFFFFF', ...commonProps } },
        { type: 'path', props: { d: 'M 90 200 L 100 210 L 115 190', stroke: accentColor, strokeWidth: 5, fill: 'none', ...commonProps } },
        { type: 'line', props: { x1: 140, y1: 200, x2: 320, y2: 200, stroke: '#111111', strokeWidth: 5, ...commonProps } },
        { type: 'rect', props: { x: 80, y: 260, width: 40, height: 40, rx: 6, stroke: '#111111', strokeWidth: 4, fill: '#FFFFFF', ...commonProps } },
        { type: 'path', props: { d: 'M 90 280 L 100 290 L 115 270', stroke: accentColor, strokeWidth: 5, fill: 'none', ...commonProps } },
        { type: 'line', props: { x1: 140, y1: 280, x2: 320, y2: 280, stroke: '#111111', strokeWidth: 5, ...commonProps } }
      ];
      break;
  }

  return {
    type: 'svg',
    props: {
      width: '400',
      height: '400',
      viewBox: '0 0 400 400',
      style: { display: 'flex' },
      children: shapes
    }
  };
}

function getDoodleTextLayers(type, accent) {
  switch (type) {
    case 'confused_user':
      return [
        { type: 'div', props: { style: { position: 'absolute', left: '260px', top: '70px', fontSize: '80px', fontWeight: 'bold', color: accent, display: 'flex' } }, children: '?' }
      ];
    case 'hacker':
      return [
        { type: 'div', props: { style: { position: 'absolute', left: '235px', top: '220px', fontSize: '35px', color: accent, display: 'flex' } }, children: '☠' }
      ];
    case 'server_network':
      return [
        { type: 'div', props: { style: { position: 'absolute', left: '258px', top: '175px', fontSize: '45px', color: accent, display: 'flex' } }, children: '🌐' }
      ];
    case 'secured':
      return [
        { type: 'div', props: { style: { position: 'absolute', left: '185px', top: '40px', fontSize: '40px', color: accent, display: 'flex' } }, children: '🔒' }
      ];
    case 'attack':
      return [
        { type: 'div', props: { style: { position: 'absolute', left: '230px', top: '140px', fontSize: '60px', color: '#FF3B30', display: 'flex' } }, children: '⚠️' }
      ];
    case 'ransomware':
      return [
        { type: 'div', props: { style: { position: 'absolute', left: '245px', top: '235px', fontSize: '50px', color: accent, display: 'flex' } }, children: '🔒' }
      ];
    case 'phishing':
      return [
        { type: 'div', props: { style: { position: 'absolute', left: '250px', top: '100px', fontSize: '45px', color: accent, display: 'flex' } }, children: '🎣' }
      ];
    default:
      return [];
  }
}

export function buildWhiteboardSlide(slide, { brand, accountHandle, categoryLabel, index, total }) {
  const colors = {
    blue: '#0066FF',
    orange: '#FF9500',
    red: '#FF3B30',
    black: '#111111',
  };
  const accent = colors[slide.accentColor] || colors.blue;

  const children = [
    // Top border representing a paper sheet/board
    {
      type: 'div',
      props: {
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: '12px solid #1E1E1E',
          backgroundColor: '#FCFCFA',
          display: 'flex',
        }
      }
    },
    // Header
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          marginBottom: 40,
          position: 'relative',
        },
        children: [
          {
            type: 'div',
            props: {
              style: { fontSize: 28, fontWeight: 700, color: '#111111', display: 'flex' },
              children: accountHandle,
            },
          },
          categoryLabel
            ? {
                type: 'div',
                props: {
                  style: {
                    fontSize: 22,
                    fontWeight: 700,
                    color: accent,
                    border: `3px solid ${accent}`,
                    borderRadius: 12,
                    padding: '6px 20px',
                    display: 'flex',
                  },
                  children: categoryLabel.toUpperCase(),
                },
              }
            : { type: 'div', props: { children: '' } },
        ],
      },
    },
    // Content Area
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          width: '100%',
          position: 'relative',
        },
        children: [
          // Slide title
          {
            type: 'div',
            props: {
              style: {
                fontSize: 52,
                fontWeight: 700,
                color: '#111111',
                marginBottom: 30,
                display: 'flex',
              },
              children: slide.title || '',
            },
          },
          // Two column content layout
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                flex: 1,
                width: '100%',
              },
              children: [
                // Left Column: Text
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      marginRight: 40,
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: 36,
                            fontWeight: 400,
                            lineHeight: 1.45,
                            color: '#333333',
                            display: 'flex',
                          },
                          children: slide.text || '',
                        },
                      },
                    ],
                  },
                },
                // Right Column: Doodle
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      width: 400,
                      height: 400,
                      position: 'relative',
                    },
                    children: [
                      getDoodleSvg(slide.doodleType, accent),
                      ...getDoodleTextLayers(slide.doodleType, accent)
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    // Footer
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          marginTop: 40,
          position: 'relative',
        },
        children: [
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      width: 200,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#E5E5E5',
                      display: 'flex',
                      position: 'relative',
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            width: `${Math.round((index / total) * 200)}px`,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: accent,
                            display: 'flex',
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: { fontSize: 24, fontWeight: 700, color: '#666666', display: 'flex' },
              children: `${index}/${total}`,
            },
          },
        ],
      },
    },
  ];

  return {
    element: {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          padding: 72,
          fontFamily: 'Poppins',
          color: '#111111',
          backgroundColor: '#FCFCFA',
          overflow: 'hidden',
        },
        children,
      },
    },
    canvas: CANVAS,
  };
}

export function buildSlideElement(slide, ctx) {
  if (slide.type === 'whiteboard') return buildWhiteboardSlide(slide, ctx);
  if (slide.type === 'newscard') return buildNewsCardSlide(slide, ctx);
  if (slide.type === 'title') return buildTitleSlide(slide, ctx);
  if (slide.type === 'cta') return buildCtaSlide(slide, ctx);
  if (slide.type === 'comparison') return buildComparisonSlide(slide, ctx);
  return buildBodySlide(slide, ctx); // default: 'body'
}
