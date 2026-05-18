import { isSupabaseConfigured, supabase } from "./supabaseClient";

const TABLE_NAME = "salary_items";

const ensureConfigured = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const rowToItem = (row) => ({
  id: String(row.id),
  date: row.entry_date,
  wageUSD: toNumber(row.wage_usd),
  tipUSD: toNumber(row.tip_usd),
  totalUSD: toNumber(row.total_usd),
  note: row.note || "",
});

const itemToRow = (item) => ({
  id: String(item.id),
  entry_date: item.date,
  wage_usd: toNumber(item.wageUSD),
  tip_usd: toNumber(item.tipUSD),
  total_usd: toNumber(item.totalUSD),
  note: item.note || "",
});

const sortByDateDesc = (a, b) => b.date.localeCompare(a.date);

export const fetchIncomeItems = async () => {
  ensureConfigured();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("id, entry_date, wage_usd, tip_usd, total_usd, note, created_at")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(rowToItem).sort(sortByDateDesc);
};

export const upsertIncomeItem = async (item) => {
  await upsertIncomeItems([item]);
};

export const upsertIncomeItems = async (items) => {
  ensureConfigured();
  if (!items?.length) return;

  const payload = items.map(itemToRow);
  const { error } = await supabase.from(TABLE_NAME).upsert(payload, { onConflict: "id" });
  if (error) throw error;
};

export const deleteIncomeItems = async (ids) => {
  ensureConfigured();
  if (!ids?.length) return;

  const { error } = await supabase.from(TABLE_NAME).delete().in("id", ids);
  if (error) throw error;
};

export const syncLocalItemsToCloud = async (localItems) => {
  ensureConfigured();
  const remoteItems = await fetchIncomeItems();

  const localIds = new Set(localItems.map((item) => String(item.id)));
  const remoteIdsToDelete = remoteItems.map((item) => String(item.id)).filter((id) => !localIds.has(id));

  await upsertIncomeItems(localItems);
  await deleteIncomeItems(remoteIdsToDelete);

  return {
    uploaded: localItems.length,
    deleted: remoteIdsToDelete.length,
  };
};
