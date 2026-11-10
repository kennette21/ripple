export type PhotoRotation = 0 | 90 | 180 | 270;
export interface PhotoCrop {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export function rotatedPhotoSize(width: number, height: number, rotation: PhotoRotation) {
  'worklet';
  return rotation % 180 === 0 ? { width, height } : { width: height, height: width };
}

export function rotatePhotoCrop(crop: PhotoCrop, sourceHeight: number): PhotoCrop {
  'worklet';
  return {
    originX: sourceHeight - crop.originY - crop.height,
    originY: crop.originX,
    width: crop.height,
    height: crop.width,
  };
}

export function pixelPhotoCrop(crop: PhotoCrop, width: number, height: number): PhotoCrop {
  const originX = Math.max(0, Math.min(width - 1, Math.floor(crop.originX + 1e-6)));
  const originY = Math.max(0, Math.min(height - 1, Math.floor(crop.originY + 1e-6)));
  return {
    originX,
    originY,
    width: Math.max(1, Math.min(width, Math.ceil(crop.originX + crop.width - 1e-6)) - originX),
    height: Math.max(1, Math.min(height, Math.ceil(crop.originY + crop.height - 1e-6)) - originY),
  };
}
