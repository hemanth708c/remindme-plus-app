// app/index.tsx
import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect the root route to the Today screen inside the (tabs) group
  return <Redirect href="/(tabs)/today" />;
}
