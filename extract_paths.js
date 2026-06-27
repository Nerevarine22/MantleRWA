const fs = require('fs');
const html = fs.readFileSync('docs_parsed.txt', 'utf8');

const regex = /"(\/[a-zA-Z0-9_/-]+)"/g;
const matches = html.match(regex);
if (matches) {
    const uniquePaths = [...new Set(matches)];
    fs.writeFileSync('paths.txt', uniquePaths.join('\n'));
    console.log("Wrote " + uniquePaths.length + " paths to paths.txt");
}
