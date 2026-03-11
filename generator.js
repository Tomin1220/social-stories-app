const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const OpenAI = require('openai');

// --- CONFIGURATION ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const DB_FILE = path.join(__dirname, 'local_db.json');
const OUTPUT_DIR = path.join(__dirname, 'output');
const TEMPLATE_FILE = path.join(__dirname, 'knowledge', 'scenario_templates.json');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// --- KNOWLEDGE HELPERS ---
let cachedTemplates = null;

function loadTemplates() {
    if (cachedTemplates) return cachedTemplates;
    if (!fs.existsSync(TEMPLATE_FILE)) return { templates: [] };
    try { cachedTemplates = JSON.parse(fs.readFileSync(TEMPLATE_FILE, 'utf8')); }
    catch (e) { cachedTemplates = { templates: [] }; }
    return cachedTemplates;
}

function findTemplateForScenario(scenario) {
    const data = loadTemplates();
    const target = scenario.toLowerCase().trim();
    for (const t of data.templates || []) {
        if (t.matchers && t.matchers.some(m => target.includes(m.toLowerCase()))) return t;
    }
    return null;
}

function enrichSlidesWithChild(slides, childDesc) {
    return slides.map(slide => ({
        ...slide,
        text: (slide.text || '').replace(/{{child_description}}/gi, childDesc),
        parent_tip: (slide.parent_tip || '').replace(/{{child_description}}/gi, childDesc)
    }));
}

function buildScenarioContext(template) {
    if (!template) return { goalCategory: 'increase_desired', sensoryNotes: [], copingStrategies: [] };
    return {
        goalCategory: template.goal_category || 'increase_desired',
        sensoryNotes: template.sensory_notes || [],
        copingStrategies: template.coping_strategies || []
    };
}

// --- DB HELPERS ---
function loadDb() {
    if (!fs.existsSync(DB_FILE)) return {};
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch (e) { return {}; }
}

function saveDb(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function getStoryId(scenario, childDesc) {
    return crypto.createHash('md5').update(scenario.toLowerCase() + childDesc.toLowerCase()).digest('hex');
}

// --- AI HELPERS WITH RETRY ---
async function withRetry(fn, retries = 3, label = '') {
    for (let i = 0; i < retries; i++) {
        try { return await fn(); }
        catch (err) {
            console.warn(`  ⚠️  ${label} failed (attempt ${i + 1}/${retries}): ${err.message}`);
            if (i === retries - 1) throw err;
            await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        }
    }
}

async function generateScript(scenario, childDesc, context = {}) {
    const { goalCategory = 'increase_desired', sensoryNotes = [], copingStrategies = [] } = context;
    const prompt = `You are an occupational-therapy-informed writer following Carol Gray Social Stories™ 10.2 criteria.
Scenario: "${scenario}". Child description: "${childDesc}".
Behavior goal: ${goalCategory === 'reduce_disruptive' ? 'Reduce disruptive/anxious responses' : 'Increase desired participation skills'}.
Sensory considerations: ${sensoryNotes.length ? sensoryNotes.join(', ') : 'infer from scenario'}.
Coping strategies: ${copingStrategies.length ? copingStrategies.join(', ') : 'breathing, grounded movements, seeking help'}.

Rules:
- First-person voice, literal language, concrete sequencing.
- Gray ratio: 2-5 descriptive/perspective/affirmative sentences per directive/control sentence.
- Each slide lists 2-3 sentence types used.
- Include cooperative caregiver note (parent_tip) per slide.
- Exactly 6 slides: Expectation, Sensory Preview, Transition, Coping, Outcome, Reinforcement.

Return strict JSON:
{
  "slides": [
    { "focus": "Expectation", "text": "...", "sentence_types": ["descriptive","affirmative"], "parent_tip": "...", "image_prompt": "..." }
  ]
}`;

    return await withRetry(async () => {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
        });
        const parsed = JSON.parse(completion.choices[0].message.content);
        return parsed.slides || parsed.steps || parsed.story;
    }, 3, 'generateScript');
}

