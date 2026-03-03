const { generateStoryAssets } = require('./generator');

(async () => {
    const scenario = process.argv[2] || "Going to the Dentist";
    const childDesc = process.argv[3] || "Sam, a 6 year old boy";

    console.log(`🚀 Starting Social Story Generator (CLI)`);
    console.log(`   Scenario: ${scenario}`);
    console.log(`   Child: ${childDesc}`);

    try {
        const { htmlFile, audioFile } = await generateStoryAssets(scenario, childDesc);
        console.log(`\n✨ DONE! Story generated successfully.`);
        console.log(`📄 HTML: output/${htmlFile}`);
        if (audioFile) console.log(`🔊 Audio: output/${audioFile}`);
    } catch (error) {
        console.error("❌ Failed to generate story:", error.message);
    }
})();
