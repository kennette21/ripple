import type { SharedValue } from 'react-native-reanimated';
import type { PhotoCrop } from './photoEditingGeometry';
import { clamp, imageBehindFrame, MAX_PHOTO_ZOOM, photoCropZoom, zoomPhotoCrop, type PhotoCanvasLayout } from './photoEditorGeometry';

export interface LivePhotoPosition {
  crop: PhotoCrop;
  view: PhotoCanvasLayout;
  sourceWidth: number;
  sourceHeight: number;
  stageWidth: number;
  stageHeight: number;
}
export interface PhotoEditorInteraction {
  position: SharedValue<LivePhotoPosition>;
  view: SharedValue<PhotoCanvasLayout>;
  active: SharedValue<number>;
  revision: SharedValue<number>;
}

export function displayPhotoPosition(live: PhotoEditorInteraction, crop: PhotoCrop, view: PhotoCanvasLayout) {
  'worklet';
  live.position.set({ ...live.position.get(), crop, view });
  live.view.set(view);
}

// Slider updates share the image's UI-thread geometry. They never call React,
// reload the image, or start an animation that must chase the moving finger.
export function zoomLivePhoto(live: PhotoEditorInteraction, requested: number) {
  'worklet';
  const position = live.position.get();
  const currentZoom = photoCropZoom(position.crop, position.sourceWidth, position.sourceHeight);
  const zoom = clamp(requested, 1, Math.max(MAX_PHOTO_ZOOM, currentZoom));
  const crop = zoomPhotoCrop(position.crop, position.sourceWidth, position.sourceHeight, zoom);
  displayPhotoPosition(live, crop, imageBehindFrame(crop, position.view));
}
