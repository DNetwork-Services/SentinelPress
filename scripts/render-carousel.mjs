import fs from 'fs';
import path from 'path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { loadActiveAccounts } from './lib/config.mjs';
import { listQueue, writePendingPost, queueDir } from './lib/queue.mjs';
import { buildSlideElement } from '../templates/carousel/slideTemplates.mjs';
import { fetchTopicPhoto } from './lib/stockphoto.mjs';
import { alertFailure } from './lib/alert.mjs';

const FONTS_DIR = path.join(process.cwd(), 'assets', 'fonts');

function loadFonts() {
  return [
    { name: 'Poppins', data: fs.readFileSync(path.join(FONTS_DIR, 'Poppins-Regular.ttf')), weight: 400, style: 'normal' },
    { name: 'Poppins', data: fs.readFileSync(path.join(FONTS_DIR, 'Poppins-SemiBold.ttf')), weight: 600, style: 'normal' },
    { name: 'Poppins', data: fs.readFileSync(path.join(FONTS_DIR, 'Poppins-Bold.ttf')), weight: 700, style: 'normal' },
  ];
}

async function renderPost(account, post, fonts, pexelsApiKey) {
  const slides = post.generated?.slides;
  if (!slides || slides.length === 0) {
    throw new Error('No slides found in generated content.');
  }

  const outDir = queueDir(account.accountId, 'pending');
  const accountHandle = `@${account.accountId}`;
  const categoryLabel = post.source?.category;

  const imagePaths = [];
  for (let i = 0; i < slides.length; i++) {
    const backgroundPhoto = await fetchTopicPhoto(slides[i], categoryLabel, pexelsApiKey);
    if (backgroundPhoto) {
      console.log(`    Slide ${i + 1} photo: "${slides[i].imageQuery}" — by ${backgroundPhoto.photographer}`);
    } else {
      console.log(`    Slide ${i + 1}: no photo match — using mood background.`);
    }

    const { element, canvas } = buildSlideElement(slides[i], {
      brand: account.content.brand,
      accountHandle,
      categoryLabel,
      total: slides.length,
      index: i + 1,
      backgroundPhoto,
    });
    const svg = await satori(element, { width: canvas.width, height: canvas.height, fonts });
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: canvas.width } });
    const png = resvg.render().asPng();

    const fileName = `${post.id}-slide-${String(i + 1).padStart(2, '0')}.png`;
    fs.writeFileSync(path.join(outDir, fileName), png);
    imagePaths.push(fileName);
  }

  return { imagePaths };
}

async function renderForAccount(account, fonts, pexelsApiKey) {
  console.log(`\n=== ${account.displayName} ===`);

  const pending = listQueue(account.accountId, 'pending').filter((p) => p.status === 'generated');
  if (pending.length === 0) {
    console.log('No posts awaiting rendering.');
    return 0;
  }

  let done = 0;
  for (const post of pending) {
    try {
      console.log(`  Rendering ${post.generated.slides.length} slide(s) for: "${post.article.title}"`);
      const { imagePaths } = await renderPost(account, post, fonts, pexelsApiKey);
      writePendingPost(account.accountId, {
        ...post,
        status: 'rendered',
        render: { slideImages: imagePaths, renderedAt: new Date().toISOString() },
      });
      console.log(`  Done: ${imagePaths.join(', ')}`);
      done++;
    } catch (err) {
      // Leave at status "generated" so a future run retries rendering only
      // (no need to re-call the LLM).
      console.error(`  FAILED: ${err.message}`);
    }
  }
  return done;
}

async function main() {
  const fonts = loadFonts();
  const accounts = loadActiveAccounts();
  const pexelsApiKey = process.env.PEXELS_API_KEY;

  let total = 0;
  for (const account of accounts) {
    total += await renderForAccount(account, fonts, pexelsApiKey);
  }
  console.log(`\nDone. ${total} post(s) rendered.`);
}

main().catch(async (err) => {
  console.error('[render-carousel] Fatal error:', err);
  await alertFailure('render-carousel', err);
  process.exit(1);
});
