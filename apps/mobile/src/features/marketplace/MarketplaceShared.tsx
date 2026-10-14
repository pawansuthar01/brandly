import { useRef } from "react";
import { Pressable, Text } from "react-native";
import { useTheme } from "../../providers/ThemeProvider";
import { makeStyles } from "./marketplaceStyles";

export function ProposalBack({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const locked = useRef(false);
  const handlePress = () => {
    if (locked.current) return;
    locked.current = true;
    onBack();
    setTimeout(() => {
      locked.current = false;
    }, 450);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
      onPress={handlePress}
    >
      <Text style={styles.back}>‹ Back</Text>
    </Pressable>
  );
}
