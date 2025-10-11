// src/paginas/DashboardAdmin.jsx
import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

export const DashboardAdmin = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-blue-700 text-white flex flex-col justify-between">
        <div>
          <div className="p-4 text-2xl font-semibold border-b border-blue-600">
            Panel Admin
          </div>

          <nav className="mt-6 space-y-2">
            <NavLink
              to="/dashboardAdmin"
              end
              className={({ isActive }) =>
                `block px-6 py-2 transition ${isActive ? "bg-blue-800/60" : "hover:bg-blue-600"}`
              }
            >
              📊 Inicio
            </NavLink>

            <NavLink
              to="/dashboardAdmin/registrar"
              className={({ isActive }) =>
                `block px-6 py-2 transition ${isActive ? "bg-blue-800/60" : "hover:bg-blue-600"}`
              }
            >
              ➕ Registrar usuario
            </NavLink>

            <button
              onClick={() => alert("Próximamente…")}
              className="w-full text-left px-6 py-2 hover:bg-blue-600 transition"
            >
              ⚙️ Configuración
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-blue-600 text-sm text-gray-200">
          © 2025 EdificioInteligente
        </div>
      </aside>

      {/* Contenido (cambia según la sub-ruta) */}
      <main className="flex-1 p-8">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Dashboard Administrativo</h1>
          <button
            onClick={() => {
              localStorage.removeItem("user");
              navigate("/");
            }}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl"
          >
            Cerrar sesión
          </button>
        </header>

        {/* Aquí se renderizan las rutas hijas */}
        <Outlet />
      </main>
    </div>
  );
};
