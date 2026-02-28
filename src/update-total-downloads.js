// Adapted from https://github.com/pmxt-dev/pmxt/blob/b54b601cbac48412dfa41c7f497f4863558ffbc9/.github/scripts/update-total-downloads.js

const fs = require('fs');
const https = require('https');
const path = require('path');

const PACKAGES = [
    { type: 'pypi', name: 'pmxt' },
    { type: 'npm', name: 'pmxtjs' },
    { type: 'npm', name: 'pmxt-core' }
];

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function getNpmDownloads(pkg) {
    const start = '2020-01-01'; // Project start roughly
    const end = new Date().toISOString().split('T')[0];
    const url = `https://api.npmjs.org/downloads/range/${start}:${end}/${pkg}`;
    try {
        const data = await fetchJson(url);
        if (data.downloads && Array.isArray(data.downloads)) {
            return data.downloads.reduce((acc, day) => acc + day.downloads, 0);
        }
        return 0;
    } catch (e) {
        console.warn(`Warning: Could not fetch NPM stats for ${pkg} (might be new or network issue).`);
        return 0;
    }
}

async function getPypiDownloads(pkg) {
    const url = `https://api.pepy.tech/api/v2/projects/${pkg}`;
    const apiKey = process.env.PEPY_API_KEY || "nlHlcqUpfoS/jEh5caGqp7+5UyadCCTR";

    if (!apiKey) {
        console.warn('Warning: PEPY_API_KEY not found. PyPI stats might fail.');
    }

    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'X-API-Key': apiKey
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    console.warn(`Warning: PyPI stats for ${pkg} returned status ${res.statusCode}`);
                    resolve(0);
                    return;
                }
                try {
                    const json = JSON.parse(data);
                    resolve(json.total_downloads || 0);
                } catch (e) {
                    resolve(0);
                }
            });
        }).on('error', (e) => {
            console.error(`Error fetching PyPI stats for ${pkg}:`, e.message);
            resolve(0);
        });
    });
}

async function main() {
    let total = 0;
    console.log('Fetching download stats...');

    for (const pkg of PACKAGES) {
        let count = 0;
        if (pkg.type === 'npm') {
            count = await getNpmDownloads(pkg.name);
        } else if (pkg.type === 'pypi') {
            count = await getPypiDownloads(pkg.name);
        }
        console.log(`${pkg.name}: ${count}`);
        total += count;
    }

    console.log(`Total Downloads: ${total}`);

    // Format number (e.g. 1.2k, 1.5M, 20.4k)
    const formatNumber = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num.toString();
    };

    const formattedTotal = formatNumber(total);
    // Using a custom shield style
    const badgeUrl = `https://img.shields.io/badge/downloads-${formattedTotal}-blue`;

    const badgePath = path.join(__dirname, '../docs/badges/total-downloads.svg');
    fs.mkdirSync(path.dirname(badgePath), { recursive: true });
    https.get(badgeUrl, (res) => {
        const file = fs.createWriteStream(badgePath);
        res.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log(`Badge downloaded successfully to ${badgePath}`);
        });
    }).on('error', (e) => {
        console.error(`Error downloading badge:`, e.message);
        process.exit(1);
    });
}

main();
