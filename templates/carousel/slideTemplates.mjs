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

function footer(brand, index, total) {
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
 * Wraps a slide's content in the shared frame: a procedural mood
 * background (gradient wash + glowing orbs, themed to the slide's
 * imageQuery) sits behind the header/content/footer. Every slide gets
 * this — no external photo dependency, no attribution requirement, and
 * each slide's colors match its specific emotional beat rather than one
 * repeated photo across the whole carousel.
 */
function buildFrame(brand, contentChildren, imageQuery) {
  const backgroundLayers = buildMoodBackground(imageQuery, brand);

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

const TEXT_SHADOW = '0 4px 20px rgba(0,0,0,0.5)'; // always on now — text sits over gradient art, not a flat color

export function buildTitleSlide(slide, { brand, accountHandle, categoryLabel, index, total }) {
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
    footer(brand, index, total),
  ];
  return { element: buildFrame(brand, children, slide.imageQuery), canvas: CANVAS };
}

export function buildBodySlide(slide, { brand, accountHandle, categoryLabel, index, total }) {
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
    footer(brand, index, total),
  ];
  return { element: buildFrame(brand, children, slide.imageQuery), canvas: CANVAS };
}

export function buildCtaSlide(slide, { brand, accountHandle, categoryLabel, index, total }) {
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
    footer(brand, index, total),
  ];
  return { element: buildFrame(brand, children, slide.imageQuery), canvas: CANVAS };
}

export function buildSlideElement(slide, ctx) {
  if (slide.type === 'title') return buildTitleSlide(slide, ctx);
  if (slide.type === 'cta') return buildCtaSlide(slide, ctx);
  return buildBodySlide(slide, ctx); // default: 'body'
}
