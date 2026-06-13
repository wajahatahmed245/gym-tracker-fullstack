export const BODY_PARTS = [
  { id: "Chest", label: "Chest", icon: "🫀", tagClass: "tag-chest" },
  { id: "Back", label: "Back", icon: "🦋", tagClass: "tag-back" },
  { id: "Legs", label: "Legs", icon: "🦵", tagClass: "tag-legs" },
  { id: "Shoulders", label: "Shoulders", icon: "🤷", tagClass: "tag-shoulders" },
  { id: "Arms", label: "Arms", icon: "💪", tagClass: "tag-arms" },
  { id: "Core", label: "Core", icon: "🎯", tagClass: "tag-core" },
];

export function bodyPartMeta(id) {
  return BODY_PARTS.find((part) => part.id === id);
}
