const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const { generateStoryAssets, loadDb } = require('./generator');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/stories', express.static(path.join(__dirname, 'output')));

// --- SSE PROGRESS ENDPOINT ---
const activeJobs = new Map();

app.get('/progress/:jobId', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const jobId = req.params.jobId;
    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    activeJobs.set(jobId, send);
    req.on('close', () => activeJobs.delete(jobId));
});

// --- GENERATE ENDPOINT ---
app.post('/generate', async (req, res) => {
    const { scenario, child, jobId } = req.body;
    if (!scenario || !child) return res.json({ success: false, error: 'Scenario and child description required.' });

    const notify = activeJobs.get(jobId);
    const onProgress = (stage, message, pct) => {
        if (notify) notify({ stage, message, pct });
    };

    try {
        const { htmlFile, audioFile, story } = await generateStoryAssets(scenario, child, onProgress);
        if (notify) notify({ stage: 'done', message: 'Story ready!', pct: 100 });
        res.json({
            success: true,
            url: `/stories/${htmlFile}`,
            audio: audioFile ? `/stories/${audioFile}` : null,
            coverImage: story.slides?.[0]?.image_url || null,
            storyId: story.id
        });
    } catch (error) {
        console.error('Generation error:', error);
        if (notify) notify({ stage: 'error', message: error.message, pct: 0 });
        res.json({ success: false, error: error.message });
    }
});

// --- LIBRARY ENDPOINT ---
app.get('/library', (req, res) => {
    const db = loadDb();
    const stories = Object.values(db).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(stories);
});

// --- MAIN PAGE ---
app.get('/', (req, res) => res.send(PAGE_HTML));

