import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandMark } from "@/components/BrandMark";
import { Screen } from "@/components/Screen";
import { colors } from "@/constants/colors";

export default function WelcomeScreen() {
  return (
    <Screen scroll={false}>
      <View style={styles.hero}>
        <BrandMark />
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>Nasugbu agriculture cooperative</Text>
          <Text style={styles.title}>Member services, announcements, and cooperative updates.</Text>
          <Text style={styles.body}>
            A mobile starter for TrackCOOP members and officers. Data shown here
            is placeholder content until the future API is available.
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Link href="/login" asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryText}>Sign in</Text>
          </Pressable>
        </Link>
        <Link href="/(tabs)/home" asChild>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Preview app</Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    justifyContent: "center",
  },
  copy: {
    gap: 14,
    marginTop: 44,
  },
  eyebrow: {
    color: colors.leaf,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: colors.forest,
    fontSize: 38,
    fontWeight: "900",
    lineHeight: 43,
  },
  body: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 25,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.forest,
    borderRadius: 14,
    paddingVertical: 16,
  },
  primaryText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 16,
  },
  secondaryText: {
    color: colors.forest,
    fontSize: 16,
    fontWeight: "800",
  },
});
