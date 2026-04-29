import { useRouter } from "expo-router";
import { ChildProfileForm, type ChildProfileValues } from "@/src/components/child-profile-form";
import {
  ScreenContainer,
  ScreenHeader,
} from "@/src/components/screen-primitives";
import { apiFetch } from "@/src/lib/api";

type CreatedChild = {
  id: number;
  name: string;
};

export default function NewChildProfileScreen() {
  const router = useRouter();

  async function createChild(values: ChildProfileValues) {
    const created = await apiFetch<CreatedChild>("/api/children", {
      method: "POST",
      body: JSON.stringify({
        name: values.name,
        age: values.age,
        gender: values.gender,
        avatarEmoji: values.avatarEmoji,
        practiceMinutesPerDay: values.practiceMinutesPerDay,
        memorizePagePerDay: values.memorizePagePerDay,
        reviewPagesPerDay: values.reviewPagesPerDay,
        readPagesPerDay: values.readPagesPerDay,
        initialSurahSetups: values.initialSurahSetups,
      }),
    });

    await apiFetch<CreatedChild>(`/api/children/${created.id}`, {
      method: "PUT",
      body: JSON.stringify({
        hideStories: values.hideStories,
        hideDuas: values.hideDuas,
      }),
    });

    router.replace({
      pathname: "/child/[childId]",
      params: { childId: String(created.id), name: created.name },
    });
  }

  return (
    <ScreenContainer>
      <ScreenHeader title="Add Child" onBack={() => router.back()} sideWidth={82} />
      <ChildProfileForm
        mode="create"
        submitLabel="Create Profile"
        onSubmit={createChild}
      />
    </ScreenContainer>
  );
}
