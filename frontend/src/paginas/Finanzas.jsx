// src/paginas/Finanzas.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

const API = "http://localhost:3001";

function money(n) {
  const val = Number(n || 0);
  try {
    return new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" }).format(val);
  } catch {
    return `Bs ${val.toFixed(2)}`;
  }
}

export default function Finanzas() {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todas"); // todas | pendiente | vencida | pagada
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(() => new Set()); // ids seleccionados

  // NUEVO: manejo de banner/recibo al volver del checkout
  const location = useLocation();
  const [bannerMsg, setBannerMsg] = useState("");
  const [bannerType, setBannerType] = useState("info"); // info | success | warn | error
  const [receiptUrl, setReceiptUrl] = useState("");

  const auth = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("auth") || "{}"); }
    catch { return {}; }
  }, []);

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/finanzas/mis-facturas`, {
        headers: {
          "Content-Type": "application/json",
          ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "No se pudieron obtener las facturas.");
      }
      const data = await res.json();
      setFacturas(data.facturas || []);
      // limpiar selección de ids que ya no existan
      setSelected(prev => {
        const next = new Set();
        (data.facturas || []).forEach(f => { if (prev.has(f.id_factura)) next.add(f.id_factura); });
        return next;
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  // NUEVO: Al volver del checkout, mostrar banner y (si hay session_id) permitir descargar recibo
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ok = params.get("ok");
    const sid = params.get("session_id"); // requiere success_url con ?ok=1&session_id={CHECKOUT_SESSION_ID}

    if (ok === "1") {
      // Mostrar un banner genérico
      setBannerType("info");
      setBannerMsg("Estamos confirmando tu pago…");

      if (sid) {
        // Link de recibo
        setReceiptUrl(`${API}/api/finanzas/recibo/${encodeURIComponent(sid)}`);

        // Intentar confirmar (si tu backend implementó /confirmar)
        if (auth?.token) {
          fetch(`${API}/api/finanzas/confirmar?session_id=${encodeURIComponent(sid)}`, {
            headers: { ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}) },
          })
            .then(r => r.json())
            .then(async d => {
              if (d?.ok) {
                setBannerType("success");
                setBannerMsg(`Pago confirmado ✔️ ${d.pagadas?.length ? `Facturas: ${d.pagadas.join(", ")}` : ""}`);
                await cargar();
                setSelected(new Set());
              } else {
                // Si no existe /confirmar, es normal; el webhook lo marcará pagado en unos segundos.
                setBannerType("warn");
                setBannerMsg("Pago iniciado. Si no ves cambios, espera unos segundos y presiona Actualizar.");
              }
            })
            .catch(() => {
              setBannerType("warn");
              setBannerMsg("Pago iniciado. Si no ves cambios, espera unos segundos y presiona Actualizar.");
            });
        }
      } else {
        // No hay session_id => probablemente no configuraste {CHECKOUT_SESSION_ID} en success_url
        setReceiptUrl("");
        setBannerType("warn");
        setBannerMsg("Pago iniciado. Si no ves cambios, espera unos segundos y presiona Actualizar.");
      }
    } else {
      // limpiar banner si no venimos del checkout
      setBannerMsg("");
      setReceiptUrl("");
    }
  }, [location.search, auth?.token]);

  // Facturas visibles según filtro, ordenadas por fecha desc
  const visibles = useMemo(() => {
    let arr = [...facturas];
    if (filter !== "todas") arr = arr.filter(f => (f.estado || "pendiente") === filter);
    return arr.sort((a, b) => {
      const da = a.fecha_emision ? new Date(a.fecha_emision).getTime() : 0;
      const db = b.fecha_emision ? new Date(b.fecha_emision).getTime() : 0;
      if (db !== da) return db - da;
      return (b.id_factura || 0) - (a.id_factura || 0);
    });
  }, [facturas, filter]);

  // Solo son elegibles para pagar las que no están "pagada"
  const elegiblesVisibles = visibles.filter(f => f.estado !== "pagada");

  // ¿Está todo lo visible seleccionado?
  const allVisibleSelected =
    elegiblesVisibles.length > 0 &&
    elegiblesVisibles.every(f => selected.has(f.id_factura));

  // Total seleccionado (solo elegibles)
  const totalSeleccionado = elegiblesVisibles
    .filter(f => selected.has(f.id_factura))
    .reduce((acc, f) => acc + Number(f.monto || 0), 0);

  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        elegiblesVisibles.forEach(f => next.delete(f.id_factura));
      } else {
        elegiblesVisibles.forEach(f => next.add(f.id_factura));
      }
      return next;
    });
  }

  async function pagarSeleccionSimulado() {
    const ids = elegiblesVisibles
      .filter(f => selected.has(f.id_factura))
      .map(f => f.id_factura);

    if (ids.length === 0) {
      alert("Selecciona al menos una factura (no pagada).");
      return;
    }

    if (!confirm(`¿Confirmas pagar ${ids.length} factura(s) por ${money(totalSeleccionado)}?`)) {
      return;
    }

    setError("");
    try {
      await Promise.all(
        ids.map(id_factura =>
          fetch(`${API}/api/finanzas/pagar`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
            },
            body: JSON.stringify({ id_factura }),
          }).then(async (r) => {
            if (!r.ok) {
              const data = await r.json().catch(() => ({}));
              throw new Error(data?.message || `No se pudo pagar la factura ${id_factura}`);
            }
          })
        )
      );
      await cargar();
      setSelected(new Set());
      alert("Pago(s) registrado(s) correctamente.");
    } catch (e) {
      setError(e.message);
    }
  }

  async function pagarConPasarela() {
    const ids = elegiblesVisibles
      .filter(f => selected.has(f.id_factura))
      .map(f => f.id_factura);

    if (ids.length === 0) {
      alert("Selecciona al menos una factura (no pagada).");
      return;
    }

    try {
      const res = await fetch(`${API}/api/finanzas/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
        },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Endpoint de pasarela no implementado.");
      }

      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url; // redirigir al checkout
      } else {
        alert("El backend aún no devuelve una URL de checkout.");
      }
    } catch (e) {
      alert(e.message || "Pasarela no disponible.");
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-gray-800">Mis finanzas</h2>
        <div className="flex gap-2">
          <button onClick={cargar} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {/* NUEVO: Banner de estado de pago / recibo */}
      {bannerMsg && (
        <div
          className={
            "mb-4 rounded-lg border px-4 py-3 text-sm " +
            (bannerType === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : bannerType === "warn"
              ? "border-yellow-200 bg-yellow-50 text-yellow-700"
              : bannerType === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-blue-200 bg-blue-50 text-blue-700")
          }
        >
          <div className="flex items-center justify-between gap-4">
            <span>{bannerMsg}</span>
            {receiptUrl && (
              <a
                href={receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border px-3 py-1 text-sm hover:bg-white"
              >
                Descargar recibo (PDF)
              </a>
            )}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {[
          { k: "todas", txt: "Todas" },
          { k: "pendiente", txt: "Pendientes" },
          { k: "vencida", txt: "Vencidas" },
          { k: "pagada", txt: "Pagadas" },
        ].map(b => (
          <button
            key={b.k}
            onClick={() => setFilter(b.k)}
            className={`px-3 py-1 rounded-full border text-sm ${
              filter === b.k ? "bg-blue-600 text-white" : "bg-white hover:bg-gray-50"
            }`}
          >
            {b.txt}
          </button>
        ))}

        {/* Barra de selección */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-gray-600">
            Seleccionadas: <b>{elegiblesVisibles.filter(f => selected.has(f.id_factura)).length}</b>
          </span>
          <span className="text-sm text-gray-600">
            Total: <b>{money(totalSeleccionado)}</b>
          </span>
          <button
            onClick={pagarSeleccionSimulado}
            disabled={totalSeleccionado <= 0}
            className={`rounded-lg px-3 py-1 text-sm text-white ${
              totalSeleccionado > 0 ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Pagar (simulado)
          </button>
          <button
            onClick={pagarConPasarela}
            disabled={totalSeleccionado <= 0}
            className={`rounded-lg px-3 py-1 text-sm ${
              totalSeleccionado > 0 ? "border hover:bg-gray-50" : "border text-gray-400 cursor-not-allowed"
            }`}
          >
            Pagar con pasarela
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 text-sm font-semibold flex items-center gap-3">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAllVisible}
            disabled={elegiblesVisibles.length === 0}
          />
          <span>Listado de facturas</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-gray-600">
                <th className="text-left px-3 py-2">Sel.</th>
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-3 py-2">Concepto</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="text-right px-3 py-2">Monto</th>
                <th className="text-left px-3 py-2">Emisión</th>
                <th className="text-left px-3 py-2">Vencimiento</th>
                <th className="text-left px-3 py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">Cargando…</td></tr>
              )}
              {!loading && visibles.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">No hay facturas.</td></tr>
              )}
              {!loading && visibles.map(f => {
                const em = f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString() : "-";
                const ve = f.fecha_vencimiento ? new Date(f.fecha_vencimiento).toLocaleDateString() : "-";
                const cls =
                  f.estado === "pagada"  ? "bg-green-100 text-green-700 border-green-200" :
                  f.estado === "vencida" ? "bg-red-100 text-red-700 border-red-200" :
                                            "bg-yellow-100 text-yellow-700 border-yellow-200";
                const txt = f.estado === "pagada" ? "Pagada" : (f.estado === "vencida" ? "Vencida" : "Pendiente");
                const eligible = f.estado !== "pagada";

                return (
                  <tr key={f.id_factura} className="border-t">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        disabled={!eligible}
                        checked={selected.has(f.id_factura)}
                        onChange={() => toggleOne(f.id_factura)}
                        title={eligible ? "Seleccionar" : "Ya pagada"}
                      />
                    </td>
                    <td className="px-3 py-2">#{f.id_factura}</td>
                    <td className="px-3 py-2">{f.concepto}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full border ${cls}`}>{txt}</span>
                    </td>
                    <td className="px-3 py-2 text-right">{money(f.monto)}</td>
                    <td className="px-3 py-2">{em}</td>
                    <td className="px-3 py-2">{ve}</td>
                    <td className="px-3 py-2">
                      {eligible ? (
                        <button
                          onClick={() => {
                            setSelected(new Set([f.id_factura]));
                            pagarSeleccionSimulado();
                          }}
                          className="rounded-lg bg-blue-600 text-white px-3 py-1 hover:bg-blue-700"
                        >
                          Pagar esta
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
