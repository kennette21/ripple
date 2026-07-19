import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Leave a little headroom below Supabase's configured 5 MB object limit.
const MAX_POST_IMAGE_BYTES = 4_900_000;
const JPEG_QUALITY_STEPS = [0.82, 0.72, 0.62, 0.5, 0.4, 0.3, 0.2];

interface PreparePostImageOptions {
  uri: string;
  width: number;
  height: number;
  alreadyJpeg?: boolean;
}

export interface PreparedPostImage {
  uri: string;
  width: number;
  height: number;
}

async function getFileSize(uri: string): Promise<number> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return blob.size;
}

export async function preparePostImage({
  uri,
  width,
  height,
  alreadyJpeg = false,
}: PreparePostImageOptions): Promise<PreparedPostImage> {
  if (alreadyJpeg && (await getFileSize(uri)) <= MAX_POST_IMAGE_BYTES) {
    return { uri, width, height };
  }

  const context = ImageManipulator.manipulate(uri);

  try {
    const renderedImage = await context.renderAsync();

    try {
      for (const compress of JPEG_QUALITY_STEPS) {
        const result = await renderedImage.saveAsync({
          compress,
          format: SaveFormat.JPEG,
        });

        if ((await getFileSize(result.uri)) <= MAX_POST_IMAGE_BYTES) {
          return {
            uri: result.uri,
            width: result.width,
            height: result.height,
          };
        }
      }
    } finally {
      renderedImage.release();
    }
  } finally {
    context.release();
  }

  throw new Error(
    'One of your photos is too large to upload. Try cropping it and post again.'
  );
}
