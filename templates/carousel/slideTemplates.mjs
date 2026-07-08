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
              photoCredit
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

export function buildSlideElement(slide, ctx) {
  if (slide.type === 'title') return buildTitleSlide(slide, ctx);
  if (slide.type === 'cta') return buildCtaSlide(slide, ctx);
  return buildBodySlide(slide, ctx); // default: 'body'
}
