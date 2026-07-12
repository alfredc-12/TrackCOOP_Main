import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors } from "@/constants/colors";
import { services } from "@/services/placeholderData";

export default function ServicesScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Services</Text>
      {services.map((service) => (
        <View key={service.id} style={styles.card}>
          <Text style={styles.heading}>{service.name}</Text>
          <Text style={styles.body}>{service.description}</Text>
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
