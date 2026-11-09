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

const router = createBrowserRouter([
  { path:"/",
    element:<App/>,
},
{ path:"/production",
    element:<Production/>,
},
{
        path: "/edit-prices",
        element: <EditPrice />
},
{ path:"/employees",
    element:<Employees/>,
}
]);

createRoot(document.getElementById('root')).render(
    <RouterProvider router={router} />
)
