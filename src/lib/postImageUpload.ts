import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';

// Leave a little headroom below Supabase's configured 5 MB object limit.
const MAX_POST_IMAGE_BYTES = 4_900_000;
const JPEG_QUALITY_STEPS = [0.82, 0.72, 0.62, 0.5, 0.4, 0.3, 0.2];
const MAX_PREPARATION_CONCURRENCY = 3;

const preparationCache = new Map<string, Promise<PreparedPostImage>>();
const preparationQueue: (() => void)[] = [];
let activePreparations = 0;

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

function getFileSize(uri: string): number {
  return new File(uri).size;
}

function getPreparationKey({
  uri,
  width,
  height,
  alreadyJpeg = false,
}: PreparePostImageOptions): string {
  return `${uri}:${width}x${height}:${alreadyJpeg ? 'jpeg' : 'source'}`;
}

function deleteGeneratedFile(uri: string) {
  try {
    const file = new File(uri);
    if (!file.exists) return;

    file.delete();
  } catch {}
}

async function acquirePreparationSlot(): Promise<void> {
  if (activePreparations < MAX_PREPARATION_CONCURRENCY) {
    activePreparations += 1;
    return;
  }

  await new Promise<void>((resolve) => preparationQueue.push(resolve));
}

function releasePreparationSlot() {
  const next = preparationQueue.shift();
  if (next) {
    next();
    return;
  }

  activePreparations -= 1;
}

async function withPreparationSlot<T>(task: () => Promise<T>): Promise<T> {
  await acquirePreparationSlot();

  try {
    return await task();
  } finally {
    releasePreparationSlot();
  }
}

async function preparePostImageFile({
  uri,
  width,
  height,
  alreadyJpeg = false,
}: PreparePostImageOptions): Promise<PreparedPostImage> {
  if (alreadyJpeg) {
    const size = getFileSize(uri);
    if (size <= MAX_POST_IMAGE_BYTES) {
      return { uri, width, height };
    }
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
        const size = getFileSize(result.uri);

        if (size <= MAX_POST_IMAGE_BYTES) {
          return {
            uri: result.uri,
            width: result.width,
            height: result.height,
          };
        }

        deleteGeneratedFile(result.uri);
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

export function preparePostImage(
  options: PreparePostImageOptions
): Promise<PreparedPostImage> {
  const key = getPreparationKey(options);
  const existingPreparation = preparationCache.get(key);

  if (existingPreparation) {
    return existingPreparation;
  }

  const preparation = withPreparationSlot(() =>
    preparePostImageFile(options)
  );
  preparationCache.set(key, preparation);

  void preparation.catch(() => {
    if (preparationCache.get(key) === preparation) {
      preparationCache.delete(key);
    }
  });

  return preparation;
}

export function clearPostImagePreparation(
  options: PreparePostImageOptions
) {
  const key = getPreparationKey(options);
  const preparation = preparationCache.get(key);
  preparationCache.delete(key);

  if (!preparation) {
    if (options.alreadyJpeg) {
      deleteGeneratedFile(options.uri);
    }
    return;
  }

  void preparation
    .then((result) => {
      deleteGeneratedFile(result.uri);
      if (options.alreadyJpeg && options.uri !== result.uri) {
        deleteGeneratedFile(options.uri);
      }
    })
    .catch(() => {
      if (options.alreadyJpeg) {
        deleteGeneratedFile(options.uri);
      }
    });
}
