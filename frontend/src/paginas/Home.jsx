// src/paginas/Home.jsx
import React, { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "./Home.css"; 
export default function Home() {
  const navigate = useNavigate();

  // Guard: solo residentes con token
  useEffect(() => {
    try {
      const auth = JSON.parse(localStorage.getItem("auth") || "{}");
      if (!auth?.token || auth?.rol !== "residente") {
        navigate("/");
      }
    } catch {
      navigate("/");
    }
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem("auth");
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
        <div className="userLayout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div>
          <div className="brand">
            USUARIO
            <img class="avatar" src="https://img.freepik.com/vector-premium/icono-circulo-usuario-anonimo-ilustracion-vector-estilo-plano-sombra_520826-1931.jpg"></img>
          </div>
          
         
         <nav className="nav">
            <NavLink
              to="/home"
              end
              className={({ isActive }) =>
                isActive ? "navLink active" : "navLink"
              }
            >
              🏠 Inicio
            </NavLink>

            <NavLink
              to="/home/finanzas"
              className={({ isActive }) =>
                isActive ? "navLink active" : "navLink"
              }
            >
              💳 Mis finanzas
            </NavLink>

            <button
              onClick={() => alert("Próximamente…")}
              className="navButton"
            >
              🛠️ Configuración
            </button>
          </nav>
        </div>

        <div className="sidebarFooter">© 2025 EdificioInteligente</div>
      </aside>

      {/* Contenido */}
      <main className="content">
        <header className="topbar">
          <h1>Mi panel</h1>
          <button onClick={logout} className="btnLogout">
            Cerrar sesión
          </button>
        </header>

        {/* Aquí se renderizan las sub-rutas (Inicio, Finanzas, etc.) */}
        <Outlet />
      </main>
    </div>
  );
}

export { Home }; // opcional por si en algún sitio lo importas como named export
