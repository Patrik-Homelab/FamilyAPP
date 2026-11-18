import { getCookieData } from '$/lib/server/functions';
import { conn } from '$/lib/server/variables';
import { FILE_FOLDER } from '$env/static/private';
import { error, type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs';
import { default as Path, default as path } from 'node:path';
import sharp from 'sharp';

export type ImageExtension = 'jpg' | 'jpeg' | 'png' | 'webp' | 'tiff';
const extensions = ['jpg', 'jpeg', 'png', 'webp', 'tiff'] satisfies ImageExtension[];

export const GET = (async ({ params, setHeaders, url, cookies }) => {
    const userState = getCookieData(cookies);
    if (!userState.logged) {
        error(401, 'Unauthorized');
    }

    if (!params.name) {
        error(400, 'Name is required');
    }

    const familyId = userState.data.family_id;
    const [inDebt, inPresent, inShopping] = await Promise.all([
        conn
            .selectFrom('debt')
            .select('id')
            .where('family_id', '=', familyId)
            .where('photo', '=', params.name)
            .executeTakeFirst(),
        conn
            .selectFrom('present')
            .select('id')
            .where('family_id', '=', familyId)
            .where('image', '=', params.name)
            .executeTakeFirst(),
        conn
            .selectFrom('shoppinglist')
            .select('id')
            .where('family_id', '=', familyId)
            .where('image', '=', params.name)
            .executeTakeFirst()
    ]);

    if (!inDebt && !inPresent && !inShopping) {
        error(404, 'File not found');
    }

    const parsed = Path.parse(params.name);
    if (!extensions.includes(parsed.ext.substring(1) as ImageExtension)) {
        error(404, 'File not found');
    }

    if (!fs.existsSync(FILE_FOLDER)) {
        error(404, 'File not found');
    }

    let filePath = Path.join(FILE_FOLDER, params.name);

    if (!fs.existsSync(filePath)) {
        error(404, 'File not found');
    }

    let content = fs.readFileSync(filePath);

    const searchParams = url.searchParams;
    let fileExtension = path.extname(filePath).substring(1);
    let modified = false;
    let scale = 100;

    if (searchParams.has('format')) {
        const format = searchParams.get('format')!;
        if (!extensions.includes(format as ImageExtension)) {
            throw error(400, 'Bad request');
        }

        fileExtension = format;
        modified = true;
    }

    if (searchParams.has('scale')) {
        const downscale = searchParams.get('scale')!;
        try {
            const downScale = parseInt(downscale);
            if (downScale > 100 || downScale < 0) {
                throw error(400, 'Bad request');
            }

            modified = true;
            scale = downScale;
            //eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
            throw error(400, 'Bad request');
        }
    }

    if (modified) {
        if (!fs.existsSync('.cache')) {
            fs.mkdirSync('.cache');
        }

        const cacheModifiedName = `${path.basename(params.name)}.scale-${scale}.${fileExtension}`;
        const cachePath = Path.join('.cache', cacheModifiedName);

        if (!fs.existsSync(cachePath)) {
            let image = sharp(content);

            const imageOptions: sharp.JpegOptions &
                sharp.PngOptions &
                sharp.WebpOptions &
                sharp.TiffOptions = {
                quality: 75
            };

            switch (fileExtension) {
                case 'jpeg':
                case 'jpg':
                    image = image.jpeg(imageOptions);
                    break;
                case 'png':
                    image = image.png(imageOptions);
                    break;
                case 'webp':
                    image = image.webp(imageOptions);
                    break;
                case 'tiff':
                    image = image.tiff(imageOptions);
                    break;
            }

            const meta = await image.metadata();

            const newWidth = meta.width
                ? Math.round(meta.width * (scale / 100))
                : undefined;
            const newHeight = meta.height
                ? Math.round(meta.height * (scale / 100))
                : undefined;

            image = image.resize(newWidth, newHeight);

            const imageBuffer = await image.toBuffer();
            fs.writeFileSync(cachePath, imageBuffer);
        }

        content = fs.readFileSync(cachePath);
        filePath = cachePath;
    }
    const fileInfo = fs.statSync(filePath);

    setHeaders({
        'Content-Type': `image/${fileExtension.startsWith(',') ? fileExtension.slice(1) : fileExtension}`,
        'Content-Length': fileInfo.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable'
    });

    return new Response(content as BodyInit);
}) satisfies RequestHandler;
