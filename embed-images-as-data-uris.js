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
const cheerio = require('cheerio');

// does this assume argv[1] is "node"? Would it always be? Hmmm... 
const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
    console.error(`Usage: ${process.argv[0]} ${process.argv[1]} <input-file> <output-file>`);
    process.exit(1);
}

async function downloadAndEmbedImages(html) {
    const parsed = cheerio.load(html);
    const matches = html.match(/<img.+?src="(.+?)".*?>/g) || [];
    const promises = parsed('img').map(async (i, match) => {
        const src = (new URL(parsed(match).attr('src'))).href;

        if (src.startsWith('data:')) {
            // no action required
            return;
        }

        // sleep a random amount of time to reduce load
        const sleepLength = Math.random() * 1000 * Math.min(20, matches.length);
        console.log(`Sleep task for ${src} for ${sleepLength}ms`);

        await new Promise(resolve => setTimeout(resolve, sleepLength));


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
        //console.log(`Will replace ${src} with the data:${mimeTypeSani};base64,${response.data.toString('base64').substring(0, 20)}...`);
        parsed(match).attr('src', `data:${mimeTypeSani};base64,${response.data.toString('base64')}`);
        parsed(match).removeAttr('srcSet'); // additional attributes cause crashes on the Sony??
        parsed(match).removeAttr('srcset');
        parsed(match).removeAttr('sizes'); 

        // get all data- attrs. They are useless to me. Cast them out!
        const dataAttribsToRemove = [];
        for (const attr in match.attribs) { // odd syntax here where we can just pass the node and not send it back through Cheerio
            if (attr.startsWith('data-')) {
                dataAttribsToRemove.push(attr);
            }
        }
        dataAttribsToRemove.forEach(attr => {
            parsed(match).removeAttr(attr);
        })

    });

    await Promise.all(promises);
    return parsed.html();
}

async function main() {
    const html = fs.readFileSync(inputFile, 'utf8');
    console.log(`Reading in ${inputFile}`);

    const updatedHtml = await downloadAndEmbedImages(html);

    console.log(`Writing out ${outputFile}`);
    fs.writeFileSync(outputFile, updatedHtml, 'utf8');
}

main();