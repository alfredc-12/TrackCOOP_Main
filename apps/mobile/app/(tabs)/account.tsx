import { StyleSheet, Text, View } from "react-native";
import { formatFullName, formatRoleLabel } from "@trackcoop/shared-utils";
import { Screen } from "@/components/Screen";
import { colors } from "@/constants/colors";
import { demoUser } from "@/services/placeholderData";

export default function AccountScreen() {
  return (
    <Screen>
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>MS</Text>
        </View>
        <Text style={styles.name}>
          {formatFullName(demoUser.firstName, demoUser.lastName)}
        </Text>
        <Text style={styles.email}>{demoUser.email}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Role</Text>
        <Text style={styles.value}>{formatRoleLabel(demoUser.role)}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Backend status</Text>
        <Text style={styles.value}>Not implemented yet</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.field,
    borderRadius: 34,
    height: 68,
    justifyContent: "center",
    width: 68,
  },
  avatarText: {
    color: colors.forest,
    fontSize: 20,
    fontWeight: "900",
  },
  name: {
    color: colors.forest,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 14,
  },
  email: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 18,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  value: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
});
