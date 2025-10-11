import {BrowserRouter, Routes, Route} from 'react-router-dom' 
import { Home } from './paginas/Home'
import { Registrar } from './paginas/Registrar'
import { Login } from './paginas/Login'
import { DashboardAdmin } from './paginas/DashboardAdmin'

function App() {

  return (
    <BrowserRouter>
    <Routes>
      <Route path='/' element= {<Login/>}></Route>
      <Route path='/home' element= {<Home/>}></Route>


      <Route path="/dashboardAdmin" element={<DashboardAdmin />}>
          <Route path="registrar" element={<Registrar />} />
        </Route>
      



    </Routes>
    </BrowserRouter>
  )
}

export default App
