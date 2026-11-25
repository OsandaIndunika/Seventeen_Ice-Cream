import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import EditPrice from './Pages/EditPrice.jsx'
import Production from './Pages/Production.jsx'
import Employees from './Pages/Employees.jsx'
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import RawMaterial from './Pages/RawMaterial.jsx'
import Delivery from './Pages/Delivery.jsx'
import Outlets from './Pages/Outlet.jsx'
import BatchManagement from './Pages/BatchManagement.jsx'
import Dashboard from './Pages/Dashboard.jsx'


const router = createBrowserRouter([
  { path:"/",
    element:<Dashboard />
},
{ path:"/production",
    element:<Production/>
},
{
        path: "/edit-prices",
        element: <EditPrice />
},
{ path:"/employees",
    element:<Employees/>
},
{
    path:"/raw-materials",
    element:<RawMaterial />
},
{
    path:"/outlet",
    element:<Outlets />
},
{ path:"/delivery",
    element:<Delivery />
},
{ path:"/batch-management",
    element:<BatchManagement />
},

]);

createRoot(document.getElementById('root')).render(
    <RouterProvider router={router} />
)
