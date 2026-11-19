import React, { useEffect, useMemo, useState } from "react";
import SideBar from "../Components/SideBar/SideBar";
import Header from "../Components/Header/Header";
import "./BatchManagement.css";

const STORAGE_KEY = "sicms-batch-management-v1";

// Replace this demo catalogue with your products API when the backend is ready.
const PRODUCT_CATALOG = [
    { id: "van-tub-500", category: "icecream", name: "Vanilla", flavour: "Vanilla", type: "Ice Cream Tub", size: "500 ml", unit: "Tubs" },
    { id: "cho-tub-500", category: "icecream", name: "Chocolate", flavour: "Chocolate", type: "Ice Cream Tub", size: "500 ml", unit: "Tubs" },
    { id: "man-tub-500", category: "icecream", name: "Mango", flavour: "Mango", type: "Ice Cream Tub", size: "500 ml", unit: "Tubs" },
    { id: "str-tub-500", category: "icecream", name: "Strawberry", flavour: "Strawberry", type: "Ice Cream Tub", size: "500 ml", unit: "Tubs" },
    { id: "van-bag-100", category: "icecream", name: "Vanilla", flavour: "Vanilla", type: "Ice Cream Bag", size: "100 ml", unit: "Bags" },
    { id: "van-bag-200", category: "icecream", name: "Vanilla", flavour: "Vanilla", type: "Ice Cream Bag", size: "200 ml", unit: "Bags" },
    { id: "cho-bag-100", category: "icecream", name: "Chocolate", flavour: "Chocolate", type: "Ice Cream Bag", size: "100 ml", unit: "Bags" },
    { id: "cho-bag-200", category: "icecream", name: "Chocolate", flavour: "Chocolate", type: "Ice Cream Bag", size: "200 ml", unit: "Bags" },
    { id: "str-pop", category: "icecream", name: "Strawberry", flavour: "Strawberry", type: "Popsicle", size: "—", unit: "Pieces" },
    { id: "man-pop", category: "icecream", name: "Mango", flavour: "Mango", type: "Popsicle", size: "—", unit: "Pieces" },
    { id: "cho-packet", category: "icecream", name: "Chocolate", flavour: "Chocolate", type: "Ice Packet", size: "—", unit: "Packets" },
    // Example yogurt drinks: replace sizes/flavours with factory catalogue later.
    { id: "yd-str-180", category: "yogurt", name: "Strawberry", flavour: "Strawberry", type: "Yogurt Drink", size: "180 ml", unit: "Bottles" },
    { id: "yd-str-200", category: "yogurt", name: "Strawberry", flavour: "Strawberry", type: "Yogurt Drink", size: "200 ml", unit: "Bottles" },
    { id: "yd-str-500", category: "yogurt", name: "Strawberry", flavour: "Strawberry", type: "Yogurt Drink", size: "500 ml", unit: "Bottles" },
    { id: "yd-van-180", category: "yogurt", name: "Vanilla", flavour: "Vanilla", type: "Yogurt Drink", size: "180 ml", unit: "Bottles" },
    { id: "yd-van-200", category: "yogurt", name: "Vanilla", flavour: "Vanilla", type: "Yogurt Drink", size: "200 ml", unit: "Bottles" },
    { id: "yd-van-500", category: "yogurt", name: "Vanilla", flavour: "Vanilla", type: "Yogurt Drink", size: "500 ml", unit: "Bottles" },
];

const pad = (n, length = 2) => String(n).padStart(length, "0");
const dateKey = (date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
const localDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const formatDateTime = (iso) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const formatDate = (isoDate) => new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const productById = (id) => PRODUCT_CATALOG.find((p) => p.id === id);

const CATEGORIES = [
    { value: "icecream", label: "Ice Cream" },
    { value: "yogurt", label: "Yogurt Drink" },
];
// Legacy FD batches did not store a category; treat them as Ice Cream.
const batchCategory = (batch) => batch?.category === "yogurt" ? "yogurt" : "icecream";
const categoryLabel = (category) => CATEGORIES.find((c) => c.value === category)?.label ?? "Ice Cream";
const productsForCategory = (category) => PRODUCT_CATALOG.filter((p) => p.category === category);
const uniqueValues = (values) => [...new Set(values)];
const getAvailableSizes = (category, flavour, type) => uniqueValues(
    productsForCategory(category)
        .filter((p) => p.flavour === flavour && p.type === type && p.size !== "—")
        .map((p) => p.size)
);

const createDraft = () => ({
    id: crypto.randomUUID(),
    flavour: "",
    type: "",
    size: "",
    productId: "",
    quantity: "",
    expiryDate: ""
});
const totalUnits = (batch) => batch.products.reduce((sum, item) => sum + item.quantity, 0);

function initialData() {
    const createdAt = new Date().toISOString();
    const demoExpiry = localDate(new Date(Date.now() + 180 * 86400000));
    const batch = {
        id: crypto.randomUUID(), number: `FD-${dateKey(new Date())}-001`, createdAt,
        createdBy: "Admin User",
        products: [
            { id: crypto.randomUUID(), productId: "van-tub-500", quantity: 480, expiryDate: demoExpiry },
            { id: crypto.randomUUID(), productId: "cho-tub-500", quantity: 320, expiryDate: demoExpiry },
            { id: crypto.randomUUID(), productId: "man-tub-500", quantity: 160, expiryDate: demoExpiry },
        ],
    };
    return { batches: [batch], selectedBatchId: batch.id };
}
function loadData() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (saved && Array.isArray(saved.batches)) return saved;
    } catch { /* Invalid or unavailable local storage: use demo data. */ }
    return initialData();
}

