import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AssignVehicle from './AssignVehicle';
import Billing from './Billing';
import './App.css';
import DailyReports from './DaillyReports';
import Returns from './Returns';
import CashPayment from './CashPayment';
import CreditArrangement from './CreditArrangement';
import ChequeVerification from './ChequeVerification';

function App() {
  return (
    // <AssignVehicle />
    <Router>
      <Routes>
        <Route path="/" element={<Billing />}/>
        <Route path="/billing" element={<Billing />} />
        <Route path="/dailyReports" element={<DailyReports />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/cash" element={<CashPayment />} />
        <Route path="/credit" element={<CreditArrangement />} />
        <Route path="/cheque" element={<ChequeVerification />} />
      </Routes>
    </Router>
  );
}

export default App
