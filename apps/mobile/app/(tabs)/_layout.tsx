import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { colors } from "@/constants/colors";

type TabIconName = React.ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: TabIconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons color={String(color)} name={name} size={size} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.cream },
        headerTintColor: colors.forest,
        headerTitleStyle: { fontWeight: "800" },
        tabBarActiveTintColor: colors.leaf,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home", tabBarIcon: tabIcon("home-outline") }}
      />
      <Tabs.Screen
        name="announcements"
        options={{ title: "Announcements", tabBarIcon: tabIcon("megaphone-outline") }}
      />
      <Tabs.Screen
        name="services"
        options={{ title: "Services", tabBarIcon: tabIcon("leaf-outline") }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: "Account", tabBarIcon: tabIcon("person-circle-outline") }}
      />
    </Tabs>
  );
}
