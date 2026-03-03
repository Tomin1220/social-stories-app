const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const OpenAI = require('openai');

// --- CONFIGURATION ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const DB_FILE = path.join(__dirname, 'local_db.json');
const OUTPUT_DIR = path.join(__dirname, 'output');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// --- AI HELPERS ---

async function generateScript(scenario, childDesc) {
    console.log(`  🤖 AI (Text): Writing story for "${scenario}"...`);
    const prompt = `
    Write a 4-step social story for an autistic child about: "${scenario}".
    The child is: "${childDesc}".
    
    CRITICAL RULES:
    1. Use simple, first-person language ("I walk...", "I see...").
    2. Be positive, calm, and reassuring.
    3. Return ONLY valid JSON in this format:
    [
      { "text": "Step 1 text", "image_prompt": "detailed visual description for DALL-E" },
      ...
    ]
    `;

    const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : (parsed.steps || parsed.slides || parsed.story);
}

async function generateImage(prompt) {
    console.log(`  🎨 AI (Image): Generating "${prompt.substring(0, 30)}..."`);
    try {
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: `${prompt}, gentle storybook illustration style, soft colors, calming, high quality`,
            n: 1,
            size: "1024x1024",
            quality: "standard",
        });
        return response.data[0].url;
    } catch (error) {
        console.error("Image Gen Error:", error.message);
        return "https://placehold.co/1024x1024?text=Image+Generation+Failed";
    }
}

async function generateNarration(slides, fileNameBase) {
    console.log("  🔊 AI (Voice): Creating narration track...");
    const narrationText = slides.map((slide, idx) => `Step ${idx + 1}. ${slide.text}`).join(' ');

    try {
        const speech = await openai.audio.speech.create({
            model: "gpt-4o-mini-tts",
            voice: "alloy",
            input: narrationText,
            format: "mp3"
        });
        const audioBuffer = Buffer.from(await speech.arrayBuffer());
        const audioFile = `audio-${fileNameBase}.mp3`;
        const audioPath = path.join(OUTPUT_DIR, audioFile);
        fs.writeFileSync(audioPath, audioBuffer);
        console.log(`  ✅ Narration saved to ${audioFile}`);
        return audioFile;
    } catch (error) {
        console.error("Narration Error:", error.message);
        return null;
    }
}

// --- CORE LOGIC ---

function getStoryId(scenario, childDesc) {
    return crypto.createHash('md5').update(scenario.toLowerCase() + childDesc.toLowerCase()).digest('hex');
}

function loadDb() {
    if (!fs.existsSync(DB_FILE)) return {};
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDb(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

async function createStory(scenario, childDesc) {
    const db = loadDb();
    const id = getStoryId(scenario, childDesc);

    if (db[id]) {
        console.log(`\n✅ CACHE HIT: Found existing story for "${scenario}"`);
        return db[id];
    }

    console.log(`\n🆕 CACHE MISS: Generating NEW story for "${scenario}"`);

    const script = await generateScript(scenario, childDesc);

    const slides = [];
    for (const step of script) {
        const imageUrl = await generateImage(step.image_prompt);
        slides.push({ ...step, image_url: imageUrl });
    }

    const storyData = {
        id,
        scenario,
        child_description: childDesc,
        created_at: new Date().toISOString(),
        slides
    };

    db[id] = storyData;
    saveDb(db);
    return storyData;
}

function generateHtml(story, audioFileName) {
    const audioSection = audioFileName ? `
        <div style="margin: 30px 0;">
            <h3>Listen to this story:</h3>
            <audio controls style="width:100%;">
                <source src="${audioFileName}" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
        </div>` : '';

    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>${story.scenario}</title>
    <style>
        body { font-family: 'Comic Sans MS', 'Chalkboard SE', sans-serif; background: #f0f8ff; text-align: center; padding: 20px; color: #333; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
        .slide { display: none; }
        .slide.active { display: block; animation: fadeIn 0.8s; }
        img { max-width: 100%; height: auto; border-radius: 15px; margin-bottom: 30px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        p { font-size: 28px; line-height: 1.6; margin-bottom: 30px; }
        .controls { margin-top: 20px; display: flex; justify-content: space-between; max-width: 400px; margin: 20px auto 0; }
        button { padding: 15px 30px; font-size: 20px; background: #4a90e2; color: white; border: none; border-radius: 50px; cursor: pointer; transition: transform 0.1s; }
        button:hover { transform: scale(1.05); background: #357abd; }
        button:disabled { background: #ccc; cursor: not-allowed; transform: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
    <div class="container">
        <h1>${story.scenario}</h1>
        ${audioSection}
        <div id="story-container">
            ${story.slides.map((slide, index) => `
                <div class="slide ${index === 0 ? 'active' : ''}" id="slide-${index}">
                    <img src="${slide.image_url}" alt="Scene ${index + 1}">
                    <p>${slide.text}</p>
                </div>
            `).join('')}
        </div>
        <div class="controls">
            <button onclick="prevSlide()" id="prevBtn" disabled>⬅️ Back</button>
            <button onclick="nextSlide()" id="nextBtn">Next ➡️</button>
        </div>
    </div>

    <script>
        let currentSlide = 0;
        const totalSlides = ${story.slides.length};

        function showSlide(index) {
            document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
            document.getElementById('slide-' + index).classList.add('active');
            document.getElementById('prevBtn').disabled = index === 0;
            document.getElementById('nextBtn').innerText = index === totalSlides - 1 ? "Finish 🎉" : "Next ➡️";
        }

        function nextSlide() {
            if (currentSlide < totalSlides - 1) {
                currentSlide++;
                showSlide(currentSlide);
            }
        }

        function prevSlide() {
            if (currentSlide > 0) {
                currentSlide--;
                showSlide(currentSlide);
            }
        }
    </script>
</body>
</html>`;

    const htmlFile = `story-${story.id}.html`;
    const htmlPath = path.join(OUTPUT_DIR, htmlFile);
    fs.writeFileSync(htmlPath, html);
    return htmlFile;
}

async function generateStoryAssets(scenario, childDesc) {
    const story = await createStory(scenario, childDesc);
    const audioFile = await generateNarration(story.slides, story.id);
    const htmlFile = generateHtml(story, audioFile);
    return { story, htmlFile, audioFile };
}

module.exports = { generateStoryAssets };
