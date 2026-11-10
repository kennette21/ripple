import { rotatedPhotoSize, type PhotoCrop, type PhotoRotation } from './photoEditingGeometry';

export type PhotoFraming = 'fit' | 'fill' | 'crop';
export interface PhotoCanvasLayout extends Record<string, number> {
  scale: number;
  imageLeft: number;
  imageTop: number;
  frameLeft: number;
  frameTop: number;
  frameWidth: number;
  frameHeight: number;
}
export const PHOTO_EDGE_INSET = 20;
export const MAX_PHOTO_ZOOM = 8;
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function fullPhotoCrop(width: number, height: number, rotation: PhotoRotation): PhotoCrop {
  const size = rotatedPhotoSize(width, height, rotation);
  return { originX: 0, originY: 0, ...size };
}

export function squarePhotoCrop(crop: PhotoCrop): PhotoCrop {
  const side = Math.min(crop.width, crop.height);
  return {
    originX: crop.originX + (crop.width - side) / 2,
    originY: crop.originY + (crop.height - side) / 2,
    width: side, height: side,
  };
}

export function samePhotoCrop(a: PhotoCrop, b: PhotoCrop) {
  return Math.abs(a.originX - b.originX) < 1e-4 && Math.abs(a.originY - b.originY) < 1e-4
    && Math.abs(a.width - b.width) < 1e-4 && Math.abs(a.height - b.height) < 1e-4;
}

export function photoCanvasLayout(crop: PhotoCrop, width: number, height: number): PhotoCanvasLayout {
  const scale = Math.min(Math.max(1, width - PHOTO_EDGE_INSET * 2) / crop.width,
    Math.max(1, height - PHOTO_EDGE_INSET * 2) / crop.height);
  const frameWidth = crop.width * scale;
  const frameHeight = crop.height * scale;
  const frameLeft = (width - frameWidth) / 2;
  const frameTop = (height - frameHeight) / 2;
  return {
    scale, frameLeft, frameTop, frameWidth, frameHeight,
    imageLeft: frameLeft - crop.originX * scale,
    imageTop: frameTop - crop.originY * scale,
  };
}

// Keep the frame stationary while moving or zooming the image behind it.
export function imageBehindFrame(crop: PhotoCrop, frame: PhotoCanvasLayout): PhotoCanvasLayout {
  const scale = frame.frameWidth / crop.width;
  return { ...frame, scale, imageLeft: frame.frameLeft - crop.originX * scale, imageTop: frame.frameTop - crop.originY * scale };
}

export function panPhotoCrop(crop: PhotoCrop, dx: number, dy: number, scale: number, width: number, height: number): PhotoCrop {
  return {
    ...crop, originX: clamp(crop.originX - dx / scale, 0, width - crop.width),
    originY: clamp(crop.originY - dy / scale, 0, height - crop.height),
  };
}

export function photoCropZoom(crop: PhotoCrop, width: number, height: number) {
  return Math.min(width / crop.width, height / crop.height);
}

export function zoomPhotoCrop(crop: PhotoCrop, width: number, height: number, zoom: number, focalX = .5, focalY = .5): PhotoCrop {
  const maxScale = Math.min(width / crop.width, height / crop.height);
  const factor = maxScale / Math.max(1, zoom);
  const nextWidth = crop.width * factor;
  const nextHeight = crop.height * factor;
  return {
    originX: clamp(crop.originX + crop.width * focalX - nextWidth * focalX, 0, width - nextWidth),
    originY: clamp(crop.originY + crop.height * focalY - nextHeight * focalY, 0, height - nextHeight),
    width: nextWidth, height: nextHeight,
  };
}

export type CropCorner = 'nw' | 'ne' | 'sw' | 'se';
export function resizePhotoCrop(crop: PhotoCrop, corner: CropCorner, dx: number, dy: number,
  view: PhotoCanvasLayout, sourceWidth: number, sourceHeight: number, stageWidth: number, stageHeight: number): PhotoCrop {
  const minimumWidth = Math.min(64 / view.scale, crop.width);
  const minimumHeight = Math.min(64 / view.scale, crop.height);
  const minX = Math.max(0, (PHOTO_EDGE_INSET - view.imageLeft) / view.scale);
  const minY = Math.max(0, (PHOTO_EDGE_INSET - view.imageTop) / view.scale);
  const maxX = Math.min(sourceWidth, (stageWidth - PHOTO_EDGE_INSET - view.imageLeft) / view.scale);
  const maxY = Math.min(sourceHeight, (stageHeight - PHOTO_EDGE_INSET - view.imageTop) / view.scale);
  let left = crop.originX, top = crop.originY, right = left + crop.width, bottom = top + crop.height;
  if (corner.includes('w')) left = clamp(left + dx / view.scale, minX, right - minimumWidth);
  else right = clamp(right + dx / view.scale, left + minimumWidth, maxX);
  if (corner.includes('n')) top = clamp(top + dy / view.scale, minY, bottom - minimumHeight);
  else bottom = clamp(bottom + dy / view.scale, top + minimumHeight, maxY);
  return { originX: left, originY: top, width: right - left, height: bottom - top };
}

export function frameOnImage(crop: PhotoCrop, image: PhotoCanvasLayout): PhotoCanvasLayout {
  return { ...image, frameLeft: image.imageLeft + crop.originX * image.scale,
    frameTop: image.imageTop + crop.originY * image.scale, frameWidth: crop.width * image.scale, frameHeight: crop.height * image.scale };
}
