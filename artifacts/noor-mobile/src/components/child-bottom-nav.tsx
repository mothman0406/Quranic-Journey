import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export type ChildNavKey = "dashboard" | "memorization" | "review" | "more";

type IconName = ComponentProps<typeof Ionicons>["name"];

type NavItem = {
  key: ChildNavKey;
  label: string;
  icon: IconName;
  pathname:
    | "/child/[childId]"
    | "/child/[childId]/memorization"
    | "/child/[childId]/review"
    | "/child/[childId]/more";
};

const NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard",
    label: "Home",
    icon: "home-outline",
    pathname: "/child/[childId]",
  },
  {
    key: "memorization",
    label: "Memorize",
    icon: "book-outline",
    pathname: "/child/[childId]/memorization",
  },
  {
    key: "review",
    label: "Review",
    icon: "refresh-outline",
    pathname: "/child/[childId]/review",
  },
  {
    key: "more",
    label: "More",
    icon: "grid-outline",
    pathname: "/child/[childId]/more",
  },
];

function validChildId(childId: string | undefined): childId is string {
  return typeof childId === "string" && /^\d+$/.test(childId);
}

export function ChildBottomNav({
  active,
  childId,
  name,
  reviewCount,
}: {
  active: ChildNavKey;
  childId: string | undefined;
  name?: string;
  reviewCount?: number;
}) {
  const router = useRouter();
  const canNavigate = validChildId(childId);

  return (
    <View style={styles.wrap}>
      {NAV_ITEMS.map((item) => {
        const isActive = item.key === active;
        const badgeCount = item.key === "review" ? reviewCount ?? 0 : 0;

        return (
          <Pressable
            key={item.key}
            style={[styles.item, isActive && styles.itemActive]}
            disabled={isActive || !canNavigate}
            onPress={() => {
              const targetChildId = childId;
              if (!validChildId(targetChildId)) return;
              router.replace({
                pathname: item.pathname,
                params: { childId: targetChildId, name: name ?? "" },
              });
            }}
          >
            <View style={styles.iconWrap}>
              <Ionicons
                name={isActive ? item.icon.replace("-outline", "") as IconName : item.icon}
                size={21}
                color={isActive ? "#2563eb" : "#666666"}
              />
              {badgeCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badgeCount > 99 ? "99+" : badgeCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingTop: 9,
    paddingHorizontal: 10,
    paddingBottom: 22,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  itemActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#dbeafe",
  },
  iconWrap: {
    minWidth: 28,
    minHeight: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "800",
  },
  labelActive: {
    color: "#2563eb",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -9,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#be123c",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: "#ffffff",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },
});
