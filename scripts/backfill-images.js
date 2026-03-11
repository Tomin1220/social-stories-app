/**
 * backfill-images.js
 * Downloads and saves local copies of any slide images that are
 * still pointing at expired remote URLs (DALL-E / oaidalleapi CDN).
 * Run once: node scripts/backfill-images.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DB_FILE = path.join(__dirname, '..', 'local_db.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

function isExpiredOrRemote(url) {
    if (!url) return true;
    // Already saved locally
    if (url.startsWith('/stories/img-')) return false;
    // Placeholders are fine as-is
    if (url.includes('placehold.co') || url.includes('picsum.photos')) return false;
    // DALL-E CDN URLs expire
    return true;
}

function downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, res => {
            if (res.statusCode !== 200) {
                file.close();
                fs.unlink(destPath, () => {});
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', err => {
            file.close();
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
}

async function backfill() {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    let updated = 0;
    let skipped = 0;

    for (const story of Object.values(db)) {
        if (!story.slides) continue;

        for (let i = 0; i < story.slides.length; i++) {
            const slide = story.slides[i];
            const url = slide.image_url;

            if (!isExpiredOrRemote(url)) { skipped++; continue; }

            const localFile = `img-${story.id}-${i}.png`;
            const localPath = path.join(OUTPUT_DIR, localFile);
            const localUrl = `/stories/${localFile}`;

            // Already downloaded locally?
            if (fs.existsSync(localPath)) {
                slide.image_url = localUrl;
                updated++;
                continue;
            }

            try {
                console.log(`  ⬇️  Downloading slide ${i + 1} for "${story.scenario.substring(0, 35)}"...`);
                await downloadImage(url, localPath);
                slide.image_url = localUrl;
                updated++;
                console.log(`  ✅  Saved ${localFile}`);
            } catch (e) {
                console.warn(`  ⚠️  Failed (${e.message}), using placeholder`);
                slide.image_url = `https://placehold.co/1024x1024/e0e7ff/4c5df9?text=Scene+${i + 1}`;
                updated++;
            }
        }

        // Update cover image to first slide
        story.cover_image = story.slides[0]?.image_url || null;
    }

    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    console.log(`\n✅ Done. Updated ${updated} slides, skipped ${skipped} already-local images.`);
}

backfill().catch(console.error);
