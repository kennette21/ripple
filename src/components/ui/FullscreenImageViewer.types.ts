export interface FullscreenImageViewerProps {
  images: { uri: string }[];
  imageIndex: number;
  visible: boolean;
  onRequestClose: () => void;
  closeAccessibilityLabel?: string;
}
