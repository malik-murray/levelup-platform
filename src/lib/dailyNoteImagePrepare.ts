import { MAX_DAILY_NOTE_IMAGE_BYTES } from '@/lib/dailyNoteImages';

const TARGET_MAX_BYTES = 4.75 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1920;

function scaledDimensions(width: number, height: number, maxDimension: number) {
    if (width <= maxDimension && height <= maxDimension) {
        return { width, height };
    }
    const scale = maxDimension / Math.max(width, height);
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Unable to read image'));
        };
        image.src = url;
    });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Failed to compress image'));
            },
            mime,
            quality
        );
    });
}

/** Resize/compress large photos (common on mobile) to fit storage limits. */
export async function prepareDailyNoteImageForUpload(
    file: File | Blob
): Promise<{ blob: Blob; mime: string } | { error: string }> {
    const inputType = file.type || '';

    if (inputType && !inputType.startsWith('image/')) {
        return { error: 'Image must be JPEG, PNG, GIF, or WebP' };
    }

    if (inputType === 'image/gif') {
        if (file.size <= MAX_DAILY_NOTE_IMAGE_BYTES) {
            return { blob: file, mime: 'image/gif' };
        }
        return { error: 'GIF must be under 5MB' };
    }

    if (file.size <= MAX_DAILY_NOTE_IMAGE_BYTES) {
        return { blob: file, mime: inputType || 'image/jpeg' };
    }

    try {
        const image = await loadImageFromFile(file);
        const baseDimensions = scaledDimensions(image.naturalWidth, image.naturalHeight, MAX_IMAGE_DIMENSION);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
            return { error: 'Unable to process image' };
        }

        const outputMime = 'image/jpeg';
        let bestBlob: Blob | null = null;

        for (let dimensionScale = 1; dimensionScale >= 0.45; dimensionScale -= 0.15) {
            canvas.width = Math.max(1, Math.round(baseDimensions.width * dimensionScale));
            canvas.height = Math.max(1, Math.round(baseDimensions.height * dimensionScale));
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            for (let quality = 0.88; quality >= 0.55; quality -= 0.08) {
                const blob = await canvasToBlob(canvas, outputMime, quality);
                bestBlob = blob;
                if (blob.size <= TARGET_MAX_BYTES) {
                    return { blob, mime: outputMime };
                }
            }
        }

        if (bestBlob && bestBlob.size <= MAX_DAILY_NOTE_IMAGE_BYTES) {
            return { blob: bestBlob, mime: outputMime };
        }

        return { error: 'Image is too large even after compression. Try a smaller photo.' };
    } catch {
        return { error: 'Unable to read image. Try JPEG or PNG.' };
    }
}
