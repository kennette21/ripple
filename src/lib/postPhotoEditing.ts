import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { SelectedPostPhoto } from '@/types/postPhoto';
import { pixelPhotoCrop, rotatedPhotoSize, type PhotoCrop, type PhotoRotation } from './photoEditingGeometry';

// Render the final composition once. Preview rotations and positioning do not
// repeatedly encode the photo, and the original remains available for Reset.
export async function transformPostPhoto(
  photo: SelectedPostPhoto,
  { rotation = 0, crop }: { rotation?: PhotoRotation; crop?: PhotoCrop } = {}
): Promise<SelectedPostPhoto> {
  const size = rotatedPhotoSize(photo.width, photo.height, rotation);
  const bounds = crop ? pixelPhotoCrop(crop, size.width, size.height) : undefined;
  const needsCrop = bounds && (bounds.originX !== 0 || bounds.originY !== 0
    || bounds.width !== size.width || bounds.height !== size.height);
  if (!rotation && !needsCrop) return photo;

  const context = ImageManipulator.manipulate(photo.uri);
  try {
    if (rotation) context.rotate(rotation);
    if (needsCrop) context.crop(bounds);
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

// Fill frame is an intentional square crop, saved as the posted image so that
// the grid, feed, and fullscreen viewer all use the author's chosen composition.
export async function fillPostPhotoFrame(photo: SelectedPostPhoto): Promise<SelectedPostPhoto> {
  const side = Math.min(photo.width, photo.height);
  if (photo.width === photo.height) return photo;

  return transformPostPhoto(photo, { crop: {
      originX: Math.floor((photo.width - side) / 2),
      originY: Math.floor((photo.height - side) / 2),
      width: side,
      height: side,
  } });
}