async function generateImage(prompt) {
    return await withRetry(async () => {
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: `${prompt}, gentle storybook illustration style, soft colors, calming, simple, child-friendly`,
            n: 1,
            size: "1024x1024",
            quality: "standard",
        });
        return response.data[0].url;
    }, 3, `generateImage: ${prompt.substring(0, 30)}`);
}

async function generateNarration(slides, fileNameBase) {
    const narrationText = slides.map((slide, idx) => `Step ${idx + 1}. ${slide.text}`).join(' ');
    return await withRetry(async () => {
        const speech = await openai.audio.speech.create({
            model: "gpt-4o-mini-tts",
            voice: "alloy",
            input: narrationText,
            format: "mp3"
        });
        const audioBuffer = Buffer.from(await speech.arrayBuffer());
        const audioFile = `audio-${fileNameBase}.mp3`;
        fs.writeFileSync(path.join(OUTPUT_DIR, audioFile), audioBuffer);
        return audioFile;
    }, 3, 'generateNarration');
}

// --- HTML BUILDER ---
function generateHtml(story, audioFileName) {
    const audioSection = audioFileName ? `
        <div style="margin:20px 0;">
            <audio controls style="width:100%;border-radius:12px;">
                <source src="${audioFileName}" type="audio/mpeg">
            </audio>
        </div>` : '';

    const html = `<!DOCTYPE html>
<html>
<head>
    <title>${story.scenario}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: 'Comic Sans MS','Chalkboard SE',sans-serif; background:#f0f8ff; margin:0; padding:20px; box-sizing:border-box; }
        .container { max-width:900px; margin:0 auto; background:white; padding:40px; border-radius:20px; box-shadow:0 8px 20px rgba(0,0,0,0.1); }
        .slide { display:none; }
        .slide.active { display:block; animation:fadeIn 0.8s; }
        img { max-width:100%; height:auto; border-radius:15px; margin-bottom:15px; box-shadow:0 4px 10px rgba(0,0,0,0.1); }
        .focus-tag { font-size:16px; text-transform:uppercase; letter-spacing:1px; color:#4a90e2; margin-bottom:8px; font-weight:bold; }
        p.story-text { font-size:clamp(20px,4vw,28px); line-height:1.6; margin-bottom:15px; }
        .parent-tip { font-size:16px; background:#f0f7ff; border-left:4px solid #4a90e2; padding:12px 16px; border-radius:10px; margin-bottom:20px; text-align:left; }
        .parent-tip strong { display:block; font-size:14px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; color:#2c3e50; }
        .progress-dots { display:flex; justify-content:center; gap:8px; margin:20px 0; }
        .dot { width:10px; height:10px; border-radius:50%; background:#ddd; transition:background 0.3s; }
        .dot.active { background:#4a90e2; }
        .controls { display:flex; justify-content:space-between; max-width:400px; margin:0 auto; gap:12px; }
        button { flex:1; padding:14px; font-size:18px; background:#4a90e2; color:white; border:none; border-radius:50px; cursor:pointer; transition:transform 0.1s; }
        button:hover { transform:scale(1.05); background:#357abd; }
        button:disabled { background:#ccc; cursor:not-allowed; transform:none; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @media(max-width:600px) { .container{padding:24px;} }
    </style>
</head>
<body>
    <div class="container">
        <h1 style="text-align:center;color:#333;">${story.scenario}</h1>
        ${audioSection}
        <div class="progress-dots">
            ${story.slides.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}" id="dot-${i}"></div>`).join('')}
        </div>
        <div id="story-container">
            ${story.slides.map((slide, i) => `
                <div class="slide ${i === 0 ? 'active' : ''}" id="slide-${i}">
                    <div class="focus-tag">${slide.focus || `Scene ${i + 1}`}</div>
                    <img src="${slide.image_url}" alt="Scene ${i + 1}" loading="lazy">
                    <p class="story-text">${slide.text}</p>
                    ${slide.parent_tip ? `<div class="parent-tip"><strong>Caregiver Tip</strong>${slide.parent_tip}</div>` : ''}
                </div>`).join('')}
        </div>
        <div class="controls">
            <button onclick="prevSlide()" id="prevBtn" disabled>⬅️ Back</button>
            <button onclick="nextSlide()" id="nextBtn">Next ➡️</button>
        </div>
    </div>
    <script>
        let cur = 0;
        const total = ${story.slides.length};
        function showSlide(n) {
            document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.dot').forEach(d => d.classList.remove('active'));
            document.getElementById('slide-' + n).classList.add('active');
            document.getElementById('dot-' + n).classList.add('active');
            document.getElementById('prevBtn').disabled = n === 0;
            document.getElementById('nextBtn').innerText = n === total - 1 ? '🎉 Finish' : 'Next ➡️';
        }
        function nextSlide() { if (cur < total - 1) showSlide(++cur); }
        function prevSlide() { if (cur > 0) showSlide(--cur); }
        // Swipe support
        let startX = 0;
        document.addEventListener('touchstart', e => startX = e.touches[0].clientX);
        document.addEventListener('touchend', e => {
            const dx = e.changedTouches[0].clientX - startX;
            if (Math.abs(dx) > 50) dx < 0 ? nextSlide() : prevSlide();
        });
    </script>
