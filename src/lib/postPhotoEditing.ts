import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { SelectedPostPhoto } from '@/types/postPhoto';

// Fill frame is an intentional square crop, saved as the posted image so that
// the grid, feed, and fullscreen viewer all use the author's chosen composition.
export async function fillPostPhotoFrame(photo: SelectedPostPhoto): Promise<SelectedPostPhoto> {
  const side = Math.min(photo.width, photo.height);
  if (photo.width === photo.height) return photo;

  const context = ImageManipulator.manipulate(photo.uri);
  try {
    context.crop({
      originX: Math.floor((photo.width - side) / 2),
      originY: Math.floor((photo.height - side) / 2),
      width: side,
      height: side,
    });
    const rendered = await context.renderAsync();
    try {
      const result = await rendered.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
      return { ...photo, uri: result.uri, width: result.width, height: result.height, isCropped: true };
    } finally {
      rendered.release();
    }
  } finally {
    context.release();
  }
}
