export interface ImageCropSession {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  onCrop: (uri: string, width: number, height: number) => void;
}

let activeSession: ImageCropSession | null = null;

export function startImageCropSession(session: ImageCropSession) {
  activeSession = session;
}

export function getImageCropSession() {
  return activeSession;
}

export function clearImageCropSession() {
  activeSession = null;
}
