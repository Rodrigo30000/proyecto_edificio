// src/paginas/Inicio.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const API = "http://localhost:3001";

function money(n) {
  try {
    return new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" }).format(Number(n || 0));
  } catch {
    return `Bs ${Number(n || 0).toFixed(2)}`;
  }
}

export default function Inicio() {
  const [loading, setLoading] = useState(false);
  const [facturas, setFacturas] = useState([]);
  const [error, setError] = useState("");

  const auth = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("auth") || "{}"); } catch { return {}; }
  }, []);
  const nombreUsuario =
    auth?.username ||
    JSON.parse(localStorage.getItem("user") || "{}")?.username ||
    "Usuario";

  async function cargarResumen() {
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
        throw new Error(data?.message || "No se pudo cargar el resumen.");
      }
      const data = await res.json();
      setFacturas(data.facturas || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarResumen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agrupadas = useMemo(() => {
    const r = { pendientes: [], vencidas: [], pagadas: [] };
    for (const f of facturas) {
      if (f.estado === "pagada") r.pagadas.push(f);
      else if (f.estado === "vencida") r.vencidas.push(f);
      else r.pendientes.push(f);
    }
    return r;
  }, [facturas]);

  const totales = useMemo(() => {
    const sum = (arr) => arr.reduce((acc, f) => acc + Number(f.monto || 0), 0);
    return {
      pendientes: sum(agrupadas.pendientes),
      vencidas: sum(agrupadas.vencidas),
      pagadas: sum(agrupadas.pagadas),
      todas: sum(facturas),
    };
  }, [agrupadas, facturas]);

  const recientes = useMemo(() => {
    const ordenar = [...facturas].sort((a, b) => {
      const da = a.fecha_emision ? new Date(a.fecha_emision).getTime() : 0;
      const db = b.fecha_emision ? new Date(b.fecha_emision).getTime() : 0;
      if (db !== da) return db - da;
      return (b.id_factura || 0) - (a.id_factura || 0);
    });
    return ordenar.slice(0, 5);
  }, [facturas]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">{nombreUsuario}</h2>
          <p className="text-gray-500">Bienvenido a tu panel de inicio.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={cargarResumen}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
          >
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
          <Link
            to="/home/finanzas"
            className="rounded-xl bg-blue-600 text-white px-3 py-2 text-sm hover:bg-blue-700"
          >
            Ver mis finanzas
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Cards resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-2xl border p-4">
          <div className="text-xs text-gray-500">Pendientes</div>
          <div className="text-xl font-semibold">{money(totales.pendientes)}</div>
          <div className="text-xs text-gray-500">{agrupadas.pendientes.length} facturas</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-xs text-gray-500">Vencidas</div>
          <div className="text-xl font-semibold">{money(totales.vencidas)}</div>
          <div className="text-xs text-gray-500">{agrupadas.vencidas.length} facturas</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-xs text-gray-500">Pagadas</div>
          <div className="text-xl font-semibold">{money(totales.pagadas)}</div>
          <div className="text-xs text-gray-500">{agrupadas.pagadas.length} facturas</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-xl font-semibold">{money(totales.todas)}</div>
          <div className="text-xs text-gray-500">{facturas.length} facturas</div>
        </div>
      </div>

      {/* Últimas 5 */}
      <div className="rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Últimas facturas</h3>
          <Link to="/home/finanzas" className="text-sm text-blue-600 hover:underline">
            Ver todas
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-gray-600">
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-3 py-2">Concepto</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="text-right px-3 py-2">Monto</th>
                <th className="text-left px-3 py-2">Emisión</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Cargando…</td></tr>
              )}
              {!loading && recientes.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">No hay facturas.</td></tr>
              )}
              {!loading && recientes.map((f) => {
                const em = f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString() : "-";
                const cls =
                  f.estado === "pagada"  ? "bg-green-100 text-green-700 border-green-200" :
                  f.estado === "vencida" ? "bg-red-100 text-red-700 border-red-200" :
                                            "bg-yellow-100 text-yellow-700 border-yellow-200";
                const txt = f.estado === "pagada" ? "Pagada" : (f.estado === "vencida" ? "Vencida" : "Pendiente");
                return (
                  <tr key={f.id_factura} className="border-t">
                    <td className="px-3 py-2">#{f.id_factura}</td>
                    <td className="px-3 py-2">{f.concepto}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full border ${cls}`}>{txt}</span>
                    </td>
                    <td className="px-3 py-2 text-right">{money(f.monto)}</td>
                    <td className="px-3 py-2">{em}</td>
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
