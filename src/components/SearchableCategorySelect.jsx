import { useMemo, useState } from "react";

export function SearchableCategorySelect({
  categories,
  value,
  onChange,
  allowedType,
}) {
  const [query, setQuery] = useState("");

  const filteredCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return categories.filter((item) => {
      const typeMatch = !allowedType || item.type === allowedType || item.type === "both";
      const textMatch = item.name.toLowerCase().includes(normalizedQuery);
      return typeMatch && textMatch;
    });
  }, [allowedType, categories, query]);

  return (
    <div className="space-y-2">
      <input
        className="input"
        placeholder="Search category..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <select
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      >
        <option value="">Select category</option>
        {filteredCategories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </div>
  );
}
