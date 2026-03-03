# Social Stories AI - Project Roadmap

## 1. Executive Summary
A web-based application to generate consistent, therapeutic social stories for autistic children. The app uses AI to generate scripts and images, then assembles them into a "Ken Burns" style slideshow or simple video. Key feature: **Smart Caching** to reduce costs by reusing popular scenarios (e.g., "Dentist").

## 2. Architecture
- **Frontend:** HTML/JS (v1), Next.js (v2)
- **Backend:** Node.js Script (v1), Node.js Server/API (v2)
- **Database:** Local JSON file (v1), Supabase (PostgreSQL) (v2)
- **AI Engine:**
  - **Text:** GPT-4o-mini (Low cost, high speed)
  - **Images:** Flux-schnell via Replicate (Consistent style, fast)
  - **Voice:** OpenAI TTS or ElevenLabs (Optional)

## 3. Data Structure (The "Cache")
We save every generated story to avoid regenerating it.

```json
{
  "id": "dentist-boy-6",
  "scenario": "Going to the Dentist",
  "child_description": "Boy, age 6, blue shirt",
  "slides": [
    {
      "text": "I walk into the dentist office...",
      "image_url": "https://replicate.delivery/...",
      "audio_url": "https://..."
    }
  ]
}
```

## 4. Phase 1: The Local Prototype (Built Now)
We are building a standalone **Generator Tool**.
- **Input:** Scenario name + Child details.
- **Output:** A complete `.html` file that plays the story.
- **Caching:** Checks `local_db.json` before calling AI.
- **Mocking:** Uses placeholder images/text for the demo run (so you can see it work without API keys immediately).

## 5. Phase 2: Production (Next Steps)
1. **Connect Real APIs:** Replace mock functions with actual OpenAI/Replicate calls.
2. **Deploy Database:** Move `local_db.json` to Supabase.
3. **User Accounts:** Allow parents to save *their* specific children (e.g., "Sam").
4. **Voiceover:** Add the TTS step to read the story aloud.
