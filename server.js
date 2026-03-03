const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const { generateStoryAssets } = require('./generator');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/stories', express.static(path.join(__dirname, 'output')));

const formHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Social Story Generator</title>
    <style>
        body { font-family: sans-serif; background: #eef2ff; display: flex; justify-content: center; align-items: center; height: 100vh; }
        .card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 40px rgba(15,35,95,0.15); width: 500px; }
        h1 { text-align: center; margin-bottom: 30px; }
        label { display: block; font-weight: bold; margin-top: 15px; }
        input, textarea { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #d0d7ff; margin-top: 8px; font-size: 16px; }
        button { width: 100%; padding: 14px; margin-top: 25px; background: #4c5df9; color: white; border: none; border-radius: 10px; font-size: 18px; cursor: pointer; }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
        #status { margin-top: 15px; text-align: center; font-weight: bold; }
        .result { margin-top: 20px; text-align: center; }
        a { color: #4c5df9; font-weight: bold; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Social Story Generator</h1>
        <form id="storyForm">
            <label>Scenario:</label>
            <input type="text" name="scenario" placeholder="Going to the dentist" required />

            <label>Child Description:</label>
            <textarea name="child" placeholder="Sam, age 6, wears glasses" required></textarea>

            <button type="submit">Generate Story</button>
            <div id="status"></div>
            <div class="result" id="result"></div>
        </form>
    </div>

    <script>
        const form = document.getElementById('storyForm');
        const statusEl = document.getElementById('status');
        const resultEl = document.getElementById('result');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            statusEl.textContent = 'Generating story... this can take ~30 seconds';
            resultEl.innerHTML = '';

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
                resultEl.innerHTML = '' +
                    '<p><a href="' + data.url + '" target="_blank">Open story slideshow</a></p>' +
                    (data.audio ? '<p><a href="' + data.audio + '" target="_blank">Download narration audio</a></p>' : '');
            } catch (err) {
                statusEl.textContent = 'Failed: ' + err.message;
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