</body>
</html>`;

    const htmlFile = `story-${story.id}.html`;
    fs.writeFileSync(path.join(OUTPUT_DIR, htmlFile), html);
    return htmlFile;
}

// --- MAIN STORY CREATOR WITH PROGRESS CALLBACK ---
async function createStory(scenario, childDesc, onProgress) {
    const db = loadDb();
    const id = getStoryId(scenario, childDesc);

    if (db[id]) {
        onProgress && onProgress('cache', 'Found existing story in cache', 100);
        return db[id];
    }

    onProgress && onProgress('start', 'Starting story generation...', 5);

    const template = findTemplateForScenario(scenario);
    const ctx = buildScenarioContext(template);

    let scriptSlides;
    if (template) {
        onProgress && onProgress('script', `Using curated template: ${template.id}`, 15);
        scriptSlides = enrichSlidesWithChild(template.slides, childDesc);
    } else {
        onProgress && onProgress('script', 'Writing therapeutic story script...', 10);
        scriptSlides = await generateScript(scenario, childDesc, ctx);
        onProgress && onProgress('script', 'Script complete', 20);
    }

    const slides = [];
    for (let i = 0; i < scriptSlides.length; i++) {
        const step = scriptSlides[i];
        const imagePrompt = step.image_prompt || `${scenario} scene, calm storybook illustration`;
        const pct = 20 + Math.round(((i + 1) / scriptSlides.length) * 55);
        onProgress && onProgress('image', `Drawing scene ${i + 1} of ${scriptSlides.length}...`, pct);
        let imageUrl;
        try {
            imageUrl = await generateImage(imagePrompt);
        } catch (e) {
            console.warn(`Image failed for slide ${i + 1}, using placeholder`);
            imageUrl = `https://placehold.co/1024x1024/e0e7ff/4c5df9?text=Scene+${i + 1}`;
        }
        slides.push({ ...step, goal_category: ctx.goalCategory, image_prompt: imagePrompt, image_url: imageUrl });
    }

    onProgress && onProgress('audio', 'Creating narration audio...', 80);
    const storyData = {
        id, scenario, child_description: childDesc,
        goal_category: ctx.goalCategory,
        created_at: new Date().toISOString(),
        template_id: template?.id || null,
        cover_image: slides[0]?.image_url || null,
        slides
    };

    db[id] = storyData;
    saveDb(db);
    return storyData;
}

async function generateStoryAssets(scenario, childDesc, onProgress) {
    const story = await createStory(scenario, childDesc, onProgress);
    let audioFile = null;
    try {
        audioFile = await generateNarration(story.slides, story.id);
    } catch (e) {
        console.warn('Narration failed, skipping audio:', e.message);
    }
    onProgress && onProgress('html', 'Building story slideshow...', 92);
    const htmlFile = generateHtml(story, audioFile);
    onProgress && onProgress('done', 'Story ready!', 100);
    return { story, htmlFile, audioFile };
}

module.exports = { generateStoryAssets, loadDb };
