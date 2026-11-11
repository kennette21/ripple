import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Button } from './Button';

interface FollowButtonProps {
  name: string;
  following: boolean;
  followBack?: boolean;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function FollowButton({ name, following, followBack, onPress, loading, disabled, style }: FollowButtonProps) {
  const followLabel = followBack ? 'Follow back' : 'Follow';

  return (
    <Button
      title={following ? 'Following' : followLabel}
      accessibilityLabel={following ? `Unfollow ${name}` : `Follow ${name}${followBack ? ' back' : ''}`}
      variant={following ? 'secondary' : 'primary'}
      size="sm"
      onPress={onPress}
      loading={loading}
      disabled={disabled}
      style={[styles.button, style]}
    />
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 104, minHeight: 44 },
});
