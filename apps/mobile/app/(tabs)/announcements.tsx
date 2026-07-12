import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors } from "@/constants/colors";
import { announcements } from "@/services/placeholderData";

export default function AnnouncementsScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Announcements</Text>
      {announcements.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.date}>{item.publishedAt}</Text>
          <Text style={styles.heading}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.forest,
    fontSize: 30,
    fontWeight: "900",
  },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  date: {
    color: colors.leaf,
    fontSize: 12,
    fontWeight: "800",
  },
  heading: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
  },
});
