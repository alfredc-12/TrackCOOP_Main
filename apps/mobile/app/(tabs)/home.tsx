import { StyleSheet, Text, View } from "react-native";
import { formatFullName } from "@trackcoop/shared-utils";
import { Screen } from "@/components/Screen";
import { colors } from "@/constants/colors";
import { announcements, demoUser, services } from "@/services/placeholderData";

export default function HomeScreen() {
  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Good day</Text>
        <Text style={styles.title}>{formatFullName(demoUser.firstName, demoUser.lastName)}</Text>
        <Text style={styles.body}>
          Track requests, cooperative programs, and announcements from one
          member-friendly mobile workspace.
        </Text>
      </View>

      <View style={styles.grid}>
        <SummaryCard label="Announcements" value={announcements.length.toString()} />
        <SummaryCard label="Services" value={services.length.toString()} />
      </View>
    </Screen>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.forest,
    borderRadius: 18,
    gap: 12,
    padding: 22,
  },
  kicker: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: colors.white,
    fontSize: 30,
    fontWeight: "900",
  },
  body: {
    color: "#DDE8D8",
    fontSize: 15,
    lineHeight: 23,
  },
  grid: {
    flexDirection: "row",
    gap: 14,
  },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    padding: 18,
  },
  value: {
    color: colors.leaf,
    fontSize: 28,
    fontWeight: "900",
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
  },
});
