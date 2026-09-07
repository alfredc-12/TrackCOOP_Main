const fs = require('fs');
const text = fs.readFileSync('C:/Users/Pierre Edriz/.gemini/antigravity-ide/brain/af530640-5bbb-4315-8300-24163ba62d23/.system_generated/logs/transcript_full.jsonl', 'utf8');
let fileLines = new Map();
const jsonLines = text.split('\n');
for (const jl of jsonLines) {
    if (!jl) continue;
    try {
        const obj = JSON.parse(jl);
        let contentStr = '';
        if (obj.type === 'SYSTEM_RESPONSE' && obj.content) contentStr = obj.content;
        else if (obj.tool_calls && obj.tool_calls.length > 0 && obj.tool_calls[0].args && obj.tool_calls[0].args.ReplacementContent) {
            // Also grab from replace_file_content calls
        }
        
        if (contentStr) {
            const lines = contentStr.split('\n');
            let isCapturing = false;
            for (const line of lines) {
                if (line.includes('The following code has been modified to include a line number before every line')) {
                    isCapturing = true;
                    continue;
                }
                if (isCapturing) {
                    if (line.includes('The above content does NOT show the entire file contents')) {
                        isCapturing = false;
                        continue;
                    }
                    const match = line.match(/^(\d+):\s?(.*)$/);
                    if (match) {
                        fileLines.set(parseInt(match[1]), match[2].replace(/\r$/, ''));
                    }
                }
            }
        }
    } catch(e) {}
}
console.log('Recovered lines:', fileLines.size);
if (fileLines.size > 0) {
    const maxLine = Math.max(...Array.from(fileLines.keys()));
    const out = [];
    for (let i = 1; i <= maxLine; i++) {
        out.push(fileLines.has(i) ? fileLines.get(i) : '// MISSING LINE ' + i);
    }
    fs.writeFileSync('recovered_view.tsx', out.join('\n'));
}