// --- PAGE HTML ---
const PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <title>Social Stories Studio</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root { --primary: #4c5df9; --primary-dark: #3b4cca; --purple: #7c3aed; --green: #10b981; --red: #f87171; --bg: #eef2ff; --card: #fff; --text: #111827; --muted: #6b7280; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', -apple-system, sans-serif; background: linear-gradient(135deg, var(--bg) 0%, #fdf2ff 100%); color: var(--text); min-height: 100vh; }
        a { color: var(--primary); text-decoration: none; }
        a:hover { text-decoration: underline; }

        /* HEADER */
        .header { position: sticky; top: 0; z-index: 100; backdrop-filter: blur(12px); background: rgba(255,255,255,0.9); border-bottom: 1px solid rgba(76,93,249,0.1); padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .brand { font-weight: 700; font-size: 17px; display: flex; align-items: center; gap: 8px; white-space: nowrap; }
        .brand-dot { width: 10px; height: 10px; border-radius: 50%; background: linear-gradient(135deg, var(--purple), var(--primary)); flex-shrink: 0; }
        .header-nav { display: flex; gap: 16px; flex-wrap: wrap; }
        .header-nav a { font-size: 14px; font-weight: 500; color: var(--muted); padding: 6px 12px; border-radius: 8px; transition: background 0.2s; }
        .header-nav a:hover { background: #f0f0ff; color: var(--text); text-decoration: none; }

        /* LAYOUT */
        .page { max-width: 1100px; margin: 0 auto; padding: 32px 18px 80px; display: flex; flex-direction: column; gap: 24px; }
        .card { background: var(--card); border-radius: 24px; padding: 32px; box-shadow: 0 20px 60px rgba(17,24,39,0.07); }

        /* HERO */
        .hero { display: grid; grid-template-columns: 1fr 340px; gap: 32px; align-items: center; }
        .hero h1 { font-size: 38px; line-height: 1.2; margin-bottom: 14px; }
        .hero-sub { font-size: 17px; color: var(--muted); line-height: 1.7; margin-bottom: 20px; }
        .checklist { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
        .checklist li { display: flex; align-items: flex-start; gap: 10px; font-size: 15px; font-weight: 500; }
        .check-icon { width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(135deg, var(--purple), var(--primary)); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; flex-shrink: 0; margin-top: 1px; }
        .hero-buttons { display: flex; gap: 12px; flex-wrap: wrap; }
        .btn { padding: 12px 24px; border-radius: 999px; font-size: 15px; font-weight: 600; border: none; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; }
        .btn:hover { transform: translateY(-2px); }
        .btn-primary { background: var(--primary); color: white; box-shadow: 0 8px 20px rgba(76,93,249,0.35); }
        .btn-primary:hover { box-shadow: 0 12px 28px rgba(76,93,249,0.4); }
        .btn-outline { background: transparent; color: var(--primary); border: 2px solid var(--primary); }
        .mission-panel { background: #111827; color: #e5e7eb; border-radius: 18px; padding: 24px; }
        .mission-panel h3 { color: white; font-size: 17px; margin-bottom: 12px; }
        .mission-panel p { font-size: 14px; line-height: 1.7; margin-bottom: 10px; }
        .mission-panel p:last-child { margin: 0; opacity: 0.8; }

        /* HOW IT WORKS */
        .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .step { background: #f8f9ff; border-radius: 16px; padding: 20px; border: 1px solid rgba(76,93,249,0.12); }
        .step-num { font-size: 13px; font-weight: 700; color: var(--primary); letter-spacing: 0.5px; margin-bottom: 8px; }
        .step h4 { font-size: 15px; margin-bottom: 6px; }
        .step p { font-size: 14px; color: var(--muted); line-height: 1.6; }

        /* GENERATOR */
        .gen-grid { display: grid; grid-template-columns: 1fr 300px; gap: 32px; align-items: start; }
        .gen-form-side { display: flex; flex-direction: column; gap: 0; }
        .section-title { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
        .section-sub { font-size: 14px; color: var(--muted); margin-bottom: 24px; }
        .form-group { margin-bottom: 18px; }
        label { display: block; font-weight: 600; font-size: 14px; color: #374151; margin-bottom: 6px; }
        input, textarea, select { width: 100%; padding: 14px 16px; border-radius: 14px; border: 2px solid #e0e7ff; font-size: 15px; font-family: inherit; transition: border 0.2s; outline: none; background: #fdfdff; }
        input:focus, textarea:focus, select:focus { border-color: var(--primary); }
        textarea { min-height: 100px; resize: vertical; }
        .scenario-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
        .chip { padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 500; background: #e0e7ff; color: var(--primary); cursor: pointer; border: none; transition: background 0.2s; }
        .chip:hover { background: #c7d2fe; }
        .btn-generate { width: 100%; padding: 16px; background: linear-gradient(135deg, var(--purple), var(--primary)); color: white; border: none; border-radius: 16px; font-size: 17px; font-weight: 700; cursor: pointer; box-shadow: 0 12px 30px rgba(76,93,249,0.35); transition: transform 0.15s, box-shadow 0.15s; }
        .btn-generate:hover { transform: translateY(-2px); box-shadow: 0 16px 36px rgba(76,93,249,0.4); }
        .btn-generate:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        /* PROGRESS */
        .progress-box { display: none; margin-top: 20px; padding: 18px; background: #f8f9ff; border-radius: 14px; border: 1px solid #e0e7ff; }
        .progress-track { height: 10px; background: #e0e7ff; border-radius: 999px; overflow: hidden; margin-bottom: 10px; }
        .progress-fill { height: 100%; width: 0%; background: linear-gradient(90deg, var(--purple), var(--primary)); transition: width 0.4s ease; border-radius: 999px; }
        .progress-label { font-size: 13px; color: var(--muted); font-weight: 500; }
        .result-box { display: none; margin-top: 20px; }
        .result-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 20px; }
        .result-card h4 { color: #166534; margin-bottom: 12px; font-size: 15px; }
        .result-links { display: flex; flex-direction: column; gap: 8px; }
        .result-link { display: block; padding: 10px 16px; background: var(--green); color: white; border-radius: 999px; text-align: center; font-weight: 600; font-size: 14px; box-shadow: 0 6px 16px rgba(16,185,129,0.3); }
        .result-link.secondary { background: #6b7280; box-shadow: none; }

        /* PROFILES PANEL */
        .profiles-panel h4 { font-size: 15px; font-weight: 700; margin-bottom: 12px; }
        .profile-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
        .profile-item { padding: 10px 14px; background: #f8f9ff; border: 1px solid #e0e7ff; border-radius: 12px; cursor: pointer; transition: border 0.2s; display: flex; justify-content: space-between; align-items: center; }
        .profile-item:hover { border-color: var(--primary); }
        .profile-name { font-weight: 600; font-size: 14px; }
        .profile-detail { font-size: 12px; color: var(--muted); }
        .profile-delete { background: none; border: none; color: #f87171; cursor: pointer; font-size: 16px; padding: 0 4px; }
        .profile-empty { font-size: 13px; color: var(--muted); text-align: center; padding: 16px; }
        .btn-save-profile { width: 100%; padding: 10px; border-radius: 999px; background: #f0f0ff; color: var(--primary); font-weight: 600; font-size: 13px; border: 2px solid var(--primary); cursor: pointer; transition: background 0.2s; }
        .btn-save-profile:hover { background: #e0e7ff; }

        /* LIBRARY */
        .library-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 18px; }
        .story-card { background: white; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid rgba(76,93,249,0.08); transition: transform 0.2s, box-shadow 0.2s; }
        .story-card:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(0,0,0,0.1); }
        .story-thumb { width: 100%; height: 160px; object-fit: cover; background: #e0e7ff; }
        .story-thumb-placeholder { width: 100%; height: 160px; background: linear-gradient(135deg, #e0e7ff, #f0f0ff); display: flex; align-items: center; justify-content: center; font-size: 36px; }
        .story-info { padding: 14px; }
        .story-title { font-weight: 700; font-size: 14px; color: var(--text); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .story-child { font-size: 12px; color: var(--muted); margin-bottom: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .story-meta { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
        .badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #e0e7ff; color: var(--primary); font-weight: 500; }
        .btn-view { display: block; text-align: center; background: var(--primary); color: white; padding: 8px; border-radius: 10px; font-weight: 600; font-size: 13px; }
        .library-empty { text-align: center; padding: 40px; color: var(--muted); grid-column: 1/-1; }

        /* RESEARCH */
        .research-list { list-style: none; display: grid; gap: 14px; }
        .research-item { background: #fdfcff; border-radius: 16px; padding: 18px; border: 1px solid rgba(76,93,249,0.1); }
        .research-item strong { display: block; font-size: 15px; margin-bottom: 4px; }
        .research-item p { font-size: 13px; color: var(--muted); margin-bottom: 8px; line-height: 1.6; }

        /* FOOTER */
        footer { text-align: center; color: var(--muted); font-size: 13px; padding: 24px; }

        /* RESPONSIVE */
        @media (max-width: 900px) {
            .hero { grid-template-columns: 1fr; }
            .gen-grid { grid-template-columns: 1fr; }
            .mission-panel { display: none; }
            .steps { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
            .card { padding: 22px; border-radius: 20px; }
            .hero h1 { font-size: 28px; }
            .library-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
            .story-thumb, .story-thumb-placeholder { height: 120px; }
            .header { padding: 12px 16px; }
            .header-nav { gap: 8px; }
            .header-nav a { padding: 5px 8px; font-size: 13px; }
            .steps { grid-template-columns: 1fr; gap: 12px; }
        }
    </style>
</head>
<body>
<header class="header">
    <div class="brand"><span class="brand-dot"></span>Social Stories Studio</div>
    <nav class="header-nav">
        <a href="#how-it-works">How it works</a>
        <a href="#generate">Generate</a>
        <a href="#library">Library</a>
        <a href="#research">Research</a>
    </nav>
</header>

<main class="page">

    <!-- HERO -->
    <section class="card hero" id="hero">
        <div>
            <h1>Stories that rehearse courage.</h1>
            <p class="hero-sub">Evidence-based social stories for autistic children — with sensory prep, coping scripts, and caregiver coaching baked into every slide.</p>
            <ul class="checklist">
                <li><span class="check-icon">✓</span>Carol Gray Social Stories™ 10.2 criteria</li>
                <li><span class="check-icon">✓</span>OT + behavioral research insights</li>
                <li><span class="check-icon">✓</span>Caregiver coaching on every slide</li>
                <li><span class="check-icon">✓</span>AI-generated visuals + narration audio</li>
            </ul>
            <div class="hero-buttons">
                <button class="btn btn-primary" onclick="scrollTo('generate')">Create a Story</button>
                <button class="btn btn-outline" onclick="scrollTo('research')">See Research</button>
            </div>
        </div>
        <div class="mission-panel">
            <h3>Mission in progress</h3>
            <p>We're building this so every educator, therapist, and family can access evidence-aligned social stories without high costs.</p>
            <p>Current goals: expand templates, add multilingual voices, and subsidize free access for families in need.</p>
        </div>
    </section>

    <!-- HOW IT WORKS -->
    <section class="card" id="how-it-works">
        <h2 class="section-title">How it works</h2>
        <p class="section-sub">Three steps to a therapeutic story with sensory prep, coping scripts, and caregiver notes.</p>
        <div class="steps">
            <div class="step">
                <div class="step-num">01 · CHOOSE SCENARIO</div>
                <h4>Pick the moment</h4>
                <p>Select a preset or describe any situation. Curated templates render instantly, skipping the AI wait.</p>
            </div>
            <div class="step">
                <div class="step-num">02 · PERSONALIZE</div>
                <h4>Add child details</h4>
                <p>Save child profiles with name, age, interests, and sensory notes. Reuse them instantly next time.</p>
            </div>
            <div class="step">
                <div class="step-num">03 · SHARE & REHEARSE</div>
                <h4>Download & practice</h4>
                <p>Open the slideshow, play the narration, and review caregiver tips before the real event.</p>
            </div>
        </div>
    </section>

    <!-- GENERATOR -->
    <section class="card" id="generate">
        <div class="gen-grid">
            <div class="gen-form-side">
                <h2 class="section-title">✨ Generate a story</h2>
                <p class="section-sub">Curated scenarios render instantly. Custom inputs use GPT-4o-mini with smart caching.</p>

                <div class="form-group">
                    <label>Quick scenarios</label>
                    <div class="scenario-chips" id="chips"></div>
                </div>

                <div class="form-group">
                    <label for="scenarioInput">Or describe your own scenario</label>
                    <input type="text" id="scenarioInput" placeholder="e.g., First day of school, Grocery store, Airplane ride" />
                </div>

                <div class="form-group">
                    <label for="childInput">Child description</label>
                    <textarea id="childInput" placeholder="Name, age, interests, sensory notes (e.g., Sam, 6, loves rockets, sensitive to loud buzzers)"></textarea>
                </div>

                <button class="btn-generate" id="generateBtn" onclick="generateStory()">Generate story 🪄</button>

                <div class="progress-box" id="progressBox">
                    <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
                    <div class="progress-label" id="progressLabel">Starting...</div>
                </div>

                <div class="result-box" id="resultBox">
                    <div class="result-card">
                        <h4>✅ Story is ready!</h4>
                        <div class="result-links" id="resultLinks"></div>
                    </div>
                </div>
            </div>

            <!-- PROFILES PANEL -->
            <div>
                <div class="card" style="padding:20px; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
                    <div class="profiles-panel">
                        <h4>👧 Saved Child Profiles</h4>
                        <div class="profile-list" id="profileList"></div>
                        <button class="btn-save-profile" onclick="saveProfile()">+ Save current as profile</button>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- LIBRARY -->
    <section class="card" id="library">
        <h2 class="section-title">📚 Story Library</h2>
        <p class="section-sub">All previously generated stories. Click to view or share.</p>
        <div class="library-grid" id="libraryGrid">
            <div class="library-empty">Loading stories...</div>
        </div>
    </section>

    <!-- RESEARCH -->
    <section class="card" id="research">
        <h2 class="section-title">🔬 Research & Evidence</h2>
        <p class="section-sub">Templates and prompts follow best practices from peer-reviewed Social Stories™ literature.</p>
        <ul class="research-list">
            <li class="research-item">
                <strong>A scoping review: Social Stories supporting behavior change (2023)</strong>
                <p>J Occup Ther Sch Early Interv — 56 studies mapped by "reduce disruptive" vs "increase desired" goals. Highlights sensory previews + coping rehearsal as key efficacy factors.</p>
                <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11263915/" target="_blank">Read summary →</a>
            </li>
            <li class="research-item">
                <strong>ASSSIST-2 RCT: Social Stories™ in UK primary schools (2024–25)</strong>
                <p>Health Technol Assess — pragmatic cluster trial showing individual socio-emotional goals improve with high-fidelity, teacher co-authored, personalized stories across 4–6 read-throughs.</p>
                <a href="https://www.ncbi.nlm.nih.gov/books/NBK606433/" target="_blank">Read summary →</a>
            </li>
            <li class="research-item">
                <strong>Cost–utility analysis of Social Stories™ (2024)</strong>
                <p>BJPsych Open — demonstrates favorable cost-per-outcome ratio compared to other supports in mainstream schools, supporting digital delivery platforms.</p>
                <a href="https://www.cambridge.org/core/journals/bjpsych-open/article/costutility-analysis-of-social-stories" target="_blank">Read summary →</a>
            </li>
            <li class="research-item">
                <strong>Social Story research scoping study — 17 literature reviews (2021)</strong>
                <p>Review Journal of Autism & Developmental Disorders — synthesizes Gray sentence ratios, cooperative sentences, and implementation fidelity requirements.</p>
                <a href="https://link.springer.com/article/10.1007/s40489-020-00235-6" target="_blank">Read summary →</a>
            </li>
            <li class="research-item">
                <strong>Effectiveness of Social Stories as behavior intervention (2022)</strong>
                <p>St. Cloud State University — 13 case studies covering dentist visits, haircuts, transitions with measurable outcomes across age groups.</p>
                <a href="https://repository.stcloudstate.edu/sped_etds/155/" target="_blank">Read summary →</a>
            </li>
        </ul>
    </section>

</main>

<footer>Social Stories Studio · Research-aligned narratives for neurodivergent brilliance.</footer>

<script>
// --- UTILS ---
function scrollTo(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function uid() { return Math.random().toString(36).substring(2, 10); }

// --- SCENARIO CHIPS ---
const SCENARIOS = ['Going to the Dentist','Haircut Day','Fire Drill','First Day of School','Grocery Store','Doctor Visit','Airplane Ride','New Baby Sibling','Birthday Party','Waiting in Line'];
const chipsEl = document.getElementById('chips');
SCENARIOS.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = s;
    btn.onclick = () => { document.getElementById('scenarioInput').value = s; };
    chipsEl.appendChild(btn);
});

// --- CHILD PROFILES ---
function getProfiles() { try { return JSON.parse(localStorage.getItem('ss_profiles') || '[]'); } catch(e) { return []; } }
function saveProfiles(p) { localStorage.setItem('ss_profiles', JSON.stringify(p)); }

function renderProfiles() {
    const list = document.getElementById('profileList');
    const profiles = getProfiles();
    if (!profiles.length) { list.innerHTML = '<div class="profile-empty">No saved profiles yet</div>'; return; }
    list.innerHTML = profiles.map(p => \`
        <div class="profile-item" onclick="loadProfile('\${p.id}')">
            <div>
                <div class="profile-name">\${p.name}</div>
                <div class="profile-detail">\${p.description.substring(0, 50)}\${p.description.length > 50 ? '...' : ''}</div>
            </div>
            <button class="profile-delete" onclick="event.stopPropagation();deleteProfile('\${p.id}')">✕</button>
        </div>\`).join('');
}

function saveProfile() {
    const desc = document.getElementById('childInput').value.trim();
    if (!desc) { alert('Enter a child description first.'); return; }
    const name = desc.split(',')[0].trim() || 'Child';
    const profiles = getProfiles();
    profiles.unshift({ id: uid(), name, description: desc, savedAt: new Date().toISOString() });
    saveProfiles(profiles.slice(0, 10));
    renderProfiles();
}

function loadProfile(id) {
    const p = getProfiles().find(x => x.id === id);
    if (p) document.getElementById('childInput').value = p.description;
}

function deleteProfile(id) {
    saveProfiles(getProfiles().filter(p => p.id !== id));
    renderProfiles();
}

renderProfiles();

// --- STORY GENERATION WITH REAL PROGRESS ---
let currentJobId = null;
let evtSource = null;

function generateStory() {
    const scenario = document.getElementById('scenarioInput').value.trim();
    const child = document.getElementById('childInput').value.trim();
    if (!scenario || !child) { alert('Please fill in both the scenario and child description.'); return; }

    const btn = document.getElementById('generateBtn');
    const progressBox = document.getElementById('progressBox');
    const progressFill = document.getElementById('progressFill');
    const progressLabel = document.getElementById('progressLabel');
    const resultBox = document.getElementById('resultBox');

    btn.disabled = true;
    resultBox.style.display = 'none';
    progressBox.style.display = 'block';
    progressFill.style.width = '5%';
    progressLabel.textContent = 'Connecting...';
    progressFill.style.background = 'linear-gradient(90deg, #7c3aed, #4c5df9)';

    currentJobId = uid();

    // Open SSE connection
    if (evtSource) evtSource.close();
    evtSource = new EventSource('/progress/' + currentJobId);
    evtSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        progressFill.style.width = data.pct + '%';
        progressLabel.textContent = data.message;
        if (data.stage === 'error') {
            progressFill.style.background = '#f87171';
            btn.disabled = false;
            evtSource.close();
        }
    };
    evtSource.onerror = () => evtSource.close();

    fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, child, jobId: currentJobId })
    })
    .then(r => r.json())
    .then(data => {
        evtSource.close();
        btn.disabled = false;
        progressFill.style.width = '100%';

        if (!data.success) {
            progressLabel.textContent = 'Failed: ' + data.error;
            progressFill.style.background = '#f87171';
            return;
        }

        progressLabel.textContent = '✅ Story ready!';
        setTimeout(() => { progressBox.style.display = 'none'; }, 800);
        resultBox.style.display = 'block';
        document.getElementById('resultLinks').innerHTML =
            \`<a href="\${data.url}" target="_blank" class="result-link">📖 Open story slideshow</a>\` +
            (data.audio ? \`<a href="\${data.audio}" target="_blank" class="result-link secondary">🔊 Download narration audio</a>\` : '');
        loadLibrary();
    })
    .catch(err => {
        evtSource.close();
        btn.disabled = false;
        progressLabel.textContent = 'Error: ' + err.message;
        progressFill.style.background = '#f87171';
    });
}

// --- LIBRARY ---
function loadLibrary() {
    fetch('/library')
    .then(r => r.json())
    .then(stories => {
        const grid = document.getElementById('libraryGrid');
        if (!stories.length) {
            grid.innerHTML = '<div class="library-empty">No stories yet — generate one above! 👆</div>';
            return;
        }
        grid.innerHTML = stories.map(s => {
            const thumb = s.cover_image || (s.slides && s.slides[0]?.image_url);
            const date = new Date(s.created_at).toLocaleDateString();
            const badge = s.template_id ? '<span class="badge">Curated</span>' : '<span class="badge">AI</span>';
            return \`<div class="story-card">
                \${thumb
                    ? \`<img src="\${thumb}" class="story-thumb" loading="lazy" alt="\${s.scenario}">\`
                    : \`<div class="story-thumb-placeholder">📖</div>\`}
                <div class="story-info">
                    <div class="story-title">\${s.scenario}</div>
                    <div class="story-child">For: \${s.child_description}</div>
                    <div class="story-meta">\${badge}<span class="badge">\${date}</span></div>
                    <a href="/stories/story-\${s.id}.html" target="_blank" class="btn-view">View Story →</a>
                </div>
            </div>\`;
        }).join('');
    });
}

loadLibrary();
</script>
</body>
</html>`;

app.listen(PORT, () => {
    console.log(`Social Story server running at http://localhost:${PORT}`);
});
