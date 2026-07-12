import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { loginSchema } from "@trackcoop/validation";
import { BrandMark } from "@/components/BrandMark";
import { Screen } from "@/components/Screen";
import { colors } from "@/constants/colors";

export default function LoginScreen() {
  const [email, setEmail] = useState("member@example.com");
  const [password, setPassword] = useState("password");
  const [message, setMessage] = useState("Use placeholder credentials to preview the app.");

  function validateForm() {
    const result = loginSchema.safeParse({ email, password });
    setMessage(
      result.success
        ? "Looks ready for the future API."
        : "Enter a valid email and a password with at least 8 characters.",
    );
  }

  return (
    <Screen>
      <BrandMark />
      <View style={styles.panel}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.body}>
          This validates fields locally only. Authentication will connect to the
          future backend later.
        </Text>
        <View style={styles.form}>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            style={styles.input}
            value={email}
          />
          <TextInput
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            style={styles.input}
            value={password}
          />
          <Text style={styles.message}>{message}</Text>
          <Pressable onPress={validateForm} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Check details</Text>
          </Pressable>
          <Link href="/(tabs)/home" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Continue to preview</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 20,
  },
  title: {
    color: colors.forest,
    fontSize: 30,
    fontWeight: "900",
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
  },
  form: {
    gap: 12,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  message: {
    color: colors.leaf,
    fontSize: 13,
    fontWeight: "700",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.forest,
    borderRadius: 14,
    paddingVertical: 15,
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
    paddingVertical: 15,
  },
  secondaryText: {
    color: colors.forest,
    fontSize: 16,
    fontWeight: "800",
  },
});
