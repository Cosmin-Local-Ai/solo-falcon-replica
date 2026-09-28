import { useEffect, useMemo, useState } from "react";
import { useStore } from "../data/store";
import { fmtDate, type Document } from "../data/types";
import { Card, Badge, Modal, Empty, Pagination } from "../components/ui";

const PAGE_SIZE = 8;
const CATEGORIES = ["Venituri", "Cheltuieli", "Raport"] as const;

const TIP_LABEL: Record<Document["tip"], string> = {
  pdf: "PDF",
  jpg: "JPG",
  xlsx: "Excel",
};
const TIP_KIND: Record<Document["tip"], "info" | "neutral" | "success"> = {
  pdf: "info",
  jpg: "neutral",
  xlsx: "success",
};

const today = () => new Date().toISOString().slice(0, 10);

interface DocumentsProps {
  initialCategory?: string;
  onCategoryChange?: (cat: string) => void;
}

export default function Documents({ initialCategory, onCategoryChange }: DocumentsProps) {
  const { documents, addDocument, deleteDocument, toast } = useStore();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>(
    initialCategory &&
      (initialCategory === "Toate" || (CATEGORIES as readonly string[]).includes(initialCategory))
      ? initialCategory
      : "Toate"
  );

  // Sync category when the URL changes (back/forward navigation).
  useEffect(() => {
    if (
      initialCategory &&
      (initialCategory === "Toate" || (CATEGORIES as readonly string[]).includes(initialCategory)) &&
      initialCategory !== cat
    ) {
      setCat(initialCategory);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCategory]);
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    nume: "",
    tip: "pdf" as Document["tip"],
    marime: "120 KB",
    data: today(),
    categoria: "Venituri" as Document["categoria"],
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter(
      (d) =>
        (cat === "Toate" || d.categoria === cat) &&
        (!q || d.nume.toLowerCase().includes(q) || d.categoria.toLowerCase().includes(q))
    );
  }, [documents, search, cat]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function submit() {
    if (!form.nume.trim()) return;
    addDocument({
      nume: form.nume.trim(),
      tip: form.tip,
      marime: form.marime.trim() || "—",
      data: form.data,
      categoria: form.categoria,
    });
    toast('success', 'Document adăugat');
    setForm({ nume: "", tip: "pdf", marime: "120 KB", data: today(), categoria: "Venituri" });
    setShowAdd(false);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Documente</h1>
          <p className="sub">Arhiva de fișiere — facturi, chitanțe și rapoarte</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + Adaugă document
          </button>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="Caută documente…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <div className="spacer" />
        <select
          className="select"
          value={cat}
          onChange={(e) => {
            setCat(e.target.value);
            setPage(1);
            onCategoryChange?.(e.target.value);
          }}
        >
          <option value="Toate">Toate categoriile</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <Card>
        {pageItems.length === 0 ? (
          <Empty
            title="Niciun document"
            text="Adaugă un document sau schimbă filtrul de căutare."
            action={
              <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
                Adaugă document
              </button>
            }
          />
        ) : (
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>Nume</th>
                  <th>Tip</th>
                  <th>Marime</th>
                  <th>Data</th>
                  <th>Categorie</th>
                  <th style={{ textAlign: "right" }}>Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="row-main">{d.nume}</div>
                    </td>
                    <td>
                      <Badge kind={TIP_KIND[d.tip]}>{TIP_LABEL[d.tip]}</Badge>
                    </td>
                    <td>{d.marime}</td>
                    <td>{fmtDate(d.data)}</td>
                    <td>
                      <Badge kind="neutral">{d.categoria}</Badge>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            deleteDocument(d.id);
                            toast('success', 'Document șters');
                          }}
                        >
                          Șterge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="table-footer">
        <span>
          {filtered.length} documente · {cat === "Toate" ? "toate categoriile" : cat}
        </span>
        <Pagination page={page} pages={pages} total={filtered.length} onPage={setPage} />
      </div>

      {showAdd && (
      <Modal
        onClose={() => setShowAdd(false)}
        title="Adaugă document"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>
              Anulează
            </button>
            <button className="btn btn-primary" onClick={submit}>
              Adaugă
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="field full">
            <label>
              Nume fișier <span className="req">*</span>
            </label>
            <input
              className="input"
              value={form.nume}
              onChange={(e) => setForm({ ...form, nume: e.target.value })}
              placeholder="ex. Factura 2024-0123.pdf"
            />
          </div>
          <div className="field">
            <label>Tip fișier</label>
            <select
              className="select"
              value={form.tip}
              onChange={(e) => setForm({ ...form, tip: e.target.value as Document["tip"] })}
            >
              <option value="pdf">PDF</option>
              <option value="jpg">JPG</option>
              <option value="xlsx">Excel</option>
            </select>
          </div>
          <div className="field">
            <label>Marime</label>
            <input
              className="input"
              value={form.marime}
              onChange={(e) => setForm({ ...form, marime: e.target.value })}
              placeholder="ex. 120 KB"
            />
          </div>
          <div className="field">
            <label>Categorie</label>
            <select
              className="select"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value as Document["categoria"] })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Data</label>
            <input
              className="input"
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
            />
          </div>
        </div>
      </Modal>
      )}
    </div>
  );
}
