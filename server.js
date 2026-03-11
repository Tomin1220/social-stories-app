const express = require('express');
const fs = require('fs');
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
app.use(express.static('public'));
app.get('/', (req, res) => res.sendFile(require('path').join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
    console.log(`Social Story server running at http://localhost:${PORT}`);
});
