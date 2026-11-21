import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, ReceiptText, CheckCircle2, X } from "lucide-react";
import { adminPaymentApi } from "../services/adminPaymentApi";

const statuses = {
  PENDING_REVIEW: ["Awaiting Admin Approval", "bg-amber-100 text-amber-800"],
  APPROVED: ["Approved — Awaiting Clearance", "bg-blue-100 text-blue-800"],
  CONFIRMED: ["Payment Confirmed", "bg-green-100 text-green-800"],
  REJECTED: ["Rejected", "bg-red-100 text-red-800"],
};
const idOf = (r) => r?.id ?? r?.receiptId;
const statusOf = (r) => String(r?.status ?? "").trim().toUpperCase();
const money = (v) => v == null || !Number.isFinite(Number(v)) ? "—" : new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(Number(v));
function Status({ receipt }) {
  const [label, color] = statuses[statusOf(receipt)] ?? [statusOf(receipt) || "Unknown", "bg-slate-100 text-slate-600"];
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{label}</span>;
}

export default function ChequePayments() {
  const [receipts, setReceipts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [proof, setProof] = useState(null);
  const [proofError, setProofError] = useState("");
  const [proofLoading, setProofLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [reason, setReason] = useState("");
  const active = useRef(null);
  const lock = useRef(false);
  const mounted = useRef(false);
  const selected = receipts.find(r => String(idOf(r)) === String(selectedId));
  const status = statusOf(selected);
  const canReview = status === "PENDING_REVIEW";
  const canClear = status === "APPROVED";
  const load = useCallback(async () => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    try {
      const rows = await adminPaymentApi.getChequePayments(controller.signal);
      if (!controller.signal.aborted) { setReceipts(rows); setError(""); }
    } catch (e) {
      if (!controller.signal.aborted) setError(e.message || "Unable to load cheques.");
    } finally {
      if (active.current === controller) {
        active.current = null;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    load();
    const timer = window.setInterval(() => {
      if (!lock.current && document.visibilityState === "visible") load();
    }, 15000);
    return () => { mounted.current = false; clearInterval(timer); active.current?.abort(); active.current = null; };
  }, [load]);
  useEffect(() => {
    setProof(null); setProofError(""); setProofLoading(false); setChecked(false); setReason("");
    if (selectedId == null) return;
    const controller = new AbortController();
    let url;
    setProofLoading(true);
    adminPaymentApi.getChequeProof(selectedId, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      const type = blob.type.split(";")[0].toLowerCase();
      if (!["image/jpeg", "image/png", "application/pdf"].includes(type)) throw new Error("Unsupported proof content type returned by server.");
      url = URL.createObjectURL(blob);
      setProof({ url, type, id: selectedId });
    }).catch(e => { if (!controller.signal.aborted) setProofError(e.message || "Unable to load cheque photo."); })
      .finally(() => { if (!controller.signal.aborted) setProofLoading(false); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [selectedId]);
  useEffect(() => { setChecked(false); }, [status]);
  const proofReady = proof && proof.id === selectedId;
  async function submit(action) {
    if (!selected || lock.current || loading || error) return;
    if (action === "approve" && (!canReview || !proofReady || !checked)) return;
    if (action === "clear" && (!canClear || !checked)) return;
    if (action === "reject" && (!(canReview || canClear) || !reason.trim())) return;
    const question = action === "clear" ? `Confirm that ${money(selected.amount)} has actually cleared and been credited to the company bank account?` : action === "approve" ? "Approve this cheque for bank clearance? This does not confirm payment." : "Reject this cheque?";
    if (!window.confirm(question)) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try {
      if (action === "approve") await adminPaymentApi.approveCheque(selectedId);
      else if (action === "clear") await adminPaymentApi.confirmChequeCleared(selectedId);
      else await adminPaymentApi.rejectCheque(selectedId, reason);
      if (!mounted.current) return;
      setReceipts(prev => prev.map(r => String(idOf(r)) === String(selectedId) ? { ...r, status: action === "approve" ? "APPROVED" : action === "clear" ? "CONFIRMED" : "REJECTED", ...(action === "reject" ? { rejectionReason: reason.trim() } : {}) } : r));
      setChecked(false); setMessage(action === "approve" ? "Cheque approved. Awaiting bank clearance." : action === "clear" ? "Cheque payment confirmed." : "Cheque rejected.");
      await load();
    } catch (e) { if (mounted.current) setError(e.message || "Unable to update cheque. Refresh before retrying."); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  const visible = receipts.filter(r => filter === "ALL" || statusOf(r) === filter);
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5">
        <div><h3 className="flex items-center gap-2 text-xl font-bold"><ReceiptText size={20}/> Wholesale Cheque Payments</h3><p className="mt-2 text-sm text-slate-500">Review submitted cheque photos and confirm actual bank clearance separately.</p></div>
        <button type="button" onClick={load} disabled={loading || busy} className="flex items-center gap-2 rounded-xl bg-[#5CDBDF] px-4 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(statuses).map(([value, [label, color]]) => <button type="button" key={value} onClick={() => setFilter(value)} className="rounded-2xl border bg-white p-4 text-left"><p className="text-xs text-slate-500">{label}</p><strong className={`mt-2 inline-block rounded-lg px-3 py-1 text-xl ${color}`}>{receipts.filter(r => statusOf(r) === value).length}</strong></button>)}
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">{message}</p>}
      <div className="rounded-2xl border bg-white p-5">
        <select aria-label="Filter cheque status" value={filter} onChange={e => setFilter(e.target.value)} className="mb-4 rounded-lg border p-2 text-sm"><option value="ALL">All statuses</option>{Object.entries(statuses).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}</select>
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b text-slate-500"><tr>{["Receipt", "Order", "Vehicle", "Amount", "Status", "Action"].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{visible.map(r => <tr key={idOf(r)} className="border-b"><td className="p-3">#{idOf(r)}</td><td className="p-3">#{r.orderId}</td><td className="p-3">{r.vehicleId ?? "—"}</td><td className="p-3 font-semibold">{money(r.amount)}</td><td className="p-3"><Status receipt={r}/></td><td className="p-3"><button type="button" disabled={busy} onClick={() => {setSelectedId(idOf(r)); setChecked(false); setReason("");}} className="rounded-lg border border-cyan-300 px-3 py-2 disabled:opacity-50">{statusOf(r) === "PENDING_REVIEW" ? "Review" : "View"}</button></td></tr>)}</tbody></table></div>
        {!visible.length && <p className="py-8 text-center text-sm text-slate-500">{loading ? "Loading cheques..." : error ? "Unable to load cheque records." : "No matching cheque records."}</p>}
      </div>
      {selected && <div className="space-y-4 rounded-2xl border bg-white p-5">
        <div className="flex justify-between gap-3"><div><h3 className="text-lg font-bold">Cheque #{selectedId} — Order #{selected.orderId}</h3><p className="mt-2 text-sm">Amount: <strong>{money(selected.amount)}</strong></p></div><button type="button" disabled={busy} onClick={() => setSelectedId(null)} aria-label="Close cheque details"><X size={20}/></button></div>
        <Status receipt={selected}/>
        <div className="rounded-xl border bg-slate-50 p-4"><p className="mb-3 font-semibold">{selected.proofOriginalName || "Cheque photo"}</p>{proofLoading && <p>Loading photo...</p>}{proofError && <p className="text-red-700">{proofError}</p>}{proofReady && <>{proof.type.startsWith("image/") ? <img src={proof.url} alt="Submitted cheque" className="mx-auto max-h-[600px] max-w-full object-contain"/> : <iframe title="Cheque proof" src={proof.url} className="h-[500px] w-full"/>}<a className="mt-3 inline-block text-sm font-semibold text-blue-700 underline" href={proof.url} download={`cheque-${selectedId}.${proof.type === "application/pdf" ? "pdf" : proof.type === "image/png" ? "png" : "jpg"}`}>Download cheque proof</a></>}</div>
        {(canReview || canClear) && <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-green-200 p-4"><h4 className="flex items-center gap-2 font-bold text-green-800"><CheckCircle2 size={18}/>{canReview ? "Approve Cheque" : "Confirm Bank Clearance"}</h4><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={checked} disabled={busy || (canReview && !proofReady)} onChange={e => setChecked(e.target.checked)}/>{canReview ? "I reviewed the cheque photo and amount." : "I verified the cheque has cleared and the amount was credited to the company account."}</label><button type="button" onClick={() => submit(canReview ? "approve" : "clear")} disabled={busy || loading || !!error || !checked || (canReview && !proofReady)} className="w-full rounded-xl bg-green-600 px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? "Processing..." : canReview ? "Approve Cheque" : "Confirm Bank Clearance"}</button></div>
          <div className="space-y-3 rounded-xl border border-red-200 p-4"><h4 className="font-bold text-red-800">Reject Cheque</h4><textarea aria-label="Rejection reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={500} disabled={busy} rows={3} placeholder="Reason for rejection or dishonour" className="w-full rounded-xl border p-3 text-sm"/><button type="button" onClick={() => submit("reject")} disabled={busy || loading || !!error || !reason.trim()} className="w-full rounded-xl bg-red-600 px-4 py-3 font-bold text-white disabled:opacity-50">Reject Cheque</button></div>
        </div>}
        {status === "REJECTED" && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Reason: {selected.rejectionReason || "Not provided"}</p>}
        {status === "CONFIRMED" && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">Cheque has cleared. The payment is confirmed.</p>}
      </div>}
    </section>
  );
}
