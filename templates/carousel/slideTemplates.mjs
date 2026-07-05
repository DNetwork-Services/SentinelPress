// Builds Satori element trees (plain object form, no JSX) for each slide type.
// Canvas is 1080x1350 (4:5 portrait — Instagram's tallest supported ratio,
// maximizes readable space for carousels).

const CANVAS = { width: 1080, height: 1350 };

function baseFrame(brand, children) {
  return {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: brand.backgroundColor,
        color: '#FFFFFF',
        fontFamily: 'Poppins',
        padding: 64,
        position: 'relative',
      },
      children,
    },
  };
}

function header(brand, accountHandle, categoryLabel) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 48,
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

export function buildTitleSlide(slide, { brand, accountHandle, categoryLabel, index, total, backgroundPhoto }) {
  const backgroundLayer = backgroundPhoto
    ? {
        type: 'img',
        props: {
          src: backgroundPhoto.dataUri,
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          },
        },
      }
    : null;

  const overlayLayer = backgroundPhoto
    ? {
        type: 'div',
        props: {
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            // Gradient keeps the top readable for the header row and
            // fades darker toward the bottom where the title text sits.
            backgroundImage: `linear-gradient(180deg, ${brand.backgroundColor}CC 0%, ${brand.backgroundColor}66 35%, ${brand.backgroundColor}F2 75%)`,
            display: 'flex',
          },
        },
      }
    : null;

  const frameChildren = [
    header(brand, accountHandle, categoryLabel),
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        children: {
          type: 'div',
          props: {
            style: {
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.15,
              textAlign: 'center',
              display: 'flex',
              textShadow: backgroundPhoto ? '0 4px 24px rgba(0,0,0,0.6)' : 'none',
            },
            children: slide.text,
          },
        },
      },
    },
    footer(brand, index, total),
  ];

  const frame = backgroundPhoto
    ? {
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
          },
          children: [backgroundLayer, overlayLayer, ...frameChildren.map((c) => ({ ...c, props: { ...c.props, style: { ...c.props.style, position: 'relative' } } }))],
        },
      }
    : baseFrame(brand, frameChildren);

  return { element: frame, canvas: CANVAS };
}

export function buildBodySlide(slide, { brand, accountHandle, categoryLabel, index, total }) {
  return {
    element: baseFrame(brand, [
      header(brand, accountHandle, categoryLabel),
      {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' },
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
                    },
                    children: slide.heading,
                  },
                }
              : { type: 'div', props: { children: '' } },
            {
              type: 'div',
              props: {
                style: { fontSize: 40, fontWeight: 400, lineHeight: 1.4, display: 'flex' },
                children: slide.text,
              },
            },
          ],
        },
      },
      footer(brand, index, total),
    ]),
    canvas: CANVAS,
  };
}

export function buildCtaSlide(slide, { brand, accountHandle, categoryLabel, index, total }) {
  return {
    element: baseFrame(brand, [
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
    ]),
    canvas: CANVAS,
  };
}

export function buildSlideElement(slide, ctx) {
  if (slide.type === 'title') return buildTitleSlide(slide, ctx);
  if (slide.type === 'cta') return buildCtaSlide(slide, ctx);
  return buildBodySlide(slide, ctx); // default: 'body'
}
