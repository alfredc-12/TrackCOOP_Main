import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/colors";

export function BrandMark() {
  return (
    <View style={styles.row}>
      <View style={styles.mark}>
        <Text style={styles.markText}>TC</Text>
      </View>
      <View>
        <Text style={styles.brand}>TrackCOOP</Text>
        <Text style={styles.caption}>Cooperative Management System</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  mark: {
    alignItems: "center",
    backgroundColor: colors.forest,
    borderRadius: 14,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  markText: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: "800",
  },
  brand: {
    color: colors.forest,
    fontSize: 24,
    fontWeight: "900",
  },
  caption: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
});