function nextBatchNumber(batches, category) {
    const prefix = `${category === "yogurt" ? "YD" : "IC"}-${dateKey(new Date())}-`;
    const max = batches.reduce((highest, batch) => {
        if (!batch.number.startsWith(prefix)) return highest;
        const suffix = Number(batch.number.slice(prefix.length));
        return Number.isInteger(suffix) ? Math.max(highest, suffix) : highest;
    }, 0);
    return `${prefix}${pad(max + 1, 3)}`;
}

export default function BatchManagement() {
    const [data, setData] = useState(loadData);
    const [search, setSearch] = useState("");
    const [newBatchCategory, setNewBatchCategory] = useState("icecream");
    const [historyCategory, setHistoryCategory] = useState("all");
    const [drafts, setDrafts] = useState([createDraft()]);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editQuantity, setEditQuantity] = useState("");
    const [editExpiry, setEditExpiry] = useState("");

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
        catch { /* Page remains usable if storage is blocked. */ }
    }, [data]);
    const batches = data.batches;
    const selectedBatch = batches.find((batch) => batch.id === data.selectedBatchId) ?? batches[0] ?? null;
    const sortedBatches = useMemo(() => [...batches]
        .filter((batch) => (historyCategory === "all" || batchCategory(batch) === historyCategory) && batch.number.toLowerCase().includes(search.trim().toLowerCase()))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [batches, search, historyCategory]);
    const savedQuantity = selectedBatch ? totalUnits(selectedBatch) : 0;
    const draftQuantity = drafts.reduce((sum, item) => sum + (Number(item.quantity) > 0 ? Number(item.quantity) : 0), 0);
    const validDraftCount = drafts.filter((item) => item.flavour || item.type || item.size || item.productId || item.quantity || item.expiryDate).length;
    const nextNumber = nextBatchNumber(batches, newBatchCategory);
    const selectedCategory = batchCategory(selectedBatch);
    const categoryProducts = productsForCategory(selectedCategory);

    function clearNotice() { setMessage(""); setError(""); }
    function selectBatch(id) {
        setData((prev) => ({ ...prev, selectedBatchId: id }));
        setDrafts([createDraft()]); setEditingId(null); clearNotice();
    }
    function createBatch() {
        const newBatch = { id: crypto.randomUUID(), number: nextBatchNumber(batches, newBatchCategory), category: newBatchCategory, createdAt: new Date().toISOString(), createdBy: "Admin User", products: [] };
        setData((prev) => ({ batches: [newBatch, ...prev.batches], selectedBatchId: newBatch.id }));
        setDrafts([createDraft()]); setEditingId(null); setError("");
        setMessage(`Batch ${newBatch.number} created and saved.`);
    }
    function updateDraft(id, field, value) {
        setDrafts((prev) => prev.map((draft) => {
            if (draft.id !== id) return draft;
            const updated = { ...draft, [field]: value };
            if (field === "flavour") { updated.type = ""; updated.size = ""; }
            if (field === "type") updated.size = "";
            if (["flavour", "type", "size"].includes(field)) {
                const product = categoryProducts.find((p) =>
                    p.flavour === updated.flavour &&
                    p.type === updated.type &&
                    (p.size === updated.size || (p.size === "—" && !updated.size))
                );
                updated.productId = product?.id ?? "";
            }
            return updated;
        }));
        clearNotice();
    }
    function addDraft() { setDrafts((prev) => [...prev, createDraft()]); clearNotice(); }
    function removeDraft(id) {
        setDrafts((prev) => prev.length === 1 ? [createDraft()] : prev.filter((item) => item.id !== id));
        clearNotice();
    }
    function saveProducts() {
        if (!selectedBatch) { setError("Create a batch first."); return; }
        const filled = drafts.filter((item) => item.flavour || item.type || item.size || item.productId || item.quantity || item.expiryDate);
        if (!filled.length) { setError("Add at least one product before saving."); return; }
        const createdDay = localDate(new Date(selectedBatch.createdAt));
        for (let i = 0; i < filled.length; i++) {
            const item = filled[i];
            const qty = Number(item.quantity);
            if (!categoryProducts.some((p) => p.id === item.productId)) { setError(`Row ${i + 1}: select a valid ${categoryLabel(selectedCategory)} product and size.`); return; }
            if (!Number.isSafeInteger(qty) || qty <= 0) { setError(`Row ${i + 1}: quantity must be a positive whole number.`); return; }
            if (!item.expiryDate || item.expiryDate <= createdDay) { setError(`Row ${i + 1}: expiry date must be after the batch creation date (${createdDay}).`); return; }
        }
        const additions = filled.map((item) => ({ id: crypto.randomUUID(), productId: item.productId, quantity: Number(item.quantity), expiryDate: item.expiryDate }));
        setData((prev) => ({ ...prev, batches: prev.batches.map((batch) => batch.id === selectedBatch.id ? { ...batch, products: [...batch.products, ...additions] } : batch) }));
        setDrafts([createDraft()]); setError(""); setMessage(`${additions.length} product${additions.length === 1 ? "" : "s"} saved to ${selectedBatch.number}.`);
    }
    function startEdit(item) { setEditingId(item.id); setEditQuantity(String(item.quantity)); setEditExpiry(item.expiryDate); clearNotice(); }
    function saveEdit(itemId) {
        const qty = Number(editQuantity);
        const createdDay = localDate(new Date(selectedBatch.createdAt));
        if (!Number.isSafeInteger(qty) || qty <= 0) { setError("Quantity must be a positive whole number."); return; }
        if (!editExpiry || editExpiry <= createdDay) { setError(`Expiry date must be after ${createdDay}.`); return; }
        setData((prev) => ({
            ...prev, batches: prev.batches.map((batch) => batch.id === selectedBatch.id ? {
                ...batch, products: batch.products.map((item) => item.id === itemId ? { ...item, quantity: qty, expiryDate: editExpiry } : item),
            } : batch)
        }));
        setEditingId(null); setError(""); setMessage("Saved product updated.");
    }



    function handleDeleteProduct(itemId) {
        if (!selectedBatch) return;
        if (!window.confirm("Delete this product from the selected batch?")) return;
        setData((prev) => ({
            ...prev,
            batches: prev.batches.map((batch) => batch.id === selectedBatch.id
                ? { ...batch, products: batch.products.filter((p) => p.id !== itemId) }
                : batch),
        }));
        setEditingId(null);
        setError("");
        setMessage("Product deleted successfully.");
    }

    const handleDeleteBatch = () => {
        if (!selectedBatch) return;

        const confirmDelete = window.confirm(
            `Are you sure you want to delete batch ${selectedBatch.number}?`
        );

        if (!confirmDelete) return;

        setData((prev) => {
            // Remove selected batch
            const updatedBatches = prev.batches.filter(
                (batch) => batch.id !== selectedBatch.id
            );

            return {
                ...prev,
                batches: updatedBatches,
                selectedBatchId:
                    updatedBatches.length > 0
                        ? updatedBatches[0].id
                        : null
            };
        });

        // Reset product entry form
        setDrafts([createDraft()]);
        setEditingId(null);

        // Display success message
        setError("");
        setMessage(`Batch ${selectedBatch.number} deleted successfully.`);
    };


    return (
        <div className="batch-page">
            <SideBar />
            <main className="main-content batch-main">
                <Header headername="Batch Management" description="Create and manage production batches and track expiry dates." />
                <div className="batch-dashboard">
                    <div className="batch-layout">
                        <aside className="batch-sidebar">
                            <section className="batch-card batch-create-card">
                                <h2>Create a batch</h2>
                                <p>A unique batch number and its creation date are saved automatically.</p>
                                <label className="batch-category-label" htmlFor="batch-new-category">Product category</label>
                                <select id="batch-new-category" className="batch-category-select" value={newBatchCategory} onChange={(e) => setNewBatchCategory(e.target.value)}>
                                    {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                                </select>
                                <div className="batch-next-number"><small>NEXT BATCH NUMBER · AUTO-GENERATED</small><strong>{nextNumber}</strong></div>
                                <button type="button" className="batch-primary-btn" onClick={createBatch}>＋ Create batch &amp; auto-save</button>
                                <p className="batch-helper">Creation date is recorded by the system. No manual date entry required.</p>
                            </section>
                            <section className="batch-card batch-history-card">
                                <div className="batch-history-title"><h2>Batch history</h2><span>{batches.length} batches</span></div>
                                <label className="batch-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search batch number" aria-label="Search batch number" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
                                <label className="batch-category-label" htmlFor="batch-history-category">Filter by category</label>
                                <select id="batch-history-category" className="batch-category-select batch-history-filter" value={historyCategory} onChange={(e) => setHistoryCategory(e.target.value)}>
                                    <option value="all">All batches</option>
                                    {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                                </select>
                                <p className="batch-history-label">MOST RECENT FIRST</p>
                                <div className="batch-history-list">
                                    {sortedBatches.length === 0 ? <p className="batch-no-results">No matching batches.</p> : sortedBatches.map((batch) => (
                                        <button type="button" key={batch.id} onClick={() => selectBatch(batch.id)} className={`batch-history-item ${selectedBatch?.id === batch.id ? "is-selected" : ""}`}>
                                            <span className="batch-history-top"><strong>{batch.number}</strong><span>{selectedBatch?.id === batch.id ? "◉" : "›"}</span></span>
                                            <small>{categoryLabel(batchCategory(batch))} · Created {formatDateTime(batch.createdAt)}</small>
                                            <span className="batch-history-bottom"><span>{batch.products.length} products · {totalUnits(batch).toLocaleString()} units</span><b>{selectedBatch?.id === batch.id ? "SELECTED" : "SAVED"}</b></span>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        </aside>
                        <div className="batch-content">
                            {!selectedBatch ? <section className="batch-card batch-empty-state">Create your first batch to start recording production.</section> : <>
                                <section className="batch-editor">

                                    <div className="batch-editor-top">
                                        <div>
                                            <span className="batch-eyebrow">SELECTED BATCH · {categoryLabel(selectedCategory).toUpperCase()}</span>
                                            <h2>{selectedBatch.number}</h2>
                                        </div>

                                        <button
                                            type="button"
                                            className="batch-delete-btn"
                                            onClick={handleDeleteBatch}
                                        >
                                            Delete Batch
                                        </button>
                                    </div>
                                    <div className="batch-stats">
                                        <div><small>♙ CREATED ON · SYSTEM-RECORDED</small><strong>{formatDateTime(selectedBatch.createdAt)}</strong><span>Automatically recorded. Cannot be edited.</span></div>
                                        <div><small>SAVED PRODUCTION</small><strong>{selectedBatch.products.length} products · {savedQuantity.toLocaleString()} units</strong><span>Created by {selectedBatch.createdBy}</span></div>
                                    </div>
                                    <div className="batch-form-heading"><div><h3>Add produced products</h3><p>Select a {categoryLabel(selectedCategory)} product and enter its quantity and expiry date. Details are saved only when you choose Save products.</p></div></div>

                                    <div className="batch-draft-head" aria-hidden="true">
                                        <span>FLAVOUR</span>
                                        <span>PRODUCT TYPE</span>
                                        <span>SIZE</span>
                                        <span>QUANTITY</span>
                                        <span>EXPIRY DATE</span>
                                        <span></span>
                                    </div>

                                    <div className="batch-drafts">
                                        {drafts.map((draft, index) => {
                                            const flavours = uniqueValues(categoryProducts.map((p) => p.flavour));
                                            const types = uniqueValues(categoryProducts.filter((p) => p.flavour === draft.flavour).map((p) => p.type));
                                            const sizes = getAvailableSizes(selectedCategory, draft.flavour, draft.type);
                                            const noSize = draft.type && categoryProducts.some((p) => p.flavour === draft.flavour && p.type === draft.type && p.size === "—");
                                            return (
                                                <div className="batch-draft-row" key={draft.id}>
                                                    <div className="batch-field">
                                                        <label htmlFor={`batch-flavour-${draft.id}`}>Flavour {index + 1}</label>
                                                        <select id={`batch-flavour-${draft.id}`} value={draft.flavour} onChange={(e) => updateDraft(draft.id, "flavour", e.target.value)}>
                                                            <option value="">Select flavour</option>
                                                            {flavours.map((flavour) => <option key={flavour} value={flavour}>{flavour}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="batch-field">
                                                        <label htmlFor={`batch-type-${draft.id}`}>Product Type</label>
                                                        <select id={`batch-type-${draft.id}`} value={draft.type} disabled={!draft.flavour} onChange={(e) => updateDraft(draft.id, "type", e.target.value)}>
                                                            <option value="">Select type</option>
                                                            {types.map((type) => <option key={type} value={type}>{type}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="batch-field">
                                                        <label htmlFor={`batch-size-${draft.id}`}>Size</label>
                                                        <select id={`batch-size-${draft.id}`} value={draft.size} disabled={!draft.type || Boolean(noSize)} onChange={(e) => updateDraft(draft.id, "size", e.target.value)}>
                                                            <option value="">{noSize ? "Not required" : "Select size"}</option>
                                                            {sizes.map((size) => <option key={size} value={size}>{size}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="batch-field">
                                                        <label htmlFor={`batch-qty-${draft.id}`}>Quantity</label>
                                                        <input id={`batch-qty-${draft.id}`} type="number" min="1" step="1" placeholder="e.g. 240" value={draft.quantity} onChange={(e) => updateDraft(draft.id, "quantity", e.target.value)} />
                                                    </div>
                                                    <div className="batch-field">
                                                        <label htmlFor={`batch-expiry-${draft.id}`}>Expiry Date</label>
                                                        <input id={`batch-expiry-${draft.id}`} type="date" min={localDate(new Date(new Date(selectedBatch.createdAt).getTime() + 86400000))} value={draft.expiryDate} onChange={(e) => updateDraft(draft.id, "expiryDate", e.target.value)} />
                                                    </div>
                                                    <button type="button" className="batch-remove-draft" onClick={() => removeDraft(draft.id)} aria-label={`Remove product row ${index + 1}`} title="Remove row">×</button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="batch-draft-actions"><button type="button" onClick={addDraft}>＋ Add another product</button></div>
                                    <div className="batch-editor-footer"><div><strong>{validDraftCount} unsaved product{validDraftCount === 1 ? "" : "s"} · {draftQuantity.toLocaleString()} units</strong><span>Will be added to {selectedBatch.number}</span></div><div className="batch-footer-actions"><button type="button" className="batch-clear-btn" onClick={() => { setDrafts([createDraft()]); clearNotice(); }}>Clear entry</button><button type="button" className="batch-save-btn" onClick={saveProducts}>▣ Save products</button></div></div>
                                </section>
                                {(error || message) && <div role="status" className={`batch-notice ${error ? "is-error" : "is-success"}`}>{error || message}</div>}
                                <section className="batch-card batch-products-card">
                                    <div className="batch-products-heading"><div><h2>Products in this batch</h2><p>{selectedBatch.number} · Saved records only. Unsaved entries are not included.</p></div><span>{selectedBatch.products.length} saved products</span></div>
                                    <div className="batch-table-scroll"><table className="batch-products-table"><thead><tr><th>PRODUCT</th><th>QUANTITY</th><th>EXPIRY DATE</th><th>ACTION</th></tr></thead><tbody>
                                        {selectedBatch.products.length === 0 ? <tr><td className="batch-empty-cell" colSpan="4">No products saved in this batch yet.</td></tr> : selectedBatch.products.map((item) => {
                                            const product = productById(item.productId);
                                            const editing = editingId === item.id;
                                            return <tr key={item.id}><td><strong>{product ? `${product.flavour} · ${product.type}` : "Unknown product"}</strong><small>{product?.size === "—" ? "No size" : (product?.size ?? item.productId)}</small></td><td>{editing ? <input className="batch-inline-input" type="number" min="1" step="1" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} aria-label="Edit quantity" /> : item.quantity.toLocaleString()}</td><td>{editing ? <input className="batch-inline-date" type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} aria-label="Edit expiry date" /> : formatDate(item.expiryDate)}</td><td>{editing ? <div className="batch-edit-actions"><button type="button" onClick={() => saveEdit(item.id)}>Save</button><button type="button" onClick={() => { setEditingId(null); clearNotice(); }}>Cancel</button></div> : <div className="batch-product-actions"><button type="button" className="batch-edit-btn" onClick={() => startEdit(item)} aria-label={`Edit ${product?.flavour ?? "product"}`} title="Edit saved product">✎</button><button type="button" className="batch-delete-product-btn" onClick={() => handleDeleteProduct(item.id)} aria-label="Delete product" title="Delete product">🗑</button></div>}</td></tr>;
                                        })}
                                    </tbody></table></div>
                                    <div className="batch-products-footer"><span>✓ Products saved locally · {selectedBatch.createdBy}</span><strong>Total saved: {savedQuantity.toLocaleString()} units</strong></div>
                                </section>
                                <p className="batch-disclaimer">Demo product data · Dates shown as day month year · Quantities count individual units. Browser storage only; backend is not connected.</p>
                            </>}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
