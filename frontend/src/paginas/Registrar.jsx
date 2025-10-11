// src/paginas/Registrar.jsx
import React, { useMemo, useState } from "react";

export const Registrar = () => {
  const [form, setForm] = useState({
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    correo: "",
    celular: "",
    password: "",
    rol: "Residente",
    departamento: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const roles = ["Residente", "Personal", "Administrador"];
  const depsPorRol = useMemo(
    () => ({
      Residente: ["P1D1", "P1D2", "P2D1", "P2D2", "P3D1", "P3D2"],
      Personal: ["Adm-01", "Seg-01", "Mant-01"],
      Administrador: ["ADM-PRINCIPAL"],
    }),
    []
  );

  const departamentosDisponibles = depsPorRol[form.rol] ?? [];
  const departamentoHabilitado = form.rol === "Residente";

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({
      ...f,
      [name]: value,
      ...(name === "rol" ? { departamento: "" } : {}),
    }));
  };

  // >>>>>>>>>>>>>>> AQUI EL onSubmit (DENTRO DEL COMPONENTE) <<<<<<<<<<<<<<
  const onSubmit = async (e) => {
    e.preventDefault();

    // Validaciones mínimas
    if (!form.nombre.trim()) return alert("Ingresa el nombre.");
    if (!form.apellidoPaterno.trim())
      return alert("Ingresa el apellido paterno.");
    if (!form.correo.trim()) return alert("Ingresa el correo.");
    if (!form.password.trim()) return alert("Ingresa la contraseña.");
    if (form.rol === "Residente" && !form.departamento)
      return alert("Selecciona el departamento.");

    setSubmitting(true);
    try {
      const res = await fetch("http://localhost:3001/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          apellidoPaterno: form.apellidoPaterno,
          apellidoMaterno: form.apellidoMaterno,
          correo: form.correo,
          celular: form.celular,
          password: form.password,
          rol: form.rol, // "Residente" | "Personal" | "Administrador"
          departamento: form.departamento || null,
          token: null, // si luego agregas captcha aquí, pásalo
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "No se pudo registrar.");
        return;
      }

      setShowSuccess(true);
      // opcional: limpiar formulario
      // setForm({ nombre:"", apellidoPaterno:"", apellidoMaterno:"", correo:"", celular:"", password:"", rol:"Residente", departamento:"" });
    } catch (err) {
      console.error(err);
      alert("Error de conexión con el servidor.");
    } finally {
      setSubmitting(false);
    }
  };
  // >>>>>>>>>>>>>>> FIN onSubmit <<<<<<<<<<<<<<

  return (
    <>
      <h2 className="text-2xl font-semibold text-center mb-6">Nuevo usuario</h2>

      <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-2xl shadow p-6">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-sm text-gray-700 mb-1">Nombre:</label>
            <input
              name="nombre"
              value={form.nombre}
              onChange={onChange}
              type="text"
              placeholder="Nombre"
              className="rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-700 mb-1">Apellido paterno:</label>
            <input
              name="apellidoPaterno"
              value={form.apellidoPaterno}
              onChange={onChange}
              type="text"
              placeholder="Apellido paterno"
              className="rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-700 mb-1">Apellido materno:</label>
            <input
              name="apellidoMaterno"
              value={form.apellidoMaterno}
              onChange={onChange}
              type="text"
              placeholder="Apellido materno"
              className="rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-700 mb-1">Correo electrónico:</label>
            <input
              name="correo"
              value={form.correo}
              onChange={onChange}
              type="email"
              placeholder="correo@ejemplo.com"
              className="rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-700 mb-1">Celular:</label>
            <input
              name="celular"
              value={form.celular}
              onChange={onChange}
              type="tel"
              placeholder="Ej: 78900000"
              className="rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-700 mb-1">Contraseña:</label>
            <input
              name="password"
              value={form.password}
              onChange={onChange}
              type="password"
              placeholder="********"
              className="rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-700 mb-1">Tipo usuario (rol):</label>
            <select
              name="rol"
              value={form.rol}
              onChange={onChange}
              className="rounded-xl border border-gray-300 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-200 outline-none"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col md:col-span-2">
            <label className="text-sm text-gray-700 mb-1">
              Número de departamento del usuario:
            </label>
            <select
              name="departamento"
              value={form.departamento}
              onChange={onChange}
              disabled={!departamentoHabilitado}
              className={`rounded-xl border px-3 py-2 bg-white focus:ring-2 focus:ring-blue-200 outline-none ${
                departamentoHabilitado ? "border-gray-300" : "border-gray-200 text-gray-400"
              }`}
            >
              <option value="">
                {departamentoHabilitado
                  ? "Selecciona un departamento…"
                  : "No aplica para el rol seleccionado"}
              </option>
              {departamentosDisponibles.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              * El campo se habilita cuando el rol es <b>Residente</b>.
            </p>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className={`w-full rounded-xl px-4 py-3 font-medium text-white transition ${
                submitting ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {submitting ? "Registrando…" : "Registrar"}
            </button>
          </div>
        </form>
      </div>

      {/* Modal éxito */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6 text-center">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">¡Registro exitoso!</h3>
            <p className="text-gray-600 mb-6">El usuario ha sido registrado correctamente.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowSuccess(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
