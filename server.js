const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const { generateStoryAssets } = require('./generator');

const app = express();
const PORT = process.env.PORT || 8080;
const DB_FILE = path.join(__dirname, 'local_db.json');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/stories', express.static(path.join(__dirname, 'output')));

// --- LIBRARY ENDPOINT ---
app.get('/library', (req, res) => {
    if (!fs.existsSync(DB_FILE)) return res.json([]);
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    // Convert object to array and sort newest first
    const stories = Object.values(db).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(stories);
});

const formHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Social Stories Studio</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; }
        body { margin: 0; min-height: 100vh; background: linear-gradient(135deg, #eef2ff 0%, #fdf2ff 100%); color: #111827; }
        * { box-sizing: border-box; }
        a { color: #4c5df9; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .site-header { position: sticky; top: 0; backdrop-filter: blur(12px); background: rgba(255,255,255,0.85); border-bottom: 1px solid rgba(76,93,249,0.08); padding: 18px 30px; display: flex; align-items: center; justify-content: space-between; z-index: 10; }
        .brand { font-weight: 700; font-size: 18px; display: flex; align-items: center; gap: 10px; }
        .logo-dot { width: 12px; height: 12px; border-radius: 50%; background: linear-gradient(135deg, #7c3aed, #4c5df9); display: inline-block; }
        nav a { margin-left: 20px; font-weight: 500; color: #4b5563; }
        nav a:hover { color: #111827; }
        .container { max-width: 1100px; margin: 0 auto; padding: 40px 20px 80px; display: flex; flex-direction: column; gap: 24px; }
        .card { background: white; border-radius: 28px; padding: 36px; box-shadow: 0 30px 80px rgba(17, 24, 39, 0.08); }
        .hero { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 32px; align-items: center; }
        .hero h1 { font-size: 40px; margin: 0 0 16px 0; }
        .hero p { font-size: 18px; color: #4b5563; line-height: 1.7; }
        .hero-panel { background: #111827; color: white; border-radius: 24px; padding: 28px; box-shadow: inset 0 0 35px rgba(76,93,249,0.3); }
        .hero-panel h3 { margin-top: 0; font-size: 20px; }
        .hero-metrics { list-style: none; padding: 0; margin: 20px 0; display: grid; gap: 12px; }
        .hero-metrics li { display: flex; align-items: center; gap: 10px; font-weight: 500; }
        .hero-metrics span { width: 8px; height: 8px; border-radius: 50%; background: #4c5df9; display: inline-block; }
        .hero-buttons { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 25px; }
        .hero button { padding: 14px 28px; background: #4c5df9; color: white; border: none; border-radius: 999px; font-size: 15px; font-weight: 600; cursor: pointer; box-shadow: 0 10px 20px rgba(76,93,249,0.4); }
        .hero button.secondary { background: transparent; color: #4c5df9; border: 2px solid #4c5df9; box-shadow: none; }
        .section-title { font-size: 26px; margin: 0 0 10px; }
        .section-sub { color: #6b7280; margin-bottom: 24px; }
        .steps-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; }
        .step { background: #f8f9ff; border-radius: 20px; padding: 18px; border: 1px solid rgba(76,93,249,0.15); }
        .step-number { font-weight: 600; color: #4c5df9; }
        .benefits { display: grid; grid-template-columns: repeat(auto-fit,minmax(240px,1fr)); gap: 16px; margin-top: 20px; }
        .benefit { background: #fdfcff; border-radius: 18px; padding: 16px; border: 1px solid rgba(76,93,249,0.08); }
        ul.research-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 18px; }
        ul.research-list li { background: #fdfcff; border-radius: 18px; padding: 18px; border: 1px solid rgba(76,93,249,0.12); }
        .generator-card { position: relative; overflow: hidden; }
        .generator-card::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(76,93,249,0.08), transparent); pointer-events: none; }
        form label { display: block; font-weight: 600; margin-top: 20px; color: #374151; }
        input, textarea { width: 100%; padding: 16px; border-radius: 16px; border: 2px solid #e0e7ff; margin-top: 8px; font-size: 16px; transition: border 0.2s; outline: none; background: #fdfdff; }
        input:focus, textarea:focus { border-color: #4c5df9; }
        textarea { min-height: 110px; resize: vertical; }
        button.generate { width: 100%; padding: 16px; margin-top: 28px; background: linear-gradient(135deg,#7c3aed,#4c5df9); color: white; border: none; border-radius: 16px; font-size: 18px; font-weight: 600; cursor: pointer; box-shadow: 0 15px 40px rgba(76,93,249,0.35); }
        .progress-wrapper { display: none; width: 100%; height: 12px; background: #e0e7ff; border-radius: 999px; overflow: hidden; margin-top: 20px; }
        .progress-bar { height: 100%; width: 0%; background: linear-gradient(90deg, #7c3aed, #4c5df9); transition: width 0.3s ease; }
        #status { margin-top: 16px; text-align: center; color: #4b5563; font-weight: 500; min-height: 24px; }
        .result { margin-top: 25px; text-align: center; }
        .result a { display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 999px; font-weight: 600; margin: 6px; box-shadow: 0 10px 25px rgba(16,185,129,0.4); }
        .mission { text-align: center; background: #111827; color: #f3f4f6; }
        .mission h2 { color: white; margin-top: 0; }
        .site-footer { text-align: center; color: #9ca3af; padding: 30px 10px 50px; font-size: 14px; }
        @media (max-width: 600px) {
            .site-header { flex-direction: column; gap: 10px; }
            nav a { margin-left: 0; margin-right: 14px; }
            .card { padding: 28px; }
        }
    </style>
</head>
<body>
    <header class="site-header">
        <div class="brand"><span class="logo-dot"></span>Social Stories Studio</div>
        <nav>
            <a href="#research">Research</a>
            <a href="#how-it-works">How it works</a>
            <a href="#generator">Generate</a>
        </nav>
    </header>

    <main class="container">
        <section class="card hero" id="hero">
            <div>
                <h1>Stories that rehearse courage.</h1>
                <p>We craft predictable, sensory-aware narratives that help autistic children (and anyone who needs structure) practice real-life moments with calm language, visuals, and caregiver support.</p>
                <ul class="hero-metrics">
                    <li><span></span>Built on Carol Gray Social Stories™ 10.2 criteria</li>
                    <li><span></span>Infused with OT + behavioral research insights</li>
                    <li><span></span>Caregiver coaching baked into every slide</li>
                </ul>
                <div class="hero-buttons">
                    <button id="startButton">Create a Story</button>
                    <button class="secondary" id="researchButton">See Research & Reviews</button>
                </div>
            </div>
            <div class="hero-panel">
                <h3>Mission in progress</h3>
                <p>We are building this as a future nonprofit resource so every educator, therapist, and family can deliver evidence-aligned social stories without high costs.</p>
                <p style="margin-bottom:0; opacity:0.85;">Current goals: expand templates, add multilingual voices, and sponsor free printing packs.</p>
            </div>
        </section>

        <section class="card section" id="how-it-works">
            <h2 class="section-title">How it works</h2>
            <p class="section-sub">Three quick steps to create a therapeutic story with sensory prep, coping scripts, and cooperative caregiver notes.</p>
            <div class="steps-grid">
                <div class="step">
                    <span class="step-number">01 · Choose scenario</span>
                    <p>Pick a routine (dentist, haircut, fire drill) or describe a custom moment. Templates kick in instantly when available.</p>
                </div>
                <div class="step">
                    <span class="step-number">02 · Personalize child</span>
                    <p>Add age, interests, and sensory notes. The story mirrors their voice with first-person, literal sentences.</p>
                </div>
                <div class="step">
                    <span class="step-number">03 · Share & rehearse</span>
                    <p>Download the slideshow + narration, review caregiver tips, and practice before the real event.</p>
                </div>
            </div>
        </section>

        <section class="card" id="research">
            <h2 class="section-title">📚 Research & Reviews</h2>
            <p class="section-sub">Each template references open-access studies on Social Stories™, ensuring the structure stays therapeutic and respectful.</p>
            <ul class="research-list">
                <li>
                    <strong>A scoping review: Social Stories supporting behavior change (2023)</strong><br>
                    J Occup Ther Sch Early Interv – 56 studies grouped by reducing disruptive vs increasing desired behaviors, highlighting sensory previews + coping rehearsal.
                    <br><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11263915/" target="_blank">Read summary →</a>
                </li>
                <li>
                    <strong>ASSSIST-2 RCT: Social Stories™ in UK schools (2024)</strong><br>
                    Health Technol Assess – pragmatic trial on social responsiveness, anxiety, and cost-effectiveness when teachers co-author stories.
                    <br><a href="https://www.ncbi.nlm.nih.gov/books/NBK606433/" target="_blank">Read summary →</a>
                </li>
                <li>
                    <strong>Systematic review protocol of Social Stories RCTs (2020)</strong><br>
                    Medicine (Baltimore) – outlines inclusion criteria, moderators, and outcome measures for future meta-analyses.
                    <br><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC7489673/" target="_blank">Read summary →</a>
                </li>
                <li>
                    <strong>Social Story research scoping study (2021)</strong><br>
                    Review Journal of Autism & Developmental Disorders – synthesizes 17 literature reviews on sentence ratios, cooperative statements, and fidelity.
                    <br><a href="https://link.springer.com/article/10.1007/s40489-020-00235-6" target="_blank">Read summary →</a>
                </li>
                <li>
                    <strong>Graduate thesis: Social Stories as behavior intervention (2022)</strong><br>
                    St. Cloud State University – 13 case studies covering dentist visits, haircuts, and transitions with measurable outcomes.
                    <br><a href="https://repository.stcloudstate.edu/sped_etds/155/" target="_blank">Read summary →</a>
                </li>
            </ul>
        </section>

        <section class="card generator-card" id="generator">
            <h2 class="section-title">✨ Generate a new story</h2>
            <p class="section-sub">Your inputs stay local. Scenarios with curated templates render instantly; others use GPT-4o-mini with caching.</p>
            <form id="storyForm">
                <label>Scenario</label>
                <input type="text" name="scenario" placeholder="e.g., Dentist appointment, Fire drill, Visiting grandparents" required />

                <label>Describe the child</label>
                <textarea name="child" placeholder="Name, age, interests, sensory notes (e.g., Sam, 6, loves rockets, sensitive to loud buzzers)" required></textarea>

                <button type="submit" class="generate">Generate story 🪄</button>
                <div class="progress-wrapper" id="progressWrapper">
                    <div class="progress-bar" id="progressBar"></div>
                </div>
                <div id="status"></div>
                <div class="result" id="result"></div>
            </form>
        </section>

        <section class="card mission">
            <h2>Nonprofit roadmap</h2>
            <p>We’re exploring sponsorships so educators and families can use this library free forever. Short-term, paid plans may support hosting, voice models, and multilingual illustrators while we pursue 501(c)(3) status.</p>
        </section>
    </main>

    <footer class="site-footer">
        Social Stories Studio · Research-aligned narratives for neurodivergent brilliance.
    </footer>

    <script>
        const form = document.getElementById('storyForm');
        const statusEl = document.getElementById('status');
        const resultEl = document.getElementById('result');
        const progressWrapper = document.getElementById('progressWrapper');
        const progressBar = document.getElementById('progressBar');
        const generatorCard = document.getElementById('generator');
        const startButton = document.getElementById('startButton');
        const researchCard = document.getElementById('research');
        const researchButton = document.getElementById('researchButton');
        let progressInterval = null;

        function smoothScroll(target) {
            if (!target) return;
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        if (startButton && generatorCard) {
            startButton.addEventListener('click', (e) => {
                e.preventDefault();
                smoothScroll(generatorCard);
            });
        }

        if (researchButton && researchCard) {
            researchButton.addEventListener('click', (e) => {
                e.preventDefault();
                smoothScroll(researchCard);
            });
        }

        let progressBarTimeout;

        function startProgress() {
            progressWrapper.style.display = 'block';
            progressBar.style.width = '0%';
            progressBar.style.background = 'linear-gradient(90deg, #7c3aed, #4c5df9)';
            let progress = 0;
            clearInterval(progressInterval);
            progressInterval = setInterval(() => {
                if (progress < 90) {
                    progress += Math.random() * 6 + 2;
                    progressBar.style.width = Math.min(progress, 90) + '%';
                }
            }, 400);
        }

        function finishProgress() {
            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            clearTimeout(progressBarTimeout);
            progressBarTimeout = setTimeout(() => {
                progressWrapper.style.display = 'none';
            }, 600);
        }

        function failProgress() {
            clearInterval(progressInterval);
            progressBar.style.background = '#f87171';
            progressBar.style.width = '100%';
            clearTimeout(progressBarTimeout);
            progressBarTimeout = setTimeout(() => {
                progressWrapper.style.display = 'none';
                progressBar.style.background = 'linear-gradient(90deg, #7c3aed, #4c5df9)';
            }, 800);
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            statusEl.textContent = 'Generating story...';
            resultEl.innerHTML = '';
            startProgress();

            const formData = new FormData(form);
            const payload = {
                scenario: formData.get('scenario'),
                child: formData.get('child')
            };

            try {
                const res = await fetch('/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (!data.success) throw new Error(data.error || 'Unknown error');

                statusEl.textContent = 'Story ready!';
                finishProgress();
                resultEl.innerHTML = '' +
                    '<p><a href="' + data.url + '" target="_blank">Open story slideshow</a></p>' +
                    (data.audio ? '<p><a href="' + data.audio + '" target="_blank">Download narration audio</a></p>' : '');
            } catch (err) {
                statusEl.textContent = 'Failed: ' + err.message;
                failProgress();
            }
        });
    </script>
</body>
</html>`;

app.get('/', (req, res) => {
    res.send(formHtml);
});

app.post('/generate', async (req, res) => {
    const { scenario, child } = req.body;
    if (!scenario || !child) {
        return res.json({ success: false, error: 'Scenario and child description required.' });
    }

    try {
        const { htmlFile, audioFile } = await generateStoryAssets(scenario, child);
        res.json({
            success: true,
            url: `/stories/${htmlFile}`,
            audio: audioFile ? `/stories/${audioFile}` : null
        });
    } catch (error) {
        console.error('Generation error:', error);
        res.json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Social Story server running at http://localhost:${PORT}`);
});
