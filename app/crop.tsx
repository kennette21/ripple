import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import ImageCropScreen from '@components/compose/ImageCropScreen';
import {
  clearImageCropSession,
  getImageCropSession,
} from '@/lib/imageCropSession';
import { colors } from '@/constants/theme';

export default function CropRoute() {
  const sessionRef = useRef(getImageCropSession());
  const session = sessionRef.current;

  useEffect(() => {
    if (!session) router.back();

    return clearImageCropSession;
  }, [session]);

  if (!session) {
    return <View style={{ flex: 1, backgroundColor: colors.black }} />;
  }

  const close = () => {
    clearImageCropSession();
    router.back();
  };

  return (
    <ImageCropScreen
      imageUri={session.imageUri}
      imageWidth={session.imageWidth}
      imageHeight={session.imageHeight}
      onCrop={(uri, width, height) => {
        session.onCrop(uri, width, height);
        close();
      }}
      onCancel={close}
    />
  );
}
