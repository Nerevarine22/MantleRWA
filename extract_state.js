const fs = require('fs');

const html = fs.readFileSync('docs_parsed.txt', 'utf8');
const redocMatch = html.match(/__REDOC_STATE__\s*=\s*({.*?});/s);
if (redocMatch) {
    console.log("Found REDOC_STATE");
    fs.writeFileSync('redoc.json', redocMatch[1]);
} else {
    // Just extract anything that looks like an endpoint path
    const pathMatches = html.match(/"\/api\/v2\/[a-zA-Z0-9_/{}-]+"/g);
    if (pathMatches) {
        console.log("Found paths:");
        console.log([...new Set(pathMatches)]);
    } else {
        console.log("No paths found.");
    }
}
