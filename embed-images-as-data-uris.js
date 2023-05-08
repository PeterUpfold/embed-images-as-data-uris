/*
 * embed-images-as-data-uris
 *
 * As part of an article-to-offline-ePub workflow, take referenced images in an HTML document, download them and embed them as data: URI resources.
 * 
 */

/*
 I'm not an experienced Node developer, so I may have used some dangerous OpenAI-related
 suggestions to make this work. Corrections and improvements are most welcome via GitHub Issues.

 As the LICENSE file makes clear, there is no warranty nor any suggestion of quality. This
 is an internal tool used in an isolated environment.
*/

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// does this assume argv[1] is "node"? Would it always be? Hmmm... 
const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
    console.error(`Usage: ${process.argv[0]} ${process.argv[1]} <input-file> <output-file>`);
    process.exit(1);
}

async function downloadAndEmbedImages(html) {
    const matches = html.match(/<img.+?src="(.+?)".*?>/g) || [];
    const promises = matches.map(async (match) => {
        const src = match.match(/<img.+?src="(.+?)".*?>/)[1]; // second capture group
        let response;
        console.log(`To download ${src}`);
        try {
            response = await axios.get(src, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:112.0) Gecko/20100101 Firefox/112.0'
                }
            });
        }
        catch (error) {
            console.error(`Error downloading ${src}: ${error}`);
            process.exit(2);
        }
        const mimeType = response.headers['content-type']; // TODO: security -- trusting server provided mimetype
        const mimeTypeSani = mimeType.replace(/[^-+*.a-zA-Z0-9\/]/g, '');
        
        // response.data is already a Buffer, so just toString('base64') it

        console.log(`Downloaded ${src} with apparent mimetype ${mimeTypeSani}`);
        console.log(`Will replace ${src} with the data:${mimeTypeSani};base64,${response.data.toString('base64').substring(0, 20)}...`);
        return match.replace(src, `data:${mimeTypeSani};base64,${response.data.toString('base64')}`);
    });

    const updatedMatches = await Promise.all(promises);
    let updatedHtml = html;

    for (let i = 0; i < matches.length; i++) {
        updatedHtml = updatedHtml.replace(matches[i], updatedMatches[i]);
    }    
    return updatedHtml;
}

async function main() {
    const html = fs.readFileSync(inputFile, 'utf8');
    console.log(`Reading in ${inputFile}`);

    const updatedHtml = await downloadAndEmbedImages(html);

    console.log(updatedHtml);

    console.log(`Writing out ${updatedHtml}`);
    fs.writeFileSync(outputFile, updatedHtml, 'utf8');
}

main();