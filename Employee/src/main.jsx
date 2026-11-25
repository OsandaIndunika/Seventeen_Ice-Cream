import { createRoot } from 'react-dom/client'
import './index.css'
import Dashboard from './Pages/Dashboard.jsx'
import MyAttendance from './Pages/MyAttendance.jsx';
import Salary from './Pages/Salary.jsx';
import Leave from './Pages/Leave.jsx';
import Overtime from './Pages/Overtime.jsx';
import MealPreferences from './Pages/MealPreferences.jsx';
import Profile from './Pages/Profile.jsx';

import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
const router = createBrowserRouter([
  { path:"/",
    element:<Profile />
},
{
    path: "/attendance",
    element: <MyAttendance />
  },
  {
  path: "/salary",
  element: <Salary />
},
{
    path: "/leave",
    element: <Leave />
  },
   {
    path: "/overtime",
    element: <Overtime />
  },
    {
    path: "/meal-preferences",
    element: <MealPreferences />
  },


]);

createRoot(document.getElementById('root')).render(
  <RouterProvider router={router} />
)
