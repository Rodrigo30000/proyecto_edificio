import { BrowserRouter, Routes, Route } from "react-router-dom";

// Páginas (usa SIEMPRE un solo import por archivo)
import Home from "./paginas/Home.jsx";          // Home = layout del usuario (con <Outlet />)
import Inicio from "./paginas/Inicio.jsx";      // Contenido de /home
import Finanzas from "./paginas/Finanzas.jsx";  // Contenido de /home/finanzas

// Admin y otros
import { DashboardAdmin } from "./paginas/DashboardAdmin";
import { Registrar } from "./paginas/Registrar";
import { Login } from "./paginas/Login";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* HOME como layout */}
        <Route path="/home" element={<Home />}>
          <Route index element={<Inicio />} />
          <Route path="finanzas" element={<Finanzas />} />
        </Route>

        {/* Dashboard Admin (con <Outlet />) */}
        <Route path="/dashboardAdmin" element={<DashboardAdmin />}>
          <Route path="registrar" element={<Registrar />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
