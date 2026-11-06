import { useState } from "react";
import { useInventory } from "../../context/InventoryContext";
import { getIngredientStyle } from "../../utils/imageUtils";

/** The "add an item by hand" input shown under the detected ingredients. */
export default function useManualAdd() {
  const { addIngredient } = useInventory();
  const [showAddInput, setShowAddInput] = useState(false);
  const [newItemName, setNewItemName] = useState("");

  const handleAddItem = () => {
    const trimmed = newItemName.trim();
    if (!trimmed) return;
    const style = getIngredientStyle(trimmed);
    const emoji = style.emoji || "🛒";
    addIngredient({
      id: `custom-${trimmed.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      name: trimmed,
      emoji,
      icon: emoji,
    });
    setNewItemName("");
    setShowAddInput(false);
  };

  const reset = () => {
    setShowAddInput(false);
    setNewItemName("");
  };

  return { showAddInput, setShowAddInput, newItemName, setNewItemName, handleAddItem, reset };
}
