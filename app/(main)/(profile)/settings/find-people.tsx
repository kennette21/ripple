import { Redirect } from 'expo-router';

// Keep older links on the same contextual contacts flow as Find Friends.
export default function FindPeopleScreen() {
  return <Redirect href="/friends" />;
}
