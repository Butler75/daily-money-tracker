import { useState } from "react";
import { Layout } from "../components/Layout";
import { useAppData } from "../context/AppDataContext";

export function CategoriesPage() {
  const { categories, addCategory } = useAppData();
  const [name, setName] = useState("");
  const [type, setType] = useState("expense");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await addCategory(name, type);
      setName("");
    } catch (err) {
      setError(err.message || "Failed to add category");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout title="Categories" subtitle="Manage transaction categories">
      <section className="card">
        <h2 className="text-lg font-semibold">Add category</h2>
        <form className="mt-3 grid grid-cols-1 gap-3 text-left" onSubmit={handleSubmit}>
          <div>
            <label className="field-label">Category name</label>
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label">Type</label>
            <select
              className="input"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="both">Both</option>
            </select>
          </div>
          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? "Adding..." : "Add Category"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Available categories</h2>
        <ul className="mt-3 space-y-2">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
            >
              <p className="font-medium">{category.name}</p>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-600">
                {category.type}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}
