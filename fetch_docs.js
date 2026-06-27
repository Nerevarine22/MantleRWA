const https = require('https');
const fs = require('fs');

https.get('https://docs.xstocks.fi/apis/openapi', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        // Find JSON objects in the script tags
        const scriptMatch = data.match(/<script[^>]*>window\.pagePath=.*?<\/script>/i) || data.match(/<script id="gatsby-script-loader"[^>]*>(.*?)<\/script>/i) || data.match(/window\.__REDOC_STATE__\s*=\s*(.*?);/i);
        
        if (scriptMatch) {
            fs.writeFileSync('docs_parsed.txt', scriptMatch[0] || scriptMatch[1]);
        } else {
            // let's just write the whole thing and search it via regex
            fs.writeFileSync('docs_parsed.txt', data);
        }
        
        // Let's try to extract OpenAPI JSON from the HTML
        const openApiMatch = data.match(/{"openapi":"3.*?}}/);
        if (openApiMatch) {
            fs.writeFileSync('openapi.json', openApiMatch[0]);
            console.log("Found OpenAPI spec!");
        } else {
            console.log("Could not find OpenAPI spec string.");
            
            // Try to find the webpack chunk that contains the API paths
            const pathsMatch = data.match(/"paths":\{([^}]+)\}/g);
            if (pathsMatch) {
                fs.writeFileSync('paths.json', pathsMatch.join('\n'));
                console.log("Found paths!");
            }
        }
    });
}).on('error', err => console.error(err));
