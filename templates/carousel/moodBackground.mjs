// Replaces stock photos with generated gradient/glow backgrounds, one
// palette per emotional mood. No external API, no licensing/attribution
// concerns, and no network dependency to fail — purely rendered from the
// same imageQuery the LLM already writes per slide (Milestone 7b), just
// classified into a mood bucket instead of used as a photo search term.

const MOODS = {
  alarm: {
    keywords: ['hacker', 'dark', 'threat', 'danger', 'attack', 'breach', 'exploit', 'malware', 'ransomware', 'stolen', 'compromise'],
    colors: ['#FF3B3B', '#FF6B35', '#1A0505'],
  },
  urgent: {
    keywords: ['warning', 'alert', 'critical', 'urgent', 'risk', 'exposed', 'vulnerable'],
    colors: ['#FF9500', '#FFD60A', '#1A1305'],
  },
  relief: {
    keywords: ['relieved', 'smiling', 'safe', 'fixed', 'patched', 'confident', 'protected', 'secure', 'resolved'],
    colors: ['#00FF88', '#00F5FF', '#04140F'],
  },
  curious: {
    keywords: ['glowing', 'circuit', 'mystery', 'intrigue', 'magnifying', 'code', 'data', 'network'],
    colors: ['#7C3AED', '#3B82F6', '#0A0518'],
  },
  empowering: {
    keywords: ['confident', 'phone', 'follow', 'forward', 'empower', 'future'],
    colors: ['#00F5FF', '#7C3AED', '#050A14'],
  },
};

function classifyMood(imageQuery) {
  const text = (imageQuery || '').toLowerCase();
  for (const [mood, { keywords }] of Object.entries(MOODS)) {
    if (keywords.some((kw) => text.includes(kw))) return mood;
  }
  return null; // falls back to brand colors
}

function orb(color, { top, left, size, opacity = 0.55 }) {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundImage: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        opacity,
        display: 'flex',
        filter: 'blur(2px)',
      },
    },
  };
}

/**
 * Builds a set of layered background elements (wash gradient + glowing
 * orbs) for a slide, themed to the emotional mood of its imageQuery.
 * Falls back to the account's own brand colors if the mood doesn't match
 * a known keyword bucket, so every slide still gets *some* visual depth.
 */
export function buildMoodBackground(imageQuery, brand) {
  const mood = classifyMood(imageQuery);
  const [c1, c2, washBg] = mood ? MOODS[mood].colors : [brand.primaryColor, brand.secondaryColor, brand.backgroundColor];

  return [
    // Base wash — subtle diagonal gradient using the mood's darkest tone
    // blended into the brand background, so it never looks jarring.
    {
      type: 'div',
      props: {
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `linear-gradient(135deg, ${washBg} 0%, ${brand.backgroundColor} 60%)`,
          display: 'flex',
        },
      },
    },
    orb(c1, { top: 120, left: 600, size: 620, opacity: 0.5 }),
    orb(c2, { top: 780, left: -150, size: 520, opacity: 0.4 }),
  ];
}
